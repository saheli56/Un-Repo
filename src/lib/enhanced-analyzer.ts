/**
 * Enhanced Repository Analyzer
 * Comprehensive analysis similar to GitDiagram's approach
 * Focuses on architecture, API calls, and system relationships
 */

import { GitHubAPI, GitHubFile } from './github-api'

export interface APICall {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  file: string
  line: number
  context: string
  type: 'fetch' | 'axios' | 'xhr' | 'websocket' | 'external'
}

export interface BuildTool {
  name: string
  configFile: string
  purpose: 'bundler' | 'transpiler' | 'linter' | 'formatter' | 'test' | 'deploy'
  dependencies: string[]
}

export interface ArchitectureLayer {
  id: string
  name: string
  type: 'runtime' | 'development' | 'build' | 'static' | 'source' | 'external'
  components: string[]
  description: string
  position: { x: number; y: number; width: number; height: number }
}

export interface SystemArchitecture {
  layers: ArchitectureLayer[]
  components: ArchitectureComponent[]
  connections: ArchitectureConnection[]
  apiCalls: APICall[]
  buildTools: BuildTool[]
  staticAssets: string[]
  entryPoints: string[]
}

export interface ArchitectureComponent {
  id: string
  name: string
  type: 'browser' | 'server' | 'config' | 'asset' | 'component' | 'service' | 'tool'
  layer: string
  purpose: string
  technologies: string[]
  files: string[]
  position: { x: number; y: number }
  size: { width: number; height: number }
  color: string
}

export interface ArchitectureConnection {
  id: string
  source: string
  target: string
  type: 'http' | 'import' | 'config' | 'build' | 'serve' | 'transform' | 'load'
  label: string
  description: string
  bidirectional?: boolean
  style: 'solid' | 'dashed' | 'dotted'
  color: string
}

export class EnhancedAnalyzer {
  private fileContents: Map<string, string> = new Map()
  private packageJson: Record<string, unknown> | null = null

  /**
   * Main analysis method - generates comprehensive system architecture
   */
  async analyzeRepository(owner: string, repoName: string): Promise<SystemArchitecture> {
    console.log(`🔍 Starting enhanced analysis for ${owner}/${repoName}`)
    
    // 1. Fetch repository information
    const repoResponse = await GitHubAPI.getRepository(owner, repoName)
    if (repoResponse.error || !repoResponse.data) {
      throw new Error(`Failed to fetch repository: ${repoResponse.error}`)
    }
    // Repository info stored for reference

    // 2. Get file structure and contents
    const files = await this.fetchRepositoryFiles(owner, repoName)
    console.log(`📁 Fetched ${files.length} files`)

    // 3. Parse package.json and dependencies
    await this.parsePackageJson(owner, repoName)

    // 4. Analyze file contents for API calls and patterns
    const apiCalls = await this.extractAPIcalls(files)
    console.log(`🌐 Found ${apiCalls.length} API calls`)

    // 5. Identify build tools and configuration
    const buildTools = this.identifyBuildTools(files)
    console.log(`🔧 Identified ${buildTools.length} build tools`)

    // 6. Create architecture layers and components
    const architecture = this.createSystemArchitecture(files, apiCalls, buildTools)
    console.log(`🏗️ Created architecture with ${architecture.layers.length} layers`)

    return architecture
  }

  /**
   * Fetch repository files with content analysis
   */
  private async fetchRepositoryFiles(owner: string, repo: string): Promise<Array<{path: string, content: string, type: string}>> {
    const files: Array<{path: string, content: string, type: string}> = []
    
    // Get repository contents recursively
    const contents = await this.getDirectoryContents(owner, repo, '')
    
    // Priority files to analyze (similar to GitDiagram's filtering)
    const priorityPatterns = [
      /package\.json$/,
      /vite\.config\.(ts|js)$/,
      /webpack\.config\.(ts|js)$/,
      /tsconfig\.json$/,
      /eslint\.config\.(ts|js)$/,
      /tailwind\.config\.(ts|js)$/,
      /index\.html$/,
      /main\.(tsx?|jsx?)$/,
      /index\.(tsx?|jsx?)$/,
      /App\.(tsx?|jsx?)$/,
      /.*\.(tsx?|jsx?)$/,
      /.*\.css$/,
      /\.env/,
      /dockerfile/i,
      /docker-compose/,
      /.*\.md$/
    ]

    for (const file of contents) {
      if (file.type === 'file') {
        const isPriority = priorityPatterns.some(pattern => pattern.test(file.path))
        
        if (isPriority || files.length < 50) { // Limit total files analyzed
          try {
            const contentResponse = await GitHubAPI.getFileContent(owner, repo, file.path)
            if (contentResponse.data && contentResponse.data.content) {
              files.push({
                path: file.path,
                content: contentResponse.data.content,
                type: this.getFileType(file.path)
              })
              this.fileContents.set(file.path, contentResponse.data.content)
            }
          } catch (error) {
            console.warn(`Failed to fetch content for ${file.path}:`, error)
          }
        }
      }
    }

    return files
  }

  /**
   * Recursively get directory contents
   */
  private async getDirectoryContents(owner: string, repo: string, path: string): Promise<GitHubFile[]> {
    const response = await GitHubAPI.getRepositoryContents(owner, repo, path)
    if (response.error || !response.data) {
      return []
    }

    const files: GitHubFile[] = []
    const directories: GitHubFile[] = []

    // Separate files and directories
    for (const item of response.data) {
      if (item.type === 'file') {
        files.push(item)
      } else if (item.type === 'dir' && this.shouldAnalyzeDirectory(item.name)) {
        directories.push(item)
      }
    }

    // Recursively get directory contents (limited depth)
    for (const dir of directories.slice(0, 10)) { // Limit directories
      const subFiles = await this.getDirectoryContents(owner, repo, dir.path)
      files.push(...subFiles)
    }

    return files
  }

  /**
   * Check if directory should be analyzed
   */
  private shouldAnalyzeDirectory(name: string): boolean {
    const excludePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.nyc_output',
      'vendor',
      '__pycache__'
    ]
    
    return !excludePatterns.includes(name.toLowerCase())
  }

  /**
   * Get file type based on extension and content
   */
  private getFileType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()
    const filename = path.split('/').pop()?.toLowerCase()

    if (filename === 'package.json') return 'package'
    if (filename === 'index.html') return 'entry-html'
    if (path.includes('config')) return 'config'
    if (path.includes('test') || path.includes('spec')) return 'test'
    if (ext === 'md') return 'docs'
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) {
      if (filename?.includes('main') || filename?.includes('index')) return 'entry'
      if (filename?.includes('app')) return 'app'
      return 'source'
    }
    if (['css', 'scss', 'sass'].includes(ext || '')) return 'style'
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico'].includes(ext || '')) return 'asset'
    
    return 'other'
  }

  /**
   * Parse package.json for dependencies and scripts
   */
  private async parsePackageJson(owner: string, repo: string): Promise<void> {
    try {
      const response = await GitHubAPI.getFileContent(owner, repo, 'package.json')
      if (response.data && response.data.content) {
        this.packageJson = JSON.parse(response.data.content)
      }
    } catch (error) {
      console.warn('Could not parse package.json:', error)
    }
  }

  /**
   * Extract API calls from source files
   */
  private async extractAPIcalls(files: Array<{path: string, content: string, type: string}>): Promise<APICall[]> {
    const apiCalls: APICall[] = []
    
    // Patterns to detect API calls
    const patterns = [
      // fetch API
      {
        regex: /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
        type: 'fetch' as const,
        method: 'GET' as const
      },
      {
        regex: /fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{[\s\S]*?method\s*:\s*['"`](\w+)['"`]/g,
        type: 'fetch' as const,
        method: null // Will be extracted from match
      },
      // axios
      {
        regex: /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
        type: 'axios' as const,
        method: null // Will be extracted from match
      },
      {
        regex: /axios\s*\(\s*\{[\s\S]*?url\s*:\s*['"`]([^'"`]+)['"`][\s\S]*?method\s*:\s*['"`](\w+)['"`]/g,
        type: 'axios' as const,
        method: null
      },
      // WebSocket
      {
        regex: /new\s+WebSocket\s*\(\s*['"`]([^'"`]+)['"`]/g,
        type: 'websocket' as const,
        method: 'GET' as const
      },
      // XMLHttpRequest
      {
        regex: /\.open\s*\(\s*['"`](\w+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
        type: 'xhr' as const,
        method: null
      }
    ]

    for (const file of files) {
      if (file.type === 'source' || file.type === 'entry' || file.type === 'app') {
        const lines = file.content.split('\n')
        
        for (const pattern of patterns) {
          let match
          pattern.regex.lastIndex = 0 // Reset regex
          
          while ((match = pattern.regex.exec(file.content)) !== null) {
            const lineNumber = file.content.substring(0, match.index).split('\n').length
            const context = lines[lineNumber - 1]?.trim() || ''
            
            let url: string
            let method: string
            
            if (pattern.method === null) {
              // Extract method from match
              if (pattern.type === 'axios' && match[1]) {
                method = match[1].toUpperCase()
                url = match[2]
              } else if (match[2] && match[1]) {
                method = match[1].toUpperCase()
                url = match[2]
              } else {
                method = 'GET'
                url = match[1]
              }
            } else {
              method = pattern.method
              url = match[1]
            }

            // Determine if it's external or internal
            const isExternal = url.startsWith('http') || url.startsWith('ws')
            
            apiCalls.push({
              url,
              method: method as APICall['method'],
              file: file.path,
              line: lineNumber,
              context,
              type: isExternal ? 'external' : pattern.type
            })
          }
        }
      }
    }

    return apiCalls
  }

  /**
   * Identify build tools and configuration
   */
  private identifyBuildTools(files: Array<{path: string, content: string, type: string}>): BuildTool[] {
    const buildTools: BuildTool[] = []
    
    // Check for common build tools
    const toolConfigs = [
      {
        pattern: /vite\.config\.(ts|js)$/,
        name: 'Vite',
        purpose: 'bundler' as const,
        dependencies: ['@vitejs/plugin-react', 'vite']
      },
      {
        pattern: /webpack\.config\.(ts|js)$/,
        name: 'Webpack',
        purpose: 'bundler' as const,
        dependencies: ['webpack', 'webpack-cli']
      },
      {
        pattern: /eslint\.config\.(ts|js)$|\.eslintrc/,
        name: 'ESLint',
        purpose: 'linter' as const,
        dependencies: ['eslint']
      },
      {
        pattern: /prettier\.config\.(ts|js)$|\.prettierrc/,
        name: 'Prettier',
        purpose: 'formatter' as const,
        dependencies: ['prettier']
      },
      {
        pattern: /tailwind\.config\.(ts|js)$/,
        name: 'Tailwind CSS',
        purpose: 'transpiler' as const,
        dependencies: ['tailwindcss']
      },
      {
        pattern: /tsconfig\.json$/,
        name: 'TypeScript',
        purpose: 'transpiler' as const,
        dependencies: ['typescript']
      },
      {
        pattern: /jest\.config\.(ts|js)$|\.jestrc/,
        name: 'Jest',
        purpose: 'test' as const,
        dependencies: ['jest']
      },
      {
        pattern: /vitest\.config\.(ts|js)$/,
        name: 'Vitest',
        purpose: 'test' as const,
        dependencies: ['vitest']
      },
      {
        pattern: /dockerfile$/i,
        name: 'Docker',
        purpose: 'deploy' as const,
        dependencies: []
      },
      {
        pattern: /docker-compose/,
        name: 'Docker Compose',
        purpose: 'deploy' as const,
        dependencies: []
      }
    ]

    for (const file of files) {
      for (const tool of toolConfigs) {
        if (tool.pattern.test(file.path)) {
          // Check if dependencies exist in package.json
          const actualDeps = this.packageJson ? [
            ...Object.keys(this.packageJson.dependencies || {}),
            ...Object.keys(this.packageJson.devDependencies || {})
          ] : []

          const foundDeps = tool.dependencies.filter(dep => actualDeps.includes(dep))

          buildTools.push({
            name: tool.name,
            configFile: file.path,
            purpose: tool.purpose,
            dependencies: foundDeps
          })
        }
      }
    }

    return buildTools
  }

  /**
   * Create comprehensive system architecture
   */
  private createSystemArchitecture(
    files: Array<{path: string, content: string, type: string}>,
    apiCalls: APICall[],
    buildTools: BuildTool[]
  ): SystemArchitecture {
    
    // Define architecture layers (similar to GitDiagram's approach)
    const layers: ArchitectureLayer[] = [
      {
        id: 'runtime',
        name: 'Browser (Runtime)',
        type: 'runtime',
        components: [],
        description: 'Client-side runtime environment',
        position: { x: 50, y: 50, width: 300, height: 200 }
      },
      {
        id: 'development',
        name: 'Dev/Build Pipeline',
        type: 'development',
        components: [],
        description: 'Development tools and build process',
        position: { x: 400, y: 50, width: 500, height: 400 }
      },
      {
        id: 'static',
        name: 'Static Assets',
        type: 'static',
        components: [],
        description: 'Static files and assets',
        position: { x: 50, y: 300, width: 300, height: 250 }
      },
      {
        id: 'source',
        name: 'Source Code',
        type: 'source',
        components: [],
        description: 'Application source code',
        position: { x: 400, y: 500, width: 500, height: 300 }
      },
      {
        id: 'external',
        name: 'External Services',
        type: 'external',
        components: [],
        description: 'External APIs and services',
        position: { x: 950, y: 200, width: 300, height: 400 }
      }
    ]

    // Create components based on files and analysis
    const components: ArchitectureComponent[] = []
    const connections: ArchitectureConnection[] = []

    // 1. Runtime components
    const browserComponent: ArchitectureComponent = {
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
    }
    components.push(browserComponent)
    layers[0].components.push(browserComponent.id)

    // 2. Build tools components
    let yOffset = 100
    for (const tool of buildTools) {
      const component: ArchitectureComponent = {
        id: tool.name.toLowerCase().replace(/\s+/g, '-'),
        name: tool.name,
        type: 'tool',
        layer: 'development',
        purpose: `${tool.purpose} tool`,
        technologies: tool.dependencies,
        files: [tool.configFile],
        position: { x: 450 + (yOffset % 2) * 200, y: yOffset },
        size: { width: 150, height: 60 },
        color: this.getToolColor(tool.purpose)
      }
      components.push(component)
      layers[1].components.push(component.id)
      yOffset += 80
    }

    // 3. Source code components - Enhanced for React apps
    const entryFiles = files.filter(f => f.type === 'entry' || f.type === 'app')
    const sourceFiles = files.filter(f => f.type === 'source')
    
    // Prioritize React components and important files
    const reactComponents = sourceFiles.filter(f => 
      f.path.endsWith('.tsx') || f.path.endsWith('.jsx') || 
      f.path.includes('component') || f.path.includes('Component')
    )
    const otherSourceFiles = sourceFiles.filter(f => !reactComponents.includes(f))
    
    // Show more components for React apps (up to 12 instead of 5)
    const maxComponents = reactComponents.length > 0 ? 12 : 8
    const filesToShow = [
      ...entryFiles,
      ...reactComponents.slice(0, 8), // Prioritize React components
      ...otherSourceFiles.slice(0, maxComponents - entryFiles.length - Math.min(8, reactComponents.length))
    ].slice(0, maxComponents)
    
    let sourceYOffset = 550
    for (const file of filesToShow) {
      const isReactComponent = file.path.endsWith('.tsx') || file.path.endsWith('.jsx')
      const component: ArchitectureComponent = {
        id: file.path.replace(/[^\w]/g, '-'),
        name: file.path.split('/').pop() || file.path,
        type: 'component',
        layer: 'source',
        purpose: this.getFilePurpose(file),
        technologies: isReactComponent ? 
          [...this.getFileTechnologies(file), 'React'] : 
          this.getFileTechnologies(file),
        files: [file.path],
        position: { x: 450 + (sourceYOffset % 2) * 200, y: sourceYOffset },
        size: { width: 180, height: 70 },
        color: isReactComponent ? '#E3F2FD' : '#F3E5F5' // Blue tint for React components
      }
      components.push(component)
      layers[3].components.push(component.id)
      sourceYOffset += 90
    }

    // 4. Static assets
    const staticFiles = files.filter(f => f.type === 'asset' || f.type === 'style' || f.path === 'index.html')
    let staticYOffset = 350
    for (const file of staticFiles.slice(0, 4)) {
      const component: ArchitectureComponent = {
        id: file.path.replace(/[^\w]/g, '-'),
        name: file.path.split('/').pop() || file.path,
        type: 'asset',
        layer: 'static',
        purpose: 'Static asset',
        technologies: [this.getFileType(file.path)],
        files: [file.path],
        position: { x: 100, y: staticYOffset },
        size: { width: 150, height: 50 },
        color: '#E8F5E8'
      }
      components.push(component)
      layers[2].components.push(component.id)
      staticYOffset += 70
    }

    // 5. External services from API calls
    const externalServices = new Set(
      apiCalls
        .filter(call => call.type === 'external')
        .map(call => new URL(call.url).hostname)
    )

    let externalYOffset = 250
    for (const service of Array.from(externalServices).slice(0, 5)) {
      const component: ArchitectureComponent = {
        id: service.replace(/[^\w]/g, '-'),
        name: service,
        type: 'service',
        layer: 'external',
        purpose: 'External API service',
        technologies: ['HTTP', 'REST'],
        files: [],
        position: { x: 1000, y: externalYOffset },
        size: { width: 200, height: 60 },
        color: '#FFF3E0'
      }
      components.push(component)
      layers[4].components.push(component.id)
      externalYOffset += 80
    }

    // Create connections
    this.createArchitectureConnections(components, apiCalls, buildTools, connections)

    return {
      layers,
      components,
      connections,
      apiCalls,
      buildTools,
      staticAssets: files.filter(f => f.type === 'asset' || f.type === 'style').map(f => f.path),
      entryPoints: files.filter(f => f.type === 'entry' || f.type === 'entry-html').map(f => f.path)
    }
  }

  /**
   * Create connections between architecture components
   */
  private createArchitectureConnections(
    components: ArchitectureComponent[],
    apiCalls: APICall[],
    buildTools: BuildTool[],
    connections: ArchitectureConnection[]
  ): void {
    
    // 1. Browser loads static assets
    const browserComp = components.find(c => c.id === 'browser')
    const staticComps = components.filter(c => c.layer === 'static')
    
    if (browserComp) {
      for (const staticComp of staticComps) {
        connections.push({
          id: `${browserComp.id}-loads-${staticComp.id}`,
          source: browserComp.id,
          target: staticComp.id,
          type: 'load',
          label: staticComp.name.endsWith('.css') ? 'loads styles' : 'loads',
          description: `Browser loads ${staticComp.name}`,
          style: 'solid',
          color: '#2196F3'
        })
      }

      // Browser runs source code
      const mainEntry = components.find(c => c.files.some(f => f.includes('main.') || f.includes('index.')))
      if (mainEntry) {
        connections.push({
          id: `${browserComp.id}-runs-${mainEntry.id}`,
          source: browserComp.id,
          target: mainEntry.id,
          type: 'http',
          label: 'bootstraps',
          description: 'Browser bootstraps application',
          style: 'solid',
          color: '#4CAF50'
        })
      }
    }

    // 2. Build tool connections
    for (const tool of buildTools) {
      const toolComp = components.find(c => c.name === tool.name)
      if (!toolComp) continue

      // Package.json configures tools
      const packageComp = components.find(c => c.files.includes('package.json'))
      if (packageComp) {
        connections.push({
          id: `${packageComp.id}-configures-${toolComp.id}`,
          source: packageComp.id,
          target: toolComp.id,
          type: 'config',
          label: 'scripts & deps',
          description: 'Package.json configures build tool',
          style: 'dashed',
          color: '#FF9800'
        })
      }

      // Tools process source code
      if (tool.purpose === 'bundler' || tool.purpose === 'transpiler') {
        const sourceComps = components.filter(c => c.layer === 'source')
        for (const sourceComp of sourceComps.slice(0, 3)) {
          connections.push({
            id: `${toolComp.id}-processes-${sourceComp.id}`,
            source: toolComp.id,
            target: sourceComp.id,
            type: 'transform',
            label: tool.purpose === 'bundler' ? 'bundles' : 'transforms',
            description: `${tool.name} processes source code`,
            style: 'solid',
            color: '#9C27B0'
          })
        }
      }

      // Linters check code
      if (tool.purpose === 'linter') {
        const sourceComps = components.filter(c => c.layer === 'source')
        for (const sourceComp of sourceComps.slice(0, 3)) {
          connections.push({
            id: `${toolComp.id}-lints-${sourceComp.id}`,
            source: toolComp.id,
            target: sourceComp.id,
            type: 'config',
            label: 'lints',
            description: `${tool.name} checks code quality`,
            style: 'dotted',
            color: '#F44336'
          })
        }
      }
    }

    // 3. API call connections
    for (const apiCall of apiCalls) {
      const sourceComp = components.find(c => c.files.includes(apiCall.file))
      if (!sourceComp) continue

      if (apiCall.type === 'external') {
        try {
          const hostname = new URL(apiCall.url).hostname
          const externalComp = components.find(c => c.id === hostname.replace(/[^\w]/g, '-'))
          
          if (externalComp) {
            connections.push({
              id: `${sourceComp.id}-calls-${externalComp.id}`,
              source: sourceComp.id,
              target: externalComp.id,
              type: 'http',
              label: `${apiCall.method} request`,
              description: `Makes ${apiCall.method} request to ${apiCall.url}`,
              style: 'solid',
              color: '#E91E63'
            })
          }
        } catch {
          // Handle invalid URLs
          console.warn('Invalid URL for API call:', apiCall.url)
        }
      }
    }

    // 4. Enhanced Component relationships - Connect ALL components
    const entryComp = components.find(c => c.files.some(f => f.includes('main.') || f.includes('App.')))
    const sourceComps = components.filter(c => c.layer === 'source')
    
    // Main entry connects to other source components
    if (entryComp) {
      const otherSourceComps = sourceComps.filter(c => c !== entryComp)
      for (const comp of otherSourceComps) {
        connections.push({
          id: `${entryComp.id}-imports-${comp.id}`,
          source: entryComp.id,
          target: comp.id,
          type: 'import',
          label: 'imports',
          description: `${entryComp.name} imports ${comp.name}`,
          style: 'solid',
          color: '#607D8B'
        })
      }
    }

    // 5. Connect similar file types (e.g., all .tsx files)
    const componentFiles = sourceComps.filter(c => c.files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx')))
    for (let i = 0; i < componentFiles.length; i++) {
      for (let j = i + 1; j < Math.min(componentFiles.length, i + 3); j++) {
        const comp1 = componentFiles[i]
        const comp2 = componentFiles[j]
        
        // Don't duplicate existing connections
        const existingConnection = connections.find(c => 
          (c.source === comp1.id && c.target === comp2.id) ||
          (c.source === comp2.id && c.target === comp1.id)
        )
        
        if (!existingConnection) {
          connections.push({
            id: `${comp1.id}-relates-${comp2.id}`,
            source: comp1.id,
            target: comp2.id,
            type: 'import',
            label: 'shares context',
            description: `${comp1.name} and ${comp2.name} are related components`,
            style: 'dashed',
            color: '#9E9E9E'
          })
        }
      }
    }

    // 6. Connect configuration files to their respective components
    const configFiles = components.filter(c => 
      c.files.some(f => f.includes('config') || f.includes('.json') || f.includes('.yml'))
    )
    
    for (const configComp of configFiles) {
      const relatedComps = sourceComps.filter(c => 
        configComp.files.some(configFile => {
          const configName = configFile.split('/').pop()?.split('.')[0] // Get filename without extension
          return c.files.some(sourceFile => sourceFile.includes(configName || ''))
        })
      )
      
      for (const relatedComp of relatedComps.slice(0, 2)) {
        connections.push({
          id: `${configComp.id}-configures-${relatedComp.id}`,
          source: configComp.id,
          target: relatedComp.id,
          type: 'config',
          label: 'configures',
          description: `${configComp.name} provides configuration for ${relatedComp.name}`,
          style: 'dotted',
          color: '#795548'
        })
      }
    }

    // 7. Ensure no isolated components - connect orphaned nodes
    const connectedComponentIds = new Set([
      ...connections.map(c => c.source),
      ...connections.map(c => c.target)
    ])
    
    const orphanedComponents = components.filter(c => !connectedComponentIds.has(c.id))
    
    for (const orphan of orphanedComponents) {
      // Connect to the most relevant component
      const similarLayerComps = components.filter(c => 
        c.layer === orphan.layer && c !== orphan && connectedComponentIds.has(c.id)
      )
      
      if (similarLayerComps.length > 0) {
        const target = similarLayerComps[0]
        connections.push({
          id: `${orphan.id}-relates-${target.id}`,
          source: orphan.id,
          target: target.id,
          type: 'import',
          label: 'related to',
          description: `${orphan.name} is related to ${target.name}`,
          style: 'dashed',
          color: '#BDBDBD'
        })
      } else if (entryComp && orphan !== entryComp) {
        // Connect to main entry as fallback
        connections.push({
          id: `${entryComp.id}-uses-${orphan.id}`,
          source: entryComp.id,
          target: orphan.id,
          type: 'import',
          label: 'may use',
          description: `${entryComp.name} may use ${orphan.name}`,
          style: 'dotted',
          color: '#E0E0E0'
        })
      }
    }
  }

  /**
   * Get color for build tool based on purpose
   */
  private getToolColor(purpose: string): string {
    const colors = {
      'bundler': '#4CAF50',
      'transpiler': '#2196F3', 
      'linter': '#FF9800',
      'formatter': '#9C27B0',
      'test': '#F44336',
      'deploy': '#795548'
    }
    return colors[purpose as keyof typeof colors] || '#757575'
  }

  /**
   * Get file purpose description
   */
  private getFilePurpose(file: {path: string, content: string, type: string}): string {
    const fileName = file.path.split('/').pop()?.toLowerCase() || ''
    const content = file.content.toLowerCase()
    const isReact = file.path.endsWith('.tsx') || file.path.endsWith('.jsx')
    
    if (fileName.includes('main') || fileName.includes('index')) {
      return isReact ? 'React app entry point' : 'Application entry point'
    }
    if (fileName.includes('app')) {
      return isReact ? 'Main React app component' : 'Main application component'
    }
    
    // Enhanced React component detection
    if (isReact) {
      if (content.includes('usestate') || content.includes('useeffect')) {
        if (fileName.includes('page') || fileName.includes('screen')) {
          return 'React page component (with hooks)'
        }
        return 'Interactive React component'
      }
      if (fileName.includes('page') || fileName.includes('screen') || fileName.includes('view')) {
        return 'React page component'
      }
      if (fileName.includes('button') || fileName.includes('input') || fileName.includes('form')) {
        return 'React UI component'
      }
      if (fileName.includes('modal') || fileName.includes('dialog') || fileName.includes('popup')) {
        return 'React modal component'
      }
      if (fileName.includes('layout') || fileName.includes('header') || fileName.includes('footer')) {
        return 'React layout component'
      }
      if (content.includes('export default function') || content.includes('export function')) {
        return 'React functional component'
      }
      return 'React component'
    }
    
    if (fileName.includes('component')) {
      return 'UI component'
    }
    if (fileName.includes('service') || fileName.includes('api')) {
      return 'Service or API integration'
    }
    if (fileName.includes('util') || fileName.includes('helper')) {
      return 'Utility functions'
    }
    if (fileName.includes('hook')) {
      return 'React hook'
    }
    if (fileName.includes('context')) {
      return 'React context provider'
    }
    if (fileName.includes('store') || fileName.includes('reducer')) {
      return 'State management'
    }
    
    return 'Source code module'
  }

  /**
   * Get technologies used in file
   */
  private getFileTechnologies(file: {path: string, content: string, type: string}): string[] {
    const technologies: string[] = []
    const ext = file.path.split('.').pop()?.toLowerCase()
    
    if (ext === 'tsx' || file.content.includes('import React')) {
      technologies.push('React', 'TypeScript')
    } else if (ext === 'jsx') {
      technologies.push('React', 'JavaScript')
    } else if (ext === 'ts') {
      technologies.push('TypeScript')
    } else if (ext === 'js') {
      technologies.push('JavaScript')
    }
    
    // Check for specific libraries
    if (file.content.includes('tailwind') || file.content.includes('className')) {
      technologies.push('Tailwind CSS')
    }
    if (file.content.includes('axios')) {
      technologies.push('Axios')
    }
    if (file.content.includes('fetch(')) {
      technologies.push('Fetch API')
    }
    if (file.content.includes('useState') || file.content.includes('useEffect')) {
      technologies.push('React Hooks')
    }
    
    return technologies
  }
}

export const enhancedAnalyzer = new EnhancedAnalyzer()
