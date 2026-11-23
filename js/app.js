"use strict";

(function () {
  const status = document.getElementById("status");
  if (typeof Catalog === "undefined" || typeof FinderView === "undefined") {
    if (status) status.textContent = "The page scripts did not load.";
    return;
  }
  const moviesPromise = fetch("data/movies.json").then((res) => {
    if (!res.ok) throw new Error("movies");
    return res.json();
  });
  const facetsPromise = fetch("data/facets.json").then((res) => (res.ok ? res.json() : {})).catch(() => ({}));
  Promise.all([moviesPromise, facetsPromise]).then(([movies, facets]) => {
    FinderView.mount(document, {
      movies,
      facets,
      themeTarget: document.documentElement,
      persistTheme: true,
    });
  }).catch(() => {
    if (status) status.textContent = "Could not load the movie catalog. Serve this folder with a local web server so the JSON can be read.";
  });
})();
