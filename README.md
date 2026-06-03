# GlobalEM Dashboard

Interactive web dashboard for the ICES Working Group on Technology in Fisheries Data collection (WGTIFD) Electronic Monitoring programme inventory. Visualises global EM programmes on a world map, coloured by EM vessel count, with filtering and programme detail panels.

**Live site:** [map.em4.fish](https://map.em4.fish)  
**Data:** `data/programs.json` in this repository (no external database)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Map | MapLibre GL JS (OpenFreeMap positron tiles) |
| Styling | Tailwind CSS |
| Data store | `data/programs.json` in git |
| Submission workflow | GitHub Pull Requests (via Netlify Functions) |
| Hosting | Netlify |

---

## How it works

Approved programme data lives in [`data/programs.json`](data/programs.json) — a plain JSON file committed to this repo. The frontend fetches it directly from the GitHub raw URL at runtime; no database or build step is needed to update data.

### Submission workflow

1. A user fills in the **Add / Edit Programme** form in the app
2. The form submits to a Netlify serverless function (`submit.js`)
3. The function creates a branch (`submissions/…`) containing the new entry as `data/submissions/<id>.json`, then opens a Pull Request
4. Admins review the PR on GitHub **and/or** via the in-app **Admin** tab
5. Approving in the admin panel merges the PR, appends the entry to `data/programs.json`, and removes the staging file — all via the GitHub API
6. Netlify auto-deploys on the push to `main` (takes ~1–2 min to go live)

Rejecting a submission closes the PR and deletes the branch.

---

## Local development

### Prerequisites

- Node.js 18+
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) (`npm install -g netlify-cli`) — runs functions locally
- Python 3.9+ (only needed if using the data import scripts)

### 1. Clone and install

```bash
git clone https://github.com/colin-bishop/global-em.git
cd global-em/app
npm install
```

### 2. Create a GitHub App

The submission and admin functions authenticate as a **GitHub App** rather than a personal access token. This means PRs and commits appear as `your-app-name[bot]` rather than a personal account, and the token is short-lived and scoped to this repo only.

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
   - **GitHub App name:** e.g. `globalem-submissions` (must be globally unique)
   - **Homepage URL:** your live site URL, or `http://localhost:8888` for local-only
   - **Webhook:** uncheck *Active*
   - **Permissions:**
     - Repository permissions → Contents: **Read & Write**
     - Repository permissions → Pull requests: **Read & Write**
   - **Where can this GitHub App be installed:** Only on this account
   - Click **Create GitHub App**

2. On the app settings page that opens:
   - Note the **App ID** shown near the top (a 6–7 digit number)
   - Scroll to *Private keys* → **Generate a private key** — a `.pem` file downloads automatically
   - Click **Install App** in the left sidebar → **Install** on `colin-bishop/global-em`
   - After installing, look at the URL: `github.com/settings/installations/XXXXXXXX` — that number is your **Installation ID**

3. Open the `.pem` file in a text editor. You'll add its contents as an environment variable in the next step.

### 3. Configure environment

Copy `.env.example` to `.env.local` at the **project root** (not inside `app/`) and fill in your values:

```bash
cp .env.example .env.local
```

```
# GitHub App credentials (from the app you created above)
GITHUB_APP_ID=123456
GITHUB_APP_INSTALLATION_ID=12345678
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"

GITHUB_REPO=colin-bishop/global-em
ADMIN_PASSWORD=choose-a-password

# Frontend public vars
VITE_GITHUB_REPO=colin-bishop/global-em

# Local dev: serve programs.json from Vite's public folder instead of GitHub CDN
VITE_PROGRAMS_URL=/data/programs.json
```

> **Note on the private key:** paste the full PEM content including the header/footer lines. In `.env.local` you can use actual newlines inside a quoted value. On Netlify (below) you'll need to replace newlines with `\n`.

To keep `programs.json` fresh locally after re-running the import script:

```bash
cp data/programs.json app/public/data/programs.json
```

### 4. Start the dev server

Use Netlify CLI so the serverless functions work alongside the frontend:

```bash
cd global-em      # project root (where netlify.toml lives)
netlify dev
```

Open [http://localhost:8888](http://localhost:8888).

(Or `cd app && npm run dev` for frontend-only on port 5173 — submit and admin features will show an error without the functions runtime.)

---

## Deployment

### Netlify (recommended)

Netlify redeploys automatically on every push to `main`.

1. **app.netlify.com** → Add new site → Import from Git → `colin-bishop/global-em`

2. Build configuration (already in `netlify.toml` — no manual entry needed):

   | Setting | Value |
   |---------|-------|
   | Base directory | `app` |
   | Build command | `npm run build` |
   | Publish directory | `dist` |
   | Functions directory | `netlify/functions` |

3. Add environment variables under **Site configuration → Environment variables**:

   ```
   GITHUB_APP_ID=123456
   GITHUB_APP_INSTALLATION_ID=12345678
   GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIEo...\n-----END RSA PRIVATE KEY-----
   GITHUB_REPO=colin-bishop/global-em
   ADMIN_PASSWORD=your-admin-password
   VITE_GITHUB_REPO=colin-bishop/global-em
   ```

   > **Private key on Netlify:** paste the PEM contents with literal `\n` between lines (no actual newlines) — Netlify's UI stores multi-line values unreliably. The functions will call `.replace(/\\n/g, '\n')` to restore the newlines.

4. Click **Deploy site**.

5. **Point the subdomain:** In your DNS, add a CNAME for `map` pointing to
   `your-site-name.netlify.app`, then add the custom domain in Netlify.

### Cloudflare Pages

Same build settings as above. Add the four environment variables. Under **Custom domains**, add `map.em4.fish`.

### Subdirectory on WordPress host

```bash
cd app
VITE_BASE_PATH=/map/ npm run build
```

Upload `app/dist/` to a `map/` folder in your WordPress web root, and add to `.htaccess`:

```apache
RewriteCond %{REQUEST_URI} ^/map/
RewriteRule ^ - [L]
```

Netlify Functions are not available with this option — submit and admin features require a serverless runtime. Consider Netlify or Cloudflare Pages instead.

---

## Adding and approving programmes

### Adding a new programme

Use the **Add / Edit Programme** tab in the app. The form walks through all fields and submits to the serverless function, which opens a GitHub PR automatically.

Alternatively, edit `data/programs.json` directly and open a PR manually. Each entry must include a unique `id` (UUID) and `"status": "approved"`.

### Admin review (in-app)

1. Open the **Admin** tab and enter the admin password
2. Pending submissions are listed with their field values and a link to the GitHub PR
3. Click **Approve** to merge the PR and publish the programme, or **Reject** to close the PR and delete the branch

### Admin review (GitHub)

Open the repo's [Pull requests](https://github.com/colin-bishop/global-em/pulls) tab. Each submission PR shows the full `data/submissions/<id>.json` diff. Merge to approve (the programme will appear after the next Netlify deploy), or close to reject.

> **Note:** If you merge directly on GitHub without using the in-app admin, the submission file will remain in `data/submissions/` on `main`. Clean it up by deleting the file and committing, or use the in-app admin panel which handles cleanup automatically.

### Importing from the existing survey Excel

```bash
pip install -r scripts/requirements.txt
python scripts/import_excel.py
```

This script still exists for bulk imports from the WGTIFD survey Excel. It previously wrote to Supabase; update the target in the script to write to `data/programs.json` directly before running.

---

## Project structure

```
global-em/
├── app/                            # React + Vite frontend
│   ├── netlify/
│   │   └── functions/
│   │       ├── submit.js           # Create branch + PR for new submission
│   │       ├── pending.js          # List open submission PRs for admin
│   │       ├── approve.js          # Merge PR + update programs.json
│   │       └── reject.js           # Close PR + delete branch
│   ├── public/
│   │   ├── countries.geojson       # Simplified country polygons
│   │   ├── eez_simplified.geojson  # EEZ boundaries (optional)
│   │   ├── fao_areas.geojson
│   │   └── ices_areas.geojson
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Admin/AdminPanel.jsx
│       │   ├── Filters/FilterPanel.jsx
│       │   ├── Map/MapView.jsx
│       │   ├── Programs/ProgramDetail.jsx
│       │   ├── Programs/ProgramList.jsx
│       │   ├── Submit/DuplicateCheck.jsx
│       │   └── Submit/SubmitForm.jsx
│       └── lib/
│           └── programs.js         # Data fetching + filtering (replaces Supabase)
├── data/
│   ├── programs.json               # Canonical approved programme data
│   ├── submissions/                # Staging area for pending PRs (auto-managed)
│   ├── country_centroids.json
│   └── country_iso_map.json
├── scripts/
│   ├── import_excel.py             # Bulk import from WGTIFD survey Excel
│   ├── export_csv.py               # Legacy CSV export
│   └── prepare_eez.py              # Simplify EEZ GeoJSON
├── supabase/                       # Legacy — schema kept for reference
│   └── migrations/001_initial.sql
├── .env.example
├── netlify.toml
└── README.md
```

---

## Migrating data from Supabase

If you have existing approved programmes in Supabase, export them to `data/programs.json`:

```bash
# Install supabase-py if not already
pip install supabase-py python-dotenv

python - <<'EOF'
import json, os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
sb = create_client(os.environ['VITE_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
rows = sb.from_('programs').select('*').eq('status', 'approved').execute().data
with open('data/programs.json', 'w') as f:
    json.dump(rows, f, indent=2, default=str)
print(f"Exported {len(rows)} programmes")
EOF
```

Commit `data/programs.json` and push — Netlify will deploy the updated data.
