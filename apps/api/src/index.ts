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

// Trust the proxy to ensure rate limiting works correctly behind Railway/Nginx
app.set('trust proxy', 1);

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

function isRetryableModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const loweredMessage = message.toLowerCase();

  return (
    loweredMessage.includes('timeouterror') ||
    loweredMessage.includes('timed out') ||
    loweredMessage.includes('aborted due to timeout') ||
    loweredMessage.includes('429') ||
    loweredMessage.includes('500') ||
    loweredMessage.includes('502') ||
    loweredMessage.includes('503') ||
    loweredMessage.includes('504')
  );
}

function resolveGeminiTimeoutMs() {
  const configured = Number(process.env.GEMINI_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured >= 10_000) {
    return configured;
  }
  return 90_000;
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
    signal: AbortSignal.timeout(resolveGeminiTimeoutMs()),
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
      if (!isNotFoundModelError(error) && !isRetryableModelError(error)) {
        throw error;
      }
      console.warn(`Gemini model unavailable for generateContent: ${modelName}`, error);
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

    IMPORTANT: You must output ALL strings and text values in the JSON structure strictly in ${outputLanguage}. Do not use any other language for the values.

    Provide a JSON response with the following structure exactly (no markdown wrapping, just valid JSON):
    {
      "dashboardSummaries": [
        {
          "dimension": "Analytical dimension (e.g., Normative coverage, Institutional anchoring, Clarity of responsibilities, Justiciability / enforceability, Inclusion and intersectionality, Implementation-relevant gaps, Normative silence / omissions)",
          "value": "Brief descriptive status",
          "explanation": "Short analytical explanation"
        }
      ],
      "heatmapRecords": [
        {
          "domesticProvision": "The domestic provision or section",
          "crpdArticle": "Linked CRPD article or theme",
          "alignmentType": "Type of alignment (e.g., Strong anchoring, Partial anchoring, Indirect coverage, Ambiguous formulation, Normative silence / gap)",
          "evidenceExcerpt": "Relevant excerpt from the text",
          "analyticalNote": "Brief analytical note explaining the alignment or gap"
        }
      ],
      "findingCards": [
        {
          "title": "Title of the finding",
          "category": "Category (e.g., omission, ambiguity, weak enforceability, coordination gap)",
          "significance": "Why it matters for implementation",
          "legalExcerpt": "Supporting legal excerpt",
          "standardEngaged": "Linked standard / CRPD reference"
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
    if (parsedFindings.dashboardSummaries && Array.isArray(parsedFindings.dashboardSummaries)) {
      await prisma.dashboardSummary.createMany({
        data: parsedFindings.dashboardSummaries.map((r: any) => ({
          analysisRunId: analysisRun.id,
          dimension: r.dimension || 'Unknown',
          value: r.value,
          explanation: r.explanation
        }))
      });
    }

    if (parsedFindings.heatmapRecords && Array.isArray(parsedFindings.heatmapRecords)) {
      await prisma.heatmapRecord.createMany({
        data: parsedFindings.heatmapRecords.map((r: any) => ({
          analysisRunId: analysisRun.id,
          domesticProvision: r.domesticProvision,
          crpdArticle: r.crpdArticle,
          alignmentType: r.alignmentType,
          evidenceExcerpt: r.evidenceExcerpt,
          analyticalNote: r.analyticalNote
        }))
      });
    }

    if (parsedFindings.findingCards && Array.isArray(parsedFindings.findingCards)) {
      await prisma.structuredFindingCard.createMany({
        data: parsedFindings.findingCards.map((r: any) => ({
          analysisRunId: analysisRun.id,
          title: r.title || 'Untitled Finding',
          category: r.category,
          significance: r.significance,
          legalExcerpt: r.legalExcerpt,
          standardEngaged: r.standardEngaged
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
    // Allow requests with no origin (like mobile apps, curl requests, or same-origin requests)
    if (!origin) return callback(null, true);

    // Check exact match
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // Check if it's a Railway app domain (fallback for production environments)
    if (origin.endsWith('.railway.app') || origin.endsWith('.up.railway.app')) {
      return callback(null, true);
    }

    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
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
        dashboardSummaries: true,
        heatmapRecords: true,
        findingCards: true
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
