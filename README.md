# GlobalEM Dashboard

Interactive web dashboard for the ICES Working Group on Technology in Fisheries Data collection (WGTIFD) Electronic Monitoring programme inventory. Visualises global EM programmes on a world map, coloured by EM vessel count, with filtering and programme detail panels.

**Live site:** [em4.fish](https://em4.fish)  
**Data backend:** Supabase (PostgreSQL)  
**Source data:** ICES WGTIFD EM Programme Survey (Microsoft Forms → Excel)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Map | MapLibre GL JS (OpenFreeMap positron tiles) |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL + PostgREST + RLS) |
| Data pipeline | Python (openpyxl, supabase-py) |

---

## Local development

### Prerequisites

- Node.js 18+
- Python 3.9+
- A Supabase project (free tier is sufficient)

### 1. Clone and install

```bash
git clone https://github.com/colin-bishop/global-em.git
cd global-em
cd app && npm install && cd ..
pip install -r scripts/requirements.txt
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
GITHUB_TOKEN=your-github-token          # only needed for export script
GITHUB_REPO=colin-bishop/global-em
GITHUB_CSV_PATH=data/programs.csv
```

Keys are found in your Supabase project under **Settings → API**.

### 3. Run the database migration

Paste the contents of `supabase/migrations/001_initial.sql` into the Supabase **SQL Editor** and run it. This creates the `programs` and `submissions` tables with Row Level Security policies.

### 4. Import programme data

Place your `inventory.xlsx` (WGTIFD survey export) in `data/` then run:

```bash
python scripts/import_excel.py
```

This normalises country names to ISO-3 codes, looks up centroids, and upserts all rows into Supabase with `status = 'approved'`.

### 5. Start the dev server

```bash
cd app
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Deployment

### Option A — Netlify (recommended)

Netlify connects to GitHub and redeploys automatically on every push.

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git → GitHub → `colin-bishop/global-em`**

2. Set the build configuration:

   | Setting | Value |
   |---------|-------|
   | Base directory | `app` |
   | Build command | `npm run build` |
   | Publish directory | `app/dist` |

3. Add environment variables under **Site configuration → Environment variables**:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   > The service key is **not** needed here — it is only used by the Python scripts and must never be exposed in the frontend.

4. Click **Deploy site**. Netlify will build and publish the app.

5. **Point your domain:** In your domain registrar's DNS settings, add:

   ```
   Type   Name   Value
   CNAME  @      your-site-name.netlify.app
   ```

   Then in Netlify go to **Domain management → Add a domain** and enter `em4.fish`. Netlify provisions a free TLS certificate automatically.

### Option B — Cloudflare Pages

Best if your DNS is already managed by Cloudflare (zero-downtime domain connection).

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**
2. Select `colin-bishop/global-em`
3. Build settings — same as Netlify above (`app` / `npm run build` / `app/dist`)
4. Add the two `VITE_` environment variables
5. Under **Custom domains**, add `em4.fish` — Cloudflare handles DNS and TLS automatically

### Option C — Static file upload (any web host)

If em4.fish already has traditional shared hosting (cPanel, FTP):

```bash
cd app
npm run build          # outputs to app/dist/
```

Upload the **contents** of `app/dist/` to your web root (`public_html/` or `www/`). Repeat after every change.

### Subdirectory hosting

If the app lives at a path like `em4.fish/globalem/` rather than the root, set:

```
VITE_BASE_PATH=/globalem/
```

before building. Leave it unset (or blank) for root hosting.

---

## Data pipeline

### Approving submissions

New programme submissions arrive in the `submissions` table in Supabase. To approve one:

1. Open the Supabase dashboard → **Table Editor → submissions**
2. Copy the row's data into the `programs` table and set `status = 'approved'`

### Exporting a CSV snapshot to GitHub

```bash
python scripts/export_csv.py
```

Requires `GITHUB_TOKEN` (fine-grained token with **Contents: Read & Write** on this repo) in `.env`. Pushes `data/programs.csv` to the repository.

---

## Project structure

```
global-em/
├── app/                        # React + Vite frontend
│   ├── public/
│   │   └── countries.geojson   # Simplified country polygons (Natural Earth 110m)
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Filters/FilterPanel.jsx
│       │   ├── Map/MapView.jsx
│       │   ├── Programs/ProgramDetail.jsx
│       │   ├── Programs/ProgramList.jsx
│       │   └── Submit/SubmitForm.jsx
│       └── lib/supabase.js
├── data/
│   ├── country_centroids.json  # ISO-3 → [lat, lon]
│   └── country_iso_map.json    # Country name → ISO-3 normalisation map
├── scripts/
│   ├── import_excel.py         # Load survey Excel → Supabase
│   ├── export_csv.py           # Push approved programmes CSV → GitHub
│   └── prepare_eez.py          # Simplify EEZ GeoJSON for the map
├── supabase/
│   └── migrations/001_initial.sql
├── .env.example
└── README.md
```
