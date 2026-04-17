import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const VESSEL_BUCKETS = [
  { label: '<5',          max: 4    },
  { label: '5–10',        max: 10   },
  { label: '10–20',       max: 20   },
  { label: '20–50',       max: 50   },
  { label: '50–100',      max: 100  },
  { label: '100–200',     max: 200  },
  { label: '200–500',     max: 500  },
  { label: '500–1,000',   max: 1000 },
  { label: '1,000–2,000', max: 2000 },
  { label: '2,000+',      max: null },
]
function toVesselRange(n) {
  if (!n || n <= 0) return null
  const b = VESSEL_BUCKETS.find(b => b.max == null ? true : n <= b.max)
  return b?.label ?? String(n)
}

const REG_SHORT = {
  'Under Regulation - Mandatory': 'Mandatory',
  'Under Regulation - Optional':  'Optional',
  'Non-Regulation - Voluntary':   'Voluntary',
}
const REG_COLOR = {
  'Under Regulation - Mandatory': 'bg-red-900/40 text-red-300 border-red-800',
  'Under Regulation - Optional':  'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  'Non-Regulation - Voluntary':   'bg-green-900/40 text-green-300 border-green-800',
}

const COLUMNS = [
  { key: 'programme_name',    label: 'Programme'   },
  { key: 'country_iso',       label: 'Country'     },
  { key: 'is_active',         label: 'Active'      },
  { key: 'em_regulation',     label: 'Regulation'  },
  { key: 'programme_type',    label: 'Type'        },
  { key: 'gear_types',        label: 'Gear'        },
  { key: 'fleet_size_em',     label: 'EM Vessels'  },
  { key: 'review_model',      label: 'Review'      },
  { key: 'start_date',        label: 'Start'       },
  { key: 'collects_video',    label: 'Video'       },
  { key: 'ai_in_development', label: 'AI'          },
  { key: 'dcf_programme',     label: 'DCF'         },
]

function sortVal(row, key) {
  const v = row[key]
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 1 : 0
  if (Array.isArray(v)) return v.join(', ')
  return v
}

function Cell({ col, value }) {
  switch (col.key) {
    case 'is_active':
    case 'dcf_programme':
      if (value === null || value === undefined) return <span className="text-slate-600">—</span>
      return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-xs border ${
          value
            ? 'bg-green-900/40 text-green-300 border-green-800'
            : 'bg-slate-700/30 text-slate-400 border-slate-700'
        }`}>{value ? 'Yes' : 'No'}</span>
      )
    case 'em_regulation':
      if (!value) return <span className="text-slate-600">—</span>
      return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-xs border ${REG_COLOR[value] ?? 'bg-slate-700/30 text-slate-400 border-slate-700'}`}>
          {REG_SHORT[value] ?? value}
        </span>
      )
    case 'programme_type':
    case 'gear_types':
      if (!value?.length) return <span className="text-slate-600">—</span>
      return <span className="text-slate-300">{value.join(', ')}</span>
    case 'fleet_size_em':
      return <span className="text-slate-300">{toVesselRange(value) ?? '—'}</span>
    case 'start_date':
      return <span className="text-slate-300">{value ? value.slice(0, 4) : '—'}</span>
    case 'collects_video':
    case 'ai_in_development':
      return <span className={value ? 'text-cyan-400' : 'text-slate-600'}>{value ? '✓' : '—'}</span>
    default:
      return <span className="text-slate-200">{value ?? '—'}</span>
  }
}

export default function TableView({ filters, onSelectProgram }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState('programme_name')
  const [sortDir, setSortDir] = useState('asc')

  const fetchData = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('programs')
      .select('id, programme_name, country_iso, is_active, em_regulation, programme_type, gear_types, fleet_size_em, review_model, start_date, collects_video, ai_in_development, dcf_programme')
      .eq('status', 'approved')

    if (filters.isActive !== null)      q = q.eq('is_active', filters.isActive)
    if (filters.countries?.length)      q = q.in('country_iso', filters.countries)
    if (filters.emRegulation?.length)   q = q.in('em_regulation', filters.emRegulation)
    if (filters.fullRem !== null)       q = q.eq('full_rem_coverage', filters.fullRem)
    if (filters.collectsVideo !== null) q = q.eq('collects_video', filters.collectsVideo)
    if (filters.aiDevelopment !== null) q = q.eq('ai_in_development', filters.aiDevelopment)
    if (filters.dcfProgramme !== null)  q = q.eq('dcf_programme', filters.dcfProgramme)
    if (filters.reviewModel?.length)    q = q.in('review_model', filters.reviewModel)
    if (filters.gearTypes?.length)      q = q.overlaps('gear_types', filters.gearTypes)
    if (filters.programmeTypes?.length) q = q.overlaps('programme_type', filters.programmeTypes)

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const handleRowClick = async (row) => {
    const { data } = await supabase.from('programs').select('*').eq('id', row.id).single()
    if (data) onSelectProgram(data)
  }

  const filtered = rows.filter(r =>
    !search || r.programme_name?.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    const av = sortVal(a, sortKey)
    const bv = sortVal(b, sortKey)
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#1e3a5f] flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search programmes…"
          className="bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-60"
        />
        <span className="text-xs text-slate-500">
          {loading ? 'Loading…' : `${sorted.length} programme${sorted.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-[#0a1628] z-10">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="text-left px-3 py-2.5 font-semibold text-slate-400 border-b border-[#1e3a5f] cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1 text-cyan-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.id}
                onClick={() => handleRowClick(row)}
                className={`cursor-pointer border-b border-[#1e3a5f]/40 hover:bg-[#0d1f3c] transition-colors ${
                  i % 2 === 1 ? 'bg-[#0d1f3c]/20' : ''
                }`}
              >
                {COLUMNS.map(col => (
                  <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                    <Cell col={col} value={row[col.key]} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-12 text-center text-sm text-slate-500">
                  No programmes match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
