"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, Card } from "@normtrace/ui";

interface AnalysisData {
  id: string;
  jurisdiction: string;
  legalLevel: string;
  status: string;
  sourceDocument?: {
    sourceType: string;
  };
  dashboardSummaries?: Array<{
    dimension: string;
    value: string;
    explanation: string;
  }>;
  heatmapRecords?: Array<{
    domesticProvision: string;
    crpdArticle: string;
    alignmentType: string;
    evidenceExcerpt: string;
    analyticalNote: string;
  }>;
  findingCards?: Array<{
    title: string;
    category: string;
    significance: string;
    legalExcerpt: string;
    standardEngaged: string;
  }>;
}

export default function AnalysisResultsPage({ params }: { params: { id: string } }) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchAnalysis = async () => {
      try {
        const res = await fetch(`/api/analyses/${params.id}`);
        if (!res.ok) throw new Error("Failed to load analysis");
        const data = await res.json();
        setAnalysis(data.analysis);

        // Stop polling if the status is terminal
        if (["COMPLETED", "FAILED", "COMPLETED_MOCK"].includes(data.analysis.status)) {
           clearInterval(interval);
        }
      } catch (err: any) {
        setError(err.message);
        clearInterval(interval); // Stop on error too
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();

    // Poll every 5 seconds
    interval = setInterval(fetchAnalysis, 5000);

    return () => clearInterval(interval);
  }, [params.id]);

  if (loading) {
    return <div className="p-12 text-center text-neutral-500">Loading analysis data...</div>;
  }

  if (error || !analysis) {
    return <div className="p-12 text-center text-red-500">Error: {error || "Analysis not found"}</div>;
  }

  const tabs = [
    {
      id: "overview",
      label: "Overview Dashboard",
      content: (
        <div className="space-y-6">
          {analysis.status === "PROCESSING" && (
            <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded animate-pulse text-sm flex items-center">
              <span className="mr-2 border-2 border-blue-800 border-t-transparent w-4 h-4 rounded-full animate-spin"></span>
              Analysis in progress... Results will update automatically.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <h3 className="font-medium mb-2 text-sm text-neutral-500 uppercase tracking-wide">Context</h3>
              <div className="text-sm space-y-1">
                <div><span className="font-semibold">Jurisdiction:</span> {analysis.jurisdiction}</div>
                <div><span className="font-semibold">Level:</span> {analysis.legalLevel || 'N/A'}</div>
                <div><span className="font-semibold">Status:</span> {analysis.status}</div>
              </div>
            </Card>

            {analysis.dashboardSummaries?.map((summary, idx) => (
              <Card key={idx}>
                <h3 className="font-medium mb-2 text-sm text-neutral-500 uppercase tracking-wide">{summary.dimension}</h3>
                <div className="text-lg font-semibold text-institutional-900 mb-2">{summary.value}</div>
                <p className="text-xs text-neutral-600">{summary.explanation}</p>
              </Card>
            ))}
          </div>

          <Card>
            <h3 className="font-medium mb-4 text-amber-800">Methodological Note</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              These outputs are analytical and indicative. The findings suggest areas of partial alignment or potential implementation gaps based on textual analysis. They do not constitute definitive legal judgments and should be verified against primary sources.
            </p>
          </Card>
        </div>
      )
    },
    {
      id: "heatmap",
      label: "Alignment Heatmap",
      content: (
        <div className="space-y-6">
          <Card>
            <h3 className="font-medium mb-4">Normative Matrix</h3>
            <p className="text-sm text-neutral-600 mb-6">Select a cell to view supporting evidence and analytical notes.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-neutral-700 uppercase bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th scope="col" className="px-6 py-3">Domestic Provision</th>
                    <th scope="col" className="px-6 py-3">CRPD Standard</th>
                    <th scope="col" className="px-6 py-3">Alignment Type</th>
                    <th scope="col" className="px-6 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.heatmapRecords?.map((record, idx) => (
                    <tr key={idx} className="bg-white border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-6 py-4 font-medium text-neutral-900">{record.domesticProvision}</td>
                      <td className="px-6 py-4">{record.crpdArticle}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold
                          ${record.alignmentType?.toLowerCase().includes('strong') ? 'bg-green-100 text-green-800' :
                            record.alignmentType?.toLowerCase().includes('partial') ? 'bg-amber-100 text-amber-800' :
                            record.alignmentType?.toLowerCase().includes('silence') || record.alignmentType?.toLowerCase().includes('gap') ? 'bg-red-100 text-red-800' :
                            'bg-neutral-100 text-neutral-800'}`}>
                          {record.alignmentType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedEvidence(record)}
                          className="text-institutional-600 hover:text-institutional-900 font-medium text-xs underline"
                          aria-label={`View evidence for ${record.domesticProvision}`}
                        >
                          View Evidence
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!analysis.heatmapRecords || analysis.heatmapRecords.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-neutral-500 italic">No heatmap data available yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {selectedEvidence && (
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-institutional-900">Evidence Drawer</h3>
                <button
                  onClick={() => setSelectedEvidence(null)}
                  className="text-neutral-400 hover:text-neutral-700"
                  aria-label="Close evidence drawer"
                >
                  ✕ Close
                </button>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="font-semibold block text-neutral-700">Provision:</span>
                  <p className="text-neutral-600">{selectedEvidence.domesticProvision}</p>
                </div>
                <div>
                  <span className="font-semibold block text-neutral-700">Relevant Standard:</span>
                  <p className="text-neutral-600">{selectedEvidence.crpdArticle}</p>
                </div>
                <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-md">
                  <span className="font-semibold block text-neutral-700 mb-2">Legal Excerpt:</span>
                  <p className="text-neutral-800 font-serif italic">&quot;{selectedEvidence.evidenceExcerpt}&quot;</p>
                </div>
                <div>
                  <span className="font-semibold block text-neutral-700">Analytical Note:</span>
                  <p className="text-neutral-600 leading-relaxed">{selectedEvidence.analyticalNote}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )
    },
    {
      id: "findings",
      label: "Structured Findings",
      content: (
        <div className="space-y-6">
          {analysis.findingCards?.map((card, idx) => (
            <Card key={idx}>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-institutional-100 text-institutional-800 text-xs px-2 py-1 rounded font-semibold uppercase tracking-wider">{card.category}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900">{card.title}</h3>
                  <div>
                    <span className="font-semibold block text-sm text-neutral-700">Significance for Implementation:</span>
                    <p className="text-sm text-neutral-600 mt-1">{card.significance}</p>
                  </div>
                  <div>
                    <span className="font-semibold block text-sm text-neutral-700">Standard Engaged:</span>
                    <p className="text-sm text-neutral-600 mt-1">{card.standardEngaged}</p>
                  </div>
                </div>
                <div className="flex-1 bg-neutral-50 p-4 border border-neutral-200 rounded-md self-start">
                  <span className="font-semibold block text-xs text-neutral-500 uppercase tracking-wide mb-2">Supporting Excerpt</span>
                  <p className="text-sm text-neutral-800 font-serif italic">&quot;{card.legalExcerpt}&quot;</p>
                </div>
              </div>
            </Card>
          ))}
          {(!analysis.findingCards || analysis.findingCards.length === 0) && (
            <div className="p-8 text-center text-neutral-500 italic border border-dashed border-neutral-300 rounded-md">
              No structured findings generated yet.
            </div>
          )}
        </div>
      )
    },
    {
      id: "data",
      label: "Raw Data Export",
      content: (
        <div className="space-y-6">
          <Card>
            <h3 className="font-medium mb-4">Structured Data Extract</h3>
            <p className="text-sm text-neutral-600 mb-4">Data payload for programmatic export.</p>
            <div className="bg-neutral-50 p-4 rounded-md overflow-x-auto border border-neutral-200">
              <pre className="text-xs text-neutral-800 whitespace-pre-wrap font-mono">
                {JSON.stringify({
                  id: analysis.id,
                  jurisdiction: analysis.jurisdiction,
                  legalLevel: analysis.legalLevel,
                  dashboardSummaries: analysis.dashboardSummaries,
                  heatmapRecords: analysis.heatmapRecords,
                  findingCards: analysis.findingCards
                }, null, 2)}
              </pre>
            </div>
          </Card>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 text-neutral-900">
      <header className="mb-10 pb-6 border-b border-neutral-200">
        <Link href="/analyses" className="text-sm text-neutral-500 hover:text-neutral-800 mb-4 inline-block">
          &larr; Back to Saved Analyses
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Analysis Results</h1>
        <p className="mt-2 text-neutral-500 text-sm">Run ID: {analysis.id}</p>
      </header>

      <main>
        <Tabs tabs={tabs} />
      </main>
    </div>
  );
}
