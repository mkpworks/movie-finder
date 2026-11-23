"use strict";

const fs = require("fs");
const path = require("path");
const Catalog = require("../js/catalog.js");

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const IMDB_RE = /^tt\d{7,}$/;
const CONTENT_TYPES = ["full_movie", "short_film"];
const WIKIDATA_RE = /^Q[1-9]\d*$/;
const SLUG_MAX = 80;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, max) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text !== value || text.length > max) return false;
  if (/[\u0000-\u001f]/.test(text)) return false;
  return true;
}

function cleanDescription(value) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text !== value || text.length > 5000) return false;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return false;
  return true;
}

function allowed(value, list) {
  if (list && list.length) return list.includes(value);
  return typeof value === "string" && value.length > 0;
}

function validDate(value) {
  if (typeof value !== "string") return false;
  const dayText = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayText)) return false;
  if (value.length > 10 && !/^T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.slice(10))) return false;
  const year = Number(dayText.slice(0, 4));
  const month = Number(dayText.slice(5, 7));
  const day = Number(dayText.slice(8, 10));
  if (year < 1970 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function httpUrlOk(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return Boolean(url.hostname && url.hostname.includes("."));
  } catch (error) {
    return false;
  }
}

function validateNameList(value, where, errors) {
  if (!Array.isArray(value)) {
    errors.push(where + " must be an array");
    return;
  }
  const seen = new Set();
  value.forEach((name, nameIndex) => {
    if (!cleanText(name, 120)) {
      errors.push(where + "[" + nameIndex + "] must be a non-empty name");
      return;
    }
    const key = Catalog.fold(name);
    if (seen.has(key)) errors.push(where + " repeats " + name);
    seen.add(key);
  });
}

function validateFacets(facets) {
  const errors = [];
  if (facets === undefined) return errors;
  if (!isPlainObject(facets)) {
    errors.push("facets must be an object");
    return errors;
  }
  const slugLists = ["genres", "tags", "roles", "kinds", "content_types"];
  for (const key of slugLists) {
    if (facets[key] === undefined) continue;
    if (!Array.isArray(facets[key])) {
      errors.push("facets." + key + " must be an array");
      continue;
    }
    const seen = new Set();
    facets[key].forEach((entry, index) => {
      const where = "facets." + key + "[" + index + "]";
      const slugOk = key === "content_types" ? CONTENT_TYPES.includes(entry) : Catalog.isSlug(entry);
      if (typeof entry !== "string" || !slugOk) {
        errors.push(where + " must be a lowercase slug");
        return;
      }
      if (seen.has(entry)) errors.push(where + " repeats " + entry);
      seen.add(entry);
      if (key === "roles" && !Catalog.ROLES.some((role) => role.id === entry)) {
        errors.push(where + " must be a known crew role");
      }
      if (key === "kinds" && !Catalog.KINDS.includes(entry)) {
        errors.push(where + " must be a known bonus kind");
      }
      if (key === "content_types" && !CONTENT_TYPES.includes(entry)) {
        errors.push(where + " must be full_movie or short_film");
      }
    });
  }
  if (facets.decades !== undefined) {
    if (!Array.isArray(facets.decades)) {
      errors.push("facets.decades must be an array");
    } else {
      const seen = new Set();
      facets.decades.forEach((entry, index) => {
        if (typeof entry !== "string" || !Catalog.isDecade(entry)) {
          errors.push("facets.decades[" + index + "] must be a decade such as 1990s");
          return;
        }
        if (seen.has(entry)) errors.push("facets.decades repeats " + entry);
        seen.add(entry);
      });
    }
  }
  if (facets.watch_types !== undefined) {
    if (!Array.isArray(facets.watch_types)) {
      errors.push("facets.watch_types must be an array");
    } else {
      const seen = new Set();
      facets.watch_types.forEach((entry, index) => {
        if (!Catalog.WATCH_TYPES.includes(entry)) {
          errors.push("facets.watch_types[" + index + "] must be a known watch type");
          return;
        }
        if (seen.has(entry)) errors.push("facets.watch_types repeats " + entry);
        seen.add(entry);
      });
    }
  }
  if (facets.free_providers !== undefined) {
    if (!Array.isArray(facets.free_providers)) {
      errors.push("facets.free_providers must be an array");
    } else {
      const seen = new Set();
      facets.free_providers.forEach((entry, index) => {
        if (!cleanText(entry, 80)) {
          errors.push("facets.free_providers[" + index + "] must be a provider name");
          return;
        }
        const key = Catalog.fold(entry);
        if (seen.has(key)) errors.push("facets.free_providers repeats " + entry);
        seen.add(key);
      });
    }
  }
  if (facets.labels !== undefined) {
    if (!isPlainObject(facets.labels)) {
      errors.push("facets.labels must be an object");
    } else {
      for (const key of Object.keys(facets.labels)) {
        if (!cleanText(key, 80) || !cleanText(facets.labels[key], 80)) {
          errors.push("facets.labels." + key + " must be a short label");
        }
      }
    }
  }
  if (facets.notes !== undefined) {
    if (!isPlainObject(facets.notes)) {
      errors.push("facets.notes must be an object");
    } else {
      for (const group of ["genres", "decades", "tags", "kinds"]) {
        if (facets.notes[group] === undefined) continue;
        if (!isPlainObject(facets.notes[group])) {
          errors.push("facets.notes." + group + " must be an object");
          continue;
        }
        const known = new Set(Array.isArray(facets[group]) ? facets[group] : []);
        for (const key of Object.keys(facets.notes[group])) {
          const note = facets.notes[group][key];
          if (typeof note !== "string" || !note.trim() || note.length > 400) {
            errors.push("facets.notes." + group + "." + key + " must be a short note");
          }
          if (known.size && !known.has(key)) {
            errors.push("facets.notes." + group + "." + key + " is not in facets." + group);
          }
        }
      }
    }
  }
  return errors;
}

function validateWatch(entry, where, facet, errors) {
  if (!isPlainObject(entry)) {
    errors.push(where + " must be an object");
    return;
  }
  if (!cleanText(entry.provider, 80)) errors.push(where + " provider is required");
  if (!Catalog.WATCH_TYPES.includes(entry.type)) {
    errors.push(where + " type must be free, free-with-ads, subscription, rent, or buy");
  } else if (facet.watch_types.length && !facet.watch_types.includes(entry.type)) {
    errors.push(where + " type must be listed in facets.watch_types");
  }
  if (!httpUrlOk(entry.url)) errors.push(where + " url must be an http(s) URL");
  if (!cleanText(entry.region, 40)) errors.push(where + " region is required");
  if (!validDate(entry.checked_at)) errors.push(where + " checked_at must be a YYYY-MM-DD date");
}

function validateRelated(entry, where, facet, errors) {
  if (!isPlainObject(entry)) {
    errors.push(where + " must be an object");
    return;
  }
  if (typeof entry.youtube_id !== "string" || !YOUTUBE_ID_RE.test(entry.youtube_id)) {
    errors.push(where + " youtube_id must be an 11-character YouTube id");
  }
  if (!cleanText(entry.title, 300)) errors.push(where + " title is required");
  if (!cleanText(entry.channel_name, 200)) errors.push(where + " channel_name is required");
  if (!cleanText(entry.channel_url, 300)) {
    errors.push(where + " channel_url is required");
  } else if (/^https?:\/\//.test(entry.channel_url) && !Catalog.channelUrlOk(entry.channel_url)) {
    errors.push(where + " channel_url must be a YouTube channel URL");
  }
  if (!Catalog.KINDS.includes(entry.kind)) {
    errors.push(where + " kind must be a bonus kind");
  } else if (facet.kinds.length && !facet.kinds.includes(entry.kind)) {
    errors.push(where + " kind must be listed in facets.kinds");
  }
  if (!Array.isArray(entry.people)) {
    errors.push(where + " people must be an array");
  } else {
    validateNameList(entry.people, where + " people", errors);
  }
  if (!Number.isInteger(entry.year) || entry.year < 0 || (entry.year !== 0 && (entry.year < 1888 || entry.year > 2099))) {
    errors.push(where + " year must be a whole number (0 if unknown)");
  }
  if (!Number.isInteger(entry.duration_seconds) || entry.duration_seconds <= 0 || entry.duration_seconds > 86400) {
    errors.push(where + " duration_seconds must be a positive whole number");
  }
}

function validate(movies, facets) {
  const errors = [];
  if (!Array.isArray(movies)) {
    errors.push("movies must be an array");
    return errors;
  }
  errors.push(...validateFacets(facets || {}));
  const facet = Catalog.normalizeFacets(facets || {});
  const seenIds = new Set();
  const seenImdb = new Set();
  const seenWikidata = new Set();
  const seenYoutube = new Set();
  movies.forEach((film, index) => {
    const where = "movies[" + index + "]";
    if (!isPlainObject(film)) {
      errors.push(where + " must be an object");
      return;
    }
    if (typeof film.id !== "string" || !Catalog.isSlug(film.id) || film.id.length > SLUG_MAX) {
      errors.push(where + " id must be a lowercase slug");
    } else if (seenIds.has(film.id)) {
      errors.push("duplicate id " + film.id);
    } else {
      seenIds.add(film.id);
    }
    if (!cleanText(film.title, 300)) errors.push(where + " title is required");
    if (!Number.isInteger(film.year) || film.year < 0 || (film.year !== 0 && (film.year < 1880 || film.year > 2100))) {
      errors.push(where + " year must be a whole number from 1880 through 2100, or 0 if unknown");
    } else if (film.year === 0) {
      if (film.decade !== "unknown") errors.push(where + " decade must be unknown when year is 0");
    } else if (film.decade !== Catalog.decadeForYear(film.year)) {
      errors.push(where + " decade must be " + Catalog.decadeForYear(film.year));
    } else if (facet.decades.length && !facet.decades.includes(film.decade)) {
      errors.push(where + " decade must be listed in facets.decades");
    }
    const hasSeconds = Number.isInteger(film.duration_seconds) && film.duration_seconds > 0 && film.duration_seconds <= 200000;
    const hasMinutes = Number.isInteger(film.runtime_minutes) && film.runtime_minutes > 0 && film.runtime_minutes <= 4000;
    if (!hasSeconds && !hasMinutes) {
      errors.push(where + " duration_seconds or runtime_minutes is required");
    }
    if (film.content_type !== undefined && !CONTENT_TYPES.includes(film.content_type)) {
      errors.push(where + " content_type must be full_movie or short_film");
    }
    if (!film.imdb_id && !film.wikidata_id) {
      errors.push(where + " needs imdb_id or wikidata_id");
    }
    if (typeof film.id === "string" && /^tt\d/.test(film.id) && film.id !== film.imdb_id) {
      errors.push(where + " id should equal imdb_id");
    }
    if (!Array.isArray(film.genres) || film.genres.length === 0) {
      errors.push(where + " genres must be a non-empty list");
    } else {
      const genres = new Set();
      film.genres.forEach((genre, genreIndex) => {
        if (typeof genre !== "string" || !Catalog.isSlug(genre) || !allowed(genre, facet.genres)) {
          errors.push(where + " genres[" + genreIndex + "] must be a genre slug");
          return;
        }
        if (genres.has(genre)) errors.push(where + " genres repeats " + genre);
        genres.add(genre);
      });
    }
    if (!Array.isArray(film.tags)) {
      errors.push(where + " tags must be an array");
    } else {
      const tags = new Set();
      film.tags.forEach((tag, tagIndex) => {
        if (typeof tag !== "string" || !Catalog.isSlug(tag) || !allowed(tag, facet.tags)) {
          errors.push(where + " tags[" + tagIndex + "] must be a tag slug");
          return;
        }
        if (tags.has(tag)) errors.push(where + " tags repeats " + tag);
        tags.add(tag);
      });
    }
    if (!Array.isArray(film.cast)) {
      errors.push(where + " cast must be an array");
    } else {
      const castNames = new Set();
      film.cast.forEach((member, memberIndex) => {
        const at = where + " cast[" + memberIndex + "]";
        if (!isPlainObject(member)) {
          errors.push(at + " must be an object with name and role");
          return;
        }
        if (!cleanText(member.name, 120)) errors.push(at + " name is required");
        if (member.role !== undefined && !cleanText(member.role, 160)) errors.push(at + " role must be a non-empty string when present");
        const key = Catalog.fold(member.name || "");
        if (key && castNames.has(key)) errors.push(at + " repeats " + member.name);
        if (key) castNames.add(key);
      });
    }
    for (const role of Catalog.ROLES) {
      if (role.id === "cast") continue;
      if (film[role.field] === undefined) {
        errors.push(where + " " + role.field + " must be an array");
        continue;
      }
      validateNameList(film[role.field], where + " " + role.field, errors);
    }
    if (!cleanText(film.country, 120)) errors.push(where + " country is required");
    if (!cleanText(film.language, 120)) errors.push(where + " language is required");
    if (film.imdb_id !== undefined && (typeof film.imdb_id !== "string" || !IMDB_RE.test(film.imdb_id))) {
      errors.push(where + " imdb_id must look like tt1234567");
    } else if (film.imdb_id && seenImdb.has(film.imdb_id)) {
      errors.push("duplicate imdb_id " + film.imdb_id);
    } else if (film.imdb_id) {
      seenImdb.add(film.imdb_id);
    }
    if (film.wikidata_id !== undefined && (typeof film.wikidata_id !== "string" || !WIKIDATA_RE.test(film.wikidata_id))) {
      errors.push(where + " wikidata_id must look like Q12345");
    } else if (film.wikidata_id && seenWikidata.has(film.wikidata_id)) {
      errors.push("duplicate wikidata_id " + film.wikidata_id);
    } else if (film.wikidata_id) {
      seenWikidata.add(film.wikidata_id);
    }
    if (!cleanDescription(film.description)) errors.push(where + " description is required");
    if (film.trailer_youtube_id !== undefined) {
      errors.push(where + " trailer_youtube_id has been replaced by related_videos of kind trailer");
    }
    if (film.youtube_id !== undefined) {
      if (typeof film.youtube_id !== "string" || !YOUTUBE_ID_RE.test(film.youtube_id)) {
        errors.push(where + " youtube_id must be an 11-character YouTube id when present");
      } else if (seenYoutube.has(film.youtube_id)) {
        errors.push("duplicate youtube_id " + film.youtube_id);
      } else {
        seenYoutube.add(film.youtube_id);
      }
    }
    if (!Array.isArray(film.where_to_watch)) {
      errors.push(where + " where_to_watch must be an array");
    } else {
      film.where_to_watch.forEach((entry, entryIndex) => validateWatch(entry, where + " where_to_watch[" + entryIndex + "]", facet, errors));
    }
    if (!Array.isArray(film.related_videos)) {
      errors.push(where + " related_videos must be an array");
    } else {
      const videoIds = new Set();
      film.related_videos.forEach((entry, entryIndex) => {
        const at = where + " related_videos[" + entryIndex + "]";
        validateRelated(entry, at, facet, errors);
        if (entry && typeof entry.youtube_id === "string") {
          if (film.youtube_id && entry.youtube_id === film.youtube_id) {
            errors.push(at + " repeats the film youtube_id");
          }
          if (videoIds.has(entry.youtube_id)) errors.push(at + " repeats youtube_id " + entry.youtube_id);
          videoIds.add(entry.youtube_id);
        }
      });
    }
  });
  return errors;
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error("Could not read " + file + ": " + error.message);
  }
}

function main() {
  const root = path.join(__dirname, "..");
  const movieFile = process.argv[2] || path.join(root, "data", "movies.json");
  const facetFile = process.argv[3] || path.join(root, "data", "facets.json");
  let movies;
  let facets = {};
  try {
    movies = loadJson(movieFile);
    if (fs.existsSync(facetFile)) facets = loadJson(facetFile);
    else if (process.argv[3]) throw new Error("Could not read " + facetFile);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const errors = validate(movies, facets);
  if (errors.length) {
    console.error("Invalid movie data (" + errors.length + ")");
    for (const error of errors) console.error(" - " + error);
    process.exit(1);
  }
  const facet = Catalog.normalizeFacets(facets);
  console.log(
    "OK: " + movies.length + " films, " +
    facet.genres.length + " genres, " +
    facet.kinds.length + " kinds"
  );
}

module.exports = { validate, validateFacets };

if (require.main === module) main();
