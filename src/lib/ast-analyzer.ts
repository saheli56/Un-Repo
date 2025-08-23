import { Project, SourceFile, SyntaxKind, Node } from 'ts-morph'
import { FileNode, ParsedFile, ParsedFunction, ParsedClass, WorkflowNode, WorkflowEdge, RepositoryWorkflow, GitHubRepo } from '@/types'

interface CallGraphEntry {
  caller: string
  callee: string
  line: number
  file: string
}

interface ImportGraphEntry {
  importer: string
  imported: string
  specifiers: string[]
}

export class ASTAnalyzer {
  private project: Project
  private callGraph: CallGraphEntry[] = []
  private importGraph: ImportGraphEntry[] = []

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true, // Enable in-memory file system for browser
      compilerOptions: {
        target: 99, // Latest
        allowJs: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        skipLibCheck: true,
        moduleResolution: 1, // Node
      },
    })
  }

  /**
   * Analyze repository structure and create workflow with performance optimizations
   */
  async analyzeRepository(repo: GitHubRepo, files: FileNode[]): Promise<RepositoryWorkflow> {
    console.log(`🔍 Starting AST analysis for ${repo.owner}/${repo.name}`)
    console.log(`📁 Total files received: ${files.length}`)
    
    // Performance optimization: Limit analysis for large repositories
    const MAX_FILES_FOR_ANALYSIS = 200
    const fileCount = this.countAllFiles(files)
    console.log(`📊 Total file count in repository: ${fileCount}`)
    
    if (fileCount > MAX_FILES_FOR_ANALYSIS) {
      console.log(`⚡ Large repository detected (${fileCount} files). Applying intelligent file filtering...`)
      files = this.intelligentFileFilter(files, MAX_FILES_FOR_ANALYSIS)
      console.log(`📊 Filtered down to ${this.countAllFiles(files)} most important files`)
    }
    
    this.callGraph = []
    this.importGraph = []

    // Add source files to project with batching
    const sourceFiles = await this.addFilesToProjectBatched(files)
    console.log(`📄 Analyzable files found: ${sourceFiles.size}`)
    
    // Parse each file with progress tracking
    const workflowNodes: WorkflowNode[] = []
    const parsedFiles = new Map<string, ParsedFile>()
    let processedCount = 0

    for (const [path, sourceFile] of sourceFiles) {
      try {
        const fileNode = this.findFileNode(files, path)
        if (!fileNode) {
          console.warn(`⚠️ File node not found for path: ${path}`)
          continue
        }

        if (processedCount % 50 === 0) {
          console.log(`📝 Progress: ${processedCount}/${sourceFiles.size} files parsed`)
        }

        const parsed = this.parseSourceFile(sourceFile)
        parsedFiles.set(path, parsed)

        const workflowNode = this.createWorkflowNode(fileNode, parsed, repo)
        workflowNodes.push(workflowNode)
        processedCount++
      } catch (error) {
        console.warn(`❌ Failed to parse file ${path}:`, error)
        // Continue processing other files instead of failing completely
      }
    }

    console.log(`✅ Successfully created ${workflowNodes.length} workflow nodes`)

    // Build dependency graph with timeout protection
    console.log(`🔗 Building dependency graph...`)
    const edges = await this.buildDependencyGraphWithTimeout(workflowNodes, parsedFiles)
    console.log(`🔗 Created ${edges.length} dependency edges`)

    // Calculate metrics and clustering
    const metrics = this.calculateMetrics(workflowNodes, edges)
    const clusters = this.identifyClusters(workflowNodes)
    const entryPoints = this.identifyEntryPoints(workflowNodes)
    const criticalPaths = this.identifyCriticalPaths(workflowNodes, edges)

    console.log(`📊 Analysis complete:`, {
      nodes: workflowNodes.length,
      edges: edges.length,
      entryPoints: entryPoints.length,
      clusters: clusters.length,
      avgComplexity: metrics.avgComplexity,
      wasFiltered: fileCount > MAX_FILES_FOR_ANALYSIS
    })

    // Optimize layout
    this.optimizeLayout(workflowNodes, edges)

    return {
      nodes: workflowNodes,
      edges,
      entryPoints,
      criticalPaths,
      clusters,
      metrics,
    }
  }

  /**
   * Count total files in repository structure
   */
  private countAllFiles(files: FileNode[]): number {
    let count = 0
    const processFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          count++
        }
        if (node.children && node.children.length > 0) {
          processFiles(node.children)
        }
      }
    }
    processFiles(files)
    return count
  }

  /**
   * Intelligent file filtering for large repositories
   * Prioritizes important files and reduces analysis load
   */
  private intelligentFileFilter(files: FileNode[], maxFiles: number): FileNode[] {
    const allFiles: { file: FileNode; importance: number }[] = []
    
    const calculateFileImportance = (file: FileNode): number => {
      const path = file.path.toLowerCase()
      const name = file.name.toLowerCase()
      let importance = 0
      
      // High priority files
      if (['package.json', 'tsconfig.json', 'vite.config.ts', 'webpack.config.js'].includes(name)) {
        importance += 100
      }
      if (['index.ts', 'index.tsx', 'main.ts', 'main.tsx', 'app.ts', 'app.tsx'].includes(name)) {
        importance += 90
      }
      if (name.includes('readme')) importance += 80
      
      // Source code files
      if (path.includes('/src/') && !path.includes('/test/') && !path.includes('/__tests__/')) {
        importance += 70
      }
      if (path.includes('/components/')) importance += 60
      if (path.includes('/pages/') || path.includes('/routes/')) importance += 65
      if (path.includes('/lib/') || path.includes('/utils/')) importance += 55
      if (path.includes('/api/') || path.includes('/services/')) importance += 60
      
      // Reduce importance for less critical files
      if (path.includes('/node_modules/')) importance -= 100
      if (path.includes('/dist/') || path.includes('/build/')) importance -= 50
      if (path.includes('/test/') || path.includes('/__tests__/')) importance -= 30
      if (name.includes('.min.')) importance -= 40
      if (name.includes('.spec.') || name.includes('.test.')) importance -= 20
      
      // File type bonuses
      if (this.isAnalyzableFile(name)) importance += 20
      
      return Math.max(0, importance)
    }
    
    const collectFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          const importance = calculateFileImportance(node)
          if (importance > 0) {
            allFiles.push({ file: node, importance })
          }
        }
        if (node.children && node.children.length > 0) {
          collectFiles(node.children)
        }
      }
    }
    
    collectFiles(files)
    
    // Sort by importance and take top files
    allFiles.sort((a, b) => b.importance - a.importance)
    const selectedFiles = allFiles.slice(0, maxFiles).map(f => f.file)
    
    // Rebuild file tree structure with selected files
    return this.rebuildFileTree(files, selectedFiles)
  }

  /**
   * Rebuild file tree maintaining directory structure for selected files
   */
  private rebuildFileTree(originalFiles: FileNode[], selectedFiles: FileNode[]): FileNode[] {
    const selectedPaths = new Set(selectedFiles.map(f => f.path))
    
    const filterNode = (node: FileNode): FileNode | null => {
      if (node.type === 'file') {
        return selectedPaths.has(node.path) ? node : null
      }
      
      // For directories, recursively filter children
      if (node.children) {
        const filteredChildren = node.children
          .map(child => filterNode(child))
          .filter(child => child !== null) as FileNode[]
        
        if (filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren
          }
        }
      }
      
      return null
    }
    
    return originalFiles
      .map(node => filterNode(node))
      .filter(node => node !== null) as FileNode[]
  }

  /**
   * Add files to TS Morph project with batching and error recovery
   */
  private async addFilesToProjectBatched(files: FileNode[]): Promise<Map<string, SourceFile>> {
    const sourceFiles = new Map<string, SourceFile>()
    const BATCH_SIZE = 50
    
    const processFiles = (nodes: FileNode[]) => {
      const filesToProcess: FileNode[] = []
      
      const collectFiles = (currentNodes: FileNode[]) => {
        for (const node of currentNodes) {
          if (node.type === 'file' && this.isAnalyzableFile(node.name)) {
            filesToProcess.push(node)
          }
          if (node.children && node.children.length > 0) {
            collectFiles(node.children)
          }
        }
      }
      
      collectFiles(nodes)
      
      // Process files in batches
      for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
        const batch = filesToProcess.slice(i, i + BATCH_SIZE)
        console.log(`🔧 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(filesToProcess.length / BATCH_SIZE)} (${batch.length} files)`)
        
        for (const node of batch) {
          try {
            const content = this.getMockFileContent(node)
            const filePath = node.path.startsWith('/') ? node.path : `/${node.path}`
            const sourceFile = this.project.createSourceFile(filePath, content, { overwrite: true })
            sourceFiles.set(node.path, sourceFile)
          } catch (error) {
            console.warn(`❌ Failed to add file ${node.path}:`, error)
            // Continue with next file instead of failing entire batch
          }
        }
      }
    }

    console.log(`🚀 Starting batched file processing`)
    processFiles(files)
    console.log(`✅ Completed processing. Total analyzable files: ${sourceFiles.size}`)
    
    return sourceFiles
  }

  /**
   * Add files to TS Morph project for analysis (legacy method - kept for compatibility)
   */
  private async addFilesToProject(files: FileNode[]): Promise<Map<string, SourceFile>> {
    const sourceFiles = new Map<string, SourceFile>()

    const processFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file' && this.isAnalyzableFile(node.name)) {
          try {
            console.log(`🔧 Processing file: ${node.path}`)
            // For browser usage, we'll create mock content based on file type
            // In a real implementation, you'd fetch actual content from GitHub API
            const content = this.getMockFileContent(node)
            
            // Create source file with a proper file path
            const filePath = node.path.startsWith('/') ? node.path : `/${node.path}`
            const sourceFile = this.project.createSourceFile(filePath, content, { overwrite: true })
            sourceFiles.set(node.path, sourceFile)
            console.log(`✅ Added file to project: ${node.name}`)
          } catch (error) {
            console.warn(`❌ Failed to add file ${node.path}:`, error)
          }
        }

        // Recursively process children directories
        if (node.children && node.children.length > 0) {
          console.log(`📂 Processing directory: ${node.name} (${node.children.length} items)`)
          processFiles(node.children)
        }
      }
    }

    console.log(`🚀 Starting file processing for ${files.length} root items`)
    processFiles(files)
    console.log(`✅ Completed processing. Total analyzable files: ${sourceFiles.size}`)
    
    return sourceFiles
  }

  /**
   * Check if file can be analyzed with AST
   */
  private isAnalyzableFile(fileName: string): boolean {
    const analyzableExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
    return analyzableExtensions.some(ext => fileName.endsWith(ext))
  }

  /**
   * Parse source file to extract structure information
   */
  private parseSourceFile(sourceFile: SourceFile): ParsedFile {
    const functions: ParsedFunction[] = []
    const classes: ParsedClass[] = []
    const imports: ParsedFile['imports'] = []
    const exports: ParsedFile['exports'] = []
    const variables: ParsedFile['variables'] = []

    // Parse imports
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue()
      const specifiers: string[] = []

      // Default import
      const defaultImport = importDecl.getDefaultImport()
      if (defaultImport) {
        specifiers.push(defaultImport.getText())
      }

      // Named imports
      const namedImports = importDecl.getNamedImports()
      namedImports.forEach(named => {
        specifiers.push(named.getName())
      })

      // Namespace import
      const namespaceImport = importDecl.getNamespaceImport()
      if (namespaceImport) {
        specifiers.push(`* as ${namespaceImport.getText()}`)
      }

      imports.push({
        source: moduleSpecifier,
        specifiers,
        isDefault: !!defaultImport,
      })

      // Add to import graph
      this.importGraph.push({
        importer: sourceFile.getFilePath(),
        imported: moduleSpecifier,
        specifiers,
      })
    })

    // Parse functions
    sourceFile.getFunctions().forEach(func => {
      const name = func.getName() || 'anonymous'
      const parameters = func.getParameters().map(p => p.getName())
      const returnType = func.getReturnTypeNode()?.getText()
      const startLine = func.getStartLineNumber()
      const endLine = func.getEndLineNumber()
      const documentation = func.getJsDocs().map(doc => doc.getInnerText()).join('\n')

      functions.push({
        name,
        parameters,
        returnType,
        startLine,
        endLine,
        documentation,
        complexity: this.calculateComplexity(func),
      })

      // Add function calls to call graph
      func.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
        const callee = call.getExpression().getText()
        this.callGraph.push({
          caller: name,
          callee,
          line: call.getStartLineNumber(),
          file: sourceFile.getFilePath(),
        })
      })
    })

    // Parse classes
    sourceFile.getClasses().forEach(cls => {
      const name = cls.getName() || 'anonymous'
      const methods = cls.getMethods().map(method => ({
        name: method.getName(),
        parameters: method.getParameters().map(p => p.getName()),
        returnType: method.getReturnTypeNode()?.getText(),
        startLine: method.getStartLineNumber(),
        endLine: method.getEndLineNumber(),
        complexity: this.calculateComplexity(method),
      }))
      
      const properties = cls.getProperties().map(prop => prop.getName())
      const extendsClause = cls.getExtends()?.getText()
      const implementsClause = cls.getImplements().map(impl => impl.getText())

      classes.push({
        name,
        methods,
        properties,
        extends: extendsClause,
        implements: implementsClause,
        startLine: cls.getStartLineNumber(),
        endLine: cls.getEndLineNumber(),
      })
    })

    // Parse exports
    sourceFile.getExportDeclarations().forEach(exportDecl => {
      const namedExports = exportDecl.getNamedExports()
      namedExports.forEach(named => {
        exports.push({
          name: named.getName(),
          type: 'variable', // Simplified
        })
      })
    })

    // Parse variable declarations
    sourceFile.getVariableDeclarations().forEach(varDecl => {
      const name = varDecl.getName()
      const type = varDecl.getTypeNode()?.getText()
      const variableStatement = varDecl.getVariableStatement()
      const isConst = variableStatement?.getDeclarationKind().toString() === 'const'

      variables.push({
        name,
        type,
        isConst,
      })
    })

    return {
      functions,
      classes,
      imports,
      exports,
      variables,
    }
  }

  /**
   * Calculate cyclomatic complexity of a function or method
   */
  private calculateComplexity(node: Node): number {
    let complexity = 1 // Base complexity

    // Count decision points
    const decisionKeywords = [
      SyntaxKind.IfStatement,
      SyntaxKind.WhileStatement,
      SyntaxKind.ForStatement,
      SyntaxKind.ForInStatement,
      SyntaxKind.ForOfStatement,
      SyntaxKind.SwitchStatement,
      SyntaxKind.CatchClause,
      SyntaxKind.ConditionalExpression,
    ]

    decisionKeywords.forEach(kind => {
      complexity += node.getDescendantsOfKind(kind).length
    })

    // Count logical operators
    complexity += node.getDescendantsOfKind(SyntaxKind.AmpersandAmpersandToken).length
    complexity += node.getDescendantsOfKind(SyntaxKind.BarBarToken).length

    return complexity
  }

  /**
   * Create workflow node from parsed file
   */
  private createWorkflowNode(fileNode: FileNode, parsed: ParsedFile, repo: GitHubRepo): WorkflowNode {
    const nodeType = this.determineNodeType(fileNode, parsed)
    const role = this.determineNodeRole(fileNode, parsed)
    const complexity = this.calculateFileComplexity(parsed)
    const importance = this.determineImportance(fileNode, parsed)

    return {
      id: fileNode.path,
      name: fileNode.name,
      file: fileNode,
      type: nodeType,
      role,
      dependencies: parsed.imports.map(imp => imp.source),
      dependents: [], // Will be filled later
      complexity,
      importance,
      position: { x: 0, y: 0 }, // Will be calculated later
      githubUrl: `https://github.com/${repo.owner}/${repo.name}/blob/main${fileNode.path}`,
      astInfo: {
        functions: parsed.functions,
        classes: parsed.classes,
        imports: parsed.imports.map(imp => imp.source),
        exports: parsed.exports.map(exp => exp.name),
        callGraph: this.callGraph.filter(call => call.file === fileNode.path),
      },
    }
  }

  /**
   * Determine node type based on file analysis
   */
  private determineNodeType(fileNode: FileNode, _parsed: ParsedFile): WorkflowNode['type'] {
    const name = fileNode.name.toLowerCase()
    
    // Entry points
    if (['index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts'].includes(name)) {
      return 'entry'
    }

    // Config files
    if (name.includes('config') || name.includes('setup') || fileNode.extension === '.json') {
      return 'config'
    }

    // Test files
    if (name.includes('test') || name.includes('spec') || name.includes('.test.') || name.includes('.spec.')) {
      return 'test'
    }

    // Type definitions
    if (name.includes('.d.ts') || name.includes('types') || name.includes('interfaces')) {
      return 'type'
    }

    // Utilities
    if (name.includes('util') || name.includes('helper') || name.includes('common')) {
      return 'utility'
    }

    // Services
    if (name.includes('service') || name.includes('api') || name.includes('client')) {
      return 'service'
    }

    // Default to component
    return 'component'
  }

  /**
   * Determine node role in the system
   */
  private determineNodeRole(_fileNode: FileNode, parsed: ParsedFile): string {
    const { functions, classes, imports, exports } = parsed

    if (imports.length > exports.length + 2) {
      return 'Consumer'
    }

    if (exports.length > imports.length + 2) {
      return 'Provider'
    }

    if (classes.length > functions.length) {
      return 'Object-Oriented Module'
    }

    if (functions.length > classes.length + 2) {
      return 'Functional Module'
    }

    return 'Mixed Module'
  }

  /**
   * Calculate file complexity
   */
  private calculateFileComplexity(parsed: ParsedFile): number {
    const functionComplexity = parsed.functions.reduce((sum, func) => sum + func.complexity, 0)
    const classComplexity = parsed.classes.reduce((sum, cls) => 
      sum + cls.methods.reduce((methodSum, method) => methodSum + method.complexity, 0), 0
    )

    return functionComplexity + classComplexity
  }

  /**
   * Determine node importance
   */
  private determineImportance(fileNode: FileNode, parsed: ParsedFile): 'high' | 'medium' | 'low' {
    const name = fileNode.name.toLowerCase()
    
    // High importance
    if (['index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts'].includes(name)) {
      return 'high'
    }

    if (parsed.exports.length > 5 || parsed.functions.length > 10) {
      return 'high'
    }

    // Medium importance
    if (parsed.exports.length > 2 || parsed.functions.length > 3) {
      return 'medium'
    }

    return 'low'
  }

  /**
   * Build dependency graph with timeout protection for large repositories
   */
  private async buildDependencyGraphWithTimeout(nodes: WorkflowNode[], parsedFiles: Map<string, ParsedFile>): Promise<WorkflowEdge[]> {
    const TIMEOUT_MS = 30000 // 30 second timeout
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn(`⚠️ Dependency graph building timed out after ${TIMEOUT_MS}ms. Using simplified graph.`)
        // Return simplified graph for large repositories
        resolve(this.buildSimplifiedDependencyGraph(nodes))
      }, TIMEOUT_MS)
      
      try {
        const edges = this.buildDependencyGraph(nodes, parsedFiles)
        clearTimeout(timeoutId)
        resolve(edges)
      } catch (error) {
        console.error(`❌ Error building dependency graph:`, error)
        clearTimeout(timeoutId)
        // Fallback to simplified graph
        resolve(this.buildSimplifiedDependencyGraph(nodes))
      }
    })
  }

  /**
   * Build simplified dependency graph for performance
   */
  private buildSimplifiedDependencyGraph(nodes: WorkflowNode[]): WorkflowEdge[] {
    const edges: WorkflowEdge[] = []
    console.log(`🔧 Building simplified dependency graph for ${nodes.length} nodes`)
    
    for (const node of nodes) {
      // Connect entry points to related files
      if (node.type === 'entry' || node.name.includes('index') || node.name.includes('main')) {
        const relatedNodes = nodes.filter(n => 
          n.id !== node.id && 
          n.file.path.includes(node.file.path.split('/').slice(0, -1).join('/'))
        ).slice(0, 5) // Limit connections
        
        for (const related of relatedNodes) {
          edges.push({
            id: `${node.id}-${related.id}`,
            source: node.id,
            target: related.id,
            type: 'import',
            weight: 1
          })
        }
      }
      
      // Connect components to services
      if (node.type === 'component') {
        const services = nodes.filter(n => n.type === 'service').slice(0, 2)
        for (const service of services) {
          edges.push({
            id: `${node.id}-${service.id}`,
            source: node.id,
            target: service.id,
            type: 'import',
            weight: 1
          })
        }
      }
    }
    
    console.log(`✅ Created ${edges.length} simplified dependency edges`)
    return edges
  }

  /**
   * Build progressive workflow dependency graph with enhanced validation
   * Default: Simple view with only essential connections
   * Detailed: Show all relationships
   */
  private buildDependencyGraph(nodes: WorkflowNode[], _parsedFiles: Map<string, ParsedFile>): WorkflowEdge[] {
    console.log(`🔗 Building optimized workflow graph for ${nodes.length} nodes`)
    console.log('📋 Node types:', nodes.map(n => `${n.name} (${n.type})`))

    // Create node ID set for validation
    const nodeIds = new Set(nodes.map(node => node.id))
    console.log(`🎯 Valid node IDs:`, Array.from(nodeIds))

    // Start with minimal essential connections
    const edges = this.buildEssentialConnections(nodes)
    
    // Validate all edges to ensure source and target exist
    const validatedEdges = this.validateEdges(edges, nodeIds)
    
    console.log(`✅ Built streamlined workflow with ${validatedEdges.length} validated connections (filtered from ${edges.length})`)
    return validatedEdges
  }

  /**
   * Validate edges to ensure both source and target nodes exist
   */
  private validateEdges(edges: WorkflowEdge[], validNodeIds: Set<string>): WorkflowEdge[] {
    const validEdges: WorkflowEdge[] = []
    const invalidReason: string[] = []

    for (const edge of edges) {
      if (!validNodeIds.has(edge.source)) {
        invalidReason.push(`❌ Edge ${edge.id}: Source node '${edge.source}' not found`)
        continue
      }
      
      if (!validNodeIds.has(edge.target)) {
        invalidReason.push(`❌ Edge ${edge.id}: Target node '${edge.target}' not found`)
        continue
      }

      if (edge.source === edge.target) {
        invalidReason.push(`❌ Edge ${edge.id}: Self-referencing edge`)
        continue
      }

      validEdges.push(edge)
    }

    if (invalidReason.length > 0) {
      console.warn('⚠️ Invalid edges filtered out:', invalidReason)
    }

    console.log(`✅ Validated edges: ${validEdges.length}/${edges.length} passed`)
    return validEdges
  }

  /**
   * Build only essential connections for initial view
   */
  private buildEssentialConnections(nodes: WorkflowNode[]): WorkflowEdge[] {
    const edges: WorkflowEdge[] = []
    const nodeMap = new Map(nodes.map(node => [node.id, node]))

    console.log(`🔧 Building essential connections for nodes:`, nodes.map(n => n.name))

    // 1. Main workflow spine: Entry → High-importance files
    this.createMainWorkflowSpine(nodes, edges)
    console.log(`📍 After main workflow spine: ${edges.length} edges`)

    // 2. Direct imports (only the most important ones)
    this.buildCriticalImports(edges, nodeMap)
    console.log(`📥 After critical imports: ${edges.length} edges`)

    // 3. Config connections (minimal)
    this.createEssentialConfigConnections(nodes, edges)
    console.log(`⚙️ After config connections: ${edges.length} edges`)

    // 4. Ensure basic connectivity
    this.ensureMinimalConnectivity(nodes, edges)
    console.log(`🔗 After minimal connectivity: ${edges.length} edges`)

    // 5. Fallback: if no edges created, create basic connections
    if (edges.length === 0) {
      console.log('⚠️ No edges found, creating fallback connections')
      this.createFallbackConnections(nodes, edges)
    }

    return edges
  }

  /**
   * Create fallback connections if no edges were generated
   */
  private createFallbackConnections(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    if (nodes.length < 2) return

    // Connect first node to others
    const [firstNode, ...otherNodes] = nodes
    otherNodes.slice(0, 5).forEach((targetNode) => {
      edges.push({
        id: `fallback-${firstNode.id}-${targetNode.id}`,
        source: firstNode.id,
        target: targetNode.id,
        type: 'composition',
        weight: 1,
        label: 'related',
        metadata: {
          description: 'Basic file relationship',
        },
      })
    })

    // Create chain connections if we have enough nodes
    if (nodes.length >= 3) {
      for (let i = 0; i < Math.min(nodes.length - 1, 3); i++) {
        const sourceNode = nodes[i]
        const targetNode = nodes[i + 1]
        edges.push({
          id: `chain-${sourceNode.id}-${targetNode.id}`,
          source: sourceNode.id,
          target: targetNode.id,
          type: 'data-flow',
          weight: 1,
          label: 'flows to',
          metadata: {
            description: 'Sequential workflow',
          },
        })
      }
    }
  }

  /**
   * Create the main workflow spine - the core execution flow
   */
  private createMainWorkflowSpine(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const entryPoints = nodes.filter(node => node.type === 'entry')
    const mainComponents = nodes
      .filter(node => node.type === 'component' && node.importance === 'high')
      .slice(0, 3) // Only top 3 components
    
    const mainServices = nodes
      .filter(node => node.type === 'service' && node.importance === 'high')
      .slice(0, 2) // Only top 2 services

    console.log(`🎯 Workflow spine: ${entryPoints.length} entries, ${mainComponents.length} components, ${mainServices.length} services`)

    // Entry points to main components
    entryPoints.forEach((entry, entryIndex) => {
      const targetComponent = mainComponents[entryIndex % mainComponents.length]
      if (targetComponent) {
        edges.push({
          id: `spine-${entry.id}-${targetComponent.id}`,
          source: entry.id,
          target: targetComponent.id,
          type: 'data-flow',
          weight: 3,
          label: 'main flow',
          metadata: {
            description: 'Core application flow',
          },
        })
      }
    })

    // Components to services (if any)
    if (mainServices.length > 0) {
      mainComponents.forEach(component => {
        const service = mainServices[0] // Connect to primary service
        edges.push({
          id: `spine-${component.id}-${service.id}`,
          source: component.id,
          target: service.id,
          type: 'call',
          weight: 2,
          label: 'uses',
          metadata: {
            description: 'Component uses service',
          },
        })
      })
    }

    // Fallback: if no entry points or components found, connect high-importance nodes
    if (entryPoints.length === 0 || mainComponents.length === 0) {
      console.log('⚠️ No typical workflow found, connecting high-importance nodes')
      const importantNodes = nodes.filter(n => n.importance === 'high').slice(0, 4)
      for (let i = 0; i < importantNodes.length - 1; i++) {
        edges.push({
          id: `spine-fallback-${importantNodes[i].id}-${importantNodes[i + 1].id}`,
          source: importantNodes[i].id,
          target: importantNodes[i + 1].id,
          type: 'composition',
          weight: 2,
          label: 'connects',
          metadata: {
            description: 'Important file connection',
          },
        })
      }
    }
  }

  /**
   * Build only critical import relationships with enhanced validation
   */
  private buildCriticalImports(edges: WorkflowEdge[], nodeMap: Map<string, WorkflowNode>): void {
    console.log(`🔍 Building critical imports from ${this.importGraph.length} total imports`)
    
    // Only show imports for high-importance files to reduce clutter
    const criticalImports = this.importGraph.filter(({ importer }) => {
      const node = nodeMap.get(importer)
      return node && (node.importance === 'high' || node.type === 'entry')
    })

    console.log(`📋 Found ${criticalImports.length} critical imports`)

    criticalImports.slice(0, 8).forEach(({ importer, imported, specifiers }) => {
      const sourceNode = nodeMap.get(importer)
      if (!sourceNode) {
        console.warn(`⚠️ Source node not found for importer: ${importer}`)
        return
      }

      const targetNode = this.findTargetNode(nodeMap, imported, importer)
      if (!targetNode) {
        console.warn(`⚠️ Target node not found for import: ${imported} from ${importer}`)
        return
      }

      if (sourceNode.id === targetNode.id) {
        console.warn(`⚠️ Skipping self-import: ${sourceNode.id}`)
        return
      }

      const edgeId = `import-${sourceNode.id}-${targetNode.id}`
      
      // Check for duplicate edges
      if (edges.find(e => e.id === edgeId)) {
        console.log(`🔄 Skipping duplicate edge: ${edgeId}`)
        return
      }

      console.log(`✅ Creating import edge: ${sourceNode.name} → ${targetNode.name}`)
      edges.push({
        id: edgeId,
        source: sourceNode.id,
        target: targetNode.id,
        type: 'import',
        weight: Math.min(specifiers.length, 3),
        label: 'imports',
        metadata: {
          description: `Key import: ${specifiers.slice(0, 2).join(', ')}${specifiers.length > 2 ? '...' : ''}`,
        },
      })
    })
  }

  /**
   * Create essential config connections (only package.json and main configs)
   */
  private createEssentialConfigConnections(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const packageJson = nodes.find(node => node.name === 'package.json')
    const mainConfig = nodes.find(node => 
      node.name.includes('tsconfig') || node.name.includes('vite.config') || node.name.includes('webpack')
    )

    const entryPoints = nodes.filter(node => node.type === 'entry')

    // Package.json to entry points only
    if (packageJson && entryPoints.length > 0) {
      const mainEntry = entryPoints[0]
      edges.push({
        id: `config-${packageJson.id}-${mainEntry.id}`,
        source: packageJson.id,
        target: mainEntry.id,
        type: 'configuration',
        weight: 1,
        label: 'configures',
        metadata: {
          description: 'Project configuration',
        },
      })
    }

    // Main build config to entry point
    if (mainConfig && entryPoints.length > 0) {
      const mainEntry = entryPoints[0]
      edges.push({
        id: `config-${mainConfig.id}-${mainEntry.id}`,
        source: mainConfig.id,
        target: mainEntry.id,
        type: 'configuration',
        weight: 1,
        label: 'builds',
        metadata: {
          description: 'Build configuration',
        },
      })
    }
  }

  /**
   * Ensure minimal connectivity - connect isolated high-importance nodes
   */
  private ensureMinimalConnectivity(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const connectedNodes = new Set<string>()
    
    // Mark all connected nodes
    edges.forEach(edge => {
      connectedNodes.add(edge.source)
      connectedNodes.add(edge.target)
    })

    // Find high-importance isolated nodes
    const isolatedImportantNodes = nodes.filter(node => 
      !connectedNodes.has(node.id) && 
      (node.importance === 'high' || node.type === 'entry')
    )

    // Connect them to the main workflow
    if (isolatedImportantNodes.length > 0 && connectedNodes.size > 0) {
      const mainNodes = Array.from(connectedNodes)
        .map(id => nodes.find(n => n.id === id))
        .filter(Boolean) as WorkflowNode[]
      
      const hubNode = mainNodes.find(n => n.type === 'entry') || mainNodes[0]

      isolatedImportantNodes.slice(0, 3).forEach(isolatedNode => {
        edges.push({
          id: `connect-${hubNode.id}-${isolatedNode.id}`,
          source: hubNode.id,
          target: isolatedNode.id,
          type: 'composition',
          weight: 1,
          label: 'related',
          metadata: {
            description: 'Project component',
          },
        })
      })
    }
  }

  /**
   * Build detailed connections for advanced view
   */
  buildDetailedConnections(nodes: WorkflowNode[]): WorkflowEdge[] {
    const edges: WorkflowEdge[] = []
    const nodeMap = new Map(nodes.map(node => [node.id, node]))

    // All import relationships
    this.buildImportRelationships(nodes, edges, nodeMap)
    
    // Directory structure connections
    this.createHierarchicalConnections(nodes, edges)
    
    // All config connections
    this.connectConfigurationFiles(nodes, edges)
    
    // Full workflow chains
    this.createWorkflowChains(nodes, edges, nodeMap)
    
    // Related files
    this.connectRelatedFiles(nodes, edges)
    
    // Full connectivity
    this.ensureWorkflowConnectivity(nodes, edges)

    return edges
  }

  /**
   * Build direct import relationships
   */
  private buildImportRelationships(_nodes: WorkflowNode[], edges: WorkflowEdge[], nodeMap: Map<string, WorkflowNode>): void {
    this.importGraph.forEach(({ importer, imported, specifiers }) => {
      const sourceNode = nodeMap.get(importer)
      if (!sourceNode) return

      const targetNode = this.findTargetNode(nodeMap, imported, importer)
      
      if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
        const edgeId = `${sourceNode.id}-imports-${targetNode.id}`
        
        if (!edges.find(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: sourceNode.id,
            target: targetNode.id,
            type: 'import',
            weight: specifiers.length,
            label: `imports`,
            metadata: {
              description: `Imports: ${specifiers.join(', ')}`,
            },
          })

          if (!targetNode.dependents.includes(sourceNode.id)) {
            targetNode.dependents.push(sourceNode.id)
          }
        }
      }
    })
  }

  /**
   * Create hierarchical connections based on file structure
   */
  private createHierarchicalConnections(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    // Group files by directory
    const directoryGroups = new Map<string, WorkflowNode[]>()
    
    nodes.forEach(node => {
      const pathParts = node.file.path.split('/')
      const directory = pathParts.slice(0, -1).join('/') || 'root'
      
      if (!directoryGroups.has(directory)) {
        directoryGroups.set(directory, [])
      }
      directoryGroups.get(directory)!.push(node)
    })

    // Create parent-child directory relationships
    directoryGroups.forEach((dirNodes, directory) => {
      if (directory === 'root') return

      // Find parent directory nodes
      const parentDir = directory.substring(0, directory.lastIndexOf('/')) || 'root'
      const parentNodes = directoryGroups.get(parentDir) || []

      // Connect to parent directory files
      parentNodes.forEach(parentNode => {
        dirNodes.slice(0, 2).forEach(childNode => { // Connect to first 2 files to avoid clutter
          if (parentNode.id !== childNode.id) {
            const edgeId = `${parentNode.id}-contains-${childNode.id}`
            if (!edges.find(e => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: parentNode.id,
                target: childNode.id,
                type: 'composition',
                weight: 1,
                label: 'contains',
                metadata: {
                  description: `Directory structure relationship`,
                },
              })
            }
          }
        })
      })

      // Connect files within the same directory
      if (dirNodes.length > 1) {
        const indexFile = dirNodes.find(n => n.name.includes('index') || n.name.includes('main'))
        if (indexFile) {
          // Connect index file to other files in directory
          dirNodes
            .filter(n => n.id !== indexFile.id)
            .forEach(otherFile => {
              const edgeId = `${indexFile.id}-organizes-${otherFile.id}`
              if (!edges.find(e => e.id === edgeId)) {
                edges.push({
                  id: edgeId,
                  source: indexFile.id,
                  target: otherFile.id,
                  type: 'composition',
                  weight: 1,
                  label: 'organizes',
                  metadata: {
                    description: `Index file organizes module`,
                  },
                })
              }
            })
        } else {
          // Connect first file to others if no index file
          const [firstFile, ...otherFiles] = dirNodes
          otherFiles.slice(0, 3).forEach(otherFile => {
            const edgeId = `${firstFile.id}-relates-${otherFile.id}`
            if (!edges.find(e => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: firstFile.id,
                target: otherFile.id,
                type: 'composition',
                weight: 1,
                label: 'related',
                metadata: {
                  description: `Related files in same directory`,
                },
              })
            }
          })
        }
      }
    })
  }

  /**
   * Connect configuration files to their consumers
   */
  private connectConfigurationFiles(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const configFiles = nodes.filter(node => node.type === 'config')
    const nonConfigFiles = nodes.filter(node => node.type !== 'config')

    configFiles.forEach(configFile => {
      // Connect config files to main application files
      const relevantFiles = nonConfigFiles.filter(node => {
        // Connect package.json to everything
        if (configFile.name === 'package.json') return true
        
        // Connect TypeScript config to TS files
        if (configFile.name.includes('tsconfig') && 
            (node.file.path.endsWith('.ts') || node.file.path.endsWith('.tsx'))) {
          return true
        }
        
        // Connect other configs to entry points and important files
        if (node.type === 'entry' || node.importance === 'high') return true
        
        return false
      })

      relevantFiles.slice(0, 5).forEach(targetFile => { // Limit to 5 connections per config
        const edgeId = `${configFile.id}-configures-${targetFile.id}`
        if (!edges.find(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: configFile.id,
            target: targetFile.id,
            type: 'configuration',
            weight: 1,
            label: 'configures',
            metadata: {
              description: `Configuration for ${targetFile.name}`,
            },
          })
        }
      })
    })
  }

  /**
   * Create workflow chains from entry points
   */
  private createWorkflowChains(nodes: WorkflowNode[], edges: WorkflowEdge[], _nodeMap: Map<string, WorkflowNode>): void {
    const entryPoints = nodes.filter(node => node.type === 'entry')
    const componentFiles = nodes.filter(node => node.type === 'component')
    const utilityFiles = nodes.filter(node => node.type === 'utility')
    const serviceFiles = nodes.filter(node => node.type === 'service')

    entryPoints.forEach(entryPoint => {
      // Entry points flow to components
      componentFiles.slice(0, 4).forEach((component, index) => {
        const edgeId = `${entryPoint.id}-uses-${component.id}`
        if (!edges.find(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: entryPoint.id,
            target: component.id,
            type: 'data-flow',
            weight: 4 - index, // Higher weight for first components
            label: 'uses',
            metadata: {
              description: `Entry point uses component`,
            },
          })
        }
      })

      // Entry points flow to services
      serviceFiles.slice(0, 2).forEach(service => {
        const edgeId = `${entryPoint.id}-calls-${service.id}`
        if (!edges.find(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: entryPoint.id,
            target: service.id,
            type: 'call',
            weight: 2,
            label: 'calls',
            metadata: {
              description: `Entry point calls service`,
            },
          })
        }
      })
    })

    // Components flow to utilities and services
    componentFiles.forEach(component => {
      // Connect to utilities
      utilityFiles.slice(0, 2).forEach(utility => {
        const edgeId = `${component.id}-uses-${utility.id}`
        if (!edges.find(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: component.id,
            target: utility.id,
            type: 'data-flow',
            weight: 1,
            label: 'uses',
            metadata: {
              description: `Component uses utility`,
            },
          })
        }
      })

      // Connect to services
      serviceFiles.slice(0, 1).forEach(service => {
        const edgeId = `${component.id}-calls-${service.id}`
        if (!edges.find(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: component.id,
            target: service.id,
            type: 'call',
            weight: 1,
            label: 'calls',
            metadata: {
              description: `Component calls service`,
            },
          })
        }
      })
    })
  }

  /**
   * Connect related files by type and functionality
   */
  private connectRelatedFiles(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    // Group nodes by type
    const typeGroups = new Map<string, WorkflowNode[]>()
    nodes.forEach(node => {
      if (!typeGroups.has(node.type)) {
        typeGroups.set(node.type, [])
      }
      typeGroups.get(node.type)!.push(node)
    })

    // Connect files of the same type
    typeGroups.forEach((typeNodes, type) => {
      if (typeNodes.length > 1 && type !== 'config') {
        // Connect first node to others in the same type
        const [firstNode, ...otherNodes] = typeNodes
        otherNodes.forEach(otherNode => {
          const edgeId = `${firstNode.id}-related-${otherNode.id}`
          if (!edges.find(e => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              source: firstNode.id,
              target: otherNode.id,
              type: 'composition',
              weight: 1,
              label: 'similar',
              metadata: {
                description: `Related ${type} files`,
              },
            })
          }
        })
      }
    })

    // Connect files with similar names (likely related functionality)
    nodes.forEach(node => {
      const baseName = node.name.replace(/\.(ts|tsx|js|jsx)$/, '').toLowerCase()
      const relatedNodes = nodes.filter(other => {
        if (other.id === node.id) return false
        const otherBaseName = other.name.replace(/\.(ts|tsx|js|jsx)$/, '').toLowerCase()
        return baseName.includes(otherBaseName) || otherBaseName.includes(baseName) ||
               (baseName.length > 3 && otherBaseName.length > 3 && 
                (baseName.includes(otherBaseName.substring(0, 4)) || 
                 otherBaseName.includes(baseName.substring(0, 4))))
      })

      relatedNodes.slice(0, 2).forEach(relatedNode => {
        const edgeId = `${node.id}-similar-${relatedNode.id}`
        if (!edges.find(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: node.id,
            target: relatedNode.id,
            type: 'composition',
            weight: 1,
            label: 'similar',
            metadata: {
              description: `Similar functionality`,
            },
          })
        }
      })
    })
  }

  /**
   * Ensure all nodes are connected to the main workflow
   */
  private ensureWorkflowConnectivity(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    // Find connected components
    const visited = new Set<string>()
    const components: Set<string>[] = []

    const dfs = (nodeId: string, component: Set<string>) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      component.add(nodeId)

      // Follow all edges
      edges.forEach(edge => {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          dfs(edge.target, component)
        }
        if (edge.target === nodeId && !visited.has(edge.source)) {
          dfs(edge.source, component)
        }
      })
    }

    // Find all connected components
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const component = new Set<string>()
        dfs(node.id, component)
        if (component.size > 0) {
          components.push(component)
        }
      }
    })

    // Connect isolated nodes to the main component
    if (components.length > 1) {
      // Find the largest component (main workflow)
      const mainComponent = components.reduce((largest, current) => 
        current.size > largest.size ? current : largest
      )

      // Connect other components to main component
      components.forEach(component => {
        if (component === mainComponent) return

        const componentNodes = Array.from(component).map(id => nodes.find(n => n.id === id)!).filter(Boolean)
        const mainNodes = Array.from(mainComponent).map(id => nodes.find(n => n.id === id)!).filter(Boolean)

        // Find best connection point
        const bestComponentNode = componentNodes.find(n => n.importance === 'high') || componentNodes[0]
        const bestMainNode = mainNodes.find(n => n.type === 'entry') || 
                            mainNodes.find(n => n.importance === 'high') || 
                            mainNodes[0]

        if (bestComponentNode && bestMainNode) {
          const edgeId = `${bestMainNode.id}-connects-${bestComponentNode.id}`
          if (!edges.find(e => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              source: bestMainNode.id,
              target: bestComponentNode.id,
              type: 'composition',
              weight: 1,
              label: 'connects',
              metadata: {
                description: `Workflow connection`,
              },
            })
          }
        }
      })
    }
  }

  /**
   * Find target node using multiple strategies with enhanced logging
   */
  private findTargetNode(nodeMap: Map<string, WorkflowNode>, imported: string, importer: string): WorkflowNode | null {
    console.log(`🔍 Finding target node for import '${imported}' from '${importer}'`)
    
    // Strategy 1: Direct path match
    let targetNode = nodeMap.get(imported)
    if (targetNode) {
      console.log(`✅ Direct path match found: ${targetNode.name}`)
      return targetNode
    }

    // Strategy 2: Resolve relative imports
    if (imported.startsWith('./') || imported.startsWith('../')) {
      const resolvedPath = this.resolveRelativePath(imported, importer)
      console.log(`🔄 Resolved relative path: ${imported} → ${resolvedPath}`)
      targetNode = nodeMap.get(resolvedPath)
      if (targetNode) {
        console.log(`✅ Relative path match found: ${targetNode.name}`)
        return targetNode
      }
    }

    // Strategy 3: Find by filename with extension variants
    const importedFileName = imported.split('/').pop()
    if (importedFileName) {
      const extensionVariants = [
        importedFileName,
        `${importedFileName}.ts`,
        `${importedFileName}.tsx`,
        `${importedFileName}.js`,
        `${importedFileName}.jsx`,
        `${importedFileName}/index.ts`,
        `${importedFileName}/index.tsx`,
        `${importedFileName}/index.js`,
        `${importedFileName}/index.jsx`
      ]

      for (const variant of extensionVariants) {
        for (const [, node] of nodeMap) {
          if (node.name === variant || node.file.path.endsWith(`/${variant}`)) {
            console.log(`✅ Filename variant match found: ${node.name} (variant: ${variant})`)
            return node
          }
        }
      }
    }

    // Strategy 4: Find by partial path match (enhanced)
    for (const [path, node] of nodeMap) {
      // Check if the import path matches any part of the node path
      if (path.includes(imported) || imported.includes(node.name.replace(/\.(ts|tsx|js|jsx)$/, ''))) {
        console.log(`✅ Partial path match found: ${node.name} (path: ${path})`)
        return node
      }
    }

    // Strategy 5: Handle scoped imports (e.g., @/components/Button)
    if (imported.startsWith('@/')) {
      const scopedPath = imported.replace('@/', 'src/')
      for (const [path, node] of nodeMap) {
        if (path.includes(scopedPath)) {
          console.log(`✅ Scoped import match found: ${node.name}`)
          return node
        }
      }
    }

    console.log(`❌ Target node not found for import: ${imported}`)
    return null
  }

  /**
   * Resolve relative import paths
   */
  private resolveRelativePath(importPath: string, importer: string): string {
    const importerDir = importer.substring(0, importer.lastIndexOf('/'))
    const parts = importerDir.split('/').filter(Boolean)
    
    const importParts = importPath.split('/').filter(Boolean)
    
    for (const part of importParts) {
      if (part === '..') {
        parts.pop()
      } else if (part !== '.') {
        parts.push(part)
      }
    }
    
    return '/' + parts.join('/')
  }

  /**
   * Calculate repository metrics
   */
  private calculateMetrics(nodes: WorkflowNode[], edges: WorkflowEdge[]): RepositoryWorkflow['metrics'] {
    const totalFiles = nodes.length
    const totalFunctions = nodes.reduce((sum, node) => sum + (node.astInfo?.functions.length || 0), 0)
    const totalClasses = nodes.reduce((sum, node) => sum + (node.astInfo?.classes.length || 0), 0)
    const avgComplexity = nodes.reduce((sum, node) => sum + node.complexity, 0) / totalFiles
    
    // Calculate dependency depth (longest path from entry point)
    const dependencyDepth = this.calculateDependencyDepth(nodes, edges)
    
    // Calculate coupling metric (average connections per node)
    const couplingMetric = edges.length / totalFiles

    return {
      totalFiles,
      totalFunctions,
      totalClasses,
      avgComplexity,
      dependencyDepth,
      couplingMetric,
    }
  }

  /**
   * Calculate maximum dependency depth
   */
  private calculateDependencyDepth(nodes: WorkflowNode[], edges: WorkflowEdge[]): number {
    // Simple BFS to find longest path from entry points
    const entryPoints = nodes.filter(node => node.type === 'entry')
    let maxDepth = 0

    entryPoints.forEach(entry => {
      const visited = new Set<string>()
      const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: entry.id, depth: 0 }]

      while (queue.length > 0) {
        const { nodeId, depth } = queue.shift()!
        
        if (visited.has(nodeId)) continue
        visited.add(nodeId)
        
        maxDepth = Math.max(maxDepth, depth)

        // Add dependencies to queue
        const dependencies = edges
          .filter(edge => edge.source === nodeId)
          .map(edge => edge.target)

        dependencies.forEach(depId => {
          if (!visited.has(depId)) {
            queue.push({ nodeId: depId, depth: depth + 1 })
          }
        })
      }
    })

    return maxDepth
  }

  /**
   * Identify clusters of related files
   */
  private identifyClusters(nodes: WorkflowNode[]): RepositoryWorkflow['clusters'] {
    const clusters: RepositoryWorkflow['clusters'] = []
    
    // Group by directory
    const directoryGroups = new Map<string, WorkflowNode[]>()
    
    nodes.forEach(node => {
      const directory = node.file.path.substring(0, node.file.path.lastIndexOf('/')) || 'root'
      const group = directoryGroups.get(directory) || []
      group.push(node)
      directoryGroups.set(directory, group)
    })

    // Create clusters from directories with multiple files
    directoryGroups.forEach((nodeGroup, directory) => {
      if (nodeGroup.length > 1) {
        clusters.push({
          id: directory,
          name: directory.split('/').pop() || 'root',
          nodeIds: nodeGroup.map(node => node.id),
          purpose: this.inferClusterPurpose(nodeGroup),
        })
      }
    })

    return clusters
  }

  /**
   * Infer cluster purpose from node types
   */
  private inferClusterPurpose(nodes: WorkflowNode[]): string {
    const typeCount = new Map<string, number>()
    
    nodes.forEach(node => {
      typeCount.set(node.type, (typeCount.get(node.type) || 0) + 1)
    })

    const dominantType = Array.from(typeCount.entries())
      .sort(([,a], [,b]) => b - a)[0]?.[0]

    switch (dominantType) {
      case 'component':
        return 'UI Components and presentation logic'
      case 'service':
        return 'Business logic and API integration'
      case 'utility':
        return 'Helper functions and utilities'
      case 'config':
        return 'Configuration and setup files'
      case 'test':
        return 'Test files and test utilities'
      case 'type':
        return 'Type definitions and interfaces'
      default:
        return 'Mixed functionality'
    }
  }

  /**
   * Identify entry points
   */
  private identifyEntryPoints(nodes: WorkflowNode[]): string[] {
    return nodes
      .filter(node => node.type === 'entry' || node.importance === 'high')
      .map(node => node.id)
  }

  /**
   * Identify critical paths in the codebase
   */
  private identifyCriticalPaths(nodes: WorkflowNode[], edges: WorkflowEdge[]): RepositoryWorkflow['criticalPaths'] {
    const paths: RepositoryWorkflow['criticalPaths'] = []
    
    // Find paths from entry points to high-importance nodes
    const entryPoints = nodes.filter(node => node.type === 'entry')
    const importantNodes = nodes.filter(node => node.importance === 'high')

    entryPoints.forEach(entry => {
      importantNodes.forEach(target => {
        if (entry.id !== target.id) {
          const path = this.findPath(entry.id, target.id, edges)
          if (path.length > 1) {
            paths.push({
              path,
              description: `Critical path from ${entry.name} to ${target.name}`,
              importance: 0.8,
            })
          }
        }
      })
    })

    return paths.slice(0, 10) // Limit to top 10 paths
  }

  /**
   * Find shortest path between two nodes
   */
  private findPath(startId: string, endId: string, edges: WorkflowEdge[]): string[] {
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: startId, path: [startId] }]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!
      
      if (nodeId === endId) {
        return path
      }

      if (visited.has(nodeId)) continue
      visited.add(nodeId)

      // Add connected nodes
      edges
        .filter(edge => edge.source === nodeId)
        .forEach(edge => {
          if (!visited.has(edge.target)) {
            queue.push({
              nodeId: edge.target,
              path: [...path, edge.target],
            })
          }
        })
    }

    return []
  }

  /**
   * Optimize node layout using hierarchical structure
   */
  private optimizeLayout(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    this.createHierarchicalLayout(nodes, edges)
  }

  /**
   * Create hierarchical layout based on execution flow
   */
  private createHierarchicalLayout(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const width = 1400
    const height = 1000
    const layers: Map<number, WorkflowNode[]> = new Map()
    
    // Step 1: Identify entry points and build dependency levels
    const entryPoints = nodes.filter(node => 
      node.type === 'entry' || 
      node.dependencies.length === 0 ||
      ['main.tsx', 'main.ts', 'index.tsx', 'index.ts', 'app.tsx', 'app.ts'].includes(node.name.toLowerCase())
    )
    
    if (entryPoints.length === 0) {
      // Fallback: use files with fewest dependencies as entry points
      const minDeps = Math.min(...nodes.map(n => n.dependencies.length))
      entryPoints.push(...nodes.filter(n => n.dependencies.length === minDeps).slice(0, 3))
    }

    // Step 2: Calculate node levels using BFS from entry points
    const visited = new Set<string>()
    const nodeDepths = new Map<string, number>()
    
    // Initialize entry points at level 0
    entryPoints.forEach(node => {
      nodeDepths.set(node.id, 0)
      if (!layers.has(0)) layers.set(0, [])
      layers.get(0)!.push(node)
      visited.add(node.id)
    })

    // BFS to assign levels
    let currentLevel = 0
    let hasChanges = true
    
    while (hasChanges && currentLevel < 10) { // Prevent infinite loops
      hasChanges = false
      const currentLevelNodes = layers.get(currentLevel) || []
      
      currentLevelNodes.forEach(node => {
        // Find all nodes that depend on this node
        const dependentNodes = nodes.filter(n => 
          n.dependencies.some(dep => 
            dep.includes(node.name) || dep.includes(node.file.name) || n.id.includes(node.id)
          ) ||
          edges.some(edge => edge.source === node.id && edge.target === n.id)
        )
        
        dependentNodes.forEach(depNode => {
          if (!visited.has(depNode.id)) {
            const newLevel = currentLevel + 1
            nodeDepths.set(depNode.id, newLevel)
            
            if (!layers.has(newLevel)) layers.set(newLevel, [])
            layers.get(newLevel)!.push(depNode)
            visited.add(depNode.id)
            hasChanges = true
          }
        })
      })
      
      currentLevel++
    }

    // Step 3: Handle unvisited nodes (isolated or circular dependencies)
    const unvisitedNodes = nodes.filter(node => !visited.has(node.id))
    if (unvisitedNodes.length > 0) {
      const isolatedLevel = Math.max(...Array.from(layers.keys())) + 1
      if (!layers.has(isolatedLevel)) layers.set(isolatedLevel, [])
      
      // Group isolated nodes by type
      const groupedNodes = this.groupNodesByType(unvisitedNodes)
      Object.values(groupedNodes).forEach(typeNodes => {
        layers.get(isolatedLevel)!.push(...typeNodes)
      })
    }

    // Step 4: Position nodes in hierarchical layout
    this.positionNodesHierarchically(layers, width, height)
    
    // Step 5: Fine-tune positions to avoid overlaps
    this.adjustForOverlaps(nodes, width, height)
  }

  /**
   * Group nodes by their type for better organization
   */
  private groupNodesByType(nodes: WorkflowNode[]): Record<string, WorkflowNode[]> {
    const groups: Record<string, WorkflowNode[]> = {
      entry: [],
      component: [],
      service: [],
      utility: [],
      config: [],
      test: [],
      type: []
    }

    nodes.forEach(node => {
      if (groups[node.type]) {
        groups[node.type].push(node)
      } else {
        groups.component.push(node) // Default fallback
      }
    })

    return groups
  }

  /**
   * Position nodes hierarchically by levels
   */
  private positionNodesHierarchically(layers: Map<number, WorkflowNode[]>, width: number, height: number): void {
    const maxLevels = Math.max(...Array.from(layers.keys())) + 1
    const levelHeight = height / Math.max(maxLevels, 4) // Minimum 4 levels for better spacing
    
    Array.from(layers.entries()).forEach(([level, levelNodes]) => {
      const y = 100 + (level * levelHeight) // Start from top with padding
      const nodeWidth = 200 // Approximate node width
      const spacing = Math.max(nodeWidth + 50, width / Math.max(levelNodes.length, 1))
      
      // Sort nodes within level by importance and type
      levelNodes.sort((a, b) => {
        // Entry points first
        if (a.type === 'entry' && b.type !== 'entry') return -1
        if (b.type === 'entry' && a.type !== 'entry') return 1
        
        // Then by importance
        const importanceOrder = { high: 0, medium: 1, low: 2 }
        const aImportance = importanceOrder[a.importance]
        const bImportance = importanceOrder[b.importance]
        if (aImportance !== bImportance) return aImportance - bImportance
        
        // Then by type priority
        const typeOrder = { entry: 0, component: 1, service: 2, utility: 3, config: 4, test: 5, type: 6 }
        const aTypeOrder = typeOrder[a.type] || 7
        const bTypeOrder = typeOrder[b.type] || 7
        return aTypeOrder - bTypeOrder
      })
      
      // Calculate starting X position to center the level
      const totalWidth = (levelNodes.length - 1) * spacing
      const startX = (width - totalWidth) / 2
      
      levelNodes.forEach((node, index) => {
        node.position = {
          x: Math.max(100, Math.min(width - 100, startX + (index * spacing))),
          y: y
        }
      })
    })
  }

  /**
   * Adjust positions to avoid node overlaps
   */
  private adjustForOverlaps(nodes: WorkflowNode[], width: number, height: number): void {
    const minDistance = 180 // Minimum distance between nodes
    const maxIterations = 50
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let hasOverlap = false
      
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const node1 = nodes[i]
          const node2 = nodes[j]
          
          const dx = node1.position.x - node2.position.x
          const dy = node1.position.y - node2.position.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          if (distance < minDistance && distance > 0) {
            hasOverlap = true
            
            // Calculate separation vector
            const separationX = (dx / distance) * (minDistance - distance) * 0.5
            const separationY = (dy / distance) * (minDistance - distance) * 0.5
            
            // Apply separation with bounds checking
            node1.position.x = Math.max(100, Math.min(width - 100, node1.position.x + separationX))
            node1.position.y = Math.max(80, Math.min(height - 80, node1.position.y + separationY))
            
            node2.position.x = Math.max(100, Math.min(width - 100, node2.position.x - separationX))
            node2.position.y = Math.max(80, Math.min(height - 80, node2.position.y - separationY))
          }
        }
      }
      
      if (!hasOverlap) break // Early termination if no overlaps
    }
  }

  /**
   * Find file node by path (recursive search)
   */
  private findFileNode(files: FileNode[], path: string): FileNode | null {
    const findRecursive = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.path === path) {
          return node
        }
        
        if (node.children && node.children.length > 0) {
          const found = findRecursive(node.children)
          if (found) return found
        }
      }
      return null
    }

    const result = findRecursive(files)
    if (!result) {
      console.warn(`⚠️ Could not find file node for path: ${path}`)
      console.log(`📋 Available paths:`, this.getAllFilePaths(files))
    }
    return result
  }

  /**
   * Get all file paths for debugging
   */
  private getAllFilePaths(files: FileNode[]): string[] {
    const paths: string[] = []
    
    const collectPaths = (nodes: FileNode[]) => {
      for (const node of nodes) {
        paths.push(node.path)
        if (node.children) {
          collectPaths(node.children)
        }
      }
    }
    
    collectPaths(files)
    return paths
  }

  /**
   * Get mock file content for demo purposes
   */
  private getMockFileContent(fileNode: FileNode): string {
    const name = fileNode.name.toLowerCase()
    const ext = fileNode.extension?.toLowerCase()
    
    // Generate realistic content based on file type and name
    if (name.includes('index') || name.includes('main') || name === 'app.tsx' || name === 'app.ts') {
      return `
        import React from 'react'
        import { Component } from './components/Component'
        import { Service } from './services/Service'
        import { Utils } from './utils/Utils'
        import './styles/App.css'
        
        export class App {
          private service: Service
          
          constructor() {
            this.service = new Service()
            this.init()
          }
          
          private async init(): Promise<void> {
            try {
              const data = await this.service.fetchData('main')
              const processedData = Utils.processData(data)
              this.render(processedData)
            } catch (error) {
              console.error('App initialization failed:', error)
            }
          }
          
          private render(data: any): void {
            const component = new Component(data)
            component.mount('#app')
          }
          
          public start(): void {
            this.init()
          }
        }
        
        export default App
        
        // Initialize application
        const app = new App()
        app.start()
      `
    }
    
    if (name.includes('component') || ext === 'tsx' || ext === 'jsx') {
      const componentName = name.replace(/\.(tsx?|jsx?)$/, '').replace(/^\w/, c => c.toUpperCase())
      return `
        import React, { useState, useEffect, useCallback } from 'react'
        import { Button } from '../ui/Button'
        import { Modal } from '../ui/Modal'
        import { useApi } from '../hooks/useApi'
        import { validateInput } from '../utils/validation'
        import type { ${componentName}Props, ${componentName}State } from '../types'
        
        interface Props extends ${componentName}Props {
          onUpdate?: (data: any) => void
          className?: string
        }
        
        export function ${componentName}({ data, onUpdate, className }: Props) {
          const [state, setState] = useState<${componentName}State>({
            loading: false,
            error: null,
            items: []
          })
          
          const { fetchData, postData } = useApi()
          
          const handleSubmit = useCallback(async (formData: any) => {
            if (!validateInput(formData)) {
              setState(prev => ({ ...prev, error: 'Invalid input' }))
              return
            }
            
            setState(prev => ({ ...prev, loading: true }))
            
            try {
              const result = await postData('/api/${name}', formData)
              setState(prev => ({ ...prev, items: [...prev.items, result], loading: false }))
              onUpdate?.(result)
            } catch (error) {
              setState(prev => ({ ...prev, error: error.message, loading: false }))
            }
          }, [onUpdate, postData])
          
          useEffect(() => {
            fetchData('/api/${name}')
              .then(items => setState(prev => ({ ...prev, items })))
              .catch(error => setState(prev => ({ ...prev, error: error.message })))
          }, [fetchData])
          
          if (state.loading) {
            return <div className="loading">Loading...</div>
          }
          
          return (
            <div className={\`${name}-container \${className || ''}\`}>
              <h2>${componentName}</h2>
              {state.error && (
                <div className="error">{state.error}</div>
              )}
              <div className="items">
                {state.items.map((item, index) => (
                  <div key={index} className="item">
                    <span>{item.name}</span>
                    <Button onClick={() => handleSubmit(item)}>
                      Process
                    </Button>
                  </div>
                ))}
              </div>
              <Modal isOpen={state.loading} onClose={() => {}}>
                Processing...
              </Modal>
            </div>
          )
        }
        
        export default ${componentName}
      `
    }
    
    if (name.includes('service') || name.includes('api') || name.includes('client')) {
      const serviceName = name.replace(/\.(ts|js)$/, '').replace(/^\w/, c => c.toUpperCase())
      return `
        import { HttpClient } from './HttpClient'
        import { Logger } from '../utils/Logger'
        import { Config } from '../config/Config'
        import type { ApiResponse, ServiceConfig } from '../types'
        
        export class ${serviceName} {
          private client: HttpClient
          private logger: Logger
          private config: ServiceConfig
          
          constructor(config?: Partial<ServiceConfig>) {
            this.config = { ...Config.defaultService, ...config }
            this.client = new HttpClient(this.config.baseUrl)
            this.logger = new Logger('${serviceName}')
          }
          
          async fetchData(id: string): Promise<any> {
            this.logger.info(\`Fetching data for id: \${id}\`)
            
            try {
              const response = await this.client.get(\`/data/\${id}\`)
              return this.processResponse(response)
            } catch (error) {
              this.logger.error('Failed to fetch data:', error)
              throw new Error(\`Failed to fetch data: \${error.message}\`)
            }
          }
          
          async postData(endpoint: string, data: any): Promise<ApiResponse> {
            this.logger.info(\`Posting data to: \${endpoint}\`)
            
            const validatedData = this.validateData(data)
            
            try {
              const response = await this.client.post(endpoint, validatedData)
              this.logger.info('Data posted successfully')
              return response
            } catch (error) {
              this.logger.error('Failed to post data:', error)
              throw error
            }
          }
          
          private processResponse(response: any): any {
            if (!response || !response.data) {
              throw new Error('Invalid response format')
            }
            
            return {
              ...response.data,
              processed: true,
              timestamp: new Date().toISOString()
            }
          }
          
          private validateData(data: any): any {
            if (!data || typeof data !== 'object') {
              throw new Error('Invalid data format')
            }
            
            return {
              ...data,
              validated: true,
              source: '${serviceName}'
            }
          }
          
          async healthCheck(): Promise<boolean> {
            try {
              await this.client.get('/health')
              return true
            } catch {
              return false
            }
          }
        }
        
        export default ${serviceName}
      `
    }
    
    if (name.includes('util') || name.includes('helper') || name.includes('common')) {
      return `
        import { Logger } from './Logger'
        
        const logger = new Logger('Utils')
        
        export function processData<T>(data: T[]): T[] {
          logger.info(\`Processing \${data.length} items\`)
          
          return data
            .filter(item => item !== null && item !== undefined)
            .map(item => ({
              ...item,
              processed: true,
              timestamp: Date.now()
            }))
        }
        
        export function validateInput(input: any): boolean {
          if (!input) return false
          
          if (typeof input === 'string') {
            return input.trim().length > 0
          }
          
          if (typeof input === 'object') {
            return Object.keys(input).length > 0
          }
          
          return true
        }
        
        export function formatError(error: Error | string): string {
          if (typeof error === 'string') {
            return error
          }
          
          return \`\${error.name}: \${error.message}\`
        }
        
        export function debounce<T extends (...args: any[]) => any>(
          func: T,
          wait: number
        ): (...args: Parameters<T>) => void {
          let timeout: NodeJS.Timeout
          
          return (...args: Parameters<T>) => {
            clearTimeout(timeout)
            timeout = setTimeout(() => func(...args), wait)
          }
        }
        
        export function throttle<T extends (...args: any[]) => any>(
          func: T,
          limit: number
        ): (...args: Parameters<T>) => void {
          let inThrottle: boolean
          
          return (...args: Parameters<T>) => {
            if (!inThrottle) {
              func(...args)
              inThrottle = true
              setTimeout(() => (inThrottle = false), limit)
            }
          }
        }
        
        export class DataProcessor {
          private cache = new Map<string, any>()
          
          process(key: string, data: any): any {
            if (this.cache.has(key)) {
              logger.info(\`Using cached data for key: \${key}\`)
              return this.cache.get(key)
            }
            
            const processed = this.transform(data)
            this.cache.set(key, processed)
            
            return processed
          }
          
          private transform(data: any): any {
            return {
              ...data,
              transformed: true,
              id: Math.random().toString(36).substr(2, 9)
            }
          }
          
          clearCache(): void {
            this.cache.clear()
            logger.info('Cache cleared')
          }
        }
        
        export default {
          processData,
          validateInput,
          formatError,
          debounce,
          throttle,
          DataProcessor
        }
      `
    }
    
    if (name.includes('config') || ext === 'json' || name.includes('settings')) {
      return `
        export const Config = {
          api: {
            baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',
            timeout: 5000,
            retries: 3
          },
          
          features: {
            enableLogging: true,
            enableCache: true,
            enableMetrics: false
          },
          
          ui: {
            theme: 'light',
            language: 'en',
            animations: true
          },
          
          defaultService: {
            baseUrl: 'https://api.example.com',
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        }
        
        export type ConfigType = typeof Config
        
        export default Config
      `
    }
    
    if (name.includes('test') || name.includes('spec') || ext === 'test.ts' || ext === 'spec.ts') {
      const testName = name.replace(/\.(test|spec)\.(ts|js)$/, '')
      return `
        import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
        import { ${testName} } from '../${testName}'
        
        describe('${testName}', () => {
          let instance: ${testName}
          
          beforeEach(() => {
            instance = new ${testName}()
          })
          
          afterEach(() => {
            jest.clearAllMocks()
          })
          
          describe('initialization', () => {
            it('should create instance successfully', () => {
              expect(instance).toBeDefined()
              expect(instance).toBeInstanceOf(${testName})
            })
            
            it('should have default configuration', () => {
              expect(instance.config).toBeDefined()
              expect(instance.config.timeout).toBeGreaterThan(0)
            })
          })
          
          describe('fetchData', () => {
            it('should fetch data successfully', async () => {
              const mockData = { id: '1', name: 'Test' }
              jest.spyOn(instance, 'fetchData').mockResolvedValue(mockData)
              
              const result = await instance.fetchData('1')
              
              expect(result).toEqual(mockData)
              expect(instance.fetchData).toHaveBeenCalledWith('1')
            })
            
            it('should handle fetch errors', async () => {
              const error = new Error('Network error')
              jest.spyOn(instance, 'fetchData').mockRejectedValue(error)
              
              await expect(instance.fetchData('invalid')).rejects.toThrow('Network error')
            })
          })
          
          describe('processData', () => {
            it('should process data correctly', () => {
              const input = [{ name: 'test1' }, { name: 'test2' }]
              const result = instance.processData(input)
              
              expect(result).toHaveLength(2)
              expect(result[0]).toHaveProperty('processed', true)
              expect(result[1]).toHaveProperty('processed', true)
            })
            
            it('should filter out null values', () => {
              const input = [{ name: 'test1' }, null, { name: 'test2' }]
              const result = instance.processData(input)
              
              expect(result).toHaveLength(2)
              expect(result.every(item => item !== null)).toBe(true)
            })
          })
          
          describe('validation', () => {
            it('should validate correct input', () => {
              const validInput = { name: 'test', value: 123 }
              expect(instance.validateInput(validInput)).toBe(true)
            })
            
            it('should reject invalid input', () => {
              expect(instance.validateInput(null)).toBe(false)
              expect(instance.validateInput('')).toBe(false)
              expect(instance.validateInput({})).toBe(false)
            })
          })
        })
      `
    }
    
    if (name.includes('type') || name.includes('interface') || ext === 'd.ts') {
      return `
        export interface User {
          id: string
          name: string
          email: string
          role: UserRole
          createdAt: Date
          updatedAt: Date
        }
        
        export type UserRole = 'admin' | 'user' | 'moderator'
        
        export interface ApiResponse<T = any> {
          data: T
          status: number
          message: string
          timestamp: string
        }
        
        export interface ServiceConfig {
          baseUrl: string
          timeout: number
          retries: number
          headers: Record<string, string>
        }
        
        export interface ComponentProps {
          id?: string
          className?: string
          children?: React.ReactNode
        }
        
        export interface ComponentState {
          loading: boolean
          error: string | null
          items: any[]
        }
        
        export type EventHandler<T = any> = (event: T) => void
        
        export interface Repository {
          id: string
          name: string
          owner: string
          description?: string
          language: string
          stars: number
          forks: number
          url: string
        }
        
        export interface FileNode {
          id: string
          name: string
          path: string
          type: 'file' | 'directory'
          size?: number
          children?: FileNode[]
        }
        
        export interface AnalysisResult {
          complexity: number
          dependencies: string[]
          exports: string[]
          functions: FunctionInfo[]
          classes: ClassInfo[]
        }
        
        export interface FunctionInfo {
          name: string
          parameters: string[]
          returnType?: string
          complexity: number
          lineStart: number
          lineEnd: number
        }
        
        export interface ClassInfo {
          name: string
          methods: FunctionInfo[]
          properties: string[]
          extends?: string
          implements?: string[]
        }
        
        export type ThemeMode = 'light' | 'dark' | 'auto'
        
        export interface AppConfig {
          theme: ThemeMode
          language: string
          features: {
            [key: string]: boolean
          }
        }
      `
    }

    // Default generic content for other files
    return `
      // ${fileNode.name}
      // Generated mock content for AST analysis
      
      import { Logger } from '../utils/Logger'
      
      const logger = new Logger('${fileNode.name}')
      
      export class ${fileNode.name.replace(/\.[^.]+$/, '').replace(/^\w/, c => c.toUpperCase())} {
        private initialized = false
        
        constructor() {
          this.init()
        }
        
        private init(): void {
          logger.info('Initializing ${fileNode.name}')
          this.initialized = true
        }
        
        public execute(): any {
          if (!this.initialized) {
            throw new Error('Not initialized')
          }
          
          logger.info('Executing ${fileNode.name}')
          return this.process()
        }
        
        private process(): any {
          return {
            result: 'success',
            timestamp: new Date().toISOString(),
            source: '${fileNode.name}'
          }
        }
        
        public getStatus(): boolean {
          return this.initialized
        }
      }
      
      export function main(): void {
        logger.info('Main function called in ${fileNode.name}')
      }
      
      export default ${fileNode.name.replace(/\.[^.]+$/, '').replace(/^\w/, c => c.toUpperCase())}
    `
  }
}

export const astAnalyzer = new ASTAnalyzer()
