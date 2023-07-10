import { initialRender, renderResults } from "./lib/render.js";
import { searchInput } from "./lib/ui.js";
import { search } from "./lib/search.js";

searchInput.addEventListener('input', async () => {
  const query = searchInput.value;

  search(query).then(searchResults => {
    renderResults(searchResults);
  });

});

initialRender();
