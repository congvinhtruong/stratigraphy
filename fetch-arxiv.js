/**
 * ArXiv AI Papers → Stratigraphy data.json
 *
 * Uses OpenAlex API (free, no key needed) to fetch:
 * - AI papers from ArXiv (cs.AI, cs.LG, cs.CL, cs.CV, cs.RO, stat.ML)
 * - Citation links between them
 * - Author institutions
 *
 * OpenAlex docs: https://docs.openalex.org/
 *
 * Usage: node fetch-arxiv.js
 *
 * This will create arxiv-ai-data.json in Stratigraphy format.
 */

const https = require('https');
const fs = require('fs');

// ─── Configuration ───
const SUBFIELDS = {
  'cs.AI': 'AI General',
  'cs.LG': 'Machine Learning',
  'cs.CL': 'NLP',
  'cs.CV': 'Computer Vision',
  'cs.RO': 'Robotics',
  'stat.ML': 'Statistical ML',
  'cs.NE': 'Neural/Evolutionary',
  'cs.MA': 'Multi-Agent',
};

const YEARS = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// Proportional sampling: target ~1500 total nodes
// We'll fetch counts first, then sample proportionally
const TARGET_TOTAL_NODES = 1500;
const MIN_PER_SUBFIELD_YEAR = 2;
const MAX_PER_SUBFIELD_YEAR = 40;

// ─── Helpers ───
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Stratigraphy/1.0 (mailto:your@email.com)' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Failed to parse: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main ───
async function main() {
  console.log('Phase 1: Counting papers per subfield per year...\n');

  // Step 1: Get total counts for each subfield+year
  const counts = {};
  let grandTotal = 0;
  for (const [arxivCat, subfield] of Object.entries(SUBFIELDS)) {
    for (const year of YEARS) {
      const url = `https://api.openalex.org/works?` + [
        `filter=primary_location.source.id:S4306400194,` +
        `publication_year:${year},` +
        `concepts.id:C${conceptIdForCategory(arxivCat)}`,
        `per_page=1`,
        `select=id`,
      ].join('&');
      try {
        const resp = await fetchJSON(url);
        const count = resp.meta?.count || 0;
        counts[`${subfield}-${year}`] = count;
        grandTotal += count;
        process.stdout.write(`  ${subfield} ${year}: ${count} papers\n`);
      } catch (e) {
        counts[`${subfield}-${year}`] = 0;
      }
      await sleep(50);
    }
  }

  // Step 2: Calculate proportional sample sizes
  console.log(`\nTotal papers across all subfields+years: ${grandTotal}`);
  console.log(`Target nodes: ${TARGET_TOTAL_NODES}\n`);
  console.log('Phase 2: Fetching proportional samples...\n');

  const sampleSizes = {};
  for (const key of Object.keys(counts)) {
    const raw = Math.round((counts[key] / grandTotal) * TARGET_TOTAL_NODES);
    sampleSizes[key] = Math.max(MIN_PER_SUBFIELD_YEAR, Math.min(MAX_PER_SUBFIELD_YEAR, raw));
  }

  // Log the plan
  const activeSubfields = [...new Set(Object.keys(SUBFIELDS).map(k => SUBFIELDS[k]))];
  for (const year of YEARS) {
    const yearTotal = activeSubfields.reduce((s, sf) => s + (sampleSizes[`${sf}-${year}`] || 0), 0);
    const yearCount = activeSubfields.reduce((s, sf) => s + (counts[`${sf}-${year}`] || 0), 0);
    console.log(`  ${year}: ${yearCount} total → sampling ${yearTotal} papers`);
  }
  console.log('');

  // Step 3: Fetch papers
  const allPapers = [];

  for (const [arxivCat, subfield] of Object.entries(SUBFIELDS)) {
    for (const year of YEARS) {
      const perPage = sampleSizes[`${subfield}-${year}`] || MIN_PER_SUBFIELD_YEAR;
      if (perPage === 0) continue;

      const url = `https://api.openalex.org/works?` + [
        `filter=primary_location.source.id:S4306400194,` +
        `publication_year:${year},` +
        `concepts.id:C${conceptIdForCategory(arxivCat)}`,
        `sort=cited_by_count:desc`,
        `per_page=${perPage}`,
        `select=id,doi,title,publication_year,cited_by_count,authorships,concepts,primary_location,referenced_works`,
      ].join('&');

      try {
        const resp = await fetchJSON(url);
        if (resp.results) {
          resp.results.forEach(paper => {
            allPapers.push({
              openalex_id: paper.id,
              title: paper.title,
              year: paper.publication_year,
              subfield: subfield,
              arxiv_cat: arxivCat,
              citations: paper.cited_by_count || 0,
              authors: (paper.authorships || []).slice(0, 5).map(a => ({
                name: a.author?.display_name,
                institution: a.institutions?.[0]?.display_name || a.raw_affiliation_strings?.[0] || '',
                country: a.institutions?.[0]?.country_code || a.countries?.[0] || '',
              })),
              references: (paper.referenced_works || []),
              doi: paper.doi,
            });
          });
          console.log(`  ${subfield} ${year}: ${resp.results.length} papers (of ${counts[`${subfield}-${year}`]})`);
        }
      } catch (e) {
        console.log(`  ${subfield} ${year}: FAILED - ${e.message}`);
      }

      await sleep(100);
    }
  }

  console.log(`\nTotal papers fetched: ${allPapers.length}`);

  // ─── Build Stratigraphy format ───

  // Deduplicate: by OpenAlex ID, keep earliest year (preprint date)
  // Also deduplicate by title to catch re-indexed papers
  const paperMap = new Map();
  const titleMap = new Map();
  allPapers.forEach(p => {
    const normTitle = (p.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    // By OpenAlex ID
    if (paperMap.has(p.openalex_id)) {
      const existing = paperMap.get(p.openalex_id);
      if (p.year < existing.year) paperMap.set(p.openalex_id, p); // keep earliest
    } else {
      paperMap.set(p.openalex_id, p);
    }
    // By title — flag duplicates
    if (titleMap.has(normTitle)) {
      const existing = titleMap.get(normTitle);
      if (p.year < existing.year) titleMap.set(normTitle, p);
    } else {
      titleMap.set(normTitle, p);
    }
  });
  // Merge: use title-deduped set (keeps earliest year for duplicates)
  const seenTitles = new Set();
  const papers = [];
  for (const p of paperMap.values()) {
    const normTitle = (p.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seenTitles.has(normTitle)) {
      seenTitles.add(normTitle);
      // Use earliest year from title map
      const best = titleMap.get(normTitle);
      if (best && best.year < p.year) p.year = best.year;
      papers.push(p);
    }
  }

  // Build nodes
  const nodes = papers.map((p, i) => ({
    id: `p${i}`,
    label: truncate(p.title, 40),
    year: p.year,
    project: p.subfield,          // Cluster by subfield
    role: p.subfield,
    title: p.title,
    description: `${p.citations} citations`,
    city: p.authors[0]?.institution || '',
    country: p.authors[0]?.country || '',
    website: p.doi || '',
    authors: p.authors.map(a => a.name).join(', '),
    citations: p.citations,
  }));

  // Build ID lookup for edges
  const openalexToId = new Map();
  papers.forEach((p, i) => openalexToId.set(p.openalex_id, `p${i}`));

  // Intra edges: papers in same subfield+year that share an author
  const edges = [];
  const bySubfieldYear = {};
  papers.forEach((p, i) => {
    const key = `${p.year}-${p.subfield}`;
    if (!bySubfieldYear[key]) bySubfieldYear[key] = [];
    bySubfieldYear[key].push({ paper: p, idx: i });
  });

  for (const [key, group] of Object.entries(bySubfieldYear)) {
    const edgeSet = new Set();
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        // Only connect papers that share at least one author
        const authorsA = new Set(group[i].paper.authors.map(a => a.name));
        const shared = group[j].paper.authors.some(a => authorsA.has(a.name));
        if (shared) {
          const eid = `p${group[i].idx}-p${group[j].idx}`;
          if (!edgeSet.has(eid)) {
            edgeSet.add(eid);
            edges.push({
              source: `p${group[i].idx}`,
              target: `p${group[j].idx}`,
              type: 'intra',
              weight: 4
            });
          }
        }
      }
    }
  }

  // Inter edges: citation links across years
  papers.forEach((p, i) => {
    p.references.forEach(ref => {
      const targetId = openalexToId.get(ref);
      if (targetId && targetId !== `p${i}`) {
        const targetPaper = papers[parseInt(targetId.slice(1))];
        if (targetPaper && targetPaper.year !== p.year) {
          edges.push({
            source: `p${i}`,
            target: targetId,
            type: 'inter',
            weight: 3
          });
        }
      }
    });
  });

  console.log(`\nStratigraphy output: ${nodes.length} nodes, ${edges.length} edges`);
  console.log(`Years: ${[...new Set(nodes.map(n => n.year))].sort().join(', ')}`);
  console.log(`Subfields: ${[...new Set(nodes.map(n => n.project))].sort().join(', ')}`);

  const output = {
    meta: {
      title: "AI Research on ArXiv",
      description: "Top-cited AI papers from ArXiv, clustered by subfield, with citation links across years. Data from OpenAlex.",
      schema: {
        nodes: {
          id: "string",
          label: "string — truncated paper title",
          year: "number — publication year",
          project: "string — AI subfield (NLP, Vision, ML...)",
          title: "string — full paper title",
          description: "string — citation count",
          city: "string — first author's institution",
          country: "string — first author's country",
          website: "string — DOI link",
          authors: "string — author names",
          citations: "number — total citation count"
        },
        edges: {
          source: "string — node id",
          target: "string — node id",
          type: "string — intra (same subfield+year) | inter (citation across years)",
          weight: "number — 1-5"
        }
      }
    },
    nodes,
    edges
  };

  fs.writeFileSync('/Users/vinht/3d-viz/arxiv-ai-data.json', JSON.stringify(output, null, 2));
  console.log('\nSaved to arxiv-ai-data.json');
}

// ─── Concept IDs (OpenAlex) ───
// These are approximate OpenAlex concept IDs for ArXiv categories
function conceptIdForCategory(cat) {
  const map = {
    'cs.AI': '154945302',    // Artificial intelligence
    'cs.LG': '119857082',    // Machine learning
    'cs.CL': '204321447',    // Computational linguistics / NLP
    'cs.CV': '31972630',     // Computer vision
    'cs.RO': '1123924',      // Robotics
    'stat.ML': '119857082',  // Machine learning (same concept)
    'cs.NE': '39432304',     // Neural networks
    'cs.MA': '152520768',    // Multi-agent systems
  };
  return map[cat] || '154945302';
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

main().catch(console.error);
