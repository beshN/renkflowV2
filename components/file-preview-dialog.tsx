"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X, FileText, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useState } from "react"

interface FilePreviewDialogProps {
  isOpen: boolean
  onClose: () => void
  file: {
    id: string
    name: string
    type: string
    url?: string
    dataUrl?: string
  } | null
}

export function FilePreviewDialog({ isOpen, onClose, file }: FilePreviewDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (file?.dataUrl && file.dataUrl.startsWith("data:")) {
      try {
        // Convert base64 to blob
        const arr = file.dataUrl.split(",")
        const mime = arr[0].match(/:(.*?);/)?.[1] || "application/octet-stream"
        const bstr = atob(arr[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n)
        }
        const blob = new Blob([u8arr], { type: mime })
        const url = URL.createObjectURL(blob)
        setBlobUrl(url)

        // Cleanup blob URL when component unmounts
        return () => {
          URL.revokeObjectURL(url)
        }
      } catch (error) {
        console.error("Error converting data URL to blob:", error)
      }
    }
  }, [file?.dataUrl])

  if (!file) return null

  const fileUrl = blobUrl || file.dataUrl || file.url

  if (!fileUrl) {
    return null
  }

  const isImage =
    fileUrl.startsWith("data:image/") ||
    fileUrl.includes("image/") ||
    file.type === "image" ||
    file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)
  const isPDF =
    fileUrl.startsWith("data:application/pdf") ||
    fileUrl.includes("application/pdf") ||
    file.type === "pdf" ||
    file.name.match(/\.pdf$/i)

  const handleDownload = () => {
    try {
      const link = document.createElement("a")
      link.href = fileUrl
      link.download = file.name
      link.style.display = "none"
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        document.body.removeChild(link)
      }, 100)
      toast.success("Dosya indiriliyor")
    } catch (error) {
      toast.error("Dosya indirilirken bir hata oluştu")
    }
  }

  const handleOpenInNewTab = () => {
    try {
      window.open(fileUrl, "_blank")
      toast.success("Dosya yeni sekmede açılıyor")
    } catch (error) {
      toast.error("Dosya açılırken bir hata oluştu")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-4">{file.name}</DialogTitle>
            <div className="flex items-center gap-2">
              {isPDF && (
                <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Yeni Sekmede Aç
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                İndir
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="px-6 pb-6 overflow-auto max-h-[calc(90vh-100px)]">
          {isImage && (
            <div className="flex items-center justify-center bg-secondary/20 rounded-lg p-4">
              <img
                src={fileUrl || "/placeholder.svg"}
                alt={file.name}
                className="max-w-full h-auto rounded-lg shadow-lg"
              />
            </div>
          )}
          {isPDF && (
            <div className="space-y-4">
              <div className="w-full h-[70vh] bg-secondary/20 rounded-lg overflow-hidden">
                <iframe src={fileUrl} className="w-full h-full border-0" title={file.name} />
              </div>
              <div className="text-center text-sm text-muted-foreground">
                <p>PDF önizlemesi çalışmıyorsa "Yeni Sekmede Aç" veya "İndir" butonunu kullanın</p>
              </div>
            </div>
          )}
          {!isImage && !isPDF && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Bu dosya türü önizlenemiyor</p>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Dosyayı İndir
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
