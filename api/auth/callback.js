// Vercel function for GitHub OAuth callback
import crypto from 'node:crypto'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, state } = req.query
  const cookies = parseCookies(req.headers.cookie || '')
  const storedState = cookies.oauth_state
  const codeVerifier = cookies.code_verifier

  // Validate state and PKCE
  if (!code || !state || state !== storedState || !codeVerifier) {
    return res.redirect(`${process.env.APP_BASE_URL}?error=oauth_failed`)
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        code_verifier: codeVerifier,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('GitHub token error:', tokenData)
      return res.redirect(`${process.env.APP_BASE_URL}?error=token_failed`)
    }

    // Clear auth cookies and redirect with token
    res.setHeader('Set-Cookie', [
      'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/',
      'code_verifier=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/'
    ])

    const redirectUrl = `${process.env.APP_BASE_URL}/auth/callback?token=${tokenData.access_token}`
    res.redirect(302, redirectUrl)

  } catch (error) {
    console.error('OAuth callback error:', error)
    res.redirect(`${process.env.APP_BASE_URL}?error=server_error`)
  }
}

function parseCookies(cookieHeader) {
  const cookies = {}
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=')
    if (name && value) cookies[name] = value
  })
  return cookies
}
