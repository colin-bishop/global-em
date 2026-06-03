const REPO = import.meta.env.VITE_GITHUB_REPO ?? 'colin-bishop/global-em'

// In dev, set VITE_PROGRAMS_URL=/data/programs.json and put the file in app/public/data/
// In production, reads live from GitHub raw (5-minute CDN cache is acceptable)
const DATA_URL = import.meta.env.VITE_PROGRAMS_URL
  ?? `https://raw.githubusercontent.com/${REPO}/main/data/programs.json`

let _cache = null
let _cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000

export async function fetchPrograms() {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache
  const res = await fetch(DATA_URL)
  if (!res.ok) throw new Error(`Failed to load programs: ${res.status}`)
  _cache = await res.json()
  _cacheTime = now
  return _cache
}

export function invalidateCache() {
  _cache = null
  _cacheTime = 0
}

export function applyFilters(programs, filters) {
  return programs.filter(p => {
    if (p.status !== 'approved') return false
    if (filters.isActive !== null && p.is_active !== filters.isActive) return false
    if (filters.countries?.length && !filters.countries.includes(p.country_iso)) return false
    if (filters.emRegulation?.length && !filters.emRegulation.includes(p.em_regulation)) return false
    if (filters.fullRem !== null && p.full_rem_coverage !== filters.fullRem) return false
    if (filters.collectsVideo !== null && p.collects_video !== filters.collectsVideo) return false
    if (filters.aiDevelopment !== null && p.ai_in_development !== filters.aiDevelopment) return false
    if (filters.dcfProgramme !== null && p.dcf_programme !== filters.dcfProgramme) return false
    if (filters.reviewModel?.length && !filters.reviewModel.includes(p.review_model)) return false
    if (filters.gearTypes?.length && !filters.gearTypes.some(g => p.gear_types?.includes(g))) return false
    if (filters.programmeTypes?.length && !filters.programmeTypes.some(t => p.programme_type?.includes(t))) return false
    return true
  })
}
