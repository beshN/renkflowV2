"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"

interface ProductionIssueDialogProps {
  isOpen: boolean
  onSubmit: (issue: string) => void
  onCancel: () => void
}

export function ProductionIssueDialog({ isOpen, onSubmit, onCancel }: ProductionIssueDialogProps) {
  const [issue, setIssue] = useState("")

  if (!isOpen) return null

  const handleSubmit = () => {
    if (issue.trim()) {
      onSubmit(issue)
      setIssue("")
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
          <h2 className="text-xl font-semibold mb-2">İmalatta Sorun</h2>
          <p className="text-sm text-muted-foreground mb-4">Lütfen karşılaşılan sorunu detaylı bir şekilde açıklayın</p>

          <div className="space-y-2">
            <Label htmlFor="issue">Sorun Açıklaması</Label>
            <Textarea
              id="issue"
              placeholder="Sorunu buraya yazın..."
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} className="flex-1 sm:flex-none bg-transparent">
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={!issue.trim()} className="flex-1 sm:flex-none">
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  )
}
