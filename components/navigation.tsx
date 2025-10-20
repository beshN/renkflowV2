"use client"

import Link from "next/link"
import Image from "next/image"
import { SidebarMenu } from "./sidebar-menu"
import { ThemeToggle } from "./theme-toggle"

export function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 bg-card border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <SidebarMenu />
            <Link href="/" className="flex items-center gap-3">
              <div className="relative w-20 h-7 md:w-32 md:h-10">
                <Image
                  src="/renk-logo.jpeg"
                  alt="Renk Alüminyum"
                  fill
                  className="object-contain"
                  priority
                  unoptimized
                />
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  )
}
