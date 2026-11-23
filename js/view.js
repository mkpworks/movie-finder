"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinderView = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PIVOT_KEYS = ["genre", "decade", "tag", "kind"];
  const ROLE_IDS = ["director", "cast", "writer", "composer", "cinematographer", "producer"];
  const SELECTS = [
    ["genre", "genre"],
    ["decade", "decade"],
    ["tag", "tag"],
    ["director", "director"],
    ["cast", "cast"],
    ["writer", "writer"],
    ["composer", "composer"],
    ["cinematographer", "cinematographer"],
    ["producer", "producer"],
    ["bonus", "bonus"],
    ["kind", "kind"],
    ["sort", "sort"],
  ];
  const MODE_NOTES = {
    people: "People are grouped by role. Choose a name to fill the search and list that person's films.",
    genre: "A film is listed under each of its genres.",
    tag: "A film is listed under each of its tags.",
    decade: "Films with an unknown year are left out of this view.",
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function pickValue(value, allowed, index) {
    const choices = allowed || [];
    if (value == null) return "All";
    const text = String(value).trim();
    if (!text || Catalog.fold(text) === "all") return "All";
    if (choices.includes(text)) return text;
    const folded = Catalog.fold(text);
    const found = choices.find((item) => {
      return Catalog.fold(item) === folded ||
        Catalog.fold(Catalog.labelOf(item)) === folded ||
        Catalog.fold(Catalog.labelFor(index, item)) === folded;
    });
    return found || "All";
  }

  function pickPerson(value, people) {
    if (value == null) return "All";
    const text = String(value).trim();
    if (!text || Catalog.fold(text) === "all") return "All";
    const found = (people || []).find((person) => Catalog.fold(person.name) === Catalog.fold(text));
    return found ? found.name : "All";
  }

  function pickBonus(value) {
    const text = Catalog.fold(value).trim();
    if (text === "yes" || text === "true") return "yes";
    if (text === "no" || text === "false") return "no";
    return "All";
  }

  function presets(options, index) {
    const source = options || {};
    const idx = index || {};
    const people = idx.people || {};
    return {
      genre: pickValue(source.genre, idx.genres, idx),
      decade: pickValue(source.decade, idx.decades, idx),
      tag: pickValue(source.tag, idx.tags, idx),
      kind: pickValue(source.kind, idx.kinds, idx),
      bonus: pickBonus(source.bonus),
      director: pickPerson(source.director, people.director),
      cast: pickPerson(source.cast, people.cast),
      writer: pickPerson(source.writer, people.writer),
      composer: pickPerson(source.composer, people.composer),
      cinematographer: pickPerson(source.cinematographer, people.cinematographer),
      producer: pickPerson(source.producer, people.producer),
    };
  }

  function filterState(filters, query) {
    const source = filters || {};
    return {
      genre: source.genre || "All",
      decade: source.decade || "All",
      tag: source.tag || "All",
      director: source.director || "All",
      cast: source.cast || "All",
      writer: source.writer || "All",
      composer: source.composer || "All",
      cinematographer: source.cinematographer || "All",
      producer: source.producer || "All",
      bonus: source.bonus || "All",
      kind: source.kind || "All",
      query: query || "",
    };
  }

  function clearedFilters(index, filters, query) {
    const next = filterState(filters, query);
    const hits = index.movies.filter((item) => Catalog.matches(item, { query: next.query }, index));
    if (!hits.length) return next;
    if (next.genre !== "All" && hits.some((item) => !Catalog.genresOf(item).includes(next.genre))) next.genre = "All";
    if (next.decade !== "All" && hits.some((item) => Catalog.decadeOf(item) !== next.decade)) next.decade = "All";
    if (next.tag !== "All" && hits.some((item) => !Catalog.tagsOf(item).includes(next.tag))) next.tag = "All";
    if (next.kind !== "All" && hits.some((item) => !Catalog.kindsOf(item).includes(next.kind))) next.kind = "All";
    if (next.bonus === "yes" && hits.some((item) => Catalog.relatedVideos(item).length === 0)) next.bonus = "All";
    if (next.bonus === "no" && hits.some((item) => Catalog.relatedVideos(item).length > 0)) next.bonus = "All";
    for (const role of Catalog.ROLES) {
      const selected = next[role.id];
      if (selected !== "All" && hits.some((item) => !Catalog.namesFor(item, role.id).some((name) => Catalog.fold(name) === Catalog.fold(selected)))) {
        next[role.id] = "All";
      }
    }
    return next;
  }

  function shellHtml(options) {
    const home = (options && options.home) || "https://mkpworks.github.io/movie-finder/";
    const csv = (options && options.csv) || (home + "data/catalog.csv");
    return [
      '<div class="finder">',
      '<header class="site-header"><div class="wrap header-row"><div>',
      '<p class="eyebrow">Film catalog</p>',
      "<h1>Movie Finder</h1>",
      '<p class="lede" id="summary">Search films by title and people. Filter by genre, decade, tag, and crew.</p>',
      '<dl class="stats" id="stats"></dl>',
      "</div>",
      '<button type="button" class="btn" id="theme" data-action="theme">Light theme</button>',
      "</div></header>",
      '<div class="wrap">',
      '<section class="panel" aria-labelledby="browse-heading">',
      '<div class="panel-head">',
      '<h2 id="browse-heading">Browse</h2>',
      '<div class="modes" role="group" aria-label="Browse mode">',
      '<button type="button" data-action="mode" data-mode="list" aria-pressed="true">All films</button>',
      '<button type="button" data-action="mode" data-mode="genre" aria-pressed="false">Genre</button>',
      '<button type="button" data-action="mode" data-mode="decade" aria-pressed="false">Decade</button>',
      '<button type="button" data-action="mode" data-mode="tag" aria-pressed="false">Tag</button>',
      '<button type="button" data-action="mode" data-mode="people" aria-pressed="false">Browse people</button>',
      "</div></div>",
      '<div class="filters">',
      '<label class="field field-search"><span>Search <kbd>/</kbd></span><input id="q" type="search" placeholder="Title or person" autocomplete="off"></label>',
      '<label class="field">Genre <select id="genre"></select></label>',
      '<label class="field">Decade <select id="decade"></select></label>',
      '<label class="field">Tag <select id="tag"></select></label>',
      '<label class="field">Director <select id="director"></select></label>',
      '<label class="field">Cast <select id="cast"></select></label>',
      '<label class="field">Writer <select id="writer"></select></label>',
      '<label class="field">Composer <select id="composer"></select></label>',
      '<label class="field">Cinematographer <select id="cinematographer"></select></label>',
      '<label class="field">Producer <select id="producer"></select></label>',
      '<label class="field">Bonus features <select id="bonus"><option value="All">All</option><option value="yes">Has bonus features</option><option value="no">No bonus features</option></select></label>',
      '<label class="field">Kind <select id="kind"></select></label>',
      '<label class="field">Sort by <select id="sort"><option value="title">Title A–Z</option><option value="year">Year (oldest first)</option><option value="genre">Genre A–Z</option></select></label>',
      "</div></section>",
      '<div class="toolbar"><p class="status" id="status" aria-live="polite">Loading the catalog…</p>',
      '<div class="toolbar-actions">',
      '<button type="button" class="btn" data-action="prev">Previous</button>',
      '<button type="button" class="btn" data-action="next">Next</button>',
      '<button type="button" class="btn" data-action="expand" data-group-only>Expand all</button>',
      '<button type="button" class="btn" data-action="collapse" data-group-only>Collapse all</button>',
      '<button type="button" class="btn" data-action="clear">Clear filters</button>',
      '<button type="button" class="btn" data-action="csv">Download this list</button>',
      "</div></div>",
      '<p id="facet-note" class="section-note" hidden></p>',
      '<div id="results" tabindex="-1"></div>',
      '<section class="discover" id="discover" aria-labelledby="discover-heading"><div class="discover-head"><h2 id="discover-heading">Discover</h2>',
      '<button type="button" class="btn btn-primary" data-action="random">Random film</button></div>',
      '<p class="section-note">Related films share people, a genre, or a decade.</p>',
      '<div id="discover-body"></div></section>',
      '<details class="fold"><summary>',
      '<span class="chev" aria-hidden="true">▸</span>',
      '<span class="cross-title" id="people-heading">People</span>',
      '<span class="cross-count" id="people-count"></span>',
      "</summary>",
      '<p class="section-note">Grouped by role. Choose a name to fill the search. The number is how many films credit that person in the role.</p>',
      '<div id="people-list"></div></details>',
      '<details class="fold"><summary>',
      '<span class="chev" aria-hidden="true">▸</span>',
      '<span class="cross-title" id="genre-heading">Genres</span>',
      '<span class="cross-count" id="genre-count"></span>',
      "</summary>",
      '<p class="section-note">Genres come from the facet list. The number is how many films use that genre.</p>',
      '<div id="genre-list" class="chips"></div></details>',
      '<details class="fold"><summary>',
      '<span class="chev" aria-hidden="true">▸</span>',
      '<span class="cross-title" id="tag-heading">Tags</span>',
      '<span class="cross-count" id="tag-count"></span>',
      "</summary>",
      '<p class="section-note">Tags come from the facet list. The number is how many films carry that tag.</p>',
      '<div id="tag-list" class="chips"></div></details>',
      '<footer class="site-footer">',
      '<p id="availability">Streaming availability changes. Each where-to-watch link is dated with the day it was checked.</p>',
      '<p><a href="' + esc(csv) + '">Download full spreadsheet</a></p>',
      '<p class="powered">Powered by <a href="' + esc(home) + '">Movie Finder</a></p>',
      "</footer></div></div>",
    ].join("");
  }

  function mount(root, options) {
    const opts = options || {};
    const byId = (id) => root.getElementById(id);
    const themeTarget = opts.themeTarget || document.documentElement;
    const persistTheme = Boolean(opts.persistTheme);
    const state = {
      mode: "list",
      sort: "title",
      genre: "All",
      decade: "All",
      tag: "All",
      director: "All",
      cast: "All",
      writer: "All",
      composer: "All",
      cinematographer: "All",
      producer: "All",
      bonus: "All",
      kind: "All",
      query: "",
      page: 0,
      open: {},
      pickId: "",
      seedMode: true,
    };
    let index = null;
    let defaults = presets({}, null);
    let discoverStamp = "";

    function groupDomId(key) {
      return state.mode + ":" + key;
    }

    function currentRows() {
      return Catalog.sortFilms(
        index.movies.filter((film) => Catalog.matches(film, state, index)),
        state.sort,
        index
      );
    }

    function currentGroups(rows) {
      if (state.mode === "people") return Catalog.peopleGroups(rows, state.sort, index);
      if (state.mode === "list") return [];
      return Catalog.groupFilms(rows, state.mode, state.sort, { index });
    }

    function filtersAreClear() {
      return !state.query.trim() &&
        state.genre === "All" &&
        state.decade === "All" &&
        state.tag === "All" &&
        state.kind === "All" &&
        state.bonus === "All" &&
        ROLE_IDS.every((id) => state[id] === "All");
    }

    function fillSelect(id, values, labeler) {
      const select = byId(id);
      if (!select) return;
      const choices = ['<option value="All">All</option>'];
      for (const value of values) {
        const label = labeler ? labeler(value) : value;
        choices.push('<option value="' + esc(value) + '">' + esc(label) + "</option>");
      }
      select.innerHTML = choices.join("");
    }

    function fillPeople(id, roleId) {
      const select = byId(id);
      if (!select) return;
      const people = (index.people && index.people[roleId]) || [];
      const choices = ['<option value="All">All</option>'];
      for (const person of people) {
        choices.push('<option value="' + esc(person.name) + '">' + esc(person.name) + " · " + person.count + "</option>");
      }
      select.innerHTML = choices.join("");
    }

    function searchButton(name, className) {
      const on = state.query && Catalog.fold(state.query) === Catalog.fold(name) ? " is-on" : "";
      return '<button type="button" class="' + className + on + '" data-action="search" data-query="' + esc(name) + '" aria-label="Search for ' + esc(name) + '">' + esc(name) + "</button>";
    }

    function pivotButton(key, value, className, label) {
      const on = state[key] === value ? " is-on" : "";
      const text = label || Catalog.labelFor(index, value);
      return '<button type="button" class="' + className + on + '" data-action="pivot" data-key="' + esc(key) + '" data-value="' + esc(value) + '" aria-label="Filter by ' + esc(text) + '">' + esc(text) + "</button>";
    }

    function youtubeLinks(id, title) {
      if (!id) return "";
      const watch = Catalog.youtubeWatchUrl(id);
      const trainer = Catalog.trainerUrl(id);
      const name = title || "this video";
      return '<div class="video-links">' +
        '<a class="watch" href="' + esc(watch) + '" target="_blank" rel="noopener noreferrer" aria-label="View ' + esc(name) + ' on YouTube">View on YouTube</a>' +
        '<a class="trainer" href="' + esc(trainer) + '" target="_blank" rel="noopener noreferrer" aria-label="Open ' + esc(name) + ' on YT Trainer">Open on YT Trainer</a>' +
        "</div>";
    }

    function player(id, title, mark) {
      return '<div class="thumb-wrap"><button type="button" class="play" data-action="play" data-youtube="' + esc(id) + '" aria-label="Play ' + esc(title) + '">' +
        '<img class="thumb" alt="" width="320" height="180" loading="lazy" decoding="async" src="https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/mqdefault.jpg">' +
        '<span class="play-mark" aria-hidden="true">' + esc(mark) + "</span>" +
        "</button></div>";
    }

    function watchBadges(film) {
      const entries = Array.isArray(film.where_to_watch) ? film.where_to_watch : [];
      if (!entries.length) return "";
      return '<div class="sources">' + entries.map((entry) => {
        const klass = Catalog.watchClass(entry, index.freeProviders);
        const href = Catalog.safeHttpUrl(entry.url, "");
        const typeLabel = Catalog.labelFor(index, entry.type);
        const bits = [entry.provider, typeLabel, entry.region, entry.checked_at ? "checked " + entry.checked_at : ""].filter(Boolean);
        const label = bits.join(" · ");
        if (!href) return '<span class="source ' + klass + '">' + esc(label) + "</span>";
        return '<a class="source ' + klass + '" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + "</a>";
      }).join("") + "</div>";
    }

    function bonusItem(video) {
      const id = video.youtube_id || "";
      const names = Array.isArray(video.people) ? video.people : [];
      const peopleHtml = names.map((name) => searchButton(name, "name-link")).join('<span class="act-sep">, </span>');
      const year = video.year ? "<span>" + esc(video.year) + "</span>" : "";
      const duration = video.duration_seconds ? '<span class="time">' + esc(Catalog.formatDuration(video.duration_seconds)) + "</span>" : "";
      const channelHref = Catalog.safeHttpUrl(video.channel_url, "");
      const channel = channelHref
        ? '<a class="channel-link" href="' + esc(channelHref) + '" target="_blank" rel="noopener noreferrer">' + esc(video.channel_name || "Channel") + "</a>"
        : esc(video.channel_name || "");
      return '<article class="bonus-item">' +
        player(id, video.title, "Play") +
        "<div>" +
        '<div class="film-top"><h5 class="bonus-video-title">' + esc(video.title) + "</h5>" + youtubeLinks(id, video.title) + "</div>" +
        '<p class="meta">' + channel + year + duration + "</p>" +
        (peopleHtml ? '<p class="credits">' + peopleHtml + "</p>" : "") +
        "</div></article>";
    }

    function bonusSection(film) {
      const videos = Catalog.relatedVideos(film);
      if (!videos.length) return "";
      const order = index.kinds.length ? index.kinds : Catalog.KINDS;
      const groups = new Map();
      for (const video of videos) {
        const kind = video && video.kind ? video.kind : "other";
        if (!groups.has(kind)) groups.set(kind, []);
        groups.get(kind).push(video);
      }
      const kinds = [...groups.keys()].sort((a, b) => {
        const left = order.indexOf(a);
        const right = order.indexOf(b);
        return (left === -1 ? order.length : left) - (right === -1 ? order.length : right);
      });
      const body = kinds.map((kind) => {
        const label = Catalog.labelFor(index, kind);
        const items = groups.get(kind).map(bonusItem).join("");
        return '<section class="bonus-kind"><h4 class="bonus-kind-title">' + pivotButton("kind", kind, "kind-link", label) + "</h4>" + items + "</section>";
      }).join("");
      return '<section class="bonus"><h4 class="bonus-title">Bonus features</h4>' + body + "</section>";
    }

    function creditLine(film) {
      const bits = [];
      for (const role of index.roles) {
        if (role.id === "cast") continue;
        const names = Catalog.namesFor(film, role.id);
        if (!names.length) continue;
        const linked = names.map((name) => searchButton(name, "name-link")).join('<span class="act-sep">, </span>');
        bits.push('<span class="credit-role">' + esc(role.singular) + "</span> " + linked);
      }
      return bits.length ? '<p class="credits">' + bits.join('<span class="act-sep"> · </span>') + "</p>" : "";
    }

    function castLine(film) {
      const cast = Array.isArray(film.cast) ? film.cast : [];
      if (!cast.length) return "";
      const linked = cast.map((member) => {
        const name = member && member.name ? member.name : "";
        const role = member && member.role ? ' <span class="cast-role">as ' + esc(member.role) + "</span>" : "";
        return searchButton(name, "name-link") + role;
      }).join('<span class="act-sep">, </span>');
      return '<p class="byline"><span class="credit-role">Cast</span> ' + linked + "</p>";
    }

    function filmArticle(film, articleOptions) {
      const grouped = Boolean(articleOptions && articleOptions.grouped);
      const feature = Boolean(articleOptions && articleOptions.feature);
      const showRelated = Boolean(articleOptions && articleOptions.related);
      const shared = articleOptions && articleOptions.shared;
      const titleTag = feature || !grouped ? "h3" : "h4";
      const playable = Catalog.playable(film);
      const thumb = playable
        ? player(playable.id, playable.title || film.title, playable.kind === "film" ? "Play" : Catalog.labelFor(index, playable.kind))
        : '<div class="thumb-wrap is-empty"><span class="poster-year">' + esc(film.year || "Film") + "</span></div>";
      const featuredId = film.youtube_id || (playable && playable.id) || "";
      const featuredTitle = film.youtube_id ? film.title : (playable && playable.title) || film.title;
      const links = youtubeLinks(featuredId, featuredTitle);
      const decade = Catalog.decadeOf(film);
      const decadeHtml = decade && decade !== "unknown"
        ? pivotButton("decade", decade, "name-link", Catalog.labelFor(index, decade))
        : "";
      const chips = [];
      for (const genre of Catalog.genresOf(film)) chips.push(pivotButton("genre", genre, "chip-btn", Catalog.labelFor(index, genre)));
      for (const tag of Catalog.tagsOf(film)) chips.push(pivotButton("tag", tag, "chip-btn", Catalog.labelFor(index, tag)));
      const wrapped = chips.map((chip) => '<span class="chip">' + chip + "</span>").join("");
      const external = [];
      if (film.imdb_id) {
        external.push('<a href="https://www.imdb.com/title/' + esc(film.imdb_id) + '/" target="_blank" rel="noopener noreferrer">IMDb</a>');
      }
      if (film.wikidata_id) {
        external.push('<a href="https://www.wikidata.org/wiki/' + esc(film.wikidata_id) + '" target="_blank" rel="noopener noreferrer">Wikidata</a>');
      }
      const bonusCount = Catalog.relatedVideos(film).length;
      const bonusBadge = bonusCount ? '<span class="type-badge">' + bonusCount + " bonus</span>" : "";
      const description = typeof film.description === "string" ? film.description : "";
      const sharedHtml = shared ? '<p class="shared">' + esc(shared) + "</p>" : "";
      const relatedHtml = showRelated
        ? '<button type="button" class="text-btn" data-action="similar" data-id="' + esc(film.id) + '">Related</button>'
        : "";
      return '<article class="film' + (feature ? " is-feature" : "") + '">' +
        thumb +
        '<div class="film-body">' +
        '<div class="film-top">' +
        "<" + titleTag + ' class="film-title">' + esc(film.title) + "</" + titleTag + ">" +
        links +
        "</div>" +
        '<p class="meta">' +
        (film.year ? "<span>" + esc(film.year) + "</span>" : "") +
        decadeHtml +
        '<span class="time">' + esc(Catalog.formatRuntime(film.runtime_minutes)) + "</span>" +
        (film.country ? "<span>" + esc(film.country) + "</span>" : "") +
        (film.language ? "<span>" + esc(film.language) + "</span>" : "") +
        bonusBadge +
        (external.length ? "<span>" + external.join(" · ") + "</span>" : "") +
        "</p>" +
        (description ? '<p class="desc">' + esc(description) + "</p>" : "") +
        castLine(film) +
        creditLine(film) +
        (wrapped ? '<div class="chips">' + wrapped + "</div>" : "") +
        watchBadges(film) +
        bonusSection(film) +
        sharedHtml +
        relatedHtml +
        "</div></article>";
    }

    function groupBlock(group) {
      const id = groupDomId(group.key);
      const open = Boolean(state.open[id]);
      const minutes = group.items.reduce((sum, film) => sum + (film.runtime_minutes || 0), 0);
      const titleHtml = state.mode === "people"
        ? '<span class="group-id"><span class="group-role">' + esc(group.roleLabel) + "</span>" + searchButton(group.label, "group-title") + "</span>"
        : pivotButton(state.mode, group.key, "group-title", group.label);
      const meta = group.count + " film" + (group.count === 1 ? "" : "s") + " · " + Catalog.formatRuntime(minutes);
      const body = open
        ? '<div class="group-body">' + group.items.map((film) => filmArticle(film, { grouped: true, related: true })).join("") + "</div>"
        : "";
      return '<section class="group' + (open ? " is-open" : "") + '">' +
        '<h3 class="group-head">' +
        '<span class="group-main">' +
        '<button type="button" class="chev-btn" data-action="group" data-group="' + esc(id) + '" aria-expanded="' + (open ? "true" : "false") + '" aria-label="' + (open ? "Collapse " : "Expand ") + esc(group.label) + '">' +
        '<span class="chev" aria-hidden="true">▸</span></button>' +
        titleHtml +
        "</span>" +
        '<button type="button" class="group-meta" data-action="group" data-group="' + esc(id) + '">' + esc(meta) + "</button>" +
        "</h3>" + body + "</section>";
    }

    function appearsHtml(rows) {
      const found = Catalog.appearances(state.query, rows);
      if (!found.length) return "";
      return '<div class="appears">' + found.slice(0, 3).map((person) => {
        const shown = person.places.slice(0, 8);
        const links = shown.map((place) => '<span>' + esc(place) + "</span>").join('<span class="act-sep"> · </span>');
        const more = person.places.length > shown.length ? '<span class="act-sep">…</span>' : "";
        return "<p>" + searchButton(person.name, "name-link") + " · " + links + more + "</p>";
      }).join("") + "</div>";
    }

    function emptyState(message) {
      return '<div class="empty"><p>' + esc(message) + '</p><button type="button" class="btn" data-action="clear">Clear filters</button></div>';
    }

    function pager(pages) {
      if (pages < 2) return "";
      const prev = state.page === 0 ? " disabled" : "";
      const next = state.page >= pages - 1 ? " disabled" : "";
      return '<nav class="pager" aria-label="Pagination"><button type="button" class="btn" data-action="prev"' + prev + ">Previous</button><button type=\"button\" class=\"btn\" data-action=\"next\"" + next + ">Next</button></nav>";
    }

    function peopleDirectory() {
      const blocks = (index.roles || []).map((role) => {
        const people = (index.people && index.people[role.id]) || [];
        if (!people.length) {
          return '<div class="role-block"><h3 class="role-label">' + esc(role.plural) + ' <span class="chip-count">0</span></h3><p class="section-note">No ' + esc(role.plural.toLowerCase()) + " yet.</p></div>";
        }
        const chips = people.map((person) => '<span class="chip">' + searchButton(person.name, "chip-btn") + '<span class="chip-count">' + person.count + "</span></span>").join("");
        return '<div class="role-block"><h3 class="role-label">' + esc(role.plural) + ' <span class="chip-count">' + people.length + "</span></h3><div class=\"chips\">" + chips + "</div></div>";
      }).join("");
      return blocks || '<p class="section-note">No people in the catalog yet.</p>';
    }

    function renderLists() {
      const peopleHost = byId("people-list");
      if (peopleHost) peopleHost.innerHTML = peopleDirectory();
      const genreHost = byId("genre-list");
      if (genreHost) {
        genreHost.innerHTML = index.genres.map((genre) => '<span class="chip">' + pivotButton("genre", genre, "chip-btn", Catalog.labelFor(index, genre)) + '<span class="chip-count">' + (index.genreCount[genre] || 0) + "</span></span>").join("");
      }
      const tagHost = byId("tag-list");
      if (tagHost) {
        tagHost.innerHTML = index.tags.map((tag) => '<span class="chip">' + pivotButton("tag", tag, "chip-btn", Catalog.labelFor(index, tag)) + '<span class="chip-count">' + (index.tagCount[tag] || 0) + "</span></span>").join("");
      }
    }

    function render(scroll) {
      if (!index) return;
      const active = root.activeElement;
      const focusGroup = active && active.getAttribute && active.getAttribute("data-group");
      const rows = currentRows();
      const groups = currentGroups(rows);
      if (state.seedMode && state.mode !== "list" && groups.length) {
        const anyOpen = groups.some((group) => state.open[groupDomId(group.key)]);
        if (!anyOpen) state.open[groupDomId(groups[0].key)] = true;
        state.seedMode = false;
      }
      const totalUnits = state.mode === "list" ? rows.length : groups.length;
      const pages = Catalog.pageCount(totalUnits);
      if (state.page > pages - 1) state.page = pages - 1;
      if (state.page < 0) state.page = 0;
      const start = state.page * Catalog.PER_PAGE;
      const pageRows = rows.slice(start, start + Catalog.PER_PAGE);
      const pageGroups = groups.slice(start, start + Catalog.PER_PAGE);
      const units = {
        genre: ["genre", "genres"],
        decade: ["decade", "decades"],
        tag: ["tag", "tags"],
        people: ["person", "people"],
      };
      const counted = rows.length === 1 ? "1 film" : rows.length + " films";
      const filmLabel = rows.length === index.movies.length ? counted : counted + " of " + index.movies.length;
      const pair = units[state.mode] || ["group", "groups"];
      const groupLabel = state.mode === "list" ? "" : " · " + groups.length + " " + (groups.length === 1 ? pair[0] : pair[1]);
      byId("status").textContent = "Page " + (state.page + 1) + " of " + pages + " · " + filmLabel + groupLabel;

      let results = "";
      if (!index.movies.length && filtersAreClear()) {
        results = emptyState("No films in the catalog yet.");
      } else if (state.mode === "list") {
        results = rows.length
          ? pageRows.map((film) => filmArticle(film, { related: true })).join("") + pager(pages)
          : emptyState("Nothing matches these filters.");
      } else if (!groups.length) {
        results = emptyState("Nothing matches these filters.");
      } else {
        results = pageGroups.map(groupBlock).join("") + pager(pages);
      }
      byId("results").innerHTML = appearsHtml(rows) + results;
      renderLists();

      const discoverBody = byId("discover-body");
      if (discoverBody && state.pickId !== discoverStamp) {
        discoverStamp = state.pickId;
        const pick = index.movies.find((film) => film.id === state.pickId);
        if (!pick) {
          discoverBody.innerHTML = '<p class="section-note">No films in the catalog yet.</p>';
        } else {
          const similar = Catalog.related(pick, index.movies, 5);
          const relatedHtml = similar.length
            ? '<h3 class="subhead">Related</h3>' + similar.map((item) => filmArticle(item.film, { shared: Catalog.relatedReason(item, pick, index) })).join("")
            : '<p class="section-note">No related films yet.</p>';
          discoverBody.innerHTML = filmArticle(pick, { feature: true }) + relatedHtml;
        }
      }

      syncControls(pages);
      if (focusGroup) {
        const again = [...root.querySelectorAll("[data-group]")].find((node) => node.getAttribute("data-group") === focusGroup);
        if (again) again.focus();
      }
      if (scroll) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        byId("results").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
    }

    function stat(label, value) {
      return "<div><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>";
    }

    function syncControls(pages) {
      const query = byId("q");
      if (query && query.value !== state.query) query.value = state.query;
      for (const [id, key] of SELECTS) {
        const el = byId(id);
        if (el && el.value !== state[key]) el.value = state[key];
      }
      root.querySelectorAll("[data-mode]").forEach((button) => {
        button.setAttribute("aria-pressed", button.getAttribute("data-mode") === state.mode ? "true" : "false");
      });
      root.querySelectorAll("[data-group-only]").forEach((button) => {
        button.hidden = state.mode === "list";
      });
      const note = byId("facet-note");
      if (note) {
        const bits = [];
        if (MODE_NOTES[state.mode]) bits.push(MODE_NOTES[state.mode]);
        const genreNote = Catalog.facetNote(index, "genres", state.genre);
        const tagNote = Catalog.facetNote(index, "tags", state.tag);
        const kindNote = Catalog.facetNote(index, "kinds", state.kind);
        const decadeNote = Catalog.facetNote(index, "decades", state.decade);
        if (genreNote) bits.push(genreNote);
        if (tagNote) bits.push(tagNote);
        if (kindNote) bits.push(kindNote);
        if (decadeNote) bits.push(decadeNote);
        note.hidden = bits.length === 0;
        note.textContent = bits.join(" ");
      }
      root.querySelectorAll('[data-action="prev"]').forEach((button) => {
        button.disabled = state.page === 0;
      });
      root.querySelectorAll('[data-action="next"]').forEach((button) => {
        button.disabled = state.page >= pages - 1;
      });
      const theme = themeTarget.getAttribute("data-theme") === "light" ? "light" : "dark";
      const themeButton = byId("theme");
      if (themeButton) {
        themeButton.textContent = theme === "light" ? "Dark theme" : "Light theme";
        themeButton.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
      }
    }

    function toggleTheme() {
      const next = themeTarget.getAttribute("data-theme") === "light" ? "dark" : "light";
      themeTarget.setAttribute("data-theme", next);
      if (persistTheme) {
        try { localStorage.setItem("mf-theme", next); } catch (error) {}
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", next === "light" ? "#f4f0e7" : "#12100d");
      }
      render(false);
    }

    function applyCleared(next) {
      state.genre = next.genre;
      state.decade = next.decade;
      state.tag = next.tag;
      state.director = next.director;
      state.cast = next.cast;
      state.writer = next.writer;
      state.composer = next.composer;
      state.cinematographer = next.cinematographer;
      state.producer = next.producer;
      state.bonus = next.bonus;
      state.kind = next.kind;
    }

    function runSearch(query, scroll) {
      state.query = query;
      state.mode = "list";
      state.page = 0;
      state.seedMode = true;
      applyCleared(clearedFilters(index, state, query));
      render(Boolean(scroll));
    }

    function clearFilters() {
      state.genre = defaults.genre;
      state.decade = defaults.decade;
      state.tag = defaults.tag;
      state.director = defaults.director;
      state.cast = defaults.cast;
      state.writer = defaults.writer;
      state.composer = defaults.composer;
      state.cinematographer = defaults.cinematographer;
      state.producer = defaults.producer;
      state.bonus = defaults.bonus;
      state.kind = defaults.kind;
      state.query = "";
      state.page = 0;
      state.seedMode = true;
    }

    function pivot(key, value) {
      if (!PIVOT_KEYS.includes(key) || !value) return;
      state.genre = "All";
      state.decade = "All";
      state.tag = "All";
      state.director = "All";
      state.cast = "All";
      state.writer = "All";
      state.composer = "All";
      state.cinematographer = "All";
      state.producer = "All";
      state.bonus = "All";
      state.kind = "All";
      state.query = "";
      state.page = 0;
      state.seedMode = true;
      state[key] = value;
    }

    function downloadCsv(filename, text) {
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function scrollToDiscover() {
      const discover = byId("discover");
      if (!discover) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      discover.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }

    function onClick(event) {
      const el = event.target.closest("[data-action]");
      if (!el || el.disabled) return;
      const action = el.getAttribute("data-action");
      if (action === "mode") {
        state.mode = el.getAttribute("data-mode");
        state.page = 0;
        state.seedMode = true;
        render(false);
      } else if (action === "group") {
        const id = el.getAttribute("data-group");
        state.open[id] = !state.open[id];
        render(false);
      } else if (action === "prev") {
        state.page -= 1;
        render(true);
      } else if (action === "next") {
        state.page += 1;
        render(true);
      } else if (action === "expand") {
        for (const group of currentGroups(currentRows())) state.open[groupDomId(group.key)] = true;
        render(false);
      } else if (action === "collapse") {
        state.open = {};
        state.seedMode = false;
        render(false);
      } else if (action === "search") {
        runSearch(el.getAttribute("data-query") || "", true);
      } else if (action === "clear") {
        clearFilters();
        render(false);
      } else if (action === "csv") {
        if (!index) return;
        downloadCsv("movie-finder.csv", Catalog.toCsv(currentRows()));
      } else if (action === "play") {
        const wrap = el.closest(".thumb-wrap");
        const id = el.getAttribute("data-youtube") || "";
        if (!wrap || !id) return;
        wrap.innerHTML = '<iframe class="player" title="YouTube video player" width="320" height="180" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1"></iframe>';
      } else if (action === "pivot") {
        pivot(el.getAttribute("data-key"), el.getAttribute("data-value"));
        render(false);
      } else if (action === "similar") {
        state.pickId = el.getAttribute("data-id");
        render(false);
        scrollToDiscover();
      } else if (action === "random") {
        const list = index.movies;
        if (!list.length) return;
        let next = list[Math.floor(Math.random() * list.length)];
        let guard = 0;
        while (list.length > 1 && next.id === state.pickId && guard < 8) {
          next = list[Math.floor(Math.random() * list.length)];
          guard += 1;
        }
        state.pickId = next.id;
        render(false);
        scrollToDiscover();
      } else if (action === "theme") {
        toggleTheme();
      }
    }

    function bind() {
      root.addEventListener("click", onClick);
      root.addEventListener("error", (event) => {
        const img = event.target;
        if (img && img.classList && img.classList.contains("thumb")) img.classList.add("is-broken");
      }, true);
      byId("q").addEventListener("input", (event) => {
        state.query = event.target.value;
        state.page = 0;
        render(false);
      });
      for (const [id, key] of SELECTS) {
        byId(id).addEventListener("change", (event) => {
          state[key] = event.target.value;
          state.page = 0;
          state.seedMode = true;
          render(false);
        });
      }
      root.addEventListener("keydown", (event) => {
        if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
        const tag = event.target && event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        event.preventDefault();
        byId("q").focus();
      });
    }

    const movies = Array.isArray(opts.movies) ? opts.movies : null;
    if (!movies) throw new Error("movies");
    index = Catalog.buildIndex(movies, opts.facets || {});
    defaults = presets(opts, index);
    state.genre = defaults.genre;
    state.decade = defaults.decade;
    state.tag = defaults.tag;
    state.director = defaults.director;
    state.cast = defaults.cast;
    state.writer = defaults.writer;
    state.composer = defaults.composer;
    state.cinematographer = defaults.cinematographer;
    state.producer = defaults.producer;
    state.bonus = defaults.bonus;
    state.kind = defaults.kind;
    state.pickId = movies[0] ? movies[0].id : "";
    bind();
    fillSelect("genre", index.genres, (value) => Catalog.labelFor(index, value));
    fillSelect("decade", index.decades, (value) => Catalog.labelFor(index, value));
    fillSelect("tag", index.tags, (value) => Catalog.labelFor(index, value));
    fillSelect("kind", index.kinds, (value) => Catalog.labelFor(index, value));
    for (const roleId of ROLE_IDS) fillPeople(roleId, roleId);
    const minutes = movies.reduce((sum, film) => sum + (film.runtime_minutes || 0), 0);
    const stats = byId("stats");
    if (stats) {
      stats.innerHTML =
        stat("Films", String(movies.length)) +
        stat("People", String(index.peopleTotal)) +
        stat("Runtime", Catalog.formatRuntime(minutes)) +
        stat("With a full video", String(index.withVideo)) +
        stat("Bonus features", String(index.withBonus));
    }
    const summary = byId("summary");
    if (summary) {
      summary.textContent = movies.length
        ? movies.length + " films. Search by title and people, and filter by genre, decade, tag, and crew."
        : "No films in the catalog yet. Genre, decade, tag, and kind filters load from the facet list.";
    }
    const peopleCount = byId("people-count");
    if (peopleCount) {
      const count = index.peopleTotal;
      peopleCount.textContent = count + " " + (count === 1 ? "person" : "people");
    }
    const genreCount = byId("genre-count");
    if (genreCount) genreCount.textContent = index.genres.length + " genres";
    const tagCount = byId("tag-count");
    if (tagCount) tagCount.textContent = index.tags.length + " tags";
    const availability = byId("availability");
    if (availability) {
      availability.textContent = index.latestChecked
        ? "Streaming availability changes. The newest source check in this catalog is " + index.latestChecked + "."
        : "Streaming availability changes. Each where-to-watch link is dated with the day it was checked.";
    }
    render(false);
    return { root };
  }

  return { mount, shellHtml, presets, clearedFilters };
});
