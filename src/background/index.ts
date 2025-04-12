console.log("🔄 ATO background script running")

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return

  // Set options, don't wait
  chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "sidepanel/index.html",
    enabled: true
  })

  // Call open immediately inside gesture context
  chrome.sidePanel.open({ tabId: tab.id })
})
