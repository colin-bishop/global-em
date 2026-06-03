import React, { useState, useEffect } from 'react'

const API = '/.netlify/functions'

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

function PendingCard({ item, onApprove, onReject, actioning }) {
  const p = item.program
  const busy = actioning === item.prNumber
  return (
    <div className="p-4 rounded-lg border border-[#1e3a5f] bg-[#0d1f3c] space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-white">{p.programme_name}</div>
          <div className="text-xs text-slate-400 mt-0.5 space-x-2">
            {p.country_iso && <span>{p.country_iso}</span>}
            <span>{p.is_active ? 'Active' : 'Inactive'}</span>
            {p.em_regulation && <span>{p.em_regulation.replace('Under Regulation - ', '').replace('Non-Regulation - ', '')}</span>}
            {item.isEdit && <span className="text-yellow-400">Update</span>}
          </div>
          <a
            href={item.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-500 hover:text-cyan-300 mt-1 inline-block"
          >
            PR #{item.prNumber} on GitHub ↗
          </a>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onApprove(item)}
            disabled={busy}
            className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded transition-colors"
          >
            {busy ? '…' : 'Approve'}
          </button>
          <button
            onClick={() => onReject(item)}
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
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(false)
  const [actioning, setActioning] = useState(null)
  const [actionError, setActionError] = useState('')

  const fetchPending = async (pw) => {
    setLoading(true)
    setActionError('')
    try {
      const res = await fetch(`${API}/pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (res.status === 401) {
        setAuthError('Incorrect password.')
        setAuthed(false)
        return
      }
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setPending(await res.json())
      setAuthed(true)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const login = () => {
    setAuthError('')
    fetchPending(password)
  }

  const approve = async (item) => {
    setActioning(item.prNumber)
    setActionError('')
    try {
      const res = await fetch(`${API}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, prNumber: item.prNumber, filePath: item.filePath }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Server error: ${res.status}`)
      setPending(p => p.filter(i => i.prNumber !== item.prNumber))
    } catch (err) {
      setActionError(`Approve failed: ${err.message}`)
    } finally {
      setActioning(null)
    }
  }

  const reject = async (item) => {
    setActioning(item.prNumber)
    setActionError('')
    try {
      const res = await fetch(`${API}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, prNumber: item.prNumber }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Server error: ${res.status}`)
      setPending(p => p.filter(i => i.prNumber !== item.prNumber))
    } catch (err) {
      setActionError(`Reject failed: ${err.message}`)
    } finally {
      setActioning(null)
    }
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
            onChange={e => { setPassword(e.target.value); setAuthError('') }}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Password"
            autoFocus
            className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {authError && <p className="text-xs text-red-400">{authError}</p>}
          <button
            onClick={login}
            disabled={loading}
            className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm py-2 rounded transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
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
            onClick={() => fetchPending(password)}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => { setAuthed(false); setPending([]) }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 px-3 py-2 rounded border border-red-800 bg-red-900/20 text-xs text-red-300">
          {actionError}
        </div>
      )}

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!loading && pending.length === 0 && (
        <div className="py-12 text-center text-slate-500 text-sm">Nothing pending.</div>
      )}

      <div className="space-y-4">
        {pending.map(item => (
          <PendingCard
            key={item.prNumber}
            item={item}
            onApprove={approve}
            onReject={reject}
            actioning={actioning}
          />
        ))}
      </div>
    </div>
  )
}
