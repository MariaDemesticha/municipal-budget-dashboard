#!/usr/bin/env node
// Re-extract payee + payeeAfm for records of types Δ.1, Γ.3.4, Β.2.1 where current value is empty.
// The original deep-scan treated `fy.person` as an object; for many decision types it is an array.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = path.resolve(__dirname, '..', 'lib', 'data', 'snapshots');
const LUMINAPI_BASE = 'https://diavgeia.gov.gr/luminapi';
const CONCURRENCY = 25;
const TARGET_TYPES = new Set(['Δ.1', 'Γ.3.4', 'Β.2.1', 'Β.4']);
const TARGET_UIDS = ['6013', '6266'];

async function fetchJson(url, attempt = 0) {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    if (attempt < 2) {
      await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
      return fetchJson(url, attempt + 1);
    }
    throw e;
  }
}

function extractCounterparty(fy = {}) {
  // Person can be array (Δ.1, Γ.3.4) or object
  if (Array.isArray(fy.person) && fy.person.length > 0) {
    return { payee: fy.person[0].name || '', payeeAfm: fy.person[0].afm || '' };
  }
  if (fy.person && !Array.isArray(fy.person)) {
    return { payee: fy.person.name || '', payeeAfm: fy.person.afm || '' };
  }
  if (Array.isArray(fy.sponsor) && fy.sponsor.length > 0) {
    const s = fy.sponsor[0];
    return { payee: s.sponsorAFMName?.name || '', payeeAfm: s.sponsorAFMName?.afm || '' };
  }
  if (fy.donationGiver && fy.donationGiver.afm !== undefined) {
    return { payee: fy.donationGiver.name || '', payeeAfm: fy.donationGiver.afm || '' };
  }
  if (fy.donationReceiver && fy.donationReceiver.afm !== undefined) {
    return { payee: fy.donationReceiver.name || '', payeeAfm: fy.donationReceiver.afm || '' };
  }
  return { payee: '', payeeAfm: '' };
}

async function processOrg(uid) {
  const filePath = path.join(SNAPSHOTS_DIR, `${uid}.json`);
  const snapshot = JSON.parse(await readFile(filePath, 'utf-8'));
  console.log(`\n[${uid}] ${snapshot.label}`);

  const candidates = snapshot.decisions
    .map((d, idx) => ({ d, idx }))
    .filter(({ d }) => TARGET_TYPES.has(d.decisionTypeUid) && !d.payee);

  console.log(`  ${candidates.length} records need re-fetching`);
  if (!candidates.length) return;

  let cursor = 0;
  let updated = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= candidates.length) return;
      const { d, idx } = candidates[i];
      try {
        const url = `${LUMINAPI_BASE}/opendata/decisions/${encodeURIComponent(d.ada)}`;
        const payload = await fetchJson(url);
        const { payee, payeeAfm } = extractCounterparty(payload.extraFieldValues || {});
        if (payee) {
          snapshot.decisions[idx].payee = payee;
          snapshot.decisions[idx].payeeAfm = payeeAfm;
          updated += 1;
        }
      } catch {
        // skip
      }
      if ((i + 1) % 200 === 0) {
        process.stdout.write(`    ${i + 1}/${candidates.length} (updated ${updated})\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`  Updated ${updated} of ${candidates.length}`);
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`  ✓ Wrote ${filePath}`);
}

async function main() {
  for (const uid of TARGET_UIDS) {
    await processOrg(uid);
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
