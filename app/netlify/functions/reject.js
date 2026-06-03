const { getInstallationToken } = require('./_github-auth')

const REPO           = process.env.GITHUB_REPO || 'colin-bishop/global-em'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const GH             = 'https://api.github.com'

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'GlobalEM-App',
  }
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

  const { prNumber } = body
  if (!prNumber) {
    return { statusCode: 400, body: JSON.stringify({ error: 'prNumber required' }) }
  }

  try {
    const token   = await getInstallationToken()
    const headers = ghHeaders(token)

    const prRes = await fetch(`${GH}/repos/${REPO}/pulls/${prNumber}`, { headers })
    if (!prRes.ok) {
      return { statusCode: 404, body: JSON.stringify({ error: 'PR not found' }) }
    }
    const pr     = await prRes.json()
    const branch = pr.head.ref

    await fetch(`${GH}/repos/${REPO}/pulls/${prNumber}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ state: 'closed' }),
    })

    await fetch(`${GH}/repos/${REPO}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'DELETE', headers,
    })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    }
  } catch (err) {
    console.error('[reject]', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
