/**
 * Gemini AI integration for advanced repository analysis
 * Provides intelligent code understanding and workflow visualization
 */

export interface GeminiConfig {
  apiKey: string
  model?: string
}

export interface CodeAnalysisRequest {
  repositoryName: string
  repositoryDescription?: string
  techStack: string[]
  entryPoints: string[]
  fileStructure: string
  keyFiles: Array<{
    path: string
    content: string
    type: 'entry' | 'component' | 'config' | 'utility' | 'api' | 'test' | 'docs'
  }>
}

export interface WorkflowStep {
  id: string
  title: string
  description: string
  files: string[]
  type: 'initialization' | 'processing' | 'rendering' | 'api_call' | 'data_flow' | 'user_interaction'
  dependencies: string[]
  importance: 'critical' | 'important' | 'optional'
}

export interface ComponentRelationship {
  from: string
  to: string
  relationship: 'imports' | 'extends' | 'uses' | 'calls' | 'renders' | 'configures' | 'tests'
  strength: number // 1-10, how strong the relationship is
  description: string
}

export interface ArchitecturePattern {
  name: string
  description: string
  components: string[]
  confidence: number // 0-1
}

export interface GeminiAnalysisResponse {
  overview: {
    summary: string
    purpose: string
    targetAudience: string
    complexity: 'beginner' | 'intermediate' | 'advanced'
  }
  workflow: {
    steps: WorkflowStep[]
    dataFlow: Array<{
      from: string
      to: string
      dataType: string
      description: string
    }>
  }
  architecture: {
    patterns: ArchitecturePattern[]
    layers: Array<{
      name: string
      files: string[]
      responsibility: string
    }>
  }
  relationships: ComponentRelationship[]
  beginnerExplanation: {
    whatItDoes: string
    howItWorks: string[]
    keyFiles: Array<{
      file: string
      role: string
      explanation: string
    }>
    learningPath: string[]
  }
  visualizationSuggestions: {
    mainNodes: Array<{
      id: string
      label: string
      type: 'entry' | 'component' | 'service' | 'config' | 'data'
      position: { x: number; y: number }
      importance: number
    }>
    connections: Array<{
      from: string
      to: string
      type: 'data' | 'control' | 'dependency'
      label: string
    }>
  }
}

export interface FileExplanation {
  fileName: string
  purpose: string
  whatItDoes: string
  keyFeatures: string[]
  importance: 'critical' | 'important' | 'supporting' | 'optional'
  relatedFiles: string[]
  beginnerTips: string[]
  technicalDetails?: string
}

export class GeminiAnalyzer {
  private static config: GeminiConfig | null = null

  /**
   * Check if Gemini API key is available
   */
  static hasApiKey(): boolean {
    const key = localStorage.getItem('gemini_api_key')
    return !!(key && key.trim().length > 0)
  }

  /**
   * Get Gemini configuration from localStorage
   */
  static getConfig(): GeminiConfig | null {
    const apiKey = localStorage.getItem('gemini_api_key')
    if (!apiKey || !apiKey.trim()) {
      return null
    }
    return {
      apiKey: apiKey.trim(),
      model: 'gemini-1.5-flash-latest'
    }
  }

  static configure(config: GeminiConfig) {
    this.config = config
  }

  static isConfigured(): boolean {
    return this.config !== null && this.config.apiKey.length > 0
  }

  /**
   * Analyze repository with Gemini AI to understand structure and workflow
   */
  static async analyzeRepository(request: CodeAnalysisRequest): Promise<GeminiAnalysisResponse> {
    if (!this.config) {
      throw new Error('Gemini API not configured. Please add your API key in settings.')
    }

    const prompt = this.buildAnalysisPrompt(request)
    
    try {
      console.log('🤖 Analyzing repository with Gemini AI...')
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.config.model || 'gemini-1.5-flash'}:generateContent?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini API')
      }

      const analysisText = data.candidates[0].content.parts[0].text
      
      // Parse the JSON response from Gemini
      try {
        const analysisResult = JSON.parse(analysisText) as GeminiAnalysisResponse
        console.log('✅ Repository analysis completed successfully')
        return analysisResult
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError)
        console.log('Raw response:', analysisText)
        
        // Return a fallback analysis if parsing fails
        return this.createFallbackAnalysis(request)
      }
      
    } catch (error) {
      console.error('Gemini analysis failed:', error)
      // Return a fallback analysis
      return this.createFallbackAnalysis(request)
    }
  }

  /**
   * Build comprehensive analysis prompt for Gemini
   */
  private static buildAnalysisPrompt(request: CodeAnalysisRequest): string {
    return `You are an expert software architect analyzing a ${request.repositoryName} repository. 

REPOSITORY DETAILS:
- Name: ${request.repositoryName}
- Description: ${request.repositoryDescription || 'No description provided'}
- Tech Stack: ${request.techStack.join(', ')}
- Entry Points: ${request.entryPoints.join(', ')}

FILE STRUCTURE:
${request.fileStructure}

KEY FILES CONTENT:
${request.keyFiles.map(file => `
--- ${file.path} (${file.type}) ---
${file.content.slice(0, 2000)}${file.content.length > 2000 ? '...[truncated]' : ''}
`).join('\n')}

TASK: Analyze this repository and provide a comprehensive JSON response that will help beginners and professionals understand how this codebase works. Focus on:

1. WORKFLOW: Step-by-step execution flow
2. ARCHITECTURE: How components are organized and interact
3. RELATIONSHIPS: How files depend on each other
4. BEGINNER EXPLANATION: Simple explanations for newcomers
5. VISUALIZATION: Suggestions for visual representation

Please respond with ONLY a valid JSON object matching this exact structure:

{
  "overview": {
    "summary": "Brief description of what this repository does",
    "purpose": "Main purpose/goal of the application",
    "targetAudience": "Who would use this application",
    "complexity": "beginner|intermediate|advanced"
  },
  "workflow": {
    "steps": [
      {
        "id": "step1",
        "title": "Step title",
        "description": "What happens in this step",
        "files": ["file1.js", "file2.js"],
        "type": "initialization|processing|rendering|api_call|data_flow|user_interaction",
        "dependencies": ["previous_step_id"],
        "importance": "critical|important|optional"
      }
    ],
    "dataFlow": [
      {
        "from": "source_component",
        "to": "target_component", 
        "dataType": "user input|api response|state|props",
        "description": "What data is passed and why"
      }
    ]
  },
  "architecture": {
    "patterns": [
      {
        "name": "MVC|MVP|Component-based|Layered|etc",
        "description": "How this pattern is implemented",
        "components": ["relevant", "files"],
        "confidence": 0.8
      }
    ],
    "layers": [
      {
        "name": "Presentation|Business|Data|etc",
        "files": ["files", "in", "layer"],
        "responsibility": "What this layer does"
      }
    ]
  },
  "relationships": [
    {
      "from": "fileA.js",
      "to": "fileB.js",
      "relationship": "imports|extends|uses|calls|renders|configures|tests",
      "strength": 8,
      "description": "Why these files are connected"
    }
  ],
  "beginnerExplanation": {
    "whatItDoes": "Simple explanation of the app's purpose",
    "howItWorks": ["Step 1 explanation", "Step 2 explanation"],
    "keyFiles": [
      {
        "file": "important_file.js",
        "role": "What role this file plays",
        "explanation": "Why it's important for beginners to understand"
      }
    ],
    "learningPath": ["Start here", "Then understand this", "Finally explore this"]
  },
  "visualizationSuggestions": {
    "mainNodes": [
      {
        "id": "node1",
        "label": "Display name",
        "type": "entry|component|service|config|data",
        "position": {"x": 100, "y": 200},
        "importance": 9
      }
    ],
    "connections": [
      {
        "from": "node1",
        "to": "node2", 
        "type": "data|control|dependency",
        "label": "Connection description"
      }
    ]
  }
}

Respond with ONLY the JSON object, no additional text or explanation.`
  }

  /**
   * Create fallback analysis when Gemini fails
   */
  private static createFallbackAnalysis(request: CodeAnalysisRequest): GeminiAnalysisResponse {
    return {
      overview: {
        summary: `A ${request.techStack.join(', ')} application with ${request.keyFiles.length} key files`,
        purpose: 'Software application - analysis unavailable',
        targetAudience: 'Developers and users',
        complexity: 'intermediate'
      },
      workflow: {
        steps: [
          {
            id: 'init',
            title: 'Application Initialization',
            description: 'Application starts up and initializes core components',
            files: request.entryPoints,
            type: 'initialization',
            dependencies: [],
            importance: 'critical'
          }
        ],
        dataFlow: []
      },
      architecture: {
        patterns: [
          {
            name: 'File-based Architecture',
            description: 'Standard file organization pattern',
            components: request.keyFiles.map(f => f.path),
            confidence: 0.5
          }
        ],
        layers: [
          {
            name: 'Application Layer',
            files: request.keyFiles.map(f => f.path),
            responsibility: 'Core application functionality'
          }
        ]
      },
      relationships: [],
      beginnerExplanation: {
        whatItDoes: `This is a ${request.techStack.join(' and ')} application`,
        howItWorks: ['Application starts', 'Components interact', 'Functionality is provided'],
        keyFiles: request.keyFiles.slice(0, 3).map(f => ({
          file: f.path,
          role: `${f.type} file`,
          explanation: `Important ${f.type} component`
        })),
        learningPath: ['Understand the main files', 'Explore the structure', 'Study the implementation']
      },
      visualizationSuggestions: {
        mainNodes: request.keyFiles.slice(0, 5).map((f, i) => ({
          id: f.path,
          label: f.path.split('/').pop() || f.path,
          type: f.type === 'entry' ? 'entry' : 'component',
          position: { x: 200 + (i * 150), y: 200 + (i % 2) * 100 },
          importance: f.type === 'entry' ? 10 : 5
        })),
        connections: []
      }
    }
  }

  /**
   * Get AI-powered explanation for a specific file
   */
  static async explainFile(
    config: GeminiConfig,
    fileName: string,
    fileContent: string,
    repositoryContext?: {
      name: string
      techStack: string[]
      description?: string
    }
  ): Promise<FileExplanation> {
    try {
      const prompt = this.buildFileExplanationPrompt(fileName, fileContent, repositoryContext)
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-1.5-flash-latest'}:generateContent?key=${config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini API')
      }

      const explanationText: string = (data.candidates[0].content.parts as Array<{ text?: string }>)
        .map((p) => p.text ?? '')
        .join('\n')

      // Try robust JSON extraction first
      const extracted = this.tryExtractJson(explanationText)
      if (extracted) return extracted

      // If JSON parsing fails, create a heuristic, content-aware explanation
      console.warn('Gemini response was not valid JSON; using heuristic explanation')
      return this.createHeuristicExplanation(fileName, fileContent)
      
    } catch (error) {
      console.error('File explanation failed:', error)
      return this.createHeuristicExplanation(fileName, fileContent)
    }
  }

  /**
   * Attempt to extract and parse JSON from text that may include code fences or extra text
   */
  private static tryExtractJson(text: string): FileExplanation | null {
    try {
      let t = text.trim()
      // Strip code fences if present
      if (t.startsWith('```')) {
        t = t.replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
        const lastFence = t.lastIndexOf('```')
        if (lastFence !== -1) t = t.slice(0, lastFence)
      }
      // Extract JSON object between first { and last }
      const first = t.indexOf('{')
      const last = t.lastIndexOf('}')
      if (first !== -1 && last !== -1 && last > first) {
        const jsonSlice = t.slice(first, last + 1)
        const obj = JSON.parse(jsonSlice) as FileExplanation
        // Basic shape validation
        if (obj && obj.fileName && obj.purpose && obj.whatItDoes) return obj
      }
  } catch {
      // ignore
    }
    return null
  }

  /**
   * Build file explanation prompt for Gemini
   */
  private static buildFileExplanationPrompt(
    fileName: string,
    fileContent: string,
    repositoryContext?: {
      name: string
      techStack: string[]
      description?: string
    }
  ): string {
    const contextInfo = repositoryContext 
      ? `This file is part of "${repositoryContext.name}", a ${repositoryContext.techStack.join(' and ')} project${repositoryContext.description ? `: ${repositoryContext.description}` : ''}.`
      : ''

    return `You are an expert software developer explaining code to developers who want to understand this file quickly.

${contextInfo}

Analyze this file and provide a JSON response with the following structure:

{
  "fileName": "${fileName}",
  "purpose": "Brief one-sentence description of what this file does",
  "whatItDoes": "Clear 2-3 sentence explanation of the file's main functionality",
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3"],
  "importance": "critical|important|supporting|optional",
  "relatedFiles": ["file1.tsx", "file2.ts"],
  "beginnerTips": ["Tip 1 for understanding", "Tip 2 for learning"],
  "technicalDetails": "Optional: Advanced technical details for experienced developers"
}

FILE: ${fileName}
CONTENT:
${fileContent.slice(0, 3000)}${fileContent.length > 3000 ? '...[truncated]' : ''}

Focus on:
1. What this file actually does in simple terms
2. Why it's important to the project
3. How it fits into the overall architecture
4. Key concepts a developer should understand
5. Practical tips for working with this code

Respond only with valid JSON, no additional text.`
  }

  /**
   * Create fallback explanation when AI analysis fails
   */
  // Removed unused generic fallback in favor of heuristic explanation

  /**
   * Heuristic explanation using simple static analysis on the file content for more specific output
   */
  private static createHeuristicExplanation(fileName: string, fileContent: string): FileExplanation {
    const name = fileName.split('/').pop() || fileName
  // Basic React/TSX heuristics
    const isReact = /from\s+['"]react['"]/i.test(fileContent)
    const componentNameMatch = fileContent.match(/export\s+default\s+function\s+(\w+)/)
      || fileContent.match(/function\s+(\w+)\s*\(/)
      || fileContent.match(/const\s+(\w+)\s*=\s*\(/)
    const componentName = componentNameMatch?.[1] || name.replace(/\.[tj]sx?$/, '')

    const usesState = /useState\s*\(/.test(fileContent)
    const usesEffect = /useEffect\s*\(/.test(fileContent)
    const usesMemo = /useMemo\s*\(/.test(fileContent)
    const usesCallback = /useCallback\s*\(/.test(fileContent)
    const usesContext = /useContext\s*\(/.test(fileContent)
    const usesRouter = /from\s+['"]react-router-dom['"]/.test(fileContent)
    const hasFetch = /fetch\s*\(|axios\s*\./.test(fileContent)
    const hasForm = /<form\b|useForm\s*\(/i.test(fileContent)
    const rendersList = /\.map\s*\(/.test(fileContent)
    const hasProps = /\(\s*props\s*[:)]|{\s*\w+\s*}\s*:\s*\w+\s*\)/.test(fileContent) || /export\s+interface\s+\w+Props/.test(fileContent)

    const purposeParts: string[] = []
    if (isReact) purposeParts.push('React component')
    if (usesRouter) purposeParts.push('with routing')
    if (hasForm) purposeParts.push('with form handling')
    if (hasFetch) purposeParts.push('that interacts with APIs')
    if (rendersList) purposeParts.push('that renders dynamic lists')
    const purpose = purposeParts.length > 0
      ? `${componentName} is a ${purposeParts.join(' ')}.`
      : `${componentName} provides UI logic and rendering.`

    const what: string[] = []
    if (usesState) what.push('manages local state')
    if (usesEffect) what.push('performs side effects')
    if (usesMemo) what.push('memoizes derived values')
    if (usesCallback) what.push('memoizes event handlers')
    if (usesContext) what.push('consumes React context')
    if (hasProps) what.push('receives props to control behavior')
    if (hasFetch) what.push('fetches data from external services')
    if (rendersList) what.push('renders collections using map()')
    if (hasForm) what.push('handles user input via forms')

    const whatItDoes = what.length > 0
      ? `${componentName} ${what.join(', ')}.`
      : `${componentName} renders UI elements and encapsulates presentation logic.`

    const keyFeatures: string[] = []
    if (usesState) keyFeatures.push('Local state via useState')
    if (usesEffect) keyFeatures.push('Lifecycle logic via useEffect')
    if (usesMemo) keyFeatures.push('Performance optimizations via useMemo')
    if (usesCallback) keyFeatures.push('Stable callbacks via useCallback')
    if (usesContext) keyFeatures.push('Shared state via useContext')
    if (hasFetch) keyFeatures.push('Data fetching')
    if (hasForm) keyFeatures.push('Form handling and validation')
    if (rendersList) keyFeatures.push('List rendering from arrays')

    const importance: 'critical' | 'important' | 'supporting' | 'optional' = isReact ? 'important' : 'supporting'

    const beginnerTips = [
      'Trace the component props to see how data flows in',
      usesState ? 'Check initial state and how it updates with setState' : 'Identify whether the component is stateful or purely presentational',
      usesEffect ? 'Look at useEffect dependencies to understand side effects timing' : 'Consider whether side effects are required',
      rendersList ? 'Find where the list data comes from and the key props used' : 'Add PropTypes/TS interfaces to clarify props',
    ]

    return {
      fileName,
      purpose,
      whatItDoes,
      keyFeatures,
      importance,
      relatedFiles: [],
      beginnerTips,
      technicalDetails: `File type: ${fileName.split('.').pop()?.toUpperCase()} | Length: ${fileContent.length} chars`
    }
  }
}
