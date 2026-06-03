const { createSign } = require('crypto')

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function createAppJWT() {
  const appId  = process.env.GITHUB_APP_ID
  const rawKey = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!appId || !rawKey) throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set')

  const now     = Math.floor(Date.now() / 1000)
  const header  = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const payload = base64url(Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId })))
  const data    = `${header}.${payload}`
  const sig     = base64url(createSign('RSA-SHA256').update(data).sign(rawKey))
  return `${data}.${sig}`
}

async function getInstallationToken() {
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID
  if (!installationId) throw new Error('GITHUB_APP_INSTALLATION_ID must be set')

  const jwt = createAppJWT()
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GlobalEM-App',
      },
    }
  )
  if (!res.ok) throw new Error(`GitHub App auth failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.token
}

module.exports = { getInstallationToken }
