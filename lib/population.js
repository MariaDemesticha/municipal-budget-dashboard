import fs from 'fs';
import path from 'path';
import { normalizeGreek } from './diavgeia';

let cachedIndex = null;

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const [, ...rows] = lines;
  return rows.map((line) => {
    const cells = line.split(',');
    return {
      code: cells[0],
      name: cells[1] || '',
      population2021: Number.parseInt(cells[2], 10) || 0,
      population2011: Number.parseInt(cells[3], 10) || 0
    };
  });
}

function stemForm(value = '') {
  // Strip common Greek genitive endings to allow matching across declensions
  // (ΣΑΛΑΜΙΝΑΣ, ΣΑΛΑΜΙΝΟΣ → ΣΑΛΑΜΙΝ).
  return value.replace(/(ΟΣ|ΟΥ|ΑΣ|ΟΣ|ΗΣ|ΩΝ|ΕΣ|ΟΙ|ΕΩΣ|ΕΙΣ)$/u, '');
}

function buildIndex() {
  const csvPath = path.join(process.cwd(), 'lib', 'data', 'municipality_population_2021.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(content);

  const exact = new Map();
  const tokens = [];

  for (const row of rows) {
    const normalized = normalizeGreek(row.name).replace(/[^A-ZΑ-Ω\s-]/gu, '').replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    exact.set(normalized, row);
    const segments = normalized.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
    const stems = [stemForm(normalized), ...segments.map(stemForm)].filter((s) => s.length >= 5);
    tokens.push({ normalized, segments, stems, row });
  }

  return { exact, tokens };
}

function getIndex() {
  if (!cachedIndex) {
    cachedIndex = buildIndex();
  }
  return cachedIndex;
}

function stripDimosPrefix(value = '') {
  const normalized = normalizeGreek(value).replace(/\s+/g, ' ').trim();
  return normalized.replace(/^ΔΗΜΟΣ\s+/, '').trim();
}

export function lookupPopulation(orgTitle = '') {
  if (!orgTitle) return null;
  const query = stripDimosPrefix(orgTitle);
  if (!query) return null;

  const { exact, tokens } = getIndex();

  if (exact.has(query)) {
    return mapMatch(exact.get(query), 'exact');
  }

  for (const entry of tokens) {
    if (entry.segments.includes(query)) {
      return mapMatch(entry.row, 'segment');
    }
  }

  for (const entry of tokens) {
    if (entry.normalized.includes(query) || query.includes(entry.normalized)) {
      return mapMatch(entry.row, 'partial');
    }
  }

  // Stem fallback: strip Greek case endings and match by stem
  const queryStem = stemForm(query);
  if (queryStem && queryStem.length >= 5) {
    for (const entry of tokens) {
      if (entry.stems.some((stem) => stem === queryStem || stem.startsWith(queryStem) || queryStem.startsWith(stem))) {
        return mapMatch(entry.row, 'stem');
      }
    }
  }

  return null;
}

function mapMatch(row, matchType) {
  return {
    code: row.code,
    name: row.name,
    population: row.population2021,
    population2011: row.population2011,
    matchType
  };
}
