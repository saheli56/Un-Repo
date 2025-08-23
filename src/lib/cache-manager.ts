/**
 * Comprehensive caching system for StatusCode
 * Manages repository data, file contents, and directory listings
 */

import { GitHubRepo, FileNode, RepoAnalysis } from '@/types'

export interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
  version: string
}

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum cache size in MB
  version?: string // Cache version for invalidation
}

export class CacheManager {
  private static readonly CACHE_PREFIX = 'statuscode_cache_'
  private static readonly DEFAULT_TTL = 30 * 60 * 1000 // 30 minutes
  private static readonly MAX_CACHE_SIZE = 50 * 1024 * 1024 // 50MB
  private static readonly CACHE_VERSION = '1.0.0'

  /**
   * Store data in cache with expiration and versioning
   */
  static set<T>(key: string, data: T, options: CacheOptions = {}): boolean {
    try {
      const ttl = options.ttl || this.DEFAULT_TTL
      const version = options.version || this.CACHE_VERSION
      const now = Date.now()

      const entry: CacheEntry<T> = {
        data,
        timestamp: now,
        expiresAt: now + ttl,
        version
      }

      const serialized = JSON.stringify(entry)
      const storageKey = this.CACHE_PREFIX + key

      // Check cache size before storing
      if (this.getCacheSize() + serialized.length > this.MAX_CACHE_SIZE) {
        this.cleanup()
      }

      localStorage.setItem(storageKey, serialized)
      console.log(`📦 Cached: ${key} (${(serialized.length / 1024).toFixed(1)}KB)`)
      return true
    } catch (error) {
      console.warn('Failed to cache data:', error)
      return false
    }
  }

  /**
   * Retrieve data from cache if valid and not expired
   */
  static get<T>(key: string): T | null {
    try {
      const storageKey = this.CACHE_PREFIX + key
      const cached = localStorage.getItem(storageKey)
      
      if (!cached) {
        return null
      }

      const entry: CacheEntry<T> = JSON.parse(cached)
      const now = Date.now()

      // Check if expired
      if (now > entry.expiresAt) {
        console.log(`⏰ Cache expired: ${key}`)
        this.remove(key)
        return null
      }

      // Check version compatibility
      if (entry.version !== this.CACHE_VERSION) {
        console.log(`🔄 Cache version mismatch: ${key}`)
        this.remove(key)
        return null
      }

      console.log(`✅ Cache hit: ${key} (age: ${((now - entry.timestamp) / 1000 / 60).toFixed(1)}min)`)
      return entry.data
    } catch (error) {
      console.warn('Failed to retrieve cached data:', error)
      this.remove(key) // Remove corrupted entry
      return null
    }
  }

  /**
   * Check if data exists in cache and is valid
   */
  static has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Remove specific cache entry
   */
  static remove(key: string): void {
    const storageKey = this.CACHE_PREFIX + key
    localStorage.removeItem(storageKey)
  }

  /**
   * Get current cache size in bytes
   */
  static getCacheSize(): number {
    let size = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        const value = localStorage.getItem(key)
        if (value) {
          size += key.length + value.length
        }
      }
    }
    return size
  }

  /**
   * Clean up expired and old cache entries
   */
  static cleanup(): void {
    const now = Date.now()
    const keysToRemove: string[] = []
    const entries: Array<{ key: string; timestamp: number; size: number }> = []

    console.log('🧹 Starting cache cleanup...')

    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i)
      if (storageKey && storageKey.startsWith(this.CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(storageKey)
          if (cached) {
            const entry: CacheEntry<unknown> = JSON.parse(cached)
            
            // Remove expired entries
            if (now > entry.expiresAt || entry.version !== this.CACHE_VERSION) {
              keysToRemove.push(storageKey)
            } else {
              entries.push({
                key: storageKey,
                timestamp: entry.timestamp,
                size: cached.length
              })
            }
          }
        } catch {
          // Remove corrupted entries
          keysToRemove.push(storageKey)
        }
      }
    }

    // Remove expired/corrupted entries
    keysToRemove.forEach(key => localStorage.removeItem(key))

    // If still over size limit, remove oldest entries
    if (this.getCacheSize() > this.MAX_CACHE_SIZE) {
      entries.sort((a, b) => a.timestamp - b.timestamp) // Oldest first
      
      let currentSize = this.getCacheSize()
      for (const entry of entries) {
        if (currentSize <= this.MAX_CACHE_SIZE * 0.8) break // Keep 80% of max
        
        localStorage.removeItem(entry.key)
        currentSize -= entry.size
        keysToRemove.push(entry.key)
      }
    }

    console.log(`🧹 Cleanup complete: removed ${keysToRemove.length} entries`)
    console.log(`📊 Cache size: ${(this.getCacheSize() / 1024 / 1024).toFixed(1)}MB`)
  }

  /**
   * Clear all cache data
   */
  static clear(): void {
    const keysToRemove: string[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    console.log(`🗑️ Cleared ${keysToRemove.length} cache entries`)
  }

  /**
   * Get cache statistics
   */
  static getStats(): {
    totalEntries: number
    totalSize: number
    oldestEntry: number | null
    newestEntry: number | null
  } {
    let totalEntries = 0
    let totalSize = 0
    let oldestEntry: number | null = null
    let newestEntry: number | null = null

    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i)
      if (storageKey && storageKey.startsWith(this.CACHE_PREFIX)) {
        const cached = localStorage.getItem(storageKey)
        if (cached) {
          try {
            const entry: CacheEntry<unknown> = JSON.parse(cached)
            totalEntries++
            totalSize += cached.length

            if (oldestEntry === null || entry.timestamp < oldestEntry) {
              oldestEntry = entry.timestamp
            }
            if (newestEntry === null || entry.timestamp > newestEntry) {
              newestEntry = entry.timestamp
            }
          } catch {
            // Skip corrupted entries
          }
        }
      }
    }

    return { totalEntries, totalSize, oldestEntry, newestEntry }
  }
}

/**
 * Specific cache managers for different data types
 */

export class RepositoryCache {
  private static readonly REPO_PREFIX = 'repo_'
  private static readonly ANALYSIS_PREFIX = 'analysis_'
  private static readonly STRUCTURE_PREFIX = 'structure_'

  static cacheRepository(owner: string, name: string, data: GitHubRepo): void {
    const key = `${this.REPO_PREFIX}${owner}/${name}`
    CacheManager.set(key, data, { ttl: 60 * 60 * 1000 }) // 1 hour
  }

  static getRepository(owner: string, name: string): GitHubRepo | null {
    const key = `${this.REPO_PREFIX}${owner}/${name}`
    return CacheManager.get(key)
  }

  static cacheAnalysis(owner: string, name: string, analysis: RepoAnalysis): void {
    const key = `${this.ANALYSIS_PREFIX}${owner}/${name}`
    CacheManager.set(key, analysis, { ttl: 24 * 60 * 60 * 1000 }) // 24 hours
  }

  static getAnalysis(owner: string, name: string): RepoAnalysis | null {
    const key = `${this.ANALYSIS_PREFIX}${owner}/${name}`
    return CacheManager.get(key)
  }

  static cacheStructure(owner: string, name: string, structure: FileNode): void {
    const key = `${this.STRUCTURE_PREFIX}${owner}/${name}`
    CacheManager.set(key, structure, { ttl: 60 * 60 * 1000 }) // 1 hour
  }

  static getStructure(owner: string, name: string): FileNode | null {
    const key = `${this.STRUCTURE_PREFIX}${owner}/${name}`
    return CacheManager.get(key)
  }

  static clearRepositoryCache(owner: string, name: string): void {
    // Clear all cache entries for this repository
    const repoKey = `${this.REPO_PREFIX}${owner}/${name}`
    const analysisKey = `${this.ANALYSIS_PREFIX}${owner}/${name}`
    const structureKey = `${this.STRUCTURE_PREFIX}${owner}/${name}`
    
    CacheManager.remove(repoKey)
    CacheManager.remove(analysisKey)
    CacheManager.remove(structureKey)
    
    // Also clear directory and file caches
    DirectoryCache.invalidateRepository(owner, name)
    FileContentCache.invalidateRepository(owner, name)
    
    console.log(`🗑️ Cleared all cache entries for ${owner}/${name}`)
  }
}

export class DirectoryCache {
  private static readonly DIR_PREFIX = 'dir_'

  static cacheDirectory(owner: string, repo: string, path: string, contents: FileNode[]): void {
    const key = `${this.DIR_PREFIX}${owner}/${repo}/${path}`
    CacheManager.set(key, contents, { ttl: 30 * 60 * 1000 }) // 30 minutes
  }

  static getDirectory(owner: string, repo: string, path: string): FileNode[] | null {
    const key = `${this.DIR_PREFIX}${owner}/${repo}/${path}`
    return CacheManager.get(key)
  }

  static invalidateRepository(owner: string, repo: string): void {
    // Remove all directory caches for this repository
    const prefix = `${this.DIR_PREFIX}${owner}/${repo}/`
    
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i)
      if (storageKey && storageKey.includes(prefix)) {
        localStorage.removeItem(storageKey)
      }
    }
  }
}

export class FileContentCache {
  private static readonly FILE_PREFIX = 'file_'

  static cacheFile(owner: string, repo: string, path: string, content: string): void {
    const key = `${this.FILE_PREFIX}${owner}/${repo}/${path}`
    CacheManager.set(key, content, { ttl: 60 * 60 * 1000 }) // 1 hour
  }

  static getFile(owner: string, repo: string, path: string): string | null {
    const key = `${this.FILE_PREFIX}${owner}/${repo}/${path}`
    return CacheManager.get(key)
  }

  static invalidateRepository(owner: string, repo: string): void {
    // Remove all file caches for this repository
    const prefix = `${this.FILE_PREFIX}${owner}/${repo}/`
    
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i)
      if (storageKey && storageKey.includes(prefix)) {
        localStorage.removeItem(storageKey)
      }
    }
  }
}
