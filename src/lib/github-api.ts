const GITHUB_API_BASE = 'https://api.github.com'

export interface GitHubAPIResponse<T> {
  data: T
  error?: string
}

export interface GitHubFile {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string | null
  type: 'file' | 'dir'
  content?: string
  encoding?: string
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  clone_url: string
  language: string | null
  stargazers_count: number
  forks_count: number
  size: number
  default_branch: string
  topics: string[]
  created_at: string
  updated_at: string
  owner: {
    login: string
    avatar_url: string
    html_url: string
  }
}

export class GitHubAPI {
  private static token: string | null = null
  private static readonly TOKEN_STORAGE_KEY = 'github_api_token'

  static {
    // Load token from localStorage on initialization
    this.loadTokenFromStorage()
  }

  static setToken(token: string | null) {
    this.token = token
    if (token) {
      localStorage.setItem(this.TOKEN_STORAGE_KEY, token)
    } else {
      localStorage.removeItem(this.TOKEN_STORAGE_KEY)
    }
  }

  static getToken(): string | null {
    return this.token
  }

  private static loadTokenFromStorage() {
    try {
      const storedToken = localStorage.getItem(this.TOKEN_STORAGE_KEY)
      if (storedToken) {
        this.token = storedToken
      }
    } catch (error) {
      console.warn('Failed to load GitHub token from storage:', error)
    }
  }

  private static async request<T>(endpoint: string): Promise<GitHubAPIResponse<T>> {
    try {
      console.log(`GitHub API Request: ${GITHUB_API_BASE}${endpoint}`)
      
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'StatusCode-App/1.0.0'
      }

      // Add authorization header if token is available
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`
      }
      
      const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, { headers })

      if (!response.ok) {
        const errorText = await response.text()
        const errorMessage = `GitHub API Error: ${response.status} ${response.statusText} - ${errorText}`
        console.error(errorMessage)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log(`GitHub API Response for ${endpoint}:`, data)
      return { data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error(`GitHub API Request failed for ${endpoint}:`, errorMessage)
      return { 
        data: null as T, 
        error: errorMessage
      }
    }
  }

  static async getRateLimit(): Promise<GitHubAPIResponse<{
    rate: {
      limit: number
      remaining: number
      reset: number
      used: number
    }
  }>> {
    return this.request('/rate_limit')
  }

  static async getRepository(owner: string, repo: string): Promise<GitHubAPIResponse<GitHubRepo>> {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`)
  }

  static async getRepositoryContents(
    owner: string, 
    repo: string, 
    path: string = ''
  ): Promise<GitHubAPIResponse<GitHubFile[]>> {
    return this.request<GitHubFile[]>(`/repos/${owner}/${repo}/contents/${path}`)
  }

  static async getFileContent(
    owner: string, 
    repo: string, 
    path: string
  ): Promise<GitHubAPIResponse<GitHubFile>> {
    const response = await this.request<GitHubFile>(`/repos/${owner}/${repo}/contents/${path}`)
    
    if (response.data && response.data.content && response.data.encoding === 'base64') {
      // Decode base64 content
      try {
        response.data.content = atob(response.data.content)
      } catch (error) {
        console.warn('Failed to decode base64 content:', error)
      }
    }
    
    return response
  }

  static async searchRepositories(query: string, page: number = 1): Promise<GitHubAPIResponse<{
    total_count: number
    items: GitHubRepo[]
  }>> {
    return this.request(`/search/repositories?q=${encodeURIComponent(query)}&page=${page}&per_page=10`)
  }

  static async getRepositoryLanguages(
    owner: string, 
    repo: string
  ): Promise<GitHubAPIResponse<Record<string, number>>> {
    return this.request<Record<string, number>>(`/repos/${owner}/${repo}/languages`)
  }

  static async getRepositoryTopics(
    owner: string, 
    repo: string
  ): Promise<GitHubAPIResponse<{ names: string[] }>> {
    return this.request<{ names: string[] }>(`/repos/${owner}/${repo}/topics`)
  }
}

// Helper function to build file tree from GitHub API response
export function buildFileTree(files: GitHubFile[], basePath: string = ''): GitHubFile[] {
  const tree: GitHubFile[] = []
  const pathMap = new Map<string, GitHubFile>()

  // Sort files to ensure directories come first
  const sortedFiles = [...files].sort((a, b) => {
    if (a.type === 'dir' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'dir') return 1
    return a.name.localeCompare(b.name)
  })

  for (const file of sortedFiles) {
    const relativePath = file.path.replace(basePath, '').replace(/^\//, '')
    const pathParts = relativePath.split('/').filter(Boolean)
    
    if (pathParts.length === 1) {
      // Direct child
      tree.push(file)
      pathMap.set(file.path, file)
    }
  }

  return tree
}

// Rate limiting helper
export class RateLimiter {
  private static requests: number[] = []
  private static readonly LIMIT = 60 // GitHub API limit per hour for unauthenticated requests
  private static readonly WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

  static canMakeRequest(): boolean {
    const now = Date.now()
    
    // Remove requests older than 1 hour
    this.requests = this.requests.filter(time => now - time < this.WINDOW)
    
    return this.requests.length < this.LIMIT
  }

  static recordRequest(): void {
    this.requests.push(Date.now())
  }

  static getRemainingRequests(): number {
    const now = Date.now()
    this.requests = this.requests.filter(time => now - time < this.WINDOW)
    return Math.max(0, this.LIMIT - this.requests.length)
  }

  static getResetTime(): Date {
    if (this.requests.length === 0) return new Date()
    
    const oldestRequest = Math.min(...this.requests)
    return new Date(oldestRequest + this.WINDOW)
  }
}
