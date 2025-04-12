const openedTabs = new Set<number>()

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return

  const tabId = tab.id

  console.log("🧠 Icon clicked")

  chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel/index.html",
    enabled: true
  })

  chrome.sidePanel.open({ tabId })

  setTimeout(() => {
    // Only toggle visibility if this tab already opened the panel before
    if (openedTabs.has(tabId)) {
      console.log("📨 Sending toggle message...")
      chrome.runtime.sendMessage({ type: "toggle-sidepanel" })
    } else {
      console.log("🆕 First open on this tab — skipping toggle")
      openedTabs.add(tabId)
    }

    // Optional: log frustration
    chrome.runtime.sendMessage({
      type: "chrome-api-feedback",
      payload: "This extension would love to close the side panel, but Chrome won't let us. ❤️"
    })
  }, 100)
})
