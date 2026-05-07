import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = [
  '#3b82f6',
  '#0ea5e9',
  '#14b8a6',
  '#10b981',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#6366f1'
];
const TOP_LIST_LIMIT = 5;

const DEFAULT_META = {
  title: 'Κατανομή κατηγοριών',
  hint: 'Κλικ σε κατηγορία για φιλτράρισμα'
};

function formatCurrency(value) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function aggregateRecords(records = []) {
  const groups = new Map();
  for (const record of records) {
    const amount = Number(record.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const afm = String(record.payeeAfm || '').trim();
    const payee = String(record.payee || '').trim();
    const key = afm || payee.toLowerCase() || 'unknown';
    if (!key || key === 'unknown') continue;
    const entry = groups.get(key) || { key, name: payee || 'Άγνωστος', afm, total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    if (!entry.name && payee) entry.name = payee;
    if (!entry.afm && afm) entry.afm = afm;
    groups.set(key, entry);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-panel-lg">
      <p className="text-xs font-medium text-slate-500">{item.name}</p>
      <p className="mt-0.5 text-base font-bold text-slate-900">{formatCurrency(item.value)}</p>
    </div>
  );
}

function TopList({ entries, colorByKey = {}, activeName = '' }) {
  const total = entries.reduce((sum, e) => sum + e.total, 0);
  const top = entries;

  if (!top.length) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-slate-100 p-6 text-sm text-slate-500">
        Δεν υπάρχουν επαρκή στοιχεία.
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {top.map((entry) => {
        const share = total > 0 ? entry.total / total : 0;
        const dotColor = colorByKey[entry.key];
        const dimmed = activeName && entry.name !== activeName;
        return (
          <li
            key={entry.key}
            className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs transition-opacity sm:flex-nowrap ${
              dimmed ? 'opacity-30' : ''
            }`}
          >
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: dotColor || 'transparent' }}
              aria-hidden
            />
            <div className="min-w-0 flex-1 basis-full sm:basis-auto">
              <p className="truncate font-medium text-slate-800" title={entry.name}>
                {entry.name}
              </p>
              {entry.afm ? (
                <p className="text-2xs text-slate-400">ΑΦΜ {entry.afm}</p>
              ) : null}
            </div>
            <div className="ml-5 shrink-0 text-left text-xs sm:ml-0 sm:w-[100px]">
              <span className="font-medium tabular-nums text-slate-700">{entry.count}</span>{' '}
              <span className="text-slate-400">εγγραφές</span>
            </div>
            <div className="ml-auto shrink-0 text-right sm:w-[110px]">
              <span className="block text-sm font-semibold tabular-nums text-slate-900">
                {formatCurrency(entry.total)}
              </span>
              <span className="text-2xs text-slate-400">{(share * 100).toFixed(1)}%</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PieCard({
  title,
  records,
  perCapita = false,
  divisor = 1,
  activeCategory,
  onCategorySelect,
  linkOrgTitle = '',
  linkYear = ''
}) {
  const entries = useMemo(() => {
    const ranked = aggregateRecords(records);
    const top = ranked.slice(0, TOP_LIST_LIMIT);
    if (!perCapita || !divisor) return top;
    return top.map((e) => ({ ...e, total: e.total / divisor }));
  }, [records, perCapita, divisor]);

  const colorByKey = entries.reduce((acc, entry, index) => {
    acc[entry.key] = COLORS[index % COLORS.length];
    return acc;
  }, {});

  const pieData = entries.map((e) => ({ key: e.key, name: e.name, value: e.total }));

  return (
    <article>
      {title ? (
        <h4 className="mb-3 text-sm font-semibold text-slate-700">{title}</h4>
      ) : null}
      {entries.length ? (
        <div className="space-y-5">
          <div className="mx-auto h-56 w-full max-w-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                  onClick={(entry) => {
                    const name = entry?.name;
                    if (!name) return;
                    onCategorySelect(activeCategory === name ? '' : name);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`${entry.key}-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke="white"
                      strokeWidth={1.5}
                      opacity={activeCategory && activeCategory !== entry.name ? 0.35 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ pointerEvents: 'none', marginTop: -80 }}
                  allowEscapeViewBox={{ x: false, y: true }}
                  offset={20}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <TopList entries={entries} colorByKey={colorByKey} activeName={activeCategory} />
          {linkOrgTitle && linkYear ? (
            <a
              href={`/compare?m1=${encodeURIComponent(linkOrgTitle)}&year=${encodeURIComponent(
                linkYear
              )}#payments`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 hover:underline"
            >
              Δες όλες τις πληρωμές για {linkYear} →
            </a>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl bg-slate-100 p-8 text-sm text-slate-500">
          Δεν υπάρχουν κατηγορίες.
        </div>
      )}
    </article>
  );
}

function SourceFooter({ info }) {
  const parts = [];
  if (info.source) parts.push(`Πηγή: ${info.source}`);
  if (info.endpoint) parts.push(info.endpoint);
  if (info.statementUid) parts.push(`Δήλωση ${info.statementUid}`);
  if (info.publishedAt) parts.push(`Δημοσίευση ${formatPublishedAt(info.publishedAt)}`);
  if (!parts.length) return null;
  return (
    <p className="mt-4 border-t border-slate-100 pt-3 text-2xs text-slate-400">
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

export default function PieChartComparison({
  items = [],
  activeCategory,
  onCategorySelect,
  meta = DEFAULT_META,
  sourceInfo
}) {
  const resolvedMeta = { ...DEFAULT_META, ...meta };
  const showTitle = items.length > 1;
  const gridClass =
    items.length > 1
      ? 'grid gap-6 md:grid-cols-2 md:divide-x md:divide-slate-200 md:[&>*+*]:pl-6'
      : 'grid gap-4';

  // Hide entire section if no item has any record with amount > 0
  const hasAnyData = items.some((item) =>
    (item.records || []).some((r) => Number(r.amount || 0) > 0)
  );
  if (!hasAnyData) return null;

  return (
    <section className="card" aria-label="Municipality category distribution">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-slate-900">{resolvedMeta.title}</h3>
        <p className="text-xs text-slate-500">{resolvedMeta.hint}</p>
      </div>

      <div className={gridClass}>
        {items.map((item) => (
          <PieCard
            key={item.name}
            title={showTitle ? item.name : ''}
            records={item.records || []}
            perCapita={item.perCapita}
            divisor={item.divisor}
            activeCategory={activeCategory}
            onCategorySelect={onCategorySelect}
            linkOrgTitle={showTitle ? item.linkOrgTitle : ''}
            linkYear={showTitle ? item.linkYear : ''}
          />
        ))}
      </div>
    </section>
  );
}
