"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@normtrace/ui";
import { useRouter } from "next/navigation";

export default function NewAnalysisPage() {
  const router = useRouter();
  const [jurisdiction, setJurisdiction] = useState<"MEXICO" | "SWITZERLAND" | "">("");
  const [legalLevel, setLegalLevel] = useState<"FEDERAL" | "CANTONAL" | "">("");
  const [language, setLanguage] = useState<"EN" | "ES" | "FR">("EN");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jurisdiction) return;
    if (jurisdiction === "SWITZERLAND" && !legalLevel) return;

    // In a real implementation, this would POST to the API to start an analysis.
    // For now, we simulate redirecting to a created analysis record.
    const fakeId = "run-" + Date.now();
    router.push(`/analyses/${fakeId}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-neutral-900">
      <header className="mb-10 pb-6 border-b border-neutral-200">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 mb-4 inline-block">
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Analysis Setup</h1>
        <p className="mt-2 text-neutral-500 text-sm">
          Please configure the methodological parameters for the instrument review.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Jurisdiction</label>
              <select
                className="w-full border border-neutral-300 rounded p-2 text-sm bg-white"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value as any)}
                required
              >
                <option value="" disabled>Select jurisdiction...</option>
                <option value="MEXICO">Mexico</option>
                <option value="SWITZERLAND">Switzerland</option>
              </select>
            </div>

            {jurisdiction === "SWITZERLAND" && (
              <div>
                <label className="block text-sm font-medium mb-2">Legal Level</label>
                <select
                  className="w-full border border-neutral-300 rounded p-2 text-sm bg-white"
                  value={legalLevel}
                  onChange={(e) => setLegalLevel(e.target.value as any)}
                  required
                >
                  <option value="" disabled>Select legal level...</option>
                  <option value="FEDERAL">Federal</option>
                  <option value="CANTONAL">Cantonal</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Output Language</label>
              <select
                className="w-full border border-neutral-300 rounded p-2 text-sm bg-white"
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
              >
                <option value="EN">English</option>
                <option value="ES">Spanish</option>
                <option value="FR">French</option>
              </select>
            </div>

            <div className="border-t border-neutral-200 pt-6">
              <label className="block text-sm font-medium mb-2">Source Input</label>
              <textarea
                className="w-full border border-neutral-300 rounded p-3 text-sm h-48 bg-white"
                placeholder="Paste the text of the legal instrument here..."
              />
              <p className="mt-2 text-xs text-neutral-500">
                Alternatively, upload a PDF (functionality stubbed for pilot).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Version / Date Reference (Optional)</label>
              <input
                type="text"
                className="w-full border border-neutral-300 rounded p-2 text-sm bg-white"
                placeholder="e.g. As amended on 24 May 2023"
              />
            </div>
          </div>
        </Card>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded text-sm text-amber-800">
          <strong>Methodological Note:</strong> These outputs are analytical and diagnostic. The methodological route preview will adapt based on the selected jurisdiction (e.g. focusing on conventionality control for Mexico).
        </div>

        <div className="flex justify-end">
          <Button type="submit" className="px-8 py-3">Run Analysis</Button>
        </div>
      </form>
    </div>
  );
}
