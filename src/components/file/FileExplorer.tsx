import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { GitHubRepo, FileNode } from '@/types'
import { loadDirectoryContents } from '@/lib/utils'
import { 
  Folder, 
  FolderOpen, 
  Search, 
  ChevronRight,
  FileText,
  Code,
  Image,
  Settings,
} from 'lucide-react'

interface FileExplorerProps {
  repo: GitHubRepo
  structure: FileNode
  onFileSelect: (file: FileNode) => void
  selectedFile: FileNode | null
}

export function FileExplorer({ repo, structure, onFileSelect, selectedFile }: FileExplorerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']))
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set())
  const [failedFolders, setFailedFolders] = useState<Set<string>>(new Set())
  const [dynamicStructure, setDynamicStructure] = useState<FileNode>(structure)

  // Update dynamic structure when structure prop changes
  React.useEffect(() => {
    setDynamicStructure(structure)
  }, [structure])

  const loadFolderContents = async (folder: FileNode) => {
    if (folder.children !== undefined) {
      // Already loaded
      return
    }

    console.log(`Loading folder: ${folder.path} for repo: ${repo.owner}/${repo.name}`)
    setLoadingFolders(prev => new Set(prev).add(folder.id))
    setFailedFolders(prev => {
      const newSet = new Set(prev)
      newSet.delete(folder.id)
      return newSet
    })
    
    try {
      const children = await loadDirectoryContents(repo.owner, repo.name, folder.path)
      console.log(`Loaded ${children.length} children for ${folder.path}`)
      
      // Update the dynamic structure by finding and updating the folder
      setDynamicStructure(prev => updateFolderInStructure(prev, folder.id, children))
      
      if (children.length === 0) {
        console.warn(`Directory ${folder.path} appears to be empty or inaccessible`)
      }
    } catch (error) {
      console.error(`Failed to load contents for ${folder.path}:`, error)
      setFailedFolders(prev => new Set(prev).add(folder.id))
      
      // Check if this is a rate limit error
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('rate limit exceeded') || errorMessage.includes('403')) {
        console.warn('GitHub API rate limit exceeded. Consider adding a GitHub token for higher limits.')
      }
      
      // Set empty children to indicate loading failed
      setDynamicStructure(prev => updateFolderInStructure(prev, folder.id, []))
    } finally {
      setLoadingFolders(prev => {
        const newSet = new Set(prev)
        newSet.delete(folder.id)
        return newSet
      })
    }
  }

  const updateFolderInStructure = (node: FileNode, folderId: string, children: FileNode[]): FileNode => {
    if (node.id === folderId) {
      return { ...node, children }
    }
    
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => updateFolderInStructure(child, folderId, children))
      }
    }
    
    return node
  }

  const toggleFolder = async (folderId: string, folder: FileNode) => {
    const isCurrentlyExpanded = expandedFolders.has(folderId)
    
    if (!isCurrentlyExpanded) {
      // If expanding, load contents if not already loaded
      await loadFolderContents(folder)
    }
    
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  const getFileIcon = (file: FileNode) => {
    if (file.type === 'directory') {
      return expandedFolders.has(file.id) ? FolderOpen : Folder
    }

    const extension = file.extension || ''
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs'].includes(extension)) {
      return Code
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(extension)) {
      return Image
    }
    if (['json', 'yml', 'yaml', 'toml', 'ini'].includes(extension)) {
      return Settings
    }
    return FileText
  }

  const renderFileNode = (file: FileNode) => {
    const Icon = getFileIcon(file)
    const isExpanded = expandedFolders.has(file.id)
    const isSelected = selectedFile?.id === file.id
    const isLoading = loadingFolders.has(file.id)
    // For directories, show expand icon if they have children or haven't been loaded yet (children === undefined)
    const hasOrMightHaveChildren = file.type === 'directory' && (
      (file.children && file.children.length > 0) || 
      file.children === undefined
    )

    return (
      <motion.div
        key={file.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="select-none"
      >
        <div
          className={`
            flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer
            hover:bg-accent/50 transition-colors
            ${isSelected ? 'bg-accent text-accent-foreground' : ''}
          `}
          style={{ paddingLeft: `${file.depth * 16 + 8}px` }}
          onClick={() => {
            if (file.type === 'directory') {
              toggleFolder(file.id, file)
            } else {
              onFileSelect(file)
            }
          }}
        >
          {file.type === 'directory' && hasOrMightHaveChildren && (
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </motion.div>
          )}
          
          {file.type === 'directory' && !hasOrMightHaveChildren && (
            <div className="w-4" />
          )}

          <Icon className="h-4 w-4" />
          
          <span className="text-sm font-medium">{file.name}</span>
          
          {file.type === 'file' && file.size && (
            <span className="text-xs text-muted-foreground ml-auto">
              {Math.round(file.size / 1024)}KB
            </span>
          )}
        </div>

        <AnimatePresence>
          {file.type === 'directory' && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground" style={{ paddingLeft: `${(file.depth + 1) * 16 + 8}px` }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </motion.div>
                  Loading...
                </div>
              ) : failedFolders.has(file.id) ? (
                <div className="px-2 py-1 text-sm text-error" style={{ paddingLeft: `${(file.depth + 1) * 16 + 8}px` }}>
                  <div>Failed to load folder contents</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    This might be due to GitHub API rate limits. Try adding a GitHub token in settings.
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      className="text-xs underline hover:no-underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        loadFolderContents(file)
                      }}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : file.children && file.children.length > 0 ? (
                file.children.map(child => renderFileNode(child))
              ) : file.children && file.children.length === 0 ? (
                <div className="px-2 py-1 text-sm text-muted-foreground" style={{ paddingLeft: `${(file.depth + 1) * 16 + 8}px` }}>
                  Empty folder
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  const filteredStructure = dynamicStructure // TODO: Implement search filtering

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Folder className="h-5 w-5" />
          File Explorer
        </CardTitle>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        <div className="space-y-1 px-3 pb-3">
          {renderFileNode(filteredStructure)}
        </div>
      </CardContent>

      {/* Quick Stats */}
      <div className="border-t px-4 py-2">
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Repository: {repo.name}</div>
          <div>Files: {getTotalFiles(structure)}</div>
          <div>Folders: {getTotalFolders(structure)}</div>
        </div>
      </div>
    </Card>
  )
}

function getTotalFiles(node: FileNode): number {
  let count = node.type === 'file' ? 1 : 0
  if (node.children) {
    count += node.children.reduce((acc, child) => acc + getTotalFiles(child), 0)
  }
  return count
}

function getTotalFolders(node: FileNode): number {
  let count = node.type === 'directory' ? 1 : 0
  if (node.children) {
    count += node.children.reduce((acc, child) => acc + getTotalFolders(child), 0)
  }
  return count
}
