import React, { useState, useEffect } from 'react'
import { fetchPrograms } from '../../lib/programs'
import SCHEMA from '../../form-schema.json'

const API = '/.netlify/functions'

// ── Field label lookup from schema ────────────────────────────────────────────
const FIELD_LABELS = {}
for (const f of SCHEMA.fields) {
  if (!f.db_column) continue
  const cols = Array.isArray(f.db_column) ? f.db_column : [f.db_column]
  for (const col of cols) {
    if (!FIELD_LABELS[col]) FIELD_LABELS[col] = f.label
  }
}
// Extras not in schema
FIELD_LABELS.contacts           = 'Contacts'
FIELD_LABELS.submitter_name     = 'Submitted by'
FIELD_LABELS.submitter_email    = 'Submitter email'
FIELD_LABELS.submitter_organization = 'Submitter org'

// Fields to skip in detail/diff views (system-managed)
const SKIP_FIELDS = new Set([
  'id', 'status', 'latitude', 'longitude', 'submitted_at', 'approved_at',
  'country_raw', 'is_update', 'existing_program_id', 'reviewer_notes',
])

// ── Value formatting ──────────────────────────────────────────────────────────
function formatValue(val) {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (Array.isArray(val)) {
    if (val.length === 0) return null
    // Contact objects
    if (typeof val[0] === 'object' && val[0]?.name !== undefined) {
      return val.map(c => [c.name, c.email, c.phone].filter(Boolean).join(' · ')).join('\n')
    }
    return val.join(', ')
  }
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ── Diff view (updates) ───────────────────────────────────────────────────────
function DiffView({ submission, current }) {
  const allKeys = new Set([
    ...Object.keys(submission),
    ...Object.keys(current || {}),
  ])

  const changed = []
  const unchanged = []

  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key)) continue
    const label = FIELD_LABELS[key]
    if (!label) continue // unknown system field

    const newVal = formatValue(submission[key])
    const oldVal = formatValue(current?.[key])

    if (newVal === null && oldVal === null) continue
    if (valuesEqual(submission[key], current?.[key])) {
      unchanged.push({ key, label, val: newVal ?? oldVal })
    } else {
      changed.push({ key, label, oldVal, newVal })
    }
  }

  return (
    <div className="mt-3 space-y-4">
      {changed.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">
            Changed fields ({changed.length})
          </div>
          <div className="space-y-2">
            {changed.map(({ key, label, oldVal, newVal }) => (
              <div key={key} className="rounded border border-[#1e3a5f] overflow-hidden text-xs">
                <div className="px-3 py-1 bg-[#0a1628] text-slate-400 font-medium border-b border-[#1e3a5f]">
                  {label}
                </div>
                <div className="grid grid-cols-2 divide-x divide-[#1e3a5f]">
                  <div className="px-3 py-2 bg-red-950/20">
                    <div className="text-red-400 text-[10px] uppercase tracking-wide mb-0.5">Before</div>
                    <div className="text-slate-300 whitespace-pre-wrap">{oldVal ?? <span className="text-slate-600 italic">empty</span>}</div>
                  </div>
                  <div className="px-3 py-2 bg-green-950/20">
                    <div className="text-green-400 text-[10px] uppercase tracking-wide mb-0.5">After</div>
                    <div className="text-slate-200 whitespace-pre-wrap">{newVal ?? <span className="text-slate-600 italic">cleared</span>}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unchanged.length > 0 && (
        <details className="group">
          <summary className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none">
            {unchanged.length} unchanged fields
          </summary>
          <div className="mt-2 grid grid-cols-[160px_1fr] gap-x-4 gap-y-1 text-xs pl-2">
            {unchanged.map(({ key, label, val }) => (
              <React.Fragment key={key}>
                <span className="text-slate-500 pt-0.5 truncate">{label}</span>
                <span className="text-slate-400 whitespace-pre-wrap">{val}</span>
              </React.Fragment>
            ))}
          </div>
        </details>
      )}

      {changed.length === 0 && (
        <p className="text-xs text-slate-500 italic">No field differences detected.</p>
      )}
    </div>
  )
}

// ── Full detail view (new submissions) ────────────────────────────────────────
function FullDetailView({ submission }) {
  const submitterFields = ['submitter_name', 'submitter_email', 'submitter_organization']
  const programFields = Object.keys(submission).filter(
    k => !SKIP_FIELDS.has(k) && !submitterFields.includes(k) && FIELD_LABELS[k]
  )

  return (
    <div className="mt-3 space-y-4">
      {/* Submitter */}
      <div>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Submitted by
        </div>
        <div className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-1 text-xs">
          {submitterFields.map(key => {
            const val = formatValue(submission[key])
            if (!val) return null
            return (
              <React.Fragment key={key}>
                <span className="text-slate-500 pt-0.5">{FIELD_LABELS[key]}</span>
                <span className="text-slate-300">{val}</span>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Programme fields */}
      <div>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Programme details
        </div>
        <div className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-1.5 text-xs">
          {programFields.map(key => {
            const val = formatValue(submission[key])
            if (!val) return null
            return (
              <React.Fragment key={key}>
                <span className="text-slate-500 pt-0.5 truncate">{FIELD_LABELS[key]}</span>
                <span className="text-slate-300 whitespace-pre-wrap break-words">{val}</span>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Pending card ──────────────────────────────────────────────────────────────
function PendingCard({ item, currentProgram, onApprove, onReject, actioning }) {
  const [expanded, setExpanded] = useState(false)
  const p = item.program
  const busy = actioning === item.prNumber

  return (
    <div className="rounded-lg border border-[#1e3a5f] bg-[#0d1f3c] overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{p.programme_name}</span>
            {item.isEdit
              ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-300 border border-yellow-800">Update</span>
              : <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-800">New</span>
            }
          </div>
          <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
            {p.country_iso && <span>{p.country_iso}</span>}
            {p.em_regulation && <span>{p.em_regulation.replace('Under Regulation - ', '').replace('Non-Regulation - ', '')}</span>}
            <span className="text-slate-600">PR #{item.prNumber} · {new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-slate-400 hover:text-white border border-[#1e3a5f] hover:border-slate-500 rounded px-2 py-1 transition-colors"
          >
            {expanded ? 'Hide details' : 'View details'}
          </button>
          <a
            href={item.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-600 hover:text-cyan-400 border border-[#1e3a5f] hover:border-cyan-800 rounded px-2 py-1 transition-colors"
          >
            PR ↗
          </a>
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

      {/* Expandable detail */}
      {expanded && (
        <div className="border-t border-[#1e3a5f] px-4 pb-4 max-h-[60vh] overflow-y-auto">
          {item.isEdit
            ? <DiffView submission={p} current={currentProgram} />
            : <FullDetailView submission={p} />
          }
        </div>
      )}
    </div>
  )
}

// ── Admin panel ───────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [authed, setAuthed]         = useState(false)
  const [password, setPassword]     = useState('')
  const [authError, setAuthError]   = useState('')
  const [pending, setPending]       = useState([])
  const [programs, setPrograms]     = useState([])
  const [loading, setLoading]       = useState(false)
  const [actioning, setActioning]   = useState(null)
  const [actionError, setActionError] = useState('')

  // Pre-load programmes for diff lookup
  useEffect(() => {
    fetchPrograms().then(setPrograms).catch(() => {})
  }, [])

  const fetchPending = async (pw) => {
    setLoading(true)
    setActionError('')
    try {
      const res = await fetch(`${API}/pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (res.status === 401) { setAuthError('Incorrect password.'); setAuthed(false); return }
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setPending(await res.json())
      setAuthed(true)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const login = () => { setAuthError(''); fetchPending(password) }

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

  // ── Password gate ────────────────────────────────────────────────────────────
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

  // ── Queue ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
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
          <button onClick={() => fetchPending(password)} className="text-xs text-slate-400 hover:text-white transition-colors">
            Refresh
          </button>
          <button onClick={() => { setAuthed(false); setPending([]) }} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
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
            currentProgram={programs.find(p => p.id === item.program.id)}
            onApprove={approve}
            onReject={reject}
            actioning={actioning}
          />
        ))}
      </div>
    </div>
  )
}
