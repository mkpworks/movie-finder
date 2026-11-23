"use strict";

(function () {
  const status = document.getElementById("status");
  if (typeof Catalog === "undefined" || typeof FinderView === "undefined") {
    if (status) status.textContent = "The page scripts did not load.";
    return;
  }

  function mount(movies, facets, detailBase) {
    FinderView.mount(document, {
      movies,
      facets,
      detailBase: detailBase || "",
      themeTarget: document.documentElement,
      persistTheme: true,
    });
  }

  function loadJson(url, options) {
    return fetch(url, options).then((res) => {
      if (!res.ok) throw new Error(url);
      return res.json();
    });
  }

  const versionUrl = "data/version.json?t=" + Date.now();
  loadJson(versionUrl, { cache: "no-store" }).then((version) => {
    const catalogUrl = "data/catalog.json?v=" + encodeURIComponent(version.generated_at || version.version || "1");
    return loadJson(catalogUrl).then((catalog) => {
      if (!catalog || !Array.isArray(catalog.movies)) throw new Error("catalog shape");
      mount(catalog.movies, catalog.facets || {}, "data/film/");
    });
  }).catch(() => {
    const moviesPromise = loadJson("data/movies.json");
    const facetsPromise = loadJson("data/facets.json").catch(() => ({}));
    return Promise.all([moviesPromise, facetsPromise]).then(([movies, facets]) => {
      mount(movies, facets, "");
    });
  }).catch(() => {
    if (status) status.textContent = "Could not load the movie catalog. Serve this folder with a local web server so the JSON can be read.";
  });
})();
