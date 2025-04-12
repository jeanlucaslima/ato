import React, { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"

function Root() {
  const [visible, setVisible] = useState(true)
  const hasMounted = useRef(false)

  useEffect(() => {
    console.log("🪞 Side panel mounted")
    hasMounted.current = true

    const listener = (msg: any) => {
      if (msg?.type === "toggle-sidepanel") {
        if (hasMounted.current) {
          console.log("🔁 Toggling visibility")
          setVisible((v) => !v)
        }
      }

      if (msg?.type === "chrome-api-feedback") {
        console.info("📣 Feedback:", msg.payload)
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  return (
    <div
      className={`transition-opacity duration-200 ease-in-out ${
        visible ? "opacity-100" : "opacity-50"
      }`}
    >
      {visible ? (
        <App />
      ) : (
        <div className="p-4 text-center text-sm text-gray-400 italic">
          👋 Panel hidden — click the ATO icon again to show it.
        </div>
      )}
    </div>
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<Root />)
