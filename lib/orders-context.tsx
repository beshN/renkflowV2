"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Order, OrderStatus } from "@/lib/mock-data"
import { toast } from "sonner"

interface OrdersContextType {
  orders: Order[]
  addOrder: (order: Omit<Order, "id" | "orderId" | "createdAt" | "updatedAt">) => Promise<string>
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    statusNotes?: string,
    statusDate?: string,
    manufacturingSteps?: string[],
  ) => Promise<void>
  updateOrder: (orderId: string, orderData: Partial<Order>) => Promise<void>
  deleteOrder: (orderId: string) => Promise<void>
  updatePaintDates: (orderId: string, paintSendDate?: Date, paintReturnDate?: Date) => Promise<void>
  isLoading: boolean
  error: string | null
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined)

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // First, fetch orders without JOIN
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (ordersError) throw ordersError

      if (!ordersData || ordersData.length === 0) {
        setOrders([])
        return
      }

      // Second, fetch files for these orders
      const orderIds = ordersData.map((order) => order.id)
      const { data: filesData, error: filesError } = await supabase
        .from("order_files")
        .select("*")
        .in("order_id", orderIds)

      if (filesError) {
        console.error("[v0] Dosyalar yüklenirken hata:", filesError)
        // Don't throw, continue without files
      }

      // Map files to orders
      const filesMap = new Map<string, any[]>()
      if (filesData) {
        filesData.forEach((file) => {
          if (!filesMap.has(file.order_id)) {
            filesMap.set(file.order_id, [])
          }
          filesMap.get(file.order_id)?.push(file)
        })
      }

      const ordersWithFiles: Order[] = ordersData.map((order) => {
        const orderFiles = (filesMap.get(order.id) || []).map((file: any) => ({
          id: file.id,
          name: file.name,
          type: file.type as "pdf" | "excel" | "image",
          url: file.url,
          uploadedAt: new Date(file.uploaded_at),
        }))

        return {
          id: order.id,
          orderId: order.order_id,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          projectName: order.project_name || undefined,
          productType: order.product_type,
          quantity: order.quantity,
          orderDate: new Date(order.order_date),
          deliveryDate: order.delivery_date ? new Date(order.delivery_date) : undefined,
          status: order.status as OrderStatus,
          department: order.department,
          notes: order.notes || "",
          statusNotes: order.status_notes || "",
          statusDate: order.status_date ? new Date(order.status_date) : undefined,
          paintSendDate: order.paint_send_date ? new Date(order.paint_send_date) : undefined,
          paintReturnDate: order.paint_return_date ? new Date(order.paint_return_date) : undefined,
          assemblyRequired: order.assembly_required || false,
          createdAt: new Date(order.created_at),
          updatedAt: new Date(order.updated_at),
          files: orderFiles,
          photos: [],
          comments: [],
          activities: [],
          manufacturingSteps: order.manufacturing_steps || [],
        }
      })

      setOrders(ordersWithFiles)
    } catch (error) {
      console.error("[v0] Siparişler yüklenirken hata:", error)
      const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata"
      setError(`Siparişler yüklenemedi: ${errorMessage}`)
      toast.error("Siparişler yüklenemedi", {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadOrders()

    let reloadTimeout: NodeJS.Timeout | null = null

    const channel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (reloadTimeout) clearTimeout(reloadTimeout)
        reloadTimeout = setTimeout(() => {
          loadOrders()
        }, 1000) // Increased debounce time
      })
      .subscribe((status) => {
        if (status === "SUBSCRIPTION_ERROR") {
          console.error("[v0] Realtime subscription error")
          setError("Gerçek zamanlı güncellemeler devre dışı")
        }
      })

    return () => {
      if (reloadTimeout) clearTimeout(reloadTimeout)
      supabase.removeChannel(channel)
    }
  }, [loadOrders, supabase])

  const addOrder = useCallback(
    async (orderData: Omit<Order, "id" | "orderId" | "createdAt" | "updatedAt">) => {
      try {
        if (!orderData.customerName || !orderData.productType || !orderData.quantity) {
          throw new Error("Müşteri adı, ürün tipi ve adet zorunludur")
        }

        const { data: existingOrders, error: queryError } = await supabase
          .from("orders")
          .select("order_id")
          .order("created_at", { ascending: false })
          .limit(100)

        if (queryError) {
          console.error("[v0] Error fetching existing orders:", queryError)
          throw new Error("Sipariş numarası oluşturulamadı")
        }

        let maxOrderNumber = 0
        if (existingOrders && existingOrders.length > 0) {
          existingOrders.forEach((order) => {
            const match = order.order_id.match(/RNK-2025-(\d+)/)
            if (match) {
              const num = Number.parseInt(match[1], 10)
              if (num > maxOrderNumber) {
                maxOrderNumber = num
              }
            }
          })
        }

        const nextOrderNumber = maxOrderNumber + 1
        const generatedOrderId = `RNK-2025-${String(nextOrderNumber).padStart(3, "0")}`

        const { data: newOrder, error: orderError } = await supabase
          .from("orders")
          .insert({
            order_id: generatedOrderId,
            customer_name: orderData.customerName,
            customer_phone: orderData.customerPhone || null,
            project_name: orderData.projectName || null,
            product_type: orderData.productType,
            quantity: orderData.quantity,
            order_date: orderData.orderDate || new Date(),
            delivery_date: orderData.deliveryDate || null,
            status: orderData.status,
            department: orderData.department,
            notes: orderData.notes || "",
            assembly_required: orderData.assemblyRequired || false,
            manufacturing_steps: orderData.manufacturingSteps || null,
          })
          .select()
          .single()

        if (orderError) {
          console.error("[v0] Error inserting order:", orderError)
          throw new Error(`Sipariş eklenemedi: ${orderError.message}`)
        }

        if (!newOrder) {
          throw new Error("Sipariş oluşturuldu ancak veri alınamadı")
        }

        if (orderData.files && orderData.files.length > 0) {
          const { error: filesError } = await supabase.from("order_files").insert(
            orderData.files.map((file) => ({
              order_id: newOrder.id,
              name: file.name,
              type: file.type,
              url: file.url,
              is_admin_only: false,
            })),
          )

          if (filesError) {
            console.error("[v0] Error inserting files:", filesError)
            toast.warning("Sipariş eklendi ancak bazı dosyalar yüklenemedi")
          }
        }

        toast.success("Sipariş başarıyla eklendi", {
          description: `Sipariş No: ${generatedOrderId}`,
        })

        return newOrder.id
      } catch (error) {
        console.error("[v0] Sipariş eklenirken hata:", error)
        const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata"
        toast.error("Sipariş eklenemedi", {
          description: errorMessage,
        })
        throw error
      }
    },
    [supabase],
  )

  const updateOrder = useCallback(
    async (orderId: string, orderData: Partial<Order>) => {
      try {
        if (!orderId) {
          throw new Error("Sipariş ID'si gerekli")
        }

        const updateData: any = {}

        if (orderData.customerName) updateData.customer_name = orderData.customerName
        if (orderData.customerPhone !== undefined) updateData.customer_phone = orderData.customerPhone || null
        if (orderData.projectName !== undefined) updateData.project_name = orderData.projectName || null
        if (orderData.productType) updateData.product_type = orderData.productType
        if (orderData.quantity !== undefined) updateData.quantity = orderData.quantity
        if (orderData.orderDate) updateData.order_date = orderData.orderDate
        if (orderData.deliveryDate !== undefined) updateData.delivery_date = orderData.deliveryDate || null
        if (orderData.status) updateData.status = orderData.status
        if (orderData.department) updateData.department = orderData.department
        if (orderData.notes !== undefined) updateData.notes = orderData.notes
        if (orderData.assemblyRequired !== undefined) updateData.assembly_required = orderData.assemblyRequired
        if (orderData.manufacturingSteps !== undefined) updateData.manufacturing_steps = orderData.manufacturingSteps

        const { error: orderError } = await supabase.from("orders").update(updateData).eq("id", orderId)

        if (orderError) {
          console.error("[v0] Error updating order:", orderError)
          throw new Error(`Sipariş güncellenemedi: ${orderError.message}`)
        }

        if (orderData.files !== undefined) {
          await supabase.from("order_files").delete().eq("order_id", orderId)

          if (orderData.files.length > 0) {
            const { error: filesError } = await supabase.from("order_files").insert(
              orderData.files.map((file) => ({
                order_id: orderId,
                name: file.name,
                type: file.type,
                url: file.url,
              })),
            )

            if (filesError) {
              console.error("[v0] Error updating files:", filesError)
              toast.warning("Sipariş güncellendi ancak bazı dosyalar yüklenemedi")
            }
          }
        }

        toast.success("Sipariş güncellendi")
      } catch (error) {
        console.error("[v0] Sipariş güncellenirken hata:", error)
        const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata"
        toast.error("Sipariş güncellenemedi", {
          description: errorMessage,
        })
        throw error
      }
    },
    [supabase],
  )

  const deleteOrder = useCallback(
    async (orderId: string) => {
      try {
        const { error } = await supabase.from("orders").delete().eq("id", orderId)

        if (error) throw error

        toast.success("Sipariş silindi")
      } catch (error) {
        console.error("[v0] Sipariş silinirken hata:", error)
        toast.error("Sipariş silinemedi")
        throw error
      }
    },
    [supabase],
  )

  const updateOrderStatus = useCallback(
    async (
      orderId: string,
      status: OrderStatus,
      statusNotes?: string,
      statusDate?: string,
      manufacturingSteps?: string[],
    ) => {
      try {
        const updateData: any = {
          status,
          status_notes: statusNotes || "",
          status_date: statusDate || null,
        }

        if (manufacturingSteps !== undefined) {
          updateData.manufacturing_steps = manufacturingSteps
        }

        const { error } = await supabase.from("orders").update(updateData).eq("id", orderId)

        if (error) throw error

        toast.success("Sipariş durumu güncellendi")
      } catch (error) {
        console.error("[v0] Durum güncellenirken hata:", error)
        toast.error("Durum güncellenemedi")
        throw error
      }
    },
    [supabase],
  )

  const updatePaintDates = useCallback(
    async (orderId: string, paintSendDate?: Date, paintReturnDate?: Date) => {
      try {
        const updateData: any = {}

        if (paintSendDate !== undefined) {
          updateData.paint_send_date = paintSendDate || null
        }
        if (paintReturnDate !== undefined) {
          updateData.paint_return_date = paintReturnDate || null
        }

        if (paintSendDate) {
          updateData.status = "paint"
        }

        const { error } = await supabase.from("orders").update(updateData).eq("id", orderId)

        if (error) throw error

        toast.success("Boya tarihleri güncellendi")
      } catch (error) {
        console.error("[v0] Boya tarihleri güncellenirken hata:", error)
        toast.error("Boya tarihleri güncellenemedi")
        throw error
      }
    },
    [supabase],
  )

  return (
    <OrdersContext.Provider
      value={{ orders, addOrder, updateOrderStatus, updateOrder, deleteOrder, updatePaintDates, isLoading, error }}
    >
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (context === undefined) {
    throw new Error("useOrders must be used within an OrdersProvider")
  }
  return context
}
