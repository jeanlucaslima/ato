import Fuse from "./fuse.esm.js";

const fuseTabOptions = {
  includeMatches: false,
  findAllMatches: true,
  threshold: 0.4,
  useExtendedSearch: true,
  keys: [
    "title",
    "url"
  ]
};

const fuseGroupOptions = {
  includeMatches: false,
  findAllMatches: true,
  threshold: 0.4,
  useExtendedSearch: true,
  keys: [ "title" ]
};

const search = async (query) => {
  const queryTabs = await chrome.tabs.query({});
  const queryGroups = await chrome.tabGroups.query({});

  const searchTabs = new Fuse(queryTabs, fuseTabOptions);
  const searchGroups = new Fuse(queryGroups, fuseGroupOptions);
  const tabResults = searchTabs.search(query);
  const groupResults = searchGroups.search(query);

  const searchResults = {
    tabs: tabResults,
    groups: groupResults
  };

  console.log(searchResults);

  return searchResults;
};

export { search };
