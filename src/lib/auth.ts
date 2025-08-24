// Frontend auth helpers for GitHub OAuth via our server
export function startGitHubLogin() {
  // Redirect the browser to our server login endpoint
  window.location.href = '/api/auth/login'
}

export function consumeCallbackTokenFromUrl(): string | null {
  const url = new URL(window.location.href)
  const token = url.searchParams.get('token')
  if (token) {
    // Clean the URL
    url.searchParams.delete('token')
    const clean = url.pathname + url.search
    window.history.replaceState({}, '', clean)
    return token
  }
  return null
}
