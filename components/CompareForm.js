import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';

function normalizeForSearch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

function filterMunicipalities(list, query) {
  const trimmed = query.trim();
  if (!trimmed) return list;
  const normalized = normalizeForSearch(trimmed);
  return list.filter((item) => normalizeForSearch(item.label).includes(normalized));
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

const MODE_SINGLE = 'single';
const MODE_TWO_ORGS = 'twoOrgs';
const MODE_TWO_YEARS = 'twoYears';

function YearSelect({ id, label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        className="input"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MunicipalityField({
  id,
  label,
  value,
  onChange,
  options = [],
  placeholder = 'π.χ. Σαλαμίνα'
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const filtered = useMemo(() => filterMunicipalities(options, value), [options, value]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="input pl-10 pr-9"
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setIsMenuOpen(true);
          }}
          autoComplete="off"
          onFocus={() => setIsMenuOpen(true)}
          onClick={() => setIsMenuOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsMenuOpen(false), 120);
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onMouseDown={(event) => {
            event.preventDefault();
            setIsMenuOpen((open) => !open);
          }}
          aria-label="Άνοιγμα λίστας"
        >
          <ChevronDownIcon />
        </button>
        {isMenuOpen ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel-lg">
            {filtered.length ? (
              <ul className="max-h-[210px] overflow-y-auto py-1">
                {filtered.map((item) => (
                  <li key={item.uid}>
                    <button
                      type="button"
                      className="flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onChange(item.label);
                        setIsMenuOpen(false);
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-3 text-xs text-slate-400">Κανένα αποτέλεσμα.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CompareForm({ municipalities = [] }) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const [mode, setMode] = useState(MODE_SINGLE);
  const [municipality, setMunicipality] = useState('');
  const [secondMunicipality, setSecondMunicipality] = useState('');
  const [year, setYear] = useState(String(currentYear));
  const [secondYear, setSecondYear] = useState(String(currentYear - 1));
  const [formError, setFormError] = useState('');

  const yearOptions = useMemo(() => {
    return Array.from({ length: 8 }, (_, index) => String(currentYear - index));
  }, [currentYear]);

  const onReset = () => {
    setMunicipality('');
    setSecondMunicipality('');
    setYear(String(currentYear));
    setSecondYear(String(currentYear - 1));
    setFormError('');
  };

  const onSubmit = (event) => {
    event.preventDefault();

    const m1 = municipality.trim();
    if (!m1) {
      setFormError('Συμπλήρωσε έναν φορέα.');
      return;
    }

    const params = new URLSearchParams({ m1, year });

    if (mode === MODE_TWO_ORGS) {
      const m2 = secondMunicipality.trim();
      if (!m2) {
        setFormError('Συμπλήρωσε τον δεύτερο φορέα.');
        return;
      }
      if (m1.toLowerCase() === m2.toLowerCase()) {
        setFormError('Επίλεξε δύο διαφορετικούς φορείς (ή χρησιμοποίησε «Σύγκριση 2 ετών»).');
        return;
      }
      params.set('m2', m2);
    } else if (mode === MODE_TWO_YEARS) {
      if (year === secondYear) {
        setFormError('Επίλεξε δύο διαφορετικά έτη.');
        return;
      }
      params.set('m2', m1);
      params.set('y2', secondYear);
    }

    setFormError('');
    router.push(`/compare?${params.toString()}`);
  };

  const modeButton = (value, label) => {
    const active = mode === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => {
          setMode(value);
          setFormError('');
        }}
        className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
          active
            ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-5" aria-label="Municipality search form">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Αναζήτηση δήμων / φορέων</h2>
        <p className="mt-1 text-sm text-slate-500">
          Διάλεξε έναν φορέα, δύο φορείς για σύγκριση, ή έναν φορέα σε δύο έτη.
        </p>
        <div className="mt-6 flex flex-wrap gap-1.5">
          {modeButton(MODE_SINGLE, 'Ένας φορέας')}
          {modeButton(MODE_TWO_ORGS, '2 φορείς')}
          {modeButton(MODE_TWO_YEARS, '2 έτη')}
        </div>
      </div>

      {mode === MODE_TWO_ORGS ? (
        <div className="grid gap-4 md:grid-cols-3 md:items-start">
          <MunicipalityField
            id="municipality-1"
            label="Φορέας Α"
            value={municipality}
            onChange={(next) => {
              setMunicipality(next);
              if (formError) setFormError('');
            }}
            options={municipalities}
          />
          <MunicipalityField
            id="municipality-2"
            label="Φορέας Β"
            value={secondMunicipality}
            onChange={(next) => {
              setSecondMunicipality(next);
              if (formError) setFormError('');
            }}
            placeholder="π.χ. Καλλιθέα"
            options={municipalities}
          />
          <YearSelect
            id="year"
            label="Έτος (κοινό)"
            value={year}
            onChange={setYear}
            options={yearOptions}
          />
        </div>
      ) : mode === MODE_TWO_YEARS ? (
        <div className="grid gap-4 md:grid-cols-3 md:items-start">
          <MunicipalityField
            id="municipality-1"
            label="Φορέας"
            value={municipality}
            onChange={(next) => {
              setMunicipality(next);
              if (formError) setFormError('');
            }}
            options={municipalities}
          />
          <YearSelect
            id="year"
            label="Έτος Α"
            value={year}
            onChange={setYear}
            options={yearOptions}
          />
          <YearSelect
            id="year-2"
            label="Έτος Β"
            value={secondYear}
            onChange={setSecondYear}
            options={yearOptions}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <MunicipalityField
            id="municipality-1"
            label="Δήμος / Φορέας"
            value={municipality}
            onChange={(next) => {
              setMunicipality(next);
              if (formError) setFormError('');
            }}
            options={municipalities}
          />
          <YearSelect
            id="year"
            label="Έτος"
            value={year}
            onChange={setYear}
            options={yearOptions}
          />
        </div>
      )}

      <div className="flex flex-wrap items-end justify-end gap-3">
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onReset}>
            Καθαρισμός
          </button>
          <button type="submit" className="btn-primary">
            Προβολή αποτελεσμάτων
            <ArrowRightIcon />
          </button>
        </div>
      </div>

      {formError ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
          {formError}
        </div>
      ) : null}
    </form>
  );
}
