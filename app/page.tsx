"use client";

import { useState } from "react";
import { Lock, CheckCircle } from "lucide-react";

export default function ComingSoonPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubmitted(true);
      setEmail("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/30 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl text-center">
        {/* Logo */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-light tracking-tight">
            <span className="text-teal-500 italic font-medium">Renk</span>
            <span className="text-blue-600 font-semibold">Flow</span>
          </h1>
        </div>

        {/* Main Heading */}
        <h2 className="text-3xl md:text-5xl font-light text-slate-800 mb-6 tracking-tight">
          İş Akışında Yeni Bir Devrim
        </h2>

        {/* Description */}
        <p className="text-base md:text-lg text-slate-500 mb-10 leading-relaxed max-w-md mx-auto">
          RenkFlow Workspace profesyonel iş yönetimi paneli çok yakında yayında.
          Verimliliğinizi artıracak yeni deneyim için hazır olun.
        </p>

        {/* Email Form */}
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kurumsal@email.com"
                required
                className="flex-1 h-12 px-5 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
              />
              <button
                type="submit"
                className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Bildirim Al
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center gap-2 text-green-700 max-w-md mx-auto">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Kaydınız alındı, teşekkürler!</span>
          </div>
        )}

        {/* Privacy Note */}
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-16">
          <Lock className="w-4 h-4" />
          <span>Kişisel verileriniz güvende.</span>
        </div>

        {/* Footer */}
        <footer className="text-slate-400 text-sm">
          © 2026 RenkFlow. Tüm hakları saklıdır.
        </footer>
      </div>
    </div>
  );
}
