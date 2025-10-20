"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, Calendar, User } from "lucide-react"
import Link from "next/link"
import type { Order, OrderStatus } from "@/lib/mock-data"

interface BoardViewProps {
  orders: Order[]
}

const statusColumns: { status: OrderStatus; label: string; color: string }[] = [
  { status: "pending", label: "Yeni Sipariş", color: "bg-yellow-50 border-yellow-200" },
  { status: "in-progress", label: "İmalatta", color: "bg-blue-50 border-blue-200" },
  { status: "paint-send", label: "Boyada", color: "bg-purple-50 border-purple-200" },
  { status: "ready", label: "Tamamlandı", color: "bg-green-50 border-green-200" },
]

export function BoardView({ orders }: BoardViewProps) {
  const ordersByStatus = useMemo(() => {
    const grouped = new Map<OrderStatus, Order[]>()

    statusColumns.forEach(({ status }) => {
      grouped.set(status, [])
    })

    orders.forEach((order) => {
      const statusOrders = grouped.get(order.status)
      if (statusOrders) {
        statusOrders.push(order)
      }
    })

    return grouped
  }, [orders])

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {statusColumns.map(({ status, label, color }) => {
          const columnOrders = ordersByStatus.get(status) || []

          return (
            <div key={status} className="flex-shrink-0 w-80">
              <div className={`rounded-lg border-2 ${color} p-3 mb-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base">{label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnOrders.length}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
                {columnOrders.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Sipariş yok</div>
                ) : (
                  columnOrders.map((order) => (
                    <Link key={order.id} href={`/orders/${order.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer border-2">
                        <CardHeader className="p-2 pb-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">{order.customerName}</h4>
                              <p className="text-xs text-muted-foreground truncate">{order.orderId}</p>
                            </div>
                            {order.assemblyRequired && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                Montaj
                              </Badge>
                            )}
                          </div>
                        </CardHeader>

                        <CardContent className="p-2 pt-0 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs">
                            <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{order.productType}</span>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">Adet: {order.quantity}</span>
                          </div>

                          {order.deliveryDate && (
                            <div className="flex items-center gap-2 text-xs text-primary">
                              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{order.deliveryDate.toLocaleDateString("tr-TR")}</span>
                            </div>
                          )}

                          {order.projectName && (
                            <p className="text-xs text-muted-foreground truncate">{order.projectName}</p>
                          )}

                          {order.statusNotes && <p className="text-xs text-primary truncate">{order.statusNotes}</p>}
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
