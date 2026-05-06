import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

function formatCurrencyShort(value) {
  const abs = Math.abs(value || 0);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M €`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K €`;
  return `${(value || 0).toFixed(0)} €`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-panel-lg">
      <p className="text-xs font-medium text-slate-500">Έτος {label}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((item) => (
          <li key={item.dataKey} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5" style={{ color: item.color }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatCurrency(item.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendCard({ title, showTitle = true, points, status, error, perCapita, population }) {
  const data = (points || []).map((point) => {
    if (!perCapita || !population) {
      return {
        year: point.year,
        spending: point.spendingTotal,
        earnings: point.earningsTotal
      };
    }
    return {
      year: point.year,
      spending: point.spendingTotal / population,
      earnings: point.earningsTotal / population
    };
  });

  const hasAnyData = data.some((row) => row.spending > 0 || row.earnings > 0);

  return (
    <article>
      {showTitle ? (
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      ) : null}
      {perCapita ? (
        <p className="mt-0.5 text-xs text-slate-500">
          € ανά κάτοικο · πληθυσμός {population?.toLocaleString('el-GR') || '—'}
        </p>
      ) : null}

      {status === 'loading' ? (
        <div className="mt-4 flex h-56 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
          Λήψη ιστορικού...
        </div>
      ) : status === 'error' ? (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 text-xs text-amber-800">{error}</div>
      ) : !hasAnyData ? (
        <div className="mt-4 flex h-56 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
          Δεν υπάρχουν επαρκή στοιχεία.
        </div>
      ) : (
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCurrencyShort}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip
                content={<CustomTooltip />}
                wrapperStyle={{ pointerEvents: 'none', marginTop: -80 }}
                allowEscapeViewBox={{ x: false, y: true }}
                offset={20}
              />
              <Legend
                wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
                iconSize={0}
                formatter={(value, entry) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        backgroundColor: entry.color
                      }}
                    />
                    <span style={{ color: '#0f172a' }}>{value}</span>
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="spending"
                name="Δαπάνες"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: '#3b82f6' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="earnings"
                name="Έσοδα"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: '#10b981' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

export default function TrendChart({ items = [], unitMode = 'absolute' }) {
  const gridClass = items.length > 1 ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4';
  const perCapita = unitMode === 'perCapita';

  return (
    <section className="card space-y-3" aria-label="Year-over-year trend">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Διαχρονική εξέλιξη {perCapita ? '(€ ανά κάτοικο)' : ''}
        </h3>
        <p className="text-xs text-slate-500">Σύνολα ανά έτος</p>
      </div>
      <div className={gridClass}>
        {items.map((item) => (
          <TrendCard
            key={item.name}
            title={item.name}
            showTitle={items.length > 1}
            points={item.points}
            status={item.status}
            error={item.error}
            perCapita={perCapita}
            population={item.population}
          />
        ))}
      </div>
    </section>
  );
}
