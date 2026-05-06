import fs from 'fs';
import path from 'path';
import { normalizeGreek } from './diavgeia';

const SNAPSHOTS_DIR = path.join(process.cwd(), 'lib', 'data', 'snapshots');
const MUNICIPALITIES_PATH = path.join(process.cwd(), 'lib', 'data', 'diavgeia_municipalities.json');

let cachedIndex = null;
let cachedMunicipalities = null;
const cachedSnapshots = new Map();

function loadJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return null;
  }
}

export function getSnapshotIndex() {
  if (cachedIndex) return cachedIndex;
  const indexPath = path.join(SNAPSHOTS_DIR, 'index.json');
  const data = loadJsonSafe(indexPath);
  if (!data) {
    cachedIndex = { generatedAt: null, orgs: [] };
    return cachedIndex;
  }
  cachedIndex = data;
  return cachedIndex;
}

export function getSnapshot(uid) {
  if (!uid) return null;
  if (cachedSnapshots.has(uid)) return cachedSnapshots.get(uid);
  const filePath = path.join(SNAPSHOTS_DIR, `${uid}.json`);
  const data = loadJsonSafe(filePath);
  cachedSnapshots.set(uid, data);
  return data;
}

export function listAvailableOrgs() {
  const index = getSnapshotIndex();
  return (index.orgs || []).filter((org) => !org.error);
}

export function listAllMunicipalities() {
  if (cachedMunicipalities) return cachedMunicipalities;
  const data = loadJsonSafe(MUNICIPALITIES_PATH);
  cachedMunicipalities = data?.municipalities || [];
  return cachedMunicipalities;
}

function buildOrgUniverse() {
  const available = listAvailableOrgs();
  const availableByUid = new Map(available.map((org) => [org.uid, org]));
  const municipalities = listAllMunicipalities();

  const universe = municipalities.map((m) => {
    const snap = availableByUid.get(m.uid);
    return {
      uid: m.uid,
      label: m.label,
      vatNumber: m.vatNumber || '',
      dataAvailable: !!snap,
      sampleSize: snap?.sampleSize || 0,
      yearsCovered: snap?.yearsCovered || [],
      snapshotDate: snap?.snapshotDate || null
    };
  });

  // Add any snapshot orgs that aren't in the municipalities file (e.g. legacy/non-MUNICIPALITY)
  for (const org of available) {
    if (!universe.some((u) => u.uid === org.uid)) {
      universe.push({
        uid: org.uid,
        label: org.label,
        vatNumber: '',
        dataAvailable: true,
        sampleSize: org.sampleSize || 0,
        yearsCovered: org.yearsCovered || [],
        snapshotDate: org.snapshotDate || null
      });
    }
  }

  return universe;
}

function scoreOrg(label, term) {
  const normalizedLabel = normalizeGreek(label);
  const normalizedTerm = normalizeGreek(term);
  if (!normalizedLabel || !normalizedTerm) return 0;

  let score = 0;
  if (normalizedLabel === normalizedTerm) score += 200;
  if (normalizedLabel.startsWith(normalizedTerm)) score += 90;
  if (normalizedLabel.includes(normalizedTerm)) score += 55;

  const termWords = normalizedTerm.split(/\s+/).filter(Boolean);
  if (termWords.length > 1 && termWords.every((word) => normalizedLabel.includes(word))) {
    score += 50;
  }

  if (normalizedLabel.startsWith(`ΔΗΜΟΣ ${normalizedTerm}`)) score += 180;
  if (normalizedLabel.includes(`ΔΗΜΟΣ ${normalizedTerm}`)) score += 60;

  // Tail-word genitive endings (ΣΑΛΑΜΙΝΑ → ΣΑΛΑΜΙΝΑΣ etc.)
  const lastWord = termWords[termWords.length - 1];
  if (lastWord) {
    const stem = lastWord.replace(/[ΑΗΟΩΥ]$/u, '');
    if (stem && normalizedLabel.includes(stem)) score += 25;
  }

  return score;
}

export function searchOrgs(term, limit = 10) {
  const universe = buildOrgUniverse();
  return universe
    .map((org) => ({ ...org, score: scoreOrg(org.label, term) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      // Available data wins ties
      if (b.score !== a.score) return b.score - a.score;
      if (a.dataAvailable !== b.dataAvailable) return a.dataAvailable ? -1 : 1;
      return a.label.length - b.label.length;
    })
    .slice(0, limit);
}

export function getDecisionsForYear(uid, year, decisionTypeUid) {
  const snapshot = getSnapshot(uid);
  if (!snapshot) return [];
  const yearStr = String(year || '').trim();
  return (snapshot.decisions || []).filter((decision) => {
    if (decisionTypeUid && decision.decisionTypeUid !== decisionTypeUid) return false;
    if (!yearStr) return true;
    return String(decision.year || '') === yearStr;
  });
}

export function listSnapshotYears(uid) {
  const snapshot = getSnapshot(uid);
  if (!snapshot) return [];
  return [...(snapshot.yearsCovered || [])];
}

export function getOrgMeta(uid) {
  const snapshot = getSnapshot(uid);
  if (!snapshot) return null;
  return {
    uid: snapshot.uid,
    label: snapshot.label,
    snapshotDate: snapshot.snapshotDate,
    upstreamTotalsByType: snapshot.upstreamTotalsByType,
    sampleSize: snapshot.sampleSize,
    yearsCovered: snapshot.yearsCovered,
    decisionTypes: snapshot.decisionTypes
  };
}
