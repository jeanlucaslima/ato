import React from "react"
import { useTabs } from "./hooks/useTabs"
import TabList from "./TabList"
import "./styles.css"
import StatsBar from "./StatsBar"
import { getDuplicateTabs } from "../lib/tabs"
import SearchBar from "./SearchBar"

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
    setQuery
  } = useTabs()

  return (
    <div className="ato-container">
      <SearchBar value={query} onChange={setQuery} />
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
