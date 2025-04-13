export async function getAllTabs(): Promise<chrome.tabs.Tab[]> {
  return await chrome.tabs.query({})
}

export function getDuplicateTabs(tabs: chrome.tabs.Tab[]) {
  const seen = new Map<string, chrome.tabs.Tab[]>()

  for (const tab of tabs) {
    const url = tab.url ?? "unknown"
    if (!seen.has(url)) {
      seen.set(url, [])
    }
    seen.get(url)!.push(tab)
  }

  return Array.from(seen.values()).flatMap(group =>
    group.length > 1 ? group.slice(1) : []
  )
}
