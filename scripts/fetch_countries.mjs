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
const cleaned = {
  type: 'FeatureCollection',
  features: geo.features
    .filter(f => f.properties.ISO_A3 && f.properties.ISO_A3 !== '-99')
    .map(f => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        iso3: f.properties.ISO_A3,
        name: f.properties.NAME,
      },
    })),
}

const missing = geo.features.filter(f => !f.properties.ISO_A3 || f.properties.ISO_A3 === '-99')
  .map(f => f.properties.NAME)
if (missing.length) console.log(`Skipped (no ISO code): ${missing.join(', ')}`)

const out = JSON.stringify(cleaned)
writeFileSync(OUT, out)
console.log(`Written ${(out.length / 1024).toFixed(0)} KB → ${OUT}`)
console.log(`Features kept: ${cleaned.features.length}`)
