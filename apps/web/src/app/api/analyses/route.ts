import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jurisdiction, legalLevel, language, sourceText, versionDate } = body;

    if (!jurisdiction || !sourceText) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    // 2. Perform Gemini Analysis
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
          ${sourceText.substring(0, 1000000)}
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

    return NextResponse.json({
      message: 'Analysis initiated',
      analysisId: analysisRun.id
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error starting analysis:', error);
    return NextResponse.json({ error: `Internal server error: ${error.message || 'Unknown database or server error'}` }, { status: 500 });
  }
}

export async function GET() {
  try {
    const analyses = await prisma.analysisRun.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ analyses });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
