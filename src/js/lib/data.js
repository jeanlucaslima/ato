const allTabs = await chrome.tabs.query({});
const allGroups = await chrome.tabGroups.query({});

export {allTabs, allGroups};
