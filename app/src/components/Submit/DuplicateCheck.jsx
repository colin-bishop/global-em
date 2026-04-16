import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

function score(candidate, name, country, gearTypes, startYear) {
  let s = 0
  const cName = (candidate.programme_name ?? '').toLowerCase()
  const qName = (name ?? '').toLowerCase()

  // Name similarity (simple: shared significant words)
  const words = qName.split(/\W+/).filter(w => w.length > 3)
  const matches = words.filter(w => cName.includes(w))
  if (matches.length > 0) s += Math.round((matches.length / Math.max(words.length, 1)) * 60)

  // Country match
  if (country && candidate.country_iso === country) s += 20

  // Gear overlap
  const cGear = candidate.gear_types ?? []
  const overlap = (gearTypes ?? []).filter(g => cGear.includes(g))
  if (overlap.length > 0) s += 10

  // Year proximity
  if (startYear && candidate.start_date) {
    const cy = new Date(candidate.start_date).getFullYear()
    if (Math.abs(cy - startYear) <= 2) s += 10
  }

  return s
}

export default function DuplicateCheck({ programmeName, country, gearTypes, startYear, onResult }) {
  const [candidates, setCandidates] = useState(null)
  const [loading, setLoading] = useState(false)
  const [choice, setChoice] = useState(null) // null | 'new' | {id, name}

  useEffect(() => {
    if (!programmeName || programmeName.length < 4) return

    setLoading(true)
    setCandidates(null)
    setChoice(null)

    const run = async () => {
      let q = supabase.from('programs').select(
        'id, programme_name, country_iso, start_date, is_active, em_regulation, gear_types, fleet_size_total'
      ).eq('status', 'approved')

      if (country) q = q.eq('country_iso', country)

      const { data } = await q
      const scored = (data ?? [])
        .map(c => ({ ...c, _score: score(c, programmeName, country, gearTypes, startYear) }))
        .filter(c => c._score >= 20)
        .sort((a, b) => b._score - a._score)
        .slice(0, 5)

      setCandidates(scored)
      setLoading(false)
    }
    run()
  }, [programmeName, country, gearTypes, startYear])

  const handleChoice = (val) => {
    setChoice(val)
    onResult(val)
  }

  if (loading) {
    return (
      <div className="text-xs text-slate-400 py-2 flex items-center gap-2">
        <span className="animate-spin inline-block w-3 h-3 border border-cyan-500 border-t-transparent rounded-full" />
        Checking for existing programmes…
      </div>
    )
  }

  if (!candidates || candidates.length === 0) {
    return (
      <div className="text-xs text-green-400 py-2">
        No similar programmes found — this appears to be new.
      </div>
    )
  }

  return (
    <div className="mt-3 p-3 rounded border border-yellow-800 bg-yellow-900/20">
      <p className="text-xs font-semibold text-yellow-300 mb-2">
        {candidates.length} similar programme{candidates.length > 1 ? 's' : ''} already in the database.
        Is this a new entry, or an update to one of these?
      </p>

      <div className="space-y-2 mb-3">
        {candidates.map(c => (
          <button
            key={c.id}
            onClick={() => handleChoice({ id: c.id, name: c.programme_name })}
            className={`w-full text-left rounded border p-2 text-xs transition-colors ${
              choice?.id === c.id
                ? 'border-cyan-500 bg-cyan-900/30 text-white'
                : 'border-[#1e3a5f] text-slate-300 hover:border-slate-500'
            }`}
          >
            <div className="font-medium">{c.programme_name}</div>
            <div className="text-slate-400 mt-0.5">
              {[
                c.country_iso,
                c.is_active ? 'Active' : 'Inactive',
                c.em_regulation?.replace('Under Regulation - ', '').replace('Non-Regulation - ', ''),
                c.fleet_size_total ? `${c.fleet_size_total} vessels` : null,
              ].filter(Boolean).join(' · ')}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => handleChoice('new')}
        className={`w-full rounded border p-2 text-xs transition-colors ${
          choice === 'new'
            ? 'border-green-500 bg-green-900/30 text-green-300'
            : 'border-[#1e3a5f] text-slate-400 hover:border-slate-500 hover:text-white'
        }`}
      >
        This is a new programme (not an update to any of the above)
      </button>
    </div>
  )
}
