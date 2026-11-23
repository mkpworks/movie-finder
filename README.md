# Movie Finder

A static catalog of films. Search covers the title, the cast, the crew, and the people and titles on bonus videos. Filters cover genre, decade, tag, each crew role, whether a film has bonus features, and the bonus kind. Choosing a name such as a director, composer, or cast member fills the search and lists that person's films.

Published with GitHub Pages at <https://mkpworks.github.io/movie-finder/>.

## Preview locally

From the repository root:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>. The page loads JSON with `fetch`, so opening `index.html` directly from disk will not work.

To build the embed and the catalog files the same way Pages does:

```bash
node scripts/export-csv.js
node scripts/build-catalog.js
node scripts/build-embed.js
```

`data/catalog.csv`, `data/catalog.json`, `data/version.json`, and `embed.js` are build outputs and are gitignored.

## Add a film

Append an object to `data/movies.json`. The researched catalog is not in this repo yet, so the file ships as an empty array. Keep it empty until each film has been checked.

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
  "where_to_watch": [],
  "related_videos": []
}
```

- `id` is a unique slug.
- `year` is `0` and `decade` is `unknown` when the year is not known.
- `youtube_id` is optional. Set it only for a full copy of the film.
- Do not set `trailer_youtube_id`. Put a trailer in `related_videos` with `"kind": "trailer"`.
- Genre, tag, decade, role, and kind values have to be listed in `data/facets.json` while those lists are non-empty.

See `SCHEMA.md` for the full field list, including `where_to_watch` and `related_videos`.

## Facets

`data/facets.json` supplies the filter vocabularies. The finder reads it when the file is present and does not keep its own copy of the genre, decade, tag, role, or kind lists. A missing file, or an empty list, means that dimension is taken from the films themselves. Kinds and where-to-watch types stay closed sets.

The seed lists include drama, horror, documentary, and science fiction; decades from the 1890s through the 2020s; and the tags silent, horror, noir, public domain, black and white, animated, and cult. Bonus kinds are trailer, interview, behind the scenes, making of, commentary, featurette, Q&A, retrospective, and score. Free-source providers are YouTube, Internet Archive, and Library of Congress.

## Where to watch and bonus features

Each film can list where to watch it. The badge links to the provider. YouTube, Internet Archive, and Library of Congress are drawn as free sources. Other free and free-with-ads offers are outlined as free. Subscription, rent, and buy offers are drawn as paid. The footer notes that streaming availability changes and shows the newest checked date in the catalog. Each badge includes its own checked date.

When `youtube_id` is set, the card plays that film inline. When only a trailer is available, the card plays the trailer. **Bonus features** lists every related video, grouped by kind. Each one plays inline and has **View on YouTube** and **Open on YT Trainer** (`https://ytmusictrainer.com/?video_id=<id>`). Choosing a person on a bonus video fills the search.

**Has bonus features** keeps films that have at least one related video. **Kind** keeps films that have a related video of that kind.

## Spreadsheet

**Download this list**, in the toolbar, saves the films that match the current search and filters. The rows follow the current sort, one film per row. With the filters cleared, that file is the whole catalog.

The Pages build also writes `data/catalog.csv`, the full catalog in title order, as UTF-8 with a byte-order mark. The footer link **Download full spreadsheet** points at that file.

```bash
node scripts/export-csv.js
```

Columns are the film fields, a where-to-watch summary, the YouTube URL, and `ytmusictrainer_url` when the film has a `youtube_id`. `related_count` is the last column and is the number of bonus videos. Related videos do not get their own rows.

## Embedding and data API

This contract is stable. The schema version is `"1"`. A later version will bump that string when the catalog shape changes. `generated_at` changes on every deploy and is only a cache key.

Other sites load the finder from this repository. They do not copy the catalog.

```html
<div id="movie-finder"></div>
<script src="https://mkpworks.github.io/movie-finder/embed.js" defer></script>
```

`embed.js` is published at the site root. It mounts `#movie-finder` and any element with `data-movie-finder`. The same call is `MovieFinder.mount(element, options)`.

| Attribute or option | Values | Default |
| --- | --- | --- |
| `data-theme` / `theme` | `light` or `dark` | Follows `prefers-color-scheme` |
| `data-accent` / `accent` | `#rgb` or `#rrggbb` | The finder gold |
| `data-height` / `height` | CSS length, or a number of pixels | Natural height |
| `data-genre` / `genre` | A genre slug from the facet list | No genre filter |
| `data-decade` / `decade` | A decade, such as `1990s` | No decade filter |
| `data-tag` / `tag` | A tag slug from the facet list | No tag filter |
| `data-kind` / `kind` | A bonus kind | No kind filter |
| `data-bonus` / `bonus` | `yes` or `no` | No bonus filter |
| `data-director` / `director` | A director name | No director filter |
| `data-cast` / `cast` | A cast name | No cast filter |
| `data-writer` / `writer` | A writer name | No writer filter |
| `data-composer` / `composer` | A composer name | No composer filter |
| `data-cinematographer` / `cinematographer` | A cinematographer name | No cinematographer filter |
| `data-producer` / `producer` | A producer name | No producer filter |

The widget renders in a shadow root, so its CSS does not leak in or out. Search, filters, sort, people grouped by role, and the film cards are the same finder as this site. A thumbnail plays inline from `youtube-nocookie.com`. **View on YouTube** and **Open on YT Trainer** open in a new tab. **Download this list** exports the filtered rows. A **Powered by Movie Finder** link points back here.

`embed-demo.html` on this site shows the snippet and a live embed. Build `embed.js` before opening that page locally.

### Catalog files

`data/movies.json` and `data/facets.json` stay the source files the main page loads. If `facets.json` is missing, the page continues with an empty vocabulary.

The Pages build also writes these two files. `embed.js` fetches `data/version.json` with a cache-busting query (`cache: "no-store"` plus a timestamp), then fetches `data/catalog.json?v=<generated_at>`. GitHub Pages caches files for about 10 minutes. The version query changes when the site is rebuilt, so a new catalog shows up on the next page load.

`data/version.json`:

```json
{ "version": "1", "generated_at": "2026-11-23T00:00:00.000Z" }
```

`data/catalog.json` carries `version`, `generated_at`, `movies`, and `facets`. Item fields are the ones in `SCHEMA.md`. Do not depend on key order. Unknown fields on an item may appear later and should be ignored. GitHub Pages sends `Access-Control-Allow-Origin: *` on these JSON files, which is what a page on another origin needs in order to `fetch` them.

## Check the data

```bash
node scripts/validate-data.js
node scripts/check-catalog.js
```

Validation requires unique slugs, the required film fields, related-video kinds, and facet membership when a facet list is non-empty. The Pages workflow runs the same checks before it deploys.

## Deploy

Pushes to `main` run `.github/workflows/pages.yml`, which checks the data, builds the catalog, CSV, and `embed.js`, and deploys with `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`. Pull requests run the same check and build, and skip `actions/configure-pages`, because that action looks up the Pages site and fails until the source above is set. `actions/configure-pages` runs on push to `main`, not on pull requests.

The repository owner has to set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** before the first deploy can succeed.
