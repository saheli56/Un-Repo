import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { RepoInput } from '@/components/repo/RepoInput'
import { VisualizationDashboard } from '@/components/visualization/VisualizationDashboard'
import { WorkflowOverview } from '@/components/repo/WorkflowOverview'
import { FileExplorer } from '@/components/file/FileExplorer'
import { CodeViewer } from '@/components/code/CodeViewer'
import { AIPanel } from '@/components/ai/AIPanel'
import { AdvancedSearch } from '@/components/search/AdvancedSearch'
import { GitHubSettings } from '@/components/settings/GitHubSettings'
import { GeminiSettings } from '@/components/settings/GeminiSettings'
import { GitHubRepo, FileNode, RepoAnalysis } from '@/types'
import { Github, Code, TreePine, Key, ArrowLeft, ArrowRight } from 'lucide-react'
import { analyzeRepository } from '@/lib/utils'

interface AppState {
  currentRepo: GitHubRepo | null
  repoAnalysis: RepoAnalysis | null
  selectedFile: FileNode | null
  isLoading: boolean
  view: 'input' | 'explorer' | 'interactive' | 'settings'
  darkMode: boolean
  navigationHistory: Array<'input' | 'explorer' | 'interactive' | 'settings'>
}

export default function App() {
  const [state, setState] = useState<AppState & { forwardHistory: AppState['view'][] }>({
    currentRepo: null,
    repoAnalysis: null,
    selectedFile: null,
    isLoading: false,
    view: 'input',
    darkMode: true,
    navigationHistory: ['input'],
    forwardHistory: [],
  })

  // Simple auth state for demo
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    // Apply dark mode class to html element
    if (state.darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [state.darkMode])

  const handleRepoSubmit = async (repo: GitHubRepo) => {
    setState(prev => ({ ...prev, isLoading: true, currentRepo: repo }))
    
    try {
      // Real repository analysis
      const analysis = await analyzeRepository(repo)
      
      setState(prev => {
        const newHistory: AppState['navigationHistory'] = [...prev.navigationHistory, 'explorer']
        return {
          ...prev,
          isLoading: false,
          view: 'explorer',
          repoAnalysis: analysis,
          navigationHistory: newHistory
        }
      })
    } catch (error) {
      console.error('Failed to analyze repository:', error)
      setState(prev => { 
        const newHistory: AppState['navigationHistory'] = [...prev.navigationHistory, 'explorer']
        return {
          ...prev, 
          isLoading: false,
          // Show error or fallback analysis
          repoAnalysis: {
            structure: {
              id: 'root',
              name: repo.name,
              path: '/',
              type: 'directory',
              depth: 0,
              children: []
            },
            overview: `Failed to analyze ${repo.name}. Please check if the repository exists and is public.`,
            techStack: ['Unknown'],
            entryPoints: [],
            architecture: 'Unknown',
            keyDirectories: []
          },
          view: 'explorer',
          navigationHistory: newHistory
        }
      })
    }
  }

  const toggleDarkMode = () => {
    setState(prev => ({ ...prev, darkMode: !prev.darkMode }))
  }

  const navigateToView = (newView: AppState['view']) => {
    setState(prev => {
      const newHistory: AppState['navigationHistory'] = [...prev.navigationHistory];
      // Only add to history if it's different from current view
      if (prev.view !== newView) {
        newHistory.push(newView);
      }
      return {
        ...prev,
        view: newView,
        navigationHistory: newHistory,
      };
    });
  }

  const goBack = () => {
    setState(prev => {
      const newHistory = [...prev.navigationHistory];
      const newForwardHistory = [...prev.forwardHistory];

      if (newHistory.length > 1) {
        const previousView = newHistory.pop();
        newForwardHistory.unshift(prev.view);

        return {
          ...prev,
          view: previousView!,
          navigationHistory: newHistory,
          forwardHistory: newForwardHistory,
        };
      }
      return prev;
    });
  };

  const goForward = () => {
    setState(prev => {
      const newHistory = [...prev.navigationHistory];
      const newForwardHistory = [...prev.forwardHistory];

      if (newForwardHistory.length > 0) {
        const nextView = newForwardHistory.shift();
        newHistory.push(nextView!);

        return {
          ...prev,
          view: nextView!,
          navigationHistory: newHistory,
          forwardHistory: newForwardHistory,
        };
      }
      return prev;
    });
  };

  const resetToHome = () => {
    setState(prev => ({
      ...prev,
      view: 'input',
      currentRepo: null,
      selectedFile: null,
      repoAnalysis: null,
      navigationHistory: ['input']
    }))
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/20">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            {/* Navigation Arrows - Back and Forward */}
            {state.view !== 'input' && (
              <div className="flex items-center space-x-1 mr-2">
                {state.navigationHistory.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goBack}
                    className="cursor-pointer hover:scale-110 transition-transform duration-200"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                {state.forwardHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goForward}
                    className="cursor-pointer hover:scale-110 transition-transform duration-200"
                    aria-label="Forward"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                )}
              </div>
            )}

            <Github className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity duration-200" />
            <button 
              onClick={resetToHome}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer duration-200"
            >
              <h1 className="text-xl font-bold">UnRepo</h1>
              <span className="text-sm text-muted-foreground">
                AI-Powered Repository Explorer
              </span>
            </button>

            {/* Breadcrumb Navigation */}
            {state.view !== 'input' && (
              <div className="hidden sm:flex items-center text-sm text-muted-foreground ml-4">
                <span className="capitalize relative">
                  {state.view}
                  <span className="absolute -bottom-1 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary rounded-md shadow-md animate-bounce"></span>
                </span>
                {state.currentRepo && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="text-primary font-medium">{state.currentRepo.name}</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Right side: Navigation buttons and Auth buttons */}
          <div className="flex items-center space-x-4">
            {/* Explorer, Interactive, and API buttons */}
            {state.currentRepo && (
              <div className="flex items-center space-x-1">
                <Button
                  variant={state.view === 'explorer' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigateToView('explorer')}
                  className={`cursor-pointer hover:scale-105 transition-transform duration-200 ${state.view === 'explorer' ? 'border-b-2 border-primary' : ''}`}
                >
                  <Code className="h-4 w-4 mr-1" />
                  Explorer
                </Button>
                <Button
                  variant={state.view === 'interactive' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigateToView('interactive')}
                  className={`cursor-pointer hover:scale-105 transition-transform duration-200 ${state.view === 'interactive' ? 'border-b-2 border-primary' : ''}`}
                >
                  <TreePine className="h-4 w-4 mr-1" />
                  Interactive
                </Button>
              </div>
            )}
            
            {/* API Settings Button */}
            <div className="flex items-center justify-center bg-card/50 px-4 py-2 rounded-lg shadow-md">
              <Button
                variant={state.view === 'settings' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigateToView('settings')}
                className={`cursor-pointer hover:scale-110 transition-transform duration-200 ${state.view === 'settings' ? 'border-b-2 border-primary' : ''}`}
              >
                <Key className="h-4 w-4 mr-1" />
                API
              </Button>
            </div>

            {/* Login, Sign Up, and Profile Buttons */}
            <div className="flex items-center space-x-2">
              {!isLoggedIn ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => alert('Login functionality to be implemented')}
                    className="cursor-pointer hover:scale-105 transition-transform duration-200"
                  >
                    Login
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => alert('Sign Up functionality to be implemented')}
                    className="cursor-pointer hover:scale-105 transition-transform duration-200"
                  >
                    Sign Up
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => alert('Profile functionality to be implemented')}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200"
                >
                  Profile
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {state.view === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <RepoInput onSubmit={handleRepoSubmit} isLoading={state.isLoading} />
            </motion.div>
          )}

          {state.view === 'explorer' && state.repoAnalysis && (
            <motion.div
              key="explorer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Workflow Overview Section */}
              <WorkflowOverview
                repo={state.currentRepo!}
                analysis={state.repoAnalysis}
                onViewWorkflow={() => navigateToView('interactive')}
              />
              
              {/* Traditional Explorer Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-400px)]">
                {/* File Explorer */}
                <div className="lg:col-span-1 space-y-4">
                  <AdvancedSearch
                    files={[state.repoAnalysis.structure]}
                    onFileSelect={(file) => setState(prev => ({ ...prev, selectedFile: file }))}
                  />
                  <FileExplorer
                    repo={state.currentRepo!}
                    structure={state.repoAnalysis.structure}
                    onFileSelect={(file) => setState(prev => ({ ...prev, selectedFile: file }))}
                    selectedFile={state.selectedFile}
                  />
                </div>

                {/* Code Viewer */}
                <div className="lg:col-span-2">
                  <CodeViewer
                    file={state.selectedFile}
                    repo={state.currentRepo!}
                  />
                </div>

                {/* AI Panel */}
                <div className="lg:col-span-1">
                  <AIPanel
                    file={state.selectedFile}
                    repo={state.currentRepo!}
                  />
                </div>


              </div>
            </motion.div>
          )}

          {state.view === 'interactive' && state.repoAnalysis && (
            <motion.div
              key="interactive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[calc(100vh-200px)]"
            >
              <VisualizationDashboard
                repo={state.currentRepo!}
                structure={state.repoAnalysis.structure}
                onFileSelect={(file) => setState(prev => ({ ...prev, selectedFile: file }))}
                selectedFile={state.selectedFile}
              />
            </motion.div>
          )}

          {state.view === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <GitHubSettings />
              <GeminiSettings />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
