"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Navigation } from "@/components/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { DepartmentFilter, getDepartmentLabel } from "@/components/department-filter"
import { CalendarView } from "@/components/calendar-view"
import { BoardView } from "@/components/board-view"
import type { Department } from "@/components/department-filter"
import { Search, SlidersHorizontal, Package, Loader2, List, Calendar, LayoutGrid } from "lucide-react"
import Link from "next/link"
import { useOrders } from "@/lib/orders-context"

export default function HomePage() {
  const { orders, isLoading } = useOrders()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [departmentFilter, setDepartmentFilter] = useState<Department>("all")
  const [isMounted, setIsMounted] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "board">("list")

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const filteredOrders = useMemo(() => {
    let filtered = orders

    // Apply filters
    if (departmentFilter !== "all") {
      filtered = filtered.filter((order) => order.department === departmentFilter)
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (order) =>
          order.orderId.toLowerCase().includes(query) ||
          order.customerName.toLowerCase().includes(query) ||
          order.productType.toLowerCase().includes(query) ||
          (order.projectName && order.projectName.toLowerCase().includes(query)),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "newest") {
        return b.createdAt.getTime() - a.createdAt.getTime()
      } else if (sortBy === "oldest") {
        return a.createdAt.getTime() - b.createdAt.getTime()
      } else if (sortBy === "customer") {
        return a.customerName.localeCompare(b.customerName)
      }
      return 0
    })

    return sorted
  }, [orders, searchQuery, statusFilter, sortBy, departmentFilter])

  const handleOrderClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [])

  const clearSearch = useCallback(() => setSearchQuery(""), [])
  const clearStatusFilter = useCallback(() => setStatusFilter("all"), [])
  const clearDepartmentFilter = useCallback(() => setDepartmentFilter("all"), [])

  return (
    <div className="min-h-screen bg-background pt-20 pb-8">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-xl md:text-3xl font-bold text-balance mb-6">Renk Alüminyum Sipariş Takip Sistemi</h1>

        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 md:p-6 rounded-lg mb-4">
          <h2 className="text-xl md:text-3xl font-bold mb-2">Tüm Siparişler</h2>
          <p className="text-sm text-muted-foreground">Toplam {filteredOrders.length} sipariş gösteriliyor</p>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => setViewMode("list")}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <List className="w-4 h-4" />
            Liste
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            onClick={() => setViewMode("calendar")}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <Calendar className="w-4 h-4" />
            Takvim
          </Button>
          <Button
            variant={viewMode === "board" ? "default" : "outline"}
            onClick={() => setViewMode("board")}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <LayoutGrid className="w-4 h-4" />
            Tablo
          </Button>
        </div>

        {viewMode === "list" && (
          <>
            <div className="space-y-3 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  inputMode="search"
                  placeholder="Sipariş no, müşteri, proje adı veya ürün ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>

              <DepartmentFilter value={departmentFilter} onChange={setDepartmentFilter} />

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <SlidersHorizontal className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="flex-1 h-12 text-base">
                      <SelectValue placeholder="Durum Filtrele" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Durumlar</SelectItem>
                      <SelectItem value="pending">Yeni Sipariş</SelectItem>
                      <SelectItem value="paint-send">Boyada</SelectItem>
                      <SelectItem value="in-progress">İmalat</SelectItem>
                      <SelectItem value="ready">Teslimata Hazır</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="flex-1 sm:w-[200px] h-12 text-base">
                    <SelectValue placeholder="Sırala" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">En Yeni</SelectItem>
                    <SelectItem value="oldest">En Eski</SelectItem>
                    <SelectItem value="customer">Müşteri Adı</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {departmentFilter !== "all" && (
                <p className="text-sm text-muted-foreground">
                  Gösterilen: <span className="font-medium">{getDepartmentLabel(departmentFilter)}</span>
                </p>
              )}
            </div>
          </>
        )}

        {isLoading ? (
          <Card>
            <CardContent className="text-center py-16">
              <Loader2 className="w-16 h-16 mx-auto text-primary mb-4 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Siparişler Yükleniyor...</h3>
              <p className="text-sm text-muted-foreground">Lütfen bekleyin</p>
            </CardContent>
          </Card>
        ) : viewMode === "calendar" ? (
          <CalendarView orders={filteredOrders} />
        ) : viewMode === "board" ? (
          <BoardView orders={filteredOrders} />
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery || statusFilter !== "all" || departmentFilter !== "all"
                  ? "Sipariş Bulunamadı"
                  : "Henüz Sipariş Yok"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all" || departmentFilter !== "all"
                  ? "Arama kriterlerinize uygun sipariş bulunamadı. Filtreleri değiştirmeyi deneyin."
                  : "Yeni sipariş eklemek için yönetici panelini kullanın."}
              </p>
              {(searchQuery || statusFilter !== "all" || departmentFilter !== "all") && (
                <div className="flex gap-2 justify-center flex-wrap">
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="text-sm px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors min-h-[44px]"
                    >
                      Aramayı temizle
                    </button>
                  )}
                  {statusFilter !== "all" && (
                    <button
                      onClick={clearStatusFilter}
                      className="text-sm px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors min-h-[44px]"
                    >
                      Durum filtresini kaldır
                    </button>
                  )}
                  {departmentFilter !== "all" && (
                    <button
                      onClick={clearDepartmentFilter}
                      className="text-sm px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors min-h-[44px]"
                    >
                      Bölüm filtresini kaldır
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((order, index) => (
              <Link key={order.id} href={`/orders/${order.id}`} onClick={handleOrderClick}>
                <Card
                  className={`hover-lift active:scale-[0.98] transition-transform ${isMounted && index < 10 ? `card-entrance stagger-${index + 1}` : ""}`}
                >
                  <CardContent className="p-4 md:p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
                          <span className="font-bold text-lg md:text-xl">{order.customerName}</span>
                          <StatusBadge status={order.status} />
                          {order.assemblyRequired !== undefined && (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs md:text-sm font-medium border ${
                                order.assemblyRequired
                                  ? "bg-blue-100 text-blue-800 border-blue-200"
                                  : "bg-gray-100 text-gray-800 border-gray-200"
                              }`}
                            >
                              {order.assemblyRequired ? "Montaj Var" : "Montaj Yok"}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {order.projectName && (
                            <p className="text-sm md:text-base truncate">
                              <span className="text-muted-foreground">Proje:</span>{" "}
                              <span className="font-medium">{order.projectName}</span>
                            </p>
                          )}
                          <p className="text-sm md:text-base truncate">
                            <span className="text-muted-foreground">Ürün:</span>{" "}
                            <span className="font-medium">{order.productType}</span>
                          </p>
                          <p className="text-sm md:text-base">
                            <span className="text-muted-foreground">Adet:</span>{" "}
                            <span className="font-medium">{order.quantity}</span>
                          </p>
                          {order.deliveryDate && (
                            <p className="text-sm md:text-base">
                              <span className="text-muted-foreground">Son Teslim:</span>{" "}
                              <span className="font-medium text-primary">
                                {order.deliveryDate.toLocaleDateString("tr-TR")}
                              </span>
                            </p>
                          )}
                          {order.statusNotes && (
                            <p className="text-sm md:text-base text-primary">
                              <span className="text-muted-foreground">Not:</span>{" "}
                              <span className="font-medium">{order.statusNotes}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground md:text-right flex-shrink-0">
                        <p>{order.createdAt.toLocaleDateString("tr-TR")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
