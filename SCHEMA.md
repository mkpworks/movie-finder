# Movie Finder data schema (v1, with v2 awards fields)

`data/movies.json` is the catalog. `data/facets.json` is the vocabulary for filters. The page and the embed read genres, decades, tags, roles, kinds, watch types, and free-provider names from `facets.json` when that file is present. They are not hardcoded in the scripts.

An empty `movies.json` array is valid. Add a film only when the title, year, credits, and ids have been checked. Use `0` for `year` and `"unknown"` for `decade` when the year is not known. Do not infer a year.

There is no `trailer_youtube_id` field. A trailer is a `related_videos` entry with `"kind": "trailer"`.

## Files

- `movies.json` — array of film objects.
- `facets.json` — optional vocabulary. When a list in this file is non-empty, film values for that field must use it. When the list is missing or empty, genres, tags, and decades stay open, and the page builds those filters from the films. Kinds and watch types stay the closed sets below either way.

The Pages build writes `data/catalog.json`, `data/version.json`, and `data/film/<id>.json` for each film that has where-to-watch links or at least one award entry. Those files are the data API. Do not edit them by hand. `data/movies.json` stays the full source, including every watch offer, bonus video, and award entry. The page loads the list catalog, then the detail file for each visible film. People stay name-based. The browse lists the most credited names in each role, and the person search reaches the rest.

`data/catalog.json` (version `"1"`):

| Field | Meaning |
| --- | --- |
| `version` | Schema version. Currently `"1"`. |
| `generated_at` | ISO-8601 timestamp from the build that wrote the file. Cache key only. |
| `movies` | List records. Same fields as `movies.json`, without `where_to_watch` and without the `awards` array. `watch_count`, `award_terms` (ceremony and category names, for search), and a `checked_at` day are added. `runtime_minutes` is added when the source only has `duration_seconds`. `award_wins`, `award_nominations`, `oscar_wins`, `oscar_nominations`, and `award_flags` stay on the list record. |
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


## Awards (added in data v2)

Every film carries six award fields. They are additive: catalog schema `version` stays `"1"`, `validate-data.js` ignores them, and `scripts/validate-awards.js` checks them. A film with no known awards has `awards: []`, empty lists, zero counts, and `award_flags: []`.

| Field | Meaning |
| --- | --- |
| `awards` | Array of award entries (below). Sorted by ceremony order in `facets.award_ceremonies`, then year, then wins before nominations. |
| `award_wins` | Unique ceremony slugs (from `facets.award_ceremonies[].slug`) where the film won at least one award, e.g. `["oscar","golden-globe","bafta"]`. Includes non-competitive Oscar wins (Special Achievement, Technical Achievement). |
| `award_nominations` | Unique ceremony slugs where the film has any entry, won or nominated. A win also counts as a nomination. |
| `oscar_wins` | Number of **competitive** Academy Award wins. Excludes Special Achievement, Technical/Scientific and Honorary awards (same convention as Wikipedia's "List of Academy Award–winning films"). |
| `oscar_nominations` | Number of competitive Academy Award nominations, **including** the wins. Driving Miss Daisy: `oscar_wins: 4`, `oscar_nominations: 9`. |
| `award_flags` | Precomputed filter flags, a subset of `facets.award_flags`: `oscar-winner` (oscar_wins > 0), `oscar-nominee` (oscar_nominations > 0), `best-picture-winner`, `best-picture-nominee`, `major-award-winner` (won at a ceremony with `major: true`), `award-winner` (any win), `award-nominee` (any entry). |

`data/film/<id>.json` carries `where_to_watch` and `awards`. The list catalog leaves those arrays out so the first load stays smaller. The detail view fetches the file.

Each `awards[]` entry:

| Field | Meaning |
| --- | --- |
| `ceremony` | Full ceremony name; must equal a `name` in `facets.award_ceremonies` (e.g. `Academy Awards`, `Golden Globe Awards`, `BAFTA Awards`, `Cannes Film Festival`). |
| `category` | Category as named at that ceremony, without the ceremony prefix, e.g. `Best Picture`, `Best Actress`, `Best Motion Picture – Musical or Comedy`, `Palme d'Or`, `Golden Lion`. Historical names are kept (`Best Art Direction, Black and White`). |
| `year` | Ceremony year (the Oscars for 1989 films were held in 1990, so `1990`). Omitted when the source has no date. |
| `result` | `won` or `nominated`. Wins and nominations are kept distinct; a win is never also listed as a separate nomination. |
| `recipients` | Optional array of people (or song writers) named on the nomination, e.g. `["Jessica Tandy"]`. Picture awards list producers when known. Omitted when unknown. |

The tag `oscar-winner` (already in `facets.tags`) is now set exactly when `oscar_wins > 0`, so the existing tag filter also works.

### Facets for awards

`facets.json` gains two optional keys (ignored by `validate-data.js`):

- `award_flags`: the closed list of flags above, in display order. `labels` gives display names (`oscar-winner` → "Oscar winner", and so on).
- `award_ceremonies`: `[{ "slug", "name", "short", "major" }]` for every ceremony that appears in the data, in display order. `short` is the badge text (`Oscar`, `Golden Globe`, `BAFTA`, `Cannes`, …). `major: true` marks the ceremonies counted by `major-award-winner`: Academy Awards, Golden Globes, BAFTA, SAG, Critics' Choice, Cannes, Venice, Berlin, Saturn, Independent Spirit, DGA, PGA, WGA, Sundance and César.

### Sources and method

- Bulk source: Wikidata (P166 *award received*, P1411 *nominated for*, with the P585 *point in time*, P805 *ceremony*, P1346 *winner* and P2453 *nominee* qualifiers), from both the film item and the person items whose statement names the film (P1686 *for work*).
- Academy Award **Best Original Song** entries come from Wikipedia's "Academy Award for Best Original Song" tables. Wikidata attaches those to song items, not films.
- Golden Globe entries for 13 film categories (both Best Motion Picture categories, Director, Screenplay, the six acting categories, Score, Song and Animated) come from the Wikipedia category list pages. Wikidata is incomplete for the Globes (for example, it had none of Driving Miss Daisy's three wins).
- Duplicate statements are merged: renamed categories (score, art direction, costume, sound and so on), film-year versus ceremony-year dates, and acting nominations that have several recipients.
- Each film's competitive Oscar counts were checked against Wikipedia's "List of Academy Award–winning films" (see summary.md).
