import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GitHubRepo, FileNode } from '@/types'
import { getLanguageFromExtension } from '@/lib/utils'
import { GitHubAPI } from '@/lib/github-api'
import { FileContentCache } from '@/lib/cache-manager'
import { 
  Code, 
  Copy, 
  Check,
  ExternalLink, 
  Eye, 
  FileText,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Presentation,
  Share2,
  Printer,
  Focus,
  X
} from 'lucide-react'
import Prism from 'prismjs'
import 'prismjs/themes/prism-dark.css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markdown'

interface CodeViewerProps {
  file: FileNode | null
  repo: GitHubRepo
}

export function CodeViewer({ file, repo }: CodeViewerProps) {
  const [code, setCode] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lineNumbers, setLineNumbers] = useState(true)
  const [copied, setCopied] = useState(false)
  const [expandMode, setExpandMode] = useState<'normal' | 'fullscreen' | 'focus' | 'presentation' | 'print'>('normal')
  const [zoomLevel, setZoomLevel] = useState(100)
  const [showExpandMenu, setShowExpandMenu] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const adjustZoom = useCallback((delta: number) => {
    setZoomLevel(prev => Math.max(50, Math.min(200, prev + delta)))
  }, [])

  // Close expand menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExpandMenu && !(event.target as Element)?.closest('.expand-menu-container')) {
        setShowExpandMenu(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showExpandMenu) {
          setShowExpandMenu(false)
        } else if (expandMode !== 'normal') {
          setExpandMode('normal')
          if (document.fullscreenElement) {
            document.exitFullscreen?.()
          }
        }
      }
      
      // Zoom shortcuts
      if (event.ctrlKey || event.metaKey) {
        if (event.key === '=' || event.key === '+') {
          event.preventDefault()
          adjustZoom(10)
        } else if (event.key === '-') {
          event.preventDefault()
          adjustZoom(-10)
        } else if (event.key === '0') {
          event.preventDefault()
          setZoomLevel(100)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showExpandMenu, expandMode, adjustZoom])

  useEffect(() => {
    const loadFileContent = async () => {
      if (!file || file.type !== 'file') return

      setIsLoading(true)
      setError(null)
      
      try {
        // If this is a refresh (refreshTrigger > 0), bypass cache
        const shouldBypassCache = refreshTrigger > 0
        
        if (!shouldBypassCache) {
          // Check cache first (only on initial load)
          const cachedContent = FileContentCache.getFile(repo.owner, repo.name, file.path)
          if (cachedContent) {
            console.log(`📦 Using cached content for ${file.path}`)
            setCode(cachedContent)
            setIsLoading(false)
            return
          }
        } else {
          console.log(`🔄 Refreshing content for ${file.path} (bypassing cache)`)
        }

        console.log(`🔍 Loading fresh content for ${file.path}`)
        const response = await GitHubAPI.getFileContent(repo.owner, repo.name, file.path)
        
        if (response.error) {
          setError(response.error)
          setCode('// Error loading file content')
        } else if (response.data && response.data.content) {
          const content = response.data.content
          setCode(content)
          // Cache the content
          FileContentCache.cacheFile(repo.owner, repo.name, file.path, content)
        } else {
          setError('No content available')
          setCode('// No content available for this file')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load file'
        setError(errorMessage)
        setCode(`// Error: ${errorMessage}`)
      } finally {
        setIsLoading(false)
      }
    }

    if (file && file.type === 'file') {
      loadFileContent()
    }
  }, [file, repo, refreshTrigger])

  const highlightedCode = code && file ? 
    Prism.highlight(
      code, 
      Prism.languages[getLanguageFromExtension(file.extension || '')] || Prism.languages.text,
      getLanguageFromExtension(file.extension || '')
    ) : ''

  const copyToClipboard = async () => {
    if (code) {
      try {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        // Reset the copied state after 2 seconds
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
      }
    }
  }

  const refreshContent = async () => {
    if (file && file.type === 'file') {
      setIsLoading(true)
      setError(null)
      setCode('')
      
      try {
        // Force a fresh fetch by triggering the useEffect with refresh flag
        setRefreshTrigger(prev => prev + 1)
      } catch (error) {
        console.error('Error refreshing file:', error)
        setError('Failed to refresh file')
        setIsLoading(false)
      }
    }
  }

  const handleExpandModeChange = (mode: typeof expandMode) => {
    setExpandMode(mode)
    setShowExpandMenu(false)
    
    // Handle special modes
    if (mode === 'fullscreen') {
      document.documentElement.requestFullscreen?.()
    } else if (mode === 'presentation') {
      // Auto-format code for presentation
      setZoomLevel(120)
    } else if (mode === 'print') {
      // Optimize for printing
      setZoomLevel(85)
      setTimeout(() => window.print(), 100)
    }
  }

  const shareCode = async () => {
    if (file && code) {
      const shareData = {
        title: `${file.name} - Code Share`,
        text: `Check out this code from ${repo.owner}/${repo.name}`,
        url: window.location.href
      }
      
      try {
        if (navigator.share) {
          await navigator.share(shareData)
        } else {
          // Fallback: copy link to clipboard
          await navigator.clipboard.writeText(window.location.href)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }
      } catch (error) {
        console.error('Error sharing:', error)
      }
    }
  }

  const openInGitHub = () => {
    if (file) {
      const url = `${repo.url}/blob/main${file.path}`
      window.open(url, '_blank')
    }
  }

  if (!file) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <div className="text-center space-y-4">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No file selected</h3>
              <p className="text-muted-foreground">
                Select a file from the explorer to view its content
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Toast Notification */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.3 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              boxShadow: [
                "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
              ]
            }}
            exit={{ opacity: 0, y: -20, scale: 0.5 }}
            transition={{ 
              type: "spring", 
              stiffness: 500, 
              damping: 25,
              boxShadow: { duration: 2, repeat: 1 }
            }}
            className="fixed top-20 right-4 z-50 bg-success text-success-foreground px-4 py-2 rounded-lg shadow-lg border border-success flex items-center gap-2"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Check className="h-4 w-4" />
            </motion.div>
            <span className="text-sm font-medium">Code copied to clipboard!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-full"
      >
        <Card className={`h-full flex flex-col transition-all duration-300 ${
          expandMode === 'fullscreen' ? 'fixed inset-0 z-50 rounded-none' :
          expandMode === 'focus' ? 'shadow-2xl border-2 border-primary' :
          expandMode === 'presentation' ? 'shadow-xl' :
          expandMode === 'print' ? 'bg-white text-black shadow-none' :
          'h-full'
        }`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              {file.name}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLineNumbers(!lineNumbers)}
                className="cursor-pointer hover:scale-105 transition-transform duration-200"
              >
                <Eye className="h-4 w-4 mr-1" />
                Lines
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={refreshContent}
                disabled={isLoading}
                className="cursor-pointer hover:scale-105 transition-transform duration-200"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <motion.div
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  disabled={!code || isLoading}
                  className={`cursor-pointer transition-all duration-300 ${
                    copied 
                      ? 'bg-success text-success-foreground border-success shadow-lg shadow-success/20' 
                      : 'hover:shadow-md'
                  }`}
                >
                  <motion.div
                    initial={false}
                    animate={copied ? { 
                      scale: [1, 1.2, 1], 
                      rotate: [0, 5, 0],
                      opacity: [1, 0.8, 1]
                    } : { 
                      scale: 1,
                      rotate: 0,
                      opacity: 1
                    }}
                    transition={{ 
                      duration: copied ? 0.5 : 0.2,
                      ease: "easeInOut"
                    }}
                    className="flex items-center"
                  >
                    <motion.div
                      initial={false}
                      animate={copied ? { rotate: 360 } : { rotate: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 mr-1" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                    </motion.div>
                    <motion.span
                      initial={false}
                      animate={copied ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </motion.span>
                  </motion.div>
                </Button>
              </motion.div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={openInGitHub}
                className="cursor-pointer hover:scale-105 transition-transform duration-200"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                GitHub
              </Button>
              
              {/* Enhanced Expand Button with Dropdown Menu */}
              <div className="relative expand-menu-container">
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowExpandMenu(!showExpandMenu)}
                    className={`cursor-pointer transition-all duration-200 ${
                      expandMode !== 'normal' ? 'bg-info text-info-foreground border-info' : 'hover:shadow-md'
                    }`}
                  >
                    {expandMode === 'normal' ? (
                      <Maximize2 className="h-4 w-4" />
                    ) : (
                      <Minimize2 className="h-4 w-4" />
                    )}
                  </Button>
                </motion.div>

                {/* Expand Options Dropdown */}
                <AnimatePresence>
                  {showExpandMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden"
                    >
                      <div className="p-2 space-y-1">
                        {/* Fullscreen Mode */}
                        <motion.button
                          whileHover={{ backgroundColor: "var(--muted)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleExpandModeChange('fullscreen')}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors"
                        >
                          <Maximize2 className="h-4 w-4 text-info" />
                          <div className="text-left">
                            <div className="font-medium">Fullscreen</div>
                            <div className="text-xs text-muted-foreground">Immersive code view</div>
                          </div>
                        </motion.button>

                        {/* Focus Mode */}
                        <motion.button
                          whileHover={{ backgroundColor: "var(--muted)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleExpandModeChange('focus')}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors"
                        >
                          <Focus className="h-4 w-4 text-warning" />
                          <div className="text-left">
                            <div className="font-medium">Focus Mode</div>
                            <div className="text-xs text-muted-foreground">Distraction-free reading</div>
                          </div>
                        </motion.button>

                        {/* Presentation Mode */}
                        <motion.button
                          whileHover={{ backgroundColor: "var(--muted)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleExpandModeChange('presentation')}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors"
                        >
                          <Presentation className="h-4 w-4 text-success" />
                          <div className="text-left">
                            <div className="font-medium">Presentation</div>
                            <div className="text-xs text-muted-foreground">Large text for sharing</div>
                          </div>
                        </motion.button>

                        <div className="h-px bg-border my-1" />

                        {/* Zoom Controls */}
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => adjustZoom(-10)}
                              className="p-1 rounded hover:bg-muted"
                              disabled={zoomLevel <= 50}
                            >
                              <ZoomOut className="h-3 w-3" />
                            </motion.button>
                            <span className="text-xs font-mono min-w-[3rem] text-center">
                              {zoomLevel}%
                            </span>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => adjustZoom(10)}
                              className="p-1 rounded hover:bg-muted"
                              disabled={zoomLevel >= 200}
                            >
                              <ZoomIn className="h-3 w-3" />
                            </motion.button>
                          </div>
                        </div>

                        <div className="h-px bg-border my-1" />

                        {/* Action Buttons */}
                        <motion.button
                          whileHover={{ backgroundColor: "var(--muted)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={shareCode}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors"
                        >
                          <Share2 className="h-4 w-4 text-info" />
                          <span>Share Code</span>
                        </motion.button>

                        <motion.button
                          whileHover={{ backgroundColor: "var(--muted)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleExpandModeChange('print')}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors"
                        >
                          <Printer className="h-4 w-4 text-muted-foreground" />
                          <span>Print View</span>
                        </motion.button>

                        {expandMode !== 'normal' && (
                          <>
                            <div className="h-px bg-border my-1" />
                            <motion.button
                              whileHover={{ backgroundColor: "var(--muted)" }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleExpandModeChange('normal')}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-error"
                            >
                              <X className="h-4 w-4" />
                              <span>Exit {expandMode} mode</span>
                            </motion.button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{file.path}</span>
            {file.size && (
              <span>{Math.round(file.size / 1024)}KB</span>
            )}
            <span className="capitalize">
              {getLanguageFromExtension(file.extension || '')}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-0">
          {error && (
            <div className="p-4 bg-destructive/10 border-b border-destructive/20">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Error loading file</span>
              </div>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          )}
          
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <div className="relative">
              <pre 
                className={`syntax-highlight h-full overflow-auto leading-6 transition-all duration-300 ${
                  expandMode === 'focus' ? 'text-base p-8' :
                  expandMode === 'presentation' ? 'text-lg p-8' :
                  expandMode === 'print' ? 'text-sm p-4 bg-white text-black' :
                  'text-sm'
                }`}
                style={{ 
                  fontSize: `${zoomLevel}%`,
                  background: expandMode === 'focus' ? 'var(--card)' : undefined,
                  filter: expandMode === 'focus' ? 'drop-shadow(0 0 20px rgba(0,0,0,0.1))' : undefined
                }}
              >
                <code
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                  className={`language-${getLanguageFromExtension(file.extension || '')} ${
                    expandMode === 'presentation' ? 'line-height-loose' : ''
                  }`}
                />
              </pre>
              
              {lineNumbers && (
                <div 
                  className="absolute top-0 left-0 p-4 pr-2 text-xs text-muted-foreground select-none pointer-events-none transition-all duration-300"
                  style={{ fontSize: `${Math.max(50, zoomLevel - 20)}%` }}
                >
                  {code.split('\n').map((_, index) => (
                    <div key={index} className="leading-6">
                      {index + 1}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>

        {/* File Stats */}
        <div className="border-t px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{code.split('\n').length} lines</span>
            <span>{code.length} characters</span>
            <span>
              Language: {getLanguageFromExtension(file.extension || '')}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
    </>
  )
}
