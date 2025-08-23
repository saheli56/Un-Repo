import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GitHubRepo, RepoAnalysis, WalkthroughStep } from '@/types'
import { 
  BookOpen, 
  Play, 
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  CheckCircle,
  Circle,
  Code,
  FileText,
  ArrowRight,
} from 'lucide-react'

interface WalkthroughPanelProps {
  repo: GitHubRepo
  analysis: RepoAnalysis
}

export function WalkthroughPanel({ repo, analysis }: WalkthroughPanelProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Mock walkthrough steps for demo
  const walkthroughSteps: WalkthroughStep[] = [
    {
      id: 'step-1',
      title: 'Project Overview',
      description: 'Welcome to the repository walkthrough! Let\'s start by understanding the overall structure and purpose of this project.',
      files: ['README.md', 'package.json'],
      focusNodes: ['root'],
      explanation: 'This is a React application with a modern development setup. The project uses React 18 and includes essential development tools for building a web application.',
      codeSnippets: [
        {
          file: 'package.json',
          lines: [1, 10],
          code: '{\n  "name": "my-react-app",\n  "version": "1.0.0",\n  "private": true,\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  }\n}',
          explanation: 'The package.json shows this is a React application with version 1.0.0'
        }
      ]
    },
    {
      id: 'step-2',
      title: 'Application Entry Point',
      description: 'Every React application starts somewhere. Let\'s examine the entry point where React initializes and renders the app.',
      files: ['src/index.js'],
      focusNodes: ['file-0'],
      explanation: 'The index.js file is the entry point of our React application. It\'s responsible for creating the React root and rendering the main App component.',
      codeSnippets: [
        {
          file: 'src/index.js',
          lines: [1, 11],
          code: 'import React from \'react\';\nimport ReactDOM from \'react-dom/client\';\nimport App from \'./App\';\n\nconst root = ReactDOM.createRoot(document.getElementById(\'root\'));\nroot.render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);',
          explanation: 'This code creates a React root and renders the App component with StrictMode enabled for better development experience.'
        }
      ]
    },
    {
      id: 'step-3',
      title: 'Main Application Component',
      description: 'The App component is the heart of our application. It manages the main state and orchestrates the overall user interface.',
      files: ['src/App.js'],
      focusNodes: ['file-1'],
      explanation: 'The App component manages user state, handles data fetching, and renders the main application layout including header and footer.',
      codeSnippets: [
        {
          file: 'src/App.js',
          lines: [1, 15],
          code: 'function App() {\n  const [user, setUser] = useState(null);\n  const [loading, setLoading] = useState(true);\n\n  useEffect(() => {\n    const loadUserData = async () => {\n      try {\n        const userData = await fetchUserData();\n        setUser(userData);\n      } catch (error) {\n        console.error(\'Failed to load user data:\', error);\n      }\n    };\n  }, []);',
          explanation: 'The App component uses React hooks to manage state and side effects for user data loading.'
        }
      ]
    },
    {
      id: 'step-4',
      title: 'Component Architecture',
      description: 'Modern React applications are built with reusable components. Let\'s explore the component structure and how they work together.',
      files: ['src/components/Header.js', 'src/components/Footer.js'],
      focusNodes: ['file-2', 'file-3'],
      explanation: 'The application uses a component-based architecture where UI elements are broken down into reusable, manageable pieces.',
      codeSnippets: [
        {
          file: 'src/components/Header.js',
          lines: [1, 12],
          code: 'function Header({ user }) {\n  return (\n    <header className="app-header">\n      <div className="container">\n        <div className="logo">\n          <h1>MyApp</h1>\n        </div>\n        <nav>\n          <ul>\n            <li><a href="/">Home</a></li>\n          </ul>\n        </nav>\n      </div>',
          explanation: 'The Header component receives user data as props and conditionally renders user-specific content.'
        }
      ]
    },
    {
      id: 'step-5',
      title: 'Utility Functions and Helpers',
      description: 'Well-organized applications separate business logic into utility functions. These helpers make code more maintainable and reusable.',
      files: ['src/utils/helpers.js'],
      focusNodes: ['file-4'],
      explanation: 'Utility functions contain reusable logic that can be shared across multiple components, keeping the codebase DRY (Don\'t Repeat Yourself).',
    },
    {
      id: 'step-6',
      title: 'Data Flow and API Integration',
      description: 'Modern applications often fetch data from external sources. Let\'s see how this app handles API communication.',
      files: ['src/api/client.js'],
      focusNodes: ['file-5'],
      explanation: 'The API client handles all external data fetching, providing a clean separation between data access and UI components.',
    }
  ]

  const nextStep = () => {
    if (currentStep < walkthroughSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
  }

  const resetWalkthrough = () => {
    setCurrentStep(0)
    setIsPlaying(false)
  }

  const currentStepData = walkthroughSteps[currentStep]
  const progress = ((currentStep + 1) / walkthroughSteps.length) * 100

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex gap-6"
    >
      {/* Walkthrough Content */}
      <div className="flex-1 space-y-6">
        {/* Progress Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Interactive Walkthrough
              </CardTitle>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePlayback}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextStep}
                  disabled={currentStep === walkthroughSteps.length - 1}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetWalkthrough}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Step {currentStep + 1} of {walkthroughSteps.length}</span>
                <span>{Math.round(progress)}% Complete</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <motion.div
                  className="bg-primary h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Current Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  {currentStepData.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  {currentStepData.description}
                </p>
                
                <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                  <p className="text-sm">{currentStepData.explanation}</p>
                </div>

                {/* Related Files */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Focus Files
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {currentStepData.files.map((file, index) => (
                      <div
                        key={index}
                        className="bg-info-muted text-info-muted-foreground px-3 py-1 rounded-md text-sm border border-info-muted"
                      >
                        {file}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code Snippets */}
                {currentStepData.codeSnippets && (
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Key Code Examples
                    </h4>
                    {currentStepData.codeSnippets.map((snippet, index) => (
                      <Card key={index} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <div className="text-sm font-medium text-muted-foreground">
                            {snippet.file} (lines {snippet.lines[0]}-{snippet.lines[1]})
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                            <code>{snippet.code}</code>
                          </pre>
                          <p className="text-sm text-muted-foreground mt-2">
                            {snippet.explanation}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="cursor-pointer hover:scale-105 transition-transform duration-200"
              >
                <SkipBack className="h-4 w-4 mr-2" />
                Previous Step
              </Button>
              
              {currentStep === walkthroughSteps.length - 1 ? (
                <Button 
                  onClick={resetWalkthrough}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Start Over
                </Button>
              ) : (
                <Button 
                  onClick={nextStep}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200"
                >
                  Next Step
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Steps Overview Sidebar */}
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="text-lg">Walkthrough Steps</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-2">
          {walkthroughSteps.map((step, index) => (
            <motion.div
              key={step.id}
              className={`
                p-3 rounded-lg border cursor-pointer transition-all
                ${index === currentStep ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-border hover:border-primary/50'}
                ${index < currentStep ? 'opacity-75' : ''}
              `}
              onClick={() => setCurrentStep(index)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                {index < currentStep ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : index === currentStep ? (
                  <Circle className="h-5 w-5 text-primary fill-current" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                
                <div className="flex-1">
                  <div className="font-medium text-sm">{step.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {step.description}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}
