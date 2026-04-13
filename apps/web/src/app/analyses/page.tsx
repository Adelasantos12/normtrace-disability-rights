"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@normtrace/ui";

type AnalysisListItem = {
  id: string;
  jurisdiction?: string | null;
  legalLevel?: string | null;
  titleOriginal?: string | null;
  lawDate?: string | null;
  documentType?: string | null;
  updatedAt: string;
  currentAnalysisRun?: {
    id: string;
    status: string;
    createdAt: string;
    sourceDocument?: {
      versionDate?: string | null;
    } | null;
  } | null;
};

export default function SavedAnalysesPage() {
  const [documents, setDocuments] = useState<AnalysisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalyses = async () => {
      try {
        const res = await fetch("/api/analyses");
        if (!res.ok) throw new Error("Failed to load saved analyses");
        const data = await res.json();
        setDocuments(data.documents || []);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadAnalyses();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-neutral-900">
      <header className="mb-10 pb-6 border-b border-neutral-200">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 mb-4 inline-block">
          &larr; Back to Home
        </Link>
        <div className="flex justify-between items-end">
          <h1 className="text-3xl font-semibold tracking-tight">Saved Analyses</h1>
          <Link href="/analyses/new">
            <Button className="px-4 py-2 text-sm">New Analysis</Button>
          </Link>
        </div>
      </header>

      <main>
        {loading && <p className="text-sm text-neutral-500">Loading analyses...</p>}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {!loading && !error && (
          <div className="space-y-4">
            {documents.map((document) => (
              <Card key={document.id} className="hover:border-neutral-300 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-medium text-lg">
                      {document.titleOriginal || 'Untitled legal document'}
                    </h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      Jurisdiction: {document.jurisdiction || 'N/A'} {document.legalLevel ? `- ${document.legalLevel}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded text-xs">
                        Current status: {document.currentAnalysisRun?.status || 'N/A'}
                      </span>
                      <span className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded text-xs">
                        Law date: {document.lawDate || "N/A"}
                      </span>
                      <span className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded text-xs">
                        Last update: {new Date(document.updatedAt).toLocaleString()}
                      </span>
                      <span className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded text-xs">
                        Type: {document.documentType || "N/A"}
                      </span>
                    </div>
                  </div>
                  <Link href={`/analyses/${document.id}`}>
                    <Button className="px-4 py-2 text-sm bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50">
                      View Results
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}

            {documents.length === 0 && (
              <Card>
                <p className="text-sm text-neutral-600">No analyses saved yet. Create one from “New Analysis”.</p>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
