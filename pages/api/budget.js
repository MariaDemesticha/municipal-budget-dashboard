import { getDecisionsForYear, getOrgMeta, listSnapshotYears } from '../../lib/snapshots';
import { lookupPopulation } from '../../lib/population';

const SPENDING_TYPE = 'Β.2.2'; // ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ ΠΛΗΡΩΜΗΣ — actual finalized payments

function categoryArray(byCategory) {
  return Object.entries(byCategory)
    .map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount);
}

function bucketCategory(decision) {
  // For Β.2.2, use the payee as the category (top counterparties view).
  return decision.payee || 'Χωρίς αναφερόμενο δικαιούχο';
}

function buildSummary(records) {
  const total = records.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const byCategory = records.reduce((acc, item) => {
    const category = item.category || 'Λοιπά';
    acc[category] = (acc[category] || 0) + Number(item.amount || 0);
    return acc;
  }, {});
  return {
    total: Number(total.toFixed(2)),
    recordCount: records.length,
    byCategory,
    categories: categoryArray(byCategory)
  };
}

function normalizeRecord(decision, orgTitle) {
  return {
    uid: decision.ada,
    orgUid: '',
    orgTitle,
    date: (decision.issueDate || '').split(' ')[0] || '',
    year: decision.year || '',
    amount: Number(decision.amount || 0),
    vat: 0,
    category: bucketCategory(decision),
    title: decision.subject || '',
    description: decision.subject || '',
    issuerTitle: '',
    receiverTitle: decision.payee || '',
    payee: decision.payee || '',
    payeeAfm: decision.payeeAfm || '',
    invoiceType: decision.decisionTypeLabel || '',
    decisionId: decision.ada || '',
    decisionUrl: decision.documentUrl || `https://diavgeia.gov.gr/doc/${decision.ada}`
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = String(req.query.uid || '').trim();
  const year = String(req.query.year || '').trim();
  const orgTitle = String(req.query.orgTitle || '').trim();

  if (!uid || !year) {
    return res.status(400).json({ error: 'Missing query parameters: uid and year are required' });
  }

  const meta = getOrgMeta(uid);
  if (!meta) {
    return res.status(404).json({
      error: 'Δεν υπάρχει διαθέσιμο snapshot γι\' αυτόν τον φορέα.',
      uid,
      orgTitle
    });
  }

  const availableYears = listSnapshotYears(uid);
  if (!availableYears.includes(year)) {
    return res.status(409).json({
      error: `Δεν υπάρχουν δεδομένα για το έτος ${year}.`,
      uid,
      orgTitle: meta.label,
      requestedYear: year,
      availableYears,
      source: 'snapshot'
    });
  }

  const decisions = getDecisionsForYear(uid, year, SPENDING_TYPE);
  const filtered = decisions.filter((d) => Number(d.amount || 0) > 0);
  const records = filtered.map((d) => normalizeRecord(d, meta.label));
  const summary = buildSummary(records);
  const upstreamTotal = meta.upstreamTotalsByType?.[SPENDING_TYPE] || 0;

  const population = lookupPopulation(meta.label);

  return res.status(200).json({
    uid,
    year,
    requestedYear: year,
    resolvedYear: year,
    usedFallbackYear: false,
    availableYears,
    statementUid: null,
    statementTitle: '',
    statementPublishedAt: meta.snapshotDate,
    orgTitle: meta.label,
    population,
    source: 'snapshot',
    endpoint: `luminapi /search ${SPENDING_TYPE}`,
    snapshotDate: meta.snapshotDate,
    snapshotSampleSize: filtered.length,
    snapshotUpstreamTotal: upstreamTotal,
    decisionTypeUid: SPENDING_TYPE,
    decisionTypeLabel: 'ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ ΠΛΗΡΩΜΗΣ',
    reportedCount: upstreamTotal,
    reportedTotal: 0,
    summary,
    records,
    lastUpdated: new Date().toISOString()
  });
}
