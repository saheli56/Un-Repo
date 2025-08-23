import React, { useState, useEffect } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

const GEMINI_API_KEY = 'gemini_api_key'

interface GeminiSettingsProps {
  onKeyChange?: (hasKey: boolean) => void
}

export const GeminiSettings: React.FC<GeminiSettingsProps> = ({ onKeyChange }) => {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(false)

  useEffect(() => {
    const existingKey = localStorage.getItem(GEMINI_API_KEY)
    if (existingKey) {
      setHasExistingKey(true)
      setApiKey(existingKey)
      onKeyChange?.(true)
    } else {
      onKeyChange?.(false)
    }
  }, [onKeyChange])

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem(GEMINI_API_KEY, apiKey.trim())
      setHasExistingKey(true)
      setSaved(true)
      onKeyChange?.(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleRemove = () => {
    localStorage.removeItem(GEMINI_API_KEY)
    setApiKey('')
    setHasExistingKey(false)
    setSaved(false)
    onKeyChange?.(false)
  }

  const handleKeyChange = (value: string) => {
    setApiKey(value)
    setSaved(false)
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Gemini AI Integration</h3>
        <p className="text-sm text-muted-foreground">
          Configure Google Gemini API for advanced repository analysis and AI-powered insights.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="Enter your Gemini API key..."
                value={apiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                className="pr-20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {!hasExistingKey && (
            <p className="text-xs text-warning">
              Get your free API key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-warning-foreground"
              >
                Google AI Studio
              </a>
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!apiKey.trim() || (hasExistingKey && apiKey === localStorage.getItem(GEMINI_API_KEY))}
            className="flex-1 cursor-pointer hover:scale-105 transition-transform duration-200"
          >
            {saved ? '✓ Saved' : hasExistingKey ? 'Update Key' : 'Save Key'}
          </Button>
          {hasExistingKey && (
            <Button
              variant="outline"
              onClick={handleRemove}
              className="px-4 cursor-pointer hover:scale-105 transition-transform duration-200"
            >
              Remove
            </Button>
          )}
        </div>

        {hasExistingKey && (
          <div className="bg-success-muted border border-success rounded-lg p-3">
            <div className="flex items-center gap-2 text-success-foreground">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span className="text-sm font-medium">AI Analysis Enabled</span>
            </div>
            <p className="text-xs text-success mt-1">
              Repository analysis will include AI-powered insights and explanations.
            </p>
          </div>
        )}

        {!hasExistingKey && (
          <div className="bg-info-muted border border-info rounded-lg p-3">
            <div className="flex items-center gap-2 text-info-foreground">
              <div className="w-2 h-2 bg-info rounded-full"></div>
              <span className="text-sm font-medium">AI Analysis Disabled</span>
            </div>
            <p className="text-xs text-info mt-1">
              Add your API key to enable advanced repository insights and beginner-friendly explanations.
            </p>
          </div>
        )}
      </div>

      <div className="border-t pt-4 space-y-3">
        <h4 className="text-sm font-medium text-foreground">AI Features</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground">Repository Analysis</p>
            <p className="text-muted-foreground">Automatically understand project architecture and purpose</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground">Code Explanations</p>
            <p className="text-muted-foreground">Beginner-friendly explanations of complex code</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground">Tech Stack Detection</p>
            <p className="text-muted-foreground">Identify frameworks, libraries, and patterns</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground">Workflow Visualization</p>
            <p className="text-muted-foreground">Generate visual maps of code relationships</p>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default GeminiSettings
