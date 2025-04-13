import React, { useEffect, useState } from "react"
import { getAllTabs } from "../lib/tabs"

type TabData = Pick<chrome.tabs.Tab, "id" | "title" | "favIconUrl" | "url">

export default function App() {
  const [tabs, setTabs] = useState<TabData[]>([])

  useEffect(() => {
    getAllTabs().then((tabs) => {
      const filtered = tabs.filter((t): t is TabData => !!t.id && !!t.title)
      setTabs(filtered)
    })
  }, [])

  const handleTabClick = (tabId: number) => {
    chrome.tabs.update(tabId, { active: true })
  }

  return (
    <div>
      <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>Open Tabs</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {tabs.map((tab) => (
          <li
            key={tab.id}
            onClick={() => handleTabClick(tab.id!)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 8px",
              borderBottom: "1px solid #ddd",
              cursor: "pointer"
            }}
          >
            <img
              src={tab.favIconUrl ?? "https://www.google.com/s2/favicons?domain=chrome.com"}
              alt="favicon"
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: "14px", color: "#333" }}>
              {tab.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
