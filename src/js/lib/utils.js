
const objectToSet = (obj) => {
  const values = Object.values(obj);
  return new Set(values);
}

export { objectToSet };


// How to create a group with tabs that have the respective ids: s648864592,648865600,648865915
// chrome.tabs.group({ tabIds: [648864592,648865600,648865915] }, function (groupId) {
//   if (chrome.runtime.lastError) {
//     console.error(chrome.runtime.lastError.message);
//   } else {
//     console.log(`Group created with ID: ${groupId}`);
//   }
// });


// find and kill duplicate tabs
// chrome.tabs.query({}, function (tabs) {
//   // Create a map to store unique URLs and track duplicates
//   const urlMap = new Map();
//   const duplicateTabIds = [];


//   // Iterate through the tabs
//   tabs.forEach(function (tab) {
//     // Skip tabs without URLs
//     if (tab.url) {
//       // Check if the URL is already in the map (duplicated)
//       if (urlMap.has(tab.url)) {
//         console.log(`Duplicate tab found - URL: ${tab.url}, Tab ID: ${tab.id}`);
//         chrome.tabs.remove(tab.id);
//         console.log(`obliterated tab ${tab.id}`);
//         duplicateTabIds.push(tab.id);
//       } else {
//         // If not a duplicate, add the URL to the map
//         urlMap.set(tab.url, true);
//       }
//     }
//   });
//   console.log(`Found and obliterated ${duplicateTabIds.size? duplicateTabIds.size:"zero"} tabs`)
// });

// Group all youtube tabs (domain grouping)
//const targetDomain = 'www.youtube.com';
//
// Use chrome.tabs.query to get all tabs
// chrome.tabs.query({}, function (tabs) {
//
//   // Filter tabs based on the target domain
//   const tabsToGroup = tabs.filter(tab => {
//     const tabDomain = new URL(tab.url).hostname;
//     return tabDomain === targetDomain;
//   });
//
//   // Extract tab IDs from the filtered tabs
//   const tabIds = tabsToGroup.map(tab => tab.id);
//   // Create a group with the tabs from the same website
//   chrome.tabs.group({ tabIds: tabIds });
// });
