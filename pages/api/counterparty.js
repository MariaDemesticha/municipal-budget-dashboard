const GEMI_BASE = 'https://opendata-api.businessportal.gr/api/opendata/v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 1000;
const cache = new Map();

function rememberEntry(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function summarizeCompany(payload = {}) {
  const company = Array.isArray(payload) ? payload[0] : payload;
  if (!company || typeof company !== 'object') return null;

  const activities = Array.isArray(company.activities)
    ? company.activities.slice(0, 5).map((a) => ({
        code: a.code || a.activityCode || '',
        name: a.name || a.title || '',
        primary: !!(a.primary || a.isPrimary)
      }))
    : [];

  return {
    arGemi: company.arGemi || company.gemiNumber || '',
    afm: company.afm || '',
    name: company.name || company.companyName || '',
    distinctiveTitle: company.distinctiveTitle || '',
    legalType: company.legalType?.name || company.legalTypeName || '',
    status: company.status?.name || company.statusName || '',
    isActive:
      typeof company.isActive === 'boolean'
        ? company.isActive
        : typeof company.active === 'boolean'
        ? company.active
        : null,
    municipality: company.municipality?.name || company.municipalityName || '',
    prefecture: company.prefecture?.name || company.prefectureName || '',
    gemiOffice: company.gemiOffice?.name || company.gemiOfficeName || '',
    activities
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      enabled: false,
      error:
        'Η αναζήτηση ΓΕΜΗ δεν είναι ενεργοποιημένη. Ορίστε το GEMI_API_KEY στο περιβάλλον.'
    });
  }

  const afm = String(req.query.afm || '').trim();
  if (!afm) {
    return res.status(400).json({ error: 'Missing query parameter: afm' });
  }

  const cached = readCache(afm);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    const paddedAfm = afm.padStart(9, '0');
    const url = `${GEMI_BASE}/companies?afm=${encodeURIComponent(paddedAfm)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    let payload;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', api_key: apiKey },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Upstream returned ${response.status}`);
      }
      payload = await response.json();
    } finally {
      clearTimeout(timeout);
    }

    const summary = summarizeCompany(payload?.results || payload);
    if (!summary) {
      return res.status(404).json({ error: 'Δεν βρέθηκε εγγραφή ΓΕΜΗ για αυτό το ΑΦΜ.' });
    }

    rememberEntry(afm, summary);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(502).json({ error: `Αποτυχία ΓΕΜΗ: ${error.message}` });
  }
}
