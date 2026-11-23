# Movie Finder data schema (v1)

`data/movies.json` is the catalog. `data/facets.json` is the vocabulary for filters. The page and the embed read genres, decades, tags, roles, kinds, watch types, and free-provider names from `facets.json` when that file is present. They are not hardcoded in the scripts.

An empty `movies.json` array is valid. Add a film only when the title, year, credits, and ids have been checked. Use `0` for `year` and `"unknown"` for `decade` when the year is not known. Do not infer a year.

There is no `trailer_youtube_id` field. A trailer is a `related_videos` entry with `"kind": "trailer"`.

## Files

- `movies.json` — array of film objects.
- `facets.json` — optional vocabulary. When a list in this file is non-empty, film values for that field must use it. When the list is missing or empty, genres, tags, and decades stay open, and the page builds those filters from the films. Kinds and watch types stay the closed sets below either way.

The Pages build writes `data/catalog.json`, `data/version.json`, and `data/film/<id>.json` for each film that has where-to-watch links. Those files are the data API. Do not edit them by hand. `data/movies.json` stays the full source, including every watch offer and bonus video. The page loads the list catalog, then the detail file for each visible film. People stay name-based. The browse lists the most credited names in each role, and the person search reaches the rest.

`data/catalog.json` (version `"1"`):

| Field | Meaning |
| --- | --- |
| `version` | Schema version. Currently `"1"`. |
| `generated_at` | ISO-8601 timestamp from the build that wrote the file. Cache key only. |
| `movies` | List records. Same fields as `movies.json`, without `where_to_watch`. `watch_count` and a `checked_at` day are added. `runtime_minutes` is added when the source only has `duration_seconds`. |
| `facets` | The same object as `data/facets.json`, or `{}` when that file is absent. |

## Film fields

Required on every film:

| Field | Meaning |
| --- | --- |
| `id` | Unique id. The researched films use the IMDb id (`tt` plus at least 7 digits). A lowercase slug is also accepted. |
| `title` | Film title. |
| `year` | Release year, from 1880 through 2100. `0` if unknown. |
| `decade` | Decade of `year`, such as `1990s`. Must be `unknown` when `year` is `0`. |
| `duration_seconds` | Running time in seconds. The researched catalog uses this field. |
| `runtime_minutes` | Running time in minutes. Derived from `duration_seconds` when it is omitted. At least one of the two is required. |
| `content_type` | `full_movie` or `short_film` when present. |
| `genres` | Non-empty array of unique genre slugs. |
| `tags` | Array of unique tag slugs. May be empty. |
| `cast` | Array of `{ "name", "role"? }` objects. `role` is the character when it is known. May be empty. Names are unique per film. |
| `directors` | Array of unique names. May be empty. |
| `composers` | Array of unique names. May be empty. |
| `writers` | Array of unique names. May be empty. |
| `cinematographers` | Array of unique names. May be empty. |
| `producers` | Array of unique names. May be empty. |
| `country` | Country name. |
| `language` | Language name. |
| `imdb_id` | IMDb title id, `tt` plus 7 or 8 digits. Unique. |
| `wikidata_id` | Wikidata item id, `Q` plus digits. Unique. |
| `description` | Short description. Newlines are allowed. |
| `where_to_watch` | Array of watch offers. May be empty. |
| `related_videos` | Array of bonus videos. May be empty. |

Optional:

| Field | Meaning |
| --- | --- |
| `youtube_id` | 11-character YouTube id for a full copy of the film. Omit the key when there is no full copy. |

Unknown fields are ignored, except `trailer_youtube_id`, which is rejected.

### Where to watch

Each offer:

| Field | Meaning |
| --- | --- |
| `provider` | Provider name, such as YouTube, Internet Archive, or Library of Congress. |
| `type` | `free`, `free-with-ads`, `subscription`, `rent`, or `buy`. |
| `url` | `http` or `https` link to that offer. |
| `region` | Region the check applies to, such as `US` or `worldwide`. |
| `checked_at` | `YYYY-MM-DD`, or an ISO 8601 timestamp. The page shows the date. |

`facets.json` `free_providers` names the providers drawn as free sources. A provider whose name contains one of those entries is styled as a free source. Other `free` and `free-with-ads` offers are outlined as free. `subscription`, `rent`, and `buy` are styled as paid. The footer says that availability changes and shows the newest `checked_at` in the catalog.

### Related videos

Bonus features replace a single trailer id. Each entry:

| Field | Meaning |
| --- | --- |
| `youtube_id` | 11-character YouTube id. Unique within the film, and different from the film's `youtube_id`. |
| `title` | Video title. |
| `channel_name` | YouTube channel name. |
| `channel_url` | A YouTube channel URL (`/channel/UC…`, `/@handle`, `/c/`, or `/user/`). |
| `kind` | `trailer`, `interview`, `behind-the-scenes`, `making-of`, `commentary`, `featurette`, `q-and-a`, `retrospective`, or `score`. |
| `people` | Array of names credited in the video. May be empty. |
| `year` | Year from the title or description. `0` if unknown. |
| `duration_seconds` | Running time in seconds, from 1 through 86400. |

The film card lists these under **Bonus features**, grouped by kind. Each one plays inline and has **View on YouTube** and **Open on YT Trainer** links. A film with no `youtube_id` still plays the trailer in the main player when a `trailer` entry exists.

Search includes the film title, cast, crew, related-video titles, and related-video people. Choosing any of those names fills the search.

## Facets

```json
{
  "genres": ["drama", "horror"],
  "decades": ["1990s"],
  "tags": ["cult"],
  "roles": ["director", "cast", "writer", "composer", "cinematographer", "producer"],
  "kinds": ["trailer", "interview"],
  "watch_types": ["free", "free-with-ads", "subscription", "rent", "buy"],
  "free_providers": ["YouTube", "Internet Archive", "Library of Congress"],
  "labels": { "q-and-a": "Q&A" },
  "notes": { "tags": { "cult": "A short note shown when this tag is selected." } }
}
```

`roles` entries must be the known crew ids. `kinds` and `watch_types` must be members of the closed sets above. `labels` overrides the on-screen name for a slug. `notes` are shown when that filter is selected.

The seed lists live in `data/facets.json`. Genres include drama, horror, documentary, and science fiction. Tags include silent, horror, noir, public domain, black and white, animated, and cult. Decades run from the 1890s through the 2020s.

## Example shape

This object shows the shape only. It is not a catalog entry.

```json
{
  "id": "example-film",
  "title": "Example Film",
  "year": 1994,
  "decade": "1990s",
  "runtime_minutes": 100,
  "genres": ["drama"],
  "tags": ["cult"],
  "cast": [{ "name": "Ada Lovelace", "role": "The Lead" }],
  "directors": ["Grace Hopper"],
  "composers": [],
  "writers": [],
  "cinematographers": [],
  "producers": [],
  "country": "United States",
  "language": "English",
  "imdb_id": "tt1234567",
  "wikidata_id": "Q12345",
  "description": "What the film is about.",
  "youtube_id": "aaaaaaaaaaa",
  "where_to_watch": [],
  "related_videos": []
}
```

## Validation

```bash
node scripts/validate-data.js
node scripts/check-catalog.js
```

`validate-data.js` checks ids, the closed kind and watch-type sets, decade consistency, and membership in any non-empty facet list. The Pages workflow runs the same checks before it deploys.
