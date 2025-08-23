import { FileNode, GitHubRepo, WorkflowNode, WorkflowEdge, RepositoryWorkflow } from '@/types'
import { ASTAnalyzer } from './ast-analyzer'
import { LanguageDetector, SupportedLanguage, LANGUAGE_CONFIGS, LanguageSupport } from './language-detector'

export interface UniversalAnalysisResult {
  language: SupportedLanguage
  secondaryLanguages: Record<SupportedLanguage, number>
  frameworks: string[]
  features: {
    astAnalysis: boolean
    structureAnalysis: boolean
    frameworkDetection: boolean
    dependencyAnalysis: boolean
  }
  workflow: RepositoryWorkflow
  stats: {
    totalFiles: number
    analyzableFiles: number
    configFiles: number
    testFiles: number
  }
}

export class UniversalAnalyzer {
  /**
   * Analyze repository with automatic language detection and appropriate analysis method
   */
  static async analyzeRepository(repo: GitHubRepo, files: FileNode[]): Promise<UniversalAnalysisResult> {
    console.log(`🌍 Starting universal analysis for ${repo.owner}/${repo.name}`)
    
    // Detect languages
    const primaryLanguage = LanguageDetector.detectPrimaryLanguage(files)
    const allLanguages = LanguageDetector.detectAllLanguages(files)
    const features = LanguageDetector.getSupportedFeatures(primaryLanguage)
    const frameworks = LanguageDetector.detectFrameworks(files, primaryLanguage)
    
    console.log(`📊 Language detection results:`, {
      primary: primaryLanguage,
      all: allLanguages,
      frameworks,
      features
    })

    // Get appropriate analysis method
    let workflow: RepositoryWorkflow

    if (features.astAnalysis) {
      console.log(`🔍 Using AST analysis for ${primaryLanguage}`)
      const astAnalyzer = new ASTAnalyzer()
      workflow = await astAnalyzer.analyzeRepository(repo, files)
    } else {
      console.log(`🏗️ Using structure analysis for ${primaryLanguage}`)
      workflow = await this.performStructureAnalysis(repo, files, primaryLanguage)
    }

    // Calculate statistics
    const stats = this.calculateStats(files, primaryLanguage)

    return {
      language: primaryLanguage,
      secondaryLanguages: allLanguages,
      frameworks,
      features,
      workflow,
      stats
    }
  }

  /**
   * Perform structure-based analysis for non-JS/TS languages
   */
  private static async performStructureAnalysis(
    repo: GitHubRepo, 
    files: FileNode[], 
    language: SupportedLanguage
  ): Promise<RepositoryWorkflow> {
    console.log(`🏗️ Performing structure analysis for ${language}`)
    
    const config = LANGUAGE_CONFIGS[language]
    const nodes = this.createStructureNodes(files, config, language, repo)
    const edges = this.createStructureEdges(nodes, config)
    
    return {
      nodes,
      edges,
      metrics: this.calculateStructureMetrics(nodes, edges),
      clusters: this.identifyStructureClusters(nodes),
      entryPoints: this.findStructureEntryPoints(nodes),
      criticalPaths: this.identifyStructureCriticalPaths(nodes)
    }
  }

  /**
   * Create workflow nodes based on file structure
   */
  private static createStructureNodes(
    files: FileNode[], 
    config: LanguageSupport, 
    language: SupportedLanguage,
    repo: GitHubRepo
  ): WorkflowNode[] {
    const nodes: WorkflowNode[] = []
    
    const processFiles = (fileNodes: FileNode[], depth = 0) => {
      for (const file of fileNodes) {
        if (file.type === 'file' && this.isAnalyzableFile(file.name, config)) {
          const node: WorkflowNode = {
            id: file.path.replace(/[^a-zA-Z0-9]/g, '_'),
            name: file.name,
            type: this.determineStructureNodeType(file, config),
            role: this.determineStructureRole(file, config),
            file: file,
            dependencies: [],
            dependents: [],
            complexity: this.estimateComplexity(file, language),
            importance: this.calculateStructureImportance(file, config),
            githubUrl: `https://github.com/${repo.owner}/${repo.name}/blob/main/${file.path}`,
            astInfo: undefined, // No AST info for structure analysis
            position: { x: 0, y: 0 } // Will be calculated later
          }
          nodes.push(node)
        }
        
        if (file.children && file.children.length > 0) {
          processFiles(file.children, depth + 1)
        }
      }
    }
    
    processFiles(files)
    console.log(`📊 Created ${nodes.length} structure nodes`)
    return nodes
  }

  /**
   * Create edges based on file structure and naming patterns
   */
  private static createStructureEdges(nodes: WorkflowNode[], config: LanguageSupport): WorkflowEdge[] {
    const edges: WorkflowEdge[] = []
    
    // Connect entry points to other files
    const entryPoints = nodes.filter(n => 
      config.entryPoints.some((entry: string) => n.name.includes(entry.replace('.py', '').replace('.java', '').replace('.go', '')))
    )
    
    for (const entry of entryPoints) {
      // Connect to files in same directory
      const sameDir = nodes.filter(n => 
        n.id !== entry.id && 
        n.file.path.split('/').slice(0, -1).join('/') === entry.file.path.split('/').slice(0, -1).join('/')
      ).slice(0, 5) // Limit connections
      
      for (const related of sameDir) {
        edges.push({
          id: `${entry.id}-${related.id}`,
          source: entry.id,
          target: related.id,
          type: 'import',
          weight: 1
        })
      }
    }
    
    // Connect config files to source files
    const configFiles = nodes.filter(n => 
      config.configFiles.some((conf: string) => n.name.includes(conf.replace('*', '')))
    )
    
    for (const configFile of configFiles) {
      const sourceFiles = nodes.filter(n => n.type === 'component' || n.type === 'service').slice(0, 3)
      for (const sourceFile of sourceFiles) {
        edges.push({
          id: `${configFile.id}-${sourceFile.id}`,
          source: configFile.id,
          target: sourceFile.id,
          type: 'configuration',
          weight: 0.5
        })
      }
    }
    
    console.log(`🔗 Created ${edges.length} structure edges`)
    return edges
  }

  /**
   * Determine node type based on file structure
   */
  private static determineStructureNodeType(file: FileNode, config: LanguageSupport): WorkflowNode['type'] {
    const fileName = file.name.toLowerCase()
    const filePath = file.path.toLowerCase()
    
    // Entry points
    if (config.entryPoints.some((entry: string) => fileName.includes(entry.toLowerCase().replace(/\.[^.]*$/, '')))) {
      return 'entry'
    }
    
    // Configuration files
    if (config.configFiles.some((conf: string) => fileName.includes(conf.toLowerCase().replace('*', '')))) {
      return 'config'
    }
    
    // Test files
    if (config.testDirectories.some((testDir: string) => filePath.includes(`/${testDir}/`)) || 
        fileName.includes('test') || fileName.includes('spec')) {
      return 'test'
    }
    
    // API/Service files
    if (filePath.includes('/api/') || filePath.includes('/service/') || filePath.includes('/controller/')) {
      return 'service'
    }
    
    // Component files (UI components, modules, etc.)
    if (filePath.includes('/component/') || filePath.includes('/module/') || filePath.includes('/view/')) {
      return 'component'
    }
    
    // Utility files
    if (filePath.includes('/util/') || filePath.includes('/helper/') || filePath.includes('/lib/')) {
      return 'utility'
    }
    
    // Default to component for source files
    return 'component'
  }

  /**
   * Determine architectural layer
   */
  private static determineStructureRole(file: FileNode, config: LanguageSupport): WorkflowNode['role'] {
    const fileName = file.name.toLowerCase()
    const filePath = file.path.toLowerCase()

    // Entry points
    if (config.entryPoints.some(ep => fileName.includes(ep.toLowerCase()))) return 'entry'
    
    // Configuration files
    if (config.configFiles.some(cf => fileName.includes(cf.toLowerCase()))) return 'config'
    
    // Test files
    if (config.testDirectories.some(td => filePath.includes(td.toLowerCase()))) return 'test'
    
    // Package management
    if (config.packageManagers.some(pm => fileName.includes(pm.toLowerCase()))) return 'config'
    
    // Documentation
    if (fileName.includes('readme') || fileName.includes('doc') || 
        fileName.includes('changelog') || fileName.includes('license')) return 'documentation'
    
    // Build/output
    if (config.buildDirectories.some(bd => filePath.includes(bd.toLowerCase()))) return 'build'
    
    // Core business logic patterns
    if (filePath.includes('controller') || filePath.includes('handler') || 
        filePath.includes('router') || filePath.includes('api')) return 'api'
    if (filePath.includes('service') || filePath.includes('business') || 
        filePath.includes('logic')) return 'business'
    if (filePath.includes('model') || filePath.includes('entity') || 
        filePath.includes('schema') || filePath.includes('dto')) return 'data'
    if (filePath.includes('repository') || filePath.includes('dao') || 
        filePath.includes('database')) return 'data'
    if (filePath.includes('component') || filePath.includes('view') || 
        filePath.includes('template') || filePath.includes('ui')) return 'presentation'
    if (filePath.includes('util') || filePath.includes('helper') || 
        filePath.includes('common')) return 'utility'
    
    return 'implementation'
  }

  /**
   * Estimate file complexity based on size and type
   */
  private static estimateComplexity(file: FileNode, language: SupportedLanguage): number {
    let complexity = 1
    
    // Base complexity on file size (if available)
    if (file.size) {
      complexity += Math.min(file.size / 1000, 10) // Max 10 points for size
    }
    
    // Language-specific complexity modifiers
    switch (language) {
      case 'cpp':
      case 'java':
        complexity *= 1.2 // More complex languages
        break
      case 'python':
      case 'javascript':
        complexity *= 1.0 // Moderate complexity
        break
      case 'go':
      case 'rust':
        complexity *= 0.9 // More straightforward languages
        break
    }
    
    return Math.max(1, Math.min(complexity, 10))
  }

  /**
   * Calculate file importance for structure analysis
   */
  private static calculateStructureImportance(file: FileNode, config: LanguageSupport): 'low' | 'medium' | 'high' {
    const fileName = file.name.toLowerCase()
    const filePath = file.path.toLowerCase()
    
    // High importance
    if (config.entryPoints.some((entry: string) => fileName.includes(entry.toLowerCase().replace(/\.[^.]*$/, '')))) {
      return 'high'
    }
    
    if (config.configFiles.some((conf: string) => fileName.includes(conf.toLowerCase().replace('*', '')))) {
      return 'high'
    }
    
    // Medium importance  
    if (filePath.includes('/src/') || filePath.includes('/lib/') || filePath.includes('/api/')) {
      return 'medium'
    }
    
    // Low importance
    if (filePath.includes('/test/') || filePath.includes('/spec/') || config.buildDirectories.some((dir: string) => filePath.includes(`/${dir}/`))) {
      return 'low'
    }
    
    return 'medium'
  }

  /**
   * Check if file is analyzable for the given language
   */
  private static isAnalyzableFile(fileName: string, config: LanguageSupport): boolean {
    return config.extensions.some((ext: string) => fileName.endsWith(ext))
  }

  /**
   * Calculate statistics for the analysis
   */
  private static calculateStats(files: FileNode[], language: SupportedLanguage): {
    totalFiles: number
    analyzableFiles: number
    configFiles: number
    testFiles: number
  } {
    const config = LANGUAGE_CONFIGS[language]
    let totalFiles = 0
    let analyzableFiles = 0
    let configFiles = 0
    let testFiles = 0
    
    const countFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          totalFiles++
          
          if (this.isAnalyzableFile(node.name, config)) {
            analyzableFiles++
          }
          
          if (config.configFiles.some((conf: string) => node.name.includes(conf.replace('*', '')))) {
            configFiles++
          }
          
          if (node.path.toLowerCase().includes('/test/') || node.name.includes('test')) {
            testFiles++
          }
        }
        
        if (node.children && node.children.length > 0) {
          countFiles(node.children)
        }
      }
    }
    
    countFiles(files)
    
    return {
      totalFiles,
      analyzableFiles,
      configFiles,
      testFiles
    }
  }

  // Simple implementations for structure analysis metrics
  private static calculateStructureMetrics(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
    return {
      totalFiles: nodes.length,
      totalFunctions: 0, // Not available in structure analysis
      totalClasses: 0,   // Not available in structure analysis
      avgComplexity: nodes.reduce((sum, n) => sum + n.complexity, 0) / nodes.length,
      dependencyDepth: 3, // Estimated
      couplingMetric: edges.length / nodes.length
    }
  }

  private static identifyStructureClusters(nodes: WorkflowNode[]) {
    // Simple clustering based on directory structure
    const clusters = new Map<string, WorkflowNode[]>()
    
    for (const node of nodes) {
      const dir = node.file.path.split('/').slice(0, -1).join('/') || 'root'
      if (!clusters.has(dir)) {
        clusters.set(dir, [])
      }
      clusters.get(dir)!.push(node)
    }
    
    return Array.from(clusters.entries()).map(([name, nodes]) => ({
      id: name.replace(/[^a-zA-Z0-9]/g, '_'),
      name,
      nodeIds: nodes.map(n => n.id),
      purpose: `Directory cluster: ${name}`
    }))
  }

  private static findStructureEntryPoints(nodes: WorkflowNode[]): string[] {
    return nodes
      .filter(n => n.type === 'entry')
      .map(n => n.id)
  }

  private static identifyStructureCriticalPaths(nodes: WorkflowNode[]): { path: string[]; description: string; importance: number; }[] {
    // Simple critical path: entry point to high importance files
    const entryPoints = nodes.filter(n => n.type === 'entry')
    const importantFiles = nodes.filter(n => n.importance === 'high')
    
    return entryPoints.slice(0, 3).map((entry, index) => ({
      path: [entry.id, ...importantFiles.slice(0, 2).map(f => f.id)],
      description: `Critical path from ${entry.name} to important components`,
      importance: 3 - index
    }))
  }
}
