import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileNode, GitHubRepo } from '@/types'
import { 
  Network, 
  RotateCcw,
  Zap,
  Eye,
  Layers
} from 'lucide-react'

interface NetworkNode extends FileNode {
  x: number
  y: number
  connections: string[]
  level: number
  visible: boolean
  expanded: boolean
  importance: number
  parentId?: string
  isEntryPoint?: boolean
}

interface Connection {
  source: string
  target: string
  type: 'parent-child' | 'import' | 'sibling'
  strength: number
}

interface FileNetworkProps {
  repo: GitHubRepo
  structure: FileNode
  onFileSelect: (file: FileNode) => void
  selectedFile?: FileNode | null
}

export function FileNetwork({ repo, structure, onFileSelect, selectedFile }: FileNetworkProps) {
  const [nodes, setNodes] = useState<Map<string, NetworkNode>>(new Map())
  const [connections, setConnections] = useState<Connection[]>([])
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [progressiveMode, setProgressiveMode] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgDimensions, setSvgDimensions] = useState({ width: 800, height: 600 })

  // Find entry point nodes (main files, index files, package.json, etc.)
  const findEntryPoints = useCallback((node: FileNode): FileNode[] => {
    const entryPoints: FileNode[] = []
    
    const checkNode = (currentNode: FileNode) => {
      const fileName = currentNode.name.toLowerCase()
      const isEntryPoint = fileName === 'package.json' ||
                          fileName === 'readme.md' ||
                          fileName.includes('index') ||
                          fileName.includes('main') ||
                          fileName.includes('app') ||
                          (currentNode.type === 'directory' && currentNode.depth <= 1)
      
      if (isEntryPoint) {
        entryPoints.push(currentNode)
      }
      
      if (currentNode.children) {
        currentNode.children.forEach(checkNode)
      }
    }
    
    checkNode(node)
    
    // If no clear entry points found, use the root and its immediate children
    if (entryPoints.length === 0) {
      entryPoints.push(node)
      if (node.children) {
        entryPoints.push(...node.children.slice(0, 3)) // Top 3 children
      }
    }
    
    return entryPoints.slice(0, 5) // Limit to 5 entry points
  }, [])

  // Calculate node importance based on file type and location
  const calculateImportance = useCallback((node: FileNode): number => {
    const fileName = node.name.toLowerCase()
    const path = node.path.toLowerCase()

    if (fileName === 'package.json' || fileName === 'readme.md') return 10
    if (fileName.includes('index') || fileName.includes('main') || fileName.includes('app')) return 9
    if (path.includes('/src/') && node.depth <= 3) return 8
    if (node.type === 'directory' && node.depth <= 2) return 7
    if (fileName.includes('config') || fileName.includes('types')) return 6
    if (node.extension === '.ts' || node.extension === '.tsx') return 5
    if (node.extension === '.js' || node.extension === '.jsx') return 4

    return Math.max(1, 5 - node.depth)
  }, [])

  // Create network nodes with progressive visibility
  const createNetworkNodes = useCallback((root: FileNode): Map<string, NetworkNode> => {
    const networkNodes = new Map<string, NetworkNode>()
    const entryPoints = findEntryPoints(root)
    const entryPointIds = new Set(entryPoints.map(ep => ep.id))
    
    const processNode = (node: FileNode, level: number = 0, parentId?: string, angle: number = 0): void => {
      const importance = calculateImportance(node)
      const isEntryPoint = entryPointIds.has(node.id)
      
      // Calculate position based on level and angle
      const centerX = svgDimensions.width / 2
      const centerY = svgDimensions.height / 2
      const radius = Math.max(80, 200 - level * 60)
      
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius

      const networkNode: NetworkNode = {
        ...node,
        x,
        y,
        connections: parentId ? [parentId] : [],
        level,
        visible: progressiveMode ? (isEntryPoint || level === 0) : true,
        expanded: false,
        importance,
        parentId,
        isEntryPoint
      }

      networkNodes.set(node.id, networkNode)

      // Process children
      if (node.children && node.children.length > 0) {
        const angleStep = (Math.PI * 2) / Math.max(node.children.length, 1)
        const startAngle = angle - (angleStep * (node.children.length - 1)) / 2

        node.children.forEach((child, index) => {
          const childAngle = startAngle + angleStep * index
          processNode(child, level + 1, node.id, childAngle)
        })
      }
    }

    processNode(root)
    return networkNodes
  }, [findEntryPoints, calculateImportance, progressiveMode, svgDimensions])

  // Create connections between nodes
  const createConnections = useCallback((networkNodes: Map<string, NetworkNode>): Connection[] => {
    const connections: Connection[] = []

    networkNodes.forEach((node, nodeId) => {
      // Parent-child connections
      if (node.parentId) {
        connections.push({
          source: node.parentId,
          target: nodeId,
          type: 'parent-child',
          strength: 1
        })
      }

      // Sibling connections (same parent)
      if (node.parentId) {
        const siblings = Array.from(networkNodes.values()).filter(
          other => other.parentId === node.parentId && other.id !== nodeId
        )

        siblings.slice(0, 2).forEach(sibling => { // Limit sibling connections
          connections.push({
            source: nodeId,
            target: sibling.id,
            type: 'sibling',
            strength: 0.3
          })
        })
      }
    })

    return connections
  }, [])

  // Initialize network
  useEffect(() => {
    const networkNodes = createNetworkNodes(structure)
    const networkConnections = createConnections(networkNodes)
    
    setNodes(networkNodes)
    setConnections(networkConnections)
  }, [structure, createNetworkNodes, createConnections])

  // Handle SVG resize
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        setSvgDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Toggle progressive mode
  const toggleProgressiveMode = useCallback(() => {
    setProgressiveMode(prev => {
      const newMode = !prev
      
      // Update node visibility based on mode
      setNodes(prevNodes => {
        const newNodes = new Map(prevNodes)
        const entryPoints = findEntryPoints(structure)
        const entryPointIds = new Set(entryPoints.map(ep => ep.id))
        
        newNodes.forEach((node, nodeId) => {
          if (newMode) {
            // Progressive mode: show only entry points initially
            newNodes.set(nodeId, {
              ...node,
              visible: entryPointIds.has(nodeId) || node.level === 0 || expandedNodes.has(node.parentId || '')
            })
          } else {
            // Full mode: show all nodes
            newNodes.set(nodeId, {
              ...node,
              visible: true
            })
          }
        })
        
        return newNodes
      })
      
      if (!newMode) {
        // Reset expanded nodes when switching to full mode
        setExpandedNodes(new Set())
      }
      
      return newMode
    })
  }, [findEntryPoints, structure, expandedNodes])

  // Expand node to show its children
  const expandNode = useCallback((nodeId: string) => {
    if (!progressiveMode) return

    setExpandedNodes(prev => {
      const newExpanded = new Set(prev)
      
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId)
      } else {
        newExpanded.add(nodeId)
      }
      
      return newExpanded
    })

    // Update visibility of child nodes
    setNodes(prev => {
      const newNodes = new Map(prev)
      const targetNode = newNodes.get(nodeId)
      
      if (!targetNode) return prev

      // Mark node as expanded
      newNodes.set(nodeId, {
        ...targetNode,
        expanded: !targetNode.expanded
      })

      // Toggle visibility of direct children
      newNodes.forEach((node, id) => {
        if (node.parentId === nodeId) {
          newNodes.set(id, {
            ...node,
            visible: !targetNode.expanded
          })
        }
      })

      return newNodes
    })
  }, [progressiveMode])

  // Reset visualization
  const resetVisualization = useCallback(() => {
    const networkNodes = createNetworkNodes(structure)
    const networkConnections = createConnections(networkNodes)
    
    setNodes(networkNodes)
    setConnections(networkConnections)
    setExpandedNodes(new Set())
    setHoveredNode(null)
  }, [createNetworkNodes, createConnections, structure])

  // Get node color based on type and state
  const getNodeColor = useCallback((node: NetworkNode, isSelected: boolean, isHovered: boolean): string => {
    if (isSelected) return '#3b82f6'
    if (isHovered) return '#10b981'
    if (!node.visible) return '#6b7280'
    if (node.isEntryPoint) return '#f59e0b'
    
    if (node.type === 'directory') return '#8b5cf6'
    if (node.extension === '.ts' || node.extension === '.tsx') return '#3b82f6'
    if (node.extension === '.js' || node.extension === '.jsx') return '#f59e0b'
    if (node.name === 'package.json') return '#10b981'
    
    return '#6366f1'
  }, [])

  // Get connection color and opacity
  const getConnectionStyle = useCallback((connection: Connection): { stroke: string; opacity: number; strokeWidth: number } => {
    const baseOpacity = 0.2
    const hoveredOpacity = 0.8

    const isConnectedToHovered = hoveredNode && 
      (connection.source === hoveredNode || connection.target === hoveredNode)

    return {
      stroke: connection.type === 'parent-child' ? '#3b82f6' : 
              connection.type === 'sibling' ? '#10b981' : '#f59e0b',
      opacity: isConnectedToHovered ? hoveredOpacity : baseOpacity,
      strokeWidth: isConnectedToHovered ? 3 : connection.strength * 2
    }
  }, [hoveredNode])

  // Filter visible nodes and connections
  const visibleNodes = useMemo(() => {
    return Array.from(nodes.values()).filter(node => node.visible)
  }, [nodes])

  const visibleConnections = useMemo(() => {
    return connections.filter(conn => {
      const sourceVisible = nodes.get(conn.source)?.visible
      const targetVisible = nodes.get(conn.target)?.visible
      return sourceVisible && targetVisible
    })
  }, [connections, nodes])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Network className="h-5 w-5" />
            Interactive Network View
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={progressiveMode ? "default" : "secondary"} className="text-xs">
              {progressiveMode ? (
                <>
                  <Zap className="h-3 w-3 mr-1" />
                  Progressive
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Full View
                </>
              )}
            </Badge>
            <Badge variant="outline">
              {visibleNodes.length} nodes
            </Badge>
            <Badge variant="outline">
              {visibleConnections.length} connections
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleProgressiveMode}
              className="h-8"
              title={progressiveMode ? "Switch to Full View" : "Switch to Progressive Mode"}
            >
              {progressiveMode ? <Layers className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetVisualization}
              className="h-8"
              title="Reset visualization"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{repo.owner}/{repo.name}</span>
          {progressiveMode && (
            <Badge variant="secondary" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Click nodes to expand • {expandedNodes.size} expanded
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <div className="relative w-full h-full min-h-[500px]">
          <svg
            ref={svgRef}
            className="w-full h-full bg-gradient-to-br from-background to-muted/20"
            viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
          >
            {/* Connections */}
            <g className="connections">
              <AnimatePresence>
                {visibleConnections.map((connection, index) => {
                  const sourceNode = nodes.get(connection.source)
                  const targetNode = nodes.get(connection.target)
                  
                  if (!sourceNode || !targetNode) return null

                  const style = getConnectionStyle(connection)

                  return (
                    <motion.line
                      key={`${connection.source}-${connection.target}-${index}`}
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke={style.stroke}
                      strokeWidth={style.strokeWidth}
                      strokeOpacity={style.opacity}
                      strokeDasharray={connection.type === 'sibling' ? '5,5' : undefined}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: style.opacity }}
                      exit={{ pathLength: 0, opacity: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    />
                  )
                })}
              </AnimatePresence>
            </g>

            {/* Nodes */}
            <g className="nodes">
              <AnimatePresence>
                {visibleNodes.map((node, index) => {
                  const isSelected = selectedFile?.id === node.id
                  const isHovered = hoveredNode === node.id
                  const isExpanded = expandedNodes.has(node.id)
                  const nodeColor = getNodeColor(node, isSelected, isHovered)
                  const baseRadius = Math.max(8, Math.min(20, node.importance * 2))
                  const radius = isHovered ? baseRadius * 1.3 : baseRadius
                  const hasChildren = node.children && node.children.length > 0

                  return (
                    <motion.g 
                      key={node.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      {/* Node glow effect for entry points */}
                      {node.isEntryPoint && (
                        <motion.circle
                          cx={node.x}
                          cy={node.y}
                          r={radius + 8}
                          fill={nodeColor}
                          opacity={0.2}
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}

                      {/* Main node circle */}
                      <motion.circle
                        cx={node.x}
                        cy={node.y}
                        r={radius}
                        fill={nodeColor}
                        stroke="white"
                        strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                        className="cursor-pointer drop-shadow-sm"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        onClick={() => {
                          onFileSelect(node)
                          if (progressiveMode && node.type === 'directory' && hasChildren) {
                            expandNode(node.id)
                          }
                        }}
                      />

                      {/* Node label */}
                      <motion.text
                        x={node.x}
                        y={node.y - radius - 8}
                        textAnchor="middle"
                        className="text-xs font-medium fill-current pointer-events-none drop-shadow-sm"
                        initial={{ opacity: 0, y: node.y }}
                        animate={{ 
                          opacity: isHovered || isSelected || node.isEntryPoint ? 1 : 0.8, 
                          y: node.y - radius - 8 
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        {node.name.length > 12 ? `${node.name.slice(0, 12)}...` : node.name}
                      </motion.text>

                      {/* Expansion indicator for directories */}
                      {progressiveMode && hasChildren && (
                        <motion.g>
                          <motion.circle
                            cx={node.x + radius - 3}
                            cy={node.y - radius + 3}
                            r={6}
                            fill={isExpanded ? "#ef4444" : "#10b981"}
                            stroke="white"
                            strokeWidth={1}
                            className="cursor-pointer"
                            whileHover={{ scale: 1.2 }}
                            onClick={(e) => {
                              e.stopPropagation()
                              expandNode(node.id)
                            }}
                          />
                          <motion.text
                            x={node.x + radius - 3}
                            y={node.y - radius + 7}
                            textAnchor="middle"
                            className="text-xs font-bold fill-white pointer-events-none"
                            animate={{ rotate: isExpanded ? 45 : 0 }}
                          >
                            {isExpanded ? "−" : "+"}
                          </motion.text>
                        </motion.g>
                      )}

                      {/* Entry point indicator */}
                      {node.isEntryPoint && (
                        <motion.circle
                          cx={node.x - radius + 3}
                          cy={node.y - radius + 3}
                          r={4}
                          fill="#f59e0b"
                          stroke="white"
                          strokeWidth={1}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: index * 0.05 + 0.5 }}
                        />
                      )}
                    </motion.g>
                  )
                })}
              </AnimatePresence>
            </g>
          </svg>

          {/* Instructions overlay */}
          <motion.div 
            className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm border rounded-lg p-3 text-sm max-w-xs"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h4 className="font-medium mb-2 flex items-center gap-2">
              {progressiveMode ? (
                <>
                  <Zap className="h-4 w-4 text-blue-500" />
                  Progressive Mode
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 text-green-500" />
                  Full View Mode
                </>
              )}
            </h4>
            <ul className="space-y-1 text-muted-foreground">
              {progressiveMode ? (
                <>
                  <li>• <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1"></span> Entry points highlighted</li>
                  <li>• Click <span className="text-green-600 font-medium">+</span> to expand directories</li>
                  <li>• Click <span className="text-red-600 font-medium">−</span> to collapse</li>
                  <li>• Hover to see connections</li>
                </>
              ) : (
                <>
                  <li>• All nodes visible</li>
                  <li>• Click files to view details</li>
                  <li>• Hover for relationships</li>
                  <li>• Use reset to reorganize</li>
                </>
              )}
            </ul>
          </motion.div>

          {/* Legend */}
          <motion.div 
            className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm border rounded-lg p-3 text-xs"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span>Entry Points</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span>Directories</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>TypeScript</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                <span>JavaScript</span>
              </div>
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}
