import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CacheManager } from '@/lib/cache-manager'
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  HardDrive,
  Clock,
  FileText
} from 'lucide-react'

export function CacheManagement() {
  const [stats, setStats] = useState<{
    totalEntries: number
    totalSize: number
    oldestEntry: number | null
    newestEntry: number | null
  } | null>(null)
  const [isClearing, setIsClearing] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadStats = async () => {
    setIsRefreshing(true)
    try {
      // Add small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300))
      const cacheStats = CacheManager.getStats()
      setStats(cacheStats)
    } catch (error) {
      console.error('Error loading cache stats:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleClearCache = async () => {
    setIsClearing(true)
    try {
      CacheManager.clear()
      loadStats()
    } finally {
      setIsClearing(false)
    }
  }

  const handleCleanupCache = async () => {
    setIsCleaning(true)
    try {
      CacheManager.cleanup()
      loadStats()
    } finally {
      setIsCleaning(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const formatDate = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Cache Management
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage cached repository data, file contents, and directory listings to optimize performance.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cache Statistics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                Entries
              </div>
              <div className="text-2xl font-bold">{stats.totalEntries}</div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4" />
                Size
              </div>
              <div className="text-2xl font-bold">{formatBytes(stats.totalSize)}</div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Oldest
              </div>
              <div className="text-sm">
                {stats.oldestEntry ? formatDate(stats.oldestEntry) : 'N/A'}
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Newest
              </div>
              <div className="text-sm">
                {stats.newestEntry ? formatDate(stats.newestEntry) : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Cache Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={loadStats}
            variant="outline"
            size="sm"
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Stats'}
          </Button>

          <Button
            onClick={handleCleanupCache}
            variant="outline"
            size="sm"
            disabled={isCleaning}
          >
            <Database className="h-4 w-4 mr-2" />
            {isCleaning ? 'Cleaning...' : 'Cleanup Expired'}
          </Button>

          <Button
            onClick={handleClearCache}
            variant="destructive"
            size="sm"
            disabled={isClearing}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isClearing ? 'Clearing...' : 'Clear All Cache'}
          </Button>
        </div>

        {/* Cache Information */}
        <div className="space-y-3 text-sm">
          <h4 className="font-medium">Cache Types:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>Repository Analysis:</strong> Cached for 24 hours - Contains tech stack analysis and repository insights</li>
            <li><strong>Repository Structure:</strong> Cached for 1 hour - File tree and directory structure</li>
            <li><strong>Directory Contents:</strong> Cached for 30 minutes - Individual folder contents for lazy loading</li>
            <li><strong>File Contents:</strong> Cached for 1 hour - Actual file source code and content</li>
          </ul>
          
          <div className="p-3 bg-info-muted border border-info rounded-md">
            <div className="flex items-start gap-2">
              <Database className="h-4 w-4 text-info mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-info-foreground">Cache Benefits</p>
                <p className="text-info mt-1">
                  Caching reduces GitHub API usage by 80-90%, provides instant navigation, 
                  and enables offline-like browsing of previously visited repositories.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
