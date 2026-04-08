import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const analysis = await prisma.analysisRun.findUnique({
      where: { id: params.id },
      include: {
        sourceDocument: true,
        structuredFindings: true,
        gapRecords: true,
        actorRecords: true,
        argumentRecords: true
      }
    });

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
