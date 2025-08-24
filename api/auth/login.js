// Vercel function for GitHub OAuth login
import crypto from 'node:crypto'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const CLIENT_ID = process.env.GITHUB_CLIENT_ID
  const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI

  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).json({ error: 'OAuth configuration missing' })
  }

  // Generate PKCE challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  const state = crypto.randomBytes(16).toString('hex')

  // Store in secure cookies
  res.setHeader('Set-Cookie', [
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
    `code_verifier=${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
  ])

  const authUrl = new URL('https://github.com/login/oauth/authorize')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', 'public_repo user:email')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  res.redirect(302, authUrl.toString())
}
