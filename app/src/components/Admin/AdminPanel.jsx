import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

function Field({ label, value }) {
  if (!value && value !== false) return null
  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300">
        {Array.isArray(value) ? value.join(', ') : String(value)}
      </span>
    </>
  )
}

function PendingCard({ program: p, onApprove, onReject, actioning }) {
  const busy = actioning === p.id
  return (
    <div className="p-4 rounded-lg border border-[#1e3a5f] bg-[#0d1f3c] space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-white">{p.programme_name}</div>
          <div className="text-xs text-slate-400 mt-0.5 space-x-2">
            {p.country_iso && <span>{p.country_iso}</span>}
            <span>{p.is_active ? 'Active' : 'Inactive'}</span>
            {p.em_regulation && <span>{p.em_regulation.replace('Under Regulation - ', '').replace('Non-Regulation - ', '')}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onApprove(p.id)}
            disabled={busy}
            className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded transition-colors"
          >
            {busy ? '…' : 'Approve'}
          </button>
          <button
            onClick={() => onReject(p.id)}
            disabled={busy}
            className="border border-red-800 bg-red-900/30 hover:bg-red-900/60 disabled:opacity-40 text-red-300 text-xs px-3 py-1.5 rounded transition-colors"
          >
            {busy ? '…' : 'Reject'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <Field label="Organisations" value={p.organizations} />
        <Field label="Gear types" value={p.gear_types} />
        <Field label="Programme type" value={p.programme_type} />
        <Field label="Contact" value={p.primary_contact} />
        <Field label="Contact email" value={p.primary_contact_email} />
        <Field label="Areas" value={p.areas_of_operation} />
        {p.objectives && (
          <>
            <span className="text-slate-500">Objectives</span>
            <span className="text-slate-300">{p.objectives.length > 140 ? p.objectives.slice(0, 140) + '…' : p.objectives}</span>
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('glem_admin') === '1')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(false)

  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(false)
  const [actioning, setActioning] = useState(null)

  const login = () => {
    if (!ADMIN_PASSWORD || password === ADMIN_PASSWORD) {
      sessionStorage.setItem('glem_admin', '1')
      setAuthed(true)
      setAuthError(false)
    } else {
      setAuthError(true)
    }
  }

  const fetchPending = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('status', 'pending')
    if (!error) setPending(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (authed) fetchPending()
  }, [authed])

  const approve = async (id) => {
    setActioning(id)
    await supabase.from('programs').update({ status: 'approved' }).eq('id', id)
    setPending(p => p.filter(r => r.id !== id))
    setActioning(null)
  }

  const reject = async (id) => {
    setActioning(id)
    await supabase.from('programs').delete().eq('id', id)
    setPending(p => p.filter(r => r.id !== id))
    setActioning(null)
  }

  // ── Password gate ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-6 py-20">
        <h2 className="text-lg font-semibold text-white mb-1">Admin</h2>
        <p className="text-sm text-slate-400 mb-6">Sign in to review pending submissions.</p>
        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setAuthError(false) }}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Password"
            autoFocus
            className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {authError && <p className="text-xs text-red-400">Incorrect password.</p>}
          <button
            onClick={login}
            className="w-full bg-cyan-700 hover:bg-cyan-600 text-white text-sm py-2 rounded transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  // ── Queue ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Pending submissions</h2>
          {!loading && (
            <p className="text-xs text-slate-400 mt-0.5">
              {pending.length === 0 ? 'Queue is empty.' : `${pending.length} awaiting review`}
            </p>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={fetchPending}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => { sessionStorage.removeItem('glem_admin'); setAuthed(false) }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!loading && pending.length === 0 && (
        <div className="py-12 text-center text-slate-500 text-sm">Nothing pending.</div>
      )}

      <div className="space-y-4">
        {pending.map(p => (
          <PendingCard
            key={p.id}
            program={p}
            onApprove={approve}
            onReject={reject}
            actioning={actioning}
          />
        ))}
      </div>
    </div>
  )
}
