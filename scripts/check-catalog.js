"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const Catalog = require("../js/catalog.js");
const { validate } = require("./validate-data.js");

const root = path.join(__dirname, "..");
const movies = JSON.parse(fs.readFileSync(path.join(root, "data", "movies.json"), "utf8"));
const facets = JSON.parse(fs.readFileSync(path.join(root, "data", "facets.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

const errors = validate(movies, facets);
if (errors.length) {
  console.error(errors.join("\n"));
  throw new Error("seed data failed validation");
}
assert(Array.isArray(movies), "movies array");
assert(movies.length === 1506, "film count");
assert(movies.filter((film) => film.where_to_watch.length > 0).length === 1392, "where to watch count");
assert(movies.filter((film) => film.related_videos.length > 0).length === 177, "bonus film count");
assert(movies.reduce((sum, film) => sum + film.related_videos.length, 0) === 321, "bonus video count");
for (const name of ["biography", "sport", "experimental", "foreign-language"]) {
  assert(facets.genres.includes(name) || facets.tags.includes(name), "facet includes " + name);
}
const fullIndex = Catalog.buildIndex(movies, facets);
assert(fullIndex.people.director.length === Catalog.TOP_PEOPLE, "director menu is capped");
assert(fullIndex.allPeople.director.length > Catalog.TOP_PEOPLE, "all directors stay searchable");
assert(fullIndex.people.director.some((person) => person.name === "Alfred Hitchcock"));
assert(fullIndex.people.composer[0].name === "John Williams");
assert(fullIndex.people.cast.some((person) => person.name === "Clint Eastwood"));
assert(Catalog.searchPeople(fullIndex, "tim burton", 8).some((person) => person.name === "Tim Burton" && person.role === "director"));
assert(!fullIndex.people.director.some((person) => person.count < fullIndex.people.director[fullIndex.people.director.length - 1].count));
const butch = movies.find((film) => film.id === "tt0064115");
assert(butch && /butch cassidy/i.test(butch.title) && butch.related_videos.length >= 1, "Butch Cassidy bonus");
const butchList = Catalog.listRecord(butch);
assert(!Object.prototype.hasOwnProperty.call(butchList, "where_to_watch"), "list record omits watch urls");
assert(butchList.related_videos.length === butch.related_videos.length, "list record keeps bonus videos");
assert(butchList.watch_count === butch.where_to_watch.length);
assert(butchList.duration_seconds === butch.duration_seconds);
assert(butchList.runtime_minutes > 0);
assert(Catalog.detailRecord(butch).where_to_watch.length === butch.where_to_watch.length);
assert(fullIndex.withBonus === 177);
assert(fullIndex.latestChecked === "2026-11-23");
assert(Catalog.minutesOf(butch) === Math.round(butch.duration_seconds / 60) || Catalog.minutesOf(butch) > 0);

const tagSamples = ["silent", "horror", "noir", "public-domain", "black-and-white", "animated", "cult"];
const kindSamples = ["trailer", "interview", "behind-the-scenes", "making-of", "commentary", "featurette", "q-and-a", "retrospective", "score"];
const roleSamples = ["director", "cast", "writer", "composer", "cinematographer", "producer"];
const freeSamples = ["YouTube", "Internet Archive", "Library of Congress"];
for (const name of tagSamples) assert(facets.tags.includes(name), "facets tags include " + name);
for (const name of ["drama", "horror", "documentary", "science-fiction", "film-noir", "western"]) {
  assert(facets.genres.includes(name), "facets genres include " + name);
}
for (const name of ["1920s", "1960s", "1990s", "2020s"]) assert(facets.decades.includes(name), "facets decades include " + name);
assert(JSON.stringify(facets.kinds) === JSON.stringify(kindSamples), "kind facet");
assert(JSON.stringify(facets.kinds) === JSON.stringify(Catalog.KINDS));
assert(JSON.stringify(facets.watch_types) === JSON.stringify(Catalog.WATCH_TYPES));
assert(JSON.stringify(facets.roles) === JSON.stringify(roleSamples));
for (const name of freeSamples) assert(facets.free_providers.includes(name), "free provider " + name);
assert(facets.labels["q-and-a"] === "Q&A");
assert(facets.labels["free-with-ads"] === "Free with ads");
assert(facets.notes.tags["public-domain"].includes("ads"), "public-domain note");
assert(facets.notes.kinds.trailer.includes("trailer") || facets.notes.kinds.trailer.includes("teaser"));

const runtimeFiles = [
  "js/catalog.js",
  "js/view.js",
  "js/embed-boot.js",
  "js/app.js",
  "scripts/validate-data.js",
  "scripts/build-catalog.js",
  "scripts/build-embed.js",
  "scripts/export-csv.js",
  "index.html",
  "embed-demo.html",
  "css/styles.css",
];
for (const file of runtimeFiles) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const sample of ["black-and-white", "public-domain", "science-fiction", "Library of Congress", "Internet Archive"]) {
    assert(!text.includes(sample), file + " hardcodes " + sample);
  }
}
for (const file of ["js/view.js", "js/app.js", "js/embed-boot.js", "index.html", "css/styles.css"]) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const sample of ["behind-the-scenes", "q-and-a", "making-of"]) {
    assert(!text.includes(sample), file + " hardcodes kind " + sample);
  }
}

function film(overrides) {
  const extra = overrides || {};
  const year = Object.prototype.hasOwnProperty.call(extra, "year") ? extra.year : 1994;
  const item = Object.assign({
    id: "example-film",
    title: "Example Film",
    year,
    decade: year ? Catalog.decadeForYear(year) : "unknown",
    runtime_minutes: 100,
    genres: ["drama"],
    tags: [],
    cast: [{ name: "Ada Lovelace", role: "The Lead" }],
    directors: ["Grace Hopper"],
    composers: [],
    writers: [],
    cinematographers: [],
    producers: [],
    country: "United States",
    language: "English",
    imdb_id: "tt1234567",
    wikidata_id: "Q12345",
    description: "An example used by the catalog check.",
    where_to_watch: [],
    related_videos: [],
  }, extra);
  if (!Object.prototype.hasOwnProperty.call(extra, "decade")) {
    item.decade = item.year ? Catalog.decadeForYear(item.year) : "unknown";
  }
  return item;
}

function video(overrides) {
  const extra = overrides || {};
  return Object.assign({
    youtube_id: extra.youtube_id || "bbbbbbbbbbb",
    title: "A trailer",
    channel_name: "Example Channel",
    channel_url: "https://www.youtube.com/@ExampleChannel",
    kind: "trailer",
    people: [],
    year: 1994,
    duration_seconds: 90,
  }, extra);
}

function source(overrides) {
  return Object.assign({
    provider: "Public Library",
    type: "free",
    url: "https://example.org/watch/film",
    region: "worldwide",
    checked_at: "2024-05-01",
  }, overrides || {});
}

assert(validate([film()], facets).length === 0, validate([film()], facets).join("; "));
assert(validate([film({ year: 0, decade: "unknown", genres: ["documentary"], tags: ["short"] })], facets).length === 0, "unknown year");
assert(validate([film({ trailer_youtube_id: "aaaaaaaaaaa" })], facets).some((error) => error.includes("trailer_youtube_id")), "old trailer field");
assert(validate([film(), film()], facets).some((error) => error.includes("duplicate id")), "duplicate id");
const missingTitle = film();
delete missingTitle.title;
assert(validate([missingTitle], facets).some((error) => error.includes("title")), "missing title");
assert(validate([film({ decade: "1980s" })], facets).some((error) => error.includes("decade")), "decade mismatch");
assert(validate([film({ genres: [] })], facets).some((error) => error.includes("genres")), "empty genres");
assert(validate([film({ genres: ["not-a-genre"] })], facets).some((error) => error.includes("genres")), "unknown genre");
assert(validate([film({ tags: ["cult", "cult"] })], facets).some((error) => error.includes("repeats")), "duplicate tag");
assert(validate([film({ cast: [{ name: "Ada Lovelace", role: "A" }, { name: "ada lovelace", role: "B" }] })], facets).some((error) => error.includes("repeats")), "duplicate cast");
assert(validate([film({ youtube_id: "short" })], facets).some((error) => error.includes("youtube_id")), "youtube id");
assert(validate([film({ where_to_watch: [source({ type: "borrow" })] })], facets).some((error) => error.includes("type")), "watch type");
assert(validate([film({ where_to_watch: [source({ checked_at: "2024-02-31" })] })], facets).some((error) => error.includes("checked_at")), "bad date");
assert(validate([film({ related_videos: [video({ kind: "blooper" })] })], facets).some((error) => error.includes("kind")), "unknown kind");
assert(validate([film({
  youtube_id: "aaaaaaaaaaa",
  related_videos: [video({ youtube_id: "aaaaaaaaaaa" })],
})], facets).some((error) => error.includes("repeats the film youtube_id")), "related repeats film");
assert(validate([film({
  related_videos: [video({ youtube_id: "bbbbbbbbbbb" }), video({ youtube_id: "bbbbbbbbbbb", title: "Again" })],
})], facets).some((error) => error.includes("repeats youtube_id")), "duplicate related id");
assert(validate([film({ related_videos: [video({ channel_url: "https://example.com/@ExampleChannel" })] })], facets).some((error) => error.includes("channel_url")), "channel host");
assert(validate([film({ related_videos: [video({ channel_url: "NA" })] })], facets).length === 0, validate([film({ related_videos: [video({ channel_url: "NA" })] })], facets).join("; "));
assert(validate([film({ where_to_watch: [source({ checked_at: "2026-11-23T14:12:49-05:00" })] })], facets).length === 0, "iso checked_at");
const secondsOnly = film({ duration_seconds: 6000 });
delete secondsOnly.runtime_minutes;
assert(validate([secondsOnly], facets).length === 0, "duration_seconds alone");
assert(Catalog.minutesOf(secondsOnly) === 100);
assert(validate(movies, ["drama"]).some((error) => error.includes("object")), "facets shape");

const openFacets = { genres: [], decades: [], tags: [], roles: [], kinds: [], watch_types: [], free_providers: [] };
assert(validate([film({ genres: ["oud"], tags: ["restored-print"], decade: "1990s" })], openFacets).length === 0, "empty facet lists stay open");
const openIndex = Catalog.buildIndex([film({ genres: ["oud"], directors: ["Tim Burton"] })], openFacets);
assert(openIndex.genres.includes("oud"), "genres come from the films when facets are empty");
assert(!openIndex.genres.includes("drama") || openIndex.movies.some((item) => item.genres.includes("drama")), "no extra hardcoded genre");
assert(openIndex.people.director.some((person) => person.name === "Tim Burton"), "roles still index when the facet list is empty");

assert(Catalog.formatDuration(0) === "0:00:00");
assert(Catalog.formatDuration(61) === "0:01:01");
assert(Catalog.formatDuration(7474) === "2:04:34");
assert(Catalog.formatRuntime(45) === "45m");
assert(Catalog.formatRuntime(60) === "1h");
assert(Catalog.formatRuntime(96) === "1h 36m");
assert(Catalog.pageCount(0) === 1);
assert(Catalog.pageCount(12) === 1);
assert(Catalog.pageCount(13) === 2);
assert(Catalog.PER_PAGE === 12);
assert(Catalog.YT_TRAINER_BASE === "https://ytmusictrainer.com/?video_id=");
assert(Catalog.trainerUrl("aaaaaaaaaaa") === "https://ytmusictrainer.com/?video_id=aaaaaaaaaaa");
assert(Catalog.trainerUrl("") === "");
assert(Catalog.youtubeWatchUrl("aaaaaaaaaaa") === "https://www.youtube.com/watch?v=aaaaaaaaaaa");
assert(Catalog.decadeForYear(1994) === "1990s");
assert(Catalog.decadeForYear(0) === "unknown");
assert(Catalog.decadeForYear(2001) === "2000s");
assert(Catalog.labelOf("film-noir") === "Film Noir");
assert(Catalog.fold("José") === "jose");
assert(Catalog.channelUrlOk("https://www.youtube.com/@ExampleChannel"));
assert(Catalog.channelUrlOk("https://www.youtube.com/channel/UC" + "a".repeat(22)));
assert(!Catalog.channelUrlOk("https://example.com/@ExampleChannel"));

const freeProviders = facets.free_providers;
assert(Catalog.watchClass({ provider: "Internet Archive", type: "free" }, freeProviders) === "is-free-source");
assert(Catalog.watchClass({ provider: "Library of Congress", type: "free" }, freeProviders) === "is-free-source");
assert(Catalog.watchClass({ provider: "YouTube Movies", type: "free-with-ads" }, freeProviders) === "is-free-source");
assert(Catalog.watchClass({ provider: "Public Library", type: "free" }, freeProviders) === "is-free");
assert(Catalog.watchClass({ provider: "Public Library", type: "free-with-ads" }, freeProviders) === "is-free");
assert(Catalog.watchClass({ provider: "Netflix", type: "subscription" }, freeProviders) === "is-paid");
assert(Catalog.watchClass({ provider: "Apple TV", type: "rent" }, freeProviders) === "is-paid");
assert(Catalog.watchClass({ provider: "Apple TV", type: "buy" }, freeProviders) === "is-paid");
assert(Catalog.isFreeWatch({ type: "free" }) && Catalog.isFreeWatch({ type: "free-with-ads" }));
assert(!Catalog.isFreeWatch({ type: "subscription" }));

const facetIndex = Catalog.buildIndex([], facets);
assert(JSON.stringify(facetIndex.genres) === JSON.stringify(facets.genres), "genre order follows facets");
assert(JSON.stringify(facetIndex.kinds) === JSON.stringify(facets.kinds), "kind order follows facets");
assert(JSON.stringify(facetIndex.decades) === JSON.stringify(facets.decades));
assert(Catalog.labelFor(facetIndex, "q-and-a") === "Q&A");
assert(Catalog.labelFor(facetIndex, "science-fiction") === "Science fiction");
assert(Catalog.facetNote(facetIndex, "tags", "public-domain").includes("ads"));
assert(Catalog.facetNote(facetIndex, "kinds", "score").length > 0);
assert(Catalog.facetNote(facetIndex, "tags", "All") === "");

const moonlight = film({
  id: "paper-moonlight",
  title: "Paper Moonlight",
  year: 1988,
  runtime_minutes: 92,
  genres: ["fantasy"],
  tags: ["cult"],
  cast: [{ name: "Winona Ryder", role: "Lydia" }],
  directors: ["Tim Burton"],
  composers: ["Danny Elfman"],
  writers: ["Caroline Thompson"],
  cinematographers: ["Stefan Czapsky"],
  producers: ["Denise Di Novi"],
  imdb_id: "tt7654321",
  wikidata_id: "Q7654321",
  description: "A fictional catalog fixture.",
  youtube_id: "aaaaaaaaaaa",
  where_to_watch: [
    source({
      provider: "Internet Archive",
      type: "free",
      url: "https://archive.org/details/example-moonlight",
      region: "worldwide",
      checked_at: "2024-03-02",
    }),
    source({
      provider: "AMC",
      type: "rent",
      url: "https://www.amctheatres.com/example",
      region: "US",
      checked_at: "2024-01-15",
    }),
  ],
  related_videos: [
    video({
      youtube_id: "bbbbbbbbbbb",
      title: "Paper Moonlight trailer",
      kind: "trailer",
      people: ["Tim Burton"],
      year: 1988,
      duration_seconds: 90,
    }),
    video({
      youtube_id: "ccccccccccc",
      title: "A talk about Paper Moonlight",
      kind: "interview",
      people: ["Winona Ryder"],
      year: 1989,
      duration_seconds: 600,
    }),
    video({
      youtube_id: "ddddddddddd",
      title: "Scoring Paper Moonlight",
      kind: "score",
      people: ["Michael Kamen"],
      year: 1988,
      duration_seconds: 300,
    }),
  ],
});
const ocean = film({
  id: "ocean-motif",
  title: "Ocean Motif",
  year: 1975,
  runtime_minutes: 124,
  genres: ["thriller", "drama"],
  tags: [],
  cast: [{ name: "Roy Scheider", role: "Brody" }],
  directors: ["Steven Spielberg"],
  composers: ["John Williams"],
  writers: ["Carl Gottlieb"],
  imdb_id: "tt7654322",
  wikidata_id: "Q7654322",
  description: "Another fixture.",
  where_to_watch: [
    source({
      provider: "Netflix",
      type: "subscription",
      url: "https://www.netflix.com/title/1",
      region: "US",
      checked_at: "2023-11-01",
    }),
  ],
  related_videos: [
    video({
      youtube_id: "eeeeeeeeeee",
      title: "Ocean Motif trailer",
      kind: "trailer",
      people: ["Steven Spielberg"],
      year: 1975,
      duration_seconds: 150,
    }),
  ],
});
const mercy = film({
  id: "dust-and-mercy",
  title: "Dust and Mercy",
  year: 1992,
  runtime_minutes: 131,
  genres: ["western"],
  tags: ["independent"],
  cast: [{ name: "Clint Eastwood", role: "The Stranger" }],
  directors: ["Clint Eastwood"],
  composers: ["Lennie Niehaus"],
  writers: ["David Peoples"],
  imdb_id: "tt7654323",
  wikidata_id: "Q7654323",
  description: "A western fixture.",
  where_to_watch: [
    source({
      provider: "Apple TV",
      type: "buy",
      url: "https://tv.apple.com/us/movie/example",
      region: "US",
      checked_at: "2024-06-01",
    }),
  ],
});
const undated = film({
  id: "hello-world",
  title: 'Hello, "world"',
  year: 0,
  runtime_minutes: 12,
  genres: ["documentary"],
  tags: ["short"],
  cast: [{ name: "José González", role: "Narrator" }],
  directors: ["Ada Lovelace"],
  writers: ["José González"],
  country: "Spain",
  language: "Spanish",
  imdb_id: "tt7654324",
  wikidata_id: "Q7654324",
  description: "Line one\nLine two",
});

const catalogFilms = [moonlight, ocean, mercy, undated];
assert(validate(catalogFilms, facets).length === 0, validate(catalogFilms, facets).join("; "));
const index = Catalog.buildIndex(catalogFilms, facets);

assert(Catalog.playable(moonlight).kind === "film" && Catalog.playable(moonlight).id === "aaaaaaaaaaa");
assert(Catalog.playable(ocean).kind === "trailer" && Catalog.playable(ocean).id === "eeeeeeeeeee");
assert(Catalog.playable(mercy) === null);
assert(Catalog.relatedVideos(moonlight).length === 3);
assert(Catalog.kindsOf(moonlight).join() === "trailer,interview,score");

function idList(list) {
  return list.map((item) => item.id).join();
}
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { query: "tim burton" }, index))) === moonlight.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { query: "john williams" }, index))) === ocean.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { query: "clint eastwood" }, index))) === mercy.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { query: "winona ryder" }, index))) === moonlight.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { query: "michael kamen" }, index))) === moonlight.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { query: "scoring paper moonlight" }, index))) === moonlight.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { query: "ocean motif trailer" }, index))) === ocean.id);
assert(Catalog.matches(undated, { query: "jose gonzalez" }, index), "accent-insensitive people search");
assert(!Catalog.matches(ocean, { query: "tim burton" }, index));
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { genre: "thriller" }, index))) === ocean.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { genre: "drama" }, index))) === ocean.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { decade: "1980s" }, index))) === moonlight.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { tag: "cult" }, index))) === moonlight.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { director: "Tim Burton" }, index))) === moonlight.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { composer: "John Williams" }, index))) === ocean.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { cast: "Clint Eastwood" }, index))) === mercy.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { director: "Clint Eastwood" }, index))) === mercy.id);
assert(catalogFilms.filter((item) => Catalog.matches(item, { bonus: "yes" }, index)).map((item) => item.id).sort().join() === [moonlight.id, ocean.id].sort().join());
assert(catalogFilms.filter((item) => Catalog.matches(item, { bonus: "no" }, index)).map((item) => item.id).sort().join() === [mercy.id, undated.id].sort().join());
assert(catalogFilms.filter((item) => Catalog.matches(item, { kind: "trailer" }, index)).length === 2);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { kind: "interview" }, index))) === moonlight.id);
assert(idList(catalogFilms.filter((item) => Catalog.matches(item, { kind: "score" }, index))) === moonlight.id);
assert(catalogFilms.filter((item) => Catalog.matches(item, { kind: "commentary" }, index)).length === 0);

const byTitle = Catalog.sortFilms(catalogFilms, "title", index).map((item) => item.id);
assert(byTitle[0] === mercy.id && byTitle[byTitle.length - 1] === moonlight.id, "title sort");
const byYear = Catalog.sortFilms(catalogFilms, "year", index);
assert(byYear[0].id === ocean.id && byYear[byYear.length - 1].id === undated.id, "unknown years sort last");
const byGenre = Catalog.sortFilms(catalogFilms, "genre", index).map((item) => item.id);
assert(byGenre.join() === [undated.id, moonlight.id, ocean.id, mercy.id].join(), "genre sort uses the first genre");

const people = Catalog.peopleGroups(catalogFilms, "title", index);
const clint = people.filter((group) => group.label === "Clint Eastwood");
assert(clint.length === 2 && clint.some((group) => group.role === "director") && clint.some((group) => group.role === "cast"), "browse people groups a person under each role");
assert(people.find((group) => group.role === "director" && group.label === "Tim Burton").count === 1);
assert(people.find((group) => group.role === "composer" && group.label === "John Williams").count === 1);
const genreGroups = Catalog.groupFilms([ocean], "genre", "title", { index });
assert(genreGroups.length === 2 && genreGroups.every((group) => group.items[0].id === ocean.id), "a film can sit in each genre");
const decadeGroups = Catalog.groupFilms(catalogFilms, "decade", "year", { index });
assert(!decadeGroups.some((group) => group.items.some((item) => item.year === 0)), "unknown years stay out of the decade view");
assert(index.peopleTotal >= 8, "people are counted");
assert(index.withVideo === 1 && index.withBonus === 2);
assert(index.latestChecked === "2024-06-01");
assert(Catalog.latestCheckedAt(catalogFilms) === "2024-06-01");

const cousin = film({
  id: "cousin-film",
  title: "Cousin",
  year: 1989,
  genres: ["fantasy"],
  directors: ["Tim Burton"],
  imdb_id: "tt7654325",
  wikidata_id: "Q7654325",
});
assert(Catalog.related(moonlight, catalogFilms, 5).length === 0, "unrelated fixtures do not match");
const related = Catalog.related(moonlight, catalogFilms.concat(cousin), 5);
assert(related[0].film.id === cousin.id && related[0].score > 0);
assert(Catalog.relatedReason(related[0], moonlight, index).includes("Tim Burton"));
const appearances = Catalog.appearances("burton", catalogFilms);
assert(appearances.some((person) => person.name === "Tim Burton" && person.places.some((place) => place.includes("Paper Moonlight"))));

global.Catalog = Catalog;
const FinderView = require("../js/view.js");
const cleared = FinderView.clearedFilters(index, { genre: "western", decade: "All", tag: "All", bonus: "All", kind: "All", director: "All" }, "Tim Burton");
assert(cleared.query === "Tim Burton");
assert(cleared.genre === "All", "a name search clears a genre filter that hides the hit");
const kept = FinderView.clearedFilters(index, { genre: "western", bonus: "no" }, "Clint Eastwood");
assert(kept.genre === "western" && kept.bonus === "no");
const preset = FinderView.presets({
  genre: "Science fiction",
  kind: "Q&A",
  decade: "1990s",
  tag: "Public domain",
  bonus: "yes",
  director: "tim burton",
  composer: "Nope",
}, index);
assert(preset.genre === "science-fiction" && preset.kind === "q-and-a" && preset.decade === "1990s");
assert(preset.tag === "public-domain" && preset.bonus === "yes" && preset.director === "Tim Burton");
assert(preset.composer === "All");

function parseCsv(text) {
  assert(text.charCodeAt(0) === 0xFEFF, "csv starts with a UTF-8 BOM");
  const body = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      if (field.endsWith("\r")) field = field.slice(0, -1);
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    if (field.endsWith("\r")) field = field.slice(0, -1);
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.length > 1 || cells[0] !== "");
}

const sheet = parseCsv(Catalog.toCsv(Catalog.sortFilms(catalogFilms, "title", index)));
assert(sheet[0].join(",") === Catalog.CSV_HEADERS.join(","), "csv header");
assert(sheet[0][sheet[0].length - 1] === "related_count");
assert(sheet.length === catalogFilms.length + 1, "one csv row per film");
const countAt = sheet[0].indexOf("related_count");
const idAt = sheet[0].indexOf("id");
function rowFor(id) {
  return sheet.slice(1).find((row) => row[idAt] === id);
}
assert(rowFor(moonlight.id)[countAt] === "3");
assert(rowFor(ocean.id)[countAt] === "1");
assert(rowFor(mercy.id)[countAt] === "0");
assert(rowFor(undated.id)[countAt] === "0");
assert(!sheet.slice(1).some((row) => row[idAt] === "bbbbbbbbbbb"), "related videos are not extra rows");
assert(rowFor(undated.id)[sheet[0].indexOf("title")] === 'Hello, "world"');
assert(rowFor(undated.id)[sheet[0].indexOf("description")] === "Line one\nLine two");
assert(rowFor(undated.id)[sheet[0].indexOf("year")] === "");
assert(rowFor(moonlight.id)[sheet[0].indexOf("year")] === "1988");
assert(rowFor(moonlight.id)[sheet[0].indexOf("youtube_url")] === Catalog.youtubeWatchUrl("aaaaaaaaaaa"));
assert(rowFor(moonlight.id)[sheet[0].indexOf("ytmusictrainer_url")] === Catalog.trainerUrl("aaaaaaaaaaa"));
assert(rowFor(ocean.id)[sheet[0].indexOf("youtube_url")] === "");
assert(rowFor(ocean.id)[sheet[0].indexOf("ytmusictrainer_url")] === "");
assert(rowFor(moonlight.id)[sheet[0].indexOf("directors")] === "Tim Burton");
assert(rowFor(mercy.id)[sheet[0].indexOf("cast")].includes("Clint Eastwood"));
assert(Catalog.toCsv([undated]).includes('"Hello, ""world"""'), "quotes are doubled");

const bonusRows = Catalog.sortFilms(catalogFilms.filter((item) => Catalog.matches(item, { bonus: "yes" }, index)), "title", index);
const bonusSheet = parseCsv(Catalog.toCsv(bonusRows));
assert(bonusSheet.length === bonusRows.length + 1, "filtered csv is one row per film");
const emptySheet = parseCsv(Catalog.toCsv([]));
assert(emptySheet.length === 1 && emptySheet[0][emptySheet[0].length - 1] === "related_count", "empty catalog csv is a header");

const exported = path.join(os.tmpdir(), "mf-catalog-" + process.pid + ".csv");
const exportRun = spawnSync(process.execPath, [path.join(root, "scripts", "export-csv.js"), exported], { encoding: "utf8" });
assert(exportRun.status === 0, exportRun.stderr || "export-csv failed");
assert(fs.readFileSync(exported, "utf8") === Catalog.toCsv(Catalog.sortFilms(movies, "title")), "export script matches the catalog csv");
fs.unlinkSync(exported);

const validateRun = spawnSync(process.execPath, [path.join(root, "scripts", "validate-data.js")], { encoding: "utf8" });
assert(validateRun.status === 0, validateRun.stderr || "validate-data failed");

for (const file of ["index.html", "embed-demo.html", "css/styles.css", "js/app.js", "js/view.js", "js/catalog.js", "js/embed-boot.js", "README.md", "SCHEMA.md"]) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (/(?:href|src|url\()\s*["']?\//.test(text)) throw new Error(file + " has a root-absolute path");
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const ref of ["css/styles.css", "js/catalog.js", "js/view.js", "js/app.js", "favicon.svg", "data/movies.json"]) {
  const bundle = ref.endsWith(".json") ? fs.readFileSync(path.join(root, "js/app.js"), "utf8") : html;
  assert(bundle.includes(ref), "missing " + ref);
}
assert(!html.includes("data/facets.json"));
assert(fs.readFileSync(path.join(root, "js/app.js"), "utf8").includes("data/facets.json"), "the page loads facets when present");
const ids = ["summary", "stats", "theme", "q", "genre", "decade", "tag", "content-type", "director", "cast", "writer", "composer", "cinematographer", "producer", "bonus", "kind", "sort", "status", "facet-note", "results", "discover", "discover-body", "people-heading", "people-count", "people-q", "people-list", "genre-heading", "genre-count", "genre-list", "tag-heading", "tag-count", "tag-list", "availability"];
const shell = FinderView.shellHtml();
for (const id of ids) {
  assert(html.includes('id="' + id + '"'), "page missing " + id);
  assert(shell.includes('id="' + id + '"'), "shell missing " + id);
}
assert(html.includes("Browse people") && shell.includes("Browse people"));
assert(html.includes("Has bonus features") && shell.includes("Has bonus features"));
assert(html.includes("Download this list") && html.includes("Download full spreadsheet") && html.includes("data/catalog.csv"));
assert(shell.includes("Download this list") && shell.includes("Powered by"));
assert(html.includes("Streaming availability changes") && shell.includes("Streaming availability changes"));
function disclosureOrder(markup, label) {
  const discoverAt = markup.indexOf('id="discover"');
  const peopleAt = markup.indexOf('id="people-heading"');
  const genreAt = markup.indexOf('id="genre-heading"');
  const tagAt = markup.indexOf('id="tag-heading"');
  assert(discoverAt > -1 && peopleAt > discoverAt && genreAt > peopleAt && tagAt > genreAt, label + " section order");
  assert(markup.includes('<details class="fold">'), label + " uses a collapsed details element");
  assert(!markup.includes('<details class="fold" open'), label + " starts collapsed");
}
disclosureOrder(html, "site");
disclosureOrder(shell, "embed shell");

const viewSource = fs.readFileSync(path.join(root, "js", "view.js"), "utf8");
assert(viewSource.includes("View on YouTube") && viewSource.includes("Open on YT Trainer"), "video links");
assert(viewSource.includes("Catalog.trainerUrl") && !viewSource.includes("ytmusictrainer.com"), "trainer url stays in catalog.js");
assert(viewSource.includes("youtube-nocookie.com/embed/"), "inline player");
assert(viewSource.includes("Bonus features"), "bonus section");
assert(viewSource.includes('data-action="csv"') && viewSource.includes('data-action="search"') && viewSource.includes("runSearch"));
assert(viewSource.includes('"name-link"'), "names are search links");
assert(viewSource.includes("Catalog.watchClass"), "where-to-watch class comes from the catalog");
const demo = fs.readFileSync(path.join(root, "embed-demo.html"), "utf8");
assert(demo.includes('id="movie-finder"'));
assert(demo.includes("https://mkpworks.github.io/movie-finder/embed.js") && demo.includes("defer"));
assert(demo.includes('src="embed.js"'), "demo runs the local embed");
assert(demo.includes("data-theme") && demo.includes("data-accent") && demo.includes("data-height"));
assert(demo.includes("data-movie-finder") && demo.includes("MovieFinder.mount"));
const boot = fs.readFileSync(path.join(root, "js", "embed-boot.js"), "utf8");
assert(boot.includes("document.currentScript") && boot.includes("data/version.json") && boot.includes("data/catalog.json"), "embed resolves data from its own src");
assert(boot.includes("attachShadow") && boot.includes("[data-movie-finder]") && boot.includes("window.MovieFinder"), "embed contract");
assert(boot.includes('cache: "no-store"'), "version fetch bypasses the pages cache");
assert(boot.includes("data-theme") && boot.includes("data-accent") && boot.includes("data-height"));
assert(boot.includes("data-kind") && boot.includes("data-genre") && boot.includes("options.kind"), "embed presets kind and genre");
assert(boot.includes("data-content-type") && boot.includes("data/film/"), "embed loads per-film details");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
for (const name of ["actions/configure-pages", "actions/upload-pages-artifact", "actions/deploy-pages", "scripts/validate-data.js", "scripts/check-catalog.js", "scripts/build-catalog.js", "scripts/build-embed.js", "embed-demo.html", "workflow_dispatch", "needs: build"]) {
  assert(workflow.includes(name), name);
}
const deployJob = workflow.split(/\n {2}deploy:\n/)[1] || "";
assert(deployJob.length > 0, "deploy job");
assert(!deployJob.includes("actions/upload-pages-artifact"), "deploy job only deploys");
assert(deployJob.includes("pages: write") && deployJob.includes("id-token: write"), "deploy permissions");
assert(workflow.includes("scripts/export-csv.js") && workflow.includes("_site/data/catalog.csv"), "pages build publishes the csv");
assert(/Configure GitHub Pages\n\s+if: github\.event_name != 'pull_request'\n\s+uses: actions\/configure-pages/.test(workflow), "pull requests do not require a Pages site");
assert(workflow.split("\n").filter((line) => line.includes("uses: actions/configure-pages")).length === 1, "configure-pages is declared once");

const built = path.join(os.tmpdir(), "mf-embed-" + process.pid);
fs.mkdirSync(built, { recursive: true });
const catalogBuild = spawnSync(process.execPath, [path.join(root, "scripts", "build-catalog.js"), built], { encoding: "utf8" });
assert(catalogBuild.status === 0, catalogBuild.stderr || "build-catalog failed");
const versionFile = JSON.parse(fs.readFileSync(path.join(built, "version.json"), "utf8"));
const catalogFile = JSON.parse(fs.readFileSync(path.join(built, "catalog.json"), "utf8"));
assert(versionFile.version === "1" && catalogFile.version === "1", "schema version 1");
assert(versionFile.generated_at === catalogFile.generated_at && /^\d{4}-\d{2}-\d{2}T/.test(versionFile.generated_at), "generated_at");
assert(catalogFile.movies.length === movies.length, "catalog.json movies");
assert(catalogFile.facets.kinds.includes("trailer") && catalogFile.facets.genres.includes("drama"), "catalog.json facets");
assert(catalogFile.latest_checked === "2026-11-23", "catalog latest check");
const slimButch = catalogFile.movies.find((film) => film.id === "tt0064115");
assert(slimButch && !slimButch.where_to_watch && slimButch.related_videos.length >= 1, "slim row keeps the bonus video and drops watch urls");
const detail = JSON.parse(fs.readFileSync(path.join(built, "film", "tt0064115.json"), "utf8"));
assert(detail.where_to_watch.length === butch.where_to_watch.length, "detail file keeps every watch offer");
assert(detail.where_to_watch[0].url === butch.where_to_watch[0].url);
const embedOut = path.join(built, "embed.js");
const embedBuild = spawnSync(process.execPath, [path.join(root, "scripts", "build-embed.js"), embedOut], { encoding: "utf8" });
assert(embedBuild.status === 0, embedBuild.stderr || "build-embed failed");
const embedCheck = spawnSync(process.execPath, ["--check", embedOut], { encoding: "utf8" });
assert(embedCheck.status === 0, embedCheck.stderr || "embed.js syntax");
const embedSource = fs.readFileSync(embedOut, "utf8");
for (const needle of ["window.MovieFinder", "attachShadow", "[data-movie-finder]", "data/version.json", "data/catalog.json", "Open on YT Trainer", "youtube-nocookie.com/embed/", "Powered by", "Bonus features", "Browse people", 'id="kind"', 'id="bonus"']) {
  assert(embedSource.includes(needle), "embed bundle missing " + needle);
}

const started = process.hrtime.bigint();
const bench = [];
for (let i = 0; i < 180; i += 1) {
  const year = 1980 + (i % 40);
  bench.push({
    id: "bench-" + i,
    title: "Film " + i,
    year,
    decade: Catalog.decadeForYear(year),
    runtime_minutes: 90 + (i % 30),
    genres: [i % 2 ? "drama" : "horror"],
    tags: i % 3 ? ["cult"] : [],
    cast: [{ name: i % 2 ? "Tim Burton" : "Clint Eastwood", role: "Lead" }],
    directors: [i % 2 ? "Tim Burton" : "John Williams"],
    composers: ["John Williams"],
    writers: [],
    cinematographers: [],
    producers: [],
    description: "Bench film",
    related_videos: i % 4 === 0 ? [{ kind: "trailer", title: "Trailer " + i, people: ["Winona Ryder"], youtube_id: "aaaaaaaaaaa" }] : [],
  });
}
const benchIndex = Catalog.buildIndex(bench, facets);
for (let pass = 0; pass < 40; pass += 1) {
  const filteredRows = Catalog.sortFilms(
    bench.filter((item) => Catalog.matches(item, {
      query: pass % 2 ? "burton" : "film",
      genre: pass % 3 ? "drama" : "All",
      kind: pass % 5 ? "trailer" : "All",
      bonus: pass % 4 ? "yes" : "All",
    }, benchIndex)),
    "title",
    benchIndex
  );
  Catalog.groupFilms(filteredRows, "genre", "year", { index: benchIndex });
  Catalog.peopleGroups(filteredRows, "title", benchIndex);
}
const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
assert(elapsed < 1500, "filtering the catalog took " + elapsed.toFixed(0) + "ms");
console.log("OK: catalog checks passed (" + movies.length + " films, " + facetIndex.genres.length + " genres, " + facetIndex.kinds.length + " kinds, filter pass " + elapsed.toFixed(0) + "ms)");
