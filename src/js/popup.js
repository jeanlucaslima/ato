import { renderResults } from "./lib/render.js";
import { searchInput } from "./lib/ui.js";
import { search } from "./lib/search.js";
import { allTabs, allGroups } from "./lib/data.js";

searchInput.addEventListener('input', async () => {
  const query = searchInput.value.toLowerCase();

  search(query).then(searchResults => {
    console.log(searchResults);
    console.log(searchResults.tabs.size + " tabs found");
    console.log(searchResults.groups.size + " groups found");
    renderResults(searchResults.tabs, searchResults.tabs.size, searchResults.groups, searchResults.groups.size);
  });

});

renderResults(allTabs, allTabs.length, allGroups, allGroups.length);
