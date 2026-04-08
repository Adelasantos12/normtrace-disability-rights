import Link from "next/link";
import { Button, Card } from "@normtrace/ui";

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-neutral-900">
      <header className="mb-10 pb-6 border-b border-neutral-200">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 mb-4 inline-block">
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Methodological Framework</h1>
      </header>

      <main className="space-y-12">
        <section>
          <h2 className="text-2xl font-medium mb-4">Core Principles</h2>
          <div className="prose text-neutral-700 max-w-none">
            <p className="mb-4">
              NormTrace operates on the premise that a domestic legal instrument cannot be assessed solely by what it declares. It must also be assessed by what it enables, omits, distributes, and makes practically claimable.
            </p>
            <p className="mb-4">
              In this approach, <strong>normative silence is analytically meaningful</strong>. Absence, ambiguity, under-specification, weak coordination, and limited enforceability are treated as legally relevant features rather than neutral drafting gaps.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-medium mb-4">Citation & About</h2>
          <div className="prose text-neutral-700 max-w-none bg-neutral-50 p-6 rounded-md border border-neutral-200">
            <p className="mb-2"><strong>Version:</strong> v2.0.0</p>
            <p className="mb-2">
              <strong>All Versions DOI:</strong> <a href="https://doi.org/10.5281/zenodo.19452836" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://doi.org/10.5281/zenodo.19452836</a>
            </p>
            <p className="mb-4">
              <strong>Citation:</strong><br />
              <span className="italic">Santos-Domínguez, A. B. (2026). NormTrace (v2.0.0). Zenodo. <a href="https://doi.org/10.5281/zenodo.19452837" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://doi.org/10.5281/zenodo.19452837</a></span>
            </p>
            <p className="text-sm italic text-neutral-600 mb-0">
              Note: This tool supports structured legal and policy analysis, but it does not replace expert legal review or jurisdiction-specific professional advice.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-medium mb-4">Contact / Request Expert Analysis</h2>
          <div className="prose text-neutral-700 max-w-none">
            <p>
              Are you a think tank, NGO, activist, parliamentary office, research centre, or legal practitioner? If you require detailed, expert analysis beyond the automated outputs provided by NormTrace, please get in touch with us.
            </p>
            <p className="mt-2 font-medium">
              Contact Email: <a href="mailto:[INSERT EMAIL]" className="text-blue-600 hover:underline">[INSERT EMAIL]</a>
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-medium mb-4">Analytical Stages</h2>
          <div className="space-y-6">
            <Card>
              <h3 className="font-medium text-lg mb-2">1. Text Ingestion and Verification</h3>
              <p className="text-neutral-600 text-sm">Obtaining and verifying the domestic legal instrument under review.</p>
            </Card>
            <Card>
              <h3 className="font-medium text-lg mb-2">2. Structural Analysis</h3>
              <p className="text-neutral-600 text-sm">Assessing the formal anatomy, institutional architecture, competence context, and enforceability structure of the domestic legal instrument.</p>
            </Card>
            <Card>
              <h3 className="font-medium text-lg mb-2">3. Exclusion and Omission Analysis</h3>
              <p className="text-neutral-600 text-sm">Identifying direct, indirect, structural, and omission-based forms of exclusion, including gendered, intersectional, and culturally or territorially differentiated barriers where relevant.</p>
            </Card>
            <Card>
              <h3 className="font-medium text-lg mb-2">4. Conventionality / Compatibility Analysis</h3>
              <p className="text-neutral-600 text-sm">Comparing the domestic legal framework with the relevant international legal instrument through legal function and effect rather than textual symmetry alone.</p>
            </Card>
            <Card>
              <h3 className="font-medium text-lg mb-2">5. Structured Legal Argumentation</h3>
              <p className="text-neutral-600 text-sm">Translating findings into arguments suitable for litigation, legislative advocacy, institutional review, or research use.</p>
            </Card>
          </div>
        </section>

        <div className="pt-8">
          <Link href="/analyses/new">
            <Button className="px-6 py-2">Start a New Analysis</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
