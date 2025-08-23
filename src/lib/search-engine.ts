import { FileNode, GitHubRepo, SearchResult } from '@/types'
import { getLanguageFromExtension } from '@/lib/utils'

export interface SearchFilters {
  fileTypes: string[]
  languages: string[]
  sizeRange: [number, number] // in bytes
  dateRange: [Date | null, Date | null]
  includeContent: boolean
}

export interface SearchOptions {
  query: string
  filters: Partial<SearchFilters>
  caseSensitive: boolean
  useRegex: boolean
  maxResults: number
}

export class RepoSearchEngine {
  private files: FileNode[] = []
  private fileContents: Map<string, string> = new Map()

  constructor(files: FileNode[] = []) {
    this.files = this.flattenFileTree(files)
  }

  updateFiles(files: FileNode[]): void {
    this.files = this.flattenFileTree(files)
  }

  updateFileContent(filePath: string, content: string): void {
    this.fileContents.set(filePath, content)
  }

  private flattenFileTree(files: FileNode[]): FileNode[] {
    const result: FileNode[] = []
    
    const traverse = (nodes: FileNode[]) => {
      for (const node of nodes) {
        result.push(node)
        if (node.children) {
          traverse(node.children)
        }
      }
    }
    
    traverse(files)
    return result.filter(file => file.type === 'file')
  }

  search(options: SearchOptions): SearchResult[] {
    const {
      query,
      filters = {},
      caseSensitive = false,
      useRegex = false,
      maxResults = 50
    } = options

    if (!query.trim()) return []

    let filteredFiles = this.files

    // Apply filters
    if (filters.fileTypes && filters.fileTypes.length > 0) {
      filteredFiles = filteredFiles.filter(file => 
        file.extension && filters.fileTypes!.includes(file.extension)
      )
    }

    if (filters.languages && filters.languages.length > 0) {
      filteredFiles = filteredFiles.filter(file => {
        const language = getLanguageFromExtension(file.extension || '')
        return filters.languages!.includes(language)
      })
    }

    if (filters.sizeRange) {
      const [minSize, maxSize] = filters.sizeRange
      filteredFiles = filteredFiles.filter(file => 
        file.size && file.size >= minSize && file.size <= maxSize
      )
    }

    // Search in file names and paths
    const results: SearchResult[] = []
    const searchPattern = useRegex 
      ? new RegExp(query, caseSensitive ? 'g' : 'gi')
      : null

    for (const file of filteredFiles) {
      const nameMatches = this.findMatches(file.name, query, searchPattern, caseSensitive)
      const pathMatches = this.findMatches(file.path, query, searchPattern, caseSensitive)
      
      let contentMatches: Array<{ line: number; content: string; context: string }> = []
      
      // Search in file content if enabled and available
      if (filters.includeContent && this.fileContents.has(file.path)) {
        const content = this.fileContents.get(file.path)!
        contentMatches = this.searchFileContent(content, query, searchPattern, caseSensitive)
      }

      const allMatches = [
        ...nameMatches.map(match => ({ ...match, type: 'name' as const })),
        ...pathMatches.map(match => ({ ...match, type: 'path' as const })),
        ...contentMatches.map(match => ({ ...match, type: 'content' as const }))
      ]

      if (allMatches.length > 0) {
        results.push({
          file,
          matches: allMatches,
          relevanceScore: this.calculateRelevanceScore(file, allMatches, query)
        })
      }

      if (results.length >= maxResults) break
    }

    // Sort by relevance score
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  private findMatches(
    text: string, 
    query: string, 
    pattern: RegExp | null, 
    caseSensitive: boolean
  ): Array<{ line: number; content: string; context: string }> {
    if (pattern) {
      const matches = Array.from(text.matchAll(pattern))
      return matches.map(match => ({
        line: 1, // For file names/paths, line is always 1
        content: match[0],
        context: text
      }))
    } else {
      const searchText = caseSensitive ? text : text.toLowerCase()
      const searchQuery = caseSensitive ? query : query.toLowerCase()
      
      if (searchText.includes(searchQuery)) {
        return [{
          line: 1,
          content: query,
          context: text
        }]
      }
    }
    
    return []
  }

  private searchFileContent(
    content: string, 
    query: string, 
    pattern: RegExp | null, 
    caseSensitive: boolean
  ): Array<{ line: number; content: string; context: string }> {
    const lines = content.split('\n')
    const matches: Array<{ line: number; content: string; context: string }> = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineMatches = this.findMatches(line, query, pattern, caseSensitive)
      
      if (lineMatches.length > 0) {
        const contextStart = Math.max(0, i - 2)
        const contextEnd = Math.min(lines.length - 1, i + 2)
        const context = lines.slice(contextStart, contextEnd + 1).join('\n')
        
        matches.push({
          line: i + 1,
          content: line.trim(),
          context
        })
      }
    }

    return matches
  }

  private calculateRelevanceScore(
    file: FileNode, 
    matches: Array<{ line: number; content: string; context: string; type: string }>, 
    query: string
  ): number {
    let score = 0

    // Base score for having matches
    score += matches.length

    // Bonus for exact matches in file name
    if (file.name.toLowerCase().includes(query.toLowerCase())) {
      score += 10
    }

    // Bonus for matches in common file types
    const commonExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c']
    if (file.extension && commonExtensions.includes(file.extension)) {
      score += 5
    }

    // Bonus for matches in entry point files
    const entryPointNames = ['index', 'main', 'app', 'server']
    if (entryPointNames.some(name => file.name.toLowerCase().includes(name))) {
      score += 8
    }

    // Penalty for very large files (might be less relevant)
    if (file.size && file.size > 100000) { // 100KB
      score -= 2
    }

    return score
  }

  getFileTypeStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    
    for (const file of this.files) {
      const extension = file.extension || 'no-extension'
      stats[extension] = (stats[extension] || 0) + 1
    }
    
    return stats
  }

  getLanguageStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    
    for (const file of this.files) {
      const language = getLanguageFromExtension(file.extension || '')
      stats[language] = (stats[language] || 0) + 1
    }
    
    return stats
  }

  getSizeStats(): { min: number; max: number; avg: number; total: number } {
    const sizes = this.files
      .map(file => file.size || 0)
      .filter(size => size > 0)
    
    if (sizes.length === 0) {
      return { min: 0, max: 0, avg: 0, total: 0 }
    }
    
    return {
      min: Math.min(...sizes),
      max: Math.max(...sizes),
      avg: sizes.reduce((sum, size) => sum + size, 0) / sizes.length,
      total: sizes.reduce((sum, size) => sum + size, 0)
    }
  }
}

// Advanced search utilities
export const searchUtils = {
  // Extract common search patterns
  extractPatterns: (query: string) => {
    const patterns = {
      fileExtension: query.match(/\.([\w]+)$/),
      className: query.match(/class\s+(\w+)/i),
      functionName: query.match(/function\s+(\w+)/i),
      variableName: query.match(/(?:var|let|const)\s+(\w+)/i),
      imports: query.match(/import.*from\s+['"]([^'"]+)['"]/i)
    }
    
    return Object.entries(patterns)
      .filter(([, match]) => match)
      .reduce((acc, [key, match]) => ({ ...acc, [key]: match![1] }), {})
  },

  // Generate search suggestions
  generateSuggestions: (query: string, files: FileNode[]): string[] => {
    const suggestions: string[] = []
    const lowerQuery = query.toLowerCase()
    
    // File name suggestions
    files.forEach(file => {
      if (file.name.toLowerCase().includes(lowerQuery)) {
        suggestions.push(file.name)
      }
    })
    
    // Extension suggestions
    const extensions = new Set(files.map(f => f.extension).filter(Boolean))
    extensions.forEach(ext => {
      if (ext!.toLowerCase().includes(lowerQuery)) {
        suggestions.push(`.${ext}`)
      }
    })
    
    // Common programming terms
    const terms = [
      'function', 'class', 'interface', 'component', 'service', 'utils', 'helper',
      'config', 'test', 'spec', 'index', 'main', 'app', 'api', 'types'
    ]
    
    terms.forEach(term => {
      if (term.includes(lowerQuery)) {
        suggestions.push(term)
      }
    })
    
    return [...new Set(suggestions)].slice(0, 10)
  }
}
