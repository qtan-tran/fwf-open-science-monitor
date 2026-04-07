# Extending the Monitor

This guide covers four common extension tasks:

1. [Adding a new exploration mode](#1-adding-a-new-exploration-mode)
2. [Adding a new metric](#2-adding-a-new-metric)
3. [Adding a new data source](#3-adding-a-new-data-source)
4. [Customising the frontend theme](#4-customising-the-frontend-theme)

---

## 1. Adding a New Exploration Mode

An exploration mode is a named page at `/explore/[slug]` that renders a
`ExploreModeView` sub-component. Adding a new mode touches four files.

### Step 1 — Register the mode in the hub page

Open `apps/web/src/app/explore/page.tsx` and add an entry to the `MODES` array:

```typescript
{
  slug: "co-funding",
  icon: Network,           // any Lucide icon
  title: "Co-Funding Landscape",
  description: "Which external funders co-invest with FWF projects?",
  badge: "Analysis",       // pick an existing badge or add a new colour to BADGE_COLORS
},
```

The slug becomes the URL: `/explore/co-funding`.

### Step 2 — Add metadata for the dynamic route

Open `apps/web/src/app/explore/[mode]/page.tsx` and add the slug to `MODE_META`:

```typescript
const MODE_META: Record<string, { title: string; description: string }> = {
  // … existing entries …
  "co-funding": {
    title: "Co-Funding Landscape",
    description: "Which external funders co-invest with FWF projects?",
  },
};
```

### Step 3 — Implement the view component

Open `apps/web/src/components/explore/ExploreModeView.tsx`.

1. Add a case to the `switch (mode)` at the top of the file:

```typescript
case "co-funding":
  return <CoFundingMode />;
```

2. Write the component (anywhere in the same file or in a separate file):

```typescript
function CoFundingMode() {
  const [data, setData] = useState<CoFundingItem[] | null>(null);

  useEffect(() => {
    fetch("/api/explore?mode=10")   // re-use an existing explore endpoint, or
      .then((r) => r.json())        // call any other API route
      .then(setData);
  }, []);

  if (!data) return <LoadingState />;

  return (
    <Section title="Co-Funder Breakdown">
      {/* your chart / table here */}
    </Section>
  );
}
```

### Step 4 — (Optional) Add a dedicated API endpoint

If your mode needs data that isn't served by an existing route, add a new
route file at `apps/web/src/app/api/<your-route>/route.ts`. Follow the
pattern in any existing route: validate params → check cache → query Prisma →
set cache → return JSON.

### Checklist

- [ ] Slug added to `MODES` in `explore/page.tsx`
- [ ] Metadata added to `MODE_META` in `explore/[mode]/page.tsx`
- [ ] Case added to `ExploreModeView` switch
- [ ] Component renders without errors on both light and dark backgrounds
- [ ] Mode works with an empty database (show `<EmptyState>` when `!data.length`)

---

## 2. Adding a New Metric

A metric is a row (or set of rows) in the `metric_snapshots` table, computed
by the ETL and read by the frontend. Adding a metric touches the ETL and
optionally the frontend.

### Step 1 — Write the SQL computation

Open `etl/src/metrics.py`. Add a method to `MetricComputer`:

```python
def compute_co_funder_country_counts(self) -> None:
    """Number of further-funding records per funder country, all-time."""
    sql = """
        SELECT country, COUNT(*) AS cnt
        FROM further_funding
        WHERE country IS NOT NULL
        GROUP BY country
        ORDER BY cnt DESC
    """
    with self._conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    for country, cnt in rows:
        self._store_metric(
            key="co_funder_country_count",
            year=None,
            value=float(cnt),
            ror_id=None,
            metadata={"country": country},
        )
    self._conn.commit()
```

### Step 2 — Register it in `compute_all()`

```python
def compute_all(self) -> None:
    # … existing calls …
    self.compute_co_funder_country_counts()
```

### Step 3 — Write a test

Add a test class in `etl/tests/test_metrics.py` following the pattern of the
existing `TestYearlyProjectCounts` class.

### Step 4 — Expose it in the frontend (optional)

If you want the metric available through the web API:

- **Yearly metric** — add it to `METRIC_KEY_MAP` in
  `apps/web/src/app/api/metrics/yearly/route.ts` and to the
  `YearlyMetricParam` union type in `src/lib/types.ts`.
- **Summary metric** — add the field to `MetricSummary` in `src/lib/types.ts`
  and read it in `apps/web/src/app/api/metrics/summary/route.ts`.
- **Custom shape** — add a new API route.

---

## 3. Adding a New Data Source

Adding a second funder's data (e.g. DFG via GEPRIS, OpenAIRE, NIH) follows
the same ETL pattern as the FWF source.

### Step 1 — Write a fetcher

Create `etl/src/fetcher_dfg.py` (or similar). Implement a client class with
the same interface as `FWFClient`:

```python
class DFGClient:
    def fetch_all_projects(self) -> list[dict]: ...
    def fetch_all_outputs(self) -> list[dict]: ...
```

### Step 2 — Write a cleaner

Create `etl/src/cleaner_dfg.py`. Map the source's field names to the canonical
schema used by `DatabaseLoader`. Return dicts with the same keys as
`clean_project()` returns.

> The canonical schema is defined by the column names in
> `apps/web/prisma/schema.prisma`. All cleaners must produce dicts whose keys
> match those column names (in `snake_case`).

### Step 3 — Add a source discriminator (optional)

If you want to track which funder a project came from, add a `source` column
to the `projects` table:

```prisma
// apps/web/prisma/schema.prisma
model Project {
  // …
  source  String  @default("fwf")   // "fwf" | "dfg" | …
}
```

Then run `npx prisma migrate dev --name add-project-source`.

### Step 4 — Wire it into the pipeline

Add new steps to `run_full_pipeline()` in `etl/src/pipeline.py`:

```python
dfg_client = DFGClient(DFG_API_URL, DFG_API_KEY)
raw_dfg = dfg_client.fetch_all_projects()
cleaned_dfg = [clean_dfg_project(p) for p in raw_dfg]
loader.upsert_projects(cleaned_dfg)
```

The existing `DatabaseLoader.upsert_projects()` handles any funder's records —
the upsert key is `grant_doi`, which is globally unique.

### Step 5 — Extend the metrics

`MetricComputer` already queries the full `projects`, `outputs`, and
`metric_snapshots` tables. Once DFG data is in those tables, all existing
metrics will include it automatically. Add funder-segmented metrics by adding
a `WHERE source = 'dfg'` variant of the existing SQL.

---

## 4. Customising the Frontend Theme

### Colour palette

The app uses a `primary` colour palette defined in Tailwind. To change the
accent colour, edit `apps/web/src/app/globals.css`:

```css
@theme {
  --color-primary-50:  #eff6ff;   /* currently blue */
  --color-primary-100: #dbeafe;
  /* … change all primary-* values to your target colour … */
  --color-primary-600: #2563eb;
  --color-primary-900: #1e3a8a;
}
```

All components that use `text-primary-*`, `bg-primary-*`, or
`border-primary-*` will update automatically.

### Dark mode

Dark mode is driven by the `dark:` Tailwind variant, which responds to the
`prefers-color-scheme` media query. The `useChartTheme` hook
(`apps/web/src/components/charts/useChartTheme.ts`) reads the current theme to
colour chart grid lines, axes, and tooltips — no chart-level changes are needed
when you change the palette.

### Chart colours

The shared `CHART_COLORS` constant lives in `ExploreModeView.tsx`. It is
typed as a `readonly` tuple so TypeScript will catch typos:

```typescript
const CHART_COLORS = [
  "#1e40af",  // blue-800
  "#0f766e",  // teal-700
  // …
] as const;
```

Replace any hex value to update the chart series colours globally.

### Adding a new badge colour

Exploration mode badges are styled via the `BADGE_COLORS` map in
`apps/web/src/app/explore/page.tsx`:

```typescript
const BADGE_COLORS: Record<string, string> = {
  // …
  "NewCategory": "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};
```

Add a new key and Tailwind class string, then use that key as the `badge`
property of your new mode entry.
