import { getSnapshotIndex } from '../../lib/snapshots';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const index = getSnapshotIndex();
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    gemiEnabled: !!process.env.GEMI_API_KEY,
    populationSource: 'ΕΛΣΤΑΤ Census 2021',
    diavgeiaSource: 'diavgeia.gov.gr/luminapi (snapshot) + live decisions',
    snapshotDate: index.generatedAt || null,
    snapshotDecisionTypes: index.decisionTypes || [],
    snapshotOrgCount: (index.orgs || []).filter((o) => !o.error).length
  });
}
