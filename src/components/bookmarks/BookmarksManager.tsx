import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookmarkedRepo, BookmarkFolder } from '@/lib/bookmark-manager'
import { BookmarkManager } from '@/lib/bookmark-manager'
import { GitHubRepo } from '@/types'
import { 
  Bookmark, 
  BookmarkPlus, 
  Star, 
  GitFork, 
  Calendar,
  Search,
  Tag,
  Folder,
  MoreVertical,
  ExternalLink,
  Download,
  Upload,
  Trash2,
  Edit,
  Eye,
  Clock,
} from 'lucide-react'

interface BookmarksManagerProps {
  currentRepo?: GitHubRepo
  onRepoSelect?: (repo: GitHubRepo) => void
}

export function BookmarksManager({ currentRepo, onRepoSelect }: BookmarksManagerProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkedRepo[]>([])
  const [folders, setFolders] = useState<BookmarkFolder[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')

  // Load bookmarks and folders
  useEffect(() => {
    setBookmarks(BookmarkManager.getBookmarks())
    setFolders(BookmarkManager.getFolders())
  }, [])

  // Filter bookmarks based on search, folder, and tag
  const filteredBookmarks = bookmarks.filter(bookmark => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!bookmark.name.toLowerCase().includes(query) &&
          !bookmark.description?.toLowerCase().includes(query) &&
          !bookmark.owner.toLowerCase().includes(query) &&
          !bookmark.tags.some(tag => tag.toLowerCase().includes(query))) {
        return false
      }
    }

    if (selectedFolder) {
      const folder = folders.find(f => f.id === selectedFolder)
      if (!folder?.repos.includes(bookmark.url)) {
        return false
      }
    }

    if (selectedTag && !bookmark.tags.includes(selectedTag)) {
      return false
    }

    return true
  })

  // Get all unique tags
  const allTags = BookmarkManager.getAllTags()

  // Handle bookmark actions
  const handleBookmark = () => {
    if (currentRepo) {
      BookmarkManager.addBookmark(currentRepo)
      setBookmarks(BookmarkManager.getBookmarks())
    }
  }

  const handleRemoveBookmark = (repoUrl: string) => {
    BookmarkManager.removeBookmark(repoUrl)
    setBookmarks(BookmarkManager.getBookmarks())
  }

  const handleRepoClick = (repo: BookmarkedRepo) => {
    BookmarkManager.recordVisit(repo.url)
    setBookmarks(BookmarkManager.getBookmarks())
    onRepoSelect?.(repo)
  }

  const isCurrentRepoBookmarked = currentRepo ? 
    BookmarkManager.isBookmarked(currentRepo.url) : false

  const stats = BookmarkManager.getStats()

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="h-5 w-5" />
              Repository Bookmarks
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {currentRepo && (
                <Button
                  variant={isCurrentRepoBookmarked ? "secondary" : "default"}
                  size="sm"
                  onClick={handleBookmark}
                  disabled={isCurrentRepoBookmarked}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200"
                >
                  <BookmarkPlus className="h-4 w-4 mr-1" />
                  {isCurrentRepoBookmarked ? 'Bookmarked' : 'Bookmark'}
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm"
                className="cursor-pointer hover:scale-105 transition-transform duration-200"
              >
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                className="cursor-pointer hover:scale-105 transition-transform duration-200"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bookmarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedFolder === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFolder(null)}
                className="cursor-pointer hover:scale-105 transition-transform duration-200"
              >
                All
              </Button>
              
              {folders.map(folder => (
                <Button
                  key={folder.id}
                  variant={selectedFolder === folder.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFolder(folder.id)}
                  style={{ borderColor: folder.color }}
                  className="cursor-pointer hover:scale-105 transition-transform duration-200"
                >
                  <Folder className="h-3 w-3 mr-1" />
                  {folder.name}
                </Button>
              ))}
            </div>

            {/* Tag Filters */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {allTags.slice(0, 10).map(tag => (
                  <Button
                    key={tag}
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className="text-xs"
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalBookmarks}</div>
              <div className="text-sm text-muted-foreground">Total Bookmarks</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-info">{stats.totalFolders}</div>
              <div className="text-sm text-muted-foreground">Folders</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{stats.totalTags}</div>
              <div className="text-sm text-muted-foreground">Tags</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">
                {stats.recentlyVisited.length}
              </div>
              <div className="text-sm text-muted-foreground">Recently Visited</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookmarks Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {filteredBookmarks.length} Bookmark{filteredBookmarks.length !== 1 ? 's' : ''}
          </h3>
          
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('grid')}
              className="cursor-pointer hover:scale-105 transition-transform duration-200"
            >
              Grid
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('list')}
              className="cursor-pointer hover:scale-105 transition-transform duration-200"
            >
              List
            </Button>
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          <div className={`grid gap-4 ${view === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {filteredBookmarks.map((bookmark, index) => (
              <motion.div
                key={bookmark.url}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div 
                          className="font-semibold truncate hover:text-primary"
                          onClick={() => handleRepoClick(bookmark)}
                        >
                          {bookmark.name}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {bookmark.owner}/{bookmark.name}
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveBookmark(bookmark.url)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {bookmark.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {bookmark.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {bookmark.stars || 0}
                      </div>
                      <div className="flex items-center gap-1">
                        <GitFork className="h-3 w-3" />
                        {bookmark.forks || 0}
                      </div>
                      {bookmark.language && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-info" />
                          {bookmark.language}
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {bookmark.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {bookmark.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                        {bookmark.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{bookmark.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(bookmark.bookmarkedAt).toLocaleDateString()}
                      </div>
                      
                      {bookmark.visitCount > 0 && (
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {bookmark.visitCount} visit{bookmark.visitCount !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRepoClick(bookmark)}
                        className="flex-1 cursor-pointer hover:scale-105 transition-transform duration-200"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Explore
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(bookmark.url, '_blank')}
                        className="cursor-pointer hover:scale-105 transition-transform duration-200"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>

        {/* Empty State */}
        {filteredBookmarks.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <Bookmark className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No bookmarks found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? 
                      `No bookmarks match "${searchQuery}"` : 
                      'Start exploring repositories and bookmark your favorites!'
                    }
                  </p>
                </div>
                {currentRepo && !isCurrentRepoBookmarked && (
                  <Button onClick={handleBookmark}>
                    <BookmarkPlus className="h-4 w-4 mr-2" />
                    Bookmark Current Repository
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
