import { useEffect, useState } from "react"

export function useTabs() {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([])
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)

  useEffect(() => {
    chrome.tabs.query({}, (found) => setTabs(found))
    chrome.tabs.query({ active: true, currentWindow: true }, (active) => {
      if (active[0]?.id) setCurrentTabId(active[0].id)
    })
  }, [])

  const handleTabClick = (tabId: number) => {
    chrome.tabs.update(tabId, { active: true }, (tab) => {
      if (tab?.windowId) chrome.windows.update(tab.windowId, { focused: true })
    })
  }

  const handleTabClose = (e: React.MouseEvent, tabId: number) => {
    e.stopPropagation()
    chrome.tabs.remove(tabId, () => {
      setTabs((prev) => prev.filter((t) => t.id !== tabId))
    })
  }

  return { tabs, currentTabId, handleTabClick, handleTabClose }
}
