import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { ArchitectureVisualizer } from '../visualization/ArchitectureVisualizer'
import { SystemArchitecture } from '@/lib/enhanced-analyzer'
import { 
  Code, 
  Layers, 
  Network,
  Globe,
  Settings,
  Database,
  Zap
} from 'lucide-react'

// Demo architecture data similar to GitDiagram's output
const demoArchitecture: SystemArchitecture = {
  layers: [
    {
      id: 'runtime',
      name: 'Browser (Runtime)',
      type: 'runtime',
      components: ['browser'],
      description: 'Client-side runtime environment',
      position: { x: 50, y: 50, width: 300, height: 200 }
    },
    {
      id: 'development',
      name: 'Dev/Build Pipeline',
      type: 'development', 
      components: ['vite', 'eslint', 'typescript', 'tailwind'],
      description: 'Development tools and build process',
      position: { x: 400, y: 50, width: 500, height: 400 }
    },
    {
      id: 'static',
      name: 'Static Assets',
      type: 'static',
      components: ['index-html', 'styles', 'public-assets'],
      description: 'Static files and assets',
      position: { x: 50, y: 300, width: 300, height: 250 }
    },
    {
      id: 'source',
      name: 'Source Code',
      type: 'source',
      components: ['main-tsx', 'app-tsx', 'components'],
      description: 'Application source code',
      position: { x: 400, y: 500, width: 500, height: 300 }
    },
    {
      id: 'external',
      name: 'External Services',
      type: 'external',
      components: ['github-api', 'gemini-api'],
      description: 'External APIs and services', 
      position: { x: 950, y: 200, width: 300, height: 400 }
    }
  ],
  components: [
    {
      id: 'browser',
      name: 'Browser',
      type: 'browser',
      layer: 'runtime',
      purpose: 'Renders and executes the application',
      technologies: ['HTML', 'CSS', 'JavaScript'],
      files: ['index.html'],
      position: { x: 100, y: 100 },
      size: { width: 200, height: 80 },
      color: '#E3F2FD'
    },
    {
      id: 'vite',
      name: 'Vite Dev Server',
      type: 'tool',
      layer: 'development',
      purpose: 'Development server and bundler',
      technologies: ['Vite', 'HMR'],
      files: ['vite.config.ts'],
      position: { x: 450, y: 100 },
      size: { width: 150, height: 80 },
      color: '#4CAF50'
    },
    {
      id: 'eslint',
      name: 'ESLint',
      type: 'tool',
      layer: 'development',
      purpose: 'Code linting and quality',
      technologies: ['ESLint'],
      files: ['eslint.config.js'],
      position: { x: 650, y: 100 },
      size: { width: 120, height: 60 },
      color: '#FF9800'
    },
    {
      id: 'typescript',
      name: 'TypeScript',
      type: 'tool',
      layer: 'development',
      purpose: 'Type checking and compilation',
      technologies: ['TypeScript'],
      files: ['tsconfig.json'],
      position: { x: 450, y: 200 },
      size: { width: 130, height: 60 },
      color: '#2196F3'
    },
    {
      id: 'tailwind',
      name: 'Tailwind CSS',
      type: 'tool',
      layer: 'development',
      purpose: 'CSS framework and styling',
      technologies: ['Tailwind CSS'],
      files: ['tailwind.config.js'],
      position: { x: 620, y: 200 },
      size: { width: 140, height: 60 },
      color: '#9C27B0'
    },
    {
      id: 'index-html',
      name: 'index.html',
      type: 'asset',
      layer: 'static',
      purpose: 'HTML entry point',
      technologies: ['HTML'],
      files: ['index.html'],
      position: { x: 100, y: 350 },
      size: { width: 120, height: 50 },
      color: '#E8F5E8'
    },
    {
      id: 'styles',
      name: 'CSS Styles',
      type: 'asset',
      layer: 'static',
      purpose: 'Application styles',
      technologies: ['CSS'],
      files: ['src/index.css'],
      position: { x: 100, y: 420 },
      size: { width: 120, height: 50 },
      color: '#E8F5E8'
    },
    {
      id: 'public-assets',
      name: 'Public Assets',
      type: 'asset',
      layer: 'static',
      purpose: 'Static assets',
      technologies: ['Assets'],
      files: ['public/'],
      position: { x: 100, y: 490 },
      size: { width: 120, height: 50 },
      color: '#E8F5E8'
    },
    {
      id: 'main-tsx',
      name: 'main.tsx',
      type: 'component',
      layer: 'source',
      purpose: 'Application entry point',
      technologies: ['React', 'TypeScript'],
      files: ['src/main.tsx'],
      position: { x: 450, y: 550 },
      size: { width: 140, height: 70 },
      color: '#F3E5F5'
    },
    {
      id: 'app-tsx',
      name: 'App.tsx',
      type: 'component',
      layer: 'source',
      purpose: 'Main application component',
      technologies: ['React', 'TypeScript'],
      files: ['src/App.tsx'],
      position: { x: 620, y: 550 },
      size: { width: 140, height: 70 },
      color: '#F3E5F5'
    },
    {
      id: 'components',
      name: 'Components',
      type: 'component',
      layer: 'source',
      purpose: 'UI components',
      technologies: ['React', 'TypeScript'],
      files: ['src/components/'],
      position: { x: 450, y: 650 },
      size: { width: 150, height: 70 },
      color: '#F3E5F5'
    },
    {
      id: 'github-api',
      name: 'GitHub API',
      type: 'service',
      layer: 'external',
      purpose: 'Repository data source',
      technologies: ['REST API'],
      files: [],
      position: { x: 1000, y: 250 },
      size: { width: 160, height: 60 },
      color: '#FFF3E0'
    },
    {
      id: 'gemini-api',
      name: 'Gemini AI API',
      type: 'service',
      layer: 'external',
      purpose: 'AI-powered analysis',
      technologies: ['AI', 'REST API'],
      files: [],
      position: { x: 1000, y: 330 },
      size: { width: 160, height: 60 },
      color: '#FFF3E0'
    }
  ],
  connections: [
    {
      id: 'browser-loads-html',
      source: 'browser',
      target: 'index-html',
      type: 'load',
      label: 'loads',
      description: 'Browser loads HTML entry point',
      style: 'solid',
      color: '#2196F3'
    },
    {
      id: 'browser-loads-styles',
      source: 'browser',
      target: 'styles',
      type: 'load',
      label: 'loads styles',
      description: 'Browser loads CSS styles',
      style: 'solid',
      color: '#2196F3'
    },
    {
      id: 'browser-runs-main',
      source: 'browser',
      target: 'main-tsx',
      type: 'http',
      label: 'bootstraps',
      description: 'Browser bootstraps React application',
      style: 'solid',
      color: '#4CAF50'
    },
    {
      id: 'vite-serves-browser',
      source: 'vite',
      target: 'browser',
      type: 'serve',
      label: 'serves HMR',
      description: 'Vite serves content with hot module reload',
      style: 'solid',
      color: '#4CAF50'
    },
    {
      id: 'vite-bundles-main',
      source: 'vite',
      target: 'main-tsx',
      type: 'transform',
      label: 'bundles',
      description: 'Vite bundles and transforms source code',
      style: 'solid',
      color: '#9C27B0'
    },
    {
      id: 'vite-processes-app',
      source: 'vite',
      target: 'app-tsx',
      type: 'transform',
      label: 'processes',
      description: 'Vite processes React components',
      style: 'solid',
      color: '#9C27B0'
    },
    {
      id: 'eslint-lints-main',
      source: 'eslint',
      target: 'main-tsx',
      type: 'config',
      label: 'lints',
      description: 'ESLint checks code quality',
      style: 'dotted',
      color: '#F44336'
    },
    {
      id: 'eslint-lints-app',
      source: 'eslint',
      target: 'app-tsx',
      type: 'config',
      label: 'lints',
      description: 'ESLint checks code quality',
      style: 'dotted',
      color: '#F44336'
    },
    {
      id: 'typescript-checks-main',
      source: 'typescript',
      target: 'main-tsx',
      type: 'config',
      label: 'type checks',
      description: 'TypeScript provides type checking',
      style: 'dashed',
      color: '#2196F3'
    },
    {
      id: 'main-renders-app',
      source: 'main-tsx',
      target: 'app-tsx',
      type: 'import',
      label: 'renders',
      description: 'Main component renders App component',
      style: 'solid',
      color: '#607D8B'
    },
    {
      id: 'app-uses-components',
      source: 'app-tsx',
      target: 'components',
      type: 'import',
      label: 'imports',
      description: 'App uses various UI components',
      style: 'solid',
      color: '#607D8B'
    },
    {
      id: 'components-call-github',
      source: 'components',
      target: 'github-api',
      type: 'http',
      label: 'GET requests',
      description: 'Components fetch repository data',
      style: 'solid',
      color: '#E91E63'
    },
    {
      id: 'components-call-gemini',
      source: 'components',
      target: 'gemini-api',
      type: 'http',
      label: 'POST requests',
      description: 'Components use AI analysis',
      style: 'solid',
      color: '#E91E63'
    }
  ],
  apiCalls: [
    {
      url: 'https://api.github.com/repos/{owner}/{repo}',
      method: 'GET',
      file: 'src/lib/github-api.ts',
      line: 45,
      context: 'const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`)',
      type: 'external'
    },
    {
      url: 'https://api.github.com/repos/{owner}/{repo}/contents',
      method: 'GET',
      file: 'src/lib/github-api.ts',
      line: 67,
      context: 'const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`)',
      type: 'external'
    },
    {
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      method: 'POST',
      file: 'src/lib/gemini-analyzer.ts',
      line: 123,
      context: 'const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`)',
      type: 'external'
    }
  ],
  buildTools: [
    {
      name: 'Vite',
      configFile: 'vite.config.ts',
      purpose: 'bundler',
      dependencies: ['vite', '@vitejs/plugin-react']
    },
    {
      name: 'ESLint',
      configFile: 'eslint.config.js',
      purpose: 'linter',
      dependencies: ['eslint', '@typescript-eslint/parser']
    },
    {
      name: 'TypeScript',
      configFile: 'tsconfig.json',
      purpose: 'transpiler',
      dependencies: ['typescript']
    },
    {
      name: 'Tailwind CSS',
      configFile: 'tailwind.config.js',
      purpose: 'transpiler',
      dependencies: ['tailwindcss', 'autoprefixer']
    }
  ],
  staticAssets: [
    'public/vite.svg',
    'src/assets/react.svg',
    'src/index.css'
  ],
  entryPoints: [
    'index.html',
    'src/main.tsx'
  ]
}

export function EnhancedVisualizationDemo() {
  const [showDemo, setShowDemo] = useState(false)

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Zap className="h-6 w-6" />
            Enhanced Architecture Visualization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose dark:prose-invert max-w-none">
            <p>
              Our enhanced backend now generates comprehensive system architecture diagrams similar to GitDiagram, 
              but with deeper analysis capabilities. This includes:
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Network className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <div className="font-medium">API Call Detection</div>
                <div className="text-sm text-muted-foreground">
                  Automatically finds fetch(), axios, WebSocket, and XHR calls
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <Settings className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <div className="font-medium">Build Tool Analysis</div>
                <div className="text-sm text-muted-foreground">
                  Identifies Vite, Webpack, ESLint, TypeScript, and other tools
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
              <Layers className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Multi-Layer Architecture</div>
                <div className="text-sm text-muted-foreground">
                  Separates runtime, development, static, source, and external layers
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <Globe className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <div className="font-medium">External Services</div>
                <div className="text-sm text-muted-foreground">
                  Maps connections to GitHub API, AI services, and other APIs
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
              <Code className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <div className="font-medium">Code Analysis</div>
                <div className="text-sm text-muted-foreground">
                  Parses actual file contents for accurate relationships
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-950/20">
              <Database className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <div className="font-medium">Interactive Exploration</div>
                <div className="text-sm text-muted-foreground">
                  Click components to see details, files, and API calls
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setShowDemo(!showDemo)}
              className="flex items-center gap-2"
            >
              <Layers className="h-4 w-4" />
              {showDemo ? 'Hide Demo' : 'Show Demo Architecture'}
            </Button>
            
            {showDemo && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">5 Layers</Badge>
                <Badge variant="secondary">13 Components</Badge>
                <Badge variant="secondary">14 Connections</Badge>
                <Badge variant="secondary">3 API Endpoints</Badge>
                <Badge variant="secondary">4 Build Tools</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Demo Visualization */}
      {showDemo && (
        <ArchitectureVisualizer 
          architecture={demoArchitecture}
          repo={{ owner: 'demo', name: 'demo', url: 'https://github.com/demo/demo' }}
          className="animate-in slide-in-from-top-4 duration-500"
        />
      )}

      {/* Comparison with GitDiagram */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Compares to GitDiagram</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3 text-green-600">✅ Our Advantages</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-green-600">•</span>
                  <span>Real code parsing vs AI interpretation</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">•</span>
                  <span>Progressive visualization modes</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">•</span>
                  <span>Interactive component exploration</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">•</span>
                  <span>Layer-based organization</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">•</span>
                  <span>No external AI API dependency</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3 text-blue-600">🔄 GitDiagram Strengths</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Works with any programming language</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Faster initial generation</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Simplified Mermaid.js output</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Direct GitHub URL integration</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Production-ready scalability</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default EnhancedVisualizationDemo
