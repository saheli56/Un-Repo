import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  ConnectionLineType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GitHubRepo, RepoAnalysis, FileNode, WorkflowNode, WorkflowEdge } from '@/types'
import { Network, Eye, ZoomIn, Loader2, ExternalLink, GitBranch, AlertCircle, RefreshCw } from 'lucide-react'
import { astAnalyzer } from '@/lib/ast-analyzer'
import { UniversalAnalyzer } from '@/lib/universal-analyzer'

interface RepoVisualizerProps {
  repo: GitHubRepo
  analysis: RepoAnalysis
  onNodeSelect: (file: FileNode) => void
}

type ViewMode = 'simple' | 'detailed' | 'full'
type RevealMode = 'progressive' | 'full-graph'

interface WorkflowData {
  nodes: Node[]
  edges: Edge[]
  workflowNodes: WorkflowNode[]
  workflowEdges: WorkflowEdge[]
  isLoading: boolean
  error?: string
  language?: string
  frameworks?: string[]
  analysisType?: 'ast' | 'structure'
  statistics: {
    totalNodes: number
    totalEdges: number
    entryPoints: number
    clusters: number
    avgComplexity: number
  }
}

// Enhanced node types with better styling
const createFlowNode = (workflowNode: WorkflowNode): Node => {
  const getNodeStyle = (node: WorkflowNode) => {
    const baseStyle = {
      border: '2px solid',
      borderRadius: '12px',
      padding: '12px 16px',
      fontSize: '13px',
      fontWeight: '600',
      minWidth: '140px',
      maxWidth: '200px',
      textAlign: 'center' as const,
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      transition: 'all 0.2s ease',
    }

    const typeStyles = {
      entry: {
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        color: 'white',
        borderColor: '#b91c1c',
        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
      },
      component: {
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        color: 'white',
        borderColor: '#1d4ed8',
        boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
      },
      service: {
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: 'white',
        borderColor: '#047857',
        boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
      },
      utility: {
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        color: 'white',
        borderColor: '#b45309',
        boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
      },
      config: {
        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        color: 'white',
        borderColor: '#6d28d9',
        boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
      },
      test: {
        background: 'linear-gradient(135deg, #ec4899, #db2777)',
        color: 'white',
        borderColor: '#be185d',
        boxShadow: '0 4px 20px rgba(236, 72, 153, 0.4)',
      },
      type: {
        background: 'linear-gradient(135deg, #6b7280, #4b5563)',
        color: 'white',
        borderColor: '#374151',
        boxShadow: '0 4px 20px rgba(107, 114, 128, 0.4)',
      },
    }

    return {
      ...baseStyle,
      ...typeStyles[node.type],
    }
  }

  const getNodeIcon = (type: string) => {
    const icons = {
      entry: '🚀',
      component: '⚛️',
      service: '🔧',
      utility: '🛠️',
      config: '⚙️',
      test: '🧪',
      type: '📝',
    }
    return icons[type as keyof typeof icons] || '📄'
  }

  return {
    id: workflowNode.id,
    type: 'default',
    position: workflowNode.position,
    data: {
      label: (
        <div className="text-center">
          <div className="text-lg mb-1">{getNodeIcon(workflowNode.type)}</div>
          <div className="font-semibold text-xs">{workflowNode.name}</div>
          <div className="text-xs opacity-80 mt-1">{workflowNode.role}</div>
          {workflowNode.complexity > 10 && (
            <div className="text-xs mt-1 bg-warning-muted text-warning-muted-foreground rounded px-1">
              Complex: {workflowNode.complexity}
            </div>
          )}
        </div>
      ),
      workflowNode,
      githubUrl: workflowNode.githubUrl,
    },
    style: getNodeStyle(workflowNode),
  }
}

// Enhanced edge styling with validation
const createFlowEdge = (workflowEdge: WorkflowEdge): Edge | null => {
  // Validate edge has valid source and target
  if (!workflowEdge.source || !workflowEdge.target) {
    console.warn(`⚠️ Invalid edge - missing source or target:`, workflowEdge)
    return null // This will be filtered out
  }

  if (workflowEdge.source === workflowEdge.target) {
    console.warn(`⚠️ Self-referencing edge filtered out:`, workflowEdge.id)
    return null // This will be filtered out
  }

  const getEdgeStyle = (edge: WorkflowEdge) => {
    const typeStyles = {
      import: {
        stroke: '#3b82f6',
        strokeWidth: Math.min(edge.weight * 0.5 + 1, 4),
        strokeDasharray: undefined,
      },
      call: {
        stroke: '#10b981',
        strokeWidth: Math.min(edge.weight * 0.3 + 1, 3),
        strokeDasharray: '5,5',
      },
      inheritance: {
        stroke: '#8b5cf6',
        strokeWidth: 2,
        strokeDasharray: '10,5',
      },
      composition: {
        stroke: '#f59e0b',
        strokeWidth: 2,
        strokeDasharray: undefined,
      },
      'data-flow': {
        stroke: '#ef4444',
        strokeWidth: 2,
        strokeDasharray: '3,3',
      },
      configuration: {
        stroke: '#6366f1',
        strokeWidth: 2,
        strokeDasharray: '8,4',
      },
    }

    return typeStyles[edge.type] || typeStyles.import
  }

  const edgeStyle = getEdgeStyle(workflowEdge)

  return {
    id: workflowEdge.id,
    source: workflowEdge.source,
    target: workflowEdge.target,
    type: 'smoothstep',
    label: workflowEdge.label,
    style: edgeStyle,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edgeStyle.stroke,
      width: 20,
      height: 20,
    },
    data: {
      weight: workflowEdge.weight,
      metadata: workflowEdge.metadata,
    },
  }
}

export function RepoVisualizer({ repo, analysis, onNodeSelect }: RepoVisualizerProps) {
  return (
    <ReactFlowProvider>
      <RepoVisualizerContent repo={repo} analysis={analysis} onNodeSelect={onNodeSelect} />
    </ReactFlowProvider>
  )
}

function RepoVisualizerContent({ repo, analysis, onNodeSelect }: RepoVisualizerProps) {
  const reactFlowInstance = useReactFlow()
  
  const [workflowData, setWorkflowData] = useState<WorkflowData>({
    nodes: [],
    edges: [],
    workflowNodes: [],
    workflowEdges: [],
    isLoading: true,
    statistics: {
      totalNodes: 0,
      totalEdges: 0,
      entryPoints: 0,
      clusters: 0,
      avgComplexity: 0,
    },
  })
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('full')
  const [revealMode, setRevealMode] = useState<RevealMode>('progressive')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

  // Initialize expanded nodes when switching to progressive mode
  useEffect(() => {
    if (revealMode === 'progressive' && workflowData.workflowNodes.length > 0 && expandedNodes.size === 0) {
      // Auto-expand entry points initially
      const entryPoints = workflowData.workflowNodes.filter(n => n.type === 'entry')
      if (entryPoints.length > 0) {
        setExpandedNodes(new Set([entryPoints[0].id]))
      }
    }
  }, [revealMode, workflowData.workflowNodes, expandedNodes.size])

  // Generate enhanced workflow visualization with performance optimization
  useEffect(() => {
    const generateWorkflow = async () => {
      setWorkflowData(prev => ({ ...prev, isLoading: true }))

      try {
        // Extract all files from the structure
        const getAllFiles = (node: FileNode): FileNode[] => {
          const files: FileNode[] = []
          if (node.type === 'file') {
            files.push(node)
          }
          if (node.children) {
            node.children.forEach(child => {
              files.push(...getAllFiles(child))
            })
          }
          return files
        }

        const allFiles = getAllFiles(analysis.structure)
        console.log(`📁 Total files found: ${allFiles.length}`)
        
        // Performance optimization: Limit initial processing to essential files
        const priorityFiles = allFiles
          .filter(file => {
            const path = file.path.toLowerCase()
            const name = file.name.toLowerCase()
            
            // Include entry points, configs, and important files
            return (
              // Entry points
              name.includes('main') || name.includes('index') || name.includes('app') ||
              // Config files
              name.includes('config') || name.includes('package.json') || name.includes('tsconfig') ||
              // Important directories - more inclusive
              path.includes('/src/') || path.includes('/components/') || path.includes('/lib/') ||
              path.includes('/types/') || path.includes('/utils/') ||
              // Include TypeScript and JavaScript files
              (file.extension === '.ts' || file.extension === '.tsx' || 
               file.extension === '.js' || file.extension === '.jsx') &&
              // Skip test and build files initially
              (!path.includes('/test') && !path.includes('/build') && !path.includes('/node_modules'))
            )
          })
          .slice(0, 30) // Increased limit to 30 files
        
        console.log(`🚀 Processing ${priorityFiles.length} priority files:`, priorityFiles.map(f => f.path))
        
        // Fallback: if no priority files found, take first 15 files
        const filesToProcess = priorityFiles.length > 0 ? priorityFiles : allFiles.slice(0, 15)
        console.log(`📋 Final files to process: ${filesToProcess.length}`)
        
        // Use Universal Analyzer for multi-language support
        const universalResult = await UniversalAnalyzer.analyzeRepository(repo, filesToProcess)
        
        let workflow
        if (universalResult.features.astAnalysis) {
          // For JS/TS projects, use AST analysis for detailed insights
          console.log(`🔍 Using AST analysis for ${universalResult.language}`)
          workflow = await astAnalyzer.analyzeRepository(repo, filesToProcess)
        } else {
          // For other languages, use structure-based analysis
          console.log(`🏗️ Using structure analysis for ${universalResult.language}`)
          workflow = universalResult.workflow
        }
        
        // Convert to React Flow format with validation
        const flowNodes = workflow.nodes.map(createFlowNode)
        const flowEdges = workflow.edges
          .map(createFlowEdge)
          .filter((edge): edge is Edge => edge !== null) // Filter out invalid edges

        console.log(`🎯 Generated workflow:`, {
          language: universalResult.language,
          frameworks: universalResult.frameworks,
          nodes: workflow.nodes.length,
          edges: workflow.edges.length,
          flowNodes: flowNodes.length,
          flowEdges: flowEdges.length,
          filtered: workflow.edges.length - flowEdges.length
        })

        // Calculate statistics
        const statistics = {
          totalNodes: workflow.nodes.length,
          totalEdges: workflow.edges.length,
          entryPoints: workflow.entryPoints.length,
          clusters: workflow.clusters.length,
          avgComplexity: Math.round(workflow.metrics.avgComplexity * 10) / 10,
        }

        setWorkflowData({
          nodes: flowNodes,
          edges: flowEdges,
          workflowNodes: workflow.nodes,
          workflowEdges: workflow.edges,
          isLoading: false,
          language: universalResult.language,
          frameworks: universalResult.frameworks,
          analysisType: universalResult.features.astAnalysis ? 'ast' : 'structure',
          statistics,
        })
      } catch (error) {
        console.error('Error generating workflow:', error)
        setWorkflowData(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to generate repository workflow',
        }))
      }
    }

    generateWorkflow()
  }, [repo, analysis])

  // Progressive reveal and filtering logic with enhanced validation
  const { filteredNodes, filteredEdges } = useMemo(() => {
    console.log(`🔍 Filtering with view mode: ${viewMode}, reveal mode: ${revealMode}`)
    console.log(`📊 Available: ${workflowData.nodes.length} nodes, ${workflowData.edges.length} edges`)
    
    // Create node ID set for validation
    const availableNodeIds = new Set(workflowData.nodes.map(node => node.id))
    
    if (revealMode === 'progressive') {
      // Progressive reveal logic
      console.log(`🎯 Progressive reveal - expanded: ${expandedNodes.size}, focused: ${focusedNodeId}`)
      
      const visibleNodeIds = new Set<string>()
      
      // If no nodes expanded yet, show only entry points
      if (expandedNodes.size === 0) {
        const entryPoints = workflowData.workflowNodes.filter(n => n.type === 'entry')
        if (entryPoints.length > 0) {
          entryPoints.forEach(node => visibleNodeIds.add(node.id))
        } else {
          // Fallback: show first high-importance node
          const importantNode = workflowData.workflowNodes.find(n => n.importance === 'high')
          if (importantNode) {
            visibleNodeIds.add(importantNode.id)
          } else if (workflowData.workflowNodes.length > 0) {
            visibleNodeIds.add(workflowData.workflowNodes[0].id)
          }
        }
      } else {
        // Show expanded nodes and their children
        expandedNodes.forEach(nodeId => {
          visibleNodeIds.add(nodeId)
          // Add direct dependencies
          const node = workflowData.workflowNodes.find(n => n.id === nodeId)
          if (node) {
            node.dependencies.forEach(depId => {
              if (availableNodeIds.has(depId)) {
                visibleNodeIds.add(depId)
              }
            })
          }
          // Add nodes that depend on this one
          workflowData.workflowEdges
            .filter(edge => edge.source === nodeId)
            .forEach(edge => {
              if (availableNodeIds.has(edge.target)) {
                visibleNodeIds.add(edge.target)
              }
            })
        })
      }

      // Filter nodes and apply focus styling
      const visibleNodes = workflowData.nodes
        .filter(node => visibleNodeIds.has(node.id))
        .map(node => ({
          ...node,
          style: {
            ...node.style,
            opacity: focusedNodeId && focusedNodeId !== node.id ? 0.3 : 1,
            transform: focusedNodeId === node.id ? 'scale(1.1)' : 'scale(1)',
            zIndex: focusedNodeId === node.id ? 1000 : node.style?.zIndex || 1,
          }
        }))

      // Filter edges with enhanced validation
      const visibleEdges = workflowData.edges
        .filter(edge => {
          const sourceExists = visibleNodeIds.has(edge.source)
          const targetExists = visibleNodeIds.has(edge.target)
          
          if (!sourceExists || !targetExists) {
            console.log(`🔍 Filtering out edge ${edge.id}: source=${sourceExists}, target=${targetExists}`)
            return false
          }
          
          return true
        })
        .map(edge => ({
          ...edge,
          style: {
            ...edge.style,
            opacity: focusedNodeId && edge.source !== focusedNodeId && edge.target !== focusedNodeId ? 0.3 : 1,
          }
        }))

      console.log(`✅ Progressive reveal: ${visibleNodes.length} nodes, ${visibleEdges.length} edges`)
      return { filteredNodes: visibleNodes, filteredEdges: visibleEdges }
    }
    
    // Full graph mode - validate all edges
    if (viewMode === 'full') {
      const validatedEdges = workflowData.edges.filter(edge => {
        const sourceExists = availableNodeIds.has(edge.source)
        const targetExists = availableNodeIds.has(edge.target)
        
        if (!sourceExists || !targetExists) {
          console.log(`🔍 Full graph: Filtering out invalid edge ${edge.id}: source=${sourceExists}, target=${targetExists}`)
          return false
        }
        
        return true
      })
      
      console.log(`✅ Full view: ${workflowData.nodes.length} nodes, ${validatedEdges.length} edges (filtered from ${workflowData.edges.length})`)
      return { filteredNodes: workflowData.nodes, filteredEdges: validatedEdges }
    }
    
    if (viewMode === 'simple') {
      const importantNodes = workflowData.nodes.filter(node => 
        node.data.workflowNode.importance === 'high' || 
        node.data.workflowNode.type === 'entry'
      )
      const nodesToShow = importantNodes.length > 0 ? importantNodes : workflowData.nodes.slice(0, 5)
      const importantNodeIds = new Set(nodesToShow.map(n => n.id))
      const filteredEdges = workflowData.edges.filter(edge => 
        importantNodeIds.has(edge.source) && 
        importantNodeIds.has(edge.target)
      )
      console.log(`✅ Simple view: ${nodesToShow.length} nodes, ${filteredEdges.length} edges`)
      return { filteredNodes: nodesToShow, filteredEdges }
    }
    
    if (viewMode === 'detailed') {
      const detailedNodes = workflowData.nodes.filter(node => 
        node.data.workflowNode.importance !== 'low' || 
        node.data.workflowNode.type === 'config'
      )
      const nodesToShow = detailedNodes.length >= 3 ? detailedNodes : workflowData.nodes.slice(0, 10)
      const detailedNodeIds = new Set(nodesToShow.map(n => n.id))
      const filteredEdges = workflowData.edges.filter(edge => 
        detailedNodeIds.has(edge.source) && 
        detailedNodeIds.has(edge.target)
      )
      console.log(`✅ Detailed view: ${nodesToShow.length} nodes, ${filteredEdges.length} edges`)
      return { filteredNodes: nodesToShow, filteredEdges }
    }
    
    console.log(`✅ Fallback view: ${workflowData.nodes.length} nodes, ${workflowData.edges.length} edges`)
    return { filteredNodes: workflowData.nodes, filteredEdges: workflowData.edges }
  }, [workflowData, viewMode, revealMode, expandedNodes, focusedNodeId])

  const [nodes, setNodes, onNodesChange] = useNodesState(filteredNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(filteredEdges)

  // Update nodes and edges when filtered data changes
  useEffect(() => {
    setNodes(filteredNodes)
    setEdges(filteredEdges)
  }, [filteredNodes, filteredEdges, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const workflowNode = node.data.workflowNode as WorkflowNode
      setSelectedNodeId(node.id)
      
      if (revealMode === 'progressive') {
        // Progressive mode: expand/focus nodes
        setExpandedNodes(prev => {
          const newSet = new Set(prev)
          if (newSet.has(node.id)) {
            // If already expanded, focus/unfocus it
            setFocusedNodeId(current => current === node.id ? null : node.id)
          } else {
            // Expand the node
            newSet.add(node.id)
            setFocusedNodeId(node.id)
          }
          return newSet
        })
      } else {
        // Full graph mode: just focus
        setFocusedNodeId(current => current === node.id ? null : node.id)
      }
      
      if (workflowNode.file) {
        onNodeSelect(workflowNode.file)
      }
      
      console.log(`🎯 Node clicked: ${node.id}, expanded: ${expandedNodes.has(node.id)}, focused: ${focusedNodeId === node.id}`)
    },
    [onNodeSelect, revealMode, expandedNodes, focusedNodeId]
  )

  const openInGitHub = useCallback((nodeId: string) => {
    const node = workflowData.workflowNodes.find(n => n.id === nodeId)
    if (node?.githubUrl) {
      window.open(node.githubUrl, '_blank')
    }
  }, [workflowData.workflowNodes])

  // Handler for Fit View button
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ 
      padding: 0.2,
      duration: 800,
      includeHiddenNodes: false 
    })
  }, [reactFlowInstance])

  // Handler for Focus button
  const handleFocus = useCallback(() => {
    if (selectedNodeId && focusedNodeId !== selectedNodeId) {
      // Focus on selected node
      setFocusedNodeId(selectedNodeId)
      
      // Get the node to focus on
      const nodeToFocus = nodes.find(n => n.id === selectedNodeId)
      if (nodeToFocus) {
        // Center the view on the focused node with smooth animation
        reactFlowInstance.fitView({
          nodes: [nodeToFocus],
          padding: 0.3,
          duration: 800,
        })
        
        // Optional: Add a temporary highlight effect
        setTimeout(() => {
          const nodeElement = document.querySelector(`[data-id="${selectedNodeId}"]`)
          if (nodeElement) {
            nodeElement.classList.add('animate-pulse')
            setTimeout(() => {
              nodeElement.classList.remove('animate-pulse')
            }, 1000)
          }
        }, 500)
      }
    } else if (focusedNodeId) {
      // Clear focus and return to full view
      setFocusedNodeId(null)
      handleFitView()
    } else if (nodes.length > 0) {
      // Smart focus: try to find the most relevant node
      let nodeToFocus = nodes.find(n => n.data?.type === 'entry') // Entry point
      
      if (!nodeToFocus) {
        // Try to find a node with high importance
        nodeToFocus = nodes.find(n => n.data?.importance === 'high')
      }
      
      if (!nodeToFocus) {
        // Fallback to first node
        nodeToFocus = nodes[0]
      }
      
      if (nodeToFocus) {
        setSelectedNodeId(nodeToFocus.id)
        setFocusedNodeId(nodeToFocus.id)
        reactFlowInstance.fitView({
          nodes: [nodeToFocus],
          padding: 0.3,
          duration: 800,
        })
      }
    }
  }, [selectedNodeId, focusedNodeId, nodes, reactFlowInstance, handleFitView, setSelectedNodeId, setFocusedNodeId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when the visualizer is in focus
      if (document.activeElement?.closest('.react-flow')) {
        if (event.key === 'f' || event.key === 'F') {
          event.preventDefault()
          handleFitView()
        } else if (event.key === 'c' || event.key === 'C') {
          event.preventDefault()
          handleFocus()
        } else if (event.key === 'Escape') {
          if (focusedNodeId) {
            setFocusedNodeId(null)
            handleFitView()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleFitView, handleFocus, focusedNodeId, setFocusedNodeId])

  if (workflowData.isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full flex items-center justify-center"
      >
        <Card className="p-8">
          <CardContent className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-lg font-semibold">Analyzing Repository Structure</div>
            <div className="text-sm text-muted-foreground">
              Processing priority files for optimal performance...
            </div>
            <div className="text-xs text-muted-foreground">
              AST parsing • Workflow analysis • Dependency mapping
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (workflowData.error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full flex items-center justify-center"
      >
        <Card className="p-8 max-w-2xl">
          <CardContent className="text-center space-y-4">
            <div className="text-xl font-semibold text-destructive mb-2 flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6" />
              Workflow Analysis Unavailable
            </div>
            <div className="text-muted-foreground space-y-3">
              <p>{workflowData.error}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
                <div className="font-semibold mb-2">💡 For Large Repositories</div>
                <ul className="text-sm space-y-1 text-left">
                  <li>• Try the <strong>Interactive</strong> tab instead for better performance</li>
                  <li>• Use the <strong>Architecture</strong> view to see component relationships</li>
                  <li>• Large repos (200+ files) are automatically optimized</li>
                  <li>• Some analysis features may be simplified for performance</li>
                </ul>
              </div>
              <div className="flex justify-center gap-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Analysis
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (!workflowData.isLoading && filteredNodes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full flex items-center justify-center"
      >
        <Card className="p-8">
          <CardContent className="text-center">
            <div className="text-lg font-semibold mb-2">No Workflow Found</div>
            <div className="text-sm text-muted-foreground mb-4">
              No nodes were generated from the repository analysis.
            </div>
            <div className="text-xs text-muted-foreground mb-4">
              Available: {workflowData.nodes.length} total nodes, {workflowData.edges.length} edges
            </div>
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Retry Analysis
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
    >
      {/* Enhanced Header */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Advanced Repository Workflow
              <span className="text-sm font-normal text-muted-foreground">
                (AST-Powered Analysis)
              </span>
            </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Display Mode:</span>
                  <Button
                    variant={revealMode === 'progressive' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setRevealMode('progressive')
                      setExpandedNodes(new Set())
                      setFocusedNodeId(null)
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Progressive
                  </Button>
                  <Button
                    variant={revealMode === 'full-graph' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRevealMode('full-graph')}
                  >
                    <Network className="h-4 w-4 mr-1" />
                    Full Graph
                  </Button>
                  
                  {revealMode === 'progressive' && expandedNodes.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setExpandedNodes(new Set())
                        setFocusedNodeId(null)
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </div>
                
                {revealMode === 'full-graph' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Complexity:</span>
                    <Button
                      variant={viewMode === 'simple' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('simple')}
                    >
                      Simple
                    </Button>
                    <Button
                      variant={viewMode === 'detailed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('detailed')}
                    >
                      Detailed
                    </Button>
                    <Button
                      variant={viewMode === 'full' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('full')}
                    >
                      <ZoomIn className="h-4 w-4 mr-1" />
                      Full
                    </Button>
                  </div>
                )}
                
                {/* Mode help text */}
                <div className="text-xs text-muted-foreground">
                  {revealMode === 'progressive' && expandedNodes.size === 0 && '→ Start: Click entry points to expand'}
                  {revealMode === 'progressive' && expandedNodes.size > 0 && `→ ${expandedNodes.size} nodes expanded | Click to explore more`}
                  {revealMode === 'full-graph' && viewMode === 'simple' && '→ Essential workflow only'}
                  {revealMode === 'full-graph' && viewMode === 'detailed' && '→ Important files and connections'}
                  {revealMode === 'full-graph' && viewMode === 'full' && '→ All files and dependencies'}
                </div>
              </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {/* Legend */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600"></div>
                <span>Entry Points</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
                <span>Components</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-green-600"></div>
                <span>Services</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600"></div>
                <span>Utilities</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-violet-600"></div>
                <span>Config</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Focus status indicator */}
              {focusedNodeId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 px-3 py-1 bg-info-muted text-info-foreground rounded-full text-xs font-medium"
                >
                  <Eye className="h-3 w-3" />
                  <span>Focused</span>
                </motion.div>
              )}
              
              {selectedNodeId && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => openInGitHub(selectedNodeId)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View on GitHub
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleFitView}
                className="cursor-pointer hover:scale-105 transition-transform duration-200"
                title="Fit all nodes into view (Press F)"
              >
                <ZoomIn className="h-4 w-4 mr-1" />
                Fit View
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleFocus}
                className={`cursor-pointer hover:scale-105 transition-transform duration-200 ${
                  focusedNodeId ? 'bg-info text-info-foreground border-info' : ''
                }`}
                title={focusedNodeId ? "Clear focus and show all nodes (Press C or Esc)" : "Focus on selected node (Press C)"}
              >
                <Eye className="h-4 w-4 mr-1" />
                {focusedNodeId ? 'Clear Focus' : 'Focus'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced React Flow Visualization */}
      <Card className="flex-1">
        {/* Debug Panel */}
        {process.env.NODE_ENV === 'development' && (
          <div className="p-2 bg-muted/30 border-b text-xs">
            <details className="cursor-pointer">
              <summary className="font-medium">🔍 Debug Info</summary>
              <div className="mt-2 space-y-1">
                <div>Nodes: {filteredNodes.length} visible / {workflowData.nodes.length} total</div>
                <div>Edges: {filteredEdges.length} visible / {workflowData.edges.length} total</div>
                <div>Mode: {viewMode} | Reveal: {revealMode}</div>
                <div>Expanded: {expandedNodes.size} | Focused: {focusedNodeId || 'none'}</div>
                {filteredEdges.length > 0 && (
                  <details>
                    <summary>Edge Details</summary>
                    <div className="ml-2 mt-1 max-h-20 overflow-y-auto text-xs">
                      {filteredEdges.slice(0, 10).map(edge => (
                        <div key={edge.id} className="truncate">
                          {edge.source} → {edge.target} ({edge.label})
                        </div>
                      ))}
                      {filteredEdges.length > 10 && <div>... and {filteredEdges.length - 10} more</div>}
                    </div>
                  </details>
                )}
              </div>
            </details>
          </div>
        )}
        
        <CardContent className="p-0 h-full">
          <div className="h-[600px] w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              fitView
              className="bg-background"
              defaultEdgeOptions={{
                animated: true,
                style: { strokeWidth: 2 },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 20,
                  height: 20,
                },
              }}
              connectionLineType={ConnectionLineType.SmoothStep}
              connectionLineStyle={{
                strokeWidth: 3,
                stroke: 'hsl(var(--primary))',
              }}
            >
              <Controls 
                className="bg-card border shadow-lg"
                style={{ 
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))'
                }}
              />
              <MiniMap 
                className="bg-card border shadow-lg"
                style={{ 
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))'
                }}
                nodeColor={(node) => {
                  const workflowNode = node.data?.workflowNode as WorkflowNode
                  if (workflowNode) {
                    const colors = {
                      entry: '#ef4444',
                      component: '#3b82f6',
                      service: '#10b981',
                      utility: '#f59e0b',
                      config: '#8b5cf6',
                      test: '#ec4899',
                      type: '#6b7280',
                    }
                    return colors[workflowNode.type] || '#64748b'
                  }
                  return '#64748b'
                }}
                maskColor="rgba(0, 0, 0, 0.1)"
              />
              <Background 
                variant={BackgroundVariant.Dots} 
                gap={16} 
                size={1}
                color="hsl(var(--border))"
              />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Statistics Panel */}
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-6 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{workflowData.statistics.totalNodes}</div>
              <div className="text-sm text-muted-foreground">Files Analyzed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-info">{workflowData.statistics.totalEdges}</div>
              <div className="text-sm text-muted-foreground">Dependencies</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-error">{workflowData.statistics.entryPoints}</div>
              <div className="text-sm text-muted-foreground">Entry Points</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-success">{workflowData.statistics.clusters}</div>
              <div className="text-sm text-muted-foreground">Clusters</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-warning">{workflowData.statistics.avgComplexity}</div>
              <div className="text-sm text-muted-foreground">Avg Complexity</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-violet-500">
                <GitBranch className="h-6 w-6 mx-auto" />
              </div>
              <div className="text-sm text-muted-foreground">Workflow Ready</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language & Framework Information */}
      {workflowData.language && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <div className="text-lg font-semibold text-primary">
                    {workflowData.language.charAt(0).toUpperCase() + workflowData.language.slice(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Primary Language ({workflowData.analysisType === 'ast' ? 'Full AST Analysis' : 'Structure Analysis'})
                  </div>
                </div>
                {workflowData.frameworks && workflowData.frameworks.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {workflowData.frameworks.map((framework, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {framework}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Multi-language Support Active
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Node Details */}
      {selectedNodeId && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Node Details</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const selectedNode = workflowData.workflowNodes.find(n => n.id === selectedNodeId)
              if (!selectedNode) return null

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{selectedNode.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedNode.role}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">Complexity: {selectedNode.complexity}</div>
                      <div className="text-xs text-muted-foreground">
                        Importance: {selectedNode.importance}
                      </div>
                    </div>
                  </div>
                  
                  {selectedNode.astInfo && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Functions</div>
                        <div className="text-muted-foreground">
                          {selectedNode.astInfo.functions.length}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Classes</div>
                        <div className="text-muted-foreground">
                          {selectedNode.astInfo.classes.length}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Imports</div>
                        <div className="text-muted-foreground">
                          {selectedNode.astInfo.imports.length}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => openInGitHub(selectedNodeId)}
                      className="flex-1"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View on GitHub
                    </Button>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
