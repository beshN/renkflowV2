import Link from "next/link";

const patterns = [
  {
    id: 1,
    title: "State Management",
    description: "Zustand + Context API hybrid pattern",
    path: "/lib/store",
    files: ["index.ts", "context.tsx"],
  },
  {
    id: 2,
    title: "API Error Handling",
    description: "Centralized Fetch wrapper with interceptors",
    path: "/lib/api",
    files: ["client.ts", "hooks.ts"],
  },
  {
    id: 3,
    title: "Form Validation",
    description: "React Hook Form + Zod multi-step forms",
    path: "/lib/forms",
    files: ["schemas.ts", "multi-step-form.tsx"],
  },
  {
    id: 4,
    title: "Data Fetching",
    description: "React Query + Server/Client components",
    path: "/lib/query",
    files: ["provider.tsx", "hooks.ts", "server.ts"],
  },
  {
    id: 5,
    title: "Authentication",
    description: "JWT refresh token rotation with HttpOnly cookies",
    path: "/lib/auth",
    files: ["jwt.ts", "middleware.ts", "hooks.ts"],
  },
  {
    id: 6,
    title: "Virtualization",
    description: "Large list rendering with @tanstack/react-virtual",
    path: "/lib/virtualization",
    files: ["virtual-list.tsx"],
  },
  {
    id: 7,
    title: "Database Queries",
    description: "Drizzle ORM relational + raw SQL patterns",
    path: "/lib/db",
    files: ["schema.ts", "queries.ts"],
  },
  {
    id: 8,
    title: "Real-time Updates",
    description: "WebSocket + Server-Sent Events",
    path: "/lib/realtime",
    files: ["websocket.ts", "sse.ts", "hooks.ts"],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Next.js 15 Architecture Patterns
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Production-ready patterns for state management, API handling, forms,
            authentication, performance optimization, and real-time features.
          </p>
        </header>

        {/* Patterns Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                  {pattern.id}
                </span>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    {pattern.title}
                  </h2>
                  <p className="text-gray-600 text-sm mb-3">
                    {pattern.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pattern.files.map((file) => (
                      <code
                        key={file}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {file}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Examples Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Example Components
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link
              href="/examples/login"
              className="bg-white rounded-lg p-4 border hover:border-blue-500 transition-colors text-center"
            >
              <span className="text-2xl mb-2 block">🔐</span>
              <span className="font-medium text-gray-900">Login Form</span>
            </Link>
            <Link
              href="/examples/register"
              className="bg-white rounded-lg p-4 border hover:border-blue-500 transition-colors text-center"
            >
              <span className="text-2xl mb-2 block">📝</span>
              <span className="font-medium text-gray-900">Multi-Step Form</span>
            </Link>
            <Link
              href="/examples/users"
              className="bg-white rounded-lg p-4 border hover:border-blue-500 transition-colors text-center"
            >
              <span className="text-2xl mb-2 block">📋</span>
              <span className="font-medium text-gray-900">Virtual List</span>
            </Link>
          </div>
        </section>

        {/* Quick Start */}
        <section className="bg-gray-900 rounded-2xl p-8 text-white">
          <h2 className="text-xl font-bold mb-4">Quick Start</h2>
          <div className="space-y-3 font-mono text-sm">
            <div className="flex items-center gap-3">
              <span className="text-gray-500">1.</span>
              <code className="bg-gray-800 px-3 py-1 rounded">npm install</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">2.</span>
              <code className="bg-gray-800 px-3 py-1 rounded">cp .env.example .env.local</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">3.</span>
              <code className="bg-gray-800 px-3 py-1 rounded">npm run dev</code>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>Built with Next.js 16, React 19, TypeScript, Tailwind CSS</p>
        </footer>
      </div>
    </div>
  );
}
