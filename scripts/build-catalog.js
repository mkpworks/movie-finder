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
const catalog = {
  version: Catalog.SCHEMA_VERSION,
  generated_at: generatedAt,
  movies,
  facets,
};
const version = {
  version: Catalog.SCHEMA_VERSION,
  generated_at: generatedAt,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "catalog.json"), JSON.stringify(catalog));
fs.writeFileSync(path.join(outDir, "version.json"), JSON.stringify(version));
console.log("Wrote catalog v" + Catalog.SCHEMA_VERSION + " (" + movies.length + " films) to " + outDir);
