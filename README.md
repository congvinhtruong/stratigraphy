# Stratigraphy

**Interactive 3D layered network visualization for multi-year relational datasets.**

[Live Demo](https://congvinhtruong.github.io/stratigraphy/)

![Stratigraphy — AI Research on ArXiv](preview.png)

Stratigraphy renders temporal network data as stacked elliptical planes in 3D space. Each horizontal layer represents a year, with nodes clustered by category and sized by connection density. Connections within a year appear as solid lines; connections across years appear as dashed lines. The size of each ellipse reflects the volume of activity in that year.

Built with [Three.js](https://threejs.org/) — a single self-contained HTML file, no build step required.

---

## Features

- **3D layered layout** — Years stacked vertically as elliptical planes, navigable with orbit controls (rotate, zoom, pan)
- **Dynamic node sizing** — Nodes scale by connection density; highly connected nodes stand out
- **Dynamic layer sizing** — Ellipses scale by the number of nodes per year, revealing growth or decline
- **Filterable** — Filter by year, category, country, or search by name
- **Interactive** — Hover to highlight connections, click to zoom and inspect details
- **Citation direction** — Detail panel shows "Cited by" vs "Cites" for cross-year connections
- **Edge type toggles** — Click legend items to show/hide same-category or cross-year edges
- **Dataset switcher** — Load multiple datasets via a dropdown
- **Self-contained** — Single HTML file + JSON data, no server needed

## Included Dataset: AI Research on ArXiv

The included dataset visualizes **661 top-cited AI papers from ArXiv (2012-2026)**, sampled proportionally to reflect the explosion in AI research output.

- **Subfields**: AI General, Computer Vision, Machine Learning, NLP, Neural/Evolutionary
- **Nodes**: Papers sized by citation network density
- **Intra-edges** (solid): Papers in the same subfield & year sharing an author
- **Inter-edges** (dashed): Actual citation links between papers across years
- **Data source**: [OpenAlex API](https://openalex.org/) (free, open scholarly metadata)

The proportional sampling means early years (2012) have ~15 nodes while peak years (2023) have ~84, visually showing the research growth.

## Usage

### Quick start

1. Clone or download this repo
2. Open `index.html` in a browser, or serve locally:
   ```bash
   npx serve .
   ```
3. That's it — no dependencies, no build step

### Controls

| Action | Control |
|--------|---------|
| Rotate | Left-click + drag |
| Zoom | Scroll wheel |
| Pan | Right-click + drag |
| Inspect node | Click on a node |
| Filter | Use sidebar chips (year, category, country) |
| Toggle edges | Click legend items at bottom |
| Search | Type in the search box |
| Help | Click the `?` button (bottom-left) |

## Bring Your Own Data

Stratigraphy reads a single JSON file. Add your dataset to the dropdown by editing the `<select id="dataset-select">` in `index.html`.

### Data format

```json
{
  "meta": {
    "title": "My Dataset",
    "description": "A description of the dataset",
    "labels": {
      "project": "Category",
      "country": "Country"
    },
    "edgeDescriptions": {
      "intra": "What same-year edges represent",
      "inter": "What cross-year edges represent"
    }
  },
  "nodes": [
    {
      "id": "n1",
      "label": "Display Name",
      "year": 2020,
      "project": "Category A",
      "title": "Full title (shown in detail panel)",
      "description": "Optional description",
      "city": "Optional city",
      "country": "Optional country code",
      "website": "https://optional-link.com"
    }
  ],
  "edges": [
    {
      "source": "n1",
      "target": "n2",
      "type": "intra",
      "weight": 3
    }
  ]
}
```

### Node fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier |
| `label` | Yes | Short display name (shown on hover and as sprite) |
| `year` | Yes | Determines which layer the node sits on |
| `project` | Yes | Category for clustering and coloring |
| `title` | No | Full name shown in the detail panel |
| `description` | No | Additional info shown in detail panel |
| `city` | No | Used for display and filtering |
| `country` | No | Enables country filter and "Same Country" connections |
| `website` | No | Adds a clickable link in the detail panel |

### Edge fields

| Field | Required | Description |
|-------|----------|-------------|
| `source` | Yes | Source node `id` |
| `target` | Yes | Target node `id` |
| `type` | Yes | `"intra"` (solid, same-year) or `"inter"` (dashed, cross-year) |
| `weight` | No | Connection strength, 1-5 (default: 3) |

### Meta fields

| Field | Description |
|-------|-------------|
| `meta.labels.project` | Label for the category filter (e.g., "Subfield", "Department") |
| `meta.labels.country` | Label for the country filter |
| `meta.edgeDescriptions.intra` | Explains what same-year edges mean (e.g., "Shared author") |
| `meta.edgeDescriptions.inter` | Explains what cross-year edges mean (e.g., "Citation link") |

## Dataset ideas

Stratigraphy works well for any data with:
- A **time dimension** (years)
- **Categories** for clustering
- **Relationships** within and across time periods

Some examples:
- **Scientific citations** — Papers by field, with citation links
- **Music collaborations** — Artists by genre, with co-production edges
- **Open source projects** — Repos by language/framework, with dependency edges
- **Film/TV** — Productions by genre, with shared cast/crew connections
- **Patent networks** — Inventions by field, with prior-art citations
- **Legislative networks** — Bills by committee, with co-sponsorship links

## Generating the ArXiv dataset

The included `fetch-arxiv.js` script fetches AI papers from the [OpenAlex API](https://docs.openalex.org/):

```bash
node fetch-arxiv.js
```

This takes a few minutes and creates `arxiv-ai-data.json`. The script:
1. Counts total papers per subfield/year
2. Calculates proportional sample sizes (target ~1500, deduplicates to ~661)
3. Fetches top-cited papers for each subfield/year
4. Builds citation edges from `referenced_works`
5. Builds co-author edges within same subfield+year

You can customize subfields, year range, and sampling parameters at the top of the script.

## Tech stack

- [Three.js](https://threejs.org/) r164 — 3D WebGL rendering
- [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls) — Camera navigation
- Vanilla HTML/CSS/JS — No framework, no build step
- [OpenAlex API](https://openalex.org/) — Scholarly data (free, no key required)

## Credits

Created by **Vinh Truong** with Claude.

## License

MIT
