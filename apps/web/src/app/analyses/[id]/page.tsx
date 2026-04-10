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
  structuredFindings?: Array<{
    mainProblem: string;
    gapType: string;
    likelyRemedialLevel: string;
    methodologicalCaution: string;
  }>;
  actorRecords?: Array<{
    actorName: string;
    role: string;
    responsibilityFlow: string;
    enforceability: string;
  }>;
  gapRecords?: Array<{
    standardEngaged: string;
    severity: string;
    interpretiveBasis: string;
    caution: string;
  }>;
  argumentRecords?: Array<{
    legalProblem: string;
    standardEngaged: string;
    deficiencyType: string;
    doctrinalSupport: string;
    remedialPathway: string;
  }>;
}

export default function AnalysisResultsPage({ params }: { params: { id: string } }) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const res = await fetch(`/api/analyses/${params.id}`);
        if (!res.ok) throw new Error("Failed to load analysis");
        const data = await res.json();
        setAnalysis(data.analysis);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [params.id]);

  if (loading) {
    return <div className="p-12 text-center text-neutral-500">Loading analysis data...</div>;
  }

  if (error || !analysis) {
    return <div className="p-12 text-center text-red-500">Error: {error || "Analysis not found"}</div>;
  }

  const finding = analysis.structuredFindings?.[0];

  const tabs = [
    {
      id: "executive",
      label: "Executive Summary",
      content: (
        <div className="space-y-6">
          <Card>
            <h3 className="font-medium mb-4">Analysis Context</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-neutral-500 block">Jurisdiction</span>
                <span className="font-medium">{analysis.jurisdiction}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Legal Level</span>
                <span className="font-medium">{analysis.legalLevel || 'N/A'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Status</span>
                <span className="font-medium">{analysis.status}</span>
              </div>
            </div>
          </Card>

          {finding && (
            <Card>
              <h3 className="font-medium mb-4 text-institutional-800">Generated Findings</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="font-semibold block text-neutral-700">Main Problem:</span>
                  <p className="text-neutral-600 mt-1">{finding.mainProblem}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-semibold block text-neutral-700">Gap Type:</span>
                    <p className="text-neutral-600 mt-1">{finding.gapType}</p>
                  </div>
                  <div>
                    <span className="font-semibold block text-neutral-700">Remedial Level:</span>
                    <p className="text-neutral-600 mt-1">{finding.likelyRemedialLevel}</p>
                  </div>
                </div>
                {finding.methodologicalCaution && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded text-amber-800">
                    <span className="font-semibold block mb-1">Methodological Caution:</span>
                    {finding.methodologicalCaution}
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card>
            <h3 className="font-medium mb-4 text-amber-800">General Caution</h3>
            <p className="text-sm text-neutral-600 leading-relaxed mb-4">
              This analysis evaluates the formal properties, enforceability structure, and normative alignment of the text against the CRPD. It uses a cautious approach. Outputs require source verification and are strictly analytical.
            </p>
            <p className="text-xs text-neutral-500 italic border-l-2 border-amber-300 pl-3">
              These outputs are analytical and indicative. For high-stakes use—such as litigation, legislative reform, advocacy strategy, official reporting, or institutional decision-making—findings should be reviewed against primary legal sources and, where necessary, complemented by detailed expert analysis.
            </p>
          </Card>
        </div>
      )
    },
    {
      id: "structure",
      label: "Structure",
      content: (
        <div className="space-y-6">
          <Card>
            <h3 className="font-medium mb-4">Anatomy & Actor Map</h3>
            <p className="text-sm text-neutral-600 mb-4">The structural analysis maps responsibility flow and enforceability.</p>
            {analysis.actorRecords && analysis.actorRecords.length > 0 ? (
              <div className="space-y-4">
                {analysis.actorRecords.map((actor, idx) => (
                  <div key={idx} className="p-4 border border-neutral-200 rounded-md">
                    <div className="font-semibold text-neutral-800">{actor.actorName} <span className="text-neutral-500 font-normal">({actor.role})</span></div>
                    <div className="mt-2 text-sm text-neutral-600">
                      <span className="font-medium block">Responsibility Flow:</span> {actor.responsibilityFlow}
                    </div>
                    <div className="mt-2 text-sm text-neutral-600">
                      <span className="font-medium block">Enforceability:</span> {actor.enforceability}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 italic">No actor records available.</p>
            )}
          </Card>
        </div>
      )
    },
    {
      id: "exclusions",
      label: "Exclusions",
      content: (
        <div className="space-y-6">
          <Card>
            <h3 className="font-medium mb-4">Exclusion Analysis</h3>
            <p className="text-sm text-neutral-600 mb-4">Maps normative silence, intersectionality, and implicit barriers.</p>
            {analysis.gapRecords && analysis.gapRecords.length > 0 ? (
              <div className="space-y-4">
                {analysis.gapRecords.map((gap, idx) => (
                  <div key={idx} className="p-4 border border-neutral-200 rounded-md">
                    <div className="font-semibold text-neutral-800">Gap: <span className="font-normal">{gap.standardEngaged}</span></div>
                    <div className="mt-2 text-sm text-neutral-600">
                      <span className="font-medium block">Severity:</span> {gap.severity}
                    </div>
                    <div className="mt-2 text-sm text-neutral-600">
                      <span className="font-medium block">Interpretive Basis:</span> {gap.interpretiveBasis}
                    </div>
                    {gap.caution && (
                      <div className="mt-2 text-sm text-amber-700 bg-amber-50 p-2 rounded">
                        <span className="font-medium">Caution:</span> {gap.caution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 italic">No exclusion records available.</p>
            )}
          </Card>
        </div>
      )
    },
    {
      id: "conventionality",
      label: "Conventionality Control",
      content: (
        <div className="space-y-6">
          <Card>
            <h3 className="font-medium mb-4">Conventionality Analysis</h3>
            <p className="text-sm text-neutral-600 mb-4">Comparison of the domestic legal framework with international standards (CRPD) using the constitutional parameter of rights review.</p>
            {analysis.gapRecords && analysis.gapRecords.length > 0 ? (
              <div className="space-y-4">
                {analysis.gapRecords.map((gap, idx) => (
                  <div key={idx} className="p-4 border border-neutral-200 rounded-md">
                    <div className="font-semibold text-neutral-800">Standard: <span className="font-normal">{gap.standardEngaged}</span></div>
                    <div className="mt-2 text-sm text-neutral-600">
                      <span className="font-medium block">Severity:</span> {gap.severity}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 italic">No conventionality records available.</p>
            )}
          </Card>
        </div>
      )
    },
    {
      id: "argumentation",
      label: "Argumentation",
      content: (
        <div className="space-y-6">
          <Card>
            <h3 className="font-medium mb-4">Structured Legal Arguments</h3>
            <p className="text-sm text-neutral-600 mb-4">Translates findings into structured doctrinal pathways.</p>
            {analysis.argumentRecords && analysis.argumentRecords.length > 0 ? (
              <div className="space-y-4">
                {analysis.argumentRecords.map((arg, idx) => (
                  <div key={idx} className="p-4 border border-neutral-200 rounded-md">
                    <div className="font-semibold text-neutral-800">Legal Problem: <span className="font-normal">{arg.legalProblem}</span></div>
                    <div className="mt-2 text-sm text-neutral-600">
                      <span className="font-medium block">Standard Engaged:</span> {arg.standardEngaged}
                    </div>
                    <div className="mt-2 text-sm text-neutral-600">
                      <span className="font-medium block">Deficiency Type:</span> {arg.deficiencyType}
                    </div>
                    <div className="mt-2 text-sm text-neutral-600">
                      <span className="font-medium block">Doctrinal Support:</span> {arg.doctrinalSupport}
                    </div>
                    <div className="mt-2 text-sm text-neutral-600">
                      <span className="font-medium block">Remedial Pathway:</span> {arg.remedialPathway}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 italic">No argumentation records available.</p>
            )}
          </Card>
        </div>
      )
    },
    {
      id: "coding",
      label: "Coding Summary",
      content: (
        <div className="space-y-6">
          <Card>
            <h3 className="font-medium mb-4">Data Extract</h3>
            <p className="text-sm text-neutral-600 mb-4">Structured fields for mixed-method research.</p>
            <div className="bg-neutral-50 p-4 rounded-md overflow-x-auto border border-neutral-200">
              <pre className="text-xs text-neutral-800 whitespace-pre-wrap font-mono">
                {JSON.stringify({
                  id: analysis.id,
                  jurisdiction: analysis.jurisdiction,
                  legalLevel: analysis.legalLevel,
                  structuredFindings: analysis.structuredFindings,
                  actorRecords: analysis.actorRecords,
                  gapRecords: analysis.gapRecords,
                  argumentRecords: analysis.argumentRecords
                }, null, 2)}
              </pre>
            </div>
          </Card>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 text-neutral-900">
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
