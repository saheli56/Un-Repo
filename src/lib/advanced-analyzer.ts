/**
 * Advanced Repository Analyzer
 * Combines GitHub API data with intelligent file analysis for comprehensive understanding
 */

import { GitHubAPI } from './github-api'
import { GeminiAnalyzer, CodeAnalysisRequest, GeminiAnalysisResponse } from './gemini-analyzer'
import { FileContentCache } from './cache-manager'
import { FileNode, GitHubRepo, RepoAnalysis } from '@/types'

export type EntryPointType = 'main' | 'server' | 'client' | 'script' | 'test' | 'config'
export type DataFlowType = 'import' | 'function_call' | 'data_passing' | 'event'
export type NodeType = 'entry' | 'component' | 'service' | 'config' | 'data' | 'utility' | 'test'
export type EdgeType = 'imports' | 'extends' | 'uses' | 'calls' | 'renders' | 'configures' | 'tests'

export interface AdvancedRepoAnalysis extends RepoAnalysis {
  aiInsights?: GeminiAnalysisResponse
  codeStructure: {
    entryPoints: Array<{
      file: string
      type: 'main' | 'server' | 'client' | 'script' | 'test' | 'config'
      confidence: number
    }>
    keyComponents: Array<{
      file: string
      role: string
      importance: number
      dependencies: string[]
    }>
    dataFlow: Array<{
      from: string
      to: string
      type: 'import' | 'function_call' | 'data_passing' | 'event'
      description: string
    }>
  }
  visualization: {
    nodes: Array<{
      id: string
      label: string
      type: 'entry' | 'component' | 'service' | 'config' | 'data' | 'utility' | 'test'
      file: FileNode
      position: { x: number; y: number }
      size: { width: number; height: number }
      importance: number
      color: string
    }>
    edges: Array<{
      id: string
      source: string
      target: string
      type: 'imports' | 'extends' | 'uses' | 'calls' | 'renders' | 'configures' | 'tests'
      label: string
      strength: number
      color: string
    }>
  }
}

export class AdvancedAnalyzer {
  
  /**
   * Perform comprehensive repository analysis with AI insights
   */
  static async analyzeRepositoryAdvanced(
    repo: GitHubRepo,
    structure: FileNode,
    useAI: boolean = true
  ): Promise<AdvancedRepoAnalysis> {
    console.log(`🔬 Starting advanced analysis for ${repo.owner}/${repo.name}`)

    try {
      // 1. Analyze file structure and identify key files
      const keyFiles = await this.identifyKeyFiles(repo, structure)
      
      // 2. Analyze code relationships and dependencies
      const codeStructure = await this.analyzeCodeStructure(repo, keyFiles)
      
      // 3. Generate visualization data
      const visualization = await this.generateVisualization(keyFiles, codeStructure)
      
      // 4. Get basic analysis (your existing analysis)
      const basicAnalysis = await this.getBasicAnalysis(repo, structure)
      
      // 5. Enhance with AI insights if available and requested
      let aiInsights: GeminiAnalysisResponse | undefined
      if (useAI && GeminiAnalyzer.isConfigured()) {
        try {
          aiInsights = await this.getAIInsights(repo, structure, keyFiles)
        } catch (error) {
          console.warn('AI analysis failed, continuing without AI insights:', error)
        }
      }

      return {
        ...basicAnalysis,
        aiInsights,
        codeStructure,
        visualization
      }
    } catch (error) {
      console.error('Advanced analysis failed:', error)
      throw error
    }
  }

  /**
   * Identify the most important files in the repository
   */
  private static async identifyKeyFiles(
    repo: GitHubRepo,
    structure: FileNode
  ): Promise<Array<{ file: FileNode; content: string; type: string; importance: number }>> {
    const keyFiles: Array<{ file: FileNode; content: string; type: string; importance: number }> = []
    const filesToAnalyze: Array<{ file: FileNode; type: string; importance: number }> = []
    
    // Recursively find important files
    const findImportantFiles = (node: FileNode, depth: number = 0) => {
      if (depth > 3) return // Limit depth to avoid too many files
      
      if (node.type === 'file') {
        const importance = this.calculateFileImportance(node.path, node.name)
        if (importance > 3) { // Only include moderately important files
          filesToAnalyze.push({
            file: node,
            type: this.getFileType(node.path, node.name),
            importance
          })
        }
      } else if (node.children) {
        node.children.forEach(child => findImportantFiles(child, depth + 1))
      }
    }

    findImportantFiles(structure)
    
    // Sort by importance and take top 15 files
    const topFiles = filesToAnalyze
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 15)

    // Fetch content for these files
    for (const { file, type, importance } of topFiles) {
      try {
        let content = FileContentCache.getFile(repo.owner, repo.name, file.path)
        
        if (!content) {
          const response = await GitHubAPI.getFileContent(repo.owner, repo.name, file.path)
          if (response.data?.content) {
            content = response.data.content
            FileContentCache.cacheFile(repo.owner, repo.name, file.path, content)
          }
        }

        if (content) {
          keyFiles.push({
            file,
            content: content.slice(0, 5000), // Limit content size
            type,
            importance
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch content for ${file.path}:`, error)
      }
    }

    console.log(`📋 Identified ${keyFiles.length} key files for analysis`)
    return keyFiles
  }

  /**
   * Calculate file importance based on name and path
   */
  private static calculateFileImportance(path: string, name: string): number {
    let importance = 0
    const lowerPath = path.toLowerCase()
    const lowerName = name.toLowerCase()

    // Entry points (very high importance)
    if (['index.js', 'main.js', 'app.js', 'index.ts', 'main.ts', 'app.ts'].includes(lowerName)) importance += 10
    if (['server.js', 'server.ts', 'index.html'].includes(lowerName)) importance += 9
    
    // Configuration files (high importance)
    if (['package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.ts'].includes(lowerName)) importance += 8
    if (lowerName.includes('config') || lowerName.includes('setup')) importance += 6
    
    // Core application files
    if (lowerPath.includes('/src/') && !lowerPath.includes('/test')) importance += 5
    if (lowerPath.includes('/components/') || lowerPath.includes('/pages/')) importance += 4
    if (lowerPath.includes('/utils/') || lowerPath.includes('/lib/')) importance += 3
    if (lowerPath.includes('/api/') || lowerPath.includes('/services/')) importance += 4
    
    // Documentation
    if (['readme.md', 'readme.txt'].includes(lowerName)) importance += 7
    
    // Reduce importance for certain paths
    if (lowerPath.includes('/node_modules/')) importance -= 10
    if (lowerPath.includes('/test/') || lowerPath.includes('/__tests__/')) importance -= 2
    if (lowerPath.includes('/dist/') || lowerPath.includes('/build/')) importance -= 5

    return Math.max(0, importance)
  }

  /**
   * Determine file type based on path and content
   */
  private static getFileType(path: string, name: string): string {
    const lowerPath = path.toLowerCase()
    const lowerName = name.toLowerCase()

    if (['index.js', 'main.js', 'app.js', 'index.ts', 'main.ts', 'app.ts', 'server.js'].includes(lowerName)) {
      return 'entry'
    }
    if (lowerName.includes('config') || ['package.json', 'tsconfig.json'].includes(lowerName)) {
      return 'config'
    }
    if (lowerPath.includes('/components/') || lowerPath.includes('/component/')) {
      return 'component'
    }
    if (lowerPath.includes('/api/') || lowerPath.includes('/services/')) {
      return 'api'
    }
    if (lowerPath.includes('/utils/') || lowerPath.includes('/lib/') || lowerPath.includes('/helpers/')) {
      return 'utility'
    }
    if (lowerPath.includes('/test/') || lowerName.includes('test') || lowerName.includes('spec')) {
      return 'test'
    }
    if (lowerName.includes('readme') || path.endsWith('.md')) {
      return 'docs'
    }
    
    return 'component'
  }

  /**
   * Analyze code structure and relationships
   */
  private static async analyzeCodeStructure(
    _repo: GitHubRepo,
    keyFiles: Array<{ file: FileNode; content: string; type: string; importance: number }>
  ): Promise<AdvancedRepoAnalysis['codeStructure']> {
    const entryPoints: Array<{ file: string; type: EntryPointType; confidence: number }> = []
    const keyComponents: Array<{ file: string; role: string; importance: number; dependencies: string[] }> = []
    const dataFlow: Array<{ from: string; to: string; type: DataFlowType; description: string }> = []

    for (const { file, content, type, importance } of keyFiles) {
      // Identify entry points
      if (type === 'entry' || importance >= 8) {
        entryPoints.push({
          file: file.path,
          type: this.detectEntryPointType(file.path, content),
          confidence: importance / 10
        })
      }

      // Analyze dependencies
      const dependencies = this.extractDependencies(content)
      
      keyComponents.push({
        file: file.path,
        role: this.determineFileRole(file.path, content, type),
        importance,
        dependencies
      })

      // Analyze data flow
      const flows = this.extractDataFlow(file.path, content)
      dataFlow.push(...flows)
    }

    return {
      entryPoints: entryPoints.slice(0, 5), // Top 5 entry points
      keyComponents: keyComponents.sort((a, b) => b.importance - a.importance),
      dataFlow: dataFlow.slice(0, 20) // Top 20 data flows
    }
  }

  /**
   * Extract import/require dependencies from code
   */
  private static extractDependencies(content: string): string[] {
    const dependencies: string[] = []
    
    // JavaScript/TypeScript imports
    const importRegex = /import.*?from\s+['"`](.*?)['"`]/g
    const requireRegex = /require\s*\(\s*['"`](.*?)['"`]\s*\)/g
    
    let match
    while ((match = importRegex.exec(content)) !== null) {
      if (!match[1].startsWith('.')) continue // Only local imports
      dependencies.push(match[1])
    }
    
    while ((match = requireRegex.exec(content)) !== null) {
      if (!match[1].startsWith('.')) continue // Only local imports
      dependencies.push(match[1])
    }

    return [...new Set(dependencies)] // Remove duplicates
  }

  /**
   * Extract data flow patterns from code
   */
  private static extractDataFlow(filePath: string, content: string): Array<{ from: string; to: string; type: DataFlowType; description: string }> {
    const flows: Array<{ from: string; to: string; type: DataFlowType; description: string }> = []
    
    // Simple pattern matching for common data flow patterns
    const functionCallRegex = /(\w+)\s*\.\s*(\w+)\s*\(/g
    let match
    
    while ((match = functionCallRegex.exec(content)) !== null && flows.length < 5) {
      flows.push({
        from: filePath,
        to: `${match[1]}.${match[2]}`,
        type: 'function_call',
        description: `Calls ${match[2]} method on ${match[1]}`
      })
    }

    return flows
  }

  /**
   * Detect entry point type
   */
  private static detectEntryPointType(filePath: string, content: string): 'main' | 'server' | 'client' | 'script' | 'test' | 'config' {
    const lowerContent = content.toLowerCase()
    const lowerPath = filePath.toLowerCase()

    if (lowerContent.includes('express') || lowerContent.includes('server') || lowerContent.includes('listen')) {
      return 'server'
    }
    if (lowerContent.includes('react') || lowerContent.includes('vue') || lowerContent.includes('dom')) {
      return 'client'
    }
    if (lowerPath.includes('test') || lowerContent.includes('describe') || lowerContent.includes('it(')) {
      return 'test'
    }
    if (lowerPath.includes('config') || lowerPath.includes('setup')) {
      return 'config'
    }
    if (lowerContent.includes('#!/') || lowerPath.includes('script')) {
      return 'script'
    }
    
    return 'main'
  }

  /**
   * Determine file role based on content analysis
   */
  private static determineFileRole(_filePath: string, content: string, type: string): string {
    const lowerContent = content.toLowerCase()
    
    if (type === 'entry') return 'Application Entry Point'
    if (type === 'config') return 'Configuration'
    if (type === 'api') return 'API Layer'
    
    if (lowerContent.includes('component') || lowerContent.includes('jsx') || lowerContent.includes('tsx')) {
      return 'UI Component'
    }
    if (lowerContent.includes('service') || lowerContent.includes('api')) {
      return 'Service Layer'
    }
    if (lowerContent.includes('util') || lowerContent.includes('helper')) {
      return 'Utility Functions'
    }
    if (lowerContent.includes('model') || lowerContent.includes('schema')) {
      return 'Data Model'
    }
    
    return 'Core Logic'
  }

  /**
   * Generate visualization data
   */
  private static async generateVisualization(
    keyFiles: Array<{ file: FileNode; content: string; type: string; importance: number }>,
    codeStructure: AdvancedRepoAnalysis['codeStructure']
  ): Promise<AdvancedRepoAnalysis['visualization']> {
    const nodes: AdvancedRepoAnalysis['visualization']['nodes'] = []
    const edges: AdvancedRepoAnalysis['visualization']['edges'] = []

    // Create nodes
    keyFiles.forEach((keyFile, index) => {
      const nodeType = keyFile.type as NodeType
      nodes.push({
        id: keyFile.file.path,
        label: keyFile.file.name,
        type: nodeType,
        file: keyFile.file,
        position: this.calculateNodePosition(index, keyFiles.length, keyFile.importance),
        size: { 
          width: Math.max(100, keyFile.importance * 15), 
          height: Math.max(60, keyFile.importance * 8) 
        },
        importance: keyFile.importance,
        color: this.getNodeColor(nodeType)
      })
    })

    // Create edges based on dependencies
    codeStructure.keyComponents.forEach(component => {
      component.dependencies.forEach(dep => {
        const targetNode = nodes.find(n => n.file.path.includes(dep))
        if (targetNode) {
          edges.push({
            id: `${component.file}-${targetNode.id}`,
            source: component.file,
            target: targetNode.id,
            type: 'imports',
            label: 'imports',
            strength: 5,
            color: '#22c55e'
          })
        }
      })
    })

    return { nodes, edges }
  }

  /**
   * Calculate optimal node position
   */
  private static calculateNodePosition(index: number, total: number, importance: number): { x: number; y: number } {
    const centerX = 400
    const centerY = 300
    const radius = 200 + (importance * 20)
    
    // Arrange in spiral pattern with more important files closer to center
    const angle = (index / total) * 2 * Math.PI
    const adjustedRadius = radius - (importance * 15)
    
    return {
      x: centerX + Math.cos(angle) * adjustedRadius,
      y: centerY + Math.sin(angle) * adjustedRadius
    }
  }

  /**
   * Get color for node type
   */
  private static getNodeColor(type: string): string {
    const colors: Record<string, string> = {
      entry: '#ef4444',      // Red for entry points
      component: '#3b82f6',  // Blue for components
      service: '#f59e0b',    // Amber for services
      config: '#8b5cf6',     // Purple for config
      data: '#10b981',       // Green for data
      utility: '#6b7280',    // Gray for utilities
      test: '#f97316',       // Orange for tests
      api: '#ec4899'         // Pink for API
    }
    return colors[type] || '#6b7280'
  }

  /**
   * Get AI insights from Gemini
   */
  private static async getAIInsights(
    repo: GitHubRepo,
    structure: FileNode,
    keyFiles: Array<{ file: FileNode; content: string; type: string; importance: number }>
  ): Promise<GeminiAnalysisResponse> {
    const request: CodeAnalysisRequest = {
      repositoryName: repo.name,
      repositoryDescription: repo.description,
      techStack: this.detectTechStack(keyFiles),
      entryPoints: keyFiles.filter(f => f.type === 'entry').map(f => f.file.path),
      fileStructure: this.buildFileStructureString(structure),
      keyFiles: keyFiles.map(f => ({
        path: f.file.path,
        content: f.content,
        type: f.type as 'entry' | 'component' | 'config' | 'utility' | 'api' | 'test' | 'docs'
      }))
    }

    return await GeminiAnalyzer.analyzeRepository(request)
  }

  /**
   * Detect tech stack from files
   */
  private static detectTechStack(keyFiles: Array<{ file: FileNode; content: string }>): string[] {
    const techStack = new Set<string>()
    
    keyFiles.forEach(({ file, content }) => {
      const lowerContent = content.toLowerCase()
      
      // JavaScript/TypeScript
      if (file.extension === 'js' || lowerContent.includes('javascript')) techStack.add('JavaScript')
      if (file.extension === 'ts' || file.extension === 'tsx' || lowerContent.includes('typescript')) techStack.add('TypeScript')
      
      // Frameworks
      if (lowerContent.includes('react')) techStack.add('React')
      if (lowerContent.includes('vue')) techStack.add('Vue.js')
      if (lowerContent.includes('angular')) techStack.add('Angular')
      if (lowerContent.includes('express')) techStack.add('Express.js')
      if (lowerContent.includes('fastify')) techStack.add('Fastify')
      if (lowerContent.includes('next')) techStack.add('Next.js')
      
      // Other
      if (lowerContent.includes('python')) techStack.add('Python')
      if (lowerContent.includes('java')) techStack.add('Java')
      if (lowerContent.includes('php')) techStack.add('PHP')
    })

    return Array.from(techStack)
  }

  /**
   * Build file structure string
   */
  private static buildFileStructureString(structure: FileNode, indent: string = ''): string {
    let result = `${indent}${structure.name}\n`
    
    if (structure.children) {
      structure.children.forEach(child => {
        result += this.buildFileStructureString(child, indent + '  ')
      })
    }
    
    return result
  }

  /**
   * Get basic analysis (fallback to existing function)
   */
  private static async getBasicAnalysis(_repo: GitHubRepo, structure: FileNode): Promise<RepoAnalysis> {
    // Import your existing analyzeRepository function here
    // For now, return a basic structure
    return {
      structure,
      overview: `Repository analysis in progress`,
      techStack: [],
      entryPoints: [],
      architecture: 'Unknown',
      keyDirectories: []
    }
  }
}
