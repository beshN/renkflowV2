"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { X, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"

interface ConfirmationDialogProps {
  isOpen: boolean
  onConfirm: (inputValue?: string, selectedSteps?: string[]) => void
  onCancel: () => void
  title?: string
  message?: string
  showInput?: boolean
  inputPlaceholder?: string
  inputType?: string
  isLoading?: boolean
  quickReplies?: string[]
  showManufacturingSteps?: boolean
  manufacturingSteps?: { category: string; steps: string[] }[]
}

export function ConfirmationDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  showInput = false,
  inputPlaceholder = "",
  inputType = "text",
  isLoading = false,
  quickReplies = [],
  showManufacturingSteps = false,
  manufacturingSteps = [],
}: ConfirmationDialogProps) {
  const [inputValue, setInputValue] = useState("")
  const [loadedQuickReplies, setLoadedQuickReplies] = useState<string[]>(quickReplies)
  const [selectedSteps, setSelectedSteps] = useState<string[]>([])

  useEffect(() => {
    if (quickReplies.length === 0) {
      const savedReplies = localStorage.getItem("quick_replies")
      if (savedReplies) {
        try {
          setLoadedQuickReplies(JSON.parse(savedReplies))
        } catch (error) {
          console.error("[v0] Error loading quick replies:", error)
        }
      }
    } else {
      setLoadedQuickReplies(quickReplies)
    }
  }, [quickReplies])

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm(showInput ? inputValue : undefined, showManufacturingSteps ? selectedSteps : undefined)
    setInputValue("")
    setSelectedSteps([])
  }

  const handleCancel = () => {
    if (isLoading) return
    setInputValue("")
    setSelectedSteps([])
    onCancel()
  }

  const handleQuickReply = (reply: string) => {
    setInputValue(reply)
  }

  const handleStepToggle = (step: string) => {
    setSelectedSteps((prev) => (prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]))
  }

  const capitalizeWords = (text: string) => {
    return text
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleCancel} />

      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-in zoom-in-95 duration-200">
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">{title || "Değişiklikleri kaydetmek ister misiniz?"}</h2>
          {message && <p className="text-sm text-muted-foreground mb-4">{message}</p>}

          {showManufacturingSteps && manufacturingSteps.length > 0 && (
            <div className="space-y-4 mb-4">
              <p className="text-sm font-medium text-foreground">İmalat Adımlarını Seçin:</p>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {manufacturingSteps.map((category, categoryIndex) => (
                  <div key={categoryIndex} className="space-y-2">
                    <h3 className="text-sm font-semibold text-primary capitalize">{category.category}</h3>
                    <div className="space-y-2 pl-2">
                      {category.steps.map((step, stepIndex) => (
                        <div key={stepIndex} className="flex items-start space-x-3">
                          <Checkbox
                            id={`step-${categoryIndex}-${stepIndex}`}
                            checked={selectedSteps.includes(step)}
                            onCheckedChange={() => handleStepToggle(step)}
                            disabled={isLoading}
                            className="mt-0.5"
                          />
                          <label
                            htmlFor={`step-${categoryIndex}-${stepIndex}`}
                            className="text-sm leading-relaxed cursor-pointer select-none"
                          >
                            {capitalizeWords(step)}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showInput && (
            <>
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                disabled={isLoading}
                className="mt-4 min-h-[100px]"
              />

              {loadedQuickReplies.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Hızlı Cevaplar:</p>
                  <div className="flex flex-wrap gap-2">
                    {loadedQuickReplies.map((reply, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickReply(reply)}
                        disabled={isLoading}
                        className="text-xs h-8"
                      >
                        {reply}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1 sm:flex-none bg-transparent"
          >
            İptal
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading} className="flex-1 sm:flex-none min-w-[100px]">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              "Kaydet"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
