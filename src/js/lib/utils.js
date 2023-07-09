
const objectToSet = (obj) => {
  const values = Object.values(obj);
  return new Set(values);
}

// const addTabsToGroup = (tabIds, groupId = '', title = '') => {};
//
// const changeTabGroup = (tabIds) => {};

export { objectToSet };
