import Link from "next/link";
import { Button } from "@normtrace/ui";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-neutral-900">
      <header className="mb-12 border-b border-neutral-200 pb-8">
        <h1 className="uppercase tracking-widest text-3xl font-medium mb-6">NormTrace</h1>
        <p className="text-lg text-neutral-600 leading-relaxed">
          Repository-based, AI-assisted analytical system for examining how domestic legal frameworks align with international standards.
        </p>
      </header>

      <main className="space-y-12">
        <section>
          <h2 className="text-xl font-medium uppercase tracking-wide mb-4">Methodological Overview</h2>
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

        <section className="bg-white border border-neutral-200 p-8 rounded-xl shadow-sm">
          <h2 className="text-lg font-medium mb-4 text-neutral-800">Current Scope Limitations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-neutral-900 mb-2">Supported Jurisdictions</h3>
              <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-1">
                <li>Mexico (Federal and State)</li>
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

        <div className="pt-8 flex gap-6">
          <Link href="/analyses/new">
            <Button className="text-lg px-8 py-3">Start Analysis</Button>
          </Link>
          <Link href="/analyses">
            <Button className="text-lg px-8 py-3 bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 shadow-sm rounded-md">
              View Saved Analyses
            </Button>
          </Link>
        </div>
      </main>

      <footer className="mt-20 pt-8 border-t border-neutral-200 text-sm text-neutral-500">
        <p>NormTrace v2.0.0 · <a href="https://doi.org/10.5281/zenodo.19452837" target="_blank" rel="noopener noreferrer" className="hover:underline">Zenodo DOI</a></p>
        <p className="mt-1">Repository-based AI-assisted system for multilevel normative analysis.</p>
      </footer>
    </div>
  );
}
