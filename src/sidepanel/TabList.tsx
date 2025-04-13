import React from "react"
import TabItem from "./TabItem"

export default function TabList({ tabs, currentTabId, onTabClick, onTabClose }) {
  return (
    <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
      {tabs.map(tab => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === currentTabId}
          onClick={() => onTabClick(tab.id!)}
          onClose={(e) => onTabClose(e, tab.id!)}
        />
      ))}
    </ul>
  )
}
