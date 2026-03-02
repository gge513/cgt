'use client';

export default function Home() {
  return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              KMS Strategic Dashboard
            </h1>
            <p className="text-slate-300">
              Executive visibility for decisions, actions, commitments, and risks
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition">
              <h2 className="text-xl font-semibold text-white mb-2">📊 Strategic Dashboard</h2>
              <p className="text-slate-300 text-sm mb-4">
                KPI cards showing decision counts, high-risk items, escalations, and completion status
              </p>
              <a href="/dashboard" className="text-blue-400 hover:text-blue-300 font-medium">
                Open Dashboard →
              </a>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition">
              <h2 className="text-xl font-semibold text-white mb-2">🔍 Decisions Explorer</h2>
              <p className="text-slate-300 text-sm mb-4">
                Browse all decisions with filtering, drill-down details, and AI-inferred relationships
              </p>
              <a href="/decisions" className="text-blue-400 hover:text-blue-300 font-medium">
                Explore Decisions →
              </a>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">🏗️ Coming Soon</h2>
            <p className="text-slate-300 mb-4">
              Additional features being built:
            </p>
            <ul className="text-slate-300 space-y-2 text-sm">
              <li>• <span className="text-slate-400">Patterns & Insights</span> - Keyword grouping across meetings</li>
              <li>• <span className="text-slate-400">Relationship Validation</span> - Confirm or reject AI inferences</li>
              <li>• <span className="text-slate-400">Strategic Actions</span> - Mark escalated, resolved, prioritized</li>
            </ul>
          </div>

          <div className="mt-8 text-xs text-slate-400 text-center">
            <p>Dashboard is connected to KMS data from <code className="bg-slate-700 px-2 py-1 rounded">.processed_kms.json</code></p>
          </div>
        </div>
      </main>
  );
}
