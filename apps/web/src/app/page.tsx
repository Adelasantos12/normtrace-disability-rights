import Link from "next/link";
import { Button } from "@normtrace/ui";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-neutral-900">
      <header className="mb-12 border-b border-neutral-200 pb-8">
        <h1 className="text-4xl font-semibold mb-4 tracking-tight">NormTrace</h1>
        <p className="text-xl text-neutral-600 font-light max-w-2xl">
          Repository-based, AI-assisted analytical system for examining how domestic legal frameworks align with international standards.
        </p>
      </header>

      <main className="space-y-12">
        <section>
          <h2 className="text-2xl font-medium mb-4">Methodological Overview</h2>
          <p className="mb-4 leading-relaxed text-neutral-700">
            NormTrace evaluates normative alignment, legal compatibility, institutional anchoring, and implementation-oriented gaps. It treats normative silence as analytically meaningful and uses structured multi-layered analysis.
          </p>
          <p className="mb-6 text-sm text-neutral-500 italic">
            Note: These outputs are analytical and diagnostic. They must be verified against primary legal sources and complemented with empirical evidence.
          </p>
          <Link href="/methodology" className="text-blue-600 hover:underline">
            Read the full methodology note &rarr;
          </Link>
        </section>

        <section className="bg-neutral-50 border border-neutral-200 p-6 rounded-md">
          <h2 className="text-lg font-medium mb-4 text-neutral-800">Current Scope Limitations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-neutral-900 mb-2">Supported Jurisdictions</h3>
              <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-1">
                <li>Mexico (Federal)</li>
                <li>Switzerland (Federal and Cantonal)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-neutral-900 mb-2">Supported Domain</h3>
              <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-1">
                <li>Disability Rights</li>
                <li>Convention on the Rights of Persons with Disabilities (CRPD)</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="pt-4 flex gap-4">
          <Link href="/analyses/new">
            <Button className="text-lg px-8 py-3">Start Analysis</Button>
          </Link>
          <Link href="/analyses">
            <Button className="text-lg px-8 py-3 bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50">
              View Saved Analyses
            </Button>
          </Link>
        </div>
      </main>

      <footer className="mt-20 pt-8 border-t border-neutral-200 text-sm text-neutral-500">
        <p>NormTrace v2.0 Pilot • Repository-based AI-assisted system for multilevel normative analysis.</p>
        <p className="mt-1">Current scope strictly limited to approved jurisdictions and disability rights.</p>
      </footer>
    </div>
  );
}
