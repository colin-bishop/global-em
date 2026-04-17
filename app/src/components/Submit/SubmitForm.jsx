import React, { useState, useMemo, useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { supabase } from '../../lib/supabase'
import DuplicateCheck from './DuplicateCheck'

// ── Option lists (matching WGTIFD survey exactly) ──────────────────────────────

const GEAR_OPTIONS = [
  'Dredges [DRB]',
  'Bottom trawls [OTB, OTT, PTB, TBB]',
  'Pelagic trawls [OTM, PTM]',
  'Rods and lines [LHP, LHM, LTL]',
  'Longlines [LLD, LLS]',
  'Traps [FPO, FYK, FPN]',
  'Nets [GTR, GNS, GND]',
  'Surrounding nets [PS, LA]',
  'Seines [SSC, SDN, SPR, SB, SV]',
  'Other',
]

const PROGRAMME_TYPE_OPTIONS = [
  'Onshore commercial',
  'Offshore commercial',
  'Research surveys at sea',
]

const EM_REGULATION_OPTIONS = [
  'Under Regulation - Mandatory',
  'Under Regulation - Optional',
  'Non-Regulation - Voluntary',
  'Other please specify in additional information',
]

const SUPPLIER_MODEL_OPTIONS = [
  'Agency selected/Approved - Multiple suppliers',
  'Agency selected/Approved - Single supplier',
  'Industry selected - Multiple suppliers',
  'Industry selected - Single supplier',
]

const PROCUREMENT_OPTIONS = [
  'Regulator/Agency',
  'Industry',
  'Other third party',
]

const REVIEW_MODEL_OPTIONS = [
  'Agency only',
  '3rd party only',
  '3rd party & Agency',
]

const DATA_TRANSMISSION_OPTIONS = [
  'Physical receipt (hard drives)',
  'Remote upload - automatic',
  'Remote upload - on-demand',
]

const SECONDARY_TRANSMISSION_OPTIONS = [
  'Physical receipt',
  'FTP/Web server upload',
]

const PROCESSED_SUBMISSION_OPTIONS = [
  'Physical receipt',
  'API',
]

const VIDEO_IMAGERY_OPTIONS = [
  { value: 'no',     label: 'No' },
  { value: 'video',  label: 'Video' },
  { value: 'images', label: 'Still images' },
  { value: 'both',   label: 'Video and images' },
]

const VIDEO_RECORDING_OPTIONS = [
  'Continuous',
  'Continuous when there is sufficient light for video recording',
  'Interrupted according to sensor data (e.g. triggered by winch operation)',
  'Interrupted according to instructions provided to vessel operators',
]

const RECORDING_CONFIG_OPTIONS = [
  { value: 'video',  label: 'Video' },
  { value: 'images', label: 'Still images' },
  { value: 'both',   label: 'Both video and still images' },
]

const VIDEO_SELECTION_OPTIONS = [
  'Census (all reviewed)',
  'Random sampling',
  'Stratified sampling',
  'Other',
]

const SAMPLING_UNIT_OPTIONS = [
  'Time period(s)',
  'Vessel(s)',
  'Vessel trip(s)',
  'Haul(s)',
  'Other',
]

const SAMPLING_COVERAGE_OPTIONS = [
  '<10%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%', 'Other',
]

const CATCH_STAGE_OPTIONS = [
  'Hauling',
  'Pre-sorting',
  'Sorting',
  'Sorted',
]

const SPECIES_SAMPLED_OPTIONS = [
  'All taxa',
  'One/some group(s) of taxa',
  'Specific taxa only',
]
// Options that require species detail entry
const SPECIES_SAMPLED_NEEDS_DETAIL = new Set(['One/some group(s) of taxa', 'Specific taxa only'])

const SPECIES_ID_OPTIONS = [
  'Same level for all taxa and groups of taxa',
  'Different levels for different taxa/groups of taxa',
]

const LENGTH_OPTIONS = [
  'Yes, for all taxa/groups of taxa, with no limit',
  'Yes, for all taxa/groups of taxa, with a maximum limit',
  'Yes, only for some taxa/groups of taxa, with no limit',
  'Yes, only for some taxa/groups of taxa, with a maximum limit',
  'No',
]

const SEX_OPTIONS = [
  'Yes, for all taxa/groups of taxa where externally possible',
  'Yes, for some taxa/groups of taxa where externally possible',
  'No',
]

const PRIMARY_REVIEWER_OPTIONS = [
  'Science agency',
  'Compliance agency',
  'Both Science and compliance agencies',
  'Third party - compliance',
  'Third party - science',
  'Third party - both',
]

const DATA_OWNER_OPTIONS = ['Agency', 'Industry', '3rd party', 'Other']

const DATA_STORAGE_OPTIONS = [
  'Project/programme specific',
  'EM specific',
  'National integrated',
  'Regional integrated',
  'Other',
]

const AI_STATUS_OPTIONS = [
  { value: 'development', label: 'In development' },
  { value: 'operational', label: 'Operational (give details in Additional information)' },
  { value: 'no',          label: 'No' },
]

const AI_ASSETS_OPTIONS = [
  'Yes - upon request',
  'Yes - publicly available',
  'No',
]

const AI_STAGE_OPTIONS = [
  'Processing of sensor data',
  'Processing of video data - catch review',
  'Processing of video data - quality assurance',
  'Other',
]

const AI_TRAINING_SIZE_OPTIONS = [
  '<500', '500–1,000', '1,000–5,000', '5,000–10,000', '>10,000',
]

// ── Vessel count ranges ───────────────────────────────────────────────────────

const VESSEL_RANGES = [
  { label: '<5',         min: 0,    max: 4    },
  { label: '5–10',       min: 5,    max: 10   },
  { label: '10–20',      min: 10,   max: 20   },
  { label: '20–50',      min: 20,   max: 50   },
  { label: '50–100',     min: 50,   max: 100  },
  { label: '100–200',    min: 100,  max: 200  },
  { label: '200–500',    min: 200,  max: 500  },
  { label: '500–1,000',  min: 500,  max: 1000 },
  { label: '1,000–2,000',min: 1000, max: 2000 },
  { label: '2,000+',     min: 2000, max: null },
]

const VESSEL_SIZE_RANGES = [
  '<7m', '7–10m', '10–15m', '15–20m', '20–30m',
  '30–40m', '40–50m', '50–75m', '75–100m', '100m+',
]

const TRIP_DURATIONS = [
  '1 day', '2–3 days', '4–6 days', '7–10 days', '11–15 days',
  '16–20 days', '21–30 days', '31–60 days', '61–90 days',
  '91–120 days', '121–180 days', '180+ days',
]

// midpoint for map colouring — 2000+ uses 3000 as representative value
function rangeMidpoint(label) {
  const r = VESSEL_RANGES.find(v => v.label === label)
  if (!r) return 0
  return r.max == null ? 3000 : Math.round((r.min + r.max) / 2)
}

// ── Country lookup (ISO-3 alpha codes) ───────────────────────────────────────
// Full UN member list — name displayed to user, iso3 stored in DB
const COUNTRIES = [
  { name: 'Afghanistan', iso3: 'AFG' }, { name: 'Albania', iso3: 'ALB' },
  { name: 'Algeria', iso3: 'DZA' }, { name: 'Andorra', iso3: 'AND' },
  { name: 'Angola', iso3: 'AGO' }, { name: 'Antigua and Barbuda', iso3: 'ATG' },
  { name: 'Argentina', iso3: 'ARG' }, { name: 'Armenia', iso3: 'ARM' },
  { name: 'Australia', iso3: 'AUS' }, { name: 'Austria', iso3: 'AUT' },
  { name: 'Azerbaijan', iso3: 'AZE' }, { name: 'Bahamas', iso3: 'BHS' },
  { name: 'Bahrain', iso3: 'BHR' }, { name: 'Bangladesh', iso3: 'BGD' },
  { name: 'Barbados', iso3: 'BRB' }, { name: 'Belarus', iso3: 'BLR' },
  { name: 'Belgium', iso3: 'BEL' }, { name: 'Belize', iso3: 'BLZ' },
  { name: 'Benin', iso3: 'BEN' }, { name: 'Bhutan', iso3: 'BTN' },
  { name: 'Bolivia', iso3: 'BOL' }, { name: 'Bosnia and Herzegovina', iso3: 'BIH' },
  { name: 'Botswana', iso3: 'BWA' }, { name: 'Brazil', iso3: 'BRA' },
  { name: 'Brunei', iso3: 'BRN' }, { name: 'Bulgaria', iso3: 'BGR' },
  { name: 'Burkina Faso', iso3: 'BFA' }, { name: 'Burundi', iso3: 'BDI' },
  { name: 'Cabo Verde', iso3: 'CPV' }, { name: 'Cambodia', iso3: 'KHM' },
  { name: 'Cameroon', iso3: 'CMR' }, { name: 'Canada', iso3: 'CAN' },
  { name: 'Central African Republic', iso3: 'CAF' }, { name: 'Chad', iso3: 'TCD' },
  { name: 'Chile', iso3: 'CHL' }, { name: 'China', iso3: 'CHN' },
  { name: 'Colombia', iso3: 'COL' }, { name: 'Comoros', iso3: 'COM' },
  { name: 'Congo', iso3: 'COG' }, { name: 'Costa Rica', iso3: 'CRI' },
  { name: 'Côte d\'Ivoire', iso3: 'CIV' }, { name: 'Croatia', iso3: 'HRV' },
  { name: 'Cuba', iso3: 'CUB' }, { name: 'Cyprus', iso3: 'CYP' },
  { name: 'Czechia', iso3: 'CZE' }, { name: 'DR Congo', iso3: 'COD' },
  { name: 'Denmark', iso3: 'DNK' }, { name: 'Djibouti', iso3: 'DJI' },
  { name: 'Dominica', iso3: 'DMA' }, { name: 'Dominican Republic', iso3: 'DOM' },
  { name: 'Ecuador', iso3: 'ECU' }, { name: 'Egypt', iso3: 'EGY' },
  { name: 'El Salvador', iso3: 'SLV' }, { name: 'Equatorial Guinea', iso3: 'GNQ' },
  { name: 'Eritrea', iso3: 'ERI' }, { name: 'Estonia', iso3: 'EST' },
  { name: 'Eswatini', iso3: 'SWZ' }, { name: 'Ethiopia', iso3: 'ETH' },
  { name: 'Faroe Islands', iso3: 'FRO' }, { name: 'Fiji', iso3: 'FJI' },
  { name: 'Finland', iso3: 'FIN' }, { name: 'France', iso3: 'FRA' },
  { name: 'Gabon', iso3: 'GAB' }, { name: 'Gambia', iso3: 'GMB' },
  { name: 'Georgia', iso3: 'GEO' }, { name: 'Germany', iso3: 'DEU' },
  { name: 'Ghana', iso3: 'GHA' }, { name: 'Greece', iso3: 'GRC' },
  { name: 'Grenada', iso3: 'GRD' }, { name: 'Guatemala', iso3: 'GTM' },
  { name: 'Guinea', iso3: 'GIN' }, { name: 'Guinea-Bissau', iso3: 'GNB' },
  { name: 'Guyana', iso3: 'GUY' }, { name: 'Haiti', iso3: 'HTI' },
  { name: 'Honduras', iso3: 'HND' }, { name: 'Hungary', iso3: 'HUN' },
  { name: 'Iceland', iso3: 'ISL' }, { name: 'India', iso3: 'IND' },
  { name: 'Indonesia', iso3: 'IDN' }, { name: 'Iran', iso3: 'IRN' },
  { name: 'Iraq', iso3: 'IRQ' }, { name: 'Ireland', iso3: 'IRL' },
  { name: 'Israel', iso3: 'ISR' }, { name: 'Italy', iso3: 'ITA' },
  { name: 'Jamaica', iso3: 'JAM' }, { name: 'Japan', iso3: 'JPN' },
  { name: 'Jordan', iso3: 'JOR' }, { name: 'Kazakhstan', iso3: 'KAZ' },
  { name: 'Kenya', iso3: 'KEN' }, { name: 'Kiribati', iso3: 'KIR' },
  { name: 'Kuwait', iso3: 'KWT' }, { name: 'Kyrgyzstan', iso3: 'KGZ' },
  { name: 'Laos', iso3: 'LAO' }, { name: 'Latvia', iso3: 'LVA' },
  { name: 'Lebanon', iso3: 'LBN' }, { name: 'Lesotho', iso3: 'LSO' },
  { name: 'Liberia', iso3: 'LBR' }, { name: 'Libya', iso3: 'LBY' },
  { name: 'Liechtenstein', iso3: 'LIE' }, { name: 'Lithuania', iso3: 'LTU' },
  { name: 'Luxembourg', iso3: 'LUX' }, { name: 'Madagascar', iso3: 'MDG' },
  { name: 'Malawi', iso3: 'MWI' }, { name: 'Malaysia', iso3: 'MYS' },
  { name: 'Maldives', iso3: 'MDV' }, { name: 'Mali', iso3: 'MLI' },
  { name: 'Malta', iso3: 'MLT' }, { name: 'Marshall Islands', iso3: 'MHL' },
  { name: 'Mauritania', iso3: 'MRT' }, { name: 'Mauritius', iso3: 'MUS' },
  { name: 'Mexico', iso3: 'MEX' }, { name: 'Micronesia', iso3: 'FSM' },
  { name: 'Moldova', iso3: 'MDA' }, { name: 'Monaco', iso3: 'MCO' },
  { name: 'Mongolia', iso3: 'MNG' }, { name: 'Montenegro', iso3: 'MNE' },
  { name: 'Morocco', iso3: 'MAR' }, { name: 'Mozambique', iso3: 'MOZ' },
  { name: 'Myanmar', iso3: 'MMR' }, { name: 'Namibia', iso3: 'NAM' },
  { name: 'Nauru', iso3: 'NRU' }, { name: 'Nepal', iso3: 'NPL' },
  { name: 'Netherlands', iso3: 'NLD' }, { name: 'New Zealand', iso3: 'NZL' },
  { name: 'Nicaragua', iso3: 'NIC' }, { name: 'Niger', iso3: 'NER' },
  { name: 'Nigeria', iso3: 'NGA' }, { name: 'North Korea', iso3: 'PRK' },
  { name: 'North Macedonia', iso3: 'MKD' }, { name: 'Norway', iso3: 'NOR' },
  { name: 'Oman', iso3: 'OMN' }, { name: 'Pakistan', iso3: 'PAK' },
  { name: 'Palau', iso3: 'PLW' }, { name: 'Panama', iso3: 'PAN' },
  { name: 'Papua New Guinea', iso3: 'PNG' }, { name: 'Paraguay', iso3: 'PRY' },
  { name: 'Peru', iso3: 'PER' }, { name: 'Philippines', iso3: 'PHL' },
  { name: 'Poland', iso3: 'POL' }, { name: 'Portugal', iso3: 'PRT' },
  { name: 'Qatar', iso3: 'QAT' }, { name: 'Romania', iso3: 'ROU' },
  { name: 'Russia', iso3: 'RUS' }, { name: 'Rwanda', iso3: 'RWA' },
  { name: 'Saint Kitts and Nevis', iso3: 'KNA' }, { name: 'Saint Lucia', iso3: 'LCA' },
  { name: 'Saint Vincent and the Grenadines', iso3: 'VCT' }, { name: 'Samoa', iso3: 'WSM' },
  { name: 'San Marino', iso3: 'SMR' }, { name: 'São Tomé and Príncipe', iso3: 'STP' },
  { name: 'Saudi Arabia', iso3: 'SAU' }, { name: 'Senegal', iso3: 'SEN' },
  { name: 'Serbia', iso3: 'SRB' }, { name: 'Seychelles', iso3: 'SYC' },
  { name: 'Sierra Leone', iso3: 'SLE' }, { name: 'Singapore', iso3: 'SGP' },
  { name: 'Slovakia', iso3: 'SVK' }, { name: 'Slovenia', iso3: 'SVN' },
  { name: 'Solomon Islands', iso3: 'SLB' }, { name: 'Somalia', iso3: 'SOM' },
  { name: 'South Africa', iso3: 'ZAF' }, { name: 'South Korea', iso3: 'KOR' },
  { name: 'South Sudan', iso3: 'SSD' }, { name: 'Spain', iso3: 'ESP' },
  { name: 'Sri Lanka', iso3: 'LKA' }, { name: 'Sudan', iso3: 'SDN' },
  { name: 'Suriname', iso3: 'SUR' }, { name: 'Sweden', iso3: 'SWE' },
  { name: 'Switzerland', iso3: 'CHE' }, { name: 'Syria', iso3: 'SYR' },
  { name: 'Taiwan', iso3: 'TWN' }, { name: 'Tajikistan', iso3: 'TJK' },
  { name: 'Tanzania', iso3: 'TZA' }, { name: 'Thailand', iso3: 'THA' },
  { name: 'Timor-Leste', iso3: 'TLS' }, { name: 'Togo', iso3: 'TGO' },
  { name: 'Tonga', iso3: 'TON' }, { name: 'Trinidad and Tobago', iso3: 'TTO' },
  { name: 'Tunisia', iso3: 'TUN' }, { name: 'Turkey', iso3: 'TUR' },
  { name: 'Turkmenistan', iso3: 'TKM' }, { name: 'Tuvalu', iso3: 'TUV' },
  { name: 'Uganda', iso3: 'UGA' }, { name: 'Ukraine', iso3: 'UKR' },
  { name: 'United Arab Emirates', iso3: 'ARE' }, { name: 'United Kingdom', iso3: 'GBR' },
  { name: 'United States', iso3: 'USA' }, { name: 'Uruguay', iso3: 'URY' },
  { name: 'Uzbekistan', iso3: 'UZB' }, { name: 'Vanuatu', iso3: 'VUT' },
  { name: 'Venezuela', iso3: 'VEN' }, { name: 'Vietnam', iso3: 'VNM' },
  { name: 'Yemen', iso3: 'YEM' }, { name: 'Zambia', iso3: 'ZMB' },
  { name: 'Zimbabwe', iso3: 'ZWE' },
]

// ── Form helper components ────────────────────────────────────────────────────

function Label({ children, required }) {
  return (
    <label className="block text-xs text-slate-400 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function Input({ label, required, value, onChange, type = 'text', placeholder, hint, className = '' }) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {hint && <p className="text-xs text-slate-500 mb-1">{hint}</p>}
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600 transition-colors"
      />
    </div>
  )
}

function Textarea({ label, value, onChange, rows = 3, placeholder, hint, required }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {hint && <p className="text-xs text-slate-500 mb-1">{hint}</p>}
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600 transition-colors resize-y"
      />
    </div>
  )
}

function Radio({ label, options, value, onChange, required, hint }) {
  // options: string[] or {value, label}[]
  const normalised = options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
  return (
    <div>
      <Label required={required}>{label}</Label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      <div className="space-y-1.5">
        {normalised.map(({ value: v, label: l }) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex items-start gap-2.5 w-full text-left px-3 py-1.5 rounded border text-sm transition-colors ${
              value === v
                ? 'border-cyan-500 bg-cyan-900/30 text-cyan-200'
                : 'border-[#1e3a5f] text-slate-400 hover:border-slate-500 hover:text-white'
            }`}
          >
            <div className={`mt-0.5 w-3.5 h-3.5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
              value === v ? 'border-cyan-400' : 'border-slate-600'
            }`}>
              {value === v && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
            </div>
            <span>{l}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MultiCheckbox({ label, options, value = [], onChange, required, hint }) {
  const toggle = opt => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  return (
    <div>
      <Label required={required}>{label}</Label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      <div className="space-y-1.5">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`flex items-start gap-2.5 w-full text-left px-3 py-1.5 rounded border text-sm transition-colors ${
              value.includes(opt)
                ? 'border-cyan-500 bg-cyan-900/30 text-cyan-200'
                : 'border-[#1e3a5f] text-slate-400 hover:border-slate-500 hover:text-white'
            }`}
          >
            <div className={`mt-0.5 w-3.5 h-3.5 flex-shrink-0 rounded border-2 flex items-center justify-center ${
              value.includes(opt) ? 'border-cyan-400 bg-cyan-900' : 'border-slate-600'
            }`}>
              {value.includes(opt) && (
                <svg viewBox="0 0 10 8" className="w-2 h-2 text-cyan-400 fill-current">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <span>{opt}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TriToggle({ label, value, onChange, hint }) {
  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="text-xs text-slate-500 mb-1">{hint}</p>}
      <div className="flex rounded overflow-hidden border border-[#1e3a5f] w-fit">
        {[
          { v: true,  l: 'Yes' },
          { v: false, l: 'No' },
          { v: null,  l: 'Unknown' },
        ].map(({ v, l }) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`text-xs px-4 py-1.5 transition-colors border-r border-[#1e3a5f] last:border-r-0 ${
              value === v ? 'bg-cyan-700 text-white' : 'bg-[#0a1628] text-slate-400 hover:text-white'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function SectionHeader({ step, title, subtitle }) {
  return (
    <div className="mb-5">
      <div className="text-xs text-cyan-500 font-semibold uppercase tracking-wider mb-0.5">
        Step {step}
      </div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-[#1e3a5f]" />
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-[#1e3a5f]" />
    </div>
  )
}

// ── CountrySelect ─────────────────────────────────────────────────────────────
function CountrySelect({ value, onChange }) {
  // value = { name: '', iso3: '' }
  const [query, setQuery] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Sync display text if parent resets form
  useEffect(() => { if (!value?.name) setQuery('') }, [value?.name])

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q)
    ).slice(0, 12)
  }, [query])

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = c => {
    setQuery(c.name)
    setOpen(false)
    onChange({ name: c.name, iso3: c.iso3 })
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs text-slate-400 mb-1">Country</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            placeholder="Type country name…"
            onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange({ name: '', iso3: '' }) }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
            className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600 transition-colors"
          />
          {open && matches.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0d1f3c] border border-[#1e3a5f] rounded shadow-xl max-h-52 overflow-y-auto">
              {matches.map(c => (
                <button key={c.iso3} type="button" onMouseDown={() => select(c)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-300 hover:bg-[#1e3a5f] hover:text-white text-left">
                  <span>{c.name}</span>
                  <span className="text-xs text-slate-500 font-mono ml-2">{c.iso3}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {value?.iso3 && (
          <div className="flex items-center px-3 py-1.5 bg-cyan-900/30 border border-cyan-700 rounded text-xs font-mono text-cyan-300 flex-shrink-0">
            {value.iso3}
          </div>
        )}
      </div>
    </div>
  )
}

// ── FlagStateSelect — multi-select ISO-3 country codes ───────────────────────
function FlagStateSelect({ label, value = [], onChange, required, hint }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return COUNTRIES.filter(c =>
      (c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q)) &&
      !value.includes(c.iso3)
    ).slice(0, 12)
  }, [query, value])

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const add = c => { onChange([...value, c.iso3]); setQuery(''); setOpen(false) }
  const remove = iso => onChange(value.filter(v => v !== iso))

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs text-slate-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder="Type country name or ISO-3 code…"
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
          className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600 transition-colors"
        />
        {open && matches.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0d1f3c] border border-[#1e3a5f] rounded shadow-xl max-h-52 overflow-y-auto">
            {matches.map(c => (
              <button key={c.iso3} type="button" onMouseDown={() => add(c)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-300 hover:bg-[#1e3a5f] hover:text-white text-left">
                <span>{c.name}</span>
                <span className="text-xs text-slate-500 font-mono ml-2">{c.iso3}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map(iso => {
            const country = COUNTRIES.find(c => c.iso3 === iso)
            return (
              <span key={iso} className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-900/40 border border-cyan-700 text-xs text-cyan-200">
                <span className="font-mono font-medium">{iso}</span>
                {country && <><span className="text-slate-500">—</span><span>{country.name}</span></>}
                <button type="button" onClick={() => remove(iso)}
                  className="ml-0.5 text-slate-400 hover:text-red-400 leading-none">×</button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ChipPicker — single-select chip row from a string array ──────────────────
function ChipPicker({ label, value, onChange, required, hint, options }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(value === opt ? '' : opt)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              value === opt
                ? 'bg-cyan-800 border-cyan-500 text-cyan-100'
                : 'bg-[#0a1628] border-[#1e3a5f] text-slate-400 hover:border-slate-500 hover:text-white'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── RangePicker ───────────────────────────────────────────────────────────────
function RangePicker({ label, value, onChange, required, hint }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {VESSEL_RANGES.map(r => (
          <button key={r.label} type="button" onClick={() => onChange(value === r.label ? '' : r.label)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              value === r.label
                ? 'bg-cyan-800 border-cyan-500 text-cyan-100'
                : 'bg-[#0a1628] border-[#1e3a5f] text-slate-400 hover:border-slate-500 hover:text-white'
            }`}>
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// FAO Major Fishing Areas — codes match fao_areas.geojson
// Official FAO names from WFS (FAO_AREAS_ERASE, F_LEVEL=MAJOR)
const FAO_AREAS = {
  18: 'Arctic Sea',
  21: 'Atlantic, Northwest',
  27: 'Atlantic, Northeast',
  31: 'Atlantic, Western Central',
  34: 'Atlantic, Eastern Central',
  37: 'Mediterranean and Black Sea',
  41: 'Atlantic, Southwest',
  47: 'Atlantic, Southeast',
  48: 'Atlantic, Antarctic',
  51: 'Indian Ocean, Western',
  57: 'Indian Ocean, Eastern',
  58: 'Indian Ocean, Antarctic',
  61: 'Pacific, Northwest',
  67: 'Pacific, Northeast',
  71: 'Pacific, Western Central',
  77: 'Pacific, Eastern Central',
  81: 'Pacific, Southwest',
  87: 'Pacific, Southeast',
  88: 'Pacific, Antarctic',
}

const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/positron'

// Human-readable names for ICES statistical divisions (all within FAO Area 27)
const ICES_NAMES = {
  '27.1.a':     'Norwegian Sea, E',
  '27.1.b':     'Barents Sea',
  '27.2.a.1':   'Norwegian Sea, NW (N of 72°N)',
  '27.2.a.2':   'Norwegian Sea, NW (S of 72°N)',
  '27.2.b.1':   'Greenland Sea, E',
  '27.2.b.2':   'Svalbard, W',
  '27.3.a.20':  'Skagerrak',
  '27.3.a.21':  'Kattegat',
  '27.3.b.23':  'Belt Sea',
  '27.3.c.22':  'Little Belt & Sound',
  '27.3.d.24':  'Baltic — Arkona Basin',
  '27.3.d.25':  'Baltic — Bornholm Basin',
  '27.3.d.26':  'Baltic — West Gotland',
  '27.3.d.27':  'Baltic — East Gotland',
  '27.3.d.28.1':'Gulf of Riga',
  '27.3.d.28.2':'Baltic — West Gotland, E',
  '27.3.d.29':  'Baltic — N Gotland',
  '27.3.d.30':  'Bothnian Sea',
  '27.3.d.31':  'Bothnian Bay',
  '27.3.d.32':  'Finnish Coastal Waters',
  '27.4.a':     'North Sea, Northern',
  '27.4.b':     'North Sea, Central',
  '27.4.c':     'North Sea, Southern',
  '27.5.a.1':   'Iceland, SE',
  '27.5.a.2':   'Iceland, SW',
  '27.5.b.1.a': 'Faroes, N',
  '27.5.b.1.b': 'Faroes, S',
  '27.5.b.2':   'Rockall Trough, N',
  '27.6.a':     'W Scotland & Rockall',
  '27.6.b.1':   'Rockall Bank',
  '27.6.b.2':   'Hatton Bank',
  '27.7.a':     'Irish Sea',
  '27.7.b':     'Porcupine Bank',
  '27.7.c.1':   'S Porcupine Bank',
  '27.7.c.2':   'Porcupine Sea Bight',
  '27.7.d':     'Eastern English Channel',
  '27.7.e':     'Western English Channel',
  '27.7.f':     'Bristol Channel',
  '27.7.g':     'Celtic Sea, E',
  '27.7.h':     'Celtic Sea, SW',
  '27.7.j.1':   'Celtic Sea, NW',
  '27.7.j.2':   'Celtic Sea, W',
  '27.7.k.1':   'Celtic Sea, N Biscay Shelf',
  '27.7.k.2':   'Celtic Sea, S Biscay Shelf',
  '27.8.a':     'Bay of Biscay, N',
  '27.8.b':     'Bay of Biscay, Central',
  '27.8.c':     'Bay of Biscay, SE',
  '27.8.d.1':   'Bay of Biscay, E (N 44°N)',
  '27.8.d.2':   'Bay of Biscay, E (S 44°N)',
  '27.8.e.1':   'Bay of Biscay, W (N 45°N)',
  '27.8.e.2':   'Bay of Biscay, W (S 45°N)',
  '27.9.a':     'Iberian Peninsula, W',
  '27.9.b.1':   'Azores Approach, N',
  '27.9.b.2':   'Azores Approach, S',
  '27.10.a.1':  'Azores, N',
  '27.10.a.2':  'Azores, S',
  '27.10.b':    'Azores, W',
  '27.12.a.1':  'N Mid-Atlantic Ridge, N',
  '27.12.a.2':  'N Mid-Atlantic Ridge, NW',
  '27.12.a.3':  'N Mid-Atlantic Ridge, SW',
  '27.12.a.4':  'N Mid-Atlantic Ridge, SE',
  '27.12.b':    'Flemish Cap Area',
  '27.12.c':    'Charlie-Gibbs Fracture Zone',
  '27.14.a':    'Denmark Strait, E',
  '27.14.b.1':  'Iceland Sea, N',
  '27.14.b.2':  'E Greenland, SE',
}

function AreaPicker({ label, value = [], onChange, hint, country = null }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const mapLoadedRef = useRef(false)
  const valueRef = useRef(value)
  const countryRef = useRef(country)
  const eezNameRef = useRef({})  // iso_ter1 → territory name
  const icesNameRef = useRef({}) // code → human label

  useEffect(() => { valueRef.current = value }, [value])

  // Reactively update the country EEZ highlight
  useEffect(() => {
    countryRef.current = country
    if (!mapLoadedRef.current || !mapRef.current?.getLayer('eez-country')) return
    mapRef.current.setFilter('eez-country', country
      ? ['any', ['==', ['get', 'iso_ter1'], country], ['==', ['get', 'iso_sov1'], country]]
      : ['==', ['get', 'mrgid'], -1])
  }, [country])

  useEffect(() => {
    if (mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_URL,
      center: [15, 15],
      zoom: 0.4,
      minZoom: 0,
      maxZoom: 5,
      attributionControl: false,
    })
    mapRef.current = map

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 6,
      maxWidth: '260px',
    })

    map.on('load', () => {
      mapLoadedRef.current = true

      // ── FAO area layers ───────────────────────────────────────────────────
      const faoUrl = `${import.meta.env.BASE_URL}fao_areas.geojson`
      map.addSource('fao', { type: 'geojson', data: faoUrl })
      map.addLayer({ id: 'fao-fill', type: 'fill', source: 'fao',
        paint: { 'fill-color': '#000000', 'fill-opacity': 0 } })
      map.addLayer({ id: 'fao-selected', type: 'fill', source: 'fao',
        paint: { 'fill-color': '#0891b2', 'fill-opacity': 0.45 },
        filter: ['==', ['get', 'code'], -1] })
      map.addLayer({ id: 'fao-hover', type: 'fill', source: 'fao',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.10 },
        filter: ['==', ['get', 'code'], -1] })
      map.addLayer({ id: 'fao-line', type: 'line', source: 'fao',
        paint: { 'line-color': '#3b82f6', 'line-width': 0.8, 'line-opacity': 0.5 } })

      const faoCodes = valueRef.current.filter(c => typeof c === 'number')
      if (faoCodes.length) map.setFilter('fao-selected', ['in', ['get', 'code'], ['literal', faoCodes]])

      // ── EEZ layer (optional, async) ───────────────────────────────────────
      const eezUrl = `${import.meta.env.BASE_URL}eez_simplified.geojson`
      fetch(eezUrl)
        .then(r => { if (!r.ok) throw new Error('missing'); return r.json() })
        .then(data => {
          // Build name lookup
          const nameMap = {}
          data.features.forEach(f => {
            const iso = f.properties.iso_ter1
            if (iso) nameMap[iso] = f.properties.territory1 || f.properties.sovereign1 || iso
          })
          eezNameRef.current = nameMap

          map.addSource('eez', { type: 'geojson', data })

          // Reference lines (all EEZs)
          map.addLayer({ id: 'eez-line', type: 'line', source: 'eez',
            paint: { 'line-color': '#0096c7', 'line-width': 0.6, 'line-opacity': 0.35 } })

          // Country EEZ highlight
          const iso = countryRef.current
          map.addLayer({ id: 'eez-country', type: 'fill', source: 'eez',
            paint: { 'fill-color': '#0096c7', 'fill-opacity': 0.18 },
            filter: iso
              ? ['any', ['==', ['get', 'iso_ter1'], iso], ['==', ['get', 'iso_sov1'], iso]]
              : ['==', ['get', 'mrgid'], -1] })

          // Selected EEZ fill
          map.addLayer({ id: 'eez-selected', type: 'fill', source: 'eez',
            paint: { 'fill-color': '#06b6d4', 'fill-opacity': 0.35 },
            filter: ['==', ['get', 'mrgid'], -1] })

          // Hover highlight
          map.addLayer({ id: 'eez-hover', type: 'fill', source: 'eez',
            paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.08 },
            filter: ['==', ['get', 'mrgid'], -1] })

          // Transparent click target (on top)
          map.addLayer({ id: 'eez-clickable', type: 'fill', source: 'eez',
            paint: { 'fill-color': '#000000', 'fill-opacity': 0 } })

          // Apply initial selection
          const eezCodes = valueRef.current
            .filter(c => typeof c === 'string' && c.startsWith('EEZ:'))
            .map(c => c.slice(4))
          if (eezCodes.length) {
            map.setFilter('eez-selected', ['in', ['get', 'iso_ter1'], ['literal', eezCodes]])
          }

          // EEZ click handled by unified handler below
        })
        .catch(() => {}) // EEZ is optional

      // ── ICES area layer (optional, async) ─────────────────────────────────
      const icesUrl = `${import.meta.env.BASE_URL}ices_areas.geojson`
      fetch(icesUrl)
        .then(r => { if (!r.ok) throw new Error('missing'); return r.json() })
        .then(data => {
          // Build name lookup
          const nameMap = {}
          data.features.forEach(f => {
            const code = f.properties.code
            if (code) nameMap[code] = ICES_NAMES[code] || code
          })
          icesNameRef.current = nameMap

          map.addSource('ices', { type: 'geojson', data })

          // ICES boundary lines (emerald)
          map.addLayer({ id: 'ices-line', type: 'line', source: 'ices',
            paint: { 'line-color': '#10b981', 'line-width': 0.6, 'line-opacity': 0.45 } })

          // Selected fill (emerald)
          map.addLayer({ id: 'ices-selected', type: 'fill', source: 'ices',
            paint: { 'fill-color': '#10b981', 'fill-opacity': 0.38 },
            filter: ['==', ['get', 'code'], ''] })

          // Hover highlight
          map.addLayer({ id: 'ices-hover', type: 'fill', source: 'ices',
            paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.08 },
            filter: ['==', ['get', 'code'], ''] })

          // Transparent click target (on top)
          map.addLayer({ id: 'ices-clickable', type: 'fill', source: 'ices',
            paint: { 'fill-color': '#000000', 'fill-opacity': 0 } })

          // Apply initial selection
          const icesCodes = valueRef.current
            .filter(c => typeof c === 'string' && c.startsWith('ICES:'))
            .map(c => c.slice(5))
          if (icesCodes.length) {
            map.setFilter('ices-selected', ['in', ['get', 'code'], ['literal', icesCodes]])
          }

          // ICES click handled by unified handler below
        })
        .catch(() => {}) // ICES is optional

      // ── FAO interaction (queries EEZ and ICES too for combined popup) ─────
      map.on('mousemove', 'fao-fill', e => {
        if (!e.features?.length) return
        const fao = e.features[0].properties
        map.setFilter('fao-hover', ['==', ['get', 'code'], fao.code])
        map.getCanvas().style.cursor = 'pointer'

        // Check for EEZ at same point
        const eezFeats = map.getLayer('eez-clickable')
          ? map.queryRenderedFeatures(e.point, { layers: ['eez-clickable'] })
          : []
        const eez = eezFeats[0]?.properties
        if (eez && map.getLayer('eez-hover')) {
          map.setFilter('eez-hover', ['==', ['get', 'mrgid'], eez.mrgid])
        }

        // Check for ICES at same point
        const icesFeats = map.getLayer('ices-clickable')
          ? map.queryRenderedFeatures(e.point, { layers: ['ices-clickable'] })
          : []
        const icesProps = icesFeats[0]?.properties
        if (icesProps && map.getLayer('ices-hover')) {
          map.setFilter('ices-hover', ['==', ['get', 'code'], icesProps.code])
        }

        const cur = valueRef.current
        const faoSel = cur.includes(fao.code)
        const eezIso = eez?.iso_ter1
        const eezKey = eezIso ? `EEZ:${eezIso}` : null
        const eezSel = eezKey ? cur.includes(eezKey) : false
        const eezName = eezIso ? (eezNameRef.current[eezIso] || eezIso) : null
        const icesCode = icesProps?.code
        const icesKey = icesCode ? `ICES:${icesCode}` : null
        const icesSel = icesKey ? cur.includes(icesKey) : false
        const icesName = icesCode ? (icesNameRef.current[icesCode] || icesCode) : null

        popup.setLngLat(e.lngLat).setHTML(`
          <div style="font-size:11px;font-family:sans-serif;line-height:1.6">
            <div>
              <span style="color:#94a3b8;font-family:monospace">FAO&nbsp;${fao.code}</span>
              <span style="color:#f1f5f9;font-weight:600;margin-left:5px">${fao.name}</span>
              <span style="color:${faoSel ? '#22d3ee' : '#475569'};margin-left:6px">${faoSel ? '✓' : '+ click'}</span>
            </div>
            ${eezKey ? `<div>
              <span style="color:#06b6d4;font-family:monospace">${eezKey}</span>
              <span style="color:#e0f2fe;margin-left:5px">${eezName}</span>
              <span style="color:${eezSel ? '#22d3ee' : '#475569'};margin-left:6px">${eezSel ? '✓' : '+ click'}</span>
            </div>` : ''}
            ${icesKey ? `<div>
              <span style="color:#6ee7b7;font-family:monospace">${icesKey}</span>
              <span style="color:#d1fae5;margin-left:5px">${icesName}</span>
              <span style="color:${icesSel ? '#22d3ee' : '#475569'};margin-left:6px">${icesSel ? '✓' : '+ click'}</span>
            </div>` : ''}
          </div>`).addTo(map)
      })

      map.on('mouseleave', 'fao-fill', () => {
        map.setFilter('fao-hover', ['==', ['get', 'code'], -1])
        if (map.getLayer('eez-hover')) map.setFilter('eez-hover', ['==', ['get', 'mrgid'], -1])
        if (map.getLayer('ices-hover')) map.setFilter('ices-hover', ['==', ['get', 'code'], ''])
        map.getCanvas().style.cursor = ''
        popup.remove()
      })

      // ── Unified click: toggle ALL applicable codes (FAO + EEZ + ICES) at once ─
      map.on('click', e => {
        const faoFeats = map.queryRenderedFeatures(e.point, { layers: ['fao-fill'] })
        const eezFeats = map.getLayer('eez-clickable')
          ? map.queryRenderedFeatures(e.point, { layers: ['eez-clickable'] })
          : []
        const icesFeats = map.getLayer('ices-clickable')
          ? map.queryRenderedFeatures(e.point, { layers: ['ices-clickable'] })
          : []

        const codes = []
        if (faoFeats[0]) codes.push(faoFeats[0].properties.code)
        if (eezFeats[0]) {
          const iso = eezFeats[0].properties.iso_ter1
          if (iso) codes.push(`EEZ:${iso}`)
        }
        if (icesFeats[0]) {
          const code = icesFeats[0].properties.code
          if (code) codes.push(`ICES:${code}`)
        }

        if (!codes.length) return

        // Toggle each code individually: add if absent, remove if present
        const cur = valueRef.current
        let updated = [...cur]
        for (const c of codes) {
          const idx = updated.indexOf(c)
          if (idx >= 0) updated.splice(idx, 1)
          else updated.push(c)
        }
        onChange(updated)
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync FAO selected layer (numbers only)
  useEffect(() => {
    if (!mapLoadedRef.current || !mapRef.current?.getLayer('fao-selected')) return
    const codes = value.filter(c => typeof c === 'number')
    mapRef.current.setFilter('fao-selected',
      codes.length ? ['in', ['get', 'code'], ['literal', codes]] : ['==', ['get', 'code'], -1])
  }, [value])

  // Sync EEZ selected layer (strings "EEZ:ISO")
  useEffect(() => {
    if (!mapLoadedRef.current || !mapRef.current?.getLayer('eez-selected')) return
    const isoCodes = value.filter(c => typeof c === 'string' && c.startsWith('EEZ:')).map(c => c.slice(4))
    mapRef.current.setFilter('eez-selected',
      isoCodes.length ? ['in', ['get', 'iso_ter1'], ['literal', isoCodes]] : ['==', ['get', 'mrgid'], -1])
  }, [value])

  // Sync ICES selected layer (strings "ICES:code")
  useEffect(() => {
    if (!mapLoadedRef.current || !mapRef.current?.getLayer('ices-selected')) return
    const codes = value.filter(c => typeof c === 'string' && c.startsWith('ICES:')).map(c => c.slice(5))
    mapRef.current.setFilter('ices-selected',
      codes.length ? ['in', ['get', 'code'], ['literal', codes]] : ['==', ['get', 'code'], ''])
  }, [value])

  const faoTags = value.filter(c => typeof c === 'number')
  const eezTags = value.filter(c => typeof c === 'string' && c.startsWith('EEZ:'))
  const icesTags = value.filter(c => typeof c === 'string' && c.startsWith('ICES:'))

  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      <div ref={containerRef} className="w-full rounded border border-[#1e3a5f] overflow-hidden" style={{ height: 260 }} />
      {(faoTags.length > 0 || eezTags.length > 0 || icesTags.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {faoTags.map(code => (
            <span key={code} className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-900/40 border border-cyan-700 text-xs text-cyan-200">
              <span className="font-mono font-medium">FAO:{code}</span>
              <span className="text-slate-400">—</span>
              <span>{FAO_AREAS[code]}</span>
              <button type="button" onClick={() => onChange(value.filter(c => c !== code))}
                className="ml-0.5 text-slate-400 hover:text-red-400 leading-none">×</button>
            </span>
          ))}
          {eezTags.map(key => {
            const iso = key.slice(4)
            const name = eezNameRef.current[iso] || iso
            return (
              <span key={key} className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-900/40 border border-sky-600 text-xs text-sky-200">
                <span className="font-mono font-medium">{key}</span>
                <span className="text-slate-400">—</span>
                <span>{name}</span>
                <button type="button" onClick={() => onChange(value.filter(c => c !== key))}
                  className="ml-0.5 text-slate-400 hover:text-red-400 leading-none">×</button>
              </span>
            )
          })}
          {icesTags.map(key => {
            const code = key.slice(5)
            const name = icesNameRef.current[code] || ICES_NAMES[code] || code
            return (
              <span key={key} className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-700 text-xs text-emerald-200">
                <span className="font-mono font-medium">{key}</span>
                <span className="text-slate-400">—</span>
                <span>{name}</span>
                <button type="button" onClick={() => onChange(value.filter(c => c !== key))}
                  className="ml-0.5 text-slate-400 hover:text-red-400 leading-none">×</button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SizeRangePicker({ label, value = [], onChange, hint }) {
  const toggle = r => onChange(value.includes(r) ? value.filter(v => v !== r) : [...value, r])
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {VESSEL_SIZE_RANGES.map(r => (
          <button key={r} type="button" onClick={() => toggle(r)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              value.includes(r)
                ? 'bg-cyan-800 border-cyan-500 text-cyan-100'
                : 'bg-[#0a1628] border-[#1e3a5f] text-slate-400 hover:border-slate-500 hover:text-white'
            }`}>
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── ETP species curated list (ASFIS alpha-3 codes) ────────────────────────────
// Covers species commonly encountered as ETP bycatch in global fisheries.
// All codes verified against ASFIS 2025 edition.
const ETP_CODES = new Set([
  // Sea turtles
  'TUG','TTH','LKY','DKK','TTL','LKV','FBT','TTX',
  // Sirenians
  'DUG','WIM','SEW','WAM',
  // Cetaceans — large whales
  'BLW','FIW','HUW','SIW','SPW','MIW','BFW','EUG','EZJ','EUA',
  // Cetaceans — small whales & dolphins
  'KIW','PIW','GLO','DCO','DBO','DSI','DST','FAW','IRD','VAQ',
  // Cetaceans — porpoises
  'PHR','PDA',
  // Pinnipeds
  'CSL','SSL','ASL','NSL','SEL','ZOX','SXX','SEN','SEH',
  'SKC','SMH','SMM',
  // High-profile sharks
  'RHN','BSK','WSH',
  // Manta & devil rays
  'RMB','MAN',
  // Sawfish
  'RPR','RPP','RPC','RPA','SAW',
  // Seabirds — all albatross species + NEI
  'ALZ','DAM','DQS','DCR','DIM','DKN','DIB','TQW','DER','DIC',
  'TQH','DIZ','PHE','DIQ','DKS','DAQ','DCU','PHU','DIP','DBN',
  'DIX','DPK','TWD','VZZ',
])

// ── SpeciesSelect ─────────────────────────────────────────────────────────────
function SpeciesSelect({ label, value = [], onChange, hint, etp = false }) {
  const [asfis, setAsfis] = useState([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}asfis_species.json`)
      .then(r => r.json())
      .then(setAsfis)
      .catch(() => {})
  }, [])

  const etpList = useMemo(() =>
    etp ? asfis.filter(sp => ETP_CODES.has(sp.a)) : []
  , [asfis, etp])

  const matches = useMemo(() => {
    if (asfis.length === 0) return []
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return asfis.filter(sp =>
      sp.n.toLowerCase().includes(q) ||
      sp.a.toLowerCase().includes(q) ||
      sp.s.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [query, asfis])

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const add = sp => {
    if (!value.find(v => v.a === sp.a)) onChange([...value, sp])
    setQuery('')
    setOpen(false)
  }
  const remove = code => onChange(value.filter(v => v.a !== code))

  return (
    <div ref={ref}>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(sp => (
            <span key={sp.a} className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-900/40 border border-cyan-700 text-xs text-cyan-200">
              <span className="font-mono">{sp.a}</span>
              <span className="text-slate-400">—</span>
              <span>{sp.n}</span>
              <button type="button" onClick={() => remove(sp.a)}
                className="ml-0.5 text-slate-400 hover:text-red-400 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder={asfis.length ? (etp ? 'Focus to browse ETP species, or type to search all…' : 'Type common name, scientific name or FAO code…') : 'Loading species list…'}
          disabled={!asfis.length}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
          className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600 transition-colors disabled:opacity-50"
        />
        {open && (matches.length > 0 || (etp && !query.trim() && etpList.length > 0)) && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0d1f3c] border border-[#1e3a5f] rounded shadow-xl max-h-64 overflow-y-auto">
            {/* Empty query + etp mode: show curated ETP list */}
            {!query.trim() && etp && etpList.filter(sp => !value.find(v => v.a === sp.a)).map(sp => (
              <button key={sp.a} type="button" onMouseDown={() => add(sp)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-[#1e3a5f] hover:text-white text-left">
                <span className="font-mono text-amber-400 w-10 flex-shrink-0">{sp.a}</span>
                <span className="flex-1">{sp.n}</span>
                <span className="text-xs text-amber-700 font-medium ml-auto pl-2 flex-shrink-0">ETP</span>
              </button>
            ))}
            {/* Query active: show search results, badging ETP matches */}
            {query.trim() && matches.filter(sp => !value.find(v => v.a === sp.a)).map(sp => (
              <button key={sp.a} type="button" onMouseDown={() => add(sp)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-[#1e3a5f] hover:text-white text-left">
                <span className={`font-mono w-10 flex-shrink-0 ${ETP_CODES.has(sp.a) ? 'text-amber-400' : 'text-cyan-400'}`}>{sp.a}</span>
                <span className="flex-1">{sp.n}</span>
                {ETP_CODES.has(sp.a)
                  ? <span className="text-xs text-amber-700 font-medium ml-auto pl-2 flex-shrink-0">ETP</span>
                  : <span className="text-xs text-slate-500 italic truncate max-w-32">{sp.s}</span>
                }
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OrgSelect({ label, value = [], onChange, hint, column = 'organizations' }) {
  const [allOrgs, setAllOrgs] = useState([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    supabase.from('programs').select(column).not(column, 'is', null)
      .then(({ data }) => {
        const seen = new Set()
        const orgs = []
        for (const row of data ?? []) {
          for (const raw of (row[column] ?? '').split(/[;,]/)) {
            const name = raw.trim()
            if (name && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase())
              orgs.push(name)
            }
          }
        }
        setAllOrgs(orgs.sort((a, b) => a.localeCompare(b)))
      })
  }, [column])

  const matches = useMemo(() => {
    if (!query.trim()) return allOrgs.slice(0, 20)
    const q = query.toLowerCase()
    return allOrgs.filter(o => o.toLowerCase().includes(q)).slice(0, 20)
  }, [query, allOrgs])

  const exactMatch = allOrgs.some(o => o.toLowerCase() === query.trim().toLowerCase())
  const showAddNew = query.trim().length > 1 && !exactMatch && !value.includes(query.trim())

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const add = name => {
    const trimmed = name.trim()
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed])
    setQuery('')
    setOpen(false)
  }
  const remove = name => onChange(value.filter(v => v !== name))

  return (
    <div ref={ref}>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(org => (
            <span key={org} className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-900/40 border border-cyan-700 text-xs text-cyan-200">
              <span>{org}</span>
              <button type="button" onClick={() => remove(org)}
                className="ml-0.5 text-slate-400 hover:text-red-400 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder="Type to search or add an organisation…"
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && query.trim()) { e.preventDefault(); add(query) }
            if (e.key === 'Escape') setOpen(false)
          }}
          className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600 transition-colors"
        />
        {open && (matches.length > 0 || showAddNew) && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0d1f3c] border border-[#1e3a5f] rounded shadow-xl max-h-56 overflow-y-auto">
            {matches.filter(o => !value.includes(o)).map(org => (
              <button key={org} type="button" onMouseDown={() => add(org)}
                className="w-full px-3 py-2 text-sm text-slate-300 hover:bg-[#1e3a5f] hover:text-white text-left">
                {org}
              </button>
            ))}
            {showAddNew && (
              <button type="button" onMouseDown={() => add(query)}
                className="w-full px-3 py-2 text-sm text-cyan-400 hover:bg-[#1e3a5f] hover:text-cyan-300 text-left border-t border-[#1e3a5f]">
                + Add &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Initial form state ────────────────────────────────────────────────────────

const EMPTY = {
  // Submitter (not in programs table)
  submitter_name: '',
  submitter_email: '',
  submitter_organization: '',

  // Section 1 — General
  programme_name: '',
  country: { name: '', iso3: '' },  // unified country object → split to country_raw/country_iso on submit
  start_date: '',
  end_date: '',
  is_active: null,

  // Section 2 — The Fishery
  target_species: [],      // array of {a, n, s} ASFIS objects → joined on submit
  bycatch_species: [],     // array of {a, n, s} ASFIS objects → joined on submit
  gear_types: [],
  fleet_size_total: '',    // range label e.g. '50–100'
  areas_of_operation: [],
  trip_duration: '',
  flag_states: [],

  // Section 3 — The EM Programme
  em_regulation: '',
  programme_type: [],
  objectives: '',
  full_rem_coverage: null,
  fleet_size_em: '',          // range label — midpoint stored to fleet_size_em int on submit
  vessel_size_em: [],         // shown when full_rem_coverage = false
  vessel_size_range: [],
  supplier_model: '',
  hardware_provider: [],
  procurement_entity: '',
  review_model: '',
  data_transmission_primary: [],   // checkboxes → joined on submit
  data_transmission_secondary: '', // radio (3rd party & Agency path only)
  processed_data_submission: '',
  additional_sensors: null,
  sensor_types: [],
  sensor_transmission_frequency: '',
  video_imagery: '',               // UI field: 'no'|'video'|'images'|'both'
  cameras_per_vessel: '',          // text "3" or "2-5", parsed to min/max on submit
  video_transmission_frequency: '',
  image_capture_config: '',
  dcf_programme: null,
  em_additional_notes: '',         // Q47

  // Section 4 — Sampling Design (only shown when video_imagery !== 'no')
  recording_config: '',            // 'video'|'images'|'both'
  video_recording_type: '',
  video_selection_method: '',
  quality_thresholds: '',
  video_used_for_commercial_catch: null,
  programme_monitoring: '',        // shown when video_used_for_commercial_catch = false
  review_objectives: '',
  sampling_unit_primary: '',
  sampling_coverage_primary: '',
  sampling_unit_secondary: '',
  sampling_coverage_secondary: '',
  sampling_unit_tertiary: '',
  sampling_coverage_tertiary: '',
  catch_observation_stage: [],     // multi-checkbox → joined on submit
  target_species_sampled: '',
  target_species_sampled_detail: [],  // ASFIS objects when 'specific' or 'group' chosen
  bycatch_species_sampled: '',
  bycatch_species_sampled_detail: [],
  species_id_resolution: '',
  length_measurements: '',
  sex_collected: '',
  additional_characteristics: '',
  technical_challenges: '',
  primary_reviewer: '',
  sampling_additional_notes: '',   // Q74

  // Section 5 — Data Use & Management
  data_uses: '',
  used_in_stock_assessment: null,
  stock_assessment_details: '',    // optional text when used_in_stock_assessment = true
  data_owner: [],                  // multi-checkbox → joined on submit
  data_sharing_agreements: null,   // boolean
  data_storage_location: [],       // multi-checkbox → joined on submit
  data_retention_limit: '',
  data_additional_notes: '',       // Q81

  // Section 6 — AI / ML
  ai_status: '',                   // 'development'|'operational'|'no'
  ai_video_retained: null,
  ai_applications: '',
  ai_image_subjects: '',
  ai_assets_available: '',
  ai_review_stage: [],             // multi-checkbox → joined on submit
  ai_developer: '',
  ai_training_data_size: '',

  additional_notes: '',

  // Contact metadata
  organizations: [],
  primary_contact: '',
  web_links: '',
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const ALL_STEPS = [
  { id: 'contact',  label: 'Contact' },
  { id: 'basics',   label: 'Programme basics' },
  { id: 'fishery',  label: 'The Fishery' },
  { id: 'em',       label: 'EM Programme' },
  { id: 'sampling', label: 'Sampling & Review' },  // skipped when no video/imagery
  { id: 'data',     label: 'Data Use & AI' },
  { id: 'submit',   label: 'Review & Submit' },
]

// ── Camera field helpers ──────────────────────────────────────────────────────

function parseCameraMin(str) {
  if (!str) return null
  const parts = str.split('-').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
  return parts.length ? parts[0] : null
}
function parseCameraMax(str) {
  if (!str) return null
  const parts = str.split('-').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
  return parts.length > 1 ? parts[1] : parts[0] ?? null
}

// ── formFromProgram — map a DB programs row back to form state ────────────────

function formFromProgram(p) {
  const split = s => (s || '').split(/;\s*/).map(x => x.trim()).filter(Boolean)
  const toSpecies = s => split(s).map(code => ({ a: code, n: code, s: '' }))

  // Country
  const country = p.country_iso
    ? (COUNTRIES.find(c => c.iso3 === p.country_iso) || { name: p.country_raw || p.country_iso, iso3: p.country_iso })
    : { name: p.country_raw || '', iso3: '' }

  // fleet_size_em midpoint → range label
  const midpointToRange = n => {
    if (!n) return ''
    for (const r of VESSEL_RANGES) {
      const m = r.max == null ? 3000 : Math.round((r.min + r.max) / 2)
      if (m === n) return r.label
    }
    return ''
  }

  // areas_of_operation: "FAO:27 – Atlantic...; EEZ:GBR; ICES:27.4.a – ..." → mixed array
  const parseAreas = s => split(s).map(token => {
    if (token.startsWith('FAO:')) { const n = parseInt(token.slice(4)); return isNaN(n) ? null : n }
    if (token.startsWith('EEZ:')) return token.split(' ')[0]
    if (token.startsWith('ICES:')) return token.split(' ')[0]
    const m = token.match(/^(\d+)/)       // legacy "27 – Atlantic..." format
    return m ? parseInt(m[1]) : null
  }).filter(x => x !== null)

  // cameras: min/max → "min-max" string
  const cameras = p.cameras_per_vessel_min != null
    ? (p.cameras_per_vessel_max && p.cameras_per_vessel_max !== p.cameras_per_vessel_min
        ? `${p.cameras_per_vessel_min}-${p.cameras_per_vessel_max}`
        : String(p.cameras_per_vessel_min))
    : ''

  // video_imagery
  const videoImagery = p.collects_video && p.collects_images ? 'both'
    : p.collects_video ? 'video'
    : p.collects_images ? 'images'
    : p.collects_video === false && p.collects_images === false ? 'no' : ''

  // target/bycatch_species_sampled: "Specific taxa only: COD; HAD" → base + detail
  const parseSampled = raw => {
    const str = raw || ''
    const idx = str.indexOf(': ')
    if (idx > -1) return { base: str.slice(0, idx), detail: toSpecies(str.slice(idx + 2)) }
    return { base: str, detail: [] }
  }
  const tss = parseSampled(p.target_species_sampled)
  const bss = parseSampled(p.bycatch_species_sampled)

  return {
    ...EMPTY,
    programme_name:    p.programme_name || '',
    country,
    start_date:        p.start_date || '',
    end_date:          p.end_date || '',
    is_active:         p.is_active ?? false,
    organizations:     split(p.organizations),
    primary_contact:   p.primary_contact || '',
    web_links:         p.web_links || '',

    target_species:    toSpecies(p.target_species),
    bycatch_species:   toSpecies(p.bycatch_species),
    gear_types:        p.gear_types || [],
    fleet_size_total:  p.fleet_size_total || '',
    fleet_size_em:     midpointToRange(p.fleet_size_em),
    vessel_size_range: split(p.vessel_size_range),
    vessel_size_em:    split(p.vessel_size_em),
    areas_of_operation: parseAreas(p.areas_of_operation),
    trip_duration:     p.trip_duration || '',
    flag_states:       split(p.flag_states),

    em_regulation:     p.em_regulation || '',
    programme_type:    p.programme_type || [],
    objectives:        p.objectives || '',
    full_rem_coverage: p.full_rem_coverage ?? false,
    supplier_model:    p.supplier_model || '',
    hardware_provider: split(p.hardware_provider),
    procurement_entity: p.procurement_entity || '',
    review_model:      p.review_model || '',
    data_transmission_primary:   split(p.data_transmission_primary),
    data_transmission_secondary: p.data_transmission_secondary || '',
    processed_data_submission:   p.processed_data_submission || '',
    additional_sensors:          p.additional_sensors ?? false,
    sensor_types:                split(p.sensor_types),
    sensor_transmission_frequency: p.sensor_transmission_frequency || '',

    video_imagery:    videoImagery,
    cameras_per_vessel: cameras,
    video_transmission_frequency: p.video_transmission_frequency || '',
    image_capture_config:         p.image_capture_config || '',
    dcf_programme:   p.dcf_programme ?? false,
    recording_config:      p.recording_config || '',
    video_recording_type:  p.video_recording_type || '',
    video_selection_method: p.video_selection_method || '',
    quality_thresholds:    p.quality_thresholds || '',
    video_used_for_commercial_catch: p.video_used_for_commercial_catch ?? false,
    programme_monitoring:  p.programme_monitoring || '',
    review_objectives:     p.review_objectives || '',

    sampling_unit_primary:    p.sampling_unit_primary || '',
    sampling_coverage_primary: p.sampling_coverage_primary || '',
    sampling_unit_secondary:   p.sampling_unit_secondary || '',
    sampling_coverage_secondary: p.sampling_coverage_secondary || '',
    sampling_unit_tertiary:    p.sampling_unit_tertiary || '',
    sampling_coverage_tertiary: p.sampling_coverage_tertiary || '',
    catch_observation_stage:   split(p.catch_observation_stage),
    target_species_sampled:        tss.base,
    target_species_sampled_detail: tss.detail,
    bycatch_species_sampled:       bss.base,
    bycatch_species_sampled_detail: bss.detail,
    species_id_resolution: p.species_id_resolution || '',
    length_measurements:   p.length_measurements || '',
    sex_collected:         p.sex_collected || '',
    additional_characteristics: p.additional_characteristics || '',
    technical_challenges:  p.technical_challenges || '',
    primary_reviewer:      p.primary_reviewer || '',

    data_uses:               p.data_uses || '',
    used_in_stock_assessment: p.used_in_stock_assessment ?? false,
    data_owner:              split(p.data_owner),
    data_sharing_agreements: p.data_sharing_agreements === 'Yes' ? true
                           : p.data_sharing_agreements === 'No' ? false : null,
    data_storage_location:   split(p.data_storage_location),
    data_retention_limit:    p.data_retention_limit || '',

    ai_status:           p.ai_in_development === true ? 'yes' : p.ai_in_development === false ? 'no' : '',
    ai_video_retained:   p.ai_video_retained ?? false,
    ai_applications:     p.ai_applications || '',
    ai_image_subjects:   p.ai_image_subjects || '',
    ai_assets_available: p.ai_assets_available || '',
    ai_review_stage:     split(p.ai_review_stage),
    ai_developer:        p.ai_developer || '',
    ai_training_data_size: p.ai_training_data_size || '',

    additional_notes: p.additional_notes || '',
  }
}

// ── ProgramSearch — typeahead search for existing programmes ──────────────────

function ProgramSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.from('programs')
        .select('id, programme_name, country_iso, is_active, em_regulation, start_date')
        .eq('status', 'approved')
        .ilike('programme_name', `%${query}%`)
        .limit(10)
      setResults(data || [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="mt-4">
      <div className="relative">
        <input
          type="text"
          value={query}
          autoFocus
          placeholder="Search programme name…"
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600 transition-colors"
        />
        {loading && (
          <span className="absolute right-3 top-2.5 animate-spin inline-block w-3.5 h-3.5 border border-cyan-500 border-t-transparent rounded-full" />
        )}
      </div>
      {results.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {results.map(p => (
            <button key={p.id} type="button" onClick={() => onSelect(p)}
              className="w-full text-left rounded border border-[#1e3a5f] px-3 py-2.5 hover:bg-[#1e3a5f] hover:text-white transition-colors">
              <div className="text-sm font-medium text-slate-200">{p.programme_name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {[
                  p.country_iso,
                  p.is_active ? 'Active' : 'Inactive',
                  p.em_regulation?.replace('Under Regulation - ', '').replace('Non-Regulation - ', ''),
                ].filter(Boolean).join(' · ')}
              </div>
            </button>
          ))}
        </div>
      )}
      {query.length >= 2 && !loading && results.length === 0 && (
        <p className="text-xs text-slate-500 mt-2 pl-1">No matching programmes found.</p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SubmitForm() {
  const [mode, setMode] = useState(null)           // null | 'add' | 'edit'
  const [editExpanded, setEditExpanded] = useState(false)
  const [stepId, setStepId] = useState('contact')
  const [form, setForm] = useState(EMPTY)
  const [duplicateResult, setDuplicateResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const set = key => value => setForm(f => ({ ...f, [key]: value }))

  // Load a programme for editing: fetch full record, pre-populate form, jump to step 1
  const selectForEdit = async (summary) => {
    const { data, error } = await supabase.from('programs').select('*').eq('id', summary.id).single()
    if (error || !data) return
    setForm(formFromProgram(data))
    setDuplicateResult({ id: data.id, name: data.programme_name })
    setMode('edit')
    setStepId('contact')
  }

  // Derived flags
  const collectsVideo  = ['video', 'both'].includes(form.video_imagery)
  const collectsImages = ['images', 'both'].includes(form.video_imagery)
  const hasMedia       = form.video_imagery && form.video_imagery !== 'no'
  const reviewNeeds3p  = ['3rd party only', '3rd party & Agency'].includes(form.review_model)
  const reviewNeedsAg  = ['Agency only',    '3rd party & Agency'].includes(form.review_model)
  const reviewNeedsBoth = form.review_model === '3rd party & Agency'
  const aiActive       = form.ai_status === 'development' || form.ai_status === 'operational'

  // Dynamic step list — skip Sampling if no media
  const visibleSteps = useMemo(() =>
    ALL_STEPS.filter(s => s.id !== 'sampling' || hasMedia),
    [hasMedia]
  )

  const currentIdx = visibleSteps.findIndex(s => s.id === stepId)

  const goNext = () => {
    if (currentIdx < visibleSteps.length - 1)
      setStepId(visibleSteps[currentIdx + 1].id)
  }
  const goPrev = () => {
    if (currentIdx > 0)
      setStepId(visibleSteps[currentIdx - 1].id)
  }

  // Step validation (only required fields)
  const stepValid = {
    contact:  form.submitter_name.trim() && form.submitter_email.includes('@'),
    basics:   form.programme_name.trim().length >= 3 && duplicateResult !== null,
    fishery:  true,
    em:       !!form.em_regulation && form.programme_type.length > 0,
    sampling: true,
    data:     !!form.data_uses.trim(),
    submit:   true,
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    const payload = {
      programme_name:    form.programme_name.trim(),
      country_raw:       form.country.name || null,
      country_iso:       form.country.iso3 || null,
      start_date:        form.start_date || null,
      end_date:          form.end_date || null,
      is_active:         form.is_active,
      reference_year:    new Date().getFullYear(),
      organizations:     form.organizations.length ? form.organizations.join('; ') : null,
      primary_contact:   form.primary_contact.trim() || null,
      web_links:         form.web_links.trim() || null,

      target_species:    form.target_species.length ? form.target_species.map(s => s.a).join('; ') : null,
      bycatch_species:   form.bycatch_species.length ? form.bycatch_species.map(s => s.a).join('; ') : null,
      gear_types:        form.gear_types.length ? form.gear_types : null,
      fleet_size_total:  form.fleet_size_total || null,
      fleet_size_em:     form.fleet_size_em ? rangeMidpoint(form.fleet_size_em) : null,
      vessel_size_range: form.vessel_size_range.length ? form.vessel_size_range.join('; ') : null,
      vessel_size_em:    form.vessel_size_em.length ? form.vessel_size_em.join('; ') : null,
      areas_of_operation: form.areas_of_operation.length
        ? form.areas_of_operation.map(c => {
            if (typeof c === 'number') return `FAO:${c} – ${FAO_AREAS[c]}`
            if (typeof c === 'string' && c.startsWith('ICES:')) {
              const code = c.slice(5)
              return `${c} – ${ICES_NAMES[code] || code}`
            }
            return c // EEZ:ISO stored as-is
          }).join('; ')
        : null,
      trip_duration:     form.trip_duration || null,
      flag_states:       form.flag_states.length ? form.flag_states.join('; ') : null,

      em_regulation:     form.em_regulation || null,
      programme_type:    form.programme_type.length ? form.programme_type : null,
      objectives:        form.objectives.trim() || null,
      full_rem_coverage: form.full_rem_coverage,
      supplier_model:    form.supplier_model || null,
      hardware_provider: form.hardware_provider.length ? form.hardware_provider.join('; ') : null,
      procurement_entity: form.procurement_entity || null,
      review_model:      form.review_model || null,
      data_transmission_primary:   form.data_transmission_primary.join('; ') || null,
      data_transmission_secondary: form.data_transmission_secondary || null,
      processed_data_submission:   form.processed_data_submission || null,
      additional_sensors:          form.additional_sensors,
      sensor_types:                form.sensor_types.length ? form.sensor_types.join('; ') : null,
      sensor_transmission_frequency: form.sensor_transmission_frequency.trim() || null,

      collects_video:  collectsVideo,
      collects_images: collectsImages,
      cameras_per_vessel_min: parseCameraMin(form.cameras_per_vessel),
      cameras_per_vessel_max: parseCameraMax(form.cameras_per_vessel),
      video_transmission_frequency: form.video_transmission_frequency.trim() || null,
      image_capture_config:         form.image_capture_config.trim() || null,
      dcf_programme:   form.dcf_programme,

      recording_config:      form.recording_config || null,
      video_recording_type:  form.video_recording_type || null,
      video_selection_method: form.video_selection_method || null,
      quality_thresholds:    form.quality_thresholds.trim() || null,
      video_used_for_commercial_catch: form.video_used_for_commercial_catch,
      programme_monitoring:  form.programme_monitoring.trim() || null,
      review_objectives:     form.review_objectives.trim() || null,
      sampling_unit_primary:    form.sampling_unit_primary || null,
      sampling_coverage_primary: form.sampling_coverage_primary || null,
      sampling_unit_secondary:   form.sampling_unit_secondary || null,
      sampling_coverage_secondary: form.sampling_coverage_secondary || null,
      sampling_unit_tertiary:    form.sampling_unit_tertiary || null,
      sampling_coverage_tertiary: form.sampling_coverage_tertiary || null,
      catch_observation_stage:   form.catch_observation_stage.join('; ') || null,
      target_species_sampled:    form.target_species_sampled
        ? (form.target_species_sampled_detail.length
            ? `${form.target_species_sampled}: ${form.target_species_sampled_detail.map(s => s.a).join('; ')}`
            : form.target_species_sampled)
        : null,
      bycatch_species_sampled:   form.bycatch_species_sampled
        ? (form.bycatch_species_sampled_detail.length
            ? `${form.bycatch_species_sampled}: ${form.bycatch_species_sampled_detail.map(s => s.a).join('; ')}`
            : form.bycatch_species_sampled)
        : null,
      species_id_resolution:     form.species_id_resolution || null,
      length_measurements:       form.length_measurements || null,
      sex_collected:             form.sex_collected || null,
      additional_characteristics: form.additional_characteristics.trim() || null,
      technical_challenges:      form.technical_challenges.trim() || null,
      primary_reviewer:          form.primary_reviewer || null,

      data_uses:               form.data_uses.trim() || null,
      used_in_stock_assessment: form.used_in_stock_assessment,
      data_owner:              form.data_owner.join('; ') || null,
      data_sharing_agreements: form.data_sharing_agreements === true ? 'Yes'
                             : form.data_sharing_agreements === false ? 'No' : null,
      data_storage_location:   form.data_storage_location.join('; ') || null,
      data_retention_limit:    form.data_retention_limit.trim() || null,

      ai_in_development: aiActive ? true : form.ai_status === 'no' ? false : null,
      ai_video_retained: form.ai_video_retained,
      ai_applications:   form.ai_applications.trim() || null,
      ai_image_subjects: form.ai_image_subjects.trim() || null,
      ai_assets_available: form.ai_assets_available || null,
      ai_review_stage:   form.ai_review_stage.join('; ') || null,
      ai_developer:      form.ai_developer.trim() || null,
      ai_training_data_size: form.ai_training_data_size || null,

      additional_notes:  [
        form.em_additional_notes,
        form.sampling_additional_notes,
        form.data_additional_notes,
        form.additional_notes,
      ].filter(Boolean).join('\n\n') || null,
    }

    let err
    if (mode === 'edit') {
      ;({ error: err } = await supabase.from('programs').update(payload).eq('id', duplicateResult.id))
    } else {
      ;({ error: err } = await supabase.from('programs').insert([{ ...payload, status: 'pending' }]))
    }
    setSubmitting(false)
    if (err) setError(`${mode === 'edit' ? 'Update' : 'Submission'} failed: ${err.message}`)
    else setSubmitted(true)
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (submitted) {
    const wasEdit = mode === 'edit'
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
        <h2 className="text-lg font-semibold text-white mb-2">
          {wasEdit ? 'Programme updated' : 'Submission received'}
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          {wasEdit
            ? `${duplicateResult?.name ?? form.programme_name} has been updated and is live on the map.`
            : `${form.programme_name} has been submitted and is pending admin approval before appearing on the map.`}
        </p>
        <button
          onClick={() => { setSubmitted(false); setForm(EMPTY); setStepId('contact'); setDuplicateResult(null); setMode(null) }}
          className="bg-cyan-700 hover:bg-cyan-600 text-white text-sm px-5 py-2 rounded transition-colors"
        >
          {wasEdit ? 'Done' : 'Submit another'}
        </button>
      </div>
    )
  }

  // ── Step progress bar ─────────────────────────────────────────────────────────
  const StepBar = () => (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {visibleSteps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className={`flex items-center gap-1.5 flex-shrink-0 ${i <= currentIdx ? 'text-cyan-400' : 'text-slate-600'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0 ${
              i < currentIdx ? 'bg-cyan-700 border-cyan-600 text-white'
              : i === currentIdx ? 'border-cyan-500 text-cyan-400'
              : 'border-slate-700 text-slate-600'
            }`}>{i < currentIdx ? '✓' : i + 1}</div>
            <span className={`text-xs hidden md:block whitespace-nowrap ${i === currentIdx ? 'text-cyan-400 font-medium' : ''}`}>{s.label}</span>
          </div>
          {i < visibleSteps.length - 1 && <div className={`flex-1 h-px min-w-2 ${i < currentIdx ? 'bg-cyan-800' : 'bg-[#1e3a5f]'}`} />}
        </React.Fragment>
      ))}
    </div>
  )

  // ── Step: Contact ─────────────────────────────────────────────────────────────
  const stepContact = (
    <div className="space-y-4">
      <SectionHeader step={1} title="Your contact details"
        subtitle="Required for follow-up. Not published — stored internally only." />
      <Input label="Full name" required value={form.submitter_name} onChange={set('submitter_name')} />
      <Input label="Email address" required type="email" value={form.submitter_email} onChange={set('submitter_email')} />
      <Input label="Organisation" value={form.submitter_organization} onChange={set('submitter_organization')} />
    </div>
  )

  // ── Step: Programme Basics ─────────────────────────────────────────────────────
  const stepBasics = (
    <div className="space-y-4">
      <SectionHeader step={2} title="Programme basics"
        subtitle="Core identity information. We will check for potential duplicates." />
      <Input label="Programme name" required value={form.programme_name} onChange={set('programme_name')} />
      <CountrySelect value={form.country} onChange={set('country')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Start date" type="date" value={form.start_date} onChange={set('start_date')} />
        {form.is_active === false && (
          <Input label="End date" type="date" value={form.end_date} onChange={set('end_date')} />
        )}
      </div>
      <TriToggle label="Is this programme currently active?" value={form.is_active} onChange={set('is_active')} />
      <p className="text-xs text-slate-400 italic">
        The information in this submission is accurate as of {new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}.
      </p>
      <Divider label="Contact & links" />
      <OrgSelect label="Organisations involved" value={form.organizations} onChange={set('organizations')}
        hint="Lead agency, data provider, etc. Select existing or type to add new." />
      <Input label="Primary contact (name & email)" value={form.primary_contact} onChange={set('primary_contact')} />
      <Input label="Web links / publications" value={form.web_links} onChange={set('web_links')} placeholder="https://…" />

      {mode !== 'edit' && form.programme_name.length >= 4 && (
        <DuplicateCheck
          programmeName={form.programme_name}
          country={form.country.iso3 || null}
          gearTypes={form.gear_types}
          startYear={form.start_date ? new Date(form.start_date).getFullYear() : null}
          onResult={setDuplicateResult}
        />
      )}
    </div>
  )

  // ── Step: The Fishery ─────────────────────────────────────────────────────────
  const stepFishery = (
    <div className="space-y-4">
      <SectionHeader step={3} title="The Fishery"
        subtitle="Describe the fishery in which the EM programme operates." />
      <SpeciesSelect label="Target species"
        hint="Search by common name, scientific name or FAO alpha-3 code. Select all that apply."
        value={form.target_species} onChange={set('target_species')} />
      <SpeciesSelect label="Bycatch / non-target species"
        hint="Species incidentally captured. ETP species (turtles, marine mammals, seabirds, etc.) are shown on focus."
        value={form.bycatch_species} onChange={set('bycatch_species')} etp />
      <MultiCheckbox label="Gear types" options={GEAR_OPTIONS}
        hint="DCF fishing activity (metier) level 3. Select all that apply."
        value={form.gear_types} onChange={set('gear_types')} />
      <RangePicker label="Fleet size (total vessels in fishery)"
        hint="Total number of vessels in the fishery (not just those with EM)."
        value={form.fleet_size_total} onChange={set('fleet_size_total')} />
      <SizeRangePicker label="Vessel size range (fleet)" value={form.vessel_size_range} onChange={set('vessel_size_range')}
        hint="Select all size classes present in the fishery." />
      <AreaPicker label="Areas of operation (FAO Major Fishing Areas)"
        hint="Click areas on the map to select. Click again to deselect. Your country's EEZ is shown in blue."
        value={form.areas_of_operation} onChange={set('areas_of_operation')}
        country={form.country.iso3 || null} />
      <ChipPicker label="Average trip duration" options={TRIP_DURATIONS}
        value={form.trip_duration} onChange={set('trip_duration')} />
      <FlagStateSelect label="Flag states of participating vessels" required
        value={form.flag_states} onChange={set('flag_states')} />
    </div>
  )

  // ── Step: EM Programme ────────────────────────────────────────────────────────
  const stepEM = (
    <div className="space-y-5">
      <SectionHeader step={4} title="The EM Programme"
        subtitle="Technical configuration of the electronic monitoring programme." />

      <Radio label="EM in this fleet is…" required options={EM_REGULATION_OPTIONS}
        hint="Optional = EM is an option to replace another form of sampling. Non-Regulation = voluntary includes any trials or research projects."
        value={form.em_regulation} onChange={set('em_regulation')} />

      <MultiCheckbox label="The EM programme is for…" required options={PROGRAMME_TYPE_OPTIONS}
        value={form.programme_type} onChange={set('programme_type')} />

      <Textarea label="What are the overarching programme objectives?" value={form.objectives} onChange={set('objectives')}
        rows={3} placeholder="Max 300 characters" />

      <Divider label="Fleet coverage" />

      <TriToggle label="Do all vessels in the fishery have REM installed?" value={form.full_rem_coverage} onChange={set('full_rem_coverage')} />

      {form.full_rem_coverage === false && (
        <div className="pl-4 border-l border-[#1e3a5f] space-y-3">
          <RangePicker label="How many vessels are installed with EM?"
            hint="Select the range that best describes the EM-equipped fleet."
            value={form.fleet_size_em} onChange={set('fleet_size_em')} />
          <SizeRangePicker label="Size range of vessels with EM" value={form.vessel_size_em} onChange={set('vessel_size_em')}
            hint="Select all size classes carrying EM equipment." />
        </div>
      )}

      <Divider label="Technical configuration" />

      <Radio label="What is the supplier model?" options={SUPPLIER_MODEL_OPTIONS}
        value={form.supplier_model} onChange={set('supplier_model')} />
      <OrgSelect label="Hardware provider(s)" column="hardware_provider"
        value={form.hardware_provider} onChange={set('hardware_provider')} />
      <Radio label="Who procures the systems?" options={PROCUREMENT_OPTIONS}
        value={form.procurement_entity} onChange={set('procurement_entity')} />

      <Divider label="Review model & data transmission" />

      <Radio label="What is the review model?" options={REVIEW_MODEL_OPTIONS}
        value={form.review_model} onChange={set('review_model')} />

      {reviewNeedsAg && (
        <div className="pl-4 border-l border-[#1e3a5f]">
          <MultiCheckbox
            label={reviewNeedsBoth
              ? 'How is raw data primarily transmitted to the agency reviewer?'
              : 'How is raw data primarily transmitted to the primary reviewer?'}
            options={DATA_TRANSMISSION_OPTIONS}
            value={form.data_transmission_primary}
            onChange={set('data_transmission_primary')} />
        </div>
      )}

      {reviewNeedsBoth && (
        <div className="pl-4 border-l border-[#1e3a5f]">
          <Radio label="How is data submitted for secondary review?"
            options={SECONDARY_TRANSMISSION_OPTIONS}
            value={form.data_transmission_secondary}
            onChange={set('data_transmission_secondary')} />
        </div>
      )}

      {reviewNeeds3p && !reviewNeedsBoth && (
        <div className="pl-4 border-l border-[#1e3a5f]">
          <MultiCheckbox
            label="How is raw data primarily transmitted to the 3rd party reviewer?"
            options={DATA_TRANSMISSION_OPTIONS}
            value={form.data_transmission_primary}
            onChange={set('data_transmission_primary')} />
        </div>
      )}

      {form.review_model && (
        <Radio label="How is the processed EM data submitted?"
          options={PROCESSED_SUBMISSION_OPTIONS}
          value={form.processed_data_submission}
          onChange={set('processed_data_submission')} />
      )}

      <Divider label="Sensors" />

      <TriToggle label="Are additional sensor data collected?"
        hint="e.g. GPS, hydraulic pressure, tilt, temperature"
        value={form.additional_sensors} onChange={set('additional_sensors')} />

      {form.additional_sensors && (
        <div className="pl-4 border-l border-[#1e3a5f] space-y-3">
          <OrgSelect label="Sensor types" column="sensor_types"
            value={form.sensor_types} onChange={set('sensor_types')} />
          <Input label="Sensor transmission frequency" value={form.sensor_transmission_frequency}
            onChange={set('sensor_transmission_frequency')} placeholder="e.g. After each trip" />
        </div>
      )}

      <Divider label="Video / imagery" />

      <Radio label="Does this programme collect video or imagery?"
        options={VIDEO_IMAGERY_OPTIONS}
        value={form.video_imagery} onChange={set('video_imagery')} />

      {hasMedia && (
        <div className="pl-4 border-l border-[#1e3a5f] space-y-4">
          <Input label="How many cameras are installed per vessel?"
            hint="If this varies, provide a range separated by a dash e.g. 3-5"
            value={form.cameras_per_vessel} onChange={set('cameras_per_vessel')}
            placeholder="e.g. 4 or 2-6" />

          {collectsVideo && (
            <Input label="How frequently is video data transmitted?"
              hint="e.g. After the end of each trip"
              value={form.video_transmission_frequency} onChange={set('video_transmission_frequency')} />
          )}

          {collectsImages && (
            <Input label="How is still image capture configured?"
              value={form.image_capture_config} onChange={set('image_capture_config')}
              placeholder="e.g. Triggered every 30 seconds during haul" />
          )}
        </div>
      )}

      <Divider label="Administration" />

      <TriToggle label="Is this programme part of the administration's DCF multiannual programme?"
        hint="Applicable for EU and Coastal fisheries only"
        value={form.dcf_programme} onChange={set('dcf_programme')} />

      <Textarea label="Additional information for this section" value={form.em_additional_notes}
        onChange={set('em_additional_notes')} rows={3}
        placeholder="Please separate distinct items with semi-colons (;) and reference the question number" />
    </div>
  )

  // ── Step: Sampling & Review ───────────────────────────────────────────────────
  const stepSampling = (
    <div className="space-y-5">
      <SectionHeader step={5} title="Sampling Design"
        subtitle="How video and imagery are selected and reviewed." />

      <Radio label="Select the options below to specify how recording is configured"
        options={RECORDING_CONFIG_OPTIONS}
        value={form.recording_config} onChange={set('recording_config')} />

      {(form.recording_config === 'video' || form.recording_config === 'both') && (
        <div className="pl-4 border-l border-[#1e3a5f]">
          <Radio label="Video recording is…"
            options={VIDEO_RECORDING_OPTIONS}
            value={form.video_recording_type} onChange={set('video_recording_type')} />
        </div>
      )}

      {form.recording_config === 'both' && (
        <div className="pl-4 border-l border-[#1e3a5f]">
          <Input label="How is still image capture configured?"
            value={form.image_capture_config} onChange={set('image_capture_config')}
            placeholder="e.g. Triggered every 30 seconds during haul" />
        </div>
      )}

      <Radio label="How are videos/images selected for further review?"
        hint="What technique is used for selection of video?"
        options={VIDEO_SELECTION_OPTIONS}
        value={form.video_selection_method} onChange={set('video_selection_method')} />

      <Textarea label="Do you have quality thresholds for the selection of video/imagery?"
        hint="Please give details"
        value={form.quality_thresholds} onChange={set('quality_thresholds')} rows={2} />

      <Divider label="Review objectives" />

      <TriToggle label="Is the video or imagery data used for the monitoring of commercial fish catches?"
        value={form.video_used_for_commercial_catch} onChange={set('video_used_for_commercial_catch')} />

      {form.video_used_for_commercial_catch === false && (
        <div className="pl-4 border-l border-[#1e3a5f]">
          <Input label="What is the programme monitoring?"
            value={form.programme_monitoring} onChange={set('programme_monitoring')} />
        </div>
      )}

      <Textarea label="What are the data review objectives?"
        hint="Please separate distinct objectives with semi-colons (;)"
        value={form.review_objectives} onChange={set('review_objectives')} rows={3} />

      <Divider label="Sampling units" />

      <div className="grid grid-cols-2 gap-4">
        <Radio label="Primary sampling unit"
          hint="First unit to be selected for sampling"
          options={SAMPLING_UNIT_OPTIONS}
          value={form.sampling_unit_primary} onChange={set('sampling_unit_primary')} />
        <Radio label="Primary coverage"
          hint="% of sampling units reviewed"
          options={SAMPLING_COVERAGE_OPTIONS}
          value={form.sampling_coverage_primary} onChange={set('sampling_coverage_primary')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Radio label="Secondary sampling unit" options={SAMPLING_UNIT_OPTIONS}
          value={form.sampling_unit_secondary} onChange={set('sampling_unit_secondary')} />
        <Radio label="Secondary coverage" options={SAMPLING_COVERAGE_OPTIONS}
          value={form.sampling_coverage_secondary} onChange={set('sampling_coverage_secondary')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Radio label="Tertiary sampling unit" options={SAMPLING_UNIT_OPTIONS}
          value={form.sampling_unit_tertiary} onChange={set('sampling_unit_tertiary')} />
        <Radio label="Tertiary coverage" options={SAMPLING_COVERAGE_OPTIONS}
          value={form.sampling_coverage_tertiary} onChange={set('sampling_coverage_tertiary')} />
      </div>

      <Divider label="Species & catch data" />

      <MultiCheckbox label="At which stage is the catch observed by video/images?"
        hint="Select all that apply"
        options={CATCH_STAGE_OPTIONS}
        value={form.catch_observation_stage} onChange={set('catch_observation_stage')} />

      <Radio label="Which set of target species are sampled?"
        hint="Of the target species of the fishery, which are sampled?"
        options={SPECIES_SAMPLED_OPTIONS}
        value={form.target_species_sampled}
        onChange={v => { set('target_species_sampled')(v); if (!SPECIES_SAMPLED_NEEDS_DETAIL.has(v)) set('target_species_sampled_detail')([]) }} />
      {SPECIES_SAMPLED_NEEDS_DETAIL.has(form.target_species_sampled) && (
        <div className="pl-4 border-l border-[#1e3a5f]">
          <SpeciesSelect label="Specify which target species / groups are sampled"
            value={form.target_species_sampled_detail}
            onChange={set('target_species_sampled_detail')} />
        </div>
      )}

      <Radio label="Which set of bycatch species are sampled?"
        hint="Of the bycatch species of the fishery, which are sampled?"
        options={SPECIES_SAMPLED_OPTIONS}
        value={form.bycatch_species_sampled}
        onChange={v => { set('bycatch_species_sampled')(v); if (!SPECIES_SAMPLED_NEEDS_DETAIL.has(v)) set('bycatch_species_sampled_detail')([]) }} />
      {SPECIES_SAMPLED_NEEDS_DETAIL.has(form.bycatch_species_sampled) && (
        <div className="pl-4 border-l border-[#1e3a5f]">
          <SpeciesSelect label="Specify which bycatch species / groups are sampled"
            value={form.bycatch_species_sampled_detail}
            onChange={set('bycatch_species_sampled_detail')} etp />
        </div>
      )}

      <Radio label="What is the resolution of species identification?"
        options={SPECIES_ID_OPTIONS}
        value={form.species_id_resolution} onChange={set('species_id_resolution')} />

      <Radio label="Are length measurements collected?"
        options={LENGTH_OPTIONS}
        value={form.length_measurements} onChange={set('length_measurements')} />

      <Radio label="Is sex collected?"
        options={SEX_OPTIONS}
        value={form.sex_collected} onChange={set('sex_collected')} />

      <Textarea label="Are any additional characteristics collected?"
        hint="If multiple, please separate with semi-colons (;)"
        value={form.additional_characteristics} onChange={set('additional_characteristics')} rows={2} />

      <Divider label="Review process" />

      <Textarea label="What technical challenges have you encountered during video/image review?"
        value={form.technical_challenges} onChange={set('technical_challenges')} rows={3} />

      <Radio label="Who is doing the primary review?"
        options={PRIMARY_REVIEWER_OPTIONS}
        value={form.primary_reviewer} onChange={set('primary_reviewer')} />

      <Textarea label="Additional information for this section" value={form.sampling_additional_notes}
        onChange={set('sampling_additional_notes')} rows={3}
        placeholder="Please separate distinct items with semi-colons (;) and reference the question number" />
    </div>
  )

  // ── Step: Data Use & AI ───────────────────────────────────────────────────────
  const stepData = (
    <div className="space-y-5">
      <SectionHeader step={hasMedia ? 6 : 5} title="Data Use & Management" />

      <Textarea label="What are the current uses of data collected by the programme?" required
        value={form.data_uses} onChange={set('data_uses')} rows={3} />

      <TriToggle label="Is the data currently used in stock assessments?"
        value={form.used_in_stock_assessment} onChange={set('used_in_stock_assessment')} />
      {form.used_in_stock_assessment && (
        <div className="pl-4 border-l border-[#1e3a5f]">
          <Textarea label="Please give details" value={form.stock_assessment_details}
            onChange={set('stock_assessment_details')} rows={2} />
        </div>
      )}

      <MultiCheckbox label="Who owns the data?" required options={DATA_OWNER_OPTIONS}
        value={form.data_owner} onChange={set('data_owner')} />

      <TriToggle label="Are there any data sharing agreements linked to this programme?" required
        value={form.data_sharing_agreements} onChange={set('data_sharing_agreements')} />

      <MultiCheckbox label="Where is the data held?" required options={DATA_STORAGE_OPTIONS}
        hint="Select all that apply. Project/programme specific = database specific to this programme. EM specific = holds data from multiple EM programmes. National integrated = multiple data sources. Regional integrated = e.g. ICES RDBES."
        value={form.data_storage_location} onChange={set('data_storage_location')} />

      <Textarea label="Is there a limit on how long the data can be stored?"
        hint="Please specify if different between raw and processed data, or different data elements (tabulated data, images, video)"
        value={form.data_retention_limit} onChange={set('data_retention_limit')} rows={2} />

      <Textarea label="Additional information for this section" value={form.data_additional_notes}
        onChange={set('data_additional_notes')} rows={2}
        placeholder="Please separate distinct items with semi-colons (;) and reference the question number" />

      <Divider label="Artificial Intelligence & Machine Learning" />

      <Radio label="Is AI being developed or used in this programme?"
        options={AI_STATUS_OPTIONS}
        value={form.ai_status} onChange={set('ai_status')} />

      {form.ai_status === 'no' && (
        <div className="pl-4 border-l border-[#1e3a5f]">
          <TriToggle label="Is video or imagery being retained from this programme for AI development?"
            hint="If yes, please provide further detail in Additional information"
            value={form.ai_video_retained} onChange={set('ai_video_retained')} />
        </div>
      )}

      {aiActive && (
        <div className="pl-4 border-l border-[#1e3a5f] space-y-4">
          <Textarea label="What is the AI being developed or used for?"
            value={form.ai_applications} onChange={set('ai_applications')} rows={2} />
          <Input label="What are the images of?"
            value={form.ai_image_subjects} onChange={set('ai_image_subjects')} />
          <Radio label="Are the images or code available?"
            hint="Please give more details in Additional information"
            options={AI_ASSETS_OPTIONS}
            value={form.ai_assets_available} onChange={set('ai_assets_available')} />
          <MultiCheckbox label="To which stage of review is AI being applied?"
            hint="Please give more detail on the applications in Additional information"
            options={AI_STAGE_OPTIONS}
            value={form.ai_review_stage} onChange={set('ai_review_stage')} />
          <Input label="Who is the AI developer/provider?"
            value={form.ai_developer} onChange={set('ai_developer')} />
          <Radio label="How many examples are in your training data/image library?"
            options={AI_TRAINING_SIZE_OPTIONS}
            value={form.ai_training_data_size} onChange={set('ai_training_data_size')} />
        </div>
      )}

      <Textarea label="Additional notes" value={form.additional_notes}
        onChange={set('additional_notes')} rows={3}
        placeholder="Any other information, please separate with semi-colons (;) and reference the question number" />
    </div>
  )

  // ── Step: Review & Submit ─────────────────────────────────────────────────────
  const stepSubmit = (
    <div className="space-y-4">
      <SectionHeader step={visibleSteps.length} title="Review & Submit"
        subtitle={mode === 'edit' ? 'Review your changes, then save.' : 'Review your submission, then publish to the map.'} />

      <div className="p-4 rounded border border-[#1e3a5f] text-xs space-y-1.5">
        <div className="grid grid-cols-[140px_1fr] gap-y-1.5">
          <span className="text-slate-500">Programme</span>
          <span className="text-slate-200">{form.programme_name}</span>
          <span className="text-slate-500">Country</span>
          <span className="text-slate-200">{form.country.name || form.country.iso3 || '—'}</span>
          <span className="text-slate-500">Active</span>
          <span className="text-slate-200">{form.is_active === true ? 'Yes' : form.is_active === false ? 'No' : '—'}</span>
          <span className="text-slate-500">Regulation</span>
          <span className="text-slate-200">{form.em_regulation || '—'}</span>
          <span className="text-slate-500">Programme type</span>
          <span className="text-slate-200">{form.programme_type.join(', ') || '—'}</span>
          <span className="text-slate-500">Gear types</span>
          <span className="text-slate-200">{form.gear_types.join(', ') || '—'}</span>
          <span className="text-slate-500">Review model</span>
          <span className="text-slate-200">{form.review_model || '—'}</span>
          <span className="text-slate-500">Video/imagery</span>
          <span className="text-slate-200">
            {form.video_imagery === 'no' ? 'None'
            : form.video_imagery === 'video' ? 'Video'
            : form.video_imagery === 'images' ? 'Still images'
            : form.video_imagery === 'both' ? 'Video and images'
            : '—'}
          </span>
          <span className="text-slate-500">Action</span>
          <span className={mode === 'edit' ? 'text-yellow-400' : 'text-green-400'}>
            {mode === 'edit' ? `Updating: ${duplicateResult?.name ?? form.programme_name}` : 'New programme'}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded border border-red-800 bg-red-900/20 text-xs text-red-300">{error}</div>
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────────
  const stepContent = {
    contact:  stepContact,
    basics:   stepBasics,
    fishery:  stepFishery,
    em:       stepEM,
    sampling: stepSampling,
    data:     stepData,
    submit:   stepSubmit,
  }

  const isLastStep = currentIdx === visibleSteps.length - 1
  const canProceed = stepValid[stepId] ?? true

  // ── Mode selection landing screen ─────────────────────────────────────────────
  if (mode === null) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h2 className="text-lg font-semibold text-white mb-1">Add or edit a programme</h2>
        <p className="text-sm text-slate-400 mb-8">Submit a new EM programme to the GlobalEM inventory, or update an existing entry.</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Add new */}
          <button
            onClick={() => { setMode('add'); setStepId('contact') }}
            className="text-left p-5 rounded-lg border border-[#1e3a5f] bg-[#0d1f3c] hover:border-cyan-600 hover:bg-[#0f2540] transition-colors group"
          >
            <div className="text-2xl mb-3">+</div>
            <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors mb-1">Add a new programme</div>
            <div className="text-xs text-slate-400">Submit an EM programme that is not yet in the inventory.</div>
          </button>

          {/* Edit existing */}
          <button
            onClick={() => setEditExpanded(e => !e)}
            className={`text-left p-5 rounded-lg border transition-colors group ${
              editExpanded
                ? 'border-cyan-600 bg-[#0f2540]'
                : 'border-[#1e3a5f] bg-[#0d1f3c] hover:border-cyan-600 hover:bg-[#0f2540]'
            }`}
          >
            <div className="text-2xl mb-3">✎</div>
            <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors mb-1">Edit an existing programme</div>
            <div className="text-xs text-slate-400">Update or correct information for a programme already in the inventory.</div>
          </button>
        </div>

        {editExpanded && (
          <div className="mt-4 p-4 rounded-lg border border-cyan-800 bg-[#0d1f3c]">
            <p className="text-xs text-slate-400 mb-3">Search for the programme you want to update:</p>
            <ProgramSearch onSelect={selectForEdit} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Mode indicator with back link */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => { setMode(null); setEditExpanded(false) }}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Back to options
        </button>
        <span className="text-xs text-slate-600">·</span>
        <span className="text-xs text-slate-500">
          {mode === 'edit' ? `Editing: ${duplicateResult?.name ?? 'programme'}` : 'New programme'}
        </span>
      </div>

      <StepBar />
      {stepContent[stepId]}

      <div className="flex justify-between mt-8 pt-4 border-t border-[#1e3a5f]">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Back
        </button>

        {!isLastStep ? (
          <button
            onClick={goNext}
            disabled={!canProceed}
            className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded transition-colors"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-green-700 hover:bg-green-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm px-6 py-2 rounded transition-colors"
          >
            {submitting ? 'Submitting…' : mode === 'edit' ? 'Submit update' : 'Submit programme'}
          </button>
        )}
      </div>
    </div>
  )
}
