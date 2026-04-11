import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config({ path: '../../.env' }); // Load from root if possible

const app = express();
const port = process.env.PORT || 4000;
const prisma = new PrismaClient();

// Ensure Gemini API Key is available
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const configuredGeminiModel = process.env.GEMINI_MODEL?.trim();

const candidateGeminiModels = [
    configuredGeminiModel,
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ].filter((model): model is string => Boolean(model));

const languageLabelMap: Record<string, string> = {
  EN: 'English',
  ES: 'Spanish',
  FR: 'French',
};

function isNotFoundModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('404') || message.toLowerCase().includes('not found');
}

type GeminiModelListResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

async function fetchSupportedGeminiModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`ListModels failed (${response.status}): ${bodyText}`);
  }

  const data = (await response.json()) as GeminiModelListResponse;
  return (data.models || [])
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => (model.name || '').replace(/^models\//, ''))
    .filter(Boolean);
}

async function generateWithModel(modelName: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`GenerateContent failed for ${modelName} (${response.status}): ${bodyText}`);
  }

  const data = (await response.json()) as GeminiGenerateResponse;
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();

  if (!text) {
    throw new Error(`Empty Gemini response for model ${modelName}`);
  }

  return text;
}

async function generateWithModelFallback(prompt: string) {
  let lastError: unknown = null;
  let modelsToTry = [...candidateGeminiModels];

  try {
    const discoveredModels = await fetchSupportedGeminiModels();
    modelsToTry = [...new Set([...modelsToTry, ...discoveredModels])];
  } catch (error) {
    console.warn('Gemini ListModels request failed. Continuing with static fallbacks.', error);
  }

  for (const modelName of modelsToTry) {
    try {
      const responseText = await generateWithModel(modelName, prompt);
      return { modelName, responseText };
    } catch (error) {
      lastError = error;
      if (!isNotFoundModelError(error)) {
        throw error;
      }
      console.warn(`Gemini model unavailable for generateContent: ${modelName}`);
    }
  }

  throw lastError || new Error('No compatible Gemini model available.');
}

function buildAnalysisPrompt({
  jurisdiction,
  legalLevel,
  language,
  sourceText,
}: {
  jurisdiction: string;
  legalLevel?: string;
  language?: string;
  sourceText: string;
}) {
  const outputLanguage = languageLabelMap[language || ''] || 'English';
  return `
    Perform a normative analysis on the following legal text for jurisdiction: ${jurisdiction}.
    Legal Level: ${legalLevel || 'N/A'}.
    Focus on Disability Rights (CRPD).
    Output language for every value in the JSON: ${outputLanguage}.

    Provide a JSON response with the following structure exactly (no markdown wrapping, just valid JSON):
    {
      "mainProblem": "Description of the main legal/normative problem",
      "gapType": "Type of normative gap (e.g., Exclusion, Contradiction)",
      "likelyRemedialLevel": "Where it should be fixed (e.g., Federal Legislature)",
      "methodologicalCaution": "Any cautions or limitations to this finding",
      "actorRecords": [
        {
          "actorName": "Name of the actor",
          "role": "Role of the actor",
          "responsibilityFlow": "How responsibility flows",
          "enforceability": "Level of enforceability"
        }
      ],
      "gapRecords": [
        {
          "standardEngaged": "The legal standard engaged",
          "severity": "Severity of the gap",
          "interpretiveBasis": "Interpretive basis for the gap",
          "caution": "Methodological caution specific to this gap"
        }
      ],
      "argumentRecords": [
        {
          "legalProblem": "The specific legal problem",
          "standardEngaged": "The relevant standard",
          "deficiencyType": "Type of legal deficiency",
          "doctrinalSupport": "Relevant doctrinal support",
          "remedialPathway": "Possible remedial pathway"
        }
      ]
    }

    Text to analyze:
    ${sourceText.substring(0, 30000)}
  `;
}

async function processAnalysisInBackground(analysisRun: { id: string }, payload: {
  jurisdiction: string;
  legalLevel?: string;
  language?: string;
  sourceText: string;
}) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not found. Skipping real analysis.");
    await prisma.analysisRun.update({
      where: { id: analysisRun.id },
      data: { status: 'COMPLETED_MOCK' }
    });
    return;
  }

  let geminiModel = configuredGeminiModel || candidateGeminiModels[0] || 'unknown';
  try {
    const prompt = buildAnalysisPrompt(payload);
    const generation = await generateWithModelFallback(prompt);
    geminiModel = generation.modelName;
    const responseText = generation.responseText;

    // Clean up markdown code blocks if Gemini returns them
    const jsonStr = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsedFindings = JSON.parse(jsonStr);

    // Save findings
    await prisma.structuredFinding.create({
      data: {
        analysisRunId: analysisRun.id,
        mainProblem: parsedFindings.mainProblem,
        gapType: parsedFindings.gapType,
        likelyRemedialLevel: parsedFindings.likelyRemedialLevel,
        methodologicalCaution: parsedFindings.methodologicalCaution,
      }
    });

    if (parsedFindings.actorRecords && Array.isArray(parsedFindings.actorRecords)) {
      await prisma.actorRecord.createMany({
        data: parsedFindings.actorRecords.map((r: any) => ({
          analysisRunId: analysisRun.id,
          ...r
        }))
      });
    }

    if (parsedFindings.gapRecords && Array.isArray(parsedFindings.gapRecords)) {
      await prisma.gapRecord.createMany({
        data: parsedFindings.gapRecords.map((r: any) => ({
          analysisRunId: analysisRun.id,
          ...r
        }))
      });
    }

    if (parsedFindings.argumentRecords && Array.isArray(parsedFindings.argumentRecords)) {
      await prisma.argumentRecord.createMany({
        data: parsedFindings.argumentRecords.map((r: any) => ({
          analysisRunId: analysisRun.id,
          ...r
        }))
      });
    }

    await prisma.analysisRun.update({
      where: { id: analysisRun.id },
      data: { status: 'COMPLETED' }
    });
  } catch (geminiError) {
    console.error(`Gemini Analysis Error (model: ${geminiModel}):`, geminiError);
    await prisma.analysisRun.update({
      where: { id: analysisRun.id },
      data: { status: 'FAILED' }
    });
  }
}

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:3000']
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json({ limit: '10mb' })); // Allow large text submissions, but not memory-exhausting

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/analyses', async (req, res) => {
  try {
    const { jurisdiction, legalLevel, language, sourceText, versionDate } = req.body;

    if (!jurisdiction || !sourceText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Create initial DB record
    const analysisRun = await prisma.analysisRun.create({
      data: {
        jurisdiction,
        legalLevel,
        outputLanguage: language || 'EN',
        status: 'PROCESSING',
        sourceDocument: {
          create: {
            sourceType: 'TEXT',
            content: sourceText,
            versionDate: versionDate,
          }
        }
      }
    });

    // 2. Trigger analysis asynchronously and respond immediately.
    void processAnalysisInBackground(analysisRun, {
      jurisdiction,
      legalLevel,
      language,
      sourceText,
    });

    res.status(201).json({
      message: 'Analysis initiated',
      analysisId: analysisRun.id
    });

  } catch (error: any) {
    console.error('Error starting analysis:', error);
    // Return the actual error message so the frontend can display it for debugging
    res.status(500).json({ error: `Internal server error: ${error.message || 'Unknown database or server error'}` });
  }
});

app.get('/api/analyses', async (req, res) => {
  try {
    const analyses = await prisma.analysisRun.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ analyses });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/analyses/:id', async (req, res) => {
  try {
    const analysis = await prisma.analysisRun.findUnique({
      where: { id: req.params.id },
      include: {
        sourceDocument: true,
        structuredFindings: true,
        gapRecords: true,
        actorRecords: true,
        argumentRecords: true
      }
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.status(200).json({ analysis });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
