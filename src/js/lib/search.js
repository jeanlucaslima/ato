const search = async (query) => {
  const tabResults = new Set();
  const groupResults = new Set();

  const queryTabs = await chrome.tabs.query({});

  queryTabs.forEach(tab => {
    const title = tab.title.toLowerCase();
    const url = tab.title.toLowerCase();

    if(title.includes(query) || url.includes(query)) {
      tabResults.add(tab);
    }
  });

  const queryGroups = await chrome.tabGroups.query({});

  queryGroups.forEach(group => {
    const title = group.title.toLowerCase();

    if(title.includes(query)) {
      groupResults.add(group);
    }
  });

  const searchResults = {
    tabs: tabResults,
    groups: groupResults
  };

  return searchResults;
};

export { search };
