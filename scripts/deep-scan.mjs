#!/usr/bin/env node
// Deep financial scan for selected δήμους.
// Pulls ALL financially-relevant decision types from luminapi for a custom year range.
//
// Usage:
//   node scripts/deep-scan.mjs                  # default: Αθήνα + Σαλαμίνα, 2019-2026
//   node scripts/deep-scan.mjs <minYear>        # custom min year
//
// Output: lib/data/snapshots/{uid}.json — overwrites existing for selected δήμοι.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'lib', 'data', 'snapshots');

const LUMINAPI_BASE = 'https://diavgeia.gov.gr/luminapi';
const SEARCH_PAGE_SIZE = 100;
const MIN_YEAR = Number.parseInt(process.argv[2], 10) || 2019;
const CONCURRENCY = 25;
const HARD_CAP = 60000; // safety cap per type per δήμος

// All decision types with financial data
const DECISION_TYPES = [
  { uid: 'Β.2.2', label: 'ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ ΠΛΗΡΩΜΗΣ' },
  { uid: 'Β.1.3', label: 'ΑΝΑΛΗΨΗ ΥΠΟΧΡΕΩΣΗΣ' },
  { uid: 'Β.2.1', label: 'ΕΓΚΡΙΣΗ ΔΑΠΑΝΗΣ' },
  { uid: 'Δ.1', label: 'ΑΝΑΘΕΣΗ ΕΡΓΩΝ / ΠΡΟΜΗΘΕΙΩΝ / ΥΠΗΡΕΣΙΩΝ / ΜΕΛΕΤΩΝ' },
  { uid: 'Γ.3.4', label: 'ΣΥΜΒΑΣΗ' },
  { uid: 'Β.4', label: 'ΔΩΡΕΑ - ΕΠΙΧΟΡΗΓΗΣΗ' },
  { uid: 'Β.3', label: 'ΙΣΟΛΟΓΙΣΜΟΣ – ΑΠΟΛΟΓΙΣΜΟΣ' }
];

const TARGETS = [
  { uid: '6013', label: 'ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ' },
  { uid: '6266', label: 'ΔΗΜΟΣ ΣΑΛΑΜΙΝΑΣ' }
];

async function fetchJson(url, attempt = 0) {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
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

async function searchDecisionAdas(orgUid, decisionTypeUid, minYear) {
  const adas = [];
  let totalUpstream = 0;
  let page = 0;
  let reachedMinYear = false;

  while (adas.length < HARD_CAP && !reachedMinYear) {
    const queryParts = [`organizationUid:"${orgUid}"`, `decisionTypeUid:"${decisionTypeUid}"`];
    const query = encodeURIComponent(queryParts.join(' AND '));
    const url = `${LUMINAPI_BASE}/api/search?q=${query}&size=${SEARCH_PAGE_SIZE}&page=${page}&sort=recent`;

    const payload = await fetchJson(url);
    const items = Array.isArray(payload.decisions) ? payload.decisions : [];
    if (!totalUpstream) totalUpstream = payload.info?.total || 0;

    for (const dec of items) {
      const yr = decisionYear(dec.issueDate);
      if (yr !== null && yr < minYear) {
        reachedMinYear = true;
        break;
      }
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
      if (adas.length >= HARD_CAP) break;
    }

    if (!items.length || items.length < SEARCH_PAGE_SIZE) break;
    page += 1;
    if (page > 700) break;
  }

  return { adas, totalUpstream, reachedMinYear };
}

function extractAmountAndCounterparty(fy = {}) {
  let amount = 0;
  let payee = '';
  let payeeAfm = '';
  let kaes = [];

  // Amount: try multiple known fields in priority order
  if (fy.amountWithVAT?.amount) {
    amount = Number(fy.amountWithVAT.amount) || 0;
  } else if (fy.awardAmount?.amount) {
    amount = Number(fy.awardAmount.amount) || 0;
  } else if (fy.contractAmount?.amount) {
    amount = Number(fy.contractAmount.amount) || 0;
  } else if (Array.isArray(fy.sponsor) && fy.sponsor.length) {
    amount = fy.sponsor.reduce(
      (sum, s) => sum + (Number(s.expenseAmount?.amount) || 0),
      0
    );
  }

  // Counterparty
  if (Array.isArray(fy.sponsor) && fy.sponsor.length) {
    const s = fy.sponsor[0];
    payee = s.sponsorAFMName?.name || '';
    payeeAfm = s.sponsorAFMName?.afm || '';
  } else if (fy.person) {
    payee = fy.person.name || '';
    payeeAfm = fy.person.afm || '';
  } else if (fy.donationGiver) {
    payee = fy.donationGiver.name || '';
    payeeAfm = fy.donationGiver.afm || '';
  } else if (fy.donationReceiver) {
    payee = fy.donationReceiver.name || '';
    payeeAfm = fy.donationReceiver.afm || '';
  }

  // ΚΑΕ
  if (Array.isArray(fy.amountWithKae)) {
    kaes = fy.amountWithKae.map((k) => ({
      kae: k.kae || '',
      amount: Number(k.amountWithVAT || 0)
    }));
  } else if (fy.kae) {
    kaes = [{ kae: String(fy.kae), amount }];
  }

  return { amount, payee, payeeAfm, kaes };
}

async function fetchDecisionDetail(ada) {
  const url = `${LUMINAPI_BASE}/opendata/decisions/${encodeURIComponent(ada)}`;
  const payload = await fetchJson(url);
  const fy = payload.extraFieldValues || {};
  const extracted = extractAmountAndCounterparty(fy);
  return {
    ...extracted,
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
      try {
        result[idx] = await fetchDecisionDetail(adas[idx].ada);
      } catch {
        result[idx] = null;
      }
      if ((idx + 1) % 200 === 0) {
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
  console.log(`\n[${target.uid}] ${target.label}  (minYear ${MIN_YEAR})`);
  const allDecisions = [];
  const totals = {};

  for (const type of DECISION_TYPES) {
    process.stdout.write(`  ${type.uid} ${type.label}...\n`);
    const { adas, totalUpstream, reachedMinYear } = await searchDecisionAdas(
      target.uid,
      type.uid,
      MIN_YEAR
    );
    totals[type.uid] = totalUpstream;
    const flag = reachedMinYear ? '✓ year coverage' : '⚠ hard-cap';
    process.stdout.write(
      `    Found ${adas.length} of ${totalUpstream}. ${flag}. Fetching amounts...\n`
    );
    if (!adas.length) continue;
    const details = await batchFetchDetails(adas);

    for (let i = 0; i < adas.length; i += 1) {
      const meta = adas[i];
      const detail = details[i] || {
        amount: 0, payee: '', payeeAfm: '', kaes: [], financialYear: null, budgetType: ''
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
        decisionTypeUid: meta.decisionType?.uid || type.uid,
        decisionTypeLabel: meta.decisionType?.label || type.label,
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

  allDecisions.sort((a, b) => (b.issueTimestamp || 0) - (a.issueTimestamp || 0));

  const yearsCovered = [...new Set(allDecisions.map((d) => d.year).filter(Boolean))].sort(
    (a, b) => Number(b) - Number(a)
  );

  const snapshot = {
    uid: target.uid,
    label: target.label,
    snapshotDate: new Date().toISOString(),
    decisionTypes: DECISION_TYPES.map((t) => t.uid),
    upstreamTotalsByType: totals,
    sampleSize: allDecisions.length,
    yearsCovered,
    minYear: MIN_YEAR,
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

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const target of TARGETS) {
    try {
      await snapshotOrg(target);
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
    }
  }
  console.log('\nDone.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
