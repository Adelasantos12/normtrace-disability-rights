"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Button, Card } from "@normtrace/ui";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
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
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("LAW");
  const [lawDate, setLawDate] = useState("");
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
      const response = await fetch(apiUrl(`/api/analyses`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jurisdiction,
          legalLevel: jurisdiction === "SWITZERLAND" ? legalLevel : undefined,
          language,
          sourceText,
          versionDate,
          title,
          documentType,
          lawDate,
        })
      });

      if (!response.ok) {
        let errorMsg = "Failed to start analysis (API returned an error)";
        try {
          const errorData = await response.json();
          if (errorData?.error) errorMsg = errorData.error;
        } catch (e) {
          errorMsg = `Server responded with status: ${response.status}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      router.push(`/analyses/${data.canonicalDocumentId || data.analysisId}`);
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

            <div>
              <label className="block text-sm font-medium mb-2">Document Title (Optional)</label>
              <input
                type="text"
                className="w-full border border-neutral-300 rounded p-2 text-sm bg-white"
                placeholder="e.g. Ley General para la Inclusión de las Personas con Discapacidad"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Document Type</label>
              <select
                className="w-full border border-neutral-300 rounded p-2 text-sm bg-white"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="LAW">Law</option>
                <option value="DECREE">Decree</option>
                <option value="REGULATION">Regulation</option>
                <option value="CODE">Code</option>
                <option value="POLICY">Policy</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Law Date (Optional)</label>
              <input
                type="date"
                className="w-full border border-neutral-300 rounded p-2 text-sm bg-white"
                value={lawDate}
                onChange={(e) => setLawDate(e.target.value)}
              />
            </div>

            <div className="border-t border-neutral-200 pt-6">
              <label className="block text-sm font-medium mb-2">Source Input</label>

              {pdfFileName ? (
                <div className="space-y-3">
                  <div className="w-full border border-green-200 bg-green-50 rounded p-3 text-sm flex justify-between items-center shadow-sm">
                    <div>
                      <span className="text-green-800 font-medium block">✓ PDF Extracted Successfully</span>
                      <span className="text-green-700 block text-xs mt-0.5">{pdfFileName} ({sourceText.length.toLocaleString()} characters)</span>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        setPdfFileName("");
                        setSourceText("");
                      }}
                      className="bg-white text-red-600 hover:bg-red-50 border border-red-200 text-xs py-1.5 px-3 transition-colors"
                    >
                      Clear PDF
                    </Button>
                  </div>

                  <div className="border border-neutral-200 rounded-md overflow-hidden flex flex-col">
                    <div className="bg-neutral-50 border-b border-neutral-200 px-3 py-2 flex justify-between items-center">
                      <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider">Document Preview</span>
                      <span className="text-xs text-neutral-400">Read-only view</span>
                    </div>
                    <div className="bg-white p-4 h-48 overflow-y-auto">
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed font-serif">
                        {sourceText || "No text extracted."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-2">
                  <textarea
                    className="w-full border border-neutral-300 rounded p-3 text-sm h-48 bg-white focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 outline-none transition-shadow"
                    placeholder="Paste the text of the legal instrument here..."
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                  />
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
                      className="bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border border-neutral-300 text-sm py-1.5"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Processing PDF...' : 'Upload PDF'}
                    </Button>
                    <p className="text-xs text-neutral-500">
                      Alternatively, upload a PDF to automatically extract its text.
                    </p>
                  </div>
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
