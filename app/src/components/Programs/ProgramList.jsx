import React from 'react'
import { supabase } from '../../lib/supabase'

const REGULATION_BADGE = {
  'Under Regulation - Mandatory': 'bg-red-900/40 text-red-300 border-red-800',
  'Under Regulation - Optional':  'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  'Non-Regulation - Voluntary':   'bg-green-900/40 text-green-300 border-green-800',
}

export default function ProgramList({ programs, onSelect, onClose }) {
  const handleClick = async (p) => {
    const { data, error } = await supabase.from('programs').select('*').eq('id', p.id).single()
    if (!error && data) onSelect(data)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[#1e3a5f] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          {programs.length} programmes
        </h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xl leading-none transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-[#1e3a5f]">
        {programs.map(p => (
          <button
            key={p.id}
            onClick={() => handleClick(p)}
            className="w-full text-left px-4 py-3 hover:bg-[#1e3a5f]/50 transition-colors group"
          >
            <div className="text-xs font-medium text-white leading-snug group-hover:text-cyan-300 transition-colors">
              {p.programme_name}
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className={`text-xs px-1.5 py-0.5 rounded border ${
                p.is_active
                  ? 'bg-green-900/40 text-green-300 border-green-800'
                  : 'bg-slate-700/30 text-slate-400 border-slate-700'
              }`}>
                {p.is_active ? 'Active' : 'Inactive'}
              </span>
              {p.em_regulation && (
                <span className={`text-xs px-1.5 py-0.5 rounded border ${
                  REGULATION_BADGE[p.em_regulation] ?? 'bg-slate-700/30 text-slate-400 border-slate-700'
                }`}>
                  {p.em_regulation.replace('Under Regulation - ', '').replace('Non-Regulation - ', '')}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
