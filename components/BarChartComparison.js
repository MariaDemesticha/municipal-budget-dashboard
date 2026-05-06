import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

function formatCurrency(value) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-panel-lg">
      <p className="text-xs font-medium text-slate-500">{item.payload.name}</p>
      <p className="mt-0.5 text-base font-bold text-slate-900">{formatCurrency(item.value)}</p>
    </div>
  );
}

const DEFAULT_META = {
  totalLabel: 'Συνολική δαπάνη',
  seriesLabel: 'Δαπάνες',
  badge: 'Σύνολα',
  color: '#3b82f6'
};

export default function BarChartComparison({ items = [], year, meta = DEFAULT_META, sourceInfo, valueLabel }) {
  const resolvedMeta = { ...DEFAULT_META, ...meta };
  const chartData = items.map((item) => ({
    name: item.name,
    total: Number(item.total || 0)
  }));

  return (
    <section className="card" aria-label="Municipality total chart">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{resolvedMeta.totalLabel}</h3>
          {valueLabel ? (
            <p className="text-xs text-slate-400">{valueLabel}</p>
          ) : null}
        </div>
        <span className="badge-blue">{resolvedMeta.badge}</span>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(59, 130, 246, 0.04)' }}
              wrapperStyle={{ pointerEvents: 'none', marginTop: -80 }}
              allowEscapeViewBox={{ x: false, y: true }}
              offset={20}
            />
            <Bar
              dataKey="total"
              name={resolvedMeta.seriesLabel}
              fill={resolvedMeta.color}
              radius={[10, 10, 0, 0]}
              maxBarSize={80}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
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
