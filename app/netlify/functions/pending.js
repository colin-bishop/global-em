const { getInstallationToken } = require('./_github-auth')

const REPO           = process.env.GITHUB_REPO || 'colin-bishop/global-em'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const GH             = 'https://api.github.com'

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GlobalEM-App',
  }
}

exports.handler = async (event) => {
  const password = event.httpMethod === 'POST'
    ? JSON.parse(event.body || '{}').password
    : event.queryStringParameters?.password

  if (ADMIN_PASSWORD && password !== ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  try {
    const token   = await getInstallationToken()
    const headers = ghHeaders(token)

    const res = await fetch(`${GH}/repos/${REPO}/pulls?state=open&per_page=100`, { headers })
    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: `GitHub API error: ${res.status}` }) }
    }

    const prs = await res.json()
    const submissionPRs = prs.filter(pr => pr.body?.includes('<!-- submission-file:'))

    const pending = await Promise.all(submissionPRs.map(async pr => {
      const match = pr.body.match(/<!-- submission-file: (data\/submissions\/[^\s>]+\.json) -->/)
      if (!match) return null
      const filePath = match[1]
      const branch   = pr.head.ref
      try {
        const fileRes = await fetch(
          `${GH}/repos/${REPO}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
          { headers }
        )
        if (!fileRes.ok) return null
        const fileData = await fileRes.json()
        const program  = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'))
        return { prNumber: pr.number, prUrl: pr.html_url, branch, filePath, createdAt: pr.created_at, isEdit: pr.title.startsWith('Update:'), program }
      } catch {
        return null
      }
    }))

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pending.filter(Boolean)),
    }
  } catch (err) {
    console.error('[pending]', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
