import { useEffect, useMemo, useState } from 'react';

function formatCurrency(value) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2
  }).format(value || 0);
}

function parseDateToTimestamp(value) {
  if (!value || typeof value !== 'string') return 0;
  const parts = value.split('/');
  if (parts.length !== 3) return 0;
  const [day, month, year] = parts.map((part) => Number.parseInt(part, 10));
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
}

function sortRecords(records, sortBy, sortDir) {
  const sorted = [...records];
  sorted.sort((a, b) => {
    let first = 0;
    let second = 0;
    if (sortBy === 'amount') {
      first = Number(a.amount || 0);
      second = Number(b.amount || 0);
    } else if (sortBy === 'date') {
      first = parseDateToTimestamp(a.date);
      second = parseDateToTimestamp(b.date);
    } else {
      first = String(a.title || '').toLowerCase();
      second = String(b.title || '').toLowerCase();
    }
    if (first < second) return sortDir === 'asc' ? -1 : 1;
    if (first > second) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

const AMOUNT_RANGES = [
  { value: 'all', label: 'Όλα τα ποσά', min: 0, max: Infinity },
  { value: '0-100', label: '0–100€', min: 0, max: 100 },
  { value: '100-1000', label: '100–1.000€', min: 100, max: 1000 },
  { value: '1000-10000', label: '1.000–10.000€', min: 1000, max: 10000 },
  { value: '10000-100000', label: '10.000–100.000€', min: 10000, max: 100000 },
  { value: '100000-500000', label: '100.000–500.000€', min: 100000, max: 500000 },
  { value: '500000-1000000', label: '500.000–1.000.000€', min: 500000, max: 1000000 },
  { value: '1000000+', label: 'Πάνω από 1.000.000€', min: 1000000, max: Infinity }
];

const SORT_FIELDS = [
  { value: 'date', label: 'Ημερομηνία' },
  { value: 'amount', label: 'Ποσό' },
  { value: 'title', label: 'Αλφαβητικά' }
];

const SORT_DIRS = {
  date: [
    { value: 'asc', label: 'Από παλαιότερα' },
    { value: 'desc', label: 'Από νεότερα' }
  ],
  amount: [
    { value: 'asc', label: 'Αύξουσα' },
    { value: 'desc', label: 'Φθίνουσα' }
  ],
  title: [
    { value: 'asc', label: 'Α-Ζ' },
    { value: 'desc', label: 'Ζ-Α' }
  ]
};

function summarizeSort(sortBy) {
  return SORT_FIELDS.find((f) => f.value === sortBy)?.label || '';
}

function SortMenu({ sortBy, sortDir, onChange }) {
  const [open, setOpen] = useState(false);
  const dirOptions = SORT_DIRS[sortBy] || [];

  return (
    <div className="relative">
      <button
        type="button"
        className="input flex !w-[220px] items-center gap-2 whitespace-nowrap"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <span className="text-xs text-slate-500">Ταξινόμηση:</span>
        <span className="text-sm font-medium text-slate-800">{summarizeSort(sortBy)}</span>
        <span className="ml-auto">
          <ChevronDownIcon />
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel-lg">
          <div className="px-3 py-2">
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-slate-400">
              Ταξινόμηση κατά
            </p>
            <ul className="space-y-0.5">
              {SORT_FIELDS.map((field) => (
                <li key={field.value}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                      sortBy === field.value
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onChange(field.value, sortDir);
                    }}
                  >
                    <span>{field.label}</span>
                    {sortBy === field.value ? <span aria-hidden>✓</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-slate-100 px-3 py-2">
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-slate-400">Σειρά</p>
            <ul className="space-y-0.5">
              {dirOptions.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                      sortDir === option.value
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onChange(sortBy, option.value);
                      setOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {sortDir === option.value ? <span aria-hidden>✓</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const decisionCache = new Map();

function formatDecisionDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('el-GR');
}

function useDecisionMetadata(ada, expanded) {
  const [data, setData] = useState(decisionCache.get(ada) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!expanded || !ada || data) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/api/decision?ada=${encodeURIComponent(ada)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Αποτυχία φόρτωσης απόφασης');
        decisionCache.set(ada, payload);
        setData(payload);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [ada, expanded, data]);

  return { data, loading, error };
}

function DecisionDetail({ row }) {
  const ada = row.decisionId ? String(row.decisionId).split(/[;,\s]+/).find(Boolean) : '';
  const { data, loading, error } = useDecisionMetadata(ada, true);

  if (!ada) {
    return (
      <div className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-400">
        Δεν υπάρχει συσχετισμένος ΑΔΑ για αυτή την εγγραφή.
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
        Λήψη μεταδεδομένων απόφασης...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-amber-50 px-3 py-3 text-xs text-amber-800">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-2 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-600">
      {data.subject ? (
        <p className="text-slate-800">
          <span className="font-semibold">Αντικείμενο:</span> {data.subject}
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {data.decisionTypeId ? (
          <div>
            <dt className="text-2xs uppercase tracking-wider text-slate-400">Τύπος</dt>
            <dd className="font-medium text-slate-700">{data.decisionTypeId}</dd>
          </div>
        ) : null}
        {data.protocolNumber ? (
          <div>
            <dt className="text-2xs uppercase tracking-wider text-slate-400">Αρ. πρωτ.</dt>
            <dd className="font-medium text-slate-700">{data.protocolNumber}</dd>
          </div>
        ) : null}
        {data.issueDate ? (
          <div>
            <dt className="text-2xs uppercase tracking-wider text-slate-400">Ημ/νία απόφασης</dt>
            <dd className="font-medium text-slate-700">{formatDecisionDate(data.issueDate)}</dd>
          </div>
        ) : null}
        {data.fek ? (
          <div>
            <dt className="text-2xs uppercase tracking-wider text-slate-400">ΦΕΚ</dt>
            <dd className="font-medium text-slate-700">{data.fek}</dd>
          </div>
        ) : null}
        {data.status ? (
          <div>
            <dt className="text-2xs uppercase tracking-wider text-slate-400">Κατάσταση</dt>
            <dd className="font-medium text-slate-700">{data.status}</dd>
          </div>
        ) : null}
        {data.attachmentsCount ? (
          <div>
            <dt className="text-2xs uppercase tracking-wider text-slate-400">Συνημμένα</dt>
            <dd className="font-medium text-slate-700">{data.attachmentsCount}</dd>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-3 pt-1">
        <a
          href={data.documentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800"
        >
          Έγγραφο απόφασης
          <ExternalLinkIcon />
        </a>
        <span className="text-2xs text-slate-400">Πηγή: Diavgeia luminapi · ΑΔΑ {data.ada}</span>
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const DEFAULT_TABLE_META = {
  title: 'Εγγραφές δαπανών',
  payeeLabel: 'Δικαιούχος',
  recordsLabel: 'συνολικές εγγραφές δαπανών'
};

function SourceFooter({ info }) {
  const parts = [];
  if (info.source) parts.push(`Πηγή: ${info.source}`);
  if (info.endpoint) parts.push(info.endpoint);
  if (info.statementUid) parts.push(`Δήλωση ${info.statementUid}`);
  if (info.publishedAt) parts.push(`Δημοσίευση ${formatPublishedAt(info.publishedAt)}`);
  if (!parts.length) return null;
  return (
    <p className="border-t border-slate-100 pt-3 text-2xs text-slate-400">
      {parts.join(' · ')}
    </p>
  );
}

function formatPublishedAt(value) {
  if (!value) return '';
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('el-GR');
}

function RecordTableCard({
  title,
  showTitle = true,
  records,
  activeCategory,
  payeeLabel,
  recordsLabel,
  onFilteredCountChange
}) {
  const [searchText, setSearchText] = useState('');
  const [amountRange, setAmountRange] = useState('all');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('amount');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedUid, setExpandedUid] = useState(null);

  const normalizedSearch = searchText.trim().toLowerCase();

  const filteredRecords = useMemo(() => {
    const range = AMOUNT_RANGES.find((r) => r.value === amountRange) || AMOUNT_RANGES[0];
    return sortRecords(
      records.filter((item) => {
        const matchesCategory = activeCategory ? item.category === activeCategory : true;
        const haystack = `${item.title} ${item.category} ${item.payee}`.toLowerCase();
        const matchesSearch = normalizedSearch ? haystack.includes(normalizedSearch) : true;
        const amount = Number(item.amount || 0);
        const matchesAmount = amount >= range.min && amount < range.max;
        return matchesCategory && matchesSearch && matchesAmount;
      }),
      sortBy,
      sortDir
    );
  }, [records, activeCategory, normalizedSearch, amountRange, sortBy, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / Number(rowsPerPage || 10)));

  useEffect(() => {
    setPage(1);
  }, [searchText, amountRange, rowsPerPage, sortBy, sortDir, activeCategory]);

  useEffect(() => {
    if (onFilteredCountChange) onFilteredCountChange(filteredRecords.length);
  }, [filteredRecords.length, onFilteredCountChange]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const rows = filteredRecords.slice(start, end);

  return (
    <div className="space-y-4">
      {showTitle ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          <span className="text-xs font-medium text-slate-500">
            {filteredRecords.length} {recordsLabel}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Αναζήτηση..."
            className="input w-44 !pl-10"
            aria-label="Search records"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input w-48"
            value={amountRange}
            onChange={(event) => setAmountRange(event.target.value)}
            aria-label="Φίλτρο ποσού"
          >
            {AMOUNT_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
          <SortMenu
            sortBy={sortBy}
            sortDir={sortDir}
            onChange={(nextBy, nextDir) => {
              setSortBy(nextBy);
              setSortDir(nextDir);
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-2xs uppercase tracking-wider text-slate-400">
              <th className="w-8 px-1 py-2.5"></th>
              <th className="px-3 py-2.5 font-semibold">Ημ/νία</th>
              <th className="px-3 py-2.5 font-semibold">Περιγραφή</th>
              <th className="px-3 py-2.5 font-semibold">{payeeLabel}</th>
              <th className="px-3 py-2.5 text-right font-semibold">Ποσό</th>
              <th className="px-3 py-2.5 text-right font-semibold">Πηγή</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length ? (
              rows.flatMap((row) => {
                const isExpanded = expandedUid === row.uid;
                const baseRow = (
                  <tr
                    key={row.uid}
                    className={`align-top transition-colors ${isExpanded ? 'bg-slate-50/60' : 'hover:bg-slate-50/60'}`}
                  >
                    <td className="px-1 py-2.5 text-center">
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        onClick={() => setExpandedUid(isExpanded ? null : row.uid)}
                        aria-label={isExpanded ? 'Σύμπτυξη' : 'Λεπτομέρειες απόφασης'}
                      >
                        {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">{row.date || '-'}</td>
                    <td className="max-w-[220px] px-3 py-2.5 text-xs text-slate-700">
                      <span className="line-clamp-2">{row.title || '-'}</span>
                    </td>
                    <td className="max-w-[160px] px-3 py-2.5 text-xs text-slate-500">
                      <span className="line-clamp-1">{row.payee || '-'}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-slate-900">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {row.decisionUrl ? (
                        <a
                          href={row.decisionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-800"
                        >
                          Diavgeia
                          <ExternalLinkIcon />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
                if (!isExpanded) return [baseRow];
                return [
                  baseRow,
                  <tr key={`${row.uid}-detail`} className="bg-slate-50/40">
                    <td colSpan={6} className="px-3 py-3">
                      <DecisionDetail row={row} />
                    </td>
                  </tr>
                ];
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-400">
                  Δεν βρέθηκαν εγγραφές.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">Σελίδα {page} / {pageCount}</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="btn-secondary !px-2.5"
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            disabled={page >= pageCount}
            className="btn-secondary !px-2.5"
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BudgetTableComparison({
  items = [],
  activeCategory,
  meta = DEFAULT_TABLE_META,
  sourceInfo
}) {
  const resolvedMeta = { ...DEFAULT_TABLE_META, ...meta };
  const gridClass = items.length > 1 ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4';

  const [filteredCounts, setFilteredCounts] = useState({});
  const totalRecords = items.reduce(
    (sum, item) => sum + (filteredCounts[item.name] ?? item.records?.length ?? 0),
    0
  );

  const setCountForItem = (name) => (count) => {
    setFilteredCounts((prev) => (prev[name] === count ? prev : { ...prev, [name]: count }));
  };

  return (
    <section className="card space-y-4" aria-label="Budget records table">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{resolvedMeta.title}</h3>
        <span className="text-xs font-medium text-slate-500">
          {totalRecords} {resolvedMeta.recordsLabel}
        </span>
      </div>
      {activeCategory ? (
        <p className="text-xs text-slate-500">
          Ενεργό φίλτρο: <span className="font-medium text-brand-700">{activeCategory}</span>
        </p>
      ) : null}

      <div className={gridClass}>
        {items.map((item) => (
          <RecordTableCard
            key={item.name}
            title={item.name}
            showTitle={items.length > 1}
            records={item.records || []}
            activeCategory={activeCategory}
            payeeLabel={resolvedMeta.payeeLabel}
            recordsLabel={resolvedMeta.recordsLabel}
            onFilteredCountChange={setCountForItem(item.name)}
          />
        ))}
      </div>
    </section>
  );
}
