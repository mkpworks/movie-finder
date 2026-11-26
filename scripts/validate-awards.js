"use strict";
// Validates the awards fields added in Movie Finder data v2.
// Usage: node scripts/validate-awards.js   (exit 1 on errors)
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const movies = JSON.parse(fs.readFileSync(path.join(root, "data", "movies.json"), "utf8"));
const facets = JSON.parse(fs.readFileSync(path.join(root, "data", "facets.json"), "utf8"));
const ceremonies = new Map((facets.award_ceremonies || []).map((c) => [c.name, c]));
const FLAGS = new Set(facets.award_flags || []);
const NON_COMPETITIVE = /Special Achievement|Special Award|Technical Achievement|Scientific|Honorary/;
const errors = [];
for (const film of movies) {
  const where = film.id;
  if (!Array.isArray(film.awards)) { errors.push(where + " awards must be an array"); continue; }
  const seen = new Set();
  film.awards.forEach((a, i) => {
    const at = where + " awards[" + i + "]";
    if (!ceremonies.has(a.ceremony)) errors.push(at + " unknown ceremony " + a.ceremony);
    if (typeof a.category !== "string" || !a.category.trim()) errors.push(at + " category required");
    if (a.result !== "won" && a.result !== "nominated") errors.push(at + " result must be won|nominated");
    if (a.year !== undefined && !(Number.isInteger(a.year) && a.year >= 1927 && a.year <= 2100)) errors.push(at + " bad year");
    if (a.recipients !== undefined && (!Array.isArray(a.recipients) || a.recipients.some((r) => typeof r !== "string" || !r.trim()))) errors.push(at + " bad recipients");
    const key = JSON.stringify([a.ceremony, a.category, a.year, a.result, a.recipients || []]);
    if (seen.has(key)) errors.push(at + " duplicate");
    seen.add(key);
  });
  const oscar = film.awards.filter((a) => a.ceremony === "Academy Awards" && !NON_COMPETITIVE.test(a.category));
  const wins = oscar.filter((a) => a.result === "won").length;
  if (film.oscar_wins !== wins) errors.push(where + " oscar_wins " + film.oscar_wins + " != " + wins);
  if (film.oscar_nominations !== oscar.length) errors.push(where + " oscar_nominations mismatch");
  const slug = (n) => (ceremonies.get(n) || {}).slug;
  const winSlugs = [...new Set(film.awards.filter((a) => a.result === "won").map((a) => slug(a.ceremony)))];
  const nomSlugs = [...new Set(film.awards.map((a) => slug(a.ceremony)))];
  if (JSON.stringify([...film.award_wins].sort()) !== JSON.stringify(winSlugs.sort())) errors.push(where + " award_wins mismatch");
  if (JSON.stringify([...film.award_nominations].sort()) !== JSON.stringify(nomSlugs.sort())) errors.push(where + " award_nominations mismatch");
  for (const f of film.award_flags) if (!FLAGS.has(f)) errors.push(where + " unknown flag " + f);
  if ((wins > 0) !== film.award_flags.includes("oscar-winner")) errors.push(where + " oscar-winner flag mismatch");
  if ((wins > 0) !== film.tags.includes("oscar-winner")) errors.push(where + " oscar-winner tag mismatch");
}
if (errors.length) { console.error(errors.slice(0, 50).join("\n")); console.error(errors.length + " award errors"); process.exit(1); }
console.log("OK: awards valid on " + movies.length + " films");
