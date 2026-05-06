import { getDecisionsForYear, getOrgMeta, listSnapshotYears } from '../../lib/snapshots';

const SPENDING_TYPE = 'Β.2.2';
const COMMITMENT_TYPE = 'Β.1.3';
const MAX_YEARS = 8;

function uniqueYears(input = '', anchorYear) {
  const explicit = String(input || '')
    .split(',')
    .map((value) => Number.parseInt(String(value).trim(), 10))
    .filter((value) => Number.isFinite(value));

  if (explicit.length) {
    return [...new Set(explicit)].sort((a, b) => a - b).slice(-MAX_YEARS);
  }

  const anchor = Number.parseInt(anchorYear, 10);
  if (!Number.isFinite(anchor)) return [];
  return Array.from({ length: 5 }, (_, index) => anchor - 4 + index);
}

function summarize(decisions) {
  const filtered = decisions.filter((d) => Number(d.amount || 0) > 0);
  const total = filtered.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  return { total, count: filtered.length };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = String(req.query.uid || '').trim();
  const anchorYear = String(req.query.year || '').trim();
  const explicitYears = String(req.query.years || '').trim();

  if (!uid) {
    return res.status(400).json({ error: 'Missing query parameter: uid' });
  }

  const meta = getOrgMeta(uid);
  if (!meta) {
    return res.status(404).json({ error: 'Δεν υπάρχει snapshot.' });
  }

  const availableYears = listSnapshotYears(uid);
  const years = uniqueYears(explicitYears, anchorYear).filter((year) =>
    availableYears.includes(String(year))
  );

  const points = years.map((year) => {
    const yearStr = String(year);
    const spending = summarize(getDecisionsForYear(uid, yearStr, SPENDING_TYPE));
    const earnings = summarize(getDecisionsForYear(uid, yearStr, COMMITMENT_TYPE));

    return {
      year: yearStr,
      spendingTotal: Number(spending.total.toFixed(2)),
      spendingCount: spending.count,
      earningsTotal: Number(earnings.total.toFixed(2)),
      earningsCount: earnings.count,
      statementUid: null,
      statementPublishedAt: meta.snapshotDate,
      hasSpending: spending.count > 0,
      hasEarnings: earnings.count > 0
    };
  });

  return res.status(200).json({
    uid,
    years: points,
    snapshotDate: meta.snapshotDate,
    lastUpdated: new Date().toISOString()
  });
}
