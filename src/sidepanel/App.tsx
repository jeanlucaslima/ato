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
    chrome.tabs.update(tabId, { active: true }, (updatedTab) => {
      if (updatedTab?.windowId !== undefined) {
        chrome.windows.update(updatedTab.windowId, { focused: true })
      }
    })
  }


  const handleTabClose = (e: React.MouseEvent, tabId: number) => {
    e.stopPropagation() // prevent triggering the tab switch
    chrome.tabs.remove(tabId, () => {
      setTabs((tabs) => tabs.filter((t) => t.id !== tabId))
    })
  }


  return (
    <div>
      <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>Open Tabs</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {tabs.map((tab) => (
          <li
          key={tab.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            padding: "6px 8px",
            borderBottom: "1px solid #ddd",
            cursor: "pointer",
            width: "100%",
            boxSizing: "border-box"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: 1,
              overflow: "hidden"
            }}
            onClick={() => handleTabClick(tab.id!)}
          >
            <img
              src={tab.favIconUrl ?? ""}
              alt="favicon"
              style={{ width: 16, height: 16, flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: "14px",
                color: "#333",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block"
              }}
            >
              {tab.title}
            </span>
          </div>
          <button
            onClick={(e) => handleTabClose(e, tab.id!)}
            style={{
              background: "none",
              border: "none",
              fontSize: "14px",
              color: "#999",
              cursor: "pointer",
              flexShrink: 0,
              marginLeft: "4px"
            }}
            title="Close tab"
          >
            ❌
          </button>
        </li>

        ))}
      </ul>
    </div>
  )
}
