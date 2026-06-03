const { getInstallationToken } = require('./_github-auth')

const REPO           = process.env.GITHUB_REPO || 'colin-bishop/global-em'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const PROGRAMS_PATH  = 'data/programs.json'
const GH             = 'https://api.github.com'

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'GlobalEM-App',
  }
}

async function ghGet(token, path) {
  const res = await fetch(`${GH}${path}`, { headers: ghHeaders(token) })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function ghPut(token, path, body) {
  const res = await fetch(`${GH}${path}`, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function ghDelete(token, path, body) {
  const res = await fetch(`${GH}${path}`, { method: 'DELETE', headers: ghHeaders(token), body: JSON.stringify(body) })
  if (!res.ok && res.status !== 404) throw new Error(`DELETE ${path} → ${res.status}`)
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  if (ADMIN_PASSWORD && body.password !== ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const { prNumber, filePath } = body
  if (!prNumber || !filePath) {
    return { statusCode: 400, body: JSON.stringify({ error: 'prNumber and filePath required' }) }
  }

  try {
    const token  = await getInstallationToken()
    const pr     = await ghGet(token, `/repos/${REPO}/pulls/${prNumber}`)
    const branch = pr.head.ref

    const fileData   = await ghGet(token, `/repos/${REPO}/contents/${filePath}?ref=${encodeURIComponent(branch)}`)
    const submission = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'))

    const mergeRes = await fetch(`${GH}/repos/${REPO}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      headers: ghHeaders(token),
      body: JSON.stringify({
        merge_method: 'squash',
        commit_title: `Approve: ${submission.programme_name || 'Programme'} (${submission.country_iso || ''})`,
      }),
    })
    if (!mergeRes.ok) {
      const err = await mergeRes.json()
      return { statusCode: 502, body: JSON.stringify({ error: `Merge failed: ${err.message}` }) }
    }

    const programsFile = await ghGet(token, `/repos/${REPO}/contents/${PROGRAMS_PATH}`)
    const programs     = JSON.parse(Buffer.from(programsFile.content, 'base64').toString('utf8'))
    const approved     = { ...submission, status: 'approved', approved_at: new Date().toISOString() }
    const updated      = [...programs.filter(p => p.id !== approved.id), approved]

    await ghPut(token, `/repos/${REPO}/contents/${PROGRAMS_PATH}`, {
      message: `Approve programme: ${submission.programme_name || 'unnamed'}`,
      content: Buffer.from(JSON.stringify(updated, null, 2)).toString('base64'),
      sha: programsFile.sha,
    })

    try {
      const submissionOnMain = await ghGet(token, `/repos/${REPO}/contents/${filePath}`)
      await ghDelete(token, `/repos/${REPO}/contents/${filePath}`, {
        message: 'Remove processed submission',
        sha: submissionOnMain.sha,
      })
    } catch { /* non-fatal */ }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    }
  } catch (err) {
    console.error('[approve]', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
