const API_BASE = 'https://mef.diavgeia.gov.gr/api';

export function normalizeGreek(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ')
    .replace(/Σ/g, 'σ')
    .toUpperCase()
    .trim();
}

export function parseAmount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const raw = String(value).trim();
  const cleaned = raw
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchWithTimeout(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function splitNormalizedWords(value = '') {
  return normalizeGreek(value)
    .split(/[^0-9A-ZΑ-Ω]+/u)
    .filter(Boolean);
}

function inflectGreekSearchWord(word = '') {
  const normalizedWord = normalizeGreek(word);
  const variants = new Set();

  if (!normalizedWord) {
    return [];
  }

  variants.add(normalizedWord);

  if (normalizedWord.endsWith('Α')) {
    variants.add(`${normalizedWord.slice(0, -1)}ΑΣ`);
    variants.add(`${normalizedWord.slice(0, -1)}ΟΣ`);
  }

  if (normalizedWord.endsWith('Η')) {
    variants.add(`${normalizedWord.slice(0, -1)}ΗΣ`);
    variants.add(`${normalizedWord.slice(0, -1)}ΩΝ`);
  }

  if (normalizedWord.endsWith('Ο')) {
    variants.add(`${normalizedWord.slice(0, -1)}ΟΥ`);
  }

  if (normalizedWord.endsWith('Ι')) {
    variants.add(`${normalizedWord.slice(0, -1)}ΙΟΥ`);
  }

  if (normalizedWord.endsWith('Ω')) {
    variants.add(`${normalizedWord.slice(0, -1)}ΩΝ`);
  }

  return [...variants];
}

export function buildOrganizationSearchTerms(term = '') {
  const rawTerm = String(term).trim();
  const normalizedTerm = normalizeGreek(rawTerm);

  if (!normalizedTerm) {
    return [];
  }

  const terms = new Set([rawTerm, normalizedTerm]);
  const words = normalizedTerm.split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] || '';

  for (const variant of inflectGreekSearchWord(lastWord)) {
    const searchWords = [...words];
    searchWords[searchWords.length - 1] = variant;
    const inflectedVariant = searchWords.join(' ');
    terms.add(inflectedVariant);

    if (!inflectedVariant.startsWith('ΔΗΜΟΣ ')) {
      terms.add(`ΔΗΜΟΣ ${inflectedVariant}`);
    }
  }

  if (!normalizedTerm.startsWith('ΔΗΜΟΣ ')) {
    terms.add(`ΔΗΜΟΣ ${normalizedTerm}`);
  }

  return [...terms]
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function isMunicipalLikeTitle(title = '') {
  const normalizedTitle = normalizeGreek(title);

  if (!normalizedTitle) {
    return false;
  }

  return (
    normalizedTitle.startsWith('ΔΗΜΟΣ ') ||
    normalizedTitle.includes(' ΔΗΜΟΤΙΚ') ||
    normalizedTitle.includes(' ΚΟΙΝΟΦΕΛΗΣ ΕΠΙΧΕΙΡΗΣΗ ') ||
    normalizedTitle.includes(' ΟΡΓΑΝΙΣΜΟΣ ΔΗΜΟΥ ') ||
    (normalizedTitle.includes(' ΝΟΜΙΚΟ ΠΡΟΣΩΠΟ ') && normalizedTitle.includes(' ΔΗΜΟΥ ')) ||
    normalizedTitle.includes(' ΚΑΠΗ ΔΗΜΟΥ ') ||
    normalizedTitle.includes(' ΠΙΝΑΚΟΘΗΚΗ ΔΗΜΟΥ ')
  );
}

export function isStrictMunicipalityTitle(title = '') {
  const normalizedTitle = normalizeGreek(title);

  if (!normalizedTitle) {
    return false;
  }

  return (
    normalizedTitle.startsWith('ΔΗΜΟΣ ') ||
    normalizedTitle.startsWith('ΔΗΜΟC ')
  );
}

function isAssociationLikeTitle(title = '') {
  const normalizedTitle = normalizeGreek(title);

  if (!normalizedTitle) {
    return false;
  }

  return [
    'ΑΘΛΗΤΙΚ',
    'ΣΥΛΛΟΓ',
    'ΟΜΙΛ',
    'ΣΩΜΑΤΕΙ',
    'ΛΥΚΕΙΟ',
    'ΦΙΛΟΙ',
    'ΠΟΛΙΤΙΣΤΙΚ',
    'ΝΑΥΤ',
    'ΓΥΜΝΑΣΤΙΚ'
  ].some((token) => normalizedTitle.includes(token));
}

function scoreOrganization(title, term) {
  const normalizedTitle = normalizeGreek(title);
  const normalizedTerm = normalizeGreek(term);
  const termWords = splitNormalizedWords(term);

  if (!normalizedTitle || !normalizedTerm) {
    return 0;
  }

  let score = 0;

  if (normalizedTitle === normalizedTerm) {
    score += 220;
  }

  if (normalizedTitle.startsWith(normalizedTerm)) {
    score += 90;
  }

  if (normalizedTitle.includes(normalizedTerm)) {
    score += 55;
  }

  if (termWords.length > 1 && termWords.every((word) => normalizedTitle.includes(word))) {
    score += 50;
  }

  if (normalizedTitle.startsWith(`ΔΗΜΟΣ ${normalizedTerm}`)) {
    score += 180;
  } else if (normalizedTitle.includes(`ΔΗΜΟΣ ${normalizedTerm}`)) {
    score += 135;
  }

  if (isMunicipalLikeTitle(title)) {
    score += 80;
  }

  if (normalizedTitle.startsWith('ΔΗΜΟΣ ')) {
    score += 40;
  }

  if (isAssociationLikeTitle(title)) {
    score -= 55;
  }

  const distancePenalty = Math.abs(normalizedTitle.length - normalizedTerm.length);
  score -= Math.min(distancePenalty, 18);

  return score;
}

export function rankOrganizations(items = [], term = '') {
  return items
    .map((item) => ({
      ...item,
      score: scoreOrganization(item.title, term)
    }))
    .sort((a, b) => b.score - a.score || a.title.length - b.title.length)
    .filter((item) => item.score > 0);
}

function statementTimestamp(statement = {}) {
  const dateTime = String(statement.created_at_datetime || '').trim();

  if (dateTime) {
    const parsedDateTime = Date.parse(dateTime.replace(' ', 'T'));
    if (Number.isFinite(parsedDateTime)) {
      return parsedDateTime;
    }
  }

  const createdAt = String(statement.created_at || '').trim();
  const parts = createdAt.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts.map((part) => Number.parseInt(part, 10));
    const parsedDate = new Date(year, month - 1, day).getTime();
    if (Number.isFinite(parsedDate)) {
      return parsedDate;
    }
  }

  return 0;
}

export function sortStatements(statements = []) {
  return [...statements].sort((first, second) => {
    const firstYear = Number.parseInt(first.year, 10) || 0;
    const secondYear = Number.parseInt(second.year, 10) || 0;

    if (firstYear !== secondYear) {
      return secondYear - firstYear;
    }

    return statementTimestamp(second) - statementTimestamp(first);
  });
}

export function getStatementYears(statements = []) {
  const seen = new Set();
  const years = [];

  for (const statement of sortStatements(statements)) {
    const year = String(statement.year || '').trim();
    if (year && !seen.has(year)) {
      seen.add(year);
      years.push(year);
    }
  }

  return years;
}

export function findStatementByYear(statements = [], requestedYear = '') {
  const normalizedYear = String(requestedYear || '').trim();

  if (!normalizedYear) {
    return null;
  }

  return sortStatements(statements).find((statement) => String(statement.year || '') === normalizedYear) || null;
}

export function findFallbackStatement(statements = [], requestedYear = '') {
  const sortedStatements = sortStatements(statements);
  const requestedYearNumber = Number.parseInt(requestedYear, 10);

  if (!sortedStatements.length) {
    return null;
  }

  if (!Number.isFinite(requestedYearNumber)) {
    return sortedStatements[0] || null;
  }

  return (
    sortedStatements.find((statement) => {
      const statementYear = Number.parseInt(statement.year, 10);
      return Number.isFinite(statementYear) && statementYear <= requestedYearNumber;
    }) ||
    sortedStatements[0] ||
    null
  );
}

export function inferCategory(item) {
  return (
    item.invoice_type ||
    item.subject ||
    item.reason ||
    item.category ||
    'Λοιπά / Other'
  );
}

export function normalizeDecisionUrl(decisions) {
  if (!decisions) {
    return '';
  }

  const firstDecision = String(decisions)
    .split(/[;,\s]+/)
    .find(Boolean);

  if (!firstDecision) {
    return '';
  }

  return `https://diavgeia.gov.gr/doc/${firstDecision}`;
}

export function normalizeSpendingItem(item = {}, index = 0) {
  const amount = parseAmount(item.amount);
  const vat = parseAmount(item.vat);
  const category = inferCategory(item);
  const payee = item.receiver_title || item.issuer_title || '';
  const decisionUrl = normalizeDecisionUrl(item.decisions);
  const issuerAfm = item.issuer_afm || item.receiver_afm || '';

  return {
    uid: item.uid || `${item.org_uid || 'row'}-${index}`,
    orgUid: item.org_uid || item['org.uid'] || '',
    orgTitle: item['org.title'] || item.org_title || '',
    date: item.date || '',
    year: item.year ? String(item.year) : '',
    amount,
    vat,
    category,
    title: item.subject || item.reason || item.invoice_type || 'Χωρίς τίτλο / Untitled',
    description: item.reason || item.subject || '',
    issuerTitle: item.issuer_title || '',
    receiverTitle: item.receiver_title || '',
    payee,
    payeeAfm: issuerAfm,
    invoiceType: item.invoice_type || '',
    decisionId: item.decisions || '',
    decisionUrl
  };
}

export function normalizeEarningItem(item = {}, index = 0) {
  const amount = parseAmount(item.amount_with_vat || item.amount);
  const donorTitle = item.donator_title || item.donor_title || '';
  const donorAfm = item.donator_afm || item.donor_afm || '';
  const decisionRaw = item.ada || item.decision || item.adas || '';
  const decisionUrl = normalizeDecisionUrl(decisionRaw);
  const comments = item.comments || '';
  const description = comments || item.decision || donorTitle;

  return {
    uid: item.uid || `${item.org_uid || 'earn'}-${index}`,
    orgUid: item.org_uid || item['org.uid'] || '',
    orgTitle: item['org.title'] || item.org_title || '',
    date: item.date || '',
    year: item.year ? String(item.year) : '',
    amount,
    vat: 0,
    category: donorTitle || 'Λοιπά / Other',
    title: comments || item.decision || donorTitle || 'Επιχορήγηση',
    description,
    issuerTitle: donorTitle,
    receiverTitle: item['org.title'] || item.org_title || '',
    payee: donorTitle,
    payeeAfm: donorAfm,
    invoiceType: '',
    decisionId: decisionRaw,
    decisionUrl
  };
}

export function buildBudgetSummary(items = []) {
  const total = items.reduce((sum, item) => sum + parseAmount(item.amount), 0);

  const byCategory = items.reduce((acc, item) => {
    const category = item.category || 'Λοιπά / Other';
    const amount = parseAmount(item.amount);
    acc[category] = (acc[category] || 0) + amount;
    return acc;
  }, {});

  return {
    total,
    recordCount: items.length,
    byCategory
  };
}

export function diavgeiaUrl(path, params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  return `${API_BASE}${path}?${searchParams.toString()}`;
}
