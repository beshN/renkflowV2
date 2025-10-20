"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/status-badge"
import { getDepartmentLabel } from "@/components/department-filter"
import { ConfirmationDialog } from "@/components/confirmation-dialog"
import { ArrowLeft, FileText, FileSpreadsheet, Clock, Factory, ImageIcon, Download, Calendar } from "lucide-react"
import Link from "next/link"
import { useOrders } from "@/lib/orders-context"
import type { OrderStatus, Department } from "@/lib/mock-data"
import { toast } from "sonner"

const quickRepliesByDepartment: Record<Department, string[]> = {
  cam: ["Cam kesim tamamlandı", "Çerçeve montajı devam ediyor", "Temperli cam bekleniyor", "Fitil takımı yapılıyor"],
  pergola: [
    "Alüminyum profil kesimi tamamlandı",
    "Kaynak işlemi devam ediyor",
    "Motor montajı yapılıyor",
    "Kumaş dikimi bekleniyor",
  ],
  makasli: ["Profil kesimi tamamlandı", "Kaynak işlemi devam ediyor", "Mekanizma montajı yapılıyor", "Test aşamasında"],
  "aluminyum-tavan": [
    "Panel kesimi tamamlandı",
    "Montaj rayları hazırlanıyor",
    "Boya işlemi bekleniyor",
    "Paketleme aşamasında",
  ],
}

const manufacturingStepsByDepartment: Record<Department, { category: string; steps: string[] }[]> = {
  cam: [
    {
      category: "Cam",
      steps: ["camlar geldi", "alüminyumlar kesildi", "camlar yapıştı", "toplama yapıldı", "paketlendi"],
    },
  ],
  pergola: [
    {
      category: "Pergola Bölümü",
      steps: ["alüminyumlar kesildi", "raylar toplandı", "led profilleri hazırlandı", "kumaşlar yapıştı", "paketlendi"],
    },
  ],
  makasli: [
    {
      category: "Makaslı Bölümü",
      steps: [
        "kumaş dikime gönderildi",
        "makaslar toplandı",
        "led profiller hazırlandı",
        "motor ve boru bağlandı",
        "raylar toplandı",
        "paketlendi",
      ],
    },
  ],
  "aluminyum-tavan": [
    {
      category: "Alüminyum Tavan",
      steps: ["alüminyumlar kesildi", "raylar toplandı", "paneller toplandı", "paketlendi"],
    },
  ],
}

export default function OrderDetailPage() {
  const params = useParams()
  const orderId = params.id as string
  const router = useRouter()

  const { orders, updateOrderStatus, updatePaintDates, isLoading } = useOrders()
  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId])

  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [dialogConfig, setDialogConfig] = useState<{
    showInput: boolean
    inputType: string
    inputPlaceholder: string
    message: string
    quickReplies: string[]
  }>({
    showInput: false,
    inputType: "text",
    inputPlaceholder: "",
    message: "",
    quickReplies: [],
  })

  const [paintSendDate, setPaintSendDate] = useState<string>("")
  const [paintReturnDate, setPaintReturnDate] = useState<string>("")
  const [isSavingDates, setIsSavingDates] = useState(false)

  const [isInitialLoad, setIsInitialLoad] = useState(true)

  useEffect(() => {
    if (!isLoading) {
      setIsInitialLoad(false)
    }
  }, [isLoading])

  useEffect(() => {
    if (order) {
      setPaintSendDate(order.paintSendDate ? order.paintSendDate.toISOString().split("T")[0] : "")
      setPaintReturnDate(order.paintReturnDate ? order.paintReturnDate.toISOString().split("T")[0] : "")
    }
  }, [order])

  if (isInitialLoad || isLoading) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-8">
        <Navigation />
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-8">
        <Navigation />
        <div className="text-center py-12">
          <p className="text-lg font-semibold mb-2">Sipariş bulunamadı</p>
          <Link href="/">
            <Button variant="outline" className="mt-4 bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Siparişlere Dön
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const statusButtons = [
    { value: "pending", label: "Yeni Sipariş", requiresDialog: false },
    { value: "paint", label: "Boyada", requiresDialog: false },
    { value: "in-progress", label: "İmalat", requiresDialog: true },
    { value: "ready", label: "Teslimata Hazır", requiresDialog: false },
  ]

  const handleStatusUpdate = (status: string, requiresDialog: boolean) => {
    if (requiresDialog) {
      setPendingStatus(status)

      if (status === "in-progress") {
        const steps = order.department ? manufacturingStepsByDepartment[order.department] || [] : []

        setDialogConfig({
          showInput: true,
          inputType: "textarea",
          inputPlaceholder: "İmalat notu girin (opsiyonel)",
          message: "İmalat adımlarını seçin ve not ekleyin:",
          quickReplies: [],
        })
      }

      setShowConfirmation(true)
    } else {
      setSelectedStatus(status)
      updateOrderStatus(orderId, status as OrderStatus)
    }
  }

  const handleConfirm = (inputValue?: string, selectedSteps?: string[]) => {
    if (pendingStatus) {
      setSelectedStatus(pendingStatus)
      updateOrderStatus(orderId, pendingStatus as OrderStatus, inputValue || "", undefined, selectedSteps)
      setShowConfirmation(false)
      setPendingStatus(null)
    }
  }

  const handleSavePaintDates = async () => {
    if (paintSendDate || paintReturnDate) {
      setIsSavingDates(true)
      try {
        await updatePaintDates(orderId, paintSendDate, paintReturnDate)
        toast.success("Boya tarihleri başarıyla kaydedildi")
      } catch (error) {
        console.error("[v0] Paint dates update error:", error)
        toast.error("Boya tarihleri kaydedilemedi. Lütfen tekrar deneyin.")
      } finally {
        setIsSavingDates(false)
      }
    }
  }

  const handleCancel = () => {
    setShowConfirmation(false)
    setPendingStatus(null)
  }

  const handleFileDownload = async (file: {
    id: string
    name: string
    type: string
    url?: string
    dataUrl?: string
  }) => {
    const fileUrl = file.dataUrl || file.url
    if (!fileUrl) {
      toast.error("Dosya verisi bulunamadı")
      return
    }

    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const isPDF = file.type === "pdf" || file.name.toLowerCase().endsWith(".pdf")
      const isImage = isImageFile(file)

      // Mobil cihazlarda özel işlem
      if (isMobile) {
        // Resimler için doğrudan yeni sekmede aç
        if (isImage) {
          window.open(fileUrl, "_blank")
          toast.success("Resim yeni sekmede açılıyor")
          return
        }

        // PDF ve diğer dosyalar için blob URL oluştur
        if (fileUrl.startsWith("data:")) {
          try {
            // Data URL'i blob'a çevir
            const response = await fetch(fileUrl)
            const blob = await response.blob()
            const blobUrl = URL.createObjectURL(blob)

            // PDF için özel işlem
            if (isPDF) {
              // Yeni sekmede aç
              const newWindow = window.open(blobUrl, "_blank")
              if (newWindow) {
                toast.success("PDF yeni sekmede açılıyor")
                // Blob URL'i 1 dakika sonra temizle
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
                return
              }
            }

            // Diğer dosyalar için indirmeye zorla
            const link = document.createElement("a")
            link.href = blobUrl
            link.download = file.name
            link.style.display = "none"
            document.body.appendChild(link)
            link.click()

            setTimeout(() => {
              document.body.removeChild(link)
              URL.revokeObjectURL(blobUrl)
            }, 100)

            toast.success("Dosya indiriliyor")
          } catch (error) {
            console.error("[v0] Blob conversion error:", error)
            // Hata durumunda doğrudan data URL'i aç
            window.open(fileUrl, "_blank")
            toast.info("Dosya yeni sekmede açılıyor")
          }
        } else {
          // Normal URL için doğrudan aç
          window.open(fileUrl, "_blank")
          toast.success("Dosya yeni sekmede açılıyor")
        }
        return
      }

      // Masaüstü için mevcut işlem
      if (fileUrl.startsWith("data:")) {
        const response = await fetch(fileUrl)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)

        const link = document.createElement("a")
        link.href = blobUrl
        link.download = file.name
        link.style.display = "none"
        document.body.appendChild(link)
        link.click()

        setTimeout(() => {
          document.body.removeChild(link)
          URL.revokeObjectURL(blobUrl)
        }, 100)

        toast.success("Dosya indiriliyor")
      } else {
        const link = document.createElement("a")
        link.href = fileUrl
        link.download = file.name
        link.target = "_blank"
        link.style.display = "none"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success("Dosya indiriliyor")
      }
    } catch (error) {
      console.error("[v0] File download error:", error)
      toast.error("Dosya açılamadı. Lütfen tekrar deneyin.")
    }
  }

  const getFileIcon = (type: string) => {
    if (type === "pdf") return <FileText className="w-5 h-5 text-destructive" />
    if (type === "excel") return <FileSpreadsheet className="w-5 h-5 text-primary" />
    if (type === "image") return <ImageIcon className="w-5 h-5 text-primary" />
    return <FileText className="w-5 h-5 text-muted-foreground" />
  }

  const isImageFile = (file: { type: string; name: string; url?: string; dataUrl?: string }) => {
    const fileUrl = file.dataUrl || file.url
    return (
      fileUrl?.startsWith("data:image/") ||
      file.type === "image" ||
      file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)
    )
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-8">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Link href="/" onClick={() => window.scrollTo(0, 0)}>
          <Button
            variant="ghost"
            size="default"
            className="mb-4 h-11 hover:scale-105 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Siparişlere Dön
          </Button>
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            {order.projectName && (
              <h2 className="text-lg md:text-xl font-semibold text-primary mb-1">{order.projectName}</h2>
            )}
            <h1 className="text-2xl md:text-3xl font-bold mb-2 text-balance break-words">{order.customerName}</h1>
            <p className="text-sm text-muted-foreground mb-2">{order.orderId}</p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={order.status} />
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border bg-secondary text-secondary-foreground">
                <Factory className="w-4 h-4" />
                {getDepartmentLabel(order.department)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Sipariş Detayları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Müşteri Adı</p>
                  <p className="font-medium text-base break-words">{order.customerName}</p>
                </div>
                {order.projectName && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Proje Adı</p>
                    <p className="font-medium text-base">{order.projectName}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ürün Tipi</p>
                  <p className="font-medium text-base break-words">{order.productType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Adet</p>
                  <p className="font-medium text-base">{order.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Durum</p>
                  <StatusBadge status={order.status} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Oluşturulma Tarihi</p>
                  <p className="font-medium text-base">{order.createdAt.toLocaleDateString("tr-TR")}</p>
                </div>
                {order.deliveryDate && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Son Teslim Tarihi</p>
                    <p className="font-medium text-base text-primary flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {order.deliveryDate.toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                )}
                {order.assemblyRequired !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Montaj Durumu</p>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                        order.assemblyRequired
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-gray-100 text-gray-800 border-gray-200"
                      }`}
                    >
                      {order.assemblyRequired ? "Montaj Yapılacak" : "Montaj Yapılmayacak"}
                    </span>
                  </div>
                )}
              </div>

              {order.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Notlar</p>
                  <p className="text-base bg-secondary p-4 rounded-lg break-words">{order.notes}</p>
                </div>
              )}

              {order.statusNotes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Durum Notu</p>
                  <p className="text-base bg-primary/10 p-4 rounded-lg break-words font-medium text-primary">
                    {order.statusNotes}
                  </p>
                </div>
              )}

              {order.manufacturingSteps && order.manufacturingSteps.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">İmalat Adımları</p>
                  <div className="bg-secondary p-4 rounded-lg space-y-2.5">
                    {order.manufacturingSteps.map((step, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </span>
                        <p className="text-base break-words pt-0.5 capitalize">
                          {step
                            .split(" ")
                            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(" ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {order.statusDate && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Durum Tarihi</p>
                  <p className="text-base font-medium">{order.statusDate.toLocaleDateString("tr-TR")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Dosyalar ve Listeler</CardTitle>
            </CardHeader>
            <CardContent>
              {order.files && order.files.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {order.files.map((file) => (
                    <div
                      key={file.id}
                      className="group relative overflow-hidden rounded-lg border bg-card hover:shadow-md active:scale-95 transition-all"
                    >
                      {isImageFile(file) && (file.dataUrl || file.url) ? (
                        <div className="aspect-video w-full overflow-hidden bg-secondary/20">
                          <img src={file.dataUrl || file.url} alt={file.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-video w-full flex items-center justify-center bg-secondary/20">
                          <div className="scale-150">{getFileIcon(file.type)}</div>
                        </div>
                      )}
                      <div className="p-4">
                        <p className="text-base font-medium truncate mb-2">{file.name}</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-muted-foreground">{file.uploadedAt.toLocaleDateString("tr-TR")}</p>
                          <Button
                            size="default"
                            variant="ghost"
                            onClick={() => handleFileDownload(file)}
                            className="h-10 px-3"
                          >
                            <Download className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-base text-muted-foreground text-center py-8">Henüz dosya eklenmemiş</p>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Durum Güncelleme</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {statusButtons.map((status) => (
                  <Button
                    key={status.value}
                    variant={selectedStatus === status.value ? "default" : "outline"}
                    className="h-14 px-4 text-base font-semibold transition-all hover:scale-[1.02] active:scale-95"
                    onClick={() => handleStatusUpdate(status.value, status.requiresDialog)}
                  >
                    {status.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Boya Tarihleri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="paintSendDate" className="text-base">
                    Boyaya Gidiş Tarihi
                  </Label>
                  <Input
                    id="paintSendDate"
                    type="date"
                    value={paintSendDate}
                    onChange={(e) => setPaintSendDate(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paintReturnDate" className="text-base">
                    Boyadan Geliş Tarihi
                  </Label>
                  <Input
                    id="paintReturnDate"
                    type="date"
                    value={paintReturnDate}
                    onChange={(e) => setPaintReturnDate(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
              </div>
              <Button
                onClick={handleSavePaintDates}
                disabled={isSavingDates}
                className="mt-4 w-full h-12 text-base font-semibold"
              >
                {isSavingDates ? "Kaydediliyor..." : "Tarihleri Kaydet"}
              </Button>
            </CardContent>
          </Card>

          {order.activities && order.activities.length > 0 && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Aktivite Geçmişi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.activities.map((activity, index) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        {index < order.activities!.length - 1 && <div className="w-0.5 h-full bg-border mt-1" />}
                      </div>
                      <div className="flex-1 pb-4 min-w-0">
                        <p className="text-base font-medium break-words">{activity.action}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm text-muted-foreground">{activity.user}</span>
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {activity.timestamp.toLocaleDateString("tr-TR")}{" "}
                            {activity.timestamp.toLocaleTimeString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <ConfirmationDialog
        isOpen={showConfirmation}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        message={dialogConfig.message}
        showInput={dialogConfig.showInput}
        inputType={dialogConfig.inputType}
        inputPlaceholder={dialogConfig.inputPlaceholder}
        quickReplies={dialogConfig.quickReplies}
        showManufacturingSteps={pendingStatus === "in-progress"}
        manufacturingSteps={order.department ? manufacturingStepsByDepartment[order.department] : []}
      />
    </div>
  )
}
