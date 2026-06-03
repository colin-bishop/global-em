const { randomUUID } = require('crypto')
const { getInstallationToken } = require('./_github-auth')

const REPO = process.env.GITHUB_REPO || 'colin-bishop/global-em'
const GH   = 'https://api.github.com'

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
  if (!res.ok) throw new Error(`GitHub GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function ghPost(token, path, body) {
  const res = await fetch(`${GH}${path}`, { method: 'POST', headers: ghHeaders(token), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`GitHub POST ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function ghPut(token, path, body) {
  const res = await fetch(`${GH}${path}`, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`GitHub PUT ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  let submission
  try {
    submission = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  try {
    const token  = await getInstallationToken()
    const isEdit = Boolean(submission.id)
    const id     = submission.id || randomUUID()
    const submissionData = { ...submission, id, submitted_at: new Date().toISOString() }
    const filePath = `data/submissions/${id}.json`

    const refData = await ghGet(token, `/repos/${REPO}/git/refs/heads/main`)
    const mainSha = refData.object.sha

    const slug      = (submission.programme_name || 'program')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    const branchId  = randomUUID().slice(0, 8)
    const branch    = `submissions/${slug}-${branchId}`

    await ghPost(token, `/repos/${REPO}/git/refs`, { ref: `refs/heads/${branch}`, sha: mainSha })

    // File may already exist on the branch (inherited from main if editing a previously
    // submitted programme). GitHub requires the current SHA to overwrite an existing file.
    let existingSha = null
    try {
      const existing = await ghGet(token, `/repos/${REPO}/contents/${filePath}?ref=${encodeURIComponent(branch)}`)
      existingSha = existing.sha
    } catch { /* file doesn't exist yet — fine for new submissions */ }

    await ghPut(token, `/repos/${REPO}/contents/${filePath}`, {
      message: `${isEdit ? 'Update' : 'Add'} submission: ${submission.programme_name || 'unnamed'}`,
      content: Buffer.from(JSON.stringify(submissionData, null, 2)).toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    })

    const name    = submission.programme_name || 'Unnamed Programme'
    const country = submission.country_iso || 'Unknown'
    const prBody  = [
      `**Programme:** ${name}`,
      `**Country:** ${country}`,
      submission.primary_contact       ? `**Contact:** ${submission.primary_contact}`     : null,
      submission.primary_contact_email ? `**Email:** ${submission.primary_contact_email}` : null,
      isEdit ? `**Type:** Update to existing programme` : null,
      '', '---',
      `<!-- submission-file: ${filePath} -->`,
    ].filter(x => x !== null).join('\n')

    const pr = await ghPost(token, `/repos/${REPO}/pulls`, {
      title: `${isEdit ? 'Update' : 'Submission'}: ${name} (${country})`,
      body: prBody,
      head: branch,
      base: 'main',
    })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, prNumber: pr.number, prUrl: pr.html_url }),
    }
  } catch (err) {
    console.error('[submit]', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
