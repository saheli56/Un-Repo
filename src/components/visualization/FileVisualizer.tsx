import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Network,
} from 'lucide-react'
import { SystemArchitecture } from '@/lib/enhanced-analyzer'
import { GitHubRepo } from '@/types'

interface Position {
  x: number
  y: number
}

interface FileVisualizerProps {
  architecture: SystemArchitecture
  repo: GitHubRepo
  className?: string
}

interface FileTreeNode {
  id: string
  name: string
  path: string
  type: 'directory' | 'file'
  parentId: string | null
  depth: number
  expanded: boolean
  visible: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  color: string
}

interface FileTreeConnection { id: string; source: string; target: string }

export function FileVisualizer({ architecture, repo, className = '' }: FileVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.8)
  const [pan, setPan] = useState({ x: 200, y: 50 })
  const [dragState, setDragState] = useState<{
    isPanning: boolean
    startPos: Position
    startPan: Position
  }>({
    isPanning: false,
    startPos: { x: 0, y: 0 },
    startPan: { x: 0, y: 0 }
  })

  const [fileNodes, setFileNodes] = useState<Record<string, FileTreeNode>>({})
  const [fileConnections, setFileConnections] = useState<FileTreeConnection[]>([])
  const fileTreeBuiltRef = useRef(false)
  const [layoutVersion, setLayoutVersion] = useState<number>(0)
  const fileNodesRef = useRef<Record<string, FileTreeNode>>({})

  const openGitHubPath = useCallback((path: string) => {
    if (!path) return
    const normalized = path.replace(/^\/+/,'')
    const encoded = normalized.split('/').map(encodeURIComponent).join('/')
    const url = `https://github.com/${repo.owner}/${repo.name}/blob/main/${encoded}`
    window.open(url, '_blank', 'noopener')
  }, [repo.owner, repo.name])

  useEffect(() => {
    if (fileTreeBuiltRef.current) return

    const allPaths = new Set<string>()
    architecture.components.forEach(c => c.files.forEach(f => allPaths.add(f)))
    architecture.staticAssets.forEach(f => allPaths.add(f))
    ;['package.json','vite.config.ts','tsconfig.json','index.html'].forEach(f => allPaths.add(f))

    const nodes: Record<string, FileTreeNode> = {}

    const ensureDir = (dirPath: string) => {
      const id = dirPath === '' ? 'root' : dirPath
      if (nodes[id]) return nodes[id]
      const depth = dirPath === '' ? 0 : dirPath.split('/').length
      const name = dirPath === '' ? 'Un-Repo' : dirPath.split('/').pop() || 'dir'
      nodes[id] = {
        id,
        name,
        path: dirPath,
        type: 'directory',
        parentId: dirPath === '' ? null : (dirPath.includes('/') ? dirPath.substring(0, dirPath.lastIndexOf('/')) || '' : '' ) || 'root',
        depth,
        expanded: depth === 0,
        visible: depth <= 1,
        position: { x: 0, y: 0 },
        size: { width: 180, height: 70 },
        color: depth === 0 ? '#1E3A8A' : '#2563EB'
      }
      return nodes[id]
    }

    ensureDir('')

    Array.from(allPaths).forEach(p => {
      const parts = p.split('/')
      parts.forEach((_seg, idx) => {
        const sub = parts.slice(0, idx + 1).join('/')
        if (idx === parts.length - 1 && /\.[A-Za-z0-9]+$/.test(sub.split('/').pop() || '')) return
        ensureDir(sub)
      })
    })

    const createFileNode = (filePath: string) => {
      const parentPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''
      const parentId = parentPath === '' ? 'root' : parentPath
      const depth = filePath.split('/').length
      const name = filePath.split('/').pop() || filePath
      if (nodes[filePath]) return
      nodes[filePath] = {
        id: filePath,
        name,
        path: filePath,
        type: 'file',
        parentId,
        depth,
        expanded: false,
        visible: false,
        position: { x: 0, y: 0 },
        size: { width: 160, height: 54 },
        color: '#6B7280'
      }
    }

    Array.from(allPaths).forEach(p => {
      if (/\.[A-Za-z0-9]+$/.test(p.split('/').pop() || '')) createFileNode(p)
    })

    Object.values(nodes).forEach(n => {
      if (n.depth === 1) n.visible = true
    })

    fileTreeBuiltRef.current = true
    setFileNodes(nodes)
    fileNodesRef.current = nodes
    setLayoutVersion(v => v + 1)
  }, [architecture.components, architecture.staticAssets])

  const toggleDirectory = (id: string) => {
    setFileNodes(prev => {
      const dir = prev[id]
      if (!dir || dir.type !== 'directory') return prev
      const updated: Record<string, FileTreeNode> = { ...prev }
      const willExpand = !dir.expanded
      updated[id] = { ...dir, expanded: willExpand }
      Object.values(prev).forEach(child => {
        if (child.parentId === (dir.path === '' ? 'root' : dir.path)) {
          if (willExpand) {
            updated[child.id] = { ...child, visible: true }
          } else {
            const collapseRec = (nid: string) => {
              const node = updated[nid]
              if (!node) return
              if (node.id !== id) updated[nid] = { ...node, visible: false, expanded: false }
              Object.values(updated).forEach(grand => { if (grand.parentId === (node.path === '' ? 'root' : node.path)) collapseRec(grand.id) })
            }
            collapseRec(child.id)
          }
        }
      })
      setLayoutVersion(v => v + 1)
      fileNodesRef.current = updated
      return updated
    })
  }

  useEffect(() => {
    setFileNodes(prev => {
      let changed = false
      const nodes = { ...prev }
      const depthGroups: Record<number, FileTreeNode[]> = {}
      Object.values(nodes).forEach(n => { if (n.visible) { depthGroups[n.depth] = depthGroups[n.depth] || []; depthGroups[n.depth].push(n) } })
      const depths = Object.keys(depthGroups).map(Number).sort((a,b)=>a-b)
      const canvasWidth = 1600
      const startY = 80
      const vSpacing = 130
      depths.forEach((d, idx) => {
        const row = depthGroups[d]
        row.sort((a,b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1))
        const nodeWidth = 170
        const hSpacing = Math.max(30, 60 - idx * 2)
        const totalWidth = row.length * nodeWidth + (row.length - 1) * hSpacing
        const startX = (canvasWidth - totalWidth) / 2
        row.forEach((n, i) => {
          const newPosX = startX + i * (nodeWidth + hSpacing)
            const newPosY = startY + idx * vSpacing
            if (n.position.x !== newPosX || n.position.y !== newPosY || n.size.width !== nodeWidth) {
              changed = true
              nodes[n.id] = { ...n, position: { x: newPosX, y: newPosY }, size: { width: nodeWidth, height: n.type === 'directory' ? 70 : 54 } }
            }
        })
      })
      if (changed) {
        fileNodesRef.current = nodes
        return nodes
      }
      return prev
    })
    setFileConnections(() => {
      const conns: FileTreeConnection[] = []
      const snapshot: Record<string, FileTreeNode> = fileNodesRef.current
      Object.values(snapshot).forEach(n => {
        if (!n.visible || !n.parentId) return
        const parentId = n.parentId === '' ? 'root' : n.parentId
        const parent = snapshot[parentId]
        if (parent && parent.visible) conns.push({ id: parent.id + '->' + n.id, source: parent.id, target: n.id })
      })
      return conns
    })
  }, [layoutVersion])

  const handleZoom = useCallback((delta: number) => {
    setScale(prev => Math.max(0.2, Math.min(5, prev + delta)))
  }, [])

  const handleReset = useCallback(() => {
    setScale(0.8)
    setPan({ x: 200, y: 50 })
  }, [])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          handleZoom(0.1)
        } else if (e.key === '-') {
          e.preventDefault()
          handleZoom(-0.1)
        } else if (e.key === '0') {
          e.preventDefault()
          handleReset()
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleZoom, handleReset])

  const handleBackgroundMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      const svgRect = svgRef.current?.getBoundingClientRect()
      if (!svgRect) return

      const mouseX = (e.clientX - svgRect.left) / scale + pan.x
      const mouseY = (e.clientY - svgRect.top) / scale + pan.y

      setDragState({
        isPanning: true,
        startPos: { x: mouseX, y: mouseY },
        startPan: { x: pan.x, y: pan.y }
      })
    }
  }, [scale, pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return

    const mouseX = (e.clientX - svgRect.left) / scale + pan.x
    const mouseY = (e.clientY - svgRect.top) / scale + pan.y

    if (dragState.isPanning) {
      const deltaX = mouseX - dragState.startPos.x
      const deltaY = mouseY - dragState.startPos.y

      setPan({
        x: dragState.startPan.x - deltaX,
        y: dragState.startPan.y - deltaY
      })
    }
  }, [dragState, scale, pan])

  const handleMouseUp = useCallback(() => {
    setDragState({
      isPanning: false,
      startPos: { x: 0, y: 0 },
      startPan: { x: 0, y: 0 }
    })
  }, [])

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp()
    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [handleMouseUp])

  const handleExport = () => {
    if (!svgRef.current) return
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    
    const downloadLink = document.createElement('a')
    downloadLink.href = svgUrl
    downloadLink.download = 'file-tree-diagram.svg'
    downloadLink.click()
    
    URL.revokeObjectURL(svgUrl)
  }

  return (
    <div className={`w-full ${className}`}>
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Network className="h-5 w-5" />
            Interactive File Tree
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/40 p-2 rounded-md shadow-sm">
            <Button size="sm" variant="default" onClick={() => handleZoom(0.1)} className="px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium" title={`Zoom In (Current: ${Math.round(scale * 100)}%)`}>
              <ZoomIn className="h-4 w-4 mr-1" />
              Zoom In
            </Button>
            <Button size="sm" variant="default" onClick={() => handleZoom(-0.1)} className="px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium" title={`Zoom Out (Current: ${Math.round(scale * 100)}%)`}>
              <ZoomOut className="h-4 w-4 mr-1" />
              Zoom Out
            </Button>
            <div className="flex items-center px-2 py-1 bg-muted rounded text-sm font-mono">
              {Math.round(scale * 100)}%
            </div>
            <Button size="sm" variant="outline" onClick={handleReset} className="px-2" title="Reset View">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} className="px-2" title="Export as SVG">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
          <div className="text-xs text-muted-foreground italic">Click directories to expand/collapse. Click files to open on GitHub.</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-xl text-blue-600">{Object.values(fileNodes).filter(n=>n.visible).length}</div>
              <div className="text-muted-foreground">Visible Nodes</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-xl text-purple-600">{fileConnections.length}</div>
              <div className="text-muted-foreground">Connections</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-xl text-green-600">{Object.values(fileNodes).filter(n=>n.visible && n.type==='directory').length}</div>
              <div className="text-muted-foreground">Visible Dirs</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div ref={containerRef} className="relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-green-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            <svg
              ref={svgRef}
              width="100%"
              height="950"
              viewBox={`${-pan.x} ${-pan.y} ${1800 / scale} ${950 / scale}`}
              className="w-full h-[950px] cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseDown={handleBackgroundMouseDown}
              style={{ cursor: dragState.isPanning ? 'grabbing' : 'default' }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto" markerUnits="strokeWidth">
                  <polygon points="0 0, 12 4, 0 8" fill="#666" className="drop-shadow-sm" />
                </marker>
              </defs>
              <rect width="100%" height="100%" fill="transparent" style={{ cursor: dragState.isPanning ? 'grabbing' : 'grab' }} />
              <>
                {fileConnections.map(fc => {
                  const s = fileNodes[fc.source]
                  const t = fileNodes[fc.target]
                  if (!s || !t || !s.visible || !t.visible) return null
                  const sx = s.position.x + s.size.width/2
                  const sy = s.position.y + s.size.height
                  const tx = t.position.x + t.size.width/2
                  const ty = t.position.y
                  const midY = (sy + ty)/2
                  const path = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`
                  return <path key={fc.id} d={path} fill="none" stroke="#6366F1" strokeWidth={3} markerEnd="url(#arrowhead)" opacity={0.9} />
                })}
                {Object.values(fileNodes).filter(n=>n.visible).map(node => {
                  const isDir = node.type === 'directory'
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.position.x}, ${node.position.y})`}
                      className="cursor-pointer"
                      onClick={() => {
                        if (isDir) {
                          toggleDirectory(node.id === 'root' ? '' : node.path)
                        } else {
                          openGitHubPath(node.path)
                        }
                      }}
                      onDoubleClick={() => { if (isDir) toggleDirectory(node.id === 'root' ? '' : node.path) }}
                    >
                      <title>{isDir ? 'Click to expand/collapse' : 'Open on GitHub'}</title>
                      <rect
                        width={node.size.width}
                        height={node.size.height}
                        rx={12}
                        fill={isDir ? node.color : '#F3F4F6'}
                        stroke={isDir ? '#1E40AF' : '#6B7280'}
                        strokeWidth={isDir ? 2.5 : 1.5}
                        className="transition-all duration-200 hover:shadow-lg"
                      />
                      <text x={node.size.width/2} y={node.size.height/2 - 4} textAnchor="middle" style={{ fontSize: '14px', fontWeight: 600, fill: isDir ? '#FFFFFF' : '#111827' }}>
                        {node.id === 'root' ? 'Un-Repo' : node.name}
                      </text>
                      <text x={node.size.width/2} y={node.size.height/2 + 14} textAnchor="middle" style={{ fontSize: '11px', fill: isDir ? '#DBEAFE' : '#4B5563' }}>
                        {isDir ? (node.expanded ? 'collapse' : 'expand') : 'file'}
                      </text>
                    </g>
                  )
                })}
              </>
            </svg>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
