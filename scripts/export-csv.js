"use strict";

const fs = require("fs");
const path = require("path");
const Catalog = require("../js/catalog.js");

const root = path.join(__dirname, "..");
const outPath = path.resolve(process.argv[2] || path.join(root, "data", "catalog.csv"));
const movies = JSON.parse(fs.readFileSync(path.join(root, "data", "movies.json"), "utf8"));
const rows = Catalog.sortFilms(movies, "title");
const csv = Catalog.toCsv(rows);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, csv);
console.log("Wrote " + rows.length + " rows to " + outPath);
