# Δήμοι Ελλάδας — Dashboard Διαφάνειας (Next.js)

Διαδραστικό dashboard που οπτικοποιεί πληρωμές και δεσμεύσεις ελληνικών δήμων από αποφάσεις Διαύγειας. Αναπτύχθηκε ως ερευνητικό εργαλείο για διπλωματική σε Technology Acceptance Model (TAM) με την εξωτερική μεταβλητή **Perceived Transparency**.

## Δεδομένα — snapshot model

Η Διαύγεια (luminapi) δεν εκθέτει αξιόπιστο year filter ούτε αθροισμένα ποσά ανά δήμο. Για να γίνουν εφικτά τα γραφήματα, χρησιμοποιείται **πρε-υπολογισμένο snapshot** ανά δήμο:

- 15 επιλεγμένοι δήμοι (Αθηναίων, Θεσσαλονίκης, Πειραιώς, Πατρέων, Ηρακλείου, Λαρισαίων, Βόλου, Ιωαννιτών, Καλλιθέας, Περιστερίου, Σαλαμίνας, Χανίων, Αχαρνών, Νέας Σμύρνης, Αγίου Δημητρίου)
- Ανά δήμο, οι **800 πιο πρόσφατες** αποφάσεις από τους τύπους **Β.2.2** (ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ ΠΛΗΡΩΜΗΣ) και **Β.1.3** (ΑΝΑΛΗΨΗ ΥΠΟΧΡΕΩΣΗΣ)
- Ποσά + ΚΑΕ + δικαιούχοι από `extraFieldValues` του κάθε ΑΔΑ
- Αποθηκεύονται στο `lib/data/snapshots/{uid}.json`, με index στο `lib/data/snapshots/index.json`

Το UI είναι ξεκάθαρο για το ότι πρόκειται για δείγμα: εμφανίζει «Δείγμα Χ.Χ%» και την ημερομηνία snapshot σε κάθε γράφημα.

## Δυνατότητες

| Στρώμα | Λεπτομέρειες |
|---|---|
| Αναζήτηση δήμου | Greek-aware ranking πάνω στα διαθέσιμα snapshots |
| Πληρωμές (Β.2.2) | Group by δικαιούχο, top counterparties, decision detail expand |
| Δεσμεύσεις (Β.1.3) | Group by ΚΑΕ |
| Σύγκριση 2 δήμων | URL `?m1=…&m2=…&year=…`, side-by-side charts/tables |
| Per-capita | Toggle με ΕΛΣΤΑΤ 2021 (stem matching for Greek case forms) |
| Διαχρονική εξέλιξη | Line chart (περιορίζεται από εύρος snapshot) |
| Decision metadata | Live από `diavgeia.gov.gr/luminapi/opendata/decisions/{ada}` |
| Reconciliation | «Δείγμα Χ από Y αποφάσεις στη Διαύγεια» |
| Source attribution | Σε κάθε γράφημα: snapshot date, endpoint, decision type |
| ΓΕΜΗ enrichment (opt-in) | Αν `GEMI_API_KEY` set, ΑΦΜ → ΚΑΔ/legal form/status |

## Εγκατάσταση

```bash
npm install
```

## Δημιουργία/ανανέωση snapshots

```bash
node scripts/snapshot-luminapi.mjs 800
```

Παίρνει τους τελευταίους 800 ΑΔΑ ανά τύπο για κάθε δήμο της `TARGETS` λίστας στο script. ~10 λεπτά για 15 δήμους με concurrency 20. Ξανατρέξτε το όποτε θέλετε φρέσκα δεδομένα.

Παράμετρος είναι το όριο decisions/τύπο/δήμο. Δίνει δείγμα ~6 μηνών για μεγάλους δήμους όπως ο Αθηναίων, ~1 έτους για μικρούς.

## Τρέξιμο

```bash
npm run dev
```

- Αρχική: `http://localhost:3000/` — εμφανίζει λίστα διαθέσιμων δήμων + ημερομηνία snapshot
- Σύγκριση: `http://localhost:3000/compare?m1=Σαλαμίνα&year=2025`
- Compare-2: `http://localhost:3000/compare?m1=Σαλαμίνα&m2=Καλλιθέα&year=2025`

## Build

```bash
npm run build
```

## Environment variables

```env
# Optional: ΓΕΜΗ enrichment. Πάρτε API key από https://opendata.businessportal.gr/register/
GEMI_API_KEY=
```

## Backend API routes

| Route | Πηγή | Περιγραφή |
|---|---|---|
| `GET /api/searchOrgs?term=…` | snapshot index | Αναζήτηση στο διαθέσιμο σύνολο δήμων |
| `GET /api/budget?uid=…&year=…` | snapshot Β.2.2 | Πληρωμές · group by δικαιούχο · per-capita |
| `GET /api/earnings?uid=…&year=…` | snapshot Β.1.3 | Δεσμεύσεις · group by ΚΑΕ |
| `GET /api/trend?uid=…&year=…` | snapshot multi-year | Line chart 5 ετών |
| `GET /api/decision?ada=…` | luminapi live | Decision metadata + LRU cache |
| `GET /api/counterparty?afm=…` | ΓΕΜΗ (opt-in) | ΚΑΔ, legal form, status |
| `GET /api/config` | static | Feature flags + snapshot meta |

## Mapping σε TAM μεταβλητές

| Στοιχείο UI | Στοιχείο TAM που ενισχύει |
|---|---|
| Source footer ανά γράφημα | **PT** (αξιοπιστία) |
| Reconciliation card («Δείγμα X από Y στη Διαύγεια») | **PT** (πληρότητα + ειλικρίνεια) |
| Snapshot date ανά γράφημα | **PT** (αξιοπιστία) |
| Πληρωμές vs Δεσμεύσεις tabs | **PT** (πληρότητα) + **PU** |
| Decision metadata expand row (live luminapi) | **PT** (verifiable trail) |
| Per-capita toggle | **PU** (νοηματική σύγκριση) |
| Top δικαιούχοι με ΑΦΜ + share % | **PU** (πού πάει το χρήμα) |
| Year-over-year trend | **PU** (χρονική εξέλιξη) |
| ΓΕΜΗ counterparty info | **PT** (ποιοι πληρώνονται) |
| Σύγκριση 2 δήμων | **PU** (συγκριτική κατανόηση) |

## Πηγές

- **Διαύγεια luminapi** — `https://diavgeia.gov.gr/luminapi/opendata/{decisions,organizations}` και `/api/search`
- **ΓΕΜΗ OpenData** — `https://opendata-api.businessportal.gr/api/opendata/v1/companies` (opt-in)
- **ΕΛΣΤΑΤ Census 2021** — vendored CSV από [tdiam/greece-population-census-2021](https://github.com/tdiam/greece-population-census-2021)
