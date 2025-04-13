import React from "react"
import { useTabs } from "./hooks/useTabs"
import TabList from "./TabList"
import "./styles.css"
import StatsBar from "./StatsBar"
import { getDuplicateTabs } from "../lib/tabs"


export default function App() {
  const {
    tabs,
    currentTabId,
    total,
    duplicates,
    handleTabClick,
    handleTabClose,
    handleCloseDuplicates,
  } = useTabs()

  return (
    <div className="ato-container">
      <h2 className="ato-heading">Open Tabs</h2>
      <StatsBar
        total={total}
        duplicates={duplicates.length}
        onCloseDuplicates={handleCloseDuplicates}
      />
      <TabList
        tabs={tabs}
        currentTabId={currentTabId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
      />
    </div>
  )
}
