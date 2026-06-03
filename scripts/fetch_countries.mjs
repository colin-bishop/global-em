/**
 * Downloads Natural Earth 110m admin-0 countries GeoJSON, strips it to
 * just { iso3, name } properties, and writes it to app/public/countries.geojson.
 *
 * Usage: node scripts/fetch_countries.mjs
 */
import { createRequire } from 'module'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import https from 'https'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT  = join(ROOT, 'app', 'public', 'countries.geojson')
const URL  = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) return resolve(get(res.headers.location))
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve(body))
    }).on('error', reject)
  })
}

console.log('Downloading Natural Earth 110m countries…')
const raw = await get(URL)
console.log(`Downloaded ${(raw.length / 1024).toFixed(0)} KB`)

const geo = JSON.parse(raw)
console.log(`Features: ${geo.features.length}`)

// Strip to just iso3 + name; skip features without a valid ISO code
// Natural Earth assigns ISO_A3 = '-99' for some mainland polygons of countries
// with overseas territories (France, Norway, etc.). Fall back to ADM0_A3 which
// is always populated with the correct ISO code.
function resolveIso(props) {
  const iso = props.ISO_A3
  if (iso && iso !== '-99') return iso
  return props.ADM0_A3 || null
}

const seen = new Set()
const cleaned = {
  type: 'FeatureCollection',
  features: geo.features
    .map(f => ({ ...f, _iso: resolveIso(f.properties) }))
    .filter(f => {
      if (!f._iso) return false
      // Keep only the first feature per ISO code (avoids duplicates from
      // overseas territory polygons that share the same ADM0_A3)
      if (seen.has(f._iso)) return false
      seen.add(f._iso)
      return true
    })
    .map(f => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        iso3: f._iso,
        name: f.properties.NAME,
      },
    })),
}

const missing = geo.features.filter(f => !resolveIso(f.properties)).map(f => f.properties.NAME)
if (missing.length) console.log(`Skipped (no ISO code): ${missing.join(', ')}`)

const out = JSON.stringify(cleaned)
writeFileSync(OUT, out)
console.log(`Written ${(out.length / 1024).toFixed(0)} KB → ${OUT}`)
console.log(`Features kept: ${cleaned.features.length}`)
