
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
