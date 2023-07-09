import { groupTabsButton } from "./ui.js";
import Fuse from "./fuse.esm.js";

const fuseOptions = {
  // isCaseSensitive: false,
  // includeScore: false,
  // shouldSort: true,
  includeMatches: false,
  // Nice to use for highlight
  findAllMatches: true,
  // minMatchCharLength: 1,
  // location: 0,
  threshold: 0.4,
  // default value is 0.6, the higher, the more laxed the search will be
  // distance: 100,
  useExtendedSearch: true,
  // White space acts as an AND operator, while a single pipe (|) character acts as an OR operator.
  // To escape white space, use double quote ex. ="scheme language" for exact match.
  // Check Fuse documentation for more

  keys: [
    "title",
    "url"
  ]
};

const search = async (query) => {
  const tabResults = new Set();
  const groupResults = new Set();

  const queryTabs = await chrome.tabs.query({});
  const queryGroups = await chrome.tabGroups.query({});

  const fuseTab = new Fuse(queryTabs, fuseOptions);
  const result = fuseTab.search(query);

  console.log("fuse results: ");
  console.log(result);

  queryTabs.forEach(tab => {
    const title = tab.title.toLowerCase();
    const url = tab.url.toLowerCase();

    if(title.includes(query) || url.includes(query)) {
      tabResults.add(tab);
    }
  });

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

  if (tabResults.size) {
    const tabIds = Array.from(tabResults, tab => tab.id);

    groupTabsButton.addEventListener('click', async () => {
      const group = await chrome.tabs.group({ tabIds });
    });

  }

  return searchResults;
};

export { search };
