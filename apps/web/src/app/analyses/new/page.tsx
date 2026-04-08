"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Button, Card } from "@normtrace/ui";
import { useRouter } from "next/navigation";
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export default function NewAnalysisPage() {
  const router = useRouter();
  const [jurisdiction, setJurisdiction] = useState<"MEXICO" | "SWITZERLAND" | "">("");
  const [legalLevel, setLegalLevel] = useState<"FEDERAL" | "CANTONAL" | "">("");
  const [language, setLanguage] = useState<"EN" | "ES" | "FR">("EN");
  const [sourceText, setSourceText] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [versionDate, setVersionDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);

      // Load pdfjs via script tag to bypass Next.js webpack compilation issues with the library
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(true);
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      setSourceText(fullText);
      setPdfFileName(file.name);
    } catch (error) {
      console.error("Error reading PDF:", error);
      alert("Failed to read PDF file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jurisdiction) return;
    if (jurisdiction === "SWITZERLAND" && !legalLevel) return;
    if (!sourceText.trim()) {
      alert("Please provide the source text or upload a PDF.");
      return;
    }

    try {
      setIsLoading(true);
      // Use the rewritten /api path which proxies to the backend
      const response = await fetch(`/api/analyses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jurisdiction,
          legalLevel: jurisdiction === "SWITZERLAND" ? legalLevel : undefined,
          language,
          sourceText,
          versionDate
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to start analysis (API returned an error)");
      }

      const data = await response.json();
      router.push(`/analyses/${data.analysisId}`);
    } catch (error: any) {
      console.error("Submission error:", error);
      alert(`Error starting analysis: ${error.message || "Please check your network and database connection."}`);
    } finally {
      setIsLoading(false);
    }
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

              {pdfFileName ? (
                <div className="w-full border border-green-200 bg-green-50 rounded p-4 text-sm mb-4 flex justify-between items-center">
                  <div>
                    <span className="text-green-800 font-medium block">✓ PDF Loaded Successfully</span>
                    <span className="text-green-700 mt-1 block">{pdfFileName} ({sourceText.length} characters extracted)</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      setPdfFileName("");
                      setSourceText("");
                    }}
                    className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs py-1"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <textarea
                  className="w-full border border-neutral-300 rounded p-3 text-sm h-48 bg-white mb-2"
                  placeholder="Paste the text of the legal instrument here..."
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
              )}

              {!pdfFileName && (
                <div className="flex items-center gap-4 mt-2">
                  <input
                    type="file"
                    accept="application/pdf"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handlePdfUpload}
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-institutional-600 text-white hover:bg-institutional-700 text-sm py-1.5"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Upload PDF'}
                  </Button>
                  <p className="text-xs text-neutral-500">
                    Extracts text automatically from uploaded PDFs.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Version / Date Reference (Optional)</label>
              <input
                type="text"
                className="w-full border border-neutral-300 rounded p-2 text-sm bg-white"
                placeholder="e.g. As amended on 24 May 2023"
                value={versionDate}
                onChange={(e) => setVersionDate(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded text-sm text-amber-800">
          <strong>Methodological Note:</strong> These outputs are analytical and diagnostic. The methodological route preview will adapt based on the selected jurisdiction (e.g. focusing on conventionality control for Mexico).
        </div>

        <div className="flex justify-end">
          <Button type="submit" className="px-8 py-3 bg-institutional-900 hover:bg-institutional-800" disabled={isLoading}>
            {isLoading ? "Starting Analysis..." : "Run Analysis"}
          </Button>
        </div>
      </form>
    </div>
  );
}
