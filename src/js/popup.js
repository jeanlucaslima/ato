import { renderResults } from "./lib/render.js";
import { searchInput } from "./lib/ui.js";
import { search } from "./lib/search.js";
import { allTabs, allGroups } from "./lib/data.js";

searchInput.addEventListener('input', async () => {
  const query = searchInput.value;

  search(query).then(searchResults => {
    renderResults(searchResults.tabs, searchResults.groups);
  });

});

renderResults(allTabs, allGroups);
