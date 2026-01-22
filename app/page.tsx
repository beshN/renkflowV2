"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Mail,
  Bell,
  CheckCircle,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
} from "lucide-react";

export default function ComingSoonPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Launch date: 14 days from now
  const [timeLeft, setTimeLeft] = useState({
    days: 14,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    // Set a fixed launch date for demonstration (e.g., 14 days from initial load or a specific date)
    // For consistency across reloads, let's target a specific future date
    const launchDate = new Date("2026-02-10T09:00:00").getTime();

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = launchDate - now;

      if (distance < 0) {
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        ),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubmitted(true);
      setEmail("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Animated Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] animate-pulse delay-1000" />

      <div className="relative z-10 text-center max-w-4xl mx-auto w-full">
        {/* Logo Area */}
        <div className="mb-10 flex justify-center animate-in fade-in zoom-in duration-700">
          <div className="relative w-56 h-20 md:w-64 md:h-24 glass-panel rounded-2xl p-4 flex items-center justify-center bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
            <Image
              src="/renk-logo.jpeg"
              alt="RenkFlow"
              fill
              className="object-contain p-2 brightness-0 invert"
              priority
              unoptimized
            />
          </div>
        </div>

        {/* Main Headings */}
        <div className="mb-12 space-y-6 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-100">
          <div className="inline-block px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-medium mb-2 backdrop-blur-sm">
            🚀 Çok Yakında Hizmetinizde
          </div>

          <h1 className="text-4xl md:text-7xl font-bold text-white tracking-tight">
            Üretim Süreçlerinizi <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 animate-gradient">
              Dijitale Taşıyoruz
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            RenkFlow ile sipariş takibi, stok yönetimi ve üretim planlaması
            artık çok daha kolay. Modern, hızlı ve güvenilir çözüm ortağınız
            hazırlanıyor.
          </p>
        </div>

        {/* Countdown Timer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-16 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-200">
          {[
            { label: "GÜN", value: timeLeft.days },
            { label: "SAAT", value: timeLeft.hours },
            { label: "DAKİKA", value: timeLeft.minutes },
            { label: "SANİYE", value: timeLeft.seconds },
          ].map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors group"
            >
              <span className="text-3xl md:text-5xl font-bold text-white mb-1 tab-num group-hover:scale-110 transition-transform duration-300">
                {String(item.value).padStart(2, "0")}
              </span>
              <span className="text-xs md:text-sm text-slate-400 font-medium tracking-widest">
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Newsletter Section */}
        <div className="max-w-md mx-auto mb-16 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-300">
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-40 transition-opacity duration-500" />
              <div className="relative flex bg-slate-900 rounded-xl border border-white/10 p-1.5 focus-within:border-blue-500/50 transition-colors">
                <div className="flex-1 flex items-center pl-4">
                  <Mail className="w-5 h-5 text-slate-400 mr-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-posta adresiniz"
                    required
                    className="w-full bg-transparent text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>Haberdar Et</span>
                  <Bell className="w-4 h-4" />
                </button>
              </div>
              <p className="text-center text-slate-500 text-xs mt-3">
                * Spam yok, sadece önemli güncellemeler.
              </p>
            </form>
          ) : (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center gap-3 text-green-400 animate-in zoom-in fade-in duration-300">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Kaydınız alındı, teşekkürler!</span>
            </div>
          )}
        </div>

        {/* Footer & Social */}
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-1000 delay-500">
          <div className="flex items-center gap-4">
            {[
              { icon: Instagram, href: "#" },
              { icon: Twitter, href: "#" },
              { icon: Linkedin, href: "#" },
              { icon: Facebook, href: "#" },
            ].map((social, index) => (
              <a
                key={index}
                href={social.href}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white hover:scale-110 transition-all duration-300"
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
          <p className="text-slate-600 text-sm">
            © 2026 Renk Alüminyum. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </div>
  );
}
