// src/sidepanel/components/Toast.tsx
import React, { useEffect, useState } from "react"
import "../styles.css"

export function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(timeout)
  }, [])

  if (!visible) return null

  return (
    <div className="toast">
      {message}
    </div>
  )
}
