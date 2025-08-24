import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GitHubRepo, FileNode, AIExplanation } from '@/types'
import { GeminiAnalyzer } from '@/lib/gemini-analyzer'
import { GitHubAPI } from '@/lib/github-api'
import { 
  Brain, 
  Sparkles, 
  MessageSquare, 
  Lightbulb,
  Zap,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'

interface AIPanelProps {
  file: FileNode | null
  repo: GitHubRepo
}

export function AIPanel({ file, repo }: AIPanelProps) {
  const [explanation, setExplanation] = useState<AIExplanation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const run = async () => {
      if (!file) return
      setIsLoading(true)
      setExplanation(null)

      try {
        if (GeminiAnalyzer.hasApiKey()) {
          const config = GeminiAnalyzer.getConfig()
          if (!config) throw new Error('Gemini API key not configured')

          const resp = await GitHubAPI.getFileContent(repo.owner, repo.name, file.path)
          if (resp.error || !resp.data) {
            throw new Error(resp.error || 'Failed to load file content')
          }
          const content = resp.data.content || ''

          const fx = await GeminiAnalyzer.explainFile(
            config,
            file.path,
            content,
            {
              name: repo.name,
              techStack: repo.language ? [repo.language] : ['JavaScript', 'TypeScript'],
              description: repo.description
            }
          )

          const mapped: AIExplanation = {
            summary: fx.purpose,
            details: fx.whatItDoes + (fx.technicalDetails ? ` ${fx.technicalDetails}` : ''),
            codeFlow: fx.keyFeatures,
            suggestions: fx.beginnerTips,
            relatedFiles: fx.relatedFiles,
            timestamp: Date.now()
          }

          setExplanation(mapped)
        } else {
          setExplanation({
            summary: `AI key not configured`,
            details: 'Add your Gemini API key in Settings to enable AI analysis for files.',
            codeFlow: [],
            suggestions: ['Open Settings > Gemini and paste your API key', 'Then click Refresh'],
            relatedFiles: [],
            timestamp: Date.now()
          })
        }
      } catch (error) {
        console.error('Error getting AI explanation:', error)
        setExplanation({
          summary: `Analysis unavailable`,
          details: error instanceof Error ? error.message : 'Unknown error occurred',
          codeFlow: [],
          suggestions: ['Try again later', 'Verify your network and API key'],
          relatedFiles: [],
          timestamp: Date.now()
        })
      } finally {
        setIsLoading(false)
      }
    }

    run()
  }, [file, repo, refreshTrigger])

  const refreshAnalysis = async () => {
    if (file) {
      setRefreshTrigger(prev => prev + 1)
    }
  }

  if (!file) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <div className="text-center space-y-4">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">AI Analysis Ready</h3>
              <p className="text-muted-foreground">
                Select a file to get AI-powered insights and explanations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full"
    >
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Analysis
            </CardTitle>
            
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAnalysis}
              disabled={isLoading}
              className="cursor-pointer hover:scale-105 transition-transform duration-200"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Analyzing: {file.name}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto space-y-6">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  <span className="text-sm">AI is analyzing the code...</span>
                </div>
                
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
                
                <div className="space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </motion.div>
            ) : explanation && (
              <motion.div
                key="explanation"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-info" />
                    <h3 className="font-semibold">Summary</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {explanation.summary}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-warning" />
                    <h3 className="font-semibold">Detailed Analysis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {explanation.details}
                  </p>
                </div>

                {/* Code Flow */}
                {explanation.codeFlow && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-success" />
                      <h3 className="font-semibold">Code Flow</h3>
                    </div>
                    <div className="space-y-2">
                      {explanation.codeFlow.map((step, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-3 text-sm"
                        >
                          <div className="bg-primary/20 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">
                            {index + 1}
                          </div>
                          <span className="text-muted-foreground">{step}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {explanation.suggestions && explanation.suggestions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-warning" />
                      <h3 className="font-semibold">Suggestions</h3>
                    </div>
                    <div className="space-y-2">
                      {explanation.suggestions.map((suggestion, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-2 text-sm p-2 bg-warning-muted text-warning-muted-foreground rounded-md border border-warning-muted"
                        >
                          <Lightbulb className="h-3 w-3 text-warning mt-0.5 flex-shrink-0" />
                          <span className="text-warning-muted-foreground">{suggestion}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Files */}
                {explanation.relatedFiles && explanation.relatedFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-info" />
                      <h3 className="font-semibold">Related Files</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {explanation.relatedFiles.map((fileName, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-info-muted text-info-muted-foreground px-2 py-1 rounded-md text-xs border border-info-muted"
                        >
                          {fileName}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>

        {/* Timestamp */}
        <div className="border-t px-4 py-2">
          <div className="text-xs text-muted-foreground">
            {explanation && (
              <>Analyzed {new Date(explanation.timestamp).toLocaleTimeString()}</>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
