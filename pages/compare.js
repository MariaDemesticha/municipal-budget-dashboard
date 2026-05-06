import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import BarChartComparison from '../components/BarChartComparison';
import PieChartComparison from '../components/PieChartComparison';
import BudgetTableComparison from '../components/BudgetTableComparison';
import TrendChart from '../components/TrendChart';

const TYPE_META = {
  'Β.2.2': {
    bar: { totalLabel: 'Συνολικές πληρωμές', seriesLabel: 'Πληρωμές', badge: 'Σύνολα', color: '#3b82f6' },
    pie: { title: 'Κατανομή & top δικαιούχοι πληρωμών', hint: 'Κλικ σε κατηγορία για φιλτράρισμα' },
    table: { title: 'Αποφάσεις πληρωμής', payeeLabel: 'Δικαιούχος', recordsLabel: 'πληρωμές' }
  },
  'Β.1.3': {
    bar: { totalLabel: 'Συνολικές δεσμεύσεις', seriesLabel: 'Δεσμεύσεις', badge: 'Σύνολα', color: '#10b981' },
    pie: { title: 'Κατανομή & top ΚΑΕ', hint: 'Κλικ σε κατηγορία για φιλτράρισμα' },
    table: { title: 'Αναλήψεις υποχρέωσης', payeeLabel: 'ΚΑΕ', recordsLabel: 'δεσμεύσεις' }
  },
  'Δ.1': {
    bar: { totalLabel: 'Συνολικές αναθέσεις', seriesLabel: 'Αναθέσεις', badge: 'Σύνολα', color: '#8b5cf6' },
    pie: { title: 'Κατανομή & top αναδόχοι', hint: 'Κλικ σε κατηγορία για φιλτράρισμα' },
    table: { title: 'Αναθέσεις έργων / προμηθειών', payeeLabel: 'Ανάδοχος', recordsLabel: 'αναθέσεις' }
  },
  'Γ.3.4': {
    bar: { totalLabel: 'Συνολικά συμβόλαια', seriesLabel: 'Συμβάσεις', badge: 'Σύνολα', color: '#f97316' },
    pie: { title: 'Κατανομή & top συμβαλλόμενοι', hint: 'Κλικ σε κατηγορία για φιλτράρισμα' },
    table: { title: 'Συμβάσεις', payeeLabel: 'Συμβαλλόμενος', recordsLabel: 'συμβάσεις' }
  },
  'Β.4': {
    bar: { totalLabel: 'Συνολικές επιχορηγήσεις', seriesLabel: 'Επιχορηγήσεις', badge: 'Σύνολα', color: '#14b8a6' },
    pie: { title: 'Κατανομή & top πηγές χρηματοδότησης', hint: 'Κλικ σε κατηγορία για φιλτράρισμα' },
    table: { title: 'Δωρεές & Επιχορηγήσεις', payeeLabel: 'Πηγή', recordsLabel: 'επιχορηγήσεις' }
  }
};
const TAB_TYPES = ['Β.2.2', 'Β.1.3', 'Δ.1', 'Γ.3.4', 'Β.4'];

function formatCurrency(value) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatPerCapita(value) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 1
  }).format(value || 0);
}

function asString(value) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function findBestAvailableYear(years = [], requestedYear = '') {
  const availableYears = [...new Set(years.map((value) => String(value || '').trim()).filter(Boolean))].sort(
    (first, second) => (Number.parseInt(second, 10) || 0) - (Number.parseInt(first, 10) || 0)
  );

  if (!availableYears.length) return '';
  if (requestedYear && availableYears.includes(requestedYear)) return requestedYear;

  const requestedYearNumber = Number.parseInt(requestedYear, 10);
  if (Number.isFinite(requestedYearNumber)) {
    const sameOrEarlierYear = availableYears.find(
      (value) => (Number.parseInt(value, 10) || 0) <= requestedYearNumber
    );
    if (sameOrEarlierYear) return sameOrEarlierYear;
  }

  return availableYears[0] || '';
}

function formatYears(values = []) {
  const years = [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort(
    (first, second) => (Number.parseInt(second, 10) || 0) - (Number.parseInt(first, 10) || 0)
  );
  return years.length ? years.join(', ') : 'κανένα';
}

function formatPublishedAt(value) {
  if (!value) return '';
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('el-GR');
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { response, data };
}

/* ---- Icons ---- */

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

/* ---- Loading ---- */

function LoadingSkeleton({ stageMessage }) {
  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 px-5 py-4">
        <div className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute h-5 w-5 animate-ping rounded-full bg-brand-400/30" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-brand-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-brand-900">{stageMessage || 'Φόρτωση...'}</p>
          <p className="text-xs text-brand-600/80">Λήψη δεδομένων από Diavgeia</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-panel">
            <div className="skeleton mb-3 h-4 w-32" />
            <div className="skeleton mb-2 h-8 w-40" />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-panel">
        <div className="skeleton mb-4 h-4 w-48" />
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  );
}

/* ---- Error ---- */

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 px-6 py-12 text-center animate-in">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-red-900">Σφάλμα φόρτωσης</h3>
      <p className="mt-1 max-w-sm text-sm text-red-700/80">{message}</p>
      <button type="button" className="btn-primary mt-5" onClick={onRetry}>
        <RefreshIcon />
        Δοκίμασε ξανά
      </button>
    </div>
  );
}

/* ---- Reusable cards ---- */

function DeltaBadge({ delta }) {
  if (!Number.isFinite(delta)) return null;
  const positive = delta >= 0;
  const arrow = positive ? '↑' : '↓';
  const sign = positive ? '+' : '−';
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-700 ring-1 ring-slate-200">
      <span aria-hidden>{arrow}</span>
      {sign}
      {Math.abs(delta * 100).toFixed(1)}%
    </span>
  );
}

function InfoIcon({ tooltip }) {
  if (!tooltip) return null;
  return (
    <span className="group relative inline-flex">
      <span
        className="material-icons cursor-help text-slate-400 hover:text-slate-600"
        style={{ fontSize: 14, width: 14, height: 14, lineHeight: '14px' }}
        aria-label="Πληροφορία"
      >
        info
      </span>
      <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 w-64 -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-2 text-2xs font-normal normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {tooltip}
      </span>
    </span>
  );
}

function MetricCard({ label, items, accent = 'blue', formatter = formatCurrency, hint, info }) {
  const showNames = items.length > 1;
  const isYearMode = items.length > 1 && items.every((i) => /^\d{4}$/.test(String(i.name)));
  const sorted = isYearMode
    ? [...items].sort((a, b) => Number(a.name) - Number(b.name))
    : items;
  const lastIdx = sorted.length - 1;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-panel">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</h3>
        <InfoIcon tooltip={info} />
      </div>
      <ul className="mt-3 space-y-2">
        {sorted.map((item, idx) => {
          const isLast = idx === lastIdx;
          const prevValue = idx > 0 ? sorted[idx - 1].value : null;
          const delta =
            isYearMode && isLast && prevValue && prevValue !== 0
              ? (item.value - prevValue) / Math.abs(prevValue)
              : null;
          const valueClass =
            isYearMode && !isLast
              ? 'whitespace-nowrap text-lg font-medium tabular-nums text-slate-400 leading-tight'
              : 'whitespace-nowrap text-[32px] font-semibold tabular-nums text-slate-900 leading-tight';

          if (showNames && !isYearMode) {
            // Compare-2-orgs mode: name LEFT, number RIGHT (28px)
            const displayName = String(item.name).replace(/^ΔΗΜΟΣ /, 'Δ. ');
            return (
              <li key={item.name} className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500" title={item.name}>
                  {displayName}
                </span>
                <span className="ml-auto whitespace-nowrap text-[28px] font-semibold tabular-nums text-slate-900 leading-tight">
                  {formatter(item.value)}
                </span>
              </li>
            );
          }
          return (
            <li key={item.name} className="flex items-baseline gap-3">
              <span className={valueClass}>{formatter(item.value)}</span>
              {isYearMode && isLast && delta !== null ? <DeltaBadge delta={delta} /> : null}
              {showNames ? (
                <span className="ml-auto truncate text-xs text-slate-500" title={item.name}>
                  {item.name}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {hint ? <p className="mt-3 text-2xs text-slate-400">{hint}</p> : null}
    </article>
  );
}

function ReconciliationCard({ orgName, dataset, year, yearsCovered = [] }) {
  const { summary, snapshotDate } = dataset;
  const computedCount = summary?.recordCount || 0;
  const computedTotal = summary?.total || 0;

  if (!computedCount) return null;

  const minYear = yearsCovered.length ? Math.min(...yearsCovered.map(Number)) : null;
  const maxYear = yearsCovered.length ? Math.max(...yearsCovered.map(Number)) : null;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500" title={orgName}>
          {orgName}
        </h4>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          Πλήρες {year}
        </span>
      </div>
      <dl className="mt-3 text-xs">
        <dt className="text-slate-500">Αποφάσεις για το {year}</dt>
        <dd className="mt-0.5 font-semibold text-slate-900">
          {computedCount} αποφάσεις · {formatCurrency(computedTotal)}
        </dd>
      </dl>
      {snapshotDate ? (
        <p className="mt-2 text-2xs text-slate-400">
          Snapshot: {new Date(snapshotDate).toLocaleDateString('el-GR')}
          {minYear && maxYear ? ` · εύρος ${minYear}-${maxYear}` : ''}
        </p>
      ) : null}
    </article>
  );
}

/* ---- Tabs ---- */

const TAB_LABELS = {
  'Β.2.2': 'Πληρωμές',
  'Β.1.3': 'Δεσμεύσεις',
  'Δ.1': 'Αναθέσεις',
  'Γ.3.4': 'Συμβάσεις',
  'Β.4': 'Επιχορηγήσεις'
};

function DatasetTabs({ value, onChange, availableTypes = [], year }) {
  const baseClass = 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors';
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-panel">
      {Object.entries(TAB_LABELS).map(([typeUid, label]) => {
        const enabled = availableTypes.includes(typeUid);
        const active = value === typeUid;
        return (
          <span key={typeUid} className="group relative inline-flex">
            <button
              type="button"
              className={`${baseClass} ${
                active
                  ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200'
                  : 'text-slate-600 hover:bg-slate-50'
              } ${!enabled ? 'cursor-not-allowed opacity-40' : ''}`}
              onClick={() => enabled && onChange(typeUid)}
              disabled={!enabled}
            >
              {label}
            </button>
            {!enabled ? (
              <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-2xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                Δεν υπάρχουν {label.toLowerCase()} για το {year}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

/* ---- Per-capita toggle ---- */

function PerCapitaToggle({ value, onChange, populations = [] }) {
  const allMatched = populations.length && populations.every((p) => p && p.population);
  const someMatched = populations.length && populations.some((p) => p && p.population);
  const disabled = !someMatched;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-xl px-3 py-1.5 text-base font-medium transition-colors ${
            value === 'absolute' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          onClick={() => onChange('absolute')}
        >
          Απόλυτα ποσά
        </button>
        <button
          type="button"
          className={`rounded-xl px-3 py-1.5 text-base font-medium transition-colors ${
            value === 'perCapita'
              ? 'bg-slate-900 text-white'
              : disabled
              ? 'cursor-not-allowed bg-slate-50 text-slate-300'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          onClick={() => !disabled && onChange('perCapita')}
          disabled={disabled}
          title={disabled ? 'Δεν βρέθηκε αντιστοιχία πληθυσμού.' : 'ΕΛΣΤΑΤ Census 2021 (κατά κάτοικο)'}
        >
          € / κάτοικο
        </button>
      </div>
      {value === 'perCapita' && !allMatched ? (
        <span className="text-2xs text-amber-700">
          ⚠ Δεν βρέθηκε πληθυσμός για όλους τους φορείς — ορισμένα νούμερα μπορεί να είναι κενά.
        </span>
      ) : null}
    </div>
  );
}

/* ---- Single org loader ---- */

async function loadOrgData({ term, year, signal, onStage }) {
  onStage(`Αναζήτηση: ${term}...`);
  const orgResult = await fetchJson(
    `/api/searchOrgs?term=${encodeURIComponent(term)}`,
    signal
  );

  if (!orgResult.response.ok || !orgResult.data.selected) {
    throw new Error(`Δεν βρέθηκε οργανισμός για: ${term}`);
  }

  const selected = orgResult.data.selected;
  let resolvedYear = year;
  let yearNotice = '';

  onStage(`Λήψη στοιχείων ${selected.title}...`);
  let financialResult = await fetchJson(
    `/api/financial?uid=${encodeURIComponent(selected.uid)}&year=${encodeURIComponent(
      resolvedYear
    )}&orgTitle=${encodeURIComponent(selected.title)}`,
    signal
  );

  if (financialResult.response.status === 409) {
    const fallback = findBestAvailableYear(financialResult.data.availableYears, year);
    if (!fallback) {
      throw new Error(
        `Δεν υπάρχουν δημοσιευμένα έτη για ${selected.title}. Διαθέσιμα έτη: ${formatYears(
          financialResult.data.availableYears
        )}.`
      );
    }
    yearNotice =
      year === fallback
        ? ''
        : `${selected.title}: δεν βρέθηκαν δεδομένα για το ${year}, εμφανίζονται στοιχεία ${fallback}.`;
    resolvedYear = fallback;
    financialResult = await fetchJson(
      `/api/financial?uid=${encodeURIComponent(selected.uid)}&year=${encodeURIComponent(
        resolvedYear
      )}&orgTitle=${encodeURIComponent(selected.title)}`,
      signal
    );
  }

  if (!financialResult.response.ok) {
    throw new Error(financialResult.data.error || `Αποτυχία φόρτωσης για ${selected.title}`);
  }

  return {
    query: term,
    org: selected,
    financial: financialResult.data,
    resolvedYear,
    yearNotice
  };
}

/* ---- Main page ---- */

export default function ComparePage() {
  const router = useRouter();
  const abortRef = useRef(null);

  const m1 = asString(router.query.m1).trim();
  const m2 = asString(router.query.m2).trim();
  const year = asString(router.query.year).trim();
  const y1 = asString(router.query.y1).trim() || year;
  const y2 = asString(router.query.y2).trim() || year;

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [stageMessage, setStageMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [activeCategory, setActiveCategory] = useState('');
  const [activeType, setActiveType] = useState('Β.2.2');
  const [unitMode, setUnitMode] = useState('absolute');
  const [results, setResults] = useState([]);
  const [yearNotices, setYearNotices] = useState([]);
  const [trendByUid, setTrendByUid] = useState({});
  const [appConfig, setAppConfig] = useState({ gemiEnabled: false });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/config')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setAppConfig(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!router.isReady) return;

    if (!m1 || !year) {
      setError('Λείπουν στοιχεία αναζήτησης. Επιστρέψτε στην αρχική σελίδα.');
      setStatus('error');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    async function run() {
      setStatus('loading');
      setError('');
      setActiveCategory('');
      setActiveType('Β.2.2');
      setUnitMode('absolute');
      setResults([]);
      setYearNotices([]);
      setTrendByUid({});
      setStageMessage('Αναζήτηση φορέων...');

      try {
        const targets = [
          m1 ? { term: m1, year: y1 } : null,
          m2 ? { term: m2, year: y2 } : null
        ].filter(Boolean);
        const loaded = await Promise.all(
          targets.map((target) =>
            loadOrgData({
              term: target.term,
              year: target.year,
              signal: controller.signal,
              onStage: setStageMessage
            })
          )
        );
        setResults(loaded);
        setYearNotices(loaded.map((r) => r.yearNotice).filter(Boolean));
        setStatus('done');
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          setError('Η φόρτωση ακυρώθηκε.');
          setStatus('idle');
          return;
        }
        setError(fetchError.message || 'Παρουσιάστηκε σφάλμα κατά τη φόρτωση.');
        setStatus('error');
      }
    }

    run();

    return () => controller.abort();
  }, [m1, m2, router.isReady, y1, y2, retryKey]);

  useEffect(() => {
    if (status !== 'done' || typeof window === 'undefined') return;
    if (window.location.hash === '#payments') {
      requestAnimationFrame(() => {
        const el = document.getElementById('payments');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'done' || !results.length) return undefined;

    const controller = new AbortController();
    const anchorYear = results[0]?.resolvedYear || year;

    setTrendByUid((prev) => {
      const next = { ...prev };
      for (const r of results) {
        if (!next[r.org.uid]) next[r.org.uid] = { status: 'loading' };
      }
      return next;
    });

    Promise.all(
      results.map(async (r) => {
        try {
          const url = `/api/trend?uid=${encodeURIComponent(r.org.uid)}&year=${encodeURIComponent(
            anchorYear
          )}`;
          const response = await fetch(url, { signal: controller.signal });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Αποτυχία λήψης ιστορικού');
          return [r.org.uid, { status: 'done', points: data.years || [] }];
        } catch (error) {
          if (error.name === 'AbortError') return null;
          return [r.org.uid, { status: 'error', error: error.message }];
        }
      })
    ).then((entries) => {
      const next = {};
      for (const entry of entries) {
        if (!entry) continue;
        next[entry[0]] = entry[1];
      }
      setTrendByUid((prev) => ({ ...prev, ...next }));
    });

    return () => controller.abort();
  }, [status, results, year]);

  const datasetMeta = TYPE_META[activeType] || TYPE_META['Β.2.2'];
  const isCompare = results.length > 1;

  // When two slots reference the same org (year-range mode), label by year
  const sameOrg =
    results.length > 1 && results.every((r) => r.org.uid === results[0].org.uid);

  const headerLabel = useMemo(() => {
    if (results.length === 0) return m1 || '...';
    if (results.length === 1) return results[0].org.title;
    if (sameOrg) {
      return results[0].org.title;
    }
    return results.map((r) => r.org.title).join('  ⇄  ');
  }, [results, m1, sameOrg]);

  // Tabs available across all loaded orgs (only show tab if at least one org has data)
  const availableTypes = TAB_TYPES.filter((typeUid) =>
    results.some((r) => r.financial?.byType?.[typeUid]?.hasData)
  );

  const datasetItems = useMemo(() => {
    return results
      .map((r) => {
        const fin = r.financial;
        if (!fin) return null;
        const data = fin.byType?.[activeType];
        if (!data) return null;
        const baseName = sameOrg ? `${r.org.title} ${r.resolvedYear}` : r.org.title;
        return {
          name: baseName,
          orgUid: r.org.uid,
          population: fin.population,
          summary: data.summary,
          records: data.records || [],
          reportedTotal: data.reportedTotal,
          reportedCount: data.reportedCount,
          statementPublishedAt: fin.snapshotDate,
          endpoint: '',
          resolvedYear: r.resolvedYear
        };
      })
      .filter(Boolean);
  }, [results, activeType, sameOrg]);

  const populations = datasetItems.map((d) => d.population);
  const transformValue = (value, item) => {
    if (unitMode !== 'perCapita') return value;
    if (!item.population || !item.population.population) return 0;
    return value / item.population.population;
  };
  const formatter = unitMode === 'perCapita' ? formatPerCapita : formatCurrency;
  const valueLabel = unitMode === 'perCapita' ? 'σε € ανά κάτοικο' : 'απόλυτα ποσά';

  const barItems = (() => {
    const arr = datasetItems.map((d) => ({
      name: sameOrg ? String(d.resolvedYear) : d.name,
      total: transformValue(d.summary?.total || 0, d)
    }));
    if (sameOrg) {
      arr.sort(
        (a, b) => (Number.parseInt(a.name, 10) || 0) - (Number.parseInt(b.name, 10) || 0)
      );
    }
    return arr;
  })();

  const pieItems = (() => {
    const arr = datasetItems.map((d, idx) => {
      const result = results[idx];
      return {
        name: sameOrg ? String(d.resolvedYear) : d.name,
        records: d.records,
        perCapita: unitMode === 'perCapita',
        divisor: d.population?.population || 1,
        linkOrgTitle: result?.org?.title || '',
        linkYear: d.resolvedYear || ''
      };
    });
    if (sameOrg) {
      arr.sort(
        (a, b) => (Number.parseInt(a.name, 10) || 0) - (Number.parseInt(b.name, 10) || 0)
      );
    }
    return arr;
  })();

  const tableItems = datasetItems.map((d) => ({
    name: d.name,
    records: d.records
  }));

  const summaryItems = useMemo(() => {
    return results.map((r) => {
      const fin = r.financial;
      const spending = fin?.byType?.['Β.2.2']?.summary?.total || 0;
      const earnings = fin?.byType?.['Β.1.3']?.summary?.total || 0;
      return {
        name: sameOrg ? r.resolvedYear : r.org.title,
        spending,
        earnings,
        population: fin?.population
      };
    });
  }, [results, sameOrg]);

  const sourceInfo = datasetItems.length
    ? {
        source: 'Διαύγεια (luminapi snapshot)',
        endpoint: datasetItems[0].endpoint || '',
        publishedAt: isCompare ? null : datasetItems[0].statementPublishedAt
      }
    : null;

  const headerYear = results[0]?.resolvedYear || year;
  const headerPublishedAt = results[0]?.budget?.statementPublishedAt;

  return (
    <>
      <Head>
        <title>{`${headerLabel} | Budget Dashboard`}</title>
      </Head>

      <div className="min-h-screen bg-gray-50/80">
        <div className="h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400" />

        <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 md:px-6 md:py-8">
          {/* Header */}
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                aria-label="Back to home"
              >
                <ArrowLeftIcon />
              </Link>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">
                    {headerLabel}
                  </h1>
                  {sameOrg ? (
                    results.map((r) => (
                      <span key={r.org.uid + r.resolvedYear} className="badge-blue !text-sm">
                        {r.resolvedYear}
                      </span>
                    ))
                  ) : (
                    <span className="badge-blue !text-sm">{headerYear || '...'}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {!isCompare && results[0]?.resolvedYear && results[0].resolvedYear !== year ? (
                    <span>Ζητήθηκε: {year}</span>
                  ) : null}
                  {isCompare && !sameOrg ? <span>Σύγκριση 2 φορέων</span> : null}
                  {sameOrg ? <span>Διαχρονική σύγκριση</span> : null}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {(status === 'loading' || status === 'idle') && abortRef.current ? (
                <button type="button" className="btn-ghost" onClick={() => abortRef.current?.abort()}>
                  Ακύρωση
                </button>
              ) : null}
              {status === 'done' ? (
                <button type="button" className="btn-secondary" onClick={() => setRetryKey((v) => v + 1)}>
                  <RefreshIcon />
                  Ανανέωση
                </button>
              ) : null}
              <Link href="/" className="btn-secondary">
                Νέα αναζήτηση
              </Link>
            </div>
          </header>

          {status === 'loading' ? <LoadingSkeleton stageMessage={stageMessage} /> : null}
          {status === 'error' ? (
            <ErrorState
              message={`${error} Δοκίμασε ξανά ή άλλαξε το όνομα του φορέα.`}
              onRetry={() => setRetryKey((v) => v + 1)}
            />
          ) : null}

          {status === 'done' && results.length ? (
            <div className="!mt-12 space-y-5 animate-in">
              {yearNotices.length ? (
                <section className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                  {yearNotices.map((notice, idx) => (
                    <p key={idx}>{notice}</p>
                  ))}
                </section>
              ) : null}

              {/* Per-capita toggle */}
              <PerCapitaToggle value={unitMode} onChange={setUnitMode} populations={populations} />

              {/* Summary cards: payments + commitments + ratio */}
              <section className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Πληρωμές (Β.2.2)"
                  accent="blue"
                  formatter={formatter}
                  items={summaryItems.map((item) => ({
                    name: item.name,
                    value:
                      unitMode === 'perCapita' && item.population?.population
                        ? item.spending / item.population.population
                        : item.spending
                  }))}
                />
                <MetricCard
                  label="Δεσμεύσεις (Β.1.3)"
                  accent="green"
                  formatter={formatter}
                  items={summaryItems.map((item) => ({
                    name: item.name,
                    value:
                      unitMode === 'perCapita' && item.population?.population
                        ? item.earnings / item.population.population
                        : item.earnings
                  }))}
                />
                <MetricCard
                  label="Ποσοστό υλοποίησης"
                  accent="slate"
                  formatter={(value) => `${(value * 100).toFixed(0)}%`}
                  items={summaryItems.map((item) => ({
                    name: item.name,
                    value: item.earnings > 0 ? item.spending / item.earnings : 0
                  }))}
                  info="Δείχνει πόσο από τις δεσμευμένες δαπάνες (αποφάσεις ανάληψης υποχρέωσης Β.1.3) έχει πραγματικά πληρωθεί (αποφάσεις πληρωμής Β.2.2). Υπολογίζεται ως: Πληρωμές ÷ Δεσμεύσεις × 100. Όσο πιο κοντά στο 100%, τόσο περισσότερο εκτελέστηκε ο προϋπολογισμός."
                />
              </section>

              {/* Population context — shown only in per-capita mode */}
              {unitMode === 'perCapita' && summaryItems.some((s) => s.population?.population) ? (
                <section className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600">
                  <span className="font-normal text-slate-700">Πληθυσμός (ΕΛΣΤΑΤ 2021):</span>{' '}
                  <span className="text-base font-semibold text-slate-900">
                    {summaryItems
                      .map((s) =>
                        s.population?.population
                          ? s.population.population.toLocaleString('el-GR')
                          : 'χωρίς αντιστοιχία'
                      )
                      .join(' · ')}
                  </span>
                </section>
              ) : null}

              <DatasetTabs
                value={activeType}
                onChange={(next) => {
                  setActiveType(next);
                  setActiveCategory('');
                }}
                availableTypes={availableTypes}
                year={results[0]?.resolvedYear || year}
              />

              {sameOrg ? (
                <TrendChart
                  items={Object.values(
                    results.reduce((acc, r) => {
                      if (acc[r.org.uid]) return acc;
                      const trend = trendByUid[r.org.uid] || { status: 'loading' };
                      const pop = r.financial?.population?.population;
                      acc[r.org.uid] = {
                        name: r.org.title,
                        points: trend.points,
                        status: trend.status,
                        error: trend.error,
                        population: pop
                      };
                      return acc;
                    }, {})
                  )}
                  unitMode={unitMode}
                />
              ) : null}

              {datasetItems.length ? (
                <>
                  {datasetItems.length > 1 ? (
                    <BarChartComparison
                      items={barItems}
                      year={headerYear}
                      meta={datasetMeta.bar}
                      sourceInfo={sourceInfo}
                      valueLabel={valueLabel}
                    />
                  ) : null}

                  {activeType !== 'Β.1.3' &&
                  activeType !== 'Γ.3.4' &&
                  pieItems.some((item) => (item.records || []).length > 0) ? (
                    <PieChartComparison
                      items={pieItems}
                      activeCategory={activeCategory}
                      onCategorySelect={setActiveCategory}
                      meta={datasetMeta.pie}
                      sourceInfo={sourceInfo}
                    />
                  ) : null}

                  {results.length === 1 ? (
                    <div id="payments">
                      <BudgetTableComparison
                        items={tableItems}
                        activeCategory={activeCategory}
                        meta={datasetMeta.table}
                        sourceInfo={sourceInfo}
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
                  Δεν υπάρχουν διαθέσιμα στοιχεία για αυτή την προβολή.
                </section>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </>
  );
}
