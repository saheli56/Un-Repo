import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GitHubAPI } from '@/lib/github-api'
import { CacheManagement } from './CacheManagement'
import { Settings, Key, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

interface GitHubSettingsProps {
  onClose?: () => void
}

export function GitHubSettings({ onClose }: GitHubSettingsProps) {
  const [token, setToken] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean
    message: string
    rateLimit?: { limit: number; remaining: number; reset: number }
  } | null>(null)
  const [activeInteractiveView, setActiveInteractiveView] = useState<'tree' | 'network' | 'architecture'>('tree')

  useEffect(() => {
    // Load existing token
    const existingToken = GitHubAPI.getToken()
    if (existingToken) {
      setToken(existingToken)
      validateToken(existingToken)
    } else {
      // Check current rate limit without token
      checkRateLimit()
    }
  }, [])

  const checkRateLimit = async () => {
    const response = await GitHubAPI.getRateLimit()
    if (response.data) {
      setValidationResult({
        isValid: false,
        message: `Unauthenticated: ${response.data.rate.remaining}/${response.data.rate.limit} requests remaining`,
        rateLimit: response.data.rate
      })
    }
  }

  const validateToken = async (tokenToValidate: string) => {
    setIsValidating(true)
    setValidationResult(null)

    // Temporarily set the token to test it
    const originalToken = GitHubAPI.getToken()
    GitHubAPI.setToken(tokenToValidate)

    try {
      const response = await GitHubAPI.getRateLimit()
      if (response.data) {
        setValidationResult({
          isValid: true,
          message: `Authenticated: ${response.data.rate.remaining}/${response.data.rate.limit} requests remaining`,
          rateLimit: response.data.rate
        })
      } else {
        setValidationResult({
          isValid: false,
          message: response.error || 'Invalid token'
        })
        // Restore original token on failure
        GitHubAPI.setToken(originalToken)
      }
    } catch (error: unknown) {
      console.error('Token validation error:', error)
      setValidationResult({
        isValid: false,
        message: 'Failed to validate token'
      })
      // Restore original token on failure
      GitHubAPI.setToken(originalToken)
    } finally {
      setIsValidating(false)
    }
  }

  const handleSaveToken = () => {
    if (token.trim()) {
      validateToken(token.trim())
    } else {
      GitHubAPI.setToken(null)
      setValidationResult(null)
      checkRateLimit()
    }
  }

  const handleRemoveToken = () => {
    setToken('')
    GitHubAPI.setToken(null)
    setValidationResult(null)
    checkRateLimit()
  }

  const formatResetTime = (resetTimestamp: number) => {
    const resetTime = new Date(resetTimestamp * 1000)
    const now = new Date()
    const diffMinutes = Math.ceil((resetTime.getTime() - now.getTime()) / (1000 * 60))
    
    if (diffMinutes <= 0) {
      return 'Now'
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minutes`
    } else {
      const hours = Math.floor(diffMinutes / 60)
      const minutes = diffMinutes % 60
      return `${hours}h ${minutes}m`
    }
  }

  const handleInteractiveViewChange = (view: 'tree' | 'network' | 'architecture') => {
    setActiveInteractiveView(view)
  }

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            GitHub API Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Add a GitHub Personal Access Token to increase your API rate limit from 60 to 5000 requests per hour.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current Rate Limit Status */}
          {validationResult && (
            <div className={`p-3 rounded-md border ${validationResult.isValid ? 'bg-success-muted border-success' : 'bg-warning-muted border-warning'}`}>
              <div className="flex items-center gap-2">
                {validationResult.isValid ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-warning" />
                )}
                <span className="text-sm font-medium">{validationResult.message}</span>
              </div>
              {validationResult.rateLimit && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Rate limit resets in: {formatResetTime(validationResult.rateLimit.reset)}
                </div>
              )}
            </div>
          )}

          {/* Token Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Personal Access Token
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="font-mono"
              />
              <Button 
                onClick={handleSaveToken} 
                disabled={isValidating}
                variant={token.trim() ? "default" : "secondary"}
              >
                {isValidating ? 'Validating...' : token.trim() ? 'Save' : 'Remove'}
              </Button>
              {token.trim() && (
                <Button 
                  onClick={handleRemoveToken} 
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3 text-sm">
            <h4 className="font-medium">How to create a GitHub Personal Access Token:</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Go to GitHub Settings → Developer settings → Personal access tokens</li>
              <li>Click "Generate new token (classic)"</li>
              <li>Give it a name like "StatusCode App"</li>
              <li>Select scopes: <code className="bg-muted px-1 rounded">public_repo</code> (for public repositories)</li>
              <li>Click "Generate token" and copy the token</li>
              <li>Paste it above and click "Save"</li>
            </ol>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => window.open('https://github.com/settings/tokens', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Create Token on GitHub
            </Button>
          </div>

          {/* Security Note */}
          <div className="p-3 bg-info-muted border border-info rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-info mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-info-foreground">Security Note</p>
                <p className="text-info mt-1">
                  Your token is stored locally in your browser and never sent to any server except GitHub's API.
                  You can remove it anytime by clicking "Clear" above.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Tab Buttons - Added Section */}
          <div className="flex space-x-2">
            <Button
              variant={activeInteractiveView === 'tree' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleInteractiveViewChange('tree')}
              className={`cursor-pointer hover:scale-105 transition-transform duration-200 ${activeInteractiveView === 'tree' ? 'border-b-2 border-primary' : ''}`}
            >
              Tree View
            </Button>
            <Button
              variant={activeInteractiveView === 'network' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleInteractiveViewChange('network')}
              className={`cursor-pointer hover:scale-105 transition-transform duration-200 ${activeInteractiveView === 'network' ? 'border-b-2 border-primary' : ''}`}
            >
              Network View
            </Button>
            <Button
              variant={activeInteractiveView === 'architecture' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleInteractiveViewChange('architecture')}
              className={`cursor-pointer hover:scale-105 transition-transform duration-200 ${activeInteractiveView === 'architecture' ? 'border-b-2 border-primary' : ''}`}
            >
              Architecture
            </Button>
          </div>

          {onClose && (
            <div className="flex justify-end pt-4">
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cache Management */}
      <CacheManagement />
    </div>
  )
}
