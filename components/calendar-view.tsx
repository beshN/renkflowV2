"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, CalendarIcon, Package } from "lucide-react"
import type { Order } from "@/lib/orders-context"
import { StatusBadge } from "@/components/status-badge"
import Link from "next/link"

interface CalendarViewProps {
  orders: Order[]
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function CalendarView({ orders }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const ordersByDate = useMemo(() => {
    const grouped = new Map<string, Order[]>()

    orders.forEach((order) => {
      if (order.deliveryDate) {
        // Use local timezone for date key
        const dateKey = getLocalDateKey(order.deliveryDate)
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, [])
        }
        grouped.get(dateKey)!.push(order)
      }
    })

    return grouped
  }, [orders])

  // Get calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }, [currentDate])

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setSelectedDate(null)
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setSelectedDate(null)
  }

  const hasOrdersOnDate = (date: Date) => {
    const dateKey = getLocalDateKey(date)
    return ordersByDate.has(dateKey)
  }

  const getOrdersForDate = (date: Date) => {
    const dateKey = getLocalDateKey(date)
    return ordersByDate.get(dateKey) || []
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isSelected = (date: Date) => {
    return selectedDate?.toDateString() === date.toDateString()
  }

  const monthNames = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ]

  const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"]

  const selectedDateOrders = selectedDate ? getOrdersForDate(selectedDate) : []

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm">
        <CardContent className="p-4 md:p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-semibold text-foreground">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={previousMonth} className="h-8 w-8 p-0">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={nextMonth} className="h-8 w-8 p-0">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid - Compact and minimalist */}
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {/* Day names - smaller and subtle */}
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}

            {/* Calendar days - compact with better visual hierarchy */}
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="h-10 md:h-12" />
              }

              const hasOrders = hasOrdersOnDate(date)
              const ordersCount = getOrdersForDate(date).length
              const isTodayDate = isToday(date)
              const isSelectedDate = isSelected(date)

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`
                    h-10 md:h-12 rounded-md transition-all relative
                    flex flex-col items-center justify-center
                    ${
                      isTodayDate
                        ? "bg-primary text-primary-foreground font-semibold"
                        : isSelectedDate
                          ? "bg-primary/20 text-primary font-semibold ring-2 ring-primary"
                          : hasOrders
                            ? "bg-blue-50 hover:bg-blue-100 text-foreground font-medium"
                            : "hover:bg-muted text-muted-foreground"
                    }
                  `}
                >
                  <span className="text-sm">{date.getDate()}</span>
                  {hasOrders && (
                    <div className="flex gap-0.5 mt-0.5">
                      <div className="w-1 h-1 rounded-full bg-blue-500" />
                      {ordersCount > 1 && <div className="w-1 h-1 rounded-full bg-blue-500" />}
                      {ordersCount > 2 && <div className="w-1 h-1 rounded-full bg-blue-500" />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend - compact */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Teslim Tarihi Var</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-md bg-primary" />
              <span>Bugün</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Orders - cleaner design */}
      {selectedDate && (
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h3 className="text-base md:text-lg font-semibold">
                {selectedDate.toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              {selectedDateOrders.length > 0 && (
                <span className="text-xs md:text-sm px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {selectedDateOrders.length} sipariş
                </span>
              )}
            </div>

            {selectedDateOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Bu tarihte teslim edilecek sipariş bulunmuyor</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateOrders.map((order) => (
                  <Link key={order.id} href={`/orders/${order.id}`}>
                    <Card className="hover:shadow-md transition-shadow border-border/50">
                      <CardContent className="p-3 md:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="font-semibold text-sm md:text-base">{order.customerName}</span>
                              <StatusBadge status={order.status} />
                            </div>
                            <div className="space-y-0.5 text-xs md:text-sm text-muted-foreground">
                              {order.projectName && (
                                <p>
                                  <span className="font-medium text-foreground">{order.projectName}</span>
                                </p>
                              )}
                              <p>
                                {order.productType} • {order.quantity} adet
                              </p>
                            </div>
                          </div>
                          <div className="text-xs text-right flex-shrink-0">
                            <p className="font-medium text-primary">
                              {order.deliveryDate?.toLocaleDateString("tr-TR")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
