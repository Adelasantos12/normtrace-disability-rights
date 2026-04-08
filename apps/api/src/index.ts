import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config({ path: '../../.env' }); // Load from root if possible

const app = express();
const port = process.env.PORT || 4000;
const prisma = new PrismaClient();

// Ensure Gemini API Key is available
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large text submissions

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

    // 2. Perform Gemini Analysis (asynchronous, but we await for simplicity in pilot)
    // In production, this would be queued (e.g., BullMQ)
    if (process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });

        const prompt = `
          Perform a normative analysis on the following legal text for jurisdiction: ${jurisdiction}.
          Legal Level: ${legalLevel || 'N/A'}.
          Focus on Disability Rights (CRPD).

          Provide a JSON response with the following structure exactly (no markdown wrapping, just valid JSON):
          {
            "mainProblem": "Description of the main legal/normative problem",
            "gapType": "Type of normative gap (e.g., Exclusion, Contradiction)",
            "likelyRemedialLevel": "Where it should be fixed (e.g., Federal Legislature)",
            "methodologicalCaution": "Any cautions or limitations to this finding"
          }

          Text to analyze:
          ${sourceText.substring(0, 30000)} // Truncating for pilot safety
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Clean up markdown code blocks if Gemini returns them
        const jsonStr = responseText.replace(/```json\n?|\n?```/g, '').trim();
        const parsedFindings = JSON.parse(jsonStr);

        // 3. Save findings
        await prisma.structuredFinding.create({
          data: {
            analysisRunId: analysisRun.id,
            mainProblem: parsedFindings.mainProblem,
            gapType: parsedFindings.gapType,
            likelyRemedialLevel: parsedFindings.likelyRemedialLevel,
            methodologicalCaution: parsedFindings.methodologicalCaution,
          }
        });

        // Update status
        await prisma.analysisRun.update({
          where: { id: analysisRun.id },
          data: { status: 'COMPLETED' }
        });

      } catch (geminiError) {
        console.error("Gemini Analysis Error:", geminiError);
        await prisma.analysisRun.update({
          where: { id: analysisRun.id },
          data: { status: 'FAILED' }
        });
      }
    } else {
       console.warn("GEMINI_API_KEY not found. Skipping real analysis.");
       await prisma.analysisRun.update({
          where: { id: analysisRun.id },
          data: { status: 'COMPLETED_MOCK' }
       });
    }

    res.status(201).json({
      message: 'Analysis initiated',
      analysisId: analysisRun.id
    });

  } catch (error) {
    console.error('Error starting analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
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
