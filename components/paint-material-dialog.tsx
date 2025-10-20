"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { X, Paintbrush } from "lucide-react"

interface PaintMaterialDialogProps {
  isOpen: boolean
  onSubmit: (material: string) => void
  onCancel: () => void
}

export function PaintMaterialDialog({ isOpen, onSubmit, onCancel }: PaintMaterialDialogProps) {
  const [material, setMaterial] = useState("")

  if (!isOpen) return null

  const handleSubmit = () => {
    if (material.trim()) {
      onSubmit(material)
      setMaterial("")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-lg shadow-lg max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Paintbrush className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Boyaya Gönderilecek Malzeme</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Hangi malzeme boyaya gönderilecek? Lütfen detaylı bir şekilde belirtin.
          </p>

          <div className="space-y-2">
            <Label htmlFor="material">Malzeme Açıklaması</Label>
            <Textarea
              id="material"
              placeholder="Örn: 2 adet cam kapı, 120x200 cm, şeffaf cam..."
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} className="flex-1 sm:flex-none bg-transparent">
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={!material.trim()} className="flex-1 sm:flex-none">
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  )
}
