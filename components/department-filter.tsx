"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Factory } from "lucide-react"

export type Department = "all" | "cam" | "pergola" | "makasli" | "aluminyum-tavan" | "servis"

interface DepartmentFilterProps {
  value: Department
  onChange: (value: Department) => void
}

export function DepartmentFilter({ value, onChange }: DepartmentFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <Factory className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Bölüm Seç" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Bölümler</SelectItem>
          <SelectItem value="cam">Cam</SelectItem>
          <SelectItem value="pergola">Pergola</SelectItem>
          <SelectItem value="makasli">Makaslı</SelectItem>
          <SelectItem value="aluminyum-tavan">Alüminyum Tavan</SelectItem>
          <SelectItem value="servis">Servis</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export function getDepartmentLabel(department: Department): string {
  const labels: Record<Department, string> = {
    all: "Tüm Bölümler",
    cam: "Cam",
    pergola: "Pergola",
    makasli: "Makaslı",
    "aluminyum-tavan": "Alüminyum Tavan",
    servis: "Servis",
  }
  return labels[department]
}
