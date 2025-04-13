export async function getAllTabs(): Promise<chrome.tabs.Tab[]> {
  return await chrome.tabs.query({})
}