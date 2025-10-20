"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Package, Settings, UserCog, Menu } from "lucide-react"

export function SidebarMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const menuItems = [
    { href: "/", icon: Package, label: "Siparişler" },
    { href: "/admin", icon: UserCog, label: "Yönetici Paneli" },
    { href: "/settings", icon: Settings, label: "Ayarlar" },
  ]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="tracking-wide text-left mx-0 font-semibold leading-3">{"RenkFlow"}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 mt-6">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                <Button variant={isActive ? "default" : "ghost"} className="w-full justify-start gap-3" size="lg">
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
