import { useEffect, useMemo, useState } from 'react';

function formatCurrency(value) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function aggregate(records = []) {
  const groups = new Map();

  for (const record of records) {
    const amount = Number(record.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const afm = String(record.payeeAfm || '').trim();
    const payee = String(record.payee || '').trim();
    const key = afm || payee.toLowerCase() || 'unknown';
    if (!key || key === 'unknown') continue;

    const entry = groups.get(key) || {
      key,
      name: payee || 'Άγνωστος',
      afm,
      total: 0,
      count: 0
    };
    entry.total += amount;
    entry.count += 1;
    if (!entry.name && payee) entry.name = payee;
    if (!entry.afm && afm) entry.afm = afm;
    groups.set(key, entry);
  }

  return [...groups.values()].sort((a, b) => b.total - a.total);
}

const gemiCache = new Map();

function GemiBadge({ data }) {
  if (!data) return null;
  return (
    <div className="mt-1 space-y-0.5 rounded-lg bg-slate-50 p-2 text-2xs text-slate-600">
      {data.legalType ? (
        <p>
          <span className="font-semibold text-slate-700">Νομική μορφή:</span> {data.legalType}
        </p>
      ) : null}
      {data.status ? (
        <p>
          <span className="font-semibold text-slate-700">Κατάσταση:</span> {data.status}
          {data.isActive === false ? ' · ανενεργή' : data.isActive ? ' · ενεργή' : ''}
        </p>
      ) : null}
      {data.activities?.length ? (
        <p>
          <span className="font-semibold text-slate-700">ΚΑΔ:</span>{' '}
          {data.activities
            .slice(0, 2)
            .map((a) => `${a.code}${a.primary ? '★' : ''} ${a.name}`)
            .join(' · ')}
        </p>
      ) : null}
      {data.municipality || data.prefecture ? (
        <p>
          <span className="font-semibold text-slate-700">Έδρα:</span>{' '}
          {[data.municipality, data.prefecture].filter(Boolean).join(', ')}
        </p>
      ) : null}
      <p className="pt-1 text-2xs text-slate-400">Πηγή: ΓΕΜΗ OpenData · ΑΦΜ {data.afm}</p>
    </div>
  );
}

function GemiToggle({ afm }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(gemiCache.get(afm) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || data || !afm) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/api/counterparty?afm=${encodeURIComponent(afm)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Αποτυχία λήψης ΓΕΜΗ');
        gemiCache.set(afm, payload);
        setData(payload);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [afm, open, data]);

  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-2xs font-medium text-brand-600 hover:text-brand-800"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Σύμπτυξη ΓΕΜΗ' : 'Στοιχεία ΓΕΜΗ'}
      </button>
      {open ? (
        loading ? (
          <p className="mt-1 text-2xs text-slate-400">Λήψη ΓΕΜΗ...</p>
        ) : error ? (
          <p className="mt-1 text-2xs text-amber-700">{error}</p>
        ) : (
          <GemiBadge data={data} />
        )
      ) : null}
    </div>
  );
}

function CounterpartyCard({ title, records, label, limit = 10, gemiEnabled }) {
  const ranked = useMemo(() => aggregate(records), [records]);
  const total = useMemo(() => ranked.reduce((sum, item) => sum + item.total, 0), [ranked]);
  const top = ranked.slice(0, limit);
  const restCount = Math.max(0, ranked.length - top.length);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <h4 className="mb-1 text-sm font-semibold text-slate-800">{title}</h4>
      <p className="text-xs text-slate-500">
        {ranked.length} μοναδικ{ranked.length === 1 ? 'ός' : 'οί'} {label}
        {restCount ? ` · top ${limit}` : ''}
      </p>

      {top.length ? (
        <ul className="mt-4 space-y-3">
          {top.map((entry) => {
            const share = total > 0 ? entry.total / total : 0;
            return (
              <li key={entry.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800" title={entry.name}>
                      {entry.name}
                    </p>
                    <p className="text-2xs text-slate-400">
                      {entry.afm ? `ΑΦΜ ${entry.afm} · ` : ''}
                      {entry.count} εγγρ.
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-slate-900">
                      {formatCurrency(entry.total)}
                    </span>
                    <span className="text-2xs text-slate-400">
                      {(share * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                {gemiEnabled && entry.afm ? <GemiToggle afm={entry.afm} /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-400">
          Δεν υπάρχουν επαρκή στοιχεία.
        </p>
      )}
    </div>
  );
}

export default function TopCounterparties({ items = [], meta, gemiEnabled = false }) {
  const resolvedMeta = {
    title: 'Top προμηθευτές',
    label: 'προμηθευτές',
    ...meta
  };
  const gridClass = items.length > 1 ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4';

  return (
    <section className="card space-y-4" aria-label="Top counterparties">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{resolvedMeta.title}</h3>
        <p className="text-xs text-slate-500">
          Ομαδοποίηση κατά ΑΦΜ ή επωνυμία λήπτη.
          {gemiEnabled ? ' Διαθέσιμος εμπλουτισμός ΓΕΜΗ.' : ''}
        </p>
      </div>
      <div className={gridClass}>
        {items.map((item) => (
          <CounterpartyCard
            key={item.name}
            title={item.name}
            records={item.records || []}
            label={resolvedMeta.label}
            gemiEnabled={gemiEnabled}
          />
        ))}
      </div>
    </section>
  );
}
