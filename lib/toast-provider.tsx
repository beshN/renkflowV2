"use client"

import { Toaster } from "sonner"

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: {
          background: "#000000",
          color: "#ffffff",
          border: "1px solid #333333",
          borderRadius: "12px",
          padding: "16px 20px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3)",
          fontSize: "16px",
          minHeight: "56px",
        },
        className: "toast",
        duration: 3000,
      }}
      richColors
      expand={false}
      closeButton
    />
  )
}
