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

export class GeminiAnalyzer {
  private static config: GeminiConfig | null = null

  static configure(config: GeminiConfig) {
    this.config = config
  }

  static isConfigured(): boolean {
    return this.config !== null && this.config.apiKey.length > 0
  }

  static getConfig(): GeminiConfig | null {
    return this.config
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
}
