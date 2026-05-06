import { getDecisionsForYear, getOrgMeta, listSnapshotYears } from '../../lib/snapshots';
import { lookupPopulation } from '../../lib/population';

const TYPES = [
  { uid: 'Β.2.2', label: 'ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ ΠΛΗΡΩΜΗΣ', shortLabel: 'Πληρωμές', flow: 'outgoing' },
  { uid: 'Β.1.3', label: 'ΑΝΑΛΗΨΗ ΥΠΟΧΡΕΩΣΗΣ', shortLabel: 'Δεσμεύσεις', flow: 'commitment' },
  { uid: 'Δ.1', label: 'ΑΝΑΘΕΣΗ ΕΡΓΩΝ / ΠΡΟΜΗΘΕΙΩΝ / ΥΠΗΡΕΣΙΩΝ / ΜΕΛΕΤΩΝ', shortLabel: 'Αναθέσεις', flow: 'outgoing' },
  { uid: 'Γ.3.4', label: 'ΣΥΜΒΑΣΗ', shortLabel: 'Συμβάσεις', flow: 'outgoing' },
  { uid: 'Β.4', label: 'ΔΩΡΕΑ - ΕΠΙΧΟΡΗΓΗΣΗ', shortLabel: 'Επιχορηγήσεις', flow: 'incoming' },
  { uid: 'Β.2.1', label: 'ΕΓΚΡΙΣΗ ΔΑΠΑΝΗΣ', shortLabel: 'Έγκριση δαπάνης', flow: 'commitment' },
  { uid: 'Β.3', label: 'ΙΣΟΛΟΓΙΣΜΟΣ – ΑΠΟΛΟΓΙΣΜΟΣ', shortLabel: 'Ισολογισμοί', flow: 'report' }
];

function categoryArray(byCategory) {
  return Object.entries(byCategory)
    .map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount);
}

function bucketCategory(decision, typeUid) {
  if (typeUid === 'Β.1.3' || typeUid === 'Β.2.1') {
    if (decision.kae) {
      const segment = String(decision.kae).split(/[.\-]/)[0];
      return `ΚΑΕ ${segment || decision.kae}`;
    }
    return 'Χωρίς ΚΑΕ';
  }
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

function normalizeRecord(decision, orgTitle, typeUid) {
  return {
    uid: decision.ada,
    orgUid: '',
    orgTitle,
    date: (decision.issueDate || '').split(' ')[0] || '',
    year: decision.year || '',
    amount: Number(decision.amount || 0),
    vat: 0,
    category: bucketCategory(decision, typeUid),
    title: decision.subject || '',
    description: decision.subject || '',
    issuerTitle: '',
    receiverTitle: decision.payee || '',
    payee: decision.payee || decision.kae || '',
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
    return res.status(400).json({ error: 'Missing uid or year' });
  }

  const meta = getOrgMeta(uid);
  if (!meta) {
    return res.status(404).json({ error: 'Δεν υπάρχει snapshot.', uid, orgTitle });
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

  const population = lookupPopulation(meta.label);
  const byType = {};

  for (const type of TYPES) {
    const decisions = getDecisionsForYear(uid, year, type.uid);
    const filtered = decisions.filter((d) => Number(d.amount || 0) > 0);
    const records = filtered.map((d) => normalizeRecord(d, meta.label, type.uid));
    const upstream = meta.upstreamTotalsByType?.[type.uid] || 0;

    byType[type.uid] = {
      typeUid: type.uid,
      typeLabel: type.label,
      shortLabel: type.shortLabel,
      flow: type.flow,
      records,
      summary: buildSummary(records),
      reportedCount: upstream,
      reportedTotal: 0,
      hasData: records.length > 0
    };
  }

  return res.status(200).json({
    uid,
    year,
    orgTitle: meta.label,
    population,
    snapshotDate: meta.snapshotDate,
    availableYears,
    types: TYPES.map((t) => ({ uid: t.uid, shortLabel: t.shortLabel, flow: t.flow })),
    byType,
    lastUpdated: new Date().toISOString()
  });
}
