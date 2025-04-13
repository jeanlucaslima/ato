import React from "react"
import { useTabs } from "./hooks/useTabs"
import TabList from "./TabList"
import "./styles.css"

export default function App() {
  const { tabs, currentTabId, handleTabClick, handleTabClose } = useTabs()

  return (
    <div className="ato-container">
      <h2 className="ato-heading">Open Tabs</h2>
      <TabList
        tabs={tabs}
        currentTabId={currentTabId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
      />
    </div>
  )
}
