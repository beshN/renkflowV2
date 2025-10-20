"use client"

import type { OrderStatus } from "@/lib/mock-data"
import { Clock, Truck, Hammer, Paintbrush } from "lucide-react"

interface StatusBadgeProps {
  status: OrderStatus
  className?: string
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const statusConfig = {
    pending: {
      icon: Clock,
      label: "Yeni Sipariş",
      className:
        "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800",
    },
    paint: {
      icon: Paintbrush,
      label: "Boyada",
      className:
        "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
    },
    "paint-send": {
      icon: Paintbrush,
      label: "Boyada",
      className:
        "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
    },
    "in-progress": {
      icon: Hammer,
      label: "İmalat",
      className:
        "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    },
    ready: {
      icon: Truck,
      label: "Teslimata Hazır",
      className:
        "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    },
  }

  const config = statusConfig[status as keyof typeof statusConfig]
  const Icon = config ? config.icon : Clock

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs md:text-sm font-medium border ${config ? config.className : "bg-gray-100 text-gray-800 border-gray-200"} ${className}`}
    >
      <Icon className="w-3 h-3 md:w-4 md:h-4" />
      {config ? config.label : status}
    </span>
  )
}
