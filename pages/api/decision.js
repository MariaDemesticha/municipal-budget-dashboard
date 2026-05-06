import { fetchWithTimeout } from '../../lib/diavgeia';

const LUMINAPI_BASE = 'https://diavgeia.gov.gr/luminapi/opendata';
const CACHE_LIMIT = 500;
const cache = new Map();

function rememberDecision(ada, value) {
  if (cache.has(ada)) cache.delete(ada);
  cache.set(ada, value);
  while (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function summarize(payload = {}) {
  const fek = payload.extraFieldValues?.fek;
  const fekStr = fek?.aa
    ? `ΦΕΚ ${fek.aa}/${fek.issueyear}${fek.issue ? ` (${fek.issue})` : ''}`
    : '';

  return {
    ada: payload.ada || '',
    subject: payload.subject || '',
    protocolNumber: payload.protocolNumber || '',
    decisionTypeId: payload.decisionTypeId || '',
    documentType: payload.extraFieldValues?.documentType || '',
    organizationId: payload.organizationId || '',
    issueDate: payload.issueDate || null,
    publishTimestamp: payload.publishTimestamp || null,
    documentUrl: payload.documentUrl || `https://diavgeia.gov.gr/doc/${payload.ada || ''}`,
    fek: fekStr,
    status: payload.status || '',
    attachmentsCount: Array.isArray(payload.attachments) ? payload.attachments.length : 0
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ada = String(req.query.ada || '').trim();
  if (!ada) {
    return res.status(400).json({ error: 'Missing query parameter: ada' });
  }

  if (cache.has(ada)) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.get(ada));
  }

  try {
    const url = `${LUMINAPI_BASE}/decisions/${encodeURIComponent(ada)}`;
    const payload = await fetchWithTimeout(url, 9000);
    const result = summarize(payload);
    rememberDecision(ada, result);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(result);
  } catch (error) {
    return res.status(502).json({
      error: `Αποτυχία σύνδεσης με Diavgeia: ${error.message}`
    });
  }
}
