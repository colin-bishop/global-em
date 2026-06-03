/**
 * clean_programs.mjs — Apply critical and high standardization fixes to programs.json
 * Run: node scripts/clean_programs.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC  = join(ROOT, 'data', 'programs.json')
const OUT  = join(ROOT, 'data', 'programs.json')

const programs = JSON.parse(readFileSync(SRC, 'utf8'))
const log = []
const changed = (id, name, field, from, to) =>
  log.push({ programme: name, field, from: JSON.stringify(from), to: JSON.stringify(to) })

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split a semicolon-delimited string into a trimmed, deduped array. */
function splitSemi(val) {
  if (!val) return []
  return [...new Set(
    val.split(';').map(s => s.trim()).filter(Boolean)
  )]
}

/** Normalise a semicolon-delimited multi-select field to a canonical sorted array,
 *  then join back to a semicolon string (no trailing semicolon). */
function normaliseSemiField(val, canonicalOrder) {
  const tokens = splitSemi(val)
  if (!tokens.length) return null
  if (canonicalOrder) {
    tokens.sort((a, b) => {
      const ai = canonicalOrder.indexOf(a)
      const bi = canonicalOrder.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  } else {
    tokens.sort()
  }
  return tokens.join(';')
}

// ── Canonical orderings & mappings ────────────────────────────────────────────

const DATA_TX_MAP = {
  'Physical receipt (hard drives)': 'Physical receipt (hard drives)',
  'Remote Upload - automatic':      'Remote upload - automatic',
  'Remote upload - automatic':      'Remote upload - automatic',
  'Remote Upload - on-demand':      'Remote upload - on-demand',
  'Remote upload - on-demand':      'Remote upload - on-demand',
}
const DATA_TX_ORDER = [
  'Physical receipt (hard drives)',
  'Remote upload - automatic',
  'Remote upload - on-demand',
]

const CATCH_STAGE_ORDER = ['Hauling', 'Pre-sorting', 'Sorting', 'Sorted']

const DATA_STORAGE_MAP = {
  'Project/programme specific':  'Project/programme specific',
  'Project/programme specificÂ': 'Project/programme specific', // encoding artefact
  'EM specific':                 'EM specific',
  'National integrated':         'National integrated',
  'Regional integrated':         'Regional integrated',
  'Physical storage':            'Physical storage',
  'Cloud-based storage':         'Cloud-based storage',
  // free-text → controlled
  'Locally within DFO or partner review system': 'National integrated',
  '3rd party data storage (Ai.Fish)':            'EM specific',
}
const DATA_STORAGE_ORDER = [
  'Project/programme specific',
  'EM specific',
  'National integrated',
  'Regional integrated',
  'Physical storage',
  'Cloud-based storage',
]

const AI_REVIEW_CONTROLLED = new Set([
  'Processing of sensor data',
  'Processing of video data - catch review',
  'Processing of video data - quality assurance',
  'Processing of video data - gear review',
  'Annotation of images',
  'GDPR-related issues',
  'Other',
])
const AI_NULL_TOKENS = new Set(['Not', 'NA', 'TBD', 'N/A'])
const AI_REVIEW_ORDER = [
  'Processing of sensor data',
  'Processing of video data - catch review',
  'Processing of video data - quality assurance',
  'Processing of video data - gear review',
  'Annotation of images',
  'GDPR-related issues',
  'Other',
]

const GEAR_MAP = {
  'Bottom trawls':  'Bottom trawls [OTB, OTT, PTB, TBB]',
  'Pelagic trawls': 'Pelagic trawls [OTM, PTM]',
  'Longlines':      'Longlines [LLD, LLS]',
  'Traps':          'Traps [FPO, FYK, FPN]',
  'Seines':         'Seines [SSC, SDN, SPR, SB, SV]',
  'Set nets':       'Nets [GTR, GNS, GND]',
}
const GEAR_REMOVE = new Set(['focus on boat activity', 'Not vessel-based'])

const SUPPLIER_MAP = {
  'Agency selected/Approved -Single':          'Agency selected/Approved - Single supplier',
  'Agency selected/Approved -Single supplier': 'Agency selected/Approved - Single supplier',
  'Agency selected/Approved - Multiple suppliers': 'Agency selected/Approved - Multiple suppliers',
  'Industry selected - Single':                'Industry selected - Single supplier',
  'Industry selected - Multi':                 'Industry selected - Multiple suppliers',
}

// recording_config values that actually belong in video_recording_type
const RECORDING_TYPE_VALUES = new Set([
  'Continuous',
  'Interrupted according to sensor data (e.g. video recording is triggeredÂ by winch operation; specify in the additional information field)',
  'Interrupted according to sensor data (e.g. video recording is triggeredÂ by winch operation; specify in the additional information field)',
  'Interrupted according to instructions provided to vessel operators',
])

// ── Process each programme ────────────────────────────────────────────────────

const result = programs.map(p => {
  const n = { ...p }
  const name = p.programme_name

  // ── CRITICAL 1: data_transmission_primary ──────────────────────────────────
  if (p.data_transmission_primary) {
    const tokens = splitSemi(p.data_transmission_primary)
      .map(t => DATA_TX_MAP[t] ?? t)
    const sorted = [...new Set(tokens)].sort(
      (a, b) => DATA_TX_ORDER.indexOf(a) - DATA_TX_ORDER.indexOf(b)
    )
    const fixed = sorted.join(';')
    if (fixed !== p.data_transmission_primary) {
      changed(p.id, name, 'data_transmission_primary', p.data_transmission_primary, fixed)
      n.data_transmission_primary = fixed
    }
  }

  // ── CRITICAL 2: catch_observation_stage ────────────────────────────────────
  if (p.catch_observation_stage) {
    const fixed = normaliseSemiField(p.catch_observation_stage, CATCH_STAGE_ORDER)
    if (fixed !== p.catch_observation_stage) {
      changed(p.id, name, 'catch_observation_stage', p.catch_observation_stage, fixed)
      n.catch_observation_stage = fixed
    }
  }

  // ── CRITICAL 3: data_storage_location ──────────────────────────────────────
  if (p.data_storage_location) {
    const tokens = splitSemi(p.data_storage_location)
      .map(t => DATA_STORAGE_MAP[t.trim()] ?? t.trim())
    const sorted = [...new Set(tokens)].sort(
      (a, b) => {
        const ai = DATA_STORAGE_ORDER.indexOf(a)
        const bi = DATA_STORAGE_ORDER.indexOf(b)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      }
    )
    const fixed = sorted.join(';')
    if (fixed !== p.data_storage_location) {
      changed(p.id, name, 'data_storage_location', p.data_storage_location, fixed)
      n.data_storage_location = fixed
    }
  }

  // ── CRITICAL 4: ai_review_stage ────────────────────────────────────────────
  if (p.ai_review_stage) {
    const tokens = splitSemi(p.ai_review_stage)
    if (tokens.length === 1 && AI_NULL_TOKENS.has(tokens[0])) {
      // whole value is a null-equivalent
      changed(p.id, name, 'ai_review_stage', p.ai_review_stage, null)
      n.ai_review_stage = null
    } else {
      const narrative = []
      const controlled = []
      for (const t of tokens) {
        if (AI_NULL_TOKENS.has(t)) continue // drop
        if (AI_REVIEW_CONTROLLED.has(t)) {
          controlled.push(t)
        } else {
          narrative.push(t)
        }
      }
      // move narrative tokens to additional_notes
      if (narrative.length) {
        const existing = n.additional_notes ? n.additional_notes + '\n\n' : ''
        n.additional_notes = existing + 'AI review stage notes: ' + narrative.join('; ')
        changed(p.id, name, 'additional_notes', p.additional_notes, n.additional_notes)
      }
      const sorted = controlled.sort(
        (a, b) => AI_REVIEW_ORDER.indexOf(a) - AI_REVIEW_ORDER.indexOf(b)
      )
      const fixed = sorted.length ? sorted.join(';') : null
      if (fixed !== p.ai_review_stage) {
        changed(p.id, name, 'ai_review_stage', p.ai_review_stage, fixed)
        n.ai_review_stage = fixed
      }
    }
  }

  // ── HIGH 1: gear_types ─────────────────────────────────────────────────────
  if (Array.isArray(p.gear_types)) {
    const fixed = p.gear_types
      .filter(g => !GEAR_REMOVE.has(g))
      .map(g => GEAR_MAP[g] ?? g)
    const deduped = [...new Set(fixed)]
    const result = deduped.length ? deduped : null
    if (JSON.stringify(result) !== JSON.stringify(p.gear_types)) {
      changed(p.id, name, 'gear_types', p.gear_types, result)
      n.gear_types = result
    }
  }

  // ── HIGH 2: supplier_model ─────────────────────────────────────────────────
  if (p.supplier_model && SUPPLIER_MAP[p.supplier_model]) {
    const fixed = SUPPLIER_MAP[p.supplier_model]
    changed(p.id, name, 'supplier_model', p.supplier_model, fixed)
    n.supplier_model = fixed
  }

  // ── HIGH 3: recording_config / video_recording_type swap ──────────────────
  if (p.recording_config && RECORDING_TYPE_VALUES.has(p.recording_config)) {
    const misplacedType = p.recording_config.startsWith('Continuous')
      ? 'Continuous'
      : 'Interrupted according to sensor data (e.g. video recording is triggered by winch operation; specify in the additional information field)'

    // move to video_recording_type if not already set
    if (!p.video_recording_type) {
      changed(p.id, name, 'video_recording_type', p.video_recording_type, misplacedType)
      n.video_recording_type = misplacedType
    }
    // set recording_config to the medium — default to Video if we can't determine
    const medium = p.collects_images ? 'Both video and still images' : 'Video'
    changed(p.id, name, 'recording_config', p.recording_config, medium)
    n.recording_config = medium
  }

  // ── HIGH 4: video_selection_method ────────────────────────────────────────
  if (p.video_selection_method === 'Statified sampling') {
    changed(p.id, name, 'video_selection_method', p.video_selection_method, 'Stratified sampling')
    n.video_selection_method = 'Stratified sampling'
  }
  if (p.video_selection_method?.startsWith('Census eventually')) {
    changed(p.id, name, 'video_selection_method', p.video_selection_method, 'Census (all reviewed)')
    n.video_selection_method = 'Census (all reviewed)'
  }

  // ── HIGH 5: bycatch_species ────────────────────────────────────────────────
  if (p.bycatch_species === 'N/A') {
    changed(p.id, name, 'bycatch_species', p.bycatch_species, null)
    n.bycatch_species = null
  }
  if (p.bycatch_species?.includes('pinnipeds (Steller sea lion)')) {
    // strip non-standard parenthetical; move to additional_notes
    const fixed = p.bycatch_species.replace(/;?pinnipeds \(Steller sea lion\)/g, '').replace(/^;|;$/g, '').trim()
    const note = 'Bycatch note: includes pinnipeds (Steller sea lion)'
    const existing = n.additional_notes ? n.additional_notes + '\n\n' : ''
    n.additional_notes = existing + note
    changed(p.id, name, 'bycatch_species', p.bycatch_species, fixed)
    changed(p.id, name, 'additional_notes', p.additional_notes, n.additional_notes)
    n.bycatch_species = fixed || null
  }

  return n
})

// ── Write output ──────────────────────────────────────────────────────────────
writeFileSync(OUT, JSON.stringify(result, null, 2))

// ── Report ────────────────────────────────────────────────────────────────────
console.log(`\nFixed ${log.length} values across ${new Set(log.map(l => l.programme)).size} programmes\n`)
const byField = {}
for (const entry of log) {
  byField[entry.field] = (byField[entry.field] || 0) + 1
}
console.log('Changes by field:')
for (const [field, count] of Object.entries(byField).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${field.padEnd(35)} ${count}`)
}
console.log('\nFull change log:')
for (const entry of log) {
  console.log(`  [${entry.field}] ${entry.programme}`)
  console.log(`    from: ${entry.from}`)
  console.log(`    to:   ${entry.to}`)
}
console.log(`\nWritten to ${OUT}`)
