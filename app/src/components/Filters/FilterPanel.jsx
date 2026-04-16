import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const EM_REGULATIONS = [
  'Under Regulation - Mandatory',
  'Under Regulation - Optional',
  'Non-Regulation - Voluntary',
  'Other please specify in additional information',
]

const REVIEW_MODELS = [
  'Agency only',
  '3rd party only',
  '3rd party & Agency',
  'Vendor-Agency',
]

// ── Reusable sub-components ──────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div className="text-xs font-semibold text-cyan-500 uppercase tracking-wider pt-3 pb-1">
      {children}
    </div>
  )
}

function TriToggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-300">{label}</span>
      <div className="flex rounded overflow-hidden border border-[#1e3a5f]">
        {[null, true, false].map((v, i) => (
          <button
            key={i}
            onClick={() => onChange(v)}
            className={`text-xs px-2 py-0.5 transition-colors ${
              value === v
                ? 'bg-cyan-700 text-white'
                : 'bg-[#0d1f3c] text-slate-400 hover:text-white'
            }`}
          >
            {v === null ? 'All' : v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )
}

function ChipSelect({ label, options, value, onChange }) {
  const toggle = opt =>
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])

  return (
    <div className="py-1">
      <div className="text-xs text-slate-400 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            title={opt}
            className={`text-xs px-2 py-0.5 rounded border transition-colors leading-snug ${
              value.includes(opt)
                ? 'border-cyan-500 bg-cyan-900/30 text-cyan-300'
                : 'border-[#1e3a5f] text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            {opt.length > 30 ? opt.slice(0, 28) + '…' : opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function FilterPanel({ filters, onFilterChange, onClear }) {
  const [countries, setCountries] = useState([])
  const [gearTypes, setGearTypes] = useState([])
  const [programmeTypes, setProgrammeTypes] = useState([])
  const [totalCount, setTotalCount] = useState(null)

  useEffect(() => {
    // Distinct country codes
    supabase.from('programs').select('country_iso').eq('status', 'approved')
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map(r => r.country_iso).filter(Boolean))].sort()
        setCountries(unique)
      })

    // Distinct gear types (flatten arrays)
    supabase.from('programs').select('gear_types').eq('status', 'approved')
      .then(({ data }) => {
        const all = (data ?? []).flatMap(r => r.gear_types ?? [])
        const unique = [...new Set(all.map(g => g.trim()).filter(Boolean))].sort()
        setGearTypes(unique)
      })

    // Distinct programme types
    supabase.from('programs').select('programme_type').eq('status', 'approved')
      .then(({ data }) => {
        const all = (data ?? []).flatMap(r => r.programme_type ?? [])
        const unique = [...new Set(all.map(t => t.trim()).filter(Boolean))].sort()
        setProgrammeTypes(unique)
      })

    // Total count for display
    supabase.from('programs').select('id', { count: 'exact', head: true }).eq('status', 'approved')
      .then(({ count }) => setTotalCount(count))
  }, [])

  const hasFilters = (
    filters.isActive !== null ||
    filters.fullRem !== null ||
    filters.collectsVideo !== null ||
    filters.aiDevelopment !== null ||
    filters.dcfProgramme !== null ||
    filters.countries.length > 0 ||
    filters.gearTypes.length > 0 ||
    filters.programmeTypes.length > 0 ||
    filters.emRegulation.length > 0 ||
    filters.reviewModel.length > 0
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#1e3a5f]">
        <div>
          <span className="text-sm font-medium text-white">Filters</span>
          {totalCount !== null && (
            <span className="ml-2 text-xs text-slate-500">{totalCount} programmes</span>
          )}
        </div>
        {hasFilters && (
          <button
            onClick={onClear}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Scrollable filter content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 text-sm divide-y divide-[#1e3a5f]">

        <div>
          <SectionLabel>Programme status</SectionLabel>
          <TriToggle label="Active"          value={filters.isActive}      onChange={v => onFilterChange('isActive', v)} />
          <TriToggle label="Full REM"        value={filters.fullRem}       onChange={v => onFilterChange('fullRem', v)} />
          <TriToggle label="Collects video"  value={filters.collectsVideo} onChange={v => onFilterChange('collectsVideo', v)} />
          <TriToggle label="AI component"    value={filters.aiDevelopment} onChange={v => onFilterChange('aiDevelopment', v)} />
          <TriToggle label="DCF programme"   value={filters.dcfProgramme}  onChange={v => onFilterChange('dcfProgramme', v)} />
        </div>

        {countries.length > 0 && (
          <div>
            <SectionLabel>Country</SectionLabel>
            <ChipSelect
              options={countries}
              value={filters.countries}
              onChange={v => onFilterChange('countries', v)}
            />
          </div>
        )}

        <div>
          <SectionLabel>EM regulation</SectionLabel>
          <ChipSelect
            options={EM_REGULATIONS}
            value={filters.emRegulation}
            onChange={v => onFilterChange('emRegulation', v)}
          />
        </div>

        {gearTypes.length > 0 && (
          <div>
            <SectionLabel>Gear type</SectionLabel>
            <ChipSelect
              options={gearTypes}
              value={filters.gearTypes}
              onChange={v => onFilterChange('gearTypes', v)}
            />
          </div>
        )}

        {programmeTypes.length > 0 && (
          <div>
            <SectionLabel>Programme type</SectionLabel>
            <ChipSelect
              options={programmeTypes}
              value={filters.programmeTypes}
              onChange={v => onFilterChange('programmeTypes', v)}
            />
          </div>
        )}

        <div>
          <SectionLabel>Review model</SectionLabel>
          <ChipSelect
            options={REVIEW_MODELS}
            value={filters.reviewModel}
            onChange={v => onFilterChange('reviewModel', v)}
          />
        </div>

        {/* Legend */}
        <div className="pt-3 pb-1">
          <SectionLabel>Regulation legend</SectionLabel>
          {[
            ['#ef4444', 'Mandatory'],
            ['#f59e0b', 'Optional'],
            ['#10b981', 'Voluntary'],
            ['#8b5cf6', 'Other'],
            ['#00b4d8', 'Not specified'],
          ].map(([color, label]) => (
            <div key={label} className="flex items-center gap-2 py-0.5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 text-xs text-slate-600 leading-relaxed">
          EEZ: Marine Regions VLIZ World EEZ v12 · CC BY 4.0
        </div>
      </div>
    </div>
  )
}
