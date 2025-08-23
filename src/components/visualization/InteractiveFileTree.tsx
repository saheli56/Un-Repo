import React, { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileNode, GitHubRepo } from '@/types'
import { 
  ChevronRight, 
  File, 
  Folder, 
  FolderOpen,
  Code,
  Image,
  FileText,
  Settings,
  Package,
  GitBranch,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2
} from 'lucide-react'

interface InteractiveFileTreeProps {
  repo: GitHubRepo
  structure: FileNode
  onFileSelect: (file: FileNode) => void
  selectedFile?: FileNode | null
}

interface TreeNodeState {
  expanded: boolean
  hovered: boolean
  children: Map<string, TreeNodeState>
}

// File type icons mapping
const getFileIcon = (node: FileNode, isExpanded?: boolean) => {
  if (node.type === 'directory') {
    return isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />
  }

  const extension = node.extension?.toLowerCase()
  const fileName = node.name.toLowerCase()

  // Special files
  if (fileName === 'package.json') return <Package className="h-4 w-4 text-green-500" />
  if (fileName === 'readme.md') return <FileText className="h-4 w-4 text-blue-500" />
  if (fileName.includes('config') || fileName.includes('.json')) return <Settings className="h-4 w-4 text-yellow-500" />
  if (fileName.includes('git')) return <GitBranch className="h-4 w-4 text-orange-500" />

  // Code files
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c'].includes(extension || '')) {
    return <Code className="h-4 w-4 text-blue-400" />
  }

  // Images
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(extension || '')) {
    return <Image className="h-4 w-4 text-purple-400" />
  }

  // Default file
  return <File className="h-4 w-4 text-gray-400" />
}

// Get file type color
const getFileTypeColor = (node: FileNode): string => {
  if (node.type === 'directory') return 'text-blue-600 dark:text-blue-400'
  
  const extension = node.extension?.toLowerCase()
  const fileName = node.name.toLowerCase()

  if (fileName === 'package.json') return 'text-green-600 dark:text-green-400'
  if (fileName === 'readme.md') return 'text-blue-600 dark:text-blue-400'
  if (['.ts', '.tsx'].includes(extension || '')) return 'text-blue-500 dark:text-blue-300'
  if (['.js', '.jsx'].includes(extension || '')) return 'text-yellow-500 dark:text-yellow-300'
  if (['.py'].includes(extension || '')) return 'text-green-500 dark:text-green-300'
  if (['.css', '.scss'].includes(extension || '')) return 'text-pink-500 dark:text-pink-300'
  
  return 'text-gray-600 dark:text-gray-400'
}

// Get file importance for initial expansion
const getFileImportance = (node: FileNode): number => {
  const fileName = node.name.toLowerCase()
  const path = node.path.toLowerCase()

  // High importance
  if (fileName === 'package.json' || fileName === 'readme.md') return 10
  if (fileName.includes('index') || fileName.includes('main') || fileName.includes('app')) return 8
  if (path.includes('/src/') || path === '/src') return 7
  if (path.includes('/components/') || path === '/components') return 6
  if (path.includes('/lib/') || path === '/lib') return 5

  // Medium importance
  if (node.type === 'directory' && node.depth <= 2) return 4
  if (fileName.includes('config') || fileName.includes('types')) return 3

  return 1
}

export function InteractiveFileTree({ repo, structure, onFileSelect, selectedFile }: InteractiveFileTreeProps) {
  const [showHiddenFiles, setShowHiddenFiles] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [progressiveMode, setProgressiveMode] = useState(true)
  const [nodeStates, setNodeStates] = useState<Map<string, TreeNodeState>>(new Map())
  const [searchTerm, setSearchTerm] = useState('')

  // Initialize important nodes as expanded based on mode
  const initializeNodeStates = useCallback((node: FileNode, states: Map<string, TreeNodeState> = new Map()): Map<string, TreeNodeState> => {
    const importance = getFileImportance(node)
    const shouldExpand = progressiveMode 
      ? (importance >= 8 || (node.depth === 0)) // More selective in progressive mode
      : (importance >= 6 || node.depth <= 1)   // More open in full mode

    const state: TreeNodeState = {
      expanded: shouldExpand,
      hovered: false,
      children: new Map()
    }

    states.set(node.id, state)

    if (node.children && node.type === 'directory') {
      node.children.forEach(child => initializeNodeStates(child, states))
    }

    return states
  }, [progressiveMode])

  // Toggle progressive mode
  const toggleProgressiveMode = useCallback(() => {
    setProgressiveMode(prev => {
      const newMode = !prev
      // Reinitialize states based on new mode
      const newStates = initializeNodeStates(structure)
      setNodeStates(newStates)
      return newMode
    })
  }, [initializeNodeStates, structure])

  // Initialize states on first load
  React.useEffect(() => {
    if (nodeStates.size === 0) {
      const initialStates = initializeNodeStates(structure)
      setNodeStates(initialStates)
    }
  }, [structure, nodeStates.size, initializeNodeStates])

  // Toggle node expansion
  const toggleNode = useCallback((nodeId: string) => {
    setNodeStates(prev => {
      const newStates = new Map(prev)
      const currentState = newStates.get(nodeId)
      if (currentState) {
        newStates.set(nodeId, {
          ...currentState,
          expanded: !currentState.expanded
        })
      }
      return newStates
    })
  }, [])

  // Set node hover state
  const setNodeHover = useCallback((nodeId: string, hovered: boolean) => {
    setNodeStates(prev => {
      const newStates = new Map(prev)
      const currentState = newStates.get(nodeId)
      if (currentState) {
        newStates.set(nodeId, {
          ...currentState,
          hovered
        })
      }
      return newStates
    })
  }, [])

  // Filter nodes based on search and hidden files
  const filterNode = useCallback((node: FileNode): boolean => {
    if (!showHiddenFiles && node.name.startsWith('.')) return false
    if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      // Check if any children match
      if (node.children) {
        return node.children.some(child => filterNode(child))
      }
      return false
    }
    return true
  }, [showHiddenFiles, searchTerm])

  // Render individual tree node
  const renderTreeNode = useCallback((node: FileNode, depth: number = 0): React.ReactNode => {
    if (!filterNode(node)) return null

    const nodeState = nodeStates.get(node.id)
    const isExpanded = nodeState?.expanded || false
    const isHovered = nodeState?.hovered || false
    const isSelected = selectedFile?.id === node.id
    const hasChildren = node.children && node.children.length > 0

    return (
      <motion.div
        key={node.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: depth * 0.05 }}
      >
        <div
          className={`
            flex items-center py-1 px-2 rounded-md cursor-pointer transition-all duration-200
            hover:bg-accent hover:text-accent-foreground
            ${isSelected ? 'bg-primary/10 text-primary border-l-2 border-primary' : ''}
            ${isHovered ? 'bg-accent/50' : ''}
          `}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => {
            if (node.type === 'directory' && hasChildren) {
              toggleNode(node.id)
            } else {
              onFileSelect(node)
            }
          }}
          onMouseEnter={() => setNodeHover(node.id, true)}
          onMouseLeave={() => setNodeHover(node.id, false)}
        >
          {/* Expansion toggle */}
          <div className="w-4 h-4 mr-1 flex items-center justify-center">
            {hasChildren && node.type === 'directory' && (
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="h-3 w-3" />
              </motion.div>
            )}
          </div>

          {/* File icon */}
          <div className="mr-2">
            {getFileIcon(node, isExpanded)}
          </div>

          {/* File name */}
          <span className={`flex-1 text-sm ${getFileTypeColor(node)} ${isSelected ? 'font-medium' : ''}`}>
            {node.name}
          </span>

          {/* File info badges */}
          <div className="flex items-center gap-1 ml-2">
            {node.type === 'directory' && node.children && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                {node.children.length}
              </Badge>
            )}
            {getFileImportance(node) >= 8 && (
              <Badge variant="default" className="text-xs px-1 py-0">
                ★
              </Badge>
            )}
          </div>
        </div>

        {/* Render children */}
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              {node.children?.map(child => renderTreeNode(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }, [nodeStates, selectedFile, filterNode, toggleNode, setNodeHover, onFileSelect])

  // File statistics
  const stats = useMemo(() => {
    const calculateStats = (node: FileNode): { files: number; directories: number; totalSize: number } => {
      let files = 0
      let directories = 0
      let totalSize = 0

      if (node.type === 'file') {
        files = 1
        totalSize = node.size || 0
      } else {
        directories = 1
      }

      if (node.children) {
        node.children.forEach(child => {
          const childStats = calculateStats(child)
          files += childStats.files
          directories += childStats.directories
          totalSize += childStats.totalSize
        })
      }

      return { files, directories, totalSize }
    }

    return calculateStats(structure)
  }, [structure])

  const expandAll = () => {
    setNodeStates(prev => {
      const newStates = new Map(prev)
      newStates.forEach((state, nodeId) => {
        newStates.set(nodeId, { ...state, expanded: true })
      })
      return newStates
    })
    setIsExpanded(true)
  }

  const collapseAll = () => {
    setNodeStates(prev => {
      const newStates = new Map(prev)
      newStates.forEach((state, nodeId) => {
        newStates.set(nodeId, { ...state, expanded: false })
      })
      return newStates
    })
    setIsExpanded(false)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Repository Structure
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={progressiveMode ? "default" : "secondary"}
              size="sm"
              onClick={toggleProgressiveMode}
              className="h-8 text-xs"
              title={progressiveMode ? "Switch to Full View" : "Switch to Progressive Mode"}
            >
              {progressiveMode ? (
                <>
                  <Package className="h-3 w-3 mr-1" />
                  Progressive
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3 mr-1" />
                  Full
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHiddenFiles(!showHiddenFiles)}
              className="h-8"
            >
              {showHiddenFiles ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={isExpanded ? collapseAll : expandAll}
              className="h-8"
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Repository info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{repo.owner}/{repo.name}</span>
          <Badge variant="outline">{stats.files} files</Badge>
          <Badge variant="outline">{stats.directories} folders</Badge>
          {progressiveMode && (
            <Badge variant="secondary" className="text-xs">
              <Package className="h-3 w-3 mr-1" />
              Smart expansion
            </Badge>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
        />
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-4">
        <div className="space-y-1">
          {renderTreeNode(structure)}
        </div>

        {/* Empty state */}
        {searchTerm && nodeStates.size === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <File className="h-12 w-12 mb-2 opacity-50" />
            <p>No files found matching "{searchTerm}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
