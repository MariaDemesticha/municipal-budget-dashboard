import Head from 'next/head';
import CompareForm from '../components/CompareForm';
import {
  getSnapshotIndex,
  listAllMunicipalities,
  listAvailableOrgs
} from '../lib/snapshots';

export async function getStaticProps() {
  const index = getSnapshotIndex();
  const availableUids = new Set(listAvailableOrgs().map((o) => o.uid));
  const municipalities = listAllMunicipalities()
    .filter((m) => availableUids.has(m.uid))
    .map((m) => ({
      uid: m.uid,
      label: m.label,
      vatNumber: m.vatNumber || '',
      dataAvailable: true
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'el'));

  return {
    props: {
      decisionTypes: index.decisionTypes || [],
      municipalities
    }
  };
}

export default function HomePage({ decisionTypes = [], municipalities = [] }) {
  return (
    <>
      <Head>
        <title>Δημόσιες Δαπάνες & Διαφάνεια</title>
        <meta
          name="description"
          content="Αναζήτηση και σύγκριση πληρωμών και δεσμεύσεων των ελληνικών δήμων ανά έτος, δικαιούχο και κωδικό αριθμό εξόδου (ΚΑΕ)."
        />
      </Head>

      <div className="min-h-screen bg-gray-50/80">
        <div className="h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400" />

        <main className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6 md:py-20">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Δημόσιες Δαπάνες & Διαφάνεια
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-base text-slate-500">
              Αναζήτηση και σύγκριση πληρωμών και δεσμεύσεων των ελληνικών δήμων ανά έτος, δικαιούχο
              και κωδικό αριθμό εξόδου (ΚΑΕ).
            </p>
          </div>

          <CompareForm municipalities={municipalities} />

          <section className="mt-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-xs leading-relaxed text-sky-900">
            <span
              className="material-icons mt-0.5 shrink-0 text-sky-600"
              style={{ fontSize: 18, width: 18, height: 18, lineHeight: '18px' }}
              aria-hidden
            >
              info
            </span>
            <p>
              Λόγω του μεγάλου όγκου δεδομένων στη{' '}
              <a
                href="https://diavgeia.gov.gr"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline decoration-sky-400 underline-offset-2 hover:text-sky-700"
              >
                Διαύγεια
              </a>
              , αυτή η έκδοση καλύπτει πλήρες ιστορικό 2019-2026 μόνο για τον δήμο{' '}
              <strong>Αθηναίων</strong> και τον δήμο <strong>Σαλαμίνας</strong>.
            </p>
          </section>

          <footer className="mt-6 text-center text-xs text-slate-400">
            Πηγή δεδομένων: Διαύγεια luminapi · Πληθυσμοί: ΕΛΣΤΑΤ Census 2021
          </footer>
        </main>
      </div>
    </>
  );
}
