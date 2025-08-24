// Minimal Express server to handle GitHub OAuth (authorization code + PKCE) and redirect back with token
// Dev-only: stores PKCE/state in cookies and returns token via query param on redirect
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import crypto from 'node:crypto'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// CORS for local dev – front-end runs on vite dev server
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: true }))
app.use(cookieParser())
app.use(express.json())

const CLIENT_ID = process.env.GITHUB_CLIENT_ID
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `http://localhost:${PORT}/api/auth/callback`

if (!CLIENT_ID) {
  console.warn('GITHUB_CLIENT_ID not set. Set it in .env for OAuth to work.')
}
if (!CLIENT_SECRET) {
  console.warn('GITHUB_CLIENT_SECRET not set. Set it in .env for OAuth to work.')
}

function base64UrlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function generatePkcePair() {
  const verifier = base64UrlEncode(crypto.randomBytes(32))
  const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

// Start login: generate state + pkce, set cookies, redirect to GitHub
app.get('/api/auth/login', (req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).json({ error: 'Missing GITHUB_CLIENT_ID on server' })
  }

  const state = base64UrlEncode(crypto.randomBytes(16))
  const { verifier, challenge } = generatePkcePair()

  // Cookies valid for ~10 minutes, lax to allow redirect back
  res.cookie('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 })
  res.cookie('pkce_verifier', verifier, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 })

  const scope = 'read:user repo'
  const allow_signup = 'true'
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    allow_signup,
  })

  const authorizeUrl = `https://github.com/login/oauth/authorize?${params.toString()}`
  res.redirect(authorizeUrl)
})

// OAuth callback: verify state, exchange code for token, then redirect to front-end with token
app.get('/api/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query
    const cookieState = req.cookies['oauth_state']
    const verifier = req.cookies['pkce_verifier']

    if (!code || !state) {
      return res.status(400).send('Missing code or state')
    }
    if (!cookieState || state !== cookieState) {
      return res.status(400).send('Invalid state')
    }
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).send('Server not configured with GitHub OAuth credentials')
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    })
    const tokenJson = await tokenRes.json()
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error('Token exchange failed:', tokenJson)
      return res.status(400).send('Failed to exchange code for token')
    }

    // Clear cookies
    res.clearCookie('oauth_state')
    res.clearCookie('pkce_verifier')

    // Redirect to front-end with token in query param (dev-only)
    const frontendUrl = process.env.APP_BASE_URL || 'http://localhost:5173'
    const redirectTo = `${frontendUrl}/auth/callback?token=${encodeURIComponent(tokenJson.access_token)}`
    return res.redirect(redirectTo)
  } catch (err) {
    console.error('OAuth callback error:', err)
    return res.status(500).send('Internal server error during OAuth callback')
  }
})

// Simple health check
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`Auth server listening on http://localhost:${PORT}`)
})
