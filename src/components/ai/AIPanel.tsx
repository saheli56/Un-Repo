import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GitHubRepo, FileNode, AIExplanation } from '@/types'
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

  // Mock AI explanations for demo
  const mockExplanations: Record<string, AIExplanation> = {
    'index.js': {
      summary: 'Application entry point that initializes React and renders the main App component.',
      details: 'This file is the root of your React application. It imports React and ReactDOM, then uses ReactDOM.createRoot() to create a root element and render the App component wrapped in React.StrictMode for better development experience.',
      codeFlow: [
        'Import React and ReactDOM libraries',
        'Import CSS styles and App component',
        'Create root element from DOM',
        'Render App component with StrictMode'
      ],
      suggestions: [
        'Consider adding error boundaries for better error handling',
        'Add service worker registration for PWA capabilities',
        'Consider lazy loading for performance optimization'
      ],
      relatedFiles: ['App.js', 'index.css'],
      timestamp: Date.now()
    },
    'App.js': {
      summary: 'Main application component that manages user state and renders the primary UI structure.',
      details: 'This is the main component of your application. It uses React hooks (useState, useEffect) to manage user data, handles asynchronous data fetching, and renders the main layout including Header and Footer components.',
      codeFlow: [
        'Initialize state for user data and loading',
        'Fetch user data on component mount',
        'Handle loading and error states',
        'Render Header, main content, and Footer'
      ],
      suggestions: [
        'Add error handling for failed API calls',
        'Consider using React Query for better data management',
        'Add loading skeletons for better UX',
        'Implement proper TypeScript types'
      ],
      relatedFiles: ['Header.js', 'Footer.js', 'client.js'],
      timestamp: Date.now()
    },
    'Header.js': {
      summary: 'Navigation header component with user authentication display.',
      details: 'A reusable header component that displays the application logo, navigation menu, and user information when available. It receives user data as props and conditionally renders user-specific content.',
      codeFlow: [
        'Render application logo',
        'Display navigation menu',
        'Conditionally show user information',
        'Apply responsive styling'
      ],
      suggestions: [
        'Add mobile responsive navigation menu',
        'Implement logout functionality',
        'Add accessibility attributes (ARIA labels)',
        'Consider using React Router for navigation'
      ],
      relatedFiles: ['App.js', 'Header.css'],
      timestamp: Date.now()
    },
    'package.json': {
      summary: 'Project configuration file defining dependencies, scripts, and metadata.',
      details: 'This file contains all the essential configuration for your React project, including dependencies, build scripts, and project metadata. It defines React 18 as the main framework and includes common development tools.',
      codeFlow: [
        'Define project metadata and version',
        'List production dependencies',
        'Configure build and development scripts',
        'Set up ESLint and browser support'
      ],
      suggestions: [
        'Consider updating to latest React version',
        'Add TypeScript for better type safety',
        'Include testing utilities like Jest',
        'Add pre-commit hooks with Husky'
      ],
      relatedFiles: ['package-lock.json', '.gitignore'],
      timestamp: Date.now()
    },
    'README.md': {
      summary: 'Project documentation with setup instructions and overview.',
      details: 'Comprehensive documentation that explains the project structure, setup process, and key features. It provides clear instructions for new developers to get started with the codebase.',
      codeFlow: [
        'Introduce project purpose and features',
        'Provide installation instructions',
        'Explain project structure',
        'Include contribution guidelines'
      ],
      suggestions: [
        'Add screenshots or demos',
        'Include API documentation',
        'Add troubleshooting section',
        'Consider adding badges for build status'
      ],
      relatedFiles: ['package.json', '.gitignore'],
      timestamp: Date.now()
    }
  }

  useEffect(() => {
    if (file) {
      setIsLoading(true)
      // Simulate AI processing delay
      const timer = setTimeout(() => {
        const mockExplanation = mockExplanations[file.name] || {
          summary: `Analysis for ${file.name}`,
          details: 'This file contains code that would be analyzed by AI to provide insights about its purpose, structure, and relationships.',
          codeFlow: ['Loading analysis...'],
          suggestions: ['Analysis in progress...'],
          relatedFiles: [],
          timestamp: Date.now()
        }
        setExplanation(mockExplanation)
        setIsLoading(false)
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [file])

  const refreshAnalysis = async () => {
    if (file) {
      setIsLoading(true)
      setExplanation(null)
      
      try {
        // Simulate API delay for refreshing analysis
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Get fresh analysis (in real implementation, this would call AI service)
        const freshAnalysis = mockExplanations[file.name]
        if (freshAnalysis) {
          // Create a refreshed version with new timestamp and potentially updated content
          const refreshedAnalysis = {
            ...freshAnalysis,
            timestamp: Date.now(),
            summary: `${freshAnalysis.summary} (Updated)`,
            suggestions: [
              ...(freshAnalysis.suggestions || []),
              `Refreshed analysis at ${new Date().toLocaleTimeString()}`
            ]
          }
          setExplanation(refreshedAnalysis)
        } else {
          // If no mock data exists, create a generic analysis
          setExplanation({
            summary: `Analysis for ${file.name} has been refreshed.`,
            details: `This file analysis was refreshed at ${new Date().toLocaleString()}. In a real implementation, this would call an AI service to provide fresh insights.`,
            codeFlow: ['File loaded', 'Analysis refreshed', 'Results updated'],
            suggestions: ['Analysis has been refreshed successfully'],
            relatedFiles: [],
            timestamp: Date.now()
          })
        }
      } catch (error) {
        console.error('Error refreshing analysis:', error)
        // Keep previous explanation if refresh fails
      } finally {
        setIsLoading(false)
      }
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
