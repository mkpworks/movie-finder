"use strict";

const fs = require("fs");
const path = require("path");
const Catalog = require("../js/catalog.js");

const root = path.join(__dirname, "..");
const outDir = path.resolve(process.argv[2] || path.join(root, "data"));
const movies = JSON.parse(fs.readFileSync(path.join(root, "data", "movies.json"), "utf8"));
const facetPath = path.join(root, "data", "facets.json");
const facets = fs.existsSync(facetPath) ? JSON.parse(fs.readFileSync(facetPath, "utf8")) : {};
const generatedAt = new Date().toISOString();
const list = movies.map(Catalog.listRecord);
const catalog = {
  version: Catalog.SCHEMA_VERSION,
  generated_at: generatedAt,
  latest_checked: Catalog.latestCheckedAt(movies),
  movies: list,
  facets,
};
const version = {
  version: Catalog.SCHEMA_VERSION,
  generated_at: generatedAt,
};
const filmDir = path.join(outDir, "film");

fs.mkdirSync(filmDir, { recursive: true });
let details = 0;
for (const film of movies) {
  const detail = Catalog.detailRecord(film);
  if (!detail.where_to_watch.length) continue;
  fs.writeFileSync(path.join(filmDir, film.id + ".json"), JSON.stringify(detail));
  details += 1;
}
fs.writeFileSync(path.join(outDir, "catalog.json"), JSON.stringify(catalog));
fs.writeFileSync(path.join(outDir, "version.json"), JSON.stringify(version));
console.log("Wrote catalog v" + Catalog.SCHEMA_VERSION + " (" + list.length + " films, " + details + " detail files) to " + outDir);
