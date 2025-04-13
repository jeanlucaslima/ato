import React, { useEffect, useState } from "react"
import { useTabs } from "./hooks/useTabs"
import { useEasterEggs } from "./hooks/useEasterEggs"
import TabItem from "./components/TabItem"
import { Toast } from "./components/Toast"
import SearchBar from "./components/SearchBar"
import "./styles.css"

export default function App() {
  const {
    tabs,
    currentTabId,
    total,
    duplicates,
    handleTabClick,
    handleTabClose,
    handleCloseDuplicates,
    query,
    setQuery,
    isCommand,
  } = useTabs()

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEasterEggs(
    {
      tabs,
      query,
      audioTabCount: tabs.filter((t) => t.audible).length,
    },
    {
      setUIFlag: (key, val) => {
        if (key === "chaos") {
          document.body.classList.toggle("chaos-mode", val)
        }
      },
      showMessage: (msg) => setToastMessage(msg),
    }
  )

  return (
    <div className="app">
      {toastMessage && <Toast message={toastMessage} />}
      <SearchBar query={query} setQuery={setQuery} />

      {!isCommand && (
        <div className="stats-bar">
          Tabs: {total} | Duplicates: {duplicates.length}
          {duplicates.length > 0 && (
            <button onClick={handleCloseDuplicates} className="close-dupes">
              🗑 Close Duplicates
            </button>
          )}
        </div>
      )}

      <div className="tab-list">
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === currentTabId}
            onClick={handleTabClick}
            onClose={handleTabClose}
          />
        ))}
      </div>
    </div>
  )
}
