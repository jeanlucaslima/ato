import { useEffect, useState } from "react"
import { getDuplicateTabs } from "../../lib/tabs"
import Fuse from "fuse.js"

type UseTabsResult = {
  tabs: chrome.tabs.Tab[]
  currentTabId: number | null
  total: number
  duplicates: chrome.tabs.Tab[]
  handleTabClick: (tabId: number) => void
  handleTabClose: (e: React.MouseEvent, tabId: number) => void
  handleCloseDuplicates: () => void
  query: string
  setQuery: (q: string) => void
}

export function useTabs(): UseTabsResult {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([])
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)
  const [query, setQuery] = useState("")

  const duplicates = getDuplicateTabs(tabs)
  const total = tabs.length

  const fuse = new Fuse(tabs, {
    keys: [
      { name: "title", weight: 0.7 },
      { name: "url", weight: 0.3 }
    ],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true
  })

  const filteredTabs = query.trim()
    ? fuse.search(query).map(result => result.item)
    : tabs

  const handleTabClick = (tabId: number) => {
    chrome.tabs.update(tabId, { active: true }, (tab) => {
      if (tab?.windowId !== undefined) {
        chrome.windows.update(tab.windowId, { focused: true })
      }
    })
  }

  const handleTabClose = (e: React.MouseEvent, tabId: number) => {
    e.stopPropagation()
    chrome.tabs.remove(tabId, () => {
      setTabs((prev) => prev.filter((t) => t.id !== tabId))
    })
  }

  const handleCloseDuplicates = () => {
    duplicates.forEach((tab) => {
      if (tab.id) chrome.tabs.remove(tab.id)
    })
    setTabs((prev) =>
      prev.filter((tab) => !duplicates.some((d) => d.id === tab.id))
    )
  }

  useEffect(() => {
    const updateTabs = () => {
      chrome.tabs.query({}, (found) => setTabs(found))
    }

    updateTabs()
    chrome.tabs.query({ active: true, currentWindow: true }, (active) => {
      if (active[0]?.id) setCurrentTabId(active[0].id)
    })

    // Listen for tab events
    chrome.tabs.onCreated.addListener(updateTabs)
    chrome.tabs.onRemoved.addListener(updateTabs)
    chrome.tabs.onUpdated.addListener(updateTabs)
    chrome.tabs.onMoved.addListener(updateTabs)
    chrome.tabs.onDetached.addListener(updateTabs)
    chrome.tabs.onAttached.addListener(updateTabs)

    return () => {
      chrome.tabs.onCreated.removeListener(updateTabs)
      chrome.tabs.onRemoved.removeListener(updateTabs)
      chrome.tabs.onUpdated.removeListener(updateTabs)
      chrome.tabs.onMoved.removeListener(updateTabs)
      chrome.tabs.onDetached.removeListener(updateTabs)
      chrome.tabs.onAttached.removeListener(updateTabs)
    }
  }, [])

  return {
    tabs: filteredTabs,
    currentTabId,
    total,
    duplicates,
    handleTabClick,
    handleTabClose,
    handleCloseDuplicates,
    query,
    setQuery,
  }
}
