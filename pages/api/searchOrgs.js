import { listAvailableOrgs, listAllMunicipalities, searchOrgs } from '../../lib/snapshots';

function mapEntry(entry) {
  return {
    uid: entry.uid,
    title: entry.label,
    afm: entry.vatNumber || '',
    score: entry.score || 0,
    dataAvailable: !!entry.dataAvailable,
    snapshotDate: entry.snapshotDate || null,
    sampleSize: entry.sampleSize || 0,
    yearsCovered: entry.yearsCovered || []
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const term = String(req.query.term || '').trim();
  const allMunicipalities = listAllMunicipalities();
  const withData = listAvailableOrgs();

  if (!term) {
    return res.status(200).json({
      term: '',
      source: 'snapshot',
      selected: null,
      results: withData.slice(0, 10).map((entry) =>
        mapEntry({
          uid: entry.uid,
          label: entry.label,
          vatNumber: '',
          dataAvailable: true,
          sampleSize: entry.sampleSize,
          yearsCovered: entry.yearsCovered,
          snapshotDate: entry.snapshotDate
        })
      ),
      totalAvailable: withData.length,
      totalMunicipalities: allMunicipalities.length
    });
  }

  const results = searchOrgs(term, 10).map(mapEntry);
  const selected = results.find((r) => r.dataAvailable) || results[0] || null;

  return res.status(200).json({
    term,
    source: 'snapshot',
    selected,
    results,
    totalAvailable: withData.length,
    totalMunicipalities: allMunicipalities.length
  });
}
