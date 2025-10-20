"use client"

import { useState, useEffect } from "react"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Bell, Moon, Download, Upload, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { useOrders } from "@/lib/orders-context"

export default function SettingsPage() {
  const { orders } = useOrders()
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const isDark = localStorage.getItem("darkMode") === "true"
    setDarkMode(isDark)
    if (isDark) {
      document.documentElement.classList.add("dark")
    }
  }, [])

  const toggleDarkMode = (checked: boolean) => {
    setDarkMode(checked)
    localStorage.setItem("darkMode", checked.toString())
    if (checked) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    toast.success(checked ? "Koyu tema etkinleştirildi" : "Açık tema etkinleştirildi")
  }

  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(orders, null, 2)
      const dataBlob = new Blob([dataStr], { type: "application/json" })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `ordertrack-backup-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success("Veriler başarıyla dışa aktarıldı", {
        description: `${orders.length} sipariş yedeklendi`,
      })
    } catch (error) {
      console.error("[v0] Error exporting data:", error)
      toast.error("Veri dışa aktarılırken bir hata oluştu")
    }
  }

  const handleImportData = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem("ordertrack-orders", JSON.stringify(data))
          toast.success("Veriler başarıyla içe aktarıldı", {
            description: "Sayfa yenileniyor...",
          })
          setTimeout(() => window.location.reload(), 1500)
        } else {
          toast.error("Geçersiz veri formatı")
        }
      } catch (error) {
        console.error("[v0] Error importing data:", error)
        toast.error("Veri içe aktarılırken bir hata oluştu")
      }
    }
    input.click()
  }

  const handleClearData = () => {
    if (confirm("Tüm siparişleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
      try {
        localStorage.removeItem("ordertrack-orders")
        toast.success("Tüm veriler temizlendi", {
          description: "Sayfa yenileniyor...",
        })
        setTimeout(() => window.location.reload(), 1500)
      } catch (error) {
        console.error("[v0] Error clearing data:", error)
        toast.error("Veriler temizlenirken bir hata oluştu")
      }
    }
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-8">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 py-6 animate-in fade-in duration-500">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Ayarlar</h1>
          <p className="text-muted-foreground">Uygulama tercihlerinizi yönetin</p>
        </div>

        <div className="space-y-6">
          {/* Notifications */}
          <Card className="animate-in slide-in-from-bottom-4 duration-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Bildirimler
              </CardTitle>
              <CardDescription>Bildirim tercihlerinizi ayarlayın</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sipariş Güncellemeleri</Label>
                  <p className="text-sm text-muted-foreground">Sipariş durumu değiştiğinde bildirim al</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Yeni Siparişler</Label>
                  <p className="text-sm text-muted-foreground">Yeni sipariş eklendiğinde bildirim al</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Teslim Tarihi Hatırlatıcıları</Label>
                  <p className="text-sm text-muted-foreground">Teslim tarihi yaklaştığında hatırlat</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="animate-in slide-in-from-bottom-4 duration-700 delay-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="w-5 h-5" />
                Görünüm
              </CardTitle>
              <CardDescription>Uygulama görünümünü özelleştirin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Koyu Tema</Label>
                  <p className="text-sm text-muted-foreground">Karanlık modu etkinleştir</p>
                </div>
                <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
              </div>
            </CardContent>
          </Card>

          {/* Data Management - Geliştirilmiş veri yönetimi */}
          
        </div>
      </main>
    </div>
  )
}
