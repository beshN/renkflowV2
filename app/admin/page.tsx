"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Package,
  Users,
  TrendingUp,
  Edit,
  Trash2,
  Settings,
  Factory,
  FileText,
  LogOut,
  Loader2,
  History,
} from "lucide-react"
import type { Department } from "@/lib/mock-data"
import { FileUpload, type FileWithData } from "@/components/file-upload"
import { useOrders } from "@/lib/orders-context"
import { ConfirmationDialog } from "@/components/confirmation-dialog"
import { StatusBadge } from "@/components/status-badge"
import { toast } from "sonner"
import type { Order } from "@/lib/orders-context"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

const departmentLabels: Record<Department, string> = {
  cam: "Cam",
  pergola: "Pergola",
  makasli: "Makaslı",
  "aluminyum-tavan": "Alüminyum Tavan",
}

const DEFAULT_QUICK_REPLIES = [
  "Ölçüler alındı, imalata başlandı",
  "Malzemeler temin edildi",
  "Montaj için hazır",
  "Kalite kontrolden geçti",
]

export default function AdminPage() {
  const router = useRouter()
  const { orders, addOrder, updateOrder, deleteOrder } = useOrders()
  const [activeTab, setActiveTab] = useState<"add" | "manage" | "activity">("add")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationType, setConfirmationType] = useState<"add" | "edit" | "delete">("add")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isConfirmLoading, setIsConfirmLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [uploadedFiles, setUploadedFiles] = useState<FileWithData[]>([])
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)
  // Removed quickReplies and newQuickReply states
  // const [quickReplies, setQuickReplies] = useState<string[]>(DEFAULT_QUICK_REPLIES)
  // const [newQuickReply, setNewQuickReply] = useState("")

  const checkAuth = () => {
    const isAuthenticated = sessionStorage.getItem("admin_auth")

    if (!isAuthenticated) {
      router.push("/admin/login")
      return
    }

    setIsCheckingAuth(false)
  }

  // Removed useEffect for loading quick replies
  // useEffect(() => {
  //   const savedReplies = localStorage.getItem("quick_replies")
  //   if (savedReplies) {
  //     try {
  //       setQuickReplies(JSON.parse(savedReplies))
  //     } catch (error) {
  //       console.error("[v0] Error loading quick replies:", error)
  //     }
  //   }
  // }, [])

  useEffect(() => {
    if (activeTab === "activity") {
      loadActivityLogs()
    }
  }, [activeTab])

  const loadActivityLogs = async () => {
    try {
      setIsLoadingActivities(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from("activity_logs")
        .select(`
          *,
          orders (
            order_id,
            customer_name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) {
        console.error("[v0] Error loading activity logs:", error)
        return
      }

      setActivityLogs(data || [])
    } catch (error) {
      console.error("[v0] Error in loadActivityLogs:", error)
    } finally {
      setIsLoadingActivities(false)
    }
  }

  // Removed quick reply handler functions
  // const handleAddQuickReply = () => {
  //   if (!newQuickReply.trim()) {
  //     toast.error("Lütfen bir cevap yazın")
  //     return
  //   }

  //   const updatedReplies = [...quickReplies, newQuickReply.trim()]
  //   setQuickReplies(updatedReplies)
  //   localStorage.setItem("quick_replies", JSON.stringify(updatedReplies))
  //   setNewQuickReply("")
  //   toast.success("Hazır cevap eklendi")
  // }

  // const handleRemoveQuickReply = (index: number) => {
  //   const updatedReplies = quickReplies.filter((_, i) => i !== index)
  //   setQuickReplies(updatedReplies)
  //   localStorage.setItem("quick_replies", JSON.stringify(updatedReplies))
  //   toast.success("Hazır cevap silindi")
  // }

  // const handleResetQuickReplies = () => {
  //   setQuickReplies(DEFAULT_QUICK_REPLIES)
  //   localStorage.setItem("quick_replies", JSON.stringify(DEFAULT_QUICK_REPLIES))
  //   toast.success("Hazır cevaplar sıfırlandı")
  // }

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    projectName: "",
    productType: "",
    quantity: "",
    department: "" as Department | "",
    deliveryDate: "", // This is the son teslim tarihi field
    notes: "",
    assemblyRequired: false,
    width: "",
    height: "",
    depth: "",
    color: "",
    material: "",
    specifications: "",
  })

  useEffect(() => {
    checkAuth()
  }, [router])

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto text-primary mb-4 animate-spin" />
          <p className="text-muted-foreground">Yetkilendirme kontrol ediliyor...</p>
        </div>
      </div>
    )
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.customerName.trim()) {
      errors.customerName = "Müşteri adı zorunludur"
    }

    if (!formData.productType.trim()) {
      errors.productType = "Ürün tipi zorunludur"
    }

    if (!formData.quantity.trim()) {
      errors.quantity = "Adet bilgisi zorunludur"
    }

    if (!formData.department) {
      errors.department = "Bölüm seçimi zorunludur"
    }

    if (formData.customerPhone && !/^[\d\s+\-()]+$/.test(formData.customerPhone)) {
      errors.customerPhone = "Geçerli bir telefon numarası giriniz"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error("Lütfen tüm zorunlu alanları doldurun")
      return
    }

    setConfirmationType(editingOrder ? "edit" : "add")
    setShowConfirmation(true)
  }

  const handleConfirmAdd = async () => {
    setIsConfirmLoading(true)

    try {
      if (editingOrder) {
        const updatedOrder: Partial<Order> = {
          customerName: formData.customerName,
          customerPhone: formData.customerPhone || undefined,
          projectName: formData.projectName || undefined,
          productType: formData.productType,
          quantity: formData.quantity,
          department: formData.department as Department,
          notes: formData.notes || undefined,
          deliveryDate: formData.deliveryDate ? new Date(formData.deliveryDate) : undefined,
          sonTeslimTarihi: formData.deliveryDate ? new Date(formData.deliveryDate) : undefined,
          assemblyRequired: formData.assemblyRequired,
          files: uploadedFiles.map((fileData, index) => ({
            id: `f${Date.now()}-${index}`,
            name: fileData.file.name,
            type: fileData.file.name.endsWith(".pdf")
              ? ("pdf" as const)
              : fileData.file.name.endsWith(".xlsx") || fileData.file.name.endsWith(".xls")
                ? ("excel" as const)
                : ("image" as const),
            url: fileData.dataUrl,
            uploadedAt: new Date(),
          })),
        }

        await updateOrder(editingOrder.id, updatedOrder)

        router.push(`/orders/${editingOrder.id}`)
        setEditingOrder(null)
      } else {
        const newOrder = {
          customerName: formData.customerName,
          customerPhone: formData.customerPhone || undefined,
          projectName: formData.projectName || undefined,
          productType: formData.productType,
          quantity: formData.quantity,
          status: "pending" as const,
          department: formData.department as Department,
          notes: formData.notes || undefined,
          deliveryDate: formData.deliveryDate ? new Date(formData.deliveryDate) : undefined,
          sonTeslimTarihi: formData.deliveryDate ? new Date(formData.deliveryDate) : undefined,
          assemblyRequired: formData.assemblyRequired,
          files: uploadedFiles.map((fileData, index) => ({
            id: `f${Date.now()}-${index}`,
            name: fileData.file.name,
            type: fileData.file.name.endsWith(".pdf")
              ? ("pdf" as const)
              : fileData.file.name.endsWith(".xlsx") || fileData.file.name.endsWith(".xls")
                ? ("excel" as const)
                : ("image" as const),
            url: fileData.dataUrl,
            dataUrl: fileData.dataUrl,
            uploadedAt: new Date(),
          })),
        }

        await addOrder(newOrder)

        router.push("/")
      }

      setFormData({
        customerName: "",
        customerPhone: "",
        projectName: "",
        productType: "",
        quantity: "",
        department: "",
        deliveryDate: "", // Reset delivery date
        notes: "",
        assemblyRequired: false,
        width: "",
        height: "",
        depth: "",
        color: "",
        material: "",
        specifications: "",
      })
      setUploadedFiles([])
      setFormErrors({})
      setShowConfirmation(false)
      setIsConfirmLoading(false)
    } catch (error) {
      console.error("[v0] Error saving order:", error)
      toast.error("Sipariş kaydedilirken bir hata oluştu", {
        description: "Lütfen tekrar deneyin",
      })
      setIsConfirmLoading(false)
    }
  }

  const handleEditOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId)
    if (order) {
      setEditingOrder(order)

      let deliveryDateString = ""
      if (order.deliveryDate) {
        try {
          const date = order.deliveryDate instanceof Date ? order.deliveryDate : new Date(order.deliveryDate)
          if (!isNaN(date.getTime())) {
            deliveryDateString = date.toISOString().split("T")[0]
          }
        } catch (error) {
          console.error("[v0] Error parsing delivery date:", error)
        }
      }

      setFormData({
        customerName: order.customerName || "",
        customerPhone: order.customerPhone || "",
        projectName: order.projectName || "",
        productType: order.productType || "",
        quantity: order.quantity || "1",
        department: order.department || ("" as Department | ""),
        deliveryDate: deliveryDateString, // Load existing delivery date
        notes: order.notes || "",
        assemblyRequired: order.assemblyRequired || false,
        width: "",
        height: "",
        depth: "",
        color: "",
        material: "",
        specifications: "",
      })

      if (order.files && order.files.length > 0) {
        const existingFiles: FileWithData[] = order.files.map((file) => ({
          file: new File([], file.name, { type: file.type }),
          dataUrl: file.url || "",
        }))
        setUploadedFiles(existingFiles)
      } else {
        setUploadedFiles([])
      }

      setActiveTab("add")
    }
  }

  const handleDeleteOrder = (orderId: string) => {
    setSelectedOrderId(orderId)
    setConfirmationType("delete")
    setShowConfirmation(true)
  }

  const handleConfirmDelete = () => {
    if (selectedOrderId) {
      setIsConfirmLoading(true)

      try {
        deleteOrder(selectedOrderId)
        setSelectedOrderId(null)
        setShowConfirmation(false)
        setIsConfirmLoading(false)
      } catch (error) {
        console.error("[v0] Error deleting order:", error)
        toast.error("Sipariş silinirken bir hata oluştu")
        setIsConfirmLoading(false)
      }
    }
  }

  const handleCancel = () => {
    if (isConfirmLoading) return

    setShowConfirmation(false)
    setSelectedOrderId(null)
    setIsConfirmLoading(false)
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const totalOrders = orders.length
  const activeOrders = orders.filter((o) => o.status === "in-progress" || o.status === "pending").length

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth")
    router.push("/admin/login")
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-8">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Yönetici Paneli</h1>
          <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2 bg-transparent">
            <LogOut className="w-4 h-4" />
            Çıkış
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="hover:shadow-md transition-all active:scale-95">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Package className="w-4 h-4" />
                Toplam Sipariş
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-foreground">{totalOrders}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-all active:scale-95">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                Yeni
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-blue-600">
                {orders.filter((o) => o.status === "pending").length}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-all active:scale-95">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Factory className="w-4 h-4" />
                İmalatta
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-orange-600">
                {orders.filter((o) => o.status === "in-progress").length}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-all active:scale-95">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Hazır
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-bold text-green-600">
                {orders.filter((o) => o.status === "ready").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Factory className="w-5 h-5 md:w-6 md:h-6" />
              Bölümlere Göre Dağılım
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Cam</p>
                <p className="text-xl font-bold">{orders.filter((o) => o.department === "cam").length}</p>
              </div>
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Pergola</p>
                <p className="text-xl font-bold">{orders.filter((o) => o.department === "pergola").length}</p>
              </div>
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Makaslı</p>
                <p className="text-xl font-bold">{orders.filter((o) => o.department === "makasli").length}</p>
              </div>
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Alüminyum Tavan</p>
                <p className="text-xl font-bold">{orders.filter((o) => o.department === "aluminyum-tavan").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mb-6 flex-wrap">
          <Button
            variant={activeTab === "add" ? "default" : "outline"}
            onClick={() => setActiveTab("add")}
            className="flex items-center gap-2 h-12 flex-1 sm:flex-initial text-base"
          >
            <Plus className="w-5 h-5 md:w-6 md:h-6" />
            Yeni Sipariş Ekle
          </Button>
          <Button
            variant={activeTab === "manage" ? "default" : "outline"}
            onClick={() => setActiveTab("manage")}
            className="flex items-center gap-2 h-12 flex-1 sm:flex-initial text-base"
          >
            <Settings className="w-5 h-5 md:w-6 md:h-6" />
            Sipariş Yönetimi
          </Button>
          <Button
            variant={activeTab === "activity" ? "default" : "outline"}
            onClick={() => setActiveTab("activity")}
            className="flex items-center gap-2 h-12 flex-1 sm:flex-initial text-base"
          >
            <History className="w-5 h-5 md:w-6 md:h-6" />
            Aktivite Geçmişi
          </Button>
          {/* <Button
            variant={activeTab === "quick-replies" ? "default" : "outline"}
            onClick={() => setActiveTab("quick-replies")}
            className="flex items-center gap-2 h-12 flex-1 sm:flex-initial text-base"
          >
            <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />
            Hazır Cevaplar
          </Button> */}
        </div>

        {activeTab === "add" && (
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Plus className="w-5 h-5 md:w-6 md:h-6" />
                {editingOrder ? "Sipariş Düzenle" : "Yeni Sipariş Ekle"}
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                {"Yeni bir sipariş oluşturun ve sisteme ekleyin."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-4">Müşteri Bilgileri</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName" className="text-base">
                        Müşteri Adı *
                      </Label>
                      <Input
                        id="customerName"
                        type="text"
                        inputMode="text"
                        placeholder="Örn: Ahmet Yılmaz"
                        value={formData.customerName}
                        onChange={(e) => handleInputChange("customerName", e.target.value)}
                        required
                        className={`h-12 text-base ${formErrors.customerName ? "border-red-500" : ""}`}
                      />
                      {formErrors.customerName && <p className="text-sm text-destructive">{formErrors.customerName}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="projectName" className="text-base">
                        Proje Adı
                      </Label>
                      <Input
                        id="projectName"
                        type="text"
                        inputMode="text"
                        placeholder="Örn: Villa Projesi"
                        value={formData.projectName}
                        onChange={(e) => handleInputChange("projectName", e.target.value)}
                        className="h-12 text-base"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-4">Sipariş Detayları</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="productType" className="text-base">
                        Ürün Tipi *
                      </Label>
                      <Input
                        id="productType"
                        type="text"
                        inputMode="text"
                        placeholder="Örn: Metal Kapı"
                        value={formData.productType}
                        onChange={(e) => handleInputChange("productType", e.target.value)}
                        required
                        className={`h-12 text-base ${formErrors.productType ? "border-red-500" : ""}`}
                      />
                      {formErrors.productType && <p className="text-sm text-destructive">{formErrors.productType}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantity" className="text-base">
                        Adet *
                      </Label>
                      <Input
                        id="quantity"
                        type="text"
                        inputMode="text"
                        placeholder="Örn: 5 adet kapı, 3 adet pencere"
                        value={formData.quantity}
                        onChange={(e) => handleInputChange("quantity", e.target.value)}
                        required
                        className={`h-12 text-base ${formErrors.quantity ? "border-red-500" : ""}`}
                      />
                      {formErrors.quantity && <p className="text-sm text-destructive">{formErrors.quantity}</p>}
                      <p className="text-xs text-muted-foreground">
                        Birden fazla ürün varsa detaylı açıklama yazabilirsiniz
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="department" className="text-base">
                        Bölüm *
                      </Label>
                      <Select
                        value={formData.department}
                        onValueChange={(value) => handleInputChange("department", value)}
                      >
                        <SelectTrigger
                          id="department"
                          className={`h-12 text-base ${formErrors.department ? "border-red-500" : ""}`}
                        >
                          <SelectValue placeholder="Bölüm seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(departmentLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value} className="text-base">
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formErrors.department && <p className="text-sm text-destructive">{formErrors.department}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deliveryDate" className="text-base">
                        Son Teslim Tarihi
                      </Label>
                      <Input
                        id="deliveryDate"
                        type="date"
                        value={formData.deliveryDate}
                        onChange={(e) => handleInputChange("deliveryDate", e.target.value)}
                        className="h-12 text-base"
                      />
                      <p className="text-xs text-muted-foreground">Siparişin teslim edilmesi gereken son tarih</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-4">Sipariş Listeleri ve Dökümanlar</h3>
                  <FileUpload
                    onFileSelect={(files) => setUploadedFiles((prev) => [...prev, ...files])}
                    selectedFiles={uploadedFiles}
                    onRemoveFile={(index) => setUploadedFiles((prev) => prev.filter((_, i) => i !== index))}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Sipariş ölçü listesi, teknik çizim veya referans görselleri yükleyebilirsiniz.
                  </p>
                </div>

                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-4">Ek Notlar</h3>
                  <Textarea
                    id="notes"
                    placeholder="Özel talepler veya diğer notlar..."
                    rows={4}
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    className="text-base resize-none"
                  />
                </div>

                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-4">Montaj Durumu</h3>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <input
                      type="checkbox"
                      id="assemblyRequired"
                      checked={formData.assemblyRequired}
                      onChange={(e) => handleInputChange("assemblyRequired", e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="assemblyRequired" className="text-base font-medium cursor-pointer flex-1">
                      Montaj Yapılacak
                    </Label>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 text-base font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {editingOrder ? "Kaydet" : "Sipariş Ekle"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === "manage" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Sipariş Yönetimi</CardTitle>
              <CardDescription className="text-sm md:text-base">
                Mevcut siparişleri düzenleyin veya silin
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Henüz sipariş bulunmuyor</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Yeni sipariş eklemek için yukarıdaki butonu kullanın
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-base">{order.customerName}</span>
                          <StatusBadge status={order.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">{order.orderId}</p>
                        {order.projectName && (
                          <p className="text-sm text-muted-foreground">Proje: {order.projectName}</p>
                        )}
                        <p className="text-sm text-muted-foreground">{order.productType}</p>
                        {order.statusNotes && (
                          <p className="text-sm text-primary mt-1">
                            <span className="font-medium">Not:</span> {order.statusNotes}
                          </p>
                        )}
                        {order.files && order.files.length > 0 && (
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {order.files.length} dosya eklendi
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => handleEditOrder(order.id)}
                          className="flex items-center gap-2 h-11 flex-1 sm:flex-initial"
                        >
                          <Edit className="w-4 h-4" />
                          Düzenle
                        </Button>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => handleDeleteOrder(order.id)}
                          className="flex items-center gap-2 h-11 flex-1 sm:flex-initial text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="w-4 h-4" />
                          Sil
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "activity" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <History className="w-5 h-5 md:w-6 md:h-6" />
                Aktivite Geçmişi
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                Tüm sipariş aktivitelerini görüntüleyin
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingActivities ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 mx-auto text-primary mb-4 animate-spin" />
                  <p className="text-muted-foreground">Aktiviteler yükleniyor...</p>
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Henüz aktivite bulunmuyor</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <History className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-base">{log.action}</span>
                          {log.orders && (
                            <span className="text-sm text-muted-foreground">
                              ({log.orders.order_id} - {log.orders.customer_name})
                            </span>
                          )}
                        </div>
                        {log.details && <p className="text-sm text-muted-foreground mb-1">{log.details}</p>}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd MMMM yyyy HH:mm", { locale: tr })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Removed "quick-replies" tab content */}
        {/* {activeTab === "quick-replies" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />
                Hazır Cevaplar Yönetimi
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                İmalat durumu için hazır cevaplarınızı düzenleyin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="newQuickReply" className="text-base">
                    Yeni Hazır Cevap Ekle
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="newQuickReply"
                      type="text"
                      placeholder="Örn: Ölçüler alındı, imalata başlandı"
                      value={newQuickReply}
                      onChange={(e) => setNewQuickReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddQuickReply()
                        }
                      }}
                      className="h-12 text-base flex-1"
                    />
                    <Button onClick={handleAddQuickReply} className="h-12 px-6">
                      <Plus className="w-5 h-5 mr-2" />
                      Ekle
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Mevcut Hazır Cevaplar</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetQuickReplies}
                      className="text-sm bg-transparent"
                    >
                      Varsayılana Dön
                    </Button>
                  </div>
                  {quickReplies.length === 0 ? (
                    <div className="text-center py-8 border rounded-lg">
                      <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Henüz hazır cevap bulunmuyor</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {quickReplies.map((reply, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-3 p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                        >
                          <span className="text-base flex-1">{reply}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveQuickReply(index)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )} */}
      </main>

      <ConfirmationDialog
        isOpen={showConfirmation}
        onConfirm={confirmationType === "delete" ? handleConfirmDelete : handleConfirmAdd}
        onCancel={handleCancel}
        isLoading={isConfirmLoading}
        message={
          confirmationType === "delete"
            ? "Bu siparişi silmek istediğinizden emin misiniz?"
            : confirmationType === "edit"
              ? "Değişiklikleri kaydetmek ister misiniz?"
              : "Yeni siparişi eklemek ister misiniz?"
        }
      />
    </div>
  )
}
