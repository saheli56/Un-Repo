import { GitHubRepo } from '@/types'

export interface BookmarkedRepo extends GitHubRepo {
  bookmarkedAt: number
  tags: string[]
  notes: string
  lastVisited?: number
  visitCount: number
}

export interface BookmarkFolder {
  id: string
  name: string
  color: string
  repos: string[] // repo IDs
  createdAt: number
}

export class BookmarkManager {
  private static readonly STORAGE_KEY = 'statuscode_bookmarks'
  private static readonly FOLDERS_KEY = 'statuscode_bookmark_folders'

  // Bookmark management
  static getBookmarks(): BookmarkedRepo[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to load bookmarks:', error)
      return []
    }
  }

  static saveBookmarks(bookmarks: BookmarkedRepo[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bookmarks))
    } catch (error) {
      console.error('Failed to save bookmarks:', error)
    }
  }

  static addBookmark(repo: GitHubRepo, tags: string[] = [], notes: string = ''): void {
    const bookmarks = this.getBookmarks()
    const existing = bookmarks.find(b => b.url === repo.url)
    
    if (existing) {
      // Update existing bookmark
      existing.tags = [...new Set([...existing.tags, ...tags])]
      existing.notes = notes || existing.notes
      existing.bookmarkedAt = Date.now()
    } else {
      // Add new bookmark
      const newBookmark: BookmarkedRepo = {
        ...repo,
        bookmarkedAt: Date.now(),
        tags,
        notes,
        visitCount: 0
      }
      bookmarks.push(newBookmark)
    }
    
    this.saveBookmarks(bookmarks)
  }

  static removeBookmark(repoUrl: string): void {
    const bookmarks = this.getBookmarks()
    const filtered = bookmarks.filter(b => b.url !== repoUrl)
    this.saveBookmarks(filtered)
  }

  static updateBookmark(repoUrl: string, updates: Partial<BookmarkedRepo>): void {
    const bookmarks = this.getBookmarks()
    const bookmark = bookmarks.find(b => b.url === repoUrl)
    
    if (bookmark) {
      Object.assign(bookmark, updates)
      this.saveBookmarks(bookmarks)
    }
  }

  static isBookmarked(repoUrl: string): boolean {
    return this.getBookmarks().some(b => b.url === repoUrl)
  }

  static recordVisit(repoUrl: string): void {
    const bookmarks = this.getBookmarks()
    const bookmark = bookmarks.find(b => b.url === repoUrl)
    
    if (bookmark) {
      bookmark.lastVisited = Date.now()
      bookmark.visitCount = (bookmark.visitCount || 0) + 1
      this.saveBookmarks(bookmarks)
    }
  }

  // Folder management
  static getFolders(): BookmarkFolder[] {
    try {
      const stored = localStorage.getItem(this.FOLDERS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to load bookmark folders:', error)
      return []
    }
  }

  static saveFolders(folders: BookmarkFolder[]): void {
    try {
      localStorage.setItem(this.FOLDERS_KEY, JSON.stringify(folders))
    } catch (error) {
      console.error('Failed to save bookmark folders:', error)
    }
  }

  static createFolder(name: string, color: string = '#3b82f6'): BookmarkFolder {
    const folders = this.getFolders()
    const newFolder: BookmarkFolder = {
      id: `folder_${Date.now()}`,
      name,
      color,
      repos: [],
      createdAt: Date.now()
    }
    
    folders.push(newFolder)
    this.saveFolders(folders)
    return newFolder
  }

  static deleteFolder(folderId: string): void {
    const folders = this.getFolders()
    const filtered = folders.filter(f => f.id !== folderId)
    this.saveFolders(filtered)
  }

  static addRepoToFolder(repoUrl: string, folderId: string): void {
    const folders = this.getFolders()
    const folder = folders.find(f => f.id === folderId)
    
    if (folder && !folder.repos.includes(repoUrl)) {
      folder.repos.push(repoUrl)
      this.saveFolders(folders)
    }
  }

  static removeRepoFromFolder(repoUrl: string, folderId: string): void {
    const folders = this.getFolders()
    const folder = folders.find(f => f.id === folderId)
    
    if (folder) {
      folder.repos = folder.repos.filter(url => url !== repoUrl)
      this.saveFolders(folders)
    }
  }

  // Search and filter
  static searchBookmarks(query: string): BookmarkedRepo[] {
    const bookmarks = this.getBookmarks()
    const lowerQuery = query.toLowerCase()
    
    return bookmarks.filter(bookmark => 
      bookmark.name.toLowerCase().includes(lowerQuery) ||
      bookmark.description?.toLowerCase().includes(lowerQuery) ||
      bookmark.owner.toLowerCase().includes(lowerQuery) ||
      bookmark.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      bookmark.notes.toLowerCase().includes(lowerQuery)
    )
  }

  static getBookmarksByTag(tag: string): BookmarkedRepo[] {
    return this.getBookmarks().filter(bookmark => 
      bookmark.tags.includes(tag)
    )
  }

  static getBookmarksByFolder(folderId: string): BookmarkedRepo[] {
    const folders = this.getFolders()
    const folder = folders.find(f => f.id === folderId)
    
    if (!folder) return []
    
    const bookmarks = this.getBookmarks()
    return bookmarks.filter(bookmark => 
      folder.repos.includes(bookmark.url)
    )
  }

  static getAllTags(): string[] {
    const bookmarks = this.getBookmarks()
    const tags = new Set<string>()
    
    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tag => tags.add(tag))
    })
    
    return Array.from(tags).sort()
  }

  // Statistics
  static getStats() {
    const bookmarks = this.getBookmarks()
    const folders = this.getFolders()
    
    return {
      totalBookmarks: bookmarks.length,
      totalFolders: folders.length,
      totalTags: this.getAllTags().length,
      mostVisited: bookmarks
        .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
        .slice(0, 5),
      recentlyAdded: bookmarks
        .sort((a, b) => b.bookmarkedAt - a.bookmarkedAt)
        .slice(0, 5),
      recentlyVisited: bookmarks
        .filter(b => b.lastVisited)
        .sort((a, b) => (b.lastVisited || 0) - (a.lastVisited || 0))
        .slice(0, 5)
    }
  }

  // Import/Export
  static exportBookmarks(): string {
    const data = {
      bookmarks: this.getBookmarks(),
      folders: this.getFolders(),
      exportedAt: Date.now(),
      version: '1.0.0'
    }
    
    return JSON.stringify(data, null, 2)
  }

  static importBookmarks(jsonData: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonData)
      
      if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
        return { success: false, message: 'Invalid bookmark data format' }
      }
      
      // Merge with existing bookmarks
      const existingBookmarks = this.getBookmarks()
      const existingUrls = new Set(existingBookmarks.map(b => b.url))
      
      const newBookmarks = data.bookmarks.filter((b: BookmarkedRepo) => 
        !existingUrls.has(b.url)
      )
      
      this.saveBookmarks([...existingBookmarks, ...newBookmarks])
      
      // Import folders if available
      if (data.folders && Array.isArray(data.folders)) {
        const existingFolders = this.getFolders()
        const existingFolderNames = new Set(existingFolders.map(f => f.name))
        
        const newFolders = data.folders.filter((f: BookmarkFolder) => 
          !existingFolderNames.has(f.name)
        )
        
        this.saveFolders([...existingFolders, ...newFolders])
      }
      
      return { 
        success: true, 
        message: `Imported ${newBookmarks.length} new bookmarks` 
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to parse bookmark data' 
      }
    }
  }
}
