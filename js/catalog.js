"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Catalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PER_PAGE = 12;
  const TOP_PEOPLE = 24;
  const SCHEMA_VERSION = "1";
  const CONTENT_TYPES = ["full_movie", "short_film"];
  const YT_TRAINER_BASE = "https://ytmusictrainer.com/?video_id=";
  const KINDS = [
    "trailer",
    "interview",
    "behind-the-scenes",
    "making-of",
    "commentary",
    "featurette",
    "q-and-a",
    "retrospective",
    "score",
  ];
  const WATCH_TYPES = ["free", "free-with-ads", "subscription", "rent", "buy"];
  const ROLES = [
    { id: "director", field: "directors", singular: "Director", plural: "Directors" },
    { id: "cast", field: "cast", singular: "Cast", plural: "Cast" },
    { id: "writer", field: "writers", singular: "Writer", plural: "Writers" },
    { id: "composer", field: "composers", singular: "Composer", plural: "Composers" },
    { id: "cinematographer", field: "cinematographers", singular: "Cinematographer", plural: "Cinematographers" },
    { id: "producer", field: "producers", singular: "Producer", plural: "Producers" },
  ];
  const MODES = ["list", "genre", "decade", "tag", "people"];
  const CSV_HEADERS = [
    "id",
    "title",
    "year",
    "decade",
    "content_type",
    "duration_seconds",
    "runtime_minutes",
    "genres",
    "tags",
    "cast",
    "directors",
    "composers",
    "writers",
    "cinematographers",
    "producers",
    "country",
    "language",
    "imdb_id",
    "wikidata_id",
    "description",
    "youtube_id",
    "youtube_url",
    "ytmusictrainer_url",
    "where_to_watch",
    "related_count",
    "oscar_wins",
    "oscar_nominations",
    "award_wins",
    "award_flags",
    "awards",
  ];

  function compareNames(a, b) {
    return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
  }

  function fold(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function isSlug(value) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""));
  }

  function isDecade(value) {
    return /^(18|19|20)\d0s$/.test(String(value || ""));
  }

  function labelOf(value) {
    const text = String(value || "");
    if (!text) return "";
    if (isSlug(text) || isDecade(text)) {
      return text.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
    }
    if (text === text.toLowerCase()) {
      return text.split(" ").map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part)).join(" ");
    }
    return text;
  }

  function labelFor(index, value) {
    const labels = index && index.labels;
    if (labels && labels[value]) return labels[value];
    return labelOf(value);
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function formatRuntime(minutes) {
    const total = Math.max(0, Math.floor(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours && mins) return hours + "h " + mins + "m";
    if (hours) return hours + "h";
    return mins + "m";
  }

  function yearKey(year) {
    return year || 9999;
  }

  function decadeForYear(year) {
    const value = Number(year) || 0;
    if (!value) return "unknown";
    return String(Math.floor(value / 10) * 10) + "s";
  }

  function listOf(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const item of value) {
      if (typeof item !== "string") continue;
      const text = item.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    return out;
  }

  function noteMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out = {};
    for (const key of Object.keys(value)) {
      if (typeof value[key] === "string" && value[key].trim()) out[key] = value[key].trim();
    }
    return out;
  }

  function roleById(id) {
    return ROLES.find((role) => role.id === id) || null;
  }

  // Genre, decade, tag, role, kind, and free-provider lists come from facets.json.
  function normalizeFacets(facets) {
    const source = facets && typeof facets === "object" && !Array.isArray(facets) ? facets : {};
    const notes = source.notes && typeof source.notes === "object" && !Array.isArray(source.notes) ? source.notes : {};
    return {
      genres: listOf(source.genres),
      decades: listOf(source.decades),
      tags: listOf(source.tags),
      roles: listOf(source.roles),
      kinds: listOf(source.kinds),
      content_types: listOf(source.content_types),
      watch_types: listOf(source.watch_types),
      free_providers: listOf(source.free_providers),
      labels: noteMap(source.labels),
      award_flags: listOf(source.award_flags),
      award_ceremonies: ceremoniesOf(source.award_ceremonies),
      notes: {
        genres: noteMap(notes.genres),
        decades: noteMap(notes.decades),
        tags: noteMap(notes.tags),
        kinds: noteMap(notes.kinds),
      },
    };
  }

  function ceremoniesOf(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const slug = typeof entry.slug === "string" ? entry.slug.trim() : "";
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      if (!slug || !name || seen.has(slug)) continue;
      seen.add(slug);
      const short = typeof entry.short === "string" && entry.short.trim() ? entry.short.trim() : name;
      out.push({ slug, name, short, major: Boolean(entry.major) });
    }
    return out;
  }

  function activeRoles(facet) {
    const ids = facet && facet.roles && facet.roles.length ? facet.roles : ROLES.map((role) => role.id);
    const out = [];
    const seen = new Set();
    for (const id of ids) {
      const role = roleById(id);
      if (!role || seen.has(role.id)) continue;
      seen.add(role.id);
      out.push(role);
    }
    return out;
  }

  function orderedUnion(preferred, extra) {
    const out = [];
    const seen = new Set();
    for (const item of preferred) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
    const rest = [];
    for (const item of extra) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      rest.push(item);
    }
    rest.sort(compareNames);
    return out.concat(rest);
  }

  function textOf(film, field) {
    const value = film && film[field];
    return typeof value === "string" ? value.trim() : "";
  }

  function genresOf(film) {
    return listOf(film && film.genres);
  }

  function tagsOf(film) {
    return listOf(film && film.tags);
  }

  function decadeOf(film) {
    return textOf(film, "decade");
  }

  function relatedVideos(film) {
    const list = film && film.related_videos;
    return Array.isArray(list) ? list : [];
  }

  function kindsOf(film) {
    const out = [];
    const seen = new Set();
    for (const video of relatedVideos(film)) {
      const kind = video && typeof video.kind === "string" ? video.kind : "";
      if (!kind || seen.has(kind)) continue;
      seen.add(kind);
      out.push(kind);
    }
    return out;
  }

  function namesFor(film, roleId) {
    if (!film) return [];
    if (roleId === "cast") {
      const cast = Array.isArray(film.cast) ? film.cast : [];
      const out = [];
      const seen = new Set();
      for (const member of cast) {
        const name = member && typeof member.name === "string" ? member.name.trim() : "";
        const key = fold(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(name);
      }
      return out;
    }
    const role = roleById(roleId);
    if (!role) return [];
    return listOf(film[role.field]);
  }

  function allPeople(film) {
    const out = [];
    const seen = new Set();
    function add(name) {
      if (typeof name !== "string") return;
      const text = name.trim();
      const key = fold(text);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(text);
    }
    for (const role of ROLES) {
      for (const name of namesFor(film, role.id)) add(name);
    }
    for (const video of relatedVideos(film)) {
      for (const name of listOf(video && video.people)) add(name);
    }
    return out;
  }

  function trailerOf(film) {
    return relatedVideos(film).find((video) => video && video.kind === "trailer" && video.youtube_id) || null;
  }

  function playable(film) {
    if (film && film.youtube_id) return { id: film.youtube_id, kind: "film", title: textOf(film, "title") };
    const trailer = trailerOf(film);
    if (trailer) return { id: trailer.youtube_id, kind: "trailer", title: textOf(trailer, "title") || textOf(film, "title") };
    return null;
  }

  function trainerUrl(id) {
    if (!id) return "";
    return YT_TRAINER_BASE + encodeURIComponent(id);
  }

  function youtubeWatchUrl(id) {
    if (!id) return "";
    return "https://www.youtube.com/watch?v=" + encodeURIComponent(id);
  }

  function videoIdFromUrl(value) {
    let url;
    try {
      url = new URL(String(value || ""));
    } catch (error) {
      return "";
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (url.pathname === "/watch" || parts[0] === "watch") return url.searchParams.get("v") || "";
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") return parts[1] || "";
    }
    return "";
  }

  function channelUrlOk(value) {
    let url;
    try {
      url = new URL(String(value || ""));
    } catch (error) {
      return false;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "youtube.com" && host !== "m.youtube.com") return false;
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length) return false;
    if (parts[0] === "channel") return /^UC[A-Za-z0-9_-]{22}$/.test(parts[1] || "");
    if (parts[0] === "c" || parts[0] === "user") return Boolean(parts[1]);
    if (parts[0].charAt(0) === "@") return parts[0].length > 1;
    return false;
  }

  function safeHttpUrl(value, fallback) {
    try {
      const url = new URL(String(value || ""));
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch (error) {}
    return fallback == null ? "" : fallback;
  }

  function isFreeWatch(entry) {
    const type = entry && entry.type;
    return type === "free" || type === "free-with-ads";
  }

  function isNamedFreeProvider(entry, freeProviders) {
    const name = fold(entry && entry.provider);
    if (!name) return false;
    for (const provider of freeProviders || []) {
      const needle = fold(provider);
      if (!needle) continue;
      if (name === needle || name.includes(needle)) return true;
    }
    return false;
  }

  function watchClass(entry, freeProviders) {
    if (isNamedFreeProvider(entry, freeProviders)) return "is-free-source";
    if (isFreeWatch(entry)) return "is-free";
    return "is-paid";
  }

  function searchText(film, labels) {
    const parts = [];
    function add(value) {
      if (value == null || value === "") return;
      parts.push(String(value));
    }
    add(film && film.title);
    add(film && film.description);
    add(film && film.country);
    add(film && film.language);
    if (film && film.year) add(film.year);
    add(decadeOf(film));
    for (const genre of genresOf(film)) {
      add(genre);
      add(labelOf(genre));
      if (labels && labels[genre]) add(labels[genre]);
    }
    for (const tag of tagsOf(film)) {
      add(tag);
      add(labelOf(tag));
      if (labels && labels[tag]) add(labels[tag]);
    }
    for (const name of allPeople(film)) add(name);
    const cast = film && Array.isArray(film.cast) ? film.cast : [];
    for (const member of cast) add(member && member.role);
    for (const video of relatedVideos(film)) {
      add(video && video.title);
      add(video && video.channel_name);
      add(video && video.kind);
      add(labelOf(video && video.kind));
      if (labels && video && labels[video.kind]) add(labels[video.kind]);
      if (video && video.year) add(video.year);
      for (const name of listOf(video && video.people)) add(name);
    }
    for (const flag of awardFlagsOf(film)) {
      add(flag);
      add(labelOf(flag));
      if (labels && labels[flag]) add(labels[flag]);
    }
    for (const term of listOf(film && film.award_terms)) add(term);
    for (const award of awardsOf(film)) {
      add(award.ceremony);
      add(award.category);
      add(award.result);
      if (award.year) add(award.year);
      for (const name of listOf(award.recipients)) add(name);
    }
    return fold(parts.join(" "));
  }

  function awardsOf(film) {
    return film && Array.isArray(film.awards) ? film.awards : [];
  }

  function awardFlagsOf(film) {
    return listOf(film && film.award_flags);
  }

  function awardWinsOf(film) {
    return listOf(film && film.award_wins);
  }

  function awardNominationsOf(film) {
    return listOf(film && film.award_nominations);
  }

  function expectsAwards(film) {
    if (!film) return false;
    if (awardsOf(film).length) return true;
    if ((Number(film.oscar_wins) || 0) > 0 || (Number(film.oscar_nominations) || 0) > 0) return true;
    return awardWinsOf(film).length > 0 || awardNominationsOf(film).length > 0 || awardFlagsOf(film).length > 0;
  }

  function awardTerms(film) {
    const out = [];
    const seen = new Set();
    for (const award of awardsOf(film)) {
      for (const part of [award && award.ceremony, award && award.category]) {
        if (typeof part !== "string") continue;
        const text = part.trim();
        const key = fold(text);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(text);
      }
    }
    return out;
  }

  function countValues(items, getValues) {
    const counts = {};
    for (const film of items) {
      const values = getValues(film);
      const seen = new Set(Array.isArray(values) ? values : [values]);
      for (const value of seen) {
        if (!value) continue;
        counts[value] = (counts[value] || 0) + 1;
      }
    }
    return counts;
  }

  function checkedDay(value) {
    if (typeof value !== "string") return "";
    const day = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
  }

  function minutesOf(film) {
    if (film && Number.isInteger(film.runtime_minutes) && film.runtime_minutes > 0) return film.runtime_minutes;
    if (film && Number.isInteger(film.duration_seconds) && film.duration_seconds > 0) {
      return Math.max(1, Math.round(film.duration_seconds / 60));
    }
    return 0;
  }

  function secondsOf(film) {
    if (film && Number.isInteger(film.duration_seconds) && film.duration_seconds > 0) return film.duration_seconds;
    if (film && Number.isInteger(film.runtime_minutes) && film.runtime_minutes > 0) return film.runtime_minutes * 60;
    return 0;
  }

  function bonusCount(film) {
    if (film && Array.isArray(film.related_videos)) return film.related_videos.length;
    return film && Number.isInteger(film.related_count) ? film.related_count : 0;
  }

  function latestCheckedAt(movies) {
    let latest = "";
    for (const film of movies || []) {
      const own = checkedDay(film && film.checked_at);
      if (own > latest) latest = own;
      const entries = film && Array.isArray(film.where_to_watch) ? film.where_to_watch : [];
      for (const entry of entries) {
        const day = checkedDay(entry && entry.checked_at);
        if (day > latest) latest = day;
      }
    }
    return latest;
  }

  // List rows keep credits, bonus videos, and award summaries.
  // Watch URLs and the full awards list live in per-film detail files.
  function listRecord(film) {
    const copy = {};
    const source = film || {};
    for (const key of Object.keys(source)) {
      if (key === "where_to_watch" || key === "awards") continue;
      copy[key] = source[key];
    }
    if (!Number.isInteger(copy.runtime_minutes) && Number.isInteger(source.duration_seconds)) {
      copy.runtime_minutes = Math.max(1, Math.round(source.duration_seconds / 60));
    }
    if (!Number.isInteger(copy.duration_seconds) && Number.isInteger(source.runtime_minutes)) {
      copy.duration_seconds = source.runtime_minutes * 60;
    }
    const terms = awardTerms(source);
    if (terms.length) copy.award_terms = terms;
    else delete copy.award_terms;
    copy.watch_count = Array.isArray(source.where_to_watch) ? source.where_to_watch.length : (Number.isInteger(source.watch_count) ? source.watch_count : 0);
    copy.related_count = bonusCount(source);
    const day = latestCheckedAt([source]);
    if (day) copy.checked_at = day;
    return copy;
  }

  function detailRecord(film) {
    const source = film || {};
    return {
      id: source.id,
      where_to_watch: Array.isArray(source.where_to_watch) ? source.where_to_watch : [],
      awards: awardsOf(source),
    };
  }

  function buildIndex(movies, facets) {
    const items = Array.isArray(movies) ? movies : [];
    const facet = normalizeFacets(facets);
    const roles = activeRoles(facet);
    const labels = facet.labels;
    const people = {};
    for (const role of roles) people[role.id] = new Map();
    for (const film of items) {
      for (const role of roles) {
        const bucket = people[role.id];
        const seen = new Set();
        for (const name of namesFor(film, role.id)) {
          const key = fold(name);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          if (!bucket.has(key)) bucket.set(key, { name, count: 0 });
          bucket.get(key).count += 1;
        }
      }
    }
    const allPeople = {};
    const topPeople = {};
    for (const role of roles) {
      const ranked = [...people[role.id].values()].sort((a, b) => b.count - a.count || compareNames(a.name, b.name));
      allPeople[role.id] = ranked;
      topPeople[role.id] = ranked.slice(0, TOP_PEOPLE);
    }
    const searchTextOf = new Map();
    for (const film of items) searchTextOf.set(film, searchText(film, labels));
    const uniquePeople = new Set();
    for (const role of roles) {
      for (const person of allPeople[role.id]) uniquePeople.add(fold(person.name));
    }
    return {
      movies: items,
      facets: facet,
      notes: facet.notes,
      labels,
      roles,
      freeProviders: facet.free_providers,
      genres: orderedUnion(facet.genres, items.flatMap(genresOf)),
      decades: orderedUnion(facet.decades, items.map(decadeOf).filter((decade) => decade && decade !== "unknown")),
      tags: orderedUnion(facet.tags, items.flatMap(tagsOf)),
      kinds: orderedUnion(facet.kinds.length ? facet.kinds : KINDS, items.flatMap(kindsOf)),
      contentTypes: orderedUnion(facet.content_types.length ? facet.content_types : CONTENT_TYPES, items.map((film) => textOf(film, "content_type"))),
      people: topPeople,
      allPeople,
      peopleTotal: uniquePeople.size,
      genreCount: countValues(items, genresOf),
      decadeCount: countValues(items, (film) => {
        const decade = decadeOf(film);
        return decade && decade !== "unknown" ? decade : "";
      }),
      tagCount: countValues(items, tagsOf),
      kindCount: countValues(items, kindsOf),
      awardFlags: orderedUnion(facet.award_flags, items.flatMap(awardFlagsOf)),
      awardCeremonies: facet.award_ceremonies,
      awardFlagCount: countValues(items, awardFlagsOf),
      awardWinCount: countValues(items, awardWinsOf),
      awardNomCount: countValues(items, awardNominationsOf),
      searchText: searchTextOf,
      latestChecked: latestCheckedAt(items),
      withVideo: items.filter((film) => film && film.youtube_id).length,
      withBonus: items.filter((film) => bonusCount(film) > 0).length,
    };
  }

  function facetNote(index, group, value) {
    if (!index || !value || value === "All") return "";
    const notes = index.notes && index.notes[group];
    return notes && notes[value] ? notes[value] : "";
  }

  function matches(film, filters, index) {
    const source = filters || {};
    const genre = source.genre || "All";
    const decade = source.decade || "All";
    const tag = source.tag || "All";
    const kind = source.kind || "All";
    const bonus = source.bonus || "All";
    const contentType = source.contentType || source.content_type || "All";
    const award = source.award || "All";
    const ceremonies = Array.isArray(source.ceremonies) ? source.ceremonies : [];
    const ceremonyResult = source.ceremonyResult === "nominated" ? "nominated" : "won";
    const query = fold(source.query || "").trim();
    if (genre !== "All" && !genresOf(film).includes(genre)) return false;
    if (decade !== "All" && decadeOf(film) !== decade) return false;
    if (tag !== "All" && !tagsOf(film).includes(tag)) return false;
    if (kind !== "All" && !kindsOf(film).includes(kind)) return false;
    if (contentType !== "All" && textOf(film, "content_type") !== contentType) return false;
    if (bonus === "yes" && bonusCount(film) === 0) return false;
    if (bonus === "no" && bonusCount(film) > 0) return false;
    if (award !== "All" && !awardFlagsOf(film).includes(award)) return false;
    if (ceremonies.length) {
      const held = ceremonyResult === "nominated" ? awardNominationsOf(film) : awardWinsOf(film);
      if (!ceremonies.some((slug) => held.includes(slug))) return false;
    }
    for (const role of ROLES) {
      const selected = source[role.id] || "All";
      if (selected === "All") continue;
      const names = namesFor(film, role.id);
      if (!names.some((name) => fold(name) === fold(selected))) return false;
    }
    if (query) {
      const cached = index && index.searchText && index.searchText.get(film);
      const haystack = cached || searchText(film, index && index.labels);
      if (!haystack.includes(query)) return false;
    }
    return true;
  }

  function primaryGenre(film, index) {
    const genre = genresOf(film)[0] || "";
    return labelFor(index, genre);
  }

  function sortFilms(list, sort, index) {
    const copy = list.slice();
    copy.sort((a, b) => {
      if (sort === "year") {
        return yearKey(a.year) - yearKey(b.year) || compareNames(a.title, b.title);
      }
      if (sort === "genre") {
        return compareNames(primaryGenre(a, index), primaryGenre(b, index)) || compareNames(a.title, b.title) || yearKey(a.year) - yearKey(b.year);
      }
      if (sort === "oscar-wins") {
        return (Number(b.oscar_wins) || 0) - (Number(a.oscar_wins) || 0) ||
          (Number(b.oscar_nominations) || 0) - (Number(a.oscar_nominations) || 0) ||
          compareNames(a.title, b.title);
      }
      if (sort === "oscar-noms") {
        return (Number(b.oscar_nominations) || 0) - (Number(a.oscar_nominations) || 0) ||
          (Number(b.oscar_wins) || 0) - (Number(a.oscar_wins) || 0) ||
          compareNames(a.title, b.title);
      }
      return compareNames(a.title, b.title) || yearKey(a.year) - yearKey(b.year);
    });
    return copy;
  }

  function orderFor(mode, index) {
    if (!index) return [];
    if (mode === "genre") return index.genres;
    if (mode === "decade") return index.decades;
    if (mode === "tag") return index.tags;
    return [];
  }

  function groupKeys(film, mode) {
    if (mode === "genre") return genresOf(film);
    if (mode === "tag") return tagsOf(film);
    if (mode === "decade") {
      const decade = decadeOf(film);
      return decade && decade !== "unknown" ? [decade] : [];
    }
    return [];
  }

  function groupFilms(rows, mode, sort, options) {
    if (mode === "list" || mode === "people") return [];
    const index = options && options.index;
    const map = new Map();
    for (const film of rows) {
      for (const key of new Set(groupKeys(film, mode))) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(film);
      }
    }
    const keys = [...map.keys()];
    keys.sort((a, b) => {
      const left = map.get(a);
      const right = map.get(b);
      if (sort === "year") {
        const leftYear = Math.min(...left.map((film) => yearKey(film.year)));
        const rightYear = Math.min(...right.map((film) => yearKey(film.year)));
        return leftYear - rightYear || compareNames(labelFor(index, a), labelFor(index, b));
      }
      if (sort === "title") {
        return compareNames(labelFor(index, a), labelFor(index, b));
      }
      const order = orderFor(mode, index);
      if (order.length) {
        const leftAt = order.indexOf(a);
        const rightAt = order.indexOf(b);
        const leftRank = leftAt === -1 ? order.length : leftAt;
        const rightRank = rightAt === -1 ? order.length : rightAt;
        return leftRank - rightRank || compareNames(labelFor(index, a), labelFor(index, b));
      }
      return compareNames(labelFor(index, a), labelFor(index, b));
    });
    return keys.map((key) => ({
      key,
      label: labelFor(index, key),
      items: sortFilms(map.get(key), sort, index),
      count: map.get(key).length,
    }));
  }

  function peopleGroups(rows, sort, index) {
    const roles = index && index.roles ? index.roles : ROLES;
    const groups = [];
    for (const role of roles) {
      const bucket = new Map();
      for (const film of rows) {
        const seen = new Set();
        for (const name of namesFor(film, role.id)) {
          const key = fold(name);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          if (!bucket.has(key)) bucket.set(key, { name, films: [] });
          bucket.get(key).films.push(film);
        }
      }
      const people = [...bucket.values()];
      people.sort((a, b) => {
        if (sort === "year") {
          const left = Math.min(...a.films.map((film) => yearKey(film.year)));
          const right = Math.min(...b.films.map((film) => yearKey(film.year)));
          return left - right || compareNames(a.name, b.name);
        }
        if (sort === "genre") {
          return compareNames(primaryGenre(a.films[0], index), primaryGenre(b.films[0], index)) || compareNames(a.name, b.name);
        }
        return compareNames(a.name, b.name);
      });
      for (const person of people) {
        groups.push({
          role: role.id,
          roleLabel: role.singular,
          key: role.id + "\t" + fold(person.name),
          label: person.name,
          items: sortFilms(person.films, sort, index),
          count: person.films.length,
        });
      }
    }
    return groups;
  }

  function related(film, movies, limit) {
    const max = limit || 5;
    const people = new Set(allPeople(film).map(fold));
    const genres = new Set(genresOf(film));
    const tags = new Set(tagsOf(film));
    return (movies || [])
      .filter((other) => other && other.id !== film.id)
      .map((other) => {
        const sharedPeople = allPeople(other).filter((name) => people.has(fold(name)));
        const sharedGenres = genresOf(other).filter((genre) => genres.has(genre));
        const sharedTags = tagsOf(other).filter((tag) => tags.has(tag));
        let score = sharedPeople.length * 4 + sharedGenres.length * 2 + sharedTags.length;
        if (decadeOf(other) && decadeOf(other) === decadeOf(film) && decadeOf(film) !== "unknown") score += 1;
        return { film: other, score, sharedPeople, sharedGenres, sharedTags };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || compareNames(a.film.title, b.film.title))
      .slice(0, max);
  }

  function relatedReason(item, film, index) {
    if (item.sharedPeople.length) return "Shared people: " + item.sharedPeople.slice(0, 3).join(", ");
    if (item.sharedGenres.length) return "Same genre: " + item.sharedGenres.map((genre) => labelFor(index, genre)).join(", ");
    if (item.sharedTags.length) return "Shared tags: " + item.sharedTags.map((tag) => labelFor(index, tag)).join(", ");
    if (decadeOf(item.film) && decadeOf(item.film) === decadeOf(film)) return "Same decade: " + labelFor(index, decadeOf(film));
    return "";
  }

  function appearances(query, films) {
    const needle = fold(query).trim();
    if (needle.length < 2) return [];
    const map = new Map();
    function add(name, place) {
      if (!name || !fold(name).includes(needle)) return;
      if (!map.has(name)) map.set(name, []);
      const places = map.get(name);
      if (place && !places.includes(place)) places.push(place);
    }
    for (const film of films || []) {
      const title = textOf(film, "title");
      for (const role of ROLES) {
        for (const name of namesFor(film, role.id)) add(name, role.singular + " on " + title);
      }
      for (const video of relatedVideos(film)) {
        const kind = labelOf(video && video.kind);
        for (const name of listOf(video && video.people)) add(name, kind + " on " + title);
      }
    }
    return [...map.entries()]
      .map(([name, places]) => ({ name, places }))
      .sort((a, b) => b.places.length - a.places.length || compareNames(a.name, b.name));
  }

  function searchPeople(index, query, limit) {
    const needle = fold(query).trim();
    const max = limit || 40;
    if (!index || needle.length < 2) return [];
    const roles = index.roles && index.roles.length ? index.roles : ROLES;
    const out = [];
    for (const role of roles) {
      const list = index.allPeople && index.allPeople[role.id];
      if (!list) continue;
      for (const person of list) {
        if (!fold(person.name).includes(needle)) continue;
        out.push({ name: person.name, count: person.count, role: role.id, roleLabel: role.singular });
      }
    }
    out.sort((a, b) => b.count - a.count || compareNames(a.name, b.name) || compareNames(a.role, b.role));
    return out.slice(0, max);
  }

  function pageCount(total) {
    return Math.max(1, Math.ceil(total / PER_PAGE));
  }

  function csvField(value) {
    const text = value == null ? "" : String(value);
    if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function joinList(values) {
    return listOf(values).join("; ");
  }

  function castCell(film) {
    const cast = film && Array.isArray(film.cast) ? film.cast : [];
    return cast.map((member) => {
      const name = member && member.name ? member.name : "";
      const role = member && member.role ? member.role : "";
      return role ? name + " (" + role + ")" : name;
    }).filter(Boolean).join("; ");
  }

  function watchCell(film) {
    const entries = film && Array.isArray(film.where_to_watch) ? film.where_to_watch : [];
    return entries.map((entry) => [entry.provider, entry.type, entry.region, entry.checked_at, entry.url].filter(Boolean).join(" · ")).join(" | ");
  }

  function countCell(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : "0";
  }

  function awardsCell(film) {
    return awardsOf(film).map((entry) => {
      const ceremony = entry && entry.ceremony ? entry.ceremony : "";
      const year = entry && entry.year ? " " + entry.year : "";
      const category = entry && entry.category ? entry.category : "";
      const result = entry && entry.result ? entry.result : "";
      const recipients = listOf(entry && entry.recipients);
      const people = recipients.length ? " — " + recipients.join(", ") : "";
      return ceremony + year + ": " + category + " (" + result + ")" + people;
    }).join(" | ");
  }

  function csvRow(film) {
    const youtubeId = textOf(film, "youtube_id");
    const values = [
      textOf(film, "id"),
      textOf(film, "title"),
      film && film.year ? String(film.year) : "",
      decadeOf(film) === "unknown" ? "" : decadeOf(film),
      textOf(film, "content_type"),
      String(secondsOf(film)),
      String(minutesOf(film)),
      joinList(genresOf(film)),
      joinList(tagsOf(film)),
      castCell(film),
      joinList(film && film.directors),
      joinList(film && film.composers),
      joinList(film && film.writers),
      joinList(film && film.cinematographers),
      joinList(film && film.producers),
      textOf(film, "country"),
      textOf(film, "language"),
      textOf(film, "imdb_id"),
      textOf(film, "wikidata_id"),
      textOf(film, "description"),
      youtubeId,
      youtubeWatchUrl(youtubeId),
      trainerUrl(youtubeId),
      watchCell(film),
      String(bonusCount(film)),
      countCell(film && film.oscar_wins),
      countCell(film && film.oscar_nominations),
      joinList(awardWinsOf(film)),
      joinList(awardFlagsOf(film)),
      awardsCell(film),
    ];
    return values.map(csvField).join(",");
  }

  function toCsv(items) {
    const lines = [CSV_HEADERS.join(",")];
    for (const film of items || []) lines.push(csvRow(film));
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
  }

  return {
    PER_PAGE,
    TOP_PEOPLE,
    SCHEMA_VERSION,
    CONTENT_TYPES,
    YT_TRAINER_BASE,
    KINDS,
    WATCH_TYPES,
    ROLES,
    MODES,
    CSV_HEADERS,
    compareNames,
    fold,
    isSlug,
    isDecade,
    labelOf,
    labelFor,
    formatDuration,
    formatRuntime,
    minutesOf,
    secondsOf,
    bonusCount,
    checkedDay,
    awardsOf,
    awardFlagsOf,
    awardWinsOf,
    awardNominationsOf,
    expectsAwards,
    awardTerms,
    listRecord,
    detailRecord,
    searchPeople,
    yearKey,
    decadeForYear,
    normalizeFacets,
    activeRoles,
    genresOf,
    tagsOf,
    decadeOf,
    relatedVideos,
    kindsOf,
    namesFor,
    allPeople,
    trailerOf,
    playable,
    trainerUrl,
    youtubeWatchUrl,
    videoIdFromUrl,
    channelUrlOk,
    safeHttpUrl,
    isFreeWatch,
    isNamedFreeProvider,
    watchClass,
    searchText,
    buildIndex,
    facetNote,
    matches,
    sortFilms,
    groupFilms,
    peopleGroups,
    related,
    relatedReason,
    appearances,
    latestCheckedAt,
    pageCount,
    toCsv,
  };
});
