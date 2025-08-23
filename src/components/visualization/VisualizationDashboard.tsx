import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileNode, GitHubRepo } from '@/types'
import { InteractiveFileTree } from './InteractiveFileTree'
import { FileNetwork } from './FileNetwork'
import { ArchitectureVisualizerV2 } from './ArchitectureVisualizerV2'
import { enhancedAnalyzer, SystemArchitecture } from '@/lib/enhanced-analyzer'
import { 
  TreePine, 
  Network, 
  BarChart3, 
  Info, 
  Layers,
  Globe,
  AlertCircle,
  Loader2
} from 'lucide-react'

interface VisualizationDashboardProps {
  repo: GitHubRepo
  structure: FileNode
  onFileSelect: (file: FileNode) => void
  selectedFile?: FileNode | null
}

export function VisualizationDashboard({ 
  repo, 
  structure, 
  onFileSelect, 
  selectedFile 
}: VisualizationDashboardProps) {
  const [activeTab, setActiveTab] = useState('tree')
  const [architecture, setArchitecture] = useState<SystemArchitecture | null>(null)
  const [architectureLoading, setArchitectureLoading] = useState(false)
  const [architectureError, setArchitectureError] = useState<string | null>(null)

  const loadArchitecture = useCallback(async () => {
    setArchitectureLoading(true)
    setArchitectureError(null)
    try {
      console.log('🏗️ Loading FAST architecture analysis...')
      // Fast pass
      const fastResult = await enhancedAnalyzer.analyzeRepository(repo.owner, repo.name, { fast: true })
      setArchitecture(fastResult)
      setArchitectureLoading(false)
      console.log('⚡ Fast architecture ready, starting full analysis upgrade...')
      // Fire and forget full upgrade
      enhancedAnalyzer.analyzeRepository(repo.owner, repo.name, { fast: false }).then(full => {
        setArchitecture(prev => (prev && prev.isFast ? full : prev))
        console.log('✅ Full architecture upgrade completed')
      }).catch(err => console.warn('Full architecture upgrade failed:', err))
    } catch (error) {
      console.error('❌ Architecture analysis failed:', error)
      setArchitectureError(error instanceof Error ? error.message : 'Failed to analyze architecture')
      setArchitectureLoading(false)
    }
  }, [repo.owner, repo.name])

  // Load architecture analysis when switching to architecture tab
  useEffect(() => {
    if (activeTab === 'architecture' && !architecture && !architectureLoading) {
      loadArchitecture()
    }
  }, [activeTab, architecture, architectureLoading, loadArchitecture])

  // Calculate repository statistics
  const stats = {
    totalFiles: 0,
    totalDirectories: 0,
    codeFiles: 0,
    configFiles: 0,
    maxDepth: 0
  }

  const calculateStats = (node: FileNode, depth = 0): void => {
    stats.maxDepth = Math.max(stats.maxDepth, depth)
    
    if (node.type === 'file') {
      stats.totalFiles++
      const ext = node.extension?.toLowerCase()
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c'].includes(ext || '')) {
        stats.codeFiles++
      }
      if (node.name.includes('config') || ext === '.json' || ext === '.yml' || ext === '.yaml') {
        stats.configFiles++
      }
    } else {
      stats.totalDirectories++
    }

    if (node.children) {
      node.children.forEach(child => calculateStats(child, depth + 1))
    }
  }

  calculateStats(structure)

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Repository Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Repository Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalFiles}</div>
              <div className="text-sm text-muted-foreground">Files</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.totalDirectories}</div>
              <div className="text-sm text-muted-foreground">Directories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.codeFiles}</div>
              <div className="text-sm text-muted-foreground">Code Files</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.configFiles}</div>
              <div className="text-sm text-muted-foreground">Config Files</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.maxDepth}</div>
              <div className="text-sm text-muted-foreground">Max Depth</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visualization Controls */}
      <Card className="flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Interactive Repository Explorer</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={activeTab === 'tree' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('tree')}
                className="flex items-center gap-2"
              >
                <TreePine className="h-4 w-4" />
                Tree View
              </Button>
              <Button
                variant={activeTab === 'network' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('network')}
                className="flex items-center gap-2"
              >
                <Network className="h-4 w-4" />
                Network View
              </Button>
              <Button
                variant={activeTab === 'architecture' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('architecture')}
                className="flex items-center gap-2"
                disabled={architectureLoading}
              >
                {architectureLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Layers className="h-4 w-4" />
                )}
                Architecture
              </Button>
            </div>
          </div>
          
          {/* Current selection info */}
          {selectedFile && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg"
            >
              <Info className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="font-medium text-sm">{selectedFile.name}</div>
                <div className="text-xs text-muted-foreground">{selectedFile.path}</div>
              </div>
              {selectedFile.type === 'file' && selectedFile.size && (
                <div className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </div>
              )}
            </motion.div>
          )}
        </CardHeader>

        <CardContent className="flex-1 p-0">
          {activeTab === 'tree' && (
            <InteractiveFileTree
              repo={repo}
              structure={structure}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          )}

          {activeTab === 'network' && (
            <FileNetwork
              repo={repo}
              structure={structure}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          )}

          {activeTab === 'architecture' && (
            <div className="p-4">
              {architectureLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <div>
                      <div className="font-medium">Analyzing Repository Architecture</div>
                      <div className="text-sm text-muted-foreground">
                        Fetching files, parsing code, and identifying patterns...
                      </div>
                    </div>
                  </div>
                </div>
              ) : architectureError ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
                    <div>
                      <div className="font-medium text-destructive">Analysis Failed</div>
                      <div className="text-sm text-muted-foreground max-w-md">
                        {architectureError}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadArchitecture}
                        className="mt-3"
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                </div>
              ) : architecture ? (
                <div className="space-y-2">
                  {architecture.isFast && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1 bg-amber-50 border border-amber-200 rounded w-fit">
                      <span className="font-medium text-amber-700">Preview</span>
                      <span>Fast architecture view loading full details…</span>
                    </div>
                  )}
                  <ArchitectureVisualizerV2 architecture={architecture} />
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <Layers className="h-8 w-8 mx-auto text-muted-foreground" />
                    <div>
                      <div className="font-medium">Architecture Analysis</div>
                      <div className="text-sm text-muted-foreground">
                        Click to analyze the repository architecture and API calls
                      </div>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={loadArchitecture}
                        className="mt-3"
                      >
                        Analyze Architecture
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips and Information */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <TreePine className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-medium">Tree View</div>
                <div className="text-muted-foreground">Hierarchical file structure with expand/collapse functionality</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Network className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <div className="font-medium">Network View</div>
                <div className="text-muted-foreground">Interactive node-based visualization with progressive expansion</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Layers className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <div className="font-medium">Architecture View</div>
                <div className="text-muted-foreground">System architecture with API calls, build tools, and component relationships</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <div className="font-medium">API Analysis</div>
                <div className="text-muted-foreground">Detects HTTP requests, WebSocket connections, and external service integrations</div>
              </div>
            </div>
          </div>
          
          {/* Architecture-specific stats */}
          {architecture && (
            <div className="mt-6 pt-4 border-t">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{architecture.components.length}</div>
                  <div className="text-xs text-muted-foreground">Components</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-600">{architecture.connections.length}</div>
                  <div className="text-xs text-muted-foreground">Connections</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{architecture.apiCalls.length}</div>
                  <div className="text-xs text-muted-foreground">API Calls</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-600">{architecture.buildTools.length}</div>
                  <div className="text-xs text-muted-foreground">Build Tools</div>
                </div>
              </div>
              
              {/* API Calls Summary */}
              {architecture.apiCalls.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">External Services</div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(architecture.apiCalls
                      .filter(call => call.type === 'external')
                      .map(call => {
                        try {
                          return new URL(call.url).hostname
                        } catch {
                          return call.url.split('/')[0]
                        }
                      })
                    )).slice(0, 5).map(service => (
                      <Badge key={service} variant="secondary" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
