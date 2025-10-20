"use client"

import Link from "next/link"
import { Instagram } from "lucide-react"

export function Footer() {
  return (
    <footer className="hidden md:block bg-slate-900 text-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <h3 className="font-semibold text-white mb-4">Renk Alüminyum</h3>
            <p className="mb-4 text-sm leading-5">
              {"Bu site Renk Alüminyum için özel olarak üretilmiştir."}
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.instagram.com/renkaluminum/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center hover:bg-pink-600 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Corporate */}
          
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
            <p>© 2025 Renk Alüminyum. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
