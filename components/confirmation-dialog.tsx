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
  initialSelectedSteps?: string[]
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
  initialSelectedSteps = [],
}: ConfirmationDialogProps) {
  const [inputValue, setInputValue] = useState("")
  const [loadedQuickReplies, setLoadedQuickReplies] = useState<string[]>(quickReplies)
  const [selectedSteps, setSelectedSteps] = useState<string[]>([])

  useEffect(() => {
    if (isOpen && initialSelectedSteps.length > 0) {
      setSelectedSteps(initialSelectedSteps)
    }
  }, [isOpen, initialSelectedSteps])

  useEffect(() => {
    if (!isOpen) {
      setInputValue("")
    }
  }, [isOpen])

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
    setSelectedSteps((prev) => {
      if (prev.includes(step)) {
        return prev.filter((s) => s !== step)
      } else {
        return [...prev, step]
      }
    })
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancel} />

      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold">{title || "Değişiklikleri kaydetmek ister misiniz?"}</h2>
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-lg hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {message && <p className="text-sm text-muted-foreground mb-6">{message}</p>}

          {showManufacturingSteps && manufacturingSteps.length > 0 && (
            <div className="space-y-6 mb-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">İmalat Adımlarını Seçin</p>
                {selectedSteps.length > 0 && (
                  <span className="text-xs text-muted-foreground bg-primary/10 px-3 py-1 rounded-full">
                    {selectedSteps.length} adım seçildi
                  </span>
                )}
              </div>
              <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                {manufacturingSteps.map((category, categoryIndex) => (
                  <div key={categoryIndex} className="space-y-2.5">
                    <div className="space-y-2.5">
                      {category.steps.map((step, stepIndex) => (
                        <div
                          key={stepIndex}
                          className="flex items-start space-x-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          <Checkbox
                            id={`step-${categoryIndex}-${stepIndex}`}
                            checked={selectedSteps.includes(step)}
                            onCheckedChange={() => handleStepToggle(step)}
                            disabled={isLoading}
                            className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <label
                            htmlFor={`step-${categoryIndex}-${stepIndex}`}
                            className="text-sm leading-relaxed cursor-pointer select-none flex-1 group-hover:text-foreground transition-colors"
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
                className="mt-4 min-h-[120px] resize-none"
              />

              {loadedQuickReplies.length > 0 && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hızlı Cevaplar</p>
                  <div className="flex flex-wrap gap-2">
                    {loadedQuickReplies.map((reply, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickReply(reply)}
                        disabled={isLoading}
                        className="text-xs h-9 hover:bg-primary hover:text-primary-foreground transition-colors"
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

        <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm border-t border-border p-4 flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1 sm:flex-none bg-transparent hover:bg-muted"
          >
            İptal
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading} className="flex-1 sm:flex-none min-w-[120px] shadow-lg">
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
