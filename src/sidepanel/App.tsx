import React from "react"
import { useTabs } from "./hooks/useTabs"
import TabList from "./TabList"
import "./styles.css"
import StatsBar from "./StatsBar"
import { getDuplicateTabs } from "../lib/tabs"
import SearchBar from "./SearchBar"
import { useEasterEggs } from "./hooks/useEasterEggs"


export default function App() {
  const {
    tabs,
    currentTabId,
    isCommand,
    total,
    duplicates,
    handleTabClick,
    handleTabClose,
    handleCloseDuplicates,
    query,
    setQuery
  } = useTabs()

  // 👇 Call easter eggs hook
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
      showMessage: (msg) => {
        // Replace this with a toast/banner component later
        console.log("🐣", msg)
      },
    }
  )

  return (
    <div className="ato-container">
      <SearchBar value={query} onChange={setQuery} />
      {!isCommand && (
        <StatsBar
          total={total}
          duplicates={duplicates.length}
          onCloseDuplicates={handleCloseDuplicates}
        />
      )}
      <TabList
        tabs={tabs}
        currentTabId={currentTabId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
      />
    </div>
  )
}
