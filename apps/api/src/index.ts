import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';

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

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybePrismaError = error as { code?: string };
  return maybePrismaError.code === 'P2021';
}

function isSchemaCompatibilityError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybePrismaError = error as { code?: string };
  return maybePrismaError.code === 'P2021' || maybePrismaError.code === 'P2022';
}

type StructuredFindingsPayload = {
  dashboardSummaries?: Array<{
    dimension?: string;
    value?: string;
    explanation?: string;
  }>;
  heatmapRecords?: Array<{
    domesticProvision?: string;
    crpdArticle?: string;
    alignmentType?: string;
    evidenceExcerpt?: string;
    analyticalNote?: string;
  }>;
  findingCards?: Array<{
    title?: string;
    category?: string;
    significance?: string;
    legalExcerpt?: string;
    standardEngaged?: string;
  }>;
};

function buildMockStructuredFindings(sourceText: string, outputLanguage: string): StructuredFindingsPayload {
  const excerpt = sourceText.substring(0, 600).trim() || 'No source text available.';
  const languageLabel = languageLabelMap[outputLanguage] || 'English';
  return {
    dashboardSummaries: [
      {
        dimension: 'Normative coverage',
        value: 'Preliminary',
        explanation: `Automated model generation is currently unavailable. This preliminary view suggests manual review is needed (${languageLabel}).`,
      },
      {
        dimension: 'Normative silence / omissions',
        value: 'Potential gaps',
        explanation: 'The current run indicates potential gaps requiring verification against full legal text and primary sources.',
      },
    ],
    heatmapRecords: [
      {
        domesticProvision: 'Initial extracted segment',
        crpdArticle: 'CRPD thematic cluster (to validate)',
        alignmentType: 'Ambiguous formulation',
        evidenceExcerpt: excerpt,
        analyticalNote: 'Preliminary fallback record generated because no compatible Gemini model was available.',
      },
    ],
    findingCards: [
      {
        title: 'Model unavailability during structured extraction',
        category: 'methodological limitation',
        significance: 'The system indicates provisional findings only; legal experts should validate with primary sources.',
        legalExcerpt: excerpt,
        standardEngaged: 'CRPD (cross-cutting review suggested)',
      },
    ],
  };
}

async function persistStructuredResultsInMetadata(analysisRunId: string, findings: StructuredFindingsPayload, modelName: string) {
  await prisma.sourceDocument.updateMany({
    where: { analysisRunId },
    data: {
      metadata: {
        structuredResults: findings,
        generationModel: modelName,
        generatedAt: new Date().toISOString(),
      }
    }
  });
}

function computeSourceHash(text: string) {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(ley|law|act|codigo|code|decreto|reglamento)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function createLegacyRunRaw(input: {
  jurisdiction: string;
  legalLevel?: string;
  language?: string;
  sourceText: string;
  versionDate?: string;
}) {
  const analysisRunId = crypto.randomUUID();
  const sourceDocumentId = crypto.randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "AnalysisRun" ("id","jurisdiction","legalLevel","outputLanguage","status","createdAt","updatedAt")
    VALUES (${analysisRunId}, ${input.jurisdiction}, ${input.legalLevel || null}, ${input.language || 'EN'}, ${'PROCESSING'}, NOW(), NOW())
  `;

  await prisma.$executeRaw`
    INSERT INTO "SourceDocument" ("id","analysisRunId","sourceType","content","versionDate")
    VALUES (${sourceDocumentId}, ${analysisRunId}, ${'TEXT'}, ${input.sourceText}, ${input.versionDate || null})
  `;

  return { id: analysisRunId };
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
    const parsedFindings = JSON.parse(jsonStr) as StructuredFindingsPayload;
    await persistStructuredResultsInMetadata(analysisRun.id, parsedFindings, geminiModel);

    // Save findings
    if (parsedFindings.dashboardSummaries && Array.isArray(parsedFindings.dashboardSummaries)) {
      try {
        await prisma.dashboardSummary.createMany({
          data: parsedFindings.dashboardSummaries.map((r: any) => ({
            analysisRunId: analysisRun.id,
            dimension: r.dimension || 'Unknown',
            value: r.value,
            explanation: r.explanation
          }))
        });
      } catch (error) {
        if (!isMissingTableError(error)) {
          throw error;
        }
        console.warn('DashboardSummary table not found. Skipping dashboard summary persistence.', error);
      }
    }

    if (parsedFindings.heatmapRecords && Array.isArray(parsedFindings.heatmapRecords)) {
      try {
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
      } catch (error) {
        if (!isMissingTableError(error)) {
          throw error;
        }
        console.warn('HeatmapRecord table not found. Skipping heatmap persistence.', error);
      }
    }

    if (parsedFindings.findingCards && Array.isArray(parsedFindings.findingCards)) {
      try {
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
      } catch (error) {
        if (!isMissingTableError(error)) {
          throw error;
        }
        console.warn('StructuredFindingCard table not found. Skipping finding cards persistence.', error);
      }
    }

    const persistedRun = await prisma.analysisRun.findUnique({
      where: { id: analysisRun.id },
      select: { canonicalDocumentId: true },
    }).catch((error) => {
      if (isSchemaCompatibilityError(error)) {
        return null;
      }
      throw error;
    });

    if (persistedRun?.canonicalDocumentId) {
      try {
        await prisma.$transaction([
          prisma.analysisRun.updateMany({
            where: {
              canonicalDocumentId: persistedRun.canonicalDocumentId,
              isCurrent: true,
              id: { not: analysisRun.id },
            },
            data: {
              isCurrent: false,
              isPubliclyVisible: false,
              status: 'SUPERSEDED',
            }
          }),
          prisma.analysisRun.update({
            where: { id: analysisRun.id },
            data: {
              status: 'COMPLETED',
              isCurrent: true,
              isPubliclyVisible: true,
            }
          }),
          prisma.canonicalDocument.update({
            where: { id: persistedRun.canonicalDocumentId },
            data: { currentAnalysisRunId: analysisRun.id }
          })
        ]);
      } catch (error) {
        if (!isSchemaCompatibilityError(error)) {
          throw error;
        }
        await prisma.analysisRun.update({
          where: { id: analysisRun.id },
          data: { status: 'COMPLETED' }
        });
      }
    } else {
      await prisma.analysisRun.update({
        where: { id: analysisRun.id },
        data: { status: 'COMPLETED' }
      });
    }
  } catch (geminiError) {
    if (isNotFoundModelError(geminiError)) {
      const fallbackFindings = buildMockStructuredFindings(payload.sourceText, payload.language || 'EN');
      await persistStructuredResultsInMetadata(analysisRun.id, fallbackFindings, geminiModel);
      await prisma.analysisRun.update({
        where: { id: analysisRun.id },
        data: { status: 'COMPLETED_MOCK' }
      });
      return;
    }

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

function isAdminRequest(req: express.Request) {
  const token = req.header('x-admin-token');
  return Boolean(process.env.ADMIN_TOKEN) && token === process.env.ADMIN_TOKEN;
}

app.post('/api/analyses', async (req, res) => {
  try {
    const {
      jurisdiction,
      legalLevel,
      language,
      sourceText,
      versionDate,
      title,
      documentType,
      country,
      subnationalUnit,
      lawDate,
      publicationDate,
      sourceUrl,
      sessionId,
      userId,
    } = req.body;

    if (!jurisdiction || !sourceText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const createLegacyRun = async () => {
      const legacyRun = await createLegacyRunRaw({
        jurisdiction,
        legalLevel,
        language,
        sourceText,
        versionDate,
      });

      void processAnalysisInBackground(legacyRun, {
        jurisdiction,
        legalLevel,
        language,
        sourceText,
      });

      return res.status(201).json({
        message: 'Analysis initiated (legacy schema mode).',
        analysisId: legacyRun.id,
        reused: false,
      });
    };

    const normalizedVersionDate = versionDate || null;
    const sourceHash = computeSourceHash(sourceText);
    const titleOriginal = title || `Document ${jurisdiction}`;
    const titleNormalized = normalizeTitle(titleOriginal);

    const existingCanonical = await prisma.canonicalDocument.findFirst({
      where: {
        jurisdiction,
        legalLevel: legalLevel || null,
        titleNormalized,
        lawDate: lawDate || null,
      },
    }).catch((error) => {
      if (isSchemaCompatibilityError(error)) {
        return null;
      }
      throw error;
    });

    if (!existingCanonical) {
      const canonicalModelAvailable = await prisma.canonicalDocument.findFirst({
        where: { id: '__schema_check__' }
      }).then(() => true).catch((error) => !isSchemaCompatibilityError(error));

      if (!canonicalModelAvailable) {
        return createLegacyRun();
      }
    }

    const canonicalDocument = existingCanonical
      ? existingCanonical
      : await prisma.canonicalDocument.create({
          data: {
            country: country || null,
            subnationalUnit: subnationalUnit || null,
            jurisdiction,
            legalLevel: legalLevel || null,
            documentType: documentType || 'LAW',
            titleOriginal,
            titleNormalized,
            lawDate: lawDate || normalizedVersionDate,
            publicationDate: publicationDate || null,
            sourceUrl: sourceUrl || null,
            documentHash: sourceHash,
            language: language || 'EN',
            isPublic: true,
          }
        }).catch((error) => {
          if (isSchemaCompatibilityError(error)) {
            return null;
          }
          throw error;
        });

    if (!canonicalDocument) {
      return createLegacyRun();
    }

    const existingEquivalentRun = await prisma.analysisRun.findFirst({
      where: {
        canonicalDocumentId: canonicalDocument.id,
        sourceDocument: {
          is: {
            versionDate: normalizedVersionDate,
            content: sourceText,
          }
        },
        status: { in: ['COMPLETED', 'COMPLETED_MOCK', 'PROCESSING'] }
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingEquivalentRun) {
      await prisma.usageEvent.create({
        data: {
          userId: userId || null,
          sessionId: sessionId || null,
          canonicalDocumentId: canonicalDocument.id,
          analysisRunId: existingEquivalentRun.id,
          eventType: 'duplicate_detected',
          countryHint: country || jurisdiction,
          userAgent: req.header('user-agent') || null,
        }
      }).catch(() => null);

      return res.status(200).json({
        message: 'Ya existe un análisis vigente de este documento. Puedes consultar el resultado actual.',
        analysisId: existingEquivalentRun.id,
        canonicalDocumentId: canonicalDocument.id,
        reused: true,
      });
    }

    // 1. Create initial DB record
    const analysisRun = await prisma.analysisRun.create({
      data: {
        canonicalDocumentId: canonicalDocument.id,
        jurisdiction,
        legalLevel: legalLevel || null,
        outputLanguage: language || 'EN',
        status: 'PROCESSING',
        isCurrent: false,
        isPubliclyVisible: false,
        triggerType: existingCanonical ? 're-run' : 'new',
        createdByUserId: userId || null,
        createdBySessionId: sessionId || null,
        inputMetadata: {
          titleOriginal,
          titleNormalized,
          documentType: documentType || null,
          country: country || null,
          subnationalUnit: subnationalUnit || null,
          lawDate: lawDate || null,
          publicationDate: publicationDate || null,
          sourceUrl: sourceUrl || null,
        },
        sourceDocument: {
          create: {
            sourceType: 'TEXT',
            content: sourceText,
            versionDate: normalizedVersionDate,
            metadata: {
              sourceHash,
              canonicalDocumentId: canonicalDocument.id,
            }
          }
        }
      }
    }).catch(async (error) => {
      if (isSchemaCompatibilityError(error)) {
        return null;
      }
      throw error;
    });

    if (!analysisRun) {
      return createLegacyRun();
    }

    await prisma.usageEvent.create({
      data: {
        userId: userId || null,
        sessionId: sessionId || null,
        canonicalDocumentId: canonicalDocument.id,
        analysisRunId: analysisRun.id,
        eventType: existingCanonical ? 'rerun_analysis' : 'create_analysis',
        countryHint: country || jurisdiction,
        userAgent: req.header('user-agent') || null,
      }
    }).catch(() => null);

    // 2. Trigger analysis asynchronously and respond immediately.
    void processAnalysisInBackground(analysisRun, {
      jurisdiction,
      legalLevel,
      language,
      sourceText,
    });

    res.status(201).json({
      message: 'Analysis initiated',
      analysisId: analysisRun.id,
      canonicalDocumentId: canonicalDocument.id,
      reused: false,
    });

  } catch (error: any) {
    console.error('Error starting analysis:', error);
    // Return the actual error message so the frontend can display it for debugging
    res.status(500).json({ error: `Internal server error: ${error.message || 'Unknown database or server error'}` });
  }
});

app.get('/api/analyses', async (req, res) => {
  try {
    const documents = await prisma.canonicalDocument.findMany({
      where: { isPublic: true },
      include: {
        currentAnalysisRun: {
          include: {
            sourceDocument: true,
          }
        },
      },
      orderBy: { updatedAt: 'desc' }
    }).catch(async (error) => {
      if (!isSchemaCompatibilityError(error)) {
        throw error;
      }

      const analyses = await prisma.$queryRaw<Array<{
        id: string;
        jurisdiction: string;
        legalLevel: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        versionDate: string | null;
      }>>`
        SELECT ar."id", ar."jurisdiction", ar."legalLevel", ar."status", ar."createdAt", ar."updatedAt", sd."versionDate"
        FROM "AnalysisRun" ar
        LEFT JOIN "SourceDocument" sd ON sd."analysisRunId" = ar."id"
        ORDER BY ar."createdAt" DESC
      `;

      return analyses.map((run) => ({
        id: run.id,
        jurisdiction: run.jurisdiction,
        legalLevel: run.legalLevel,
        titleOriginal: `Document ${run.jurisdiction}`,
        lawDate: run.versionDate || null,
        documentType: 'LAW',
        updatedAt: run.updatedAt,
        currentAnalysisRun: {
          id: run.id,
          status: run.status,
          createdAt: run.createdAt,
          sourceDocument: {
            versionDate: run.versionDate,
          },
        }
      }));
    });
    res.status(200).json({ documents });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/analyses/:id', async (req, res) => {
  try {
    const canonicalDocument = await prisma.canonicalDocument.findUnique({
      where: { id: req.params.id },
      include: { currentAnalysisRun: true },
    }).catch((error) => {
      if (isSchemaCompatibilityError(error)) {
        return null;
      }
      throw error;
    });
    const runId = canonicalDocument?.currentAnalysisRun?.id || req.params.id;

    const analysisRun = await prisma.analysisRun.findUnique({ where: { id: runId } }).catch(async (error) => {
      if (!isSchemaCompatibilityError(error)) {
        throw error;
      }
      const rows = await prisma.$queryRaw<Array<{
        id: string;
        jurisdiction: string;
        legalLevel: string | null;
        outputLanguage: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
      }>>`
        SELECT "id","jurisdiction","legalLevel","outputLanguage","status","createdAt","updatedAt"
        FROM "AnalysisRun"
        WHERE "id" = ${runId}
        LIMIT 1
      `;
      return rows[0] || null;
    });

    if (!analysisRun) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const [sourceDocument, dashboardSummaries, heatmapRecords, findingCards] = await Promise.all([
      prisma.sourceDocument.findUnique({ where: { analysisRunId: analysisRun.id } }).catch(async (error) => {
        if (isMissingTableError(error)) {
          return null;
        }
        if (isSchemaCompatibilityError(error)) {
          const rows = await prisma.$queryRaw<Array<{
            analysisRunId: string;
            sourceType: string;
            content: string | null;
            versionDate: string | null;
            metadata: unknown;
          }>>`
            SELECT "analysisRunId","sourceType","content","versionDate","metadata"
            FROM "SourceDocument"
            WHERE "analysisRunId" = ${analysisRun.id}
            LIMIT 1
          `;
          return rows[0] || null;
        }
        throw error;
      }),
      prisma.dashboardSummary.findMany({ where: { analysisRunId: analysisRun.id } }).catch((error) => {
        if (isMissingTableError(error)) {
          return [];
        }
        throw error;
      }),
      prisma.heatmapRecord.findMany({ where: { analysisRunId: analysisRun.id } }).catch((error) => {
        if (isMissingTableError(error)) {
          return [];
        }
        throw error;
      }),
      prisma.structuredFindingCard.findMany({ where: { analysisRunId: analysisRun.id } }).catch((error) => {
        if (isMissingTableError(error)) {
          return [];
        }
        throw error;
      })
    ]);

    const metadata = sourceDocument?.metadata as { structuredResults?: StructuredFindingsPayload } | null;
    const structuredResults = metadata?.structuredResults;

    const resolvedDashboardSummaries = (dashboardSummaries && dashboardSummaries.length > 0)
      ? dashboardSummaries
      : (structuredResults?.dashboardSummaries || []);
    const resolvedHeatmapRecords = (heatmapRecords && heatmapRecords.length > 0)
      ? heatmapRecords
      : (structuredResults?.heatmapRecords || []);
    const resolvedFindingCards = (findingCards && findingCards.length > 0)
      ? findingCards
      : (structuredResults?.findingCards || []);

    const analysis = {
      ...analysisRun,
      canonicalDocument,
      sourceDocument,
      dashboardSummaries: resolvedDashboardSummaries,
      heatmapRecords: resolvedHeatmapRecords,
      findingCards: resolvedFindingCards
    };
    const runCanonicalDocumentId =
      typeof analysisRun === 'object' && analysisRun !== null && 'canonicalDocumentId' in analysisRun
        ? (analysisRun as { canonicalDocumentId?: string | null }).canonicalDocumentId || null
        : null;

    await prisma.usageEvent.create({
      data: {
        canonicalDocumentId: canonicalDocument?.id || runCanonicalDocumentId,
        analysisRunId: analysisRun.id,
        eventType: 'view_analysis',
        userAgent: req.header('user-agent') || null,
      }
    }).catch(() => null);

    res.status(200).json({ analysis });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/analyses/runs', async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const statusFilter = typeof req.query.status === 'string' ? req.query.status : null;
  const runs = await prisma.analysisRun.findMany({
    where: statusFilter ? { status: statusFilter } : {},
    include: {
      canonicalDocument: true,
      sourceDocument: true,
    },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ runs });
});

app.patch('/api/admin/runs/:id/set-current', async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const run = await prisma.analysisRun.findUnique({ where: { id: req.params.id } });
  if (!run?.canonicalDocumentId) {
    return res.status(404).json({ error: 'Run not found or has no canonical document' });
  }
  await prisma.$transaction([
    prisma.analysisRun.updateMany({
      where: { canonicalDocumentId: run.canonicalDocumentId },
      data: { isCurrent: false, isPubliclyVisible: false, status: 'SUPERSEDED' },
    }),
    prisma.analysisRun.update({
      where: { id: run.id },
      data: { isCurrent: true, isPubliclyVisible: true, status: 'COMPLETED' },
    }),
    prisma.canonicalDocument.update({
      where: { id: run.canonicalDocumentId },
      data: { currentAnalysisRunId: run.id },
    })
  ]);
  res.status(200).json({ ok: true });
});

app.patch('/api/admin/runs/:id/archive', async (req, res) => {
  if (!isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  await prisma.analysisRun.update({
    where: { id: req.params.id },
    data: { status: 'ARCHIVED', isPubliclyVisible: false, adminNotes: 'Archived by admin' }
  });
  res.status(200).json({ ok: true });
});

app.delete('/api/admin/runs/:id', async (req, res) => {
  if (!isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  await prisma.analysisRun.update({
    where: { id: req.params.id },
    data: { status: 'DELETED_BY_ADMIN', isPubliclyVisible: false, deletedAt: new Date() }
  });
  res.status(200).json({ ok: true, softDeleted: true });
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
