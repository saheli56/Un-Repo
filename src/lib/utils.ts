import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { GitHubAPI, GitHubRepo as GitHubAPIRepo } from './github-api'
import { GitHubRepo, FileNode, RepoAnalysis } from '@/types'
import { RepositoryCache, DirectoryCache } from './cache-manager'
import { astAnalyzer } from './ast-analyzer'
import { UniversalAnalyzer } from './universal-analyzer'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2)
}

export function getLanguageFromExtension(extension: string): string {
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'bash',
    sql: 'sql',
    dockerfile: 'dockerfile',
  }
  
  return languageMap[extension.toLowerCase()] || 'text'
}

export function debounce<T extends (...args: never[]) => void>(
  func: T,
  wait: number
): T {
  let timeout: ReturnType<typeof setTimeout>
  return ((...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

export function throttle<T extends (...args: unknown[]) => unknown>(
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

// Repository Analysis Functions

export async function analyzeRepository(repo: GitHubRepo, forceRefresh = false): Promise<RepoAnalysis> {
  try {
    // Clear cache if force refresh is requested
    if (forceRefresh) {
      console.log(`🔄 Force refresh requested for ${repo.owner}/${repo.name}`)
      RepositoryCache.clearRepositoryCache(repo.owner, repo.name)
    }

    // Check cache first
    const cachedAnalysis = RepositoryCache.getAnalysis(repo.owner, repo.name)
    if (cachedAnalysis && !forceRefresh) {
      console.log(`📦 Using cached analysis for ${repo.owner}/${repo.name}`)
      return cachedAnalysis
    }

    console.log(`🔍 Performing fresh analysis for ${repo.owner}/${repo.name}`)

    // Get repository details from GitHub API
    const repoResponse = await GitHubAPI.getRepository(repo.owner, repo.name)
    if (repoResponse.error || !repoResponse.data) {
      throw new Error(repoResponse.error || 'Failed to fetch repository data')
    }

    // Get repository structure (this will use directory caching)
    const structure = await buildRepositoryStructure(repo.owner, repo.name)
    
    // Get languages
    const languagesResponse = await GitHubAPI.getRepositoryLanguages(repo.owner, repo.name)
    const languages = languagesResponse.data ? Object.keys(languagesResponse.data) : []
    
    // Analyze the repository
    const analysis = await performRepositoryAnalysis(structure, languages, repoResponse.data)
    
    // Cache the analysis
    RepositoryCache.cacheAnalysis(repo.owner, repo.name, analysis)
    
    return analysis
  } catch (error) {
    console.error('Repository analysis failed:', error)
    // Return fallback analysis
    return createFallbackAnalysis(repo)
  }
}

async function buildRepositoryStructure(owner: string, repo: string, path = ''): Promise<FileNode> {
  // Check cache for repository structure (only cache root level initially)
  if (path === '') {
    const cachedStructure = RepositoryCache.getStructure(owner, repo)
    if (cachedStructure) {
      console.log(`📦 Using cached structure for ${owner}/${repo}`)
      return await expandImportantDirectories(cachedStructure, owner, repo)
    }
  }

  const contentsResponse = await GitHubAPI.getRepositoryContents(owner, repo, path)
  
  if (contentsResponse.error || !contentsResponse.data) {
    throw new Error(`Failed to fetch repository contents: ${contentsResponse.error}`)
  }

  const children: FileNode[] = []
  
  for (const item of contentsResponse.data) {
    const fileNode: FileNode = {
      id: `${path}/${item.name}`.replace(/^\//, ''),
      name: item.name,
      path: item.path,
      type: item.type === 'dir' ? 'directory' : 'file',
      size: item.size,
      depth: path.split('/').filter(Boolean).length,
      extension: item.type === 'file' ? getFileExtension(item.name) : undefined,
      // For directories, initially set children to undefined to indicate they haven't been loaded
      children: item.type === 'dir' ? undefined : undefined
    }

    children.push(fileNode)
  }

  // Sort: directories first, then files
  children.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'directory') return 1
    return a.name.localeCompare(b.name)
  })

  const structure = {
    id: 'root',
    name: repo,
    path: '/',
    type: 'directory' as const,
    depth: 0,
    children
  }

  // For root level, automatically expand important directories
  if (path === '') {
    const expandedStructure = await expandImportantDirectories(structure, owner, repo)
    RepositoryCache.cacheStructure(owner, repo, expandedStructure)
    return expandedStructure
  }

  return structure
}

// Function to automatically expand important directories for better analysis
async function expandImportantDirectories(structure: FileNode, owner: string, repo: string): Promise<FileNode> {
  const importantDirs = ['src', 'lib', 'components', 'pages', 'app', 'client', 'server', 'api', 'utils', 'hooks', 'services']
  
  if (!structure.children) return structure

  const expandedChildren: FileNode[] = []

  for (const child of structure.children) {
    if (child.type === 'directory' && importantDirs.includes(child.name.toLowerCase())) {
      console.log(`📂 Expanding important directory: ${child.name}`)
      
      try {
        const dirContents = await loadDirectoryContents(owner, repo, child.path)
        const expandedChild = {
          ...child,
          children: await expandDirectoryRecursively(dirContents, owner, repo, 2) // Expand 2 levels deep
        }
        expandedChildren.push(expandedChild)
      } catch (error) {
        console.warn(`Failed to expand directory ${child.name}:`, error)
        expandedChildren.push(child)
      }
    } else {
      expandedChildren.push(child)
    }
  }

  return {
    ...structure,
    children: expandedChildren
  }
}

// Recursively expand directories up to a certain depth
async function expandDirectoryRecursively(
  children: FileNode[], 
  owner: string, 
  repo: string, 
  maxDepth: number
): Promise<FileNode[]> {
  if (maxDepth <= 0) return children

  const expandedChildren: FileNode[] = []

  for (const child of children) {
    if (child.type === 'directory') {
      try {
        const dirContents = await loadDirectoryContents(owner, repo, child.path)
        const expandedChild = {
          ...child,
          children: await expandDirectoryRecursively(dirContents, owner, repo, maxDepth - 1)
        }
        expandedChildren.push(expandedChild)
      } catch (error) {
        console.warn(`Failed to expand directory ${child.name}:`, error)
        expandedChildren.push(child)
      }
    } else {
      expandedChildren.push(child)
    }
  }

  return expandedChildren
}

// Function to load directory contents on-demand (for lazy loading)
export async function loadDirectoryContents(owner: string, repo: string, path: string): Promise<FileNode[]> {
  console.log(`Loading directory contents for: ${owner}/${repo}/${path}`)
  
  // Check cache first
  const cachedContents = DirectoryCache.getDirectory(owner, repo, path)
  if (cachedContents) {
    console.log(`📦 Using cached directory contents for ${path}`)
    return cachedContents
  }
  
  const contentsResponse = await GitHubAPI.getRepositoryContents(owner, repo, path)
  
  if (contentsResponse.error || !contentsResponse.data) {
    console.error(`Failed to fetch directory contents for ${path}:`, contentsResponse.error)
    console.error('Full response:', contentsResponse)
    return []
  }

  // Check if data is an array (directory contents) or single file
  if (!Array.isArray(contentsResponse.data)) {
    console.warn(`Expected array for directory ${path}, got single file instead`)
    return []
  }

  console.log(`Successfully loaded ${contentsResponse.data.length} items for ${path}`)
  
  const children: FileNode[] = []
  const depth = path.split('/').filter(Boolean).length
  
  for (const item of contentsResponse.data) {
    const fileNode: FileNode = {
      id: `${path}/${item.name}`.replace(/^\//, ''),
      name: item.name,
      path: item.path,
      type: item.type === 'dir' ? 'directory' : 'file',
      size: item.size,
      depth: depth,
      extension: item.type === 'file' ? getFileExtension(item.name) : undefined,
      children: item.type === 'dir' ? undefined : undefined
    }

    children.push(fileNode)
  }

  // Sort: directories first, then files
  children.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'directory') return 1
    return a.name.localeCompare(b.name)
  })

  // Cache the directory contents
  DirectoryCache.cacheDirectory(owner, repo, path, children)

  return children
}

async function performRepositoryAnalysis(
  structure: FileNode, 
  languages: string[], 
  repoData: GitHubAPIRepo
): Promise<RepoAnalysis> {
  const entryPoints = findEntryPoints(structure)
  const keyDirectories = identifyKeyDirectories(structure)
  const techStack = analyzeTechStack(structure, languages)
  const architecture = determineArchitecture(structure, techStack)
  
  // Generate workflow using Universal Analyzer for multi-language support
  let workflow
  try {
    const allFiles = getAllFiles(structure)
    
    // Create repo object for Universal Analyzer
    const repoForAnalysis: GitHubRepo = {
      owner: repoData.owner?.login || '',
      name: repoData.name || '',
      url: repoData.html_url || '',
      description: repoData.description || undefined,
      language: repoData.language || undefined,
      stars: repoData.stargazers_count || 0,
      forks: repoData.forks_count || 0,
    }
    
    // Use Universal Analyzer to get multi-language support
    const universalResult = await UniversalAnalyzer.analyzeRepository(repoForAnalysis, allFiles)
    
    if (universalResult.features.astAnalysis) {
      // For JS/TS projects, use detailed AST analysis
      console.log(`🔍 Using AST analysis for ${universalResult.language}`)
      workflow = await astAnalyzer.analyzeRepository(repoForAnalysis, allFiles)
    } else {
      // For other languages, use structure-based analysis from Universal Analyzer
      console.log(`🏗️ Using structure analysis for ${universalResult.language}`)
      workflow = universalResult.workflow
    }
    
    console.log(`✅ Workflow generated successfully for ${universalResult.language} project with ${universalResult.frameworks.join(', ')} frameworks`)
  } catch (error) {
    console.warn('Failed to generate workflow analysis:', error)
    workflow = undefined
  }
  
  return {
    structure,
    overview: generateOverview(repoData, techStack, entryPoints),
    techStack,
    entryPoints,
    architecture,
    keyDirectories,
    workflow
  }
}

// Helper function to get all files from structure
function getAllFiles(node: FileNode): FileNode[] {
  const files: FileNode[] = []
  
  if (node.type === 'file') {
    files.push(node)
  }
  
  if (node.children) {
    node.children.forEach(child => {
      files.push(...getAllFiles(child))
    })
  }
  
  return files
}

function findEntryPoints(structure: FileNode): string[] {
  const entryPoints: string[] = []
  const entryPointNames = [
    'index.js', 'index.ts', 'index.jsx', 'index.tsx',
    'main.js', 'main.ts', 'main.py', 'main.java',
    'app.js', 'app.ts', 'app.py',
    'server.js', 'server.ts',
    'package.json', 'pyproject.toml', 'pom.xml',
    'Dockerfile', 'docker-compose.yml'
  ]

  function searchForEntryPoints(node: FileNode) {
    if (node.type === 'file' && entryPointNames.includes(node.name.toLowerCase())) {
      entryPoints.push(node.path)
    }
    
    if (node.children) {
      for (const child of node.children) {
        searchForEntryPoints(child)
      }
    }
  }

  searchForEntryPoints(structure)
  return entryPoints
}

function identifyKeyDirectories(structure: FileNode): Array<{
  path: string
  purpose: string
  importance: 'high' | 'medium' | 'low'
}> {
  const keyDirs: Array<{ path: string; purpose: string; importance: 'high' | 'medium' | 'low' }> = []
  
  const directoryPurposes: Record<string, { purpose: string; importance: 'high' | 'medium' | 'low' }> = {
    'src': { purpose: 'Main source code directory', importance: 'high' },
    'lib': { purpose: 'Library and utility functions', importance: 'high' },
    'components': { purpose: 'React/UI components', importance: 'high' },
    'pages': { purpose: 'Application pages/routes', importance: 'high' },
    'api': { purpose: 'API routes and handlers', importance: 'high' },
    'utils': { purpose: 'Utility functions and helpers', importance: 'medium' },
    'hooks': { purpose: 'Custom React hooks', importance: 'medium' },
    'services': { purpose: 'External service integrations', importance: 'medium' },
    'types': { purpose: 'TypeScript type definitions', importance: 'medium' },
    'styles': { purpose: 'Stylesheets and styling', importance: 'medium' },
    'assets': { purpose: 'Static assets (images, fonts, etc.)', importance: 'low' },
    'public': { purpose: 'Publicly served static files', importance: 'low' },
    'docs': { purpose: 'Documentation files', importance: 'low' },
    'tests': { purpose: 'Test files and testing utilities', importance: 'medium' },
    '__tests__': { purpose: 'Test files', importance: 'medium' }
  }

  function searchDirectories(node: FileNode) {
    if (node.type === 'directory') {
      const dirName = node.name.toLowerCase()
      if (directoryPurposes[dirName]) {
        keyDirs.push({
          path: node.path,
          ...directoryPurposes[dirName]
        })
      }
    }
    
    if (node.children) {
      for (const child of node.children) {
        searchDirectories(child)
      }
    }
  }

  searchDirectories(structure)
  return keyDirs
}

function analyzeTechStack(structure: FileNode, languages: string[]): string[] {
  const techStack = new Set<string>(languages)
  
  function analyzeFiles(node: FileNode) {
    if (node.type === 'file') {
      const fileName = node.name.toLowerCase()
      const extension = node.extension?.toLowerCase()
      
      // Framework detection
      if (fileName === 'package.json') techStack.add('Node.js')
      if (fileName === 'requirements.txt' || fileName === 'pyproject.toml') techStack.add('Python')
      if (fileName === 'pom.xml' || fileName === 'build.gradle') techStack.add('Java')
      if (fileName === 'cargo.toml') techStack.add('Rust')
      if (fileName === 'go.mod') techStack.add('Go')
      if (fileName === 'dockerfile') techStack.add('Docker')
      if (fileName === 'docker-compose.yml') techStack.add('Docker Compose')
      
      // Frontend frameworks
      if (extension === 'jsx' || extension === 'tsx') techStack.add('React')
      if (fileName.includes('vue')) techStack.add('Vue.js')
      if (fileName.includes('angular')) techStack.add('Angular')
      if (fileName === 'svelte.config.js') techStack.add('Svelte')
      
      // Build tools
      if (fileName === 'webpack.config.js') techStack.add('Webpack')
      if (fileName === 'vite.config.js' || fileName === 'vite.config.ts') techStack.add('Vite')
      if (fileName === 'rollup.config.js') techStack.add('Rollup')
      if (fileName === 'tailwind.config.js') techStack.add('Tailwind CSS')
    }
    
    if (node.children) {
      for (const child of node.children) {
        analyzeFiles(child)
      }
    }
  }

  analyzeFiles(structure)
  return Array.from(techStack)
}

function determineArchitecture(structure: FileNode, techStack: string[]): string {
  if (techStack.includes('React') || techStack.includes('Vue.js') || techStack.includes('Angular')) {
    return 'Frontend Single Page Application (SPA)'
  }
  
  if (techStack.includes('Node.js') && hasApiDirectory(structure)) {
    return 'Full-stack Web Application'
  }
  
  if (techStack.includes('Python') && (techStack.includes('FastAPI') || techStack.includes('Flask') || techStack.includes('Django'))) {
    return 'Python Web API'
  }
  
  if (techStack.includes('Java') && (techStack.includes('Spring') || hasFile(structure, 'Application.java'))) {
    return 'Java Enterprise Application'
  }
  
  if (techStack.includes('Docker')) {
    return 'Containerized Application'
  }
  
  return 'Multi-purpose Application'
}

function hasApiDirectory(structure: FileNode): boolean {
  function searchForApi(node: FileNode): boolean {
    if (node.type === 'directory' && node.name.toLowerCase().includes('api')) {
      return true
    }
    
    if (node.children) {
      return node.children.some(child => searchForApi(child))
    }
    
    return false
  }
  
  return searchForApi(structure)
}

function hasFile(structure: FileNode, fileName: string): boolean {
  function searchForFile(node: FileNode): boolean {
    if (node.type === 'file' && node.name === fileName) {
      return true
    }
    
    if (node.children) {
      return node.children.some(child => searchForFile(child))
    }
    
    return false
  }
  
  return searchForFile(structure)
}

function generateOverview(
  repoData: GitHubAPIRepo, 
  techStack: string[], 
  entryPoints: string[]
): string {
  const name = repoData.name || 'Repository'
  const description = repoData.description || 'No description available'
  const stars = repoData.stargazers_count || 0
  const language = repoData.language || 'Multiple languages'
  
  return `${name} is a ${language} project with ${stars} stars. ${description}. Built with ${techStack.slice(0, 3).join(', ')}${techStack.length > 3 ? ` and ${techStack.length - 3} other technologies` : ''}. Entry points: ${entryPoints.slice(0, 2).join(', ')}${entryPoints.length > 2 ? ` and ${entryPoints.length - 2} others` : ''}.`
}

function createFallbackAnalysis(repo: GitHubRepo): RepoAnalysis {
  return {
    structure: {
      id: 'root',
      name: repo.name,
      path: '/',
      type: 'directory',
      depth: 0,
      children: []
    },
    overview: `Analysis for ${repo.name} repository. Unable to fetch detailed information at this time.`,
    techStack: ['Unknown'],
    entryPoints: [],
    architecture: 'Unknown Architecture',
    keyDirectories: [],
    workflow: undefined
  }
}
