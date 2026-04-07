"use client";

import Link from "next/link";
import { Tabs, Card } from "@normtrace/ui";

export default function AnalysisResultsPage({ params }: { params: { id: string } }) {
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
                <span className="font-medium">Mexico</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Legal Level</span>
                <span className="font-medium">Federal</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Source Status</span>
                <span className="font-medium">Provided Text</span>
              </div>
            </div>
          </Card>
          <Card>
            <h3 className="font-medium mb-4">Methodological Caution</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              This analysis evaluates the formal properties, enforceability structure, and normative alignment of the text against the CRPD. It uses a cautious approach. Findings indicating that a provision "could be strengthened" or "shows partial alignment" must be interpreted in context. Outputs require source verification and are strictly analytical.
            </p>
          </Card>
        </div>
      )
    },
    {
      id: "structure",
      label: "Structure",
      content: (
        <Card>
          <h3 className="font-medium mb-4">Anatomy & Actor Map</h3>
          <p className="text-sm text-neutral-600">The structural analysis maps responsibility flow and enforceability.</p>
        </Card>
      )
    },
    {
      id: "exclusions",
      label: "Exclusions",
      content: (
        <Card>
          <h3 className="font-medium mb-4">Exclusion Analysis</h3>
          <p className="text-sm text-neutral-600">Maps normative silence, intersectionality, and implicit barriers.</p>
        </Card>
      )
    },
    {
      id: "conventionality",
      label: "Conventionality Control",
      content: (
        <Card>
          <h3 className="font-medium mb-4">Conventionality Analysis</h3>
          <p className="text-sm text-neutral-600">Comparison of the domestic legal framework with international standards (CRPD) using the constitutional parameter of rights review.</p>
        </Card>
      )
    },
    {
      id: "argumentation",
      label: "Argumentation",
      content: (
        <Card>
          <h3 className="font-medium mb-4">Structured Legal Arguments</h3>
          <p className="text-sm text-neutral-600">Translates findings into structured doctrinal pathways.</p>
        </Card>
      )
    },
    {
      id: "coding",
      label: "Coding Summary",
      content: (
        <Card>
          <h3 className="font-medium mb-4">Data Extract</h3>
          <p className="text-sm text-neutral-600">Structured fields for mixed-method research.</p>
        </Card>
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
        <p className="mt-2 text-neutral-500 text-sm">Run ID: {params.id}</p>
      </header>

      <main>
        <Tabs tabs={tabs} />
      </main>
    </div>
  );
}
