import Link from "next/link";
import { Button, Card } from "@normtrace/ui";

export default function SavedAnalysesPage() {
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
        <div className="space-y-4">
          {/* In a real implementation, we would map over the Database records here */}

          <Card className="hover:border-neutral-300 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-lg">Mexico - Federal (Pilot Sample)</h3>
                <p className="text-sm text-neutral-500 mt-1">Ley General para la Inclusión de las Personas con Discapacidad</p>
                <div className="flex gap-2 mt-3">
                  <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs">MX</span>
                  <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs">Federal</span>
                </div>
              </div>
              <Link href="/analyses/sample-mx">
                <Button className="px-4 py-2 text-sm bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50">View Results</Button>
              </Link>
            </div>
          </Card>

          <Card className="hover:border-neutral-300 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-lg">Switzerland - Federal (Pilot Sample)</h3>
                <p className="text-sm text-neutral-500 mt-1">Behindertengleichstellungsgesetz (BehiG)</p>
                <div className="flex gap-2 mt-3">
                  <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs">CH</span>
                  <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs">Federal</span>
                </div>
              </div>
              <Link href="/analyses/sample-ch">
                <Button className="px-4 py-2 text-sm bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50">View Results</Button>
              </Link>
            </div>
          </Card>

        </div>
      </main>
    </div>
  );
}
