#!/usr/bin/env node
// Pre-compute decision snapshots for selected δήμους from Diavgeia luminapi.
// Usage: node scripts/snapshot-luminapi.mjs [count]   (default 1500 decisions/org/type)
//
// Output:
//   lib/data/snapshots/index.json — registry of available orgs
//   lib/data/snapshots/{uid}.json — per-org snapshot

import { writeFile, mkdir, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SKIP_RECENT_HOURS = Number.parseInt(process.env.SKIP_RECENT_HOURS, 10) || 24;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'lib', 'data', 'snapshots');

const LUMINAPI_BASE = 'https://diavgeia.gov.gr/luminapi';
const SEARCH_PAGE_SIZE = 100; // luminapi caps at 100 per page
// Pagination strategy: keep paging until either (a) we've reached MIN_YEAR or older,
// or (b) we hit HARD_CAP. MIN_YEAR ensures coverage of the most recent N years
// even for large δήμους.
const HARD_CAP = Number.parseInt(process.argv[2], 10) || 5000;
const MIN_YEAR = Number.parseInt(process.argv[3], 10) || new Date().getFullYear() - 2;
const CONCURRENCY = 20;
const DECISION_TYPES = ['Β.2.2', 'Β.1.3'];

const TARGETS = [
  { uid: '6013', label: 'ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ' },
  { uid: '6114', label: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ' },
  { uid: '6241', label: 'ΔΗΜΟΣ ΠΑΤΡΕΩΝ' },
  { uid: '6167', label: 'ΔΗΜΟΣ ΛΑΡΙΣΑΙΩΝ' },
  { uid: '6243', label: 'ΔΗΜΟΣ ΠΕΙΡΑΙΩΣ' },
  { uid: '6058', label: 'ΔΗΜΟΣ ΒΟΛΟΥ' },
  { uid: '6247', label: 'ΔΗΜΟΣ ΠΕΡΙΣΤΕΡΙΟΥ' },
  { uid: '6265', label: 'ΔΗΜΟΣ ΡΟΔΟΥ' },
  { uid: '6125', label: 'ΔΗΜΟΣ ΙΩΑΝΝΙΤΩΝ' },
  { uid: '6318', label: 'ΔΗΜΟΣ ΧΑΝΙΩΝ' },
  { uid: '6317', label: 'ΔΗΜΟΣ ΧΑΛΚΙΔΕΩΝ' },
  { uid: '6050', label: 'ΔΗΜΟΣ ΑΧΑΡΝΩΝ' },
  { uid: '6157', label: 'ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ - ΕΥΟΣΜΟΥ' },
  { uid: '6242', label: 'ΔΗΜΟΣ ΠΑΥΛΟΥ ΜΕΛΑ' },
  { uid: '6132', label: 'ΔΗΜΟΣ ΚΑΛΛΙΘΕΑΣ' },
  { uid: '6129', label: 'ΔΗΜΟΣ ΚΑΛΑΜΑΡΙΑΣ' },
  { uid: '6066', label: 'ΔΗΜΟΣ ΓΛΥΦΑΔΑΣ' },
  { uid: '6146', label: 'ΔΗΜΟΣ ΚΕΡΑΤΣΙΝΙΟΥ - ΔΡΑΠΕΤΣΩΝΑΣ' },
  { uid: '6012', label: 'ΔΗΜΟΣ ΑΓΡΙΝΙΟΥ' },
  { uid: '6123', label: 'ΔΗΜΟΣ ΙΛΙΟΥ' },
  { uid: '6142', label: 'ΔΗΜΟΣ ΚΑΤΕΡΙΝΗΣ' },
  { uid: '6207', label: 'ΔΗΜΟΣ ΝΕΑΠΟΛΗΣ - ΣΥΚΕΩΝ' },
  { uid: '6298', label: 'ΔΗΜΟΣ ΤΡΙΚΚΑΙΩΝ' },
  { uid: '6314', label: 'ΔΗΜΟΣ ΧΑΛΑΝΔΡΙΟΥ' },
  { uid: '6107', label: 'ΔΗΜΟΣ ΗΛΙΟΥΠΟΛΗΣ' },
  { uid: '6272', label: 'ΔΗΜΟΣ ΣΕΡΡΩΝ' },
  { uid: '6149', label: 'ΔΗΜΟΣ ΚΗΦΙΣΙΑΣ' },
  { uid: '6211', label: 'ΔΗΜΟΣ ΝΕΑΣ ΣΜΥΡΝΗΣ' },
  { uid: '6257', label: 'ΔΗΜΟΣ ΠΥΛΑΙΑΣ - ΧΟΡΤΙΑΤΗ' },
  { uid: '6130', label: 'ΔΗΜΟΣ ΚΑΛΑΜΑΤΑΣ' },
  { uid: '6007', label: 'ΔΗΜΟΣ ΑΓΙΟΥ ΔΗΜΗΤΡΙΟΥ' },
  { uid: '6019', label: 'ΔΗΜΟΣ ΑΛΕΞΑΝΔΡΟΥΠΟΛΗΣ' },
  { uid: '6026', label: 'ΔΗΜΟΣ ΑΜΑΡΟΥΣΙΟΥ' },
  { uid: '6104', label: 'ΔΗΜΟΣ ΖΩΓΡΑΦΟΥ' },
  { uid: '6154', label: 'ΔΗΜΟΣ ΚΟΖΑΝΗΣ' },
  { uid: '6166', label: 'ΔΗΜΟΣ ΛΑΜΙΕΩΝ' },
  { uid: '6220', label: 'ΔΗΜΟΣ ΞΑΝΘΗΣ' },
  { uid: '6126', label: 'ΔΗΜΟΣ ΚΑΒΑΛΑΣ' },
  { uid: '100049209', label: 'ΔΗΜΟΣ ΚΕΝΤΡΙΚΗΣ ΚΕΡΚΥΡΑΣ ΚΑΙ ΔΙΑΠΟΝΤΙΩΝ ΝΗΣΩΝ' },
  { uid: '6155', label: 'ΔΗΜΟΣ ΚΟΜΟΤΗΝΗΣ' },
  { uid: '6232', label: 'ΔΗΜΟΣ ΠΑΛΑΙΟΥ ΦΑΛΗΡΟΥ' },
  { uid: '6014', label: 'ΔΗΜΟΣ ΑΙΓΑΛΕΩ' },
  { uid: '6209', label: 'ΔΗΜΟΣ ΝΕΑΣ ΙΩΝΙΑΣ' },
  { uid: '6005', label: 'ΔΗΜΟΣ ΑΓΙΑΣ ΠΑΡΑΣΚΕΥΗΣ' },
  { uid: '6053', label: 'ΔΗΜΟΣ ΒΕΡΟΙΑΣ' },
  { uid: '6009', label: 'ΔΗΜΟΣ ΑΓΙΩΝ ΑΝΑΡΓΥΡΩΝ - ΚΑΜΑΤΕΡΟΥ' },
  { uid: '6159', label: 'ΔΗΜΟΣ ΚΟΡΥΔΑΛΛΟΥ' },
  { uid: '6234', label: 'ΔΗΜΟΣ ΠΑΛΛΗΝΗΣ' },
  { uid: '6248', label: 'ΔΗΜΟΣ ΠΕΤΡΟΥΠΟΛΗΣ' },
  { uid: '6062', label: 'ΔΗΜΟΣ ΒΥΡΩΝΟΣ' },
  { uid: '6266', label: 'ΔΗΜΟΣ ΣΑΛΑΜΙΝΑΣ' },
  { uid: '6109', label: 'ΔΗΜΟΣ ΗΡΑΚΛΕΙΟΥ' }
];

async function fetchJson(url, attempt = 0) {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      return fetchJson(url, attempt + 1);
    }
    throw error;
  }
}

function decisionYear(issueDate) {
  if (!issueDate || typeof issueDate !== 'string') return null;
  const parts = issueDate.split(' ')[0].split('/');
  if (parts.length !== 3) return null;
  return Number.parseInt(parts[2], 10) || null;
}

async function searchDecisionAdas(orgUid, decisionTypeUid, hardCap, minYear) {
  const adas = [];
  let totalUpstream = 0;
  let page = 0;
  let reachedMinYear = false;

  while (adas.length < hardCap && !reachedMinYear) {
    const queryParts = [`organizationUid:"${orgUid}"`, `decisionTypeUid:"${decisionTypeUid}"`];
    const query = encodeURIComponent(queryParts.join(' AND '));
    const url = `${LUMINAPI_BASE}/api/search?q=${query}&size=${SEARCH_PAGE_SIZE}&page=${page}&sort=recent`;

    const payload = await fetchJson(url);
    const items = Array.isArray(payload.decisions) ? payload.decisions : [];
    const info = payload.info || {};
    if (!totalUpstream) totalUpstream = info.total || 0;

    for (const dec of items) {
      adas.push({
        ada: dec.ada,
        protocolNumber: dec.protocolNumber,
        issueDate: dec.issueDate,
        publishTimestamp: dec.publishTimestamp,
        subject: dec.subject,
        decisionType: dec.decisionType,
        documentUrl: dec.documentUrl,
        organizationUid: orgUid
      });
      const yr = decisionYear(dec.issueDate);
      if (yr !== null && yr < minYear) {
        reachedMinYear = true;
        break;
      }
      if (adas.length >= hardCap) break;
    }

    if (!items.length || items.length < SEARCH_PAGE_SIZE) break;
    page += 1;
    if (page > 100) break; // hard safety: 10k decisions
  }

  return { adas, totalUpstream, reachedMinYear };
}

async function fetchDecisionDetail(ada) {
  const url = `${LUMINAPI_BASE}/opendata/decisions/${encodeURIComponent(ada)}`;
  const payload = await fetchJson(url);
  const fy = payload.extraFieldValues || {};

  // Β.1.3 (ΑΝΑΛΗΨΗ ΥΠΟΧΡΕΩΣΗΣ) format
  const commitAmount = fy.amountWithVAT?.amount;
  const commitKaes = Array.isArray(fy.amountWithKae)
    ? fy.amountWithKae.map((k) => ({ kae: k.kae || '', amount: Number(k.amountWithVAT || 0) }))
    : [];

  // Β.2.2 (ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ ΠΛΗΡΩΜΗΣ) format
  const sponsors = Array.isArray(fy.sponsor) ? fy.sponsor : [];
  const sponsorTotal = sponsors.reduce(
    (sum, s) => sum + (Number(s.expenseAmount?.amount || 0) || 0),
    0
  );

  let amount = 0;
  let payee = '';
  let payeeAfm = '';

  if (typeof commitAmount === 'number' && commitAmount > 0) {
    amount = commitAmount;
  } else if (sponsorTotal > 0) {
    amount = sponsorTotal;
    const primary = sponsors[0];
    payee = primary?.sponsorAFMName?.name || '';
    payeeAfm = primary?.sponsorAFMName?.afm || '';
  }

  return {
    amount,
    payee,
    payeeAfm,
    kaes: commitKaes,
    financialYear: fy.financialYear || null,
    budgetType: fy.budgettype || ''
  };
}

async function batchFetchDetails(adas) {
  const result = new Array(adas.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= adas.length) return;
      const ada = adas[idx].ada;
      try {
        result[idx] = await fetchDecisionDetail(ada);
      } catch (error) {
        result[idx] = null;
      }
      if ((idx + 1) % 100 === 0) {
        process.stdout.write(`    ${idx + 1}/${adas.length}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return result;
}

function parseGreekDate(value) {
  if (!value || typeof value !== 'string') return { year: null, ts: 0 };
  const dateOnly = value.split(' ')[0];
  const parts = dateOnly.split('/');
  if (parts.length !== 3) return { year: null, ts: 0 };
  const [day, month, year] = parts.map((part) => Number.parseInt(part, 10));
  if (!day || !month || !year) return { year: null, ts: 0 };
  const ts = new Date(year, month - 1, day).getTime();
  return { year: String(year), ts };
}

async function snapshotOrg(target) {
  console.log(`\n[${target.uid}] ${target.label}`);
  const allDecisions = [];
  const totals = {};

  for (const typeId of DECISION_TYPES) {
    process.stdout.write(`  Searching ${typeId} (hardCap=${HARD_CAP}, minYear=${MIN_YEAR})...\n`);
    const { adas, totalUpstream, reachedMinYear } = await searchDecisionAdas(
      target.uid,
      typeId,
      HARD_CAP,
      MIN_YEAR
    );
    totals[typeId] = totalUpstream;
    const flag = reachedMinYear ? '✓ year coverage' : '⚠ hard-cap (older years missing)';
    process.stdout.write(
      `  Found ${adas.length} (of ${totalUpstream} total). ${flag}. Fetching amounts...\n`
    );
    const details = await batchFetchDetails(adas);

    for (let i = 0; i < adas.length; i += 1) {
      const meta = adas[i];
      const detail = details[i] || {
        amount: 0,
        payee: '',
        payeeAfm: '',
        kaes: [],
        financialYear: null,
        budgetType: ''
      };
      const dateInfo = parseGreekDate(meta.issueDate);
      const primaryKae = detail.kaes.reduce(
        (best, k) => (k.amount > best.amount ? k : best),
        { kae: '', amount: 0 }
      );

      allDecisions.push({
        ada: meta.ada,
        protocolNumber: meta.protocolNumber || '',
        issueDate: meta.issueDate,
        issueTimestamp: dateInfo.ts,
        year: dateInfo.year,
        subject: meta.subject || '',
        decisionTypeUid: meta.decisionType?.uid || typeId,
        decisionTypeLabel: meta.decisionType?.label || '',
        documentUrl: meta.documentUrl || `https://diavgeia.gov.gr/doc/${meta.ada}`,
        amount: detail.amount,
        payee: detail.payee,
        payeeAfm: detail.payeeAfm,
        kae: primaryKae.kae,
        kaes: detail.kaes,
        financialYear: detail.financialYear,
        budgetType: detail.budgetType
      });
    }
  }

  // Sort by date desc
  allDecisions.sort((a, b) => (b.issueTimestamp || 0) - (a.issueTimestamp || 0));

  const yearsCovered = [...new Set(allDecisions.map((d) => d.year).filter(Boolean))].sort(
    (a, b) => Number(b) - Number(a)
  );

  const snapshot = {
    uid: target.uid,
    label: target.label,
    snapshotDate: new Date().toISOString(),
    decisionTypes: DECISION_TYPES,
    upstreamTotalsByType: totals,
    sampleSize: allDecisions.length,
    yearsCovered,
    decisions: allDecisions
  };

  const filePath = path.join(OUT_DIR, `${target.uid}.json`);
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`  ✓ Wrote ${filePath} (${allDecisions.length} decisions)`);

  return {
    uid: target.uid,
    label: target.label,
    sampleSize: allDecisions.length,
    yearsCovered,
    snapshotDate: snapshot.snapshotDate,
    upstreamTotalsByType: totals
  };
}

async function loadExistingSummary(uid) {
  try {
    const filePath = path.join(OUT_DIR, `${uid}.json`);
    const fileStat = await stat(filePath);
    const ageHours = (Date.now() - fileStat.mtimeMs) / (1000 * 60 * 60);
    if (ageHours > SKIP_RECENT_HOURS) return null;
    const content = await readFile(filePath, 'utf-8');
    const snapshot = JSON.parse(content);
    return {
      uid: snapshot.uid,
      label: snapshot.label,
      sampleSize: snapshot.sampleSize,
      yearsCovered: snapshot.yearsCovered,
      snapshotDate: snapshot.snapshotDate,
      upstreamTotalsByType: snapshot.upstreamTotalsByType,
      _skipped: true
    };
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const indexEntries = [];

  for (const target of TARGETS) {
    const existing = await loadExistingSummary(target.uid);
    if (existing) {
      console.log(`\n[${target.uid}] ${target.label} — skipping (snapshot < ${SKIP_RECENT_HOURS}h old)`);
      indexEntries.push(existing);
      continue;
    }

    try {
      const summary = await snapshotOrg(target);
      indexEntries.push(summary);
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
      indexEntries.push({
        uid: target.uid,
        label: target.label,
        error: error.message
      });
    }
  }

  const indexPath = path.join(OUT_DIR, 'index.json');
  await writeFile(
    indexPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        decisionTypes: DECISION_TYPES,
        hardCap: HARD_CAP,
        minYear: MIN_YEAR,
        orgs: indexEntries
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`\nIndex written: ${indexPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
