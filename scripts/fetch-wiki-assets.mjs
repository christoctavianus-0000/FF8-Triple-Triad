import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CARDS_DIR = path.join(ROOT, 'public', 'assets', 'cards');
const ELEMENTS_DIR = path.join(ROOT, 'public', 'assets', 'elements');
const OUTPUT_TS = path.join(ROOT, 'src', 'data', 'cards.ts');

const API_BASE = 'https://finalfantasy.fandom.com/api.php';
const HEADERS = { 'User-Agent': 'FF8TripleTriadRemake/1.0 (local dev asset sync)' };

const ELEMENT_FILES = {
  earth: 'File:Tripletriad-earth.png',
  fire: 'File:Tripletriad-fire.png',
  ice: 'File:Tripletriad-ice.png',
  poison: 'File:Tripletriad-poison.png',
  thunder: 'File:Tripletriad-thunder.png',
  water: 'File:Tripletriad-water.png',
  wind: 'File:Tripletriad-wind.png',
  holy: 'File:Tripletriad-holy.png',
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanWikiText(raw) {
  return raw
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRankToken(tok) {
  const t = tok.trim().toUpperCase();
  if (t === 'A' || t === '10') return 10;
  const n = Number.parseInt(t, 10);
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    throw new Error(`Invalid rank token: ${tok}`);
  }
  return n;
}

function normalizeElement(raw) {
  const s = cleanWikiText(raw || '').toLowerCase();
  if (!s || s === 'none' || s === '-' || s === 'n/a') return 'none';
  if (s.includes('lightning') || s.includes('thunder')) return 'thunder';
  if (s.includes('earth')) return 'earth';
  if (s.includes('fire')) return 'fire';
  if (s.includes('ice')) return 'ice';
  if (s.includes('poison')) return 'poison';
  if (s.includes('water')) return 'water';
  if (s.includes('wind')) return 'wind';
  if (s.includes('holy')) return 'holy';
  throw new Error(`Unknown element: "${raw}"`);
}

async function fetchJson(params) {
  const url = `${API_BASE}?${new URLSearchParams({ ...params, format: 'json' }).toString()}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

function parseListPage(wikitext) {
  const lines = wikitext.split(/\r?\n/);
  let currentCategory = 'monster';
  let currentLevel = 0;
  const entries = [];
  let pending = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (/^==\s*Monster cards\s*==/i.test(line)) currentCategory = 'monster';
    else if (/^==\s*Boss cards\s*==/i.test(line)) currentCategory = 'boss';
    else if (/^==\s*GF cards\s*==/i.test(line)) currentCategory = 'gf';
    else if (/^==\s*Character cards\s*==/i.test(line)) currentCategory = 'character';

    const lvlMatch = line.match(/^===\s*Level\s+(\d+)\s*===/i);
    if (lvlMatch) {
      currentLevel = Number.parseInt(lvlMatch[1], 10);
      continue;
    }

    const laMatch = line.match(/\{\{LA\|([^|}]+)\|([^}]+)\}\}/);
    if (line.startsWith('!') && laMatch && currentLevel >= 1 && currentLevel <= 10) {
      if (pending) entries.push(pending);
      const elemMatch = line.match(/Element:([A-Za-z]+)/i);
      pending = {
        pageTitle: laMatch[1].trim(),
        name: laMatch[2].trim(),
        level: currentLevel,
        category: currentCategory,
        listElement: elemMatch ? normalizeElement(elemMatch[1]) : 'none',
        ttFile: '',
        cardMod: '',
        colStep: 0,
      };
      continue;
    }

    if (pending) {
      if (line === '|-' || line === '|}') {
        entries.push(pending);
        pending = null;
        continue;
      }
      const imgMatch = line.match(/\[\[File:(TT[^|\]]+\.png)/i);
      if (imgMatch && !pending.ttFile) {
        pending.ttFile = `File:${imgMatch[1].trim()}`;
        pending.colStep = 1;
        continue;
      }
      if (pending.colStep === 1 && line.startsWith('|') && !line.startsWith('|style=')) {
        pending.cardMod = cleanWikiText(line.slice(1));
        pending.colStep = 2;
      }
    }
  }
  if (pending) entries.push(pending);
  return entries;
}

async function fetchRevisions(titles) {
  const map = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const data = await fetchJson({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
      titles: batch.join('|'),
    });
    const redirects = new Map();
    for (const r of data.query?.redirects ?? []) {
      redirects.set(r.to, r.from);
    }
    for (const page of Object.values(data.query?.pages ?? {})) {
      const content = page.revisions?.[0]?.slots?.main?.['*'] ?? '';
      map.set(page.title, content);
      if (redirects.has(page.title)) {
        map.set(redirects.get(page.title), content);
      }
    }
  }
  return map;
}

function parseInfobox(wikitext, fallbackName) {
  const statsMatch = wikitext.match(/\|stats=([^\n]+)/);
  if (!statsMatch) {
    throw new Error(`Missing |stats= for ${fallbackName}`);
  }
  const cleanStats = statsMatch[1]
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  const tokens = cleanStats.split(/\s+/).filter(Boolean);
  if (tokens.length !== 4) {
    throw new Error(`Unexpected stats tokens for ${fallbackName}: ${JSON.stringify(tokens)}`);
  }
  // FF8 infobox layout: top <br/> left right <br/> bottom
  const [top, left, right, bottom] = tokens.map(parseRankToken);

  const elemMatch = wikitext.match(/\|element=([^\n]+)/);
  const element = normalizeElement(elemMatch ? elemMatch[1] : 'none');

  const ttMatch = wikitext.match(/(TT[A-Za-z0-9_-]+\.png)/i);
  const ttFile = ttMatch ? `File:${ttMatch[1]}` : '';

  return {
    ranks: { top, right, bottom, left },
    element,
    ttFile,
  };
}

async function fetchImageUrls(fileTitles) {
  const urlMap = new Map();
  const unique = [...new Set(fileTitles.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const data = await fetchJson({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|mime|size',
      titles: batch.join('|'),
    });
    const normalized = new Map();
    for (const n of data.query?.normalized ?? []) {
      normalized.set(n.to, n.from);
    }
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info?.url) continue;
      urlMap.set(page.title, info.url);
      if (normalized.has(page.title)) {
        urlMap.set(normalized.get(page.title), info.url);
      }
    }
  }
  return urlMap;
}

async function downloadPng(url, destPath) {
  const targetUrl = url.includes('?') ? `${url}&format=original` : `${url}?format=original`;
  const res = await fetch(targetUrl, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${targetUrl}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const isPng = buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!isPng) {
    throw new Error(`Downloaded asset is not a PNG (${buf.subarray(0, 8).toString('hex')}): ${targetUrl}`);
  }
  await fs.writeFile(destPath, buf);
}

async function runPool(items, concurrency, fn) {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const current = items[idx];
      idx += 1;
      await fn(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

async function main() {
  await fs.mkdir(CARDS_DIR, { recursive: true });
  await fs.mkdir(ELEMENTS_DIR, { recursive: true });
  await fs.mkdir(path.dirname(OUTPUT_TS), { recursive: true });

  console.log('1. Fetching master card list wikitext...');
  const listData = await fetchJson({
    action: 'parse',
    page: 'Final_Fantasy_VIII_Triple_Triad_cards',
    prop: 'wikitext',
  });
  const listEntries = parseListPage(listData.parse.wikitext['*']);
  if (listEntries.length !== 110) {
    throw new Error(`Expected 110 cards, got ${listEntries.length}`);
  }
  console.log(`Parsed ${listEntries.length} card entries from wiki list.`);

  console.log('2. Fetching individual card infoboxes...');
  const revisions = await fetchRevisions(listEntries.map((e) => e.pageTitle));

  const cards = listEntries.map((entry, idx) => {
    const wt = revisions.get(entry.pageTitle);
    if (!wt) {
      throw new Error(`Missing revision wikitext for ${entry.pageTitle}`);
    }
    const info = parseInfobox(wt, entry.name);
    const id = slugify(entry.name);
    const ttFile = entry.ttFile || info.ttFile;
    if (!ttFile) {
      throw new Error(`Missing TT image file for ${entry.name}`);
    }
    const element = info.element !== 'none' ? info.element : entry.listElement;
    return {
      index: idx + 1,
      id,
      name: entry.name,
      level: entry.level,
      category: entry.category,
      ranks: info.ranks,
      element,
      cardMod: entry.cardMod || 'None',
      isRare: entry.level >= 8,
      ttFile,
      imagePath: `./assets/cards/${id}.png`,
    };
  });

  console.log('3. Resolving wiki image URLs...');
  const allFileTitles = [
    ...cards.map((c) => c.ttFile),
    ...Object.values(ELEMENT_FILES),
  ];
  const urlMap = await fetchImageUrls(allFileTitles);

  const downloads = [];
  for (const card of cards) {
    const url = urlMap.get(card.ttFile) || urlMap.get(card.ttFile.replace(/_/g, ' '));
    if (!url) {
      throw new Error(`Missing imageinfo URL for ${card.ttFile} (${card.name})`);
    }
    downloads.push({
      label: card.id,
      url,
      dest: path.join(CARDS_DIR, `${card.id}.png`),
    });
  }
  for (const [elem, fileTitle] of Object.entries(ELEMENT_FILES)) {
    const url = urlMap.get(fileTitle);
    if (!url) {
      throw new Error(`Missing element icon URL for ${fileTitle}`);
    }
    downloads.push({
      label: `elem:${elem}`,
      url,
      dest: path.join(ELEMENTS_DIR, `${elem}.png`),
    });
  }

  console.log(`4. Downloading ${downloads.length} PNG assets...`);
  await runPool(downloads, 6, async (item) => {
    await downloadPng(item.url, item.dest);
  });

  const cleanCards = cards.map(({ ttFile: _tt, ...rest }) => rest);
  const tsSource = `// Auto-generated by scripts/fetch-wiki-assets.mjs from Final Fantasy Wiki (110 canonical FF8 Triple Triad cards)
import type { CardDefinition } from '../types/tripleTriad';

export const ALL_CARDS: readonly CardDefinition[] = ${JSON.stringify(cleanCards, null, 2)} as const;

export const CARDS_BY_ID: Readonly<Record<string, CardDefinition>> = Object.fromEntries(
  ALL_CARDS.map((card) => [card.id, card]),
);

export function getCardById(id: string): CardDefinition {
  const card = CARDS_BY_ID[id];
  if (!card) {
    throw new Error(\`Unknown Triple Triad card id: \${id}\`);
  }
  return card;
}
`;
  await fs.writeFile(OUTPUT_TS, tsSource, 'utf8');
  console.log(`5. Wrote ${cleanCards.length} cards to ${OUTPUT_TS}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
