export interface GitHubRepo {
  owner: string
  name: string
  url: string
  description?: string
  language?: string
  stars?: number
  forks?: number
}

export interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  extension?: string
  size?: number
  children?: FileNode[]
  parent?: string
  depth: number
  isExpanded?: boolean
  content?: string
  language?: string
}

export interface CodeSummary {
  overview: string
  keyFunctions: string[]
  dependencies: string[]
  exports: string[]
  complexity: 'low' | 'medium' | 'high'
  purpose: string
  architecture?: string
}

export interface AIExplanation {
  summary: string
  details: string
  codeFlow?: string[]
  suggestions?: string[]
  relatedFiles?: string[]
  timestamp: number
}

export interface RepoAnalysis {
  structure: FileNode
  overview: string
  techStack: string[]
  entryPoints: string[]
  architecture: string
  keyDirectories: Array<{
    path: string
    purpose: string
    importance: 'high' | 'medium' | 'low'
  }>
  workflow?: RepositoryWorkflow
}

export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    file?: FileNode
    summary?: string
    isEntryPoint?: boolean
    dependencies?: string[]
    exports?: string[]
  }
  style?: React.CSSProperties
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  type?: string
  label?: string
  style?: React.CSSProperties
}

export interface WalkthroughStep {
  id: string
  title: string
  description: string
  files: string[]
  focusNodes: string[]
  explanation: string
  codeSnippets?: Array<{
    file: string
    lines: [number, number]
    code: string
    explanation: string
  }>
}

export interface SearchResult {
  file: FileNode
  matches: Array<{
    line: number
    content: string
    context: string
  }>
  relevanceScore: number
}

export interface ParsedFunction {
  name: string
  parameters: string[]
  returnType?: string
  startLine: number
  endLine: number
  documentation?: string
  complexity: number
}

export interface ParsedClass {
  name: string
  methods: ParsedFunction[]
  properties: string[]
  extends?: string
  implements?: string[]
  startLine: number
  endLine: number
  documentation?: string
}

export interface ParsedFile {
  functions: ParsedFunction[]
  classes: ParsedClass[]
  imports: Array<{
    source: string
    specifiers: string[]
    isDefault: boolean
  }>
  exports: Array<{
    name: string
    type: 'function' | 'class' | 'variable' | 'default'
  }>
  variables: Array<{
    name: string
    type?: string
    isConst: boolean
  }>
}

export interface WorkflowNode {
  id: string
  name: string
  file: FileNode
  type: 'entry' | 'component' | 'service' | 'utility' | 'config' | 'test' | 'type'
  role: string
  dependencies: string[]
  dependents: string[]
  complexity: number
  importance: 'high' | 'medium' | 'low'
  position: { x: number; y: number }
  githubUrl: string
  astInfo?: {
    functions: ParsedFunction[]
    classes: ParsedClass[]
    imports: string[]
    exports: string[]
    callGraph: Array<{
      caller: string
      callee: string
      line: number
    }>
  }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  type: 'import' | 'call' | 'inheritance' | 'composition' | 'data-flow' | 'configuration'
  weight: number
  label?: string
  metadata?: {
    line?: number
    description?: string
    frequency?: number
  }
}

export interface RepositoryWorkflow {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  entryPoints: string[]
  criticalPaths: Array<{
    path: string[]
    description: string
    importance: number
  }>
  clusters: Array<{
    id: string
    name: string
    nodeIds: string[]
    purpose: string
  }>
  metrics: {
    totalFiles: number
    totalFunctions: number
    totalClasses: number
    avgComplexity: number
    dependencyDepth: number
    couplingMetric: number
  }
}

export interface ThemeConfig {
  dark: boolean
  accentColor: string
  fontSize: 'sm' | 'md' | 'lg'
  showMinimap: boolean
  showLineNumbers: boolean
}
