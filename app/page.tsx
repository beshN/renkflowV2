import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-[#0F172A]" />
          <span className="text-xl font-bold text-[#0F172A]">RenkFlow</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <Link href="#features" className="hover:text-[#0F172A]">Features</Link>
          <Link href="#pricing" className="hover:text-[#0F172A]">Pricing</Link>
          <Link href="#templates" className="hover:text-[#0F172A]">Templates</Link>
          <Link href="#company" className="hover:text-[#0F172A]">Company</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-[#0F172A]">
            Log in
          </Link>
          <Link href="/login">
            <button className="bg-[#1E293B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0F172A] transition-colors">
              Request a Demo
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8 text-center max-w-7xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600 mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          Announcing our new Reporting Suite
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#0F172A] mb-6 max-w-4xl mx-auto leading-[1.1]">
          The Operating System for Modern Manufacturing
        </h1>
        
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          RenkFlow centralizes your orders, production, staff, and documents into one intelligent platform. Streamline operations, eliminate bottlenecks, and unlock peak efficiency.
        </p>
        
        <div className="flex items-center justify-center gap-4 mb-20">
          <Link href="/login">
            <button className="bg-[#1E3A8A] text-white px-8 py-4 rounded-lg text-base font-semibold hover:bg-[#172554] transition-colors shadow-lg shadow-blue-900/20">
              Get Started
            </button>
          </Link>
          <button className="bg-slate-100 text-slate-700 px-8 py-4 rounded-lg text-base font-semibold hover:bg-slate-200 transition-colors">
            Watch Demo
          </button>
        </div>

        {/* Dashboard Preview */}
        <div className="relative mx-auto max-w-5xl rounded-xl bg-[#1E293B] p-2 shadow-2xl ring-1 ring-slate-900/10">
          <div className="rounded-lg bg-[#0F172A] overflow-hidden aspect-[16/9] relative group">
            {/* Mock UI Elements */}
            <div className="absolute top-0 left-0 right-0 h-12 bg-[#1E293B] flex items-center px-4 gap-2 border-b border-slate-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/20"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/20"></div>
              </div>
            </div>
            {/* Dashboard Content Mock */}
            <div className="p-8 mt-12 grid grid-cols-12 gap-6 h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500">
              <div className="col-span-3 space-y-4">
                <div className="h-8 w-3/4 bg-slate-700/50 rounded"></div>
                <div className="h-4 w-1/2 bg-slate-700/30 rounded"></div>
                <div className="h-4 w-2/3 bg-slate-700/30 rounded"></div>
                <div className="h-32 w-full bg-slate-700/20 rounded-lg mt-8"></div>
              </div>
              <div className="col-span-9 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-24 bg-slate-700/30 rounded-lg"></div>
                  <div className="h-24 bg-slate-700/30 rounded-lg"></div>
                  <div className="h-24 bg-slate-700/30 rounded-lg"></div>
                </div>
                <div className="h-64 bg-slate-700/20 rounded-lg w-full flex items-end justify-between p-6 gap-2">
                  {[40, 60, 45, 70, 50, 80, 65, 85, 75, 90, 60, 70].map((h, i) => (
                    <div key={i} className="w-full bg-blue-500/40 rounded-t" style={{ height: `${h}%` }}></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-white max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold text-[#0F172A] mb-4">Everything you need, all in one place.</h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            From initial order to final delivery, RenkFlow provides the tools to manage your entire workflow with precision and clarity.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-x-12 gap-y-16">
          {[
            {
              icon: "receipt_long",
              title: "Order Management",
              desc: "Track every order from quote to completion. Never lose sight of a customer request again."
            },
            {
              icon: "factory",
              title: "Production Planning",
              desc: "Visualize your production lines, manage schedules, and monitor output in real-time."
            },
            {
              icon: "groups",
              title: "Staff Management",
              desc: "Assign tasks, track performance, and manage your team's workload with ease."
            },
            {
              icon: "folder_open",
              title: "Document Hub",
              desc: "Centralize all your important documents, from blueprints to compliance forms."
            },
            {
              icon: "analytics",
              title: "Insightful Reporting",
              desc: "Generate powerful reports to understand your performance and make data-driven decisions."
            },
            {
              icon: "integration_instructions",
              title: "Seamless Integrations",
              desc: "Connect RenkFlow with the tools you already use, from accounting to logistics."
            }
          ].map((feature, i) => (
            <div key={i} className="group">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined">{feature.icon}</span>
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] mb-3">{feature.title}</h3>
              <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] mb-6">
            Ready to Transform Your Operations?
          </h2>
          <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
            Join hundreds of modern factories that trust RenkFlow to drive growth and efficiency. Get started today.
          </p>
          <Link href="/login">
            <button className="bg-[#1E3A8A] text-white px-8 py-4 rounded-lg text-base font-semibold hover:bg-[#172554] transition-colors shadow-lg shadow-blue-900/10">
              Request a Demo
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="size-6 rounded-full bg-[#0F172A]" />
              <span className="text-lg font-bold text-[#0F172A]">RenkFlow</span>
            </div>
            <p className="text-sm text-slate-500 max-w-xs">
              The Operating System for Modern Manufacturing.
            </p>
          </div>
          
          {[
            { title: "Product", links: ["Features", "Pricing", "Integrations", "Request a Demo"] },
            { title: "Company", links: ["About", "Careers", "Blog", "Contact"] },
            { title: "Resources", links: ["Help Center", "API Docs", "System Status"] }
          ].map((col, i) => (
            <div key={i}>
              <h4 className="font-bold text-[#0F172A] mb-4">{col.title}</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                {col.links.map((link, j) => (
                  <li key={j}><a href="#" className="hover:text-blue-600">{link}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} RenkFlow, Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[#0F172A]">Privacy Policy</a>
            <a href="#" className="hover:text-[#0F172A]">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
