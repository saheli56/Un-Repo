import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  Network,
  Eye,
  EyeOff,
  Move,
  Lock,
  Unlock,
  LayoutGrid,
  Shuffle
} from 'lucide-react'
import { SystemArchitecture, ArchitectureComponent, ArchitectureConnection } from '@/lib/enhanced-analyzer'

interface Position {
  x: number
  y: number
}

interface DraggableComponent extends ArchitectureComponent {
  isDragging?: boolean
  dragOffset?: Position
}

interface ArchitectureVisualizerProps {
  architecture: SystemArchitecture
  className?: string
}

// Enhanced Force simulation for perfect default layout
class ForceSimulation {
  private nodes: DraggableComponent[]
  private width: number
  private height: number

  constructor(nodes: DraggableComponent[], _connections: ArchitectureConnection[], width: number, height: number) {
    this.nodes = nodes
    // _connections parameter is kept for future use but not currently needed for layout
    this.width = width
    this.height = height
  }

  // Create perfect newcomer-friendly default layout
  applyForces(iterations: number = 50): DraggableComponent[] {
    const nodes = [...this.nodes]
    
    // Create organized default layout first
    this.createNewcomerFriendlyLayout(nodes)
    
    // Apply gentle forces for fine-tuning
    for (let i = 0; i < iterations; i++) {
      // Very gentle repulsion to prevent overlaps
      for (let j = 0; j < nodes.length; j++) {
        for (let k = j + 1; k < nodes.length; k++) {
          this.applyGentleRepulsion(nodes[j], nodes[k])
        }
      }

      // Keep nodes within bounds
      nodes.forEach(node => this.keepInBounds(node))
    }

    return nodes
  }

  private createNewcomerFriendlyLayout(nodes: DraggableComponent[]) {
    // Define clear, logical zones for each layer
    const layerConfig = {
      'external': {
        x: 80,
        y: 120,
        width: 280,
        title: 'External Services',
        color: '#FF5252',
        maxCols: 2,
        spacing: 25
      },
      'runtime': {
        x: 400,
        y: 120,
        width: 200,
        title: 'Browser Runtime',
        color: '#2196F3',
        maxCols: 1,
        spacing: 25
      },
      'development': {
        x: 650,
        y: 120,
        width: 350,
        title: 'Development Tools',
        color: '#9C27B0',
        maxCols: 3,
        spacing: 20
      },
      'static': {
        x: 80,
        y: 380,
        width: 400,
        title: 'Static Assets',
        color: '#4CAF50',
        maxCols: 3,
        spacing: 20
      },
      'source': {
        x: 520,
        y: 380,
        width: 480,
        title: 'Source Components',
        color: '#FF9800',
        maxCols: 4,
        spacing: 18
      }
    }

    // Group nodes by layer
    const layerGroups = new Map<string, DraggableComponent[]>()
    nodes.forEach(node => {
      if (!layerGroups.has(node.layer)) {
        layerGroups.set(node.layer, [])
      }
      layerGroups.get(node.layer)!.push(node)
    })

    // Position each layer in organized grid
    Object.entries(layerConfig).forEach(([layerId, config]) => {
      const layerNodes = layerGroups.get(layerId) || []
      if (layerNodes.length === 0) return

      const nodeWidth = 140
      const nodeHeight = 75
      const { x: startX, y: startY, maxCols, spacing } = config

      // Calculate grid layout
      const cols = Math.min(maxCols, layerNodes.length)

      layerNodes.forEach((node, index) => {
        const col = index % cols
        const row = Math.floor(index / cols)
        
        node.position = {
          x: startX + (col * (nodeWidth + spacing)),
          y: startY + (row * (nodeHeight + spacing))
        }
        
        node.size = { width: nodeWidth, height: nodeHeight }
      })
    })
  }

  private applyGentleRepulsion(nodeA: DraggableComponent, nodeB: DraggableComponent) {
    const dx = nodeA.position.x - nodeB.position.x
    const dy = nodeA.position.y - nodeB.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Only prevent overlaps with very gentle force
    if (distance < 100 && distance > 0) {
      const force = 50 / (distance * distance)
      const fx = (dx / distance) * force
      const fy = (dy / distance) * force
      
      nodeA.position.x += fx * 0.01
      nodeA.position.y += fy * 0.01
      nodeB.position.x -= fx * 0.01
      nodeB.position.y -= fy * 0.01
    }
  }

  private keepInBounds(node: DraggableComponent) {
    const margin = 30
    node.position.x = Math.max(margin, Math.min(this.width - node.size.width - margin, node.position.x))
    node.position.y = Math.max(100, Math.min(this.height - node.size.height - margin, node.position.y))
  }
}

export function ArchitectureVisualizer({ architecture, className = '' }: ArchitectureVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastMouseMoveRef = useRef<number>(0)
  const [scale, setScale] = useState(0.8)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedComponent, setSelectedComponent] = useState<ArchitectureComponent | null>(null)
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    new Set(architecture.layers.map(layer => layer.id))
  )
  const [highlightedConnections, setHighlightedConnections] = useState<Set<string>>(new Set())
  const [components, setComponents] = useState<DraggableComponent[]>([])
  const [dragState, setDragState] = useState<{
    isDragging: boolean
    draggedId: string | null
    startPos: Position
    startComponentPos: Position
  }>({
    isDragging: false,
    draggedId: null,
    startPos: { x: 0, y: 0 },
    startComponentPos: { x: 0, y: 0 }
  })
  const [isLayoutLocked, setIsLayoutLocked] = useState(false)
  const [autoLayout] = useState(true)
  const [isInitializing, setIsInitializing] = useState(false)
  const [draggedComponentPosition, setDraggedComponentPosition] = useState<{ x: number, y: number } | null>(null)
  const [connectionFilter, setConnectionFilter] = useState<'all' | 'imports' | 'api' | 'config' | 'build'>('all')
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null)
  const [showConnectionLabels, setShowConnectionLabels] = useState(true)
  // Route layout mode (hierarchical router -> pages) per new requirement
  const routeLayout = true
  const [syntheticConnections, setSyntheticConnections] = useState<ArchitectureConnection[]>([])

  // Build synthetic "routes to" connections and reposition nodes for hierarchical layout
  useEffect(() => {
    if (!routeLayout || components.length === 0) return
    // Identify potential router root (App.tsx / App.jsx)
    const root = components.find(c => /app\.(t|j)sx?$/i.test(c.name))
    if (!root) return
    // Candidate page components: other source layer components (excluding assets/tools) with width>0
    const pageCandidates = components.filter(c => c.id !== root.id && c.layer === 'source')
    // Layout: root centered top, pages in a horizontal row below
    const width = 1600
    const rowY = root.position.y + 160
    const pageWidth = 130
    const spacing = 40
    const totalWidth = pageCandidates.length * (pageWidth + spacing) - spacing
    const startX = (width - totalWidth) / 2
    // Position root
    root.position = { x: (width / 2) - 90, y: 80 }
    root.size = { width: 180, height: 70 }
    pageCandidates.forEach((p, idx) => {
      p.position = { x: startX + idx * (pageWidth + spacing), y: rowY }
      p.size = { width: pageWidth, height: 60 }
    })
    // Create synthetic connections
    const synthetic: ArchitectureConnection[] = pageCandidates.map(p => ({
      id: `route-${root.id}-${p.id}`,
      source: root.id,
      target: p.id,
      type: 'import',
      label: 'routes to',
      description: `Router renders ${p.name}`,
      style: 'dashed',
      color: '#64748B'
    }))
    setSyntheticConnections(synthetic)
    // Update components state to trigger re-render with new positions
    setComponents([...components])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components.length])

  // Initialize components with stable positioning to prevent glitching
  useEffect(() => {
    // Skip if currently dragging - NEVER re-initialize during drag operations
    if (dragState.isDragging) {
      return
    }

    // Prevent re-initialization if components already exist and are stable
    if (components.length === architecture.components.length && !isInitializing) {
      return
    }

    // Skip if currently initializing to prevent cascading updates
    if (isInitializing) {
      return
    }

    // Debounce initialization to prevent rapid re-renders
    const initTimeout = setTimeout(() => {
      // Set loading state to prevent glitching
      setIsInitializing(true)

      const initialComponents: DraggableComponent[] = architecture.components.map((comp) => {
        // Use FULL screen dimensions - expand the playground!
        const screenWidth = 1600 // Expanded width for more space
        const screenHeight = 900  // Expanded height for better distribution
        
        // Stable layer-based positioning without randomness
        const layerOrder = ['runtime', 'development', 'static', 'source', 'external']
        const layerIndex = layerOrder.indexOf(comp.layer)
        
        // Get components in same layer
        const sameLayerComponents = architecture.components.filter(c => c.layer === comp.layer)
        const layerComponentIndex = sameLayerComponents.indexOf(comp)
        const layerComponentCount = sameLayerComponents.length
        
        // Calculate stable grid-based positioning with more spacing
        const nodesPerRow = Math.max(1, Math.ceil(Math.sqrt(layerComponentCount)))
        const row = Math.floor(layerComponentIndex / nodesPerRow)
        const col = layerComponentIndex % nodesPerRow
        
        // Layer-based vertical distribution with MUCH more space
        const layerHeight = (screenHeight - 100) / Math.max(1, layerOrder.length)
        const layerStartY = 50 + (layerIndex * layerHeight)
        
        // Horizontal distribution within layer with generous spacing
        const nodeWidth = Math.min((screenWidth - 100) / nodesPerRow, 250)
        const nodeSpacing = nodeWidth + 80 // Much more spacing between nodes
        const layerStartX = 50 + Math.max(0, (screenWidth - 100 - (nodesPerRow * nodeSpacing)) / 2)
        
        const x = layerStartX + col * nodeSpacing
        const y = layerStartY + row * 110 // More vertical spacing too
        
        return {
          ...comp,
          position: { 
            x: Math.max(30, Math.min(x, screenWidth - comp.size.width - 30)), 
            y: Math.max(30, Math.min(y, screenHeight - comp.size.height - 30))
          },
          isDragging: false
        }
      })

      // Apply force simulation only on first load for better default layout
      if (autoLayout && !isLayoutLocked && components.length === 0) {
        try {
          const simulation = new ForceSimulation(initialComponents, architecture.connections, 1600, 950)
          const optimizedComponents = simulation.applyForces(30) // Fewer iterations for stability
          setComponents(optimizedComponents)
        } catch (error) {
          console.warn('Force simulation failed, using grid layout:', error)
          setComponents(initialComponents)
        }
      } else {
        setComponents(initialComponents)
      }

      // Clear loading state after initialization
      setTimeout(() => setIsInitializing(false), 100)
    }, 50) // 50ms debounce

    return () => clearTimeout(initTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [architecture.components.length, architecture.connections.length]) // Only re-init when component count changes

  // Handle zoom
  const handleZoom = (delta: number) => {
    setScale(prev => Math.max(0.1, Math.min(3, prev + delta)))
  }

  // Handle reset view
  const handleReset = () => {
    setScale(0.8)
    setPan({ x: 0, y: 0 })
    setSelectedComponent(null)
    setHighlightedConnections(new Set())
  }

  // Auto layout function
  const applyAutoLayout = useCallback(() => {
    if (isLayoutLocked) return
    
    const simulation = new ForceSimulation(components, architecture.connections, 1400, 800)
    const optimizedComponents = simulation.applyForces(100)
    setComponents(optimizedComponents)
  }, [components, architecture.connections, isLayoutLocked])

  // Shuffle layout
  const shuffleLayout = useCallback(() => {
    if (isLayoutLocked) return
    
    const shuffledComponents = components.map(comp => ({
      ...comp,
      position: {
        x: 100 + Math.random() * 1200,
        y: 100 + Math.random() * 600
      }
    }))
    setComponents(shuffledComponents)
  }, [components, isLayoutLocked])

  // Handle component click
  const handleComponentClick = (component: ArchitectureComponent) => {
    if (dragState.isDragging) return
    
    setSelectedComponent(component)
    
    // Highlight related connections
    const relatedConnections = architecture.connections.filter(
      conn => conn.source === component.id || conn.target === component.id
    )
    setHighlightedConnections(new Set(relatedConnections.map(conn => conn.id)))
  }

  // Mouse event handlers for dragging with smooth animation
  const handleMouseDown = useCallback((e: React.MouseEvent, component: DraggableComponent) => {
    if (isLayoutLocked) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return

    const mouseX = (e.clientX - svgRect.left) / scale + pan.x
    const mouseY = (e.clientY - svgRect.top) / scale + pan.y

    // Add smooth transition class
    setComponents(prev => prev.map(comp => 
      comp.id === component.id 
        ? { ...comp, isDragging: true }
        : comp
    ))

    setDragState({
      isDragging: true,
      draggedId: component.id,
      startPos: { x: mouseX, y: mouseY },
      startComponentPos: { x: component.position.x, y: component.position.y }
    })
  }, [scale, pan, isLayoutLocked])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.draggedId || isLayoutLocked) return

    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return

    const mouseX = (e.clientX - svgRect.left) / scale + pan.x
    const mouseY = (e.clientY - svgRect.top) / scale + pan.y

    const deltaX = mouseX - dragState.startPos.x
    const deltaY = mouseY - dragState.startPos.y

    // Throttle position updates to reduce shake - only update every 16ms (60fps)
    const now = Date.now()
    if (now - lastMouseMoveRef.current < 16) return
    lastMouseMoveRef.current = now

    // Use dragged position if this component is being dragged
    const newX = Math.max(20, Math.min(1580, dragState.startComponentPos.x + deltaX)) // Full screen width
    const newY = Math.max(20, Math.min(880, dragState.startComponentPos.y + deltaY))  // Full screen height
    
    setDraggedComponentPosition({ x: newX, y: newY })
  }, [dragState, scale, pan, isLayoutLocked])

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && dragState.draggedId && draggedComponentPosition) {
      // Apply final position to the components array
      setComponents(prev => prev.map(comp => 
        comp.id === dragState.draggedId
          ? { ...comp, position: draggedComponentPosition, isDragging: false }
          : { ...comp, isDragging: false }
      ))
    } else {
      // Remove dragging state with smooth transition
      setComponents(prev => prev.map(comp => ({ ...comp, isDragging: false })))
    }
    
    // Reset drag states
    setDraggedComponentPosition(null)
    setDragState({
      isDragging: false,
      draggedId: null,
      startPos: { x: 0, y: 0 },
      startComponentPos: { x: 0, y: 0 }
    })
  }, [dragState, draggedComponentPosition])

  // Add mouse event listeners
  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp()
    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [handleMouseUp])

  // Toggle layer visibility
  const toggleLayer = (layerId: string) => {
    setVisibleLayers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(layerId)) {
        newSet.delete(layerId)
      } else {
        newSet.add(layerId)
      }
      return newSet
    })
  }

  // Export as SVG
  const handleExport = () => {
    if (!svgRef.current) return
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    
    const downloadLink = document.createElement('a')
    downloadLink.href = svgUrl
    downloadLink.download = 'architecture-diagram.svg'
    downloadLink.click()
    
    URL.revokeObjectURL(svgUrl)
  }

  // Get component color with opacity for hidden layers
  const getComponentColor = (component: ArchitectureComponent) => {
    const isVisible = visibleLayers.has(component.layer)
    const isDragged = dragState.draggedId === component.id
    const isSelected = selectedComponent?.id === component.id
    
    let baseColor = component.color
    
    // Layer-specific color enhancements
    const layerColors = {
      'runtime': '#E3F2FD',      // Light blue
      'development': '#F3E5F5',   // Light purple
      'static': '#E8F5E8',       // Light green
      'source': '#FFF3E0',       // Light orange
      'external': '#FFEBEE'      // Light red
    }
    
    baseColor = layerColors[component.layer as keyof typeof layerColors] || baseColor
    
    if (isDragged) {
      return '#FFE082' // Golden when dragging
    } else if (isSelected) {
      return '#FFCDD2' // Light red when selected
    } else if (!isVisible) {
      return `${baseColor}40` // Add transparency
    }
    
    return baseColor
  }

  // Get connection style with bright, visible colors
  const getConnectionStyle = (connection: ArchitectureConnection) => {
    const isHighlighted = highlightedConnections.has(connection.id)
    const sourceVisible = visibleLayers.has(
      components.find(c => c.id === connection.source)?.layer || ''
    )
    const targetVisible = visibleLayers.has(
      components.find(c => c.id === connection.target)?.layer || ''
    )
    const isVisible = sourceVisible && targetVisible

    // Much brighter, more visible colors
    const connectionColors = {
      'import': '#00BCD4',      // Bright cyan
      'http': '#FF5722',        // Bright orange-red
      'config': '#9C27B0',      // Bright purple
      'build': '#4CAF50',       // Bright green
      'load': '#2196F3',        // Bright blue
      'transform': '#FF9800'    // Bright orange
    }

    const baseColor = connectionColors[connection.type as keyof typeof connectionColors] || '#FF6B6B'

    return {
      strokeWidth: isHighlighted ? 4 : 3, // Thicker lines for better visibility
      strokeOpacity: isVisible ? (isHighlighted ? 1 : 0.8) : 0.2, // Higher opacity
      stroke: isHighlighted ? '#FF1744' : baseColor, // Bright red for highlights
      strokeDasharray: connection.style === 'dashed' ? '12,6' : 
                      connection.style === 'dotted' ? '4,4' : 'none'
    }
  }

  // Create smooth, curved paths for connections that avoid overlapping
  const getConnectionPath = (connection: ArchitectureConnection) => {
    const sourceComp = components.find(c => c.id === connection.source)
    const targetComp = components.find(c => c.id === connection.target)
    
    if (!sourceComp || !targetComp) return ''

    // Use dragged position if component is being dragged
    const sourcePos = (dragState.draggedId === sourceComp.id && draggedComponentPosition) 
      ? draggedComponentPosition 
      : sourceComp.position
    const targetPos = (dragState.draggedId === targetComp.id && draggedComponentPosition) 
      ? draggedComponentPosition 
      : targetComp.position

    const sourceX = sourcePos.x + sourceComp.size.width / 2
    const sourceY = sourcePos.y + sourceComp.size.height / 2
    const targetX = targetPos.x + targetComp.size.width / 2
    const targetY = targetPos.y + targetComp.size.height / 2

    // Enhanced curve calculation for better path routing
    const dx = targetX - sourceX
    const dy = targetY - sourceY
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    // Dynamic control points based on distance and direction
    const controlOffset = Math.min(dist * 0.4, 120)
    const perpOffset = Math.min(Math.abs(dx) * 0.2, 60)
    
    // Create different curve styles based on connection type
    let controlX1, controlY1, controlX2, controlY2
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal-dominant connections
      controlX1 = sourceX + (dx > 0 ? controlOffset : -controlOffset)
      controlY1 = sourceY + (dy > 0 ? perpOffset : -perpOffset)
      controlX2 = targetX - (dx > 0 ? controlOffset : -controlOffset) 
      controlY2 = targetY - (dy > 0 ? perpOffset : -perpOffset)
    } else {
      // Vertical-dominant connections
      controlX1 = sourceX + (dx > 0 ? perpOffset : -perpOffset)
      controlY1 = sourceY + (dy > 0 ? controlOffset : -controlOffset)
      controlX2 = targetX - (dx > 0 ? perpOffset : -perpOffset)
      controlY2 = targetY - (dy > 0 ? controlOffset : -controlOffset)
    }

    return `M ${sourceX} ${sourceY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${targetX} ${targetY}`
  }

  // Educational content generators for newcomers
  const getEducationalExplanation = (component: ArchitectureComponent): string => {
    const name = component.name.toLowerCase()
    const type = component.type
    const layer = component.layer
    
    // Generate educational explanations based on component characteristics
    if (layer === 'runtime' && type === 'browser') {
      return "This is where your application actually runs! The browser downloads your code, parses it, and executes it to create the interactive experience users see. Think of it as the stage where your code performs."
    }
    
    if (layer === 'source' && (name.includes('app') || name.includes('main'))) {
      return "This is your application's starting point - like the main entrance to a building. All other components are loaded and orchestrated from here. When users visit your site, this is the first code that runs."
    }
    
    if (layer === 'source' && name.includes('.tsx')) {
      return "This is a React component written in TypeScript! It's like a building block of your user interface. React components are reusable pieces of code that render specific parts of your app (like buttons, forms, or entire pages)."
    }
    
    if (layer === 'source' && name.includes('.jsx')) {
      return "This is a React component! Think of it as a custom LEGO block for your user interface. It contains both the structure (HTML-like JSX) and behavior (JavaScript) for a specific part of your app."
    }
    
    if (layer === 'development' && name.includes('vite')) {
      return "Vite is your development server and build tool! It's like having a super-fast assistant that instantly reloads your app when you make changes, bundles your code for production, and handles all the complex build processes."
    }
    
    if (layer === 'development' && name.includes('eslint')) {
      return "ESLint is your code quality guardian! It automatically scans your code for potential bugs, style inconsistencies, and best practice violations - like having a helpful teacher review your code before it goes live."
    }
    
    if (layer === 'development' && name.includes('typescript')) {
      return "TypeScript adds type safety to JavaScript! It's like having spell-check for your code - it catches errors before they happen and makes your code more predictable and maintainable."
    }
    
    if (layer === 'static' && name.includes('.css')) {
      return "This stylesheet controls how your app looks! CSS is like the paint, wallpaper, and interior design of your application - it defines colors, layouts, fonts, animations, and all visual aspects."
    }
    
    if (layer === 'static' && name.includes('.html')) {
      return "This is the foundation HTML file! It's like the frame of a house - it provides the basic structure that holds everything together. Your React components get injected into this HTML template."
    }
    
    if (layer === 'static' && (name.includes('.svg') || name.includes('.png') || name.includes('.jpg'))) {
      return "This is a visual asset like an icon, logo, or image! These files make your app visually appealing and help communicate information through graphics rather than just text."
    }
    
    if (layer === 'external') {
      return "This represents an external service or API that your app communicates with! It's like calling a friend for information - your app sends requests to get data or perform actions outside of your codebase."
    }
    
    // Default explanations based on type/layer
    if (type === 'component') {
      return "This is a code component that handles a specific functionality in your application. Components are modular pieces that can be reused and combined to build complex applications."
    }
    
    if (type === 'config') {
      return "This is a configuration file that tells other tools how to behave. Think of it as a settings file that customizes how your development tools and build processes work."
    }
    
    if (type === 'asset') {
      return "This is a static asset like an image, font, or media file. These files are served directly to users and help make your application visually appealing and functional."
    }
    
    return "This component plays a specific role in your application's ecosystem. Click on connected components to understand how they work together!"
  }

  const getArchitecturalRole = (component: ArchitectureComponent): string => {
    const connections = architecture.connections.filter(c => 
      c.source === component.id || c.target === component.id
    )
    const incoming = connections.filter(c => c.target === component.id).length
    const outgoing = connections.filter(c => c.source === component.id).length
    
    if (incoming === 0 && outgoing > 0) {
      return `🌟 Entry Point: This component initiates processes and doesn't depend on other components. It's a starting point in your application flow, making ${outgoing} connections to other parts.`
    }
    
    if (incoming > 0 && outgoing === 0) {
      return `🎯 End Point: This component receives input from ${incoming} other components but doesn't pass data forward. It's likely a final destination like a UI display or external service.`
    }
    
    if (incoming > 2 && outgoing > 2) {
      return `🔄 Hub Component: This is a central piece of your architecture! It receives data from ${incoming} components and distributes it to ${outgoing} others. It's likely a critical part of your app's data flow.`
    }
    
    if (incoming > outgoing) {
      return `📥 Aggregator: This component collects information from ${incoming} sources and processes it, sending results to ${outgoing} destinations. It's likely consolidating or transforming data.`
    }
    
    if (outgoing > incoming) {
      return `📤 Distributor: This component takes input from ${incoming} sources and spreads it to ${outgoing} destinations. It's likely broadcasting or routing information throughout your app.`
    }
    
    if (connections.length === 0) {
      return `🏝️ Isolated Component: This component currently has no connections visible in this view. It might be a standalone utility, or connections might be filtered out.`
    }
    
    return `🔗 Connected Component: This component has ${incoming} incoming and ${outgoing} outgoing connections, making it an integrated part of your application's data flow.`
  }

  // Combine real architecture connections with synthetic route connections (when enabled)
  // This ensures we still display ALL original relationships while overlaying the simplified "routes to" hierarchy.
  const allConnections: ArchitectureConnection[] = routeLayout 
    ? (() => {
        const merged: Record<string, ArchitectureConnection> = {}
        architecture.connections.forEach(c => { merged[c.id] = c })
        syntheticConnections.forEach(c => { merged[c.id] = c })
        return Object.values(merged)
      })()
    : architecture.connections

  return (
    <div className={`w-full ${className}`}>
      {/* Enhanced Controls */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Network className="h-5 w-5" />
            Interactive System Architecture
            {dragState.isDragging && (
              <Badge variant="secondary" className="ml-2">
                <Move className="h-3 w-3 mr-1" />
                Dragging
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enhanced Controls Row 1 */}
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleZoom(0.1)}
                className="px-2"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleZoom(-0.1)}
                className="px-2"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                className="px-2"
                title="Reset View"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={isLayoutLocked ? "default" : "outline"}
                onClick={() => setIsLayoutLocked(!isLayoutLocked)}
                className="px-2"
                title={isLayoutLocked ? "Unlock Layout" : "Lock Layout"}
              >
                {isLayoutLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={applyAutoLayout}
                disabled={isLayoutLocked}
                className="px-2"
                title="Auto Layout"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={shuffleLayout}
                disabled={isLayoutLocked}
                className="px-2"
                title="Shuffle Layout"
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              className="px-2"
              title="Export as SVG"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>

          {/* Connection Controls - NEW UX ENHANCEMENT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              <span className="text-sm font-medium">Connection Visibility</span>
              <Badge variant="outline" className="ml-auto">
                {connectionFilter === 'all' ? 'All' : connectionFilter}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All', icon: '🔗' },
                { key: 'imports', label: 'Imports', icon: '📦' },
                { key: 'api', label: 'API Calls', icon: '🌐' },
                { key: 'config', label: 'Config', icon: '⚙️' },
                { key: 'build', label: 'Build', icon: '🔧' }
              ].map(filter => (
                <Button
                  key={filter.key}
                  size="sm"
                  variant={connectionFilter === filter.key ? "default" : "outline"}
                  onClick={() => setConnectionFilter(filter.key as 'all' | 'imports' | 'api' | 'config' | 'build')}
                  className="px-3 text-xs h-8"
                >
                  <span className="mr-1">{filter.icon}</span>
                  {filter.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={showConnectionLabels ? "default" : "outline"}
                onClick={() => setShowConnectionLabels(!showConnectionLabels)}
                className="px-3 text-xs h-8"
              >
                {showConnectionLabels ? '🏷️ Labels On' : '🏷️ Labels Off'}
              </Button>
            </div>
          </div>

          {/* Layer Controls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span className="text-sm font-medium">Architecture Layers</span>
              <Badge variant="outline" className="ml-auto">
                {visibleLayers.size}/{architecture.layers.length} visible
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {architecture.layers.map(layer => (
                <Button
                  key={layer.id}
                  size="sm"
                  variant={visibleLayers.has(layer.id) ? "default" : "outline"}
                  onClick={() => toggleLayer(layer.id)}
                  className="px-3 text-xs h-8"
                >
                  {visibleLayers.has(layer.id) ? (
                    <Eye className="h-3 w-3 mr-1" />
                  ) : (
                    <EyeOff className="h-3 w-3 mr-1" />
                  )}
                  {layer.name}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {components.filter(c => c.layer === layer.id).length}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Enhanced Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-xl text-blue-600">{components.length}</div>
              <div className="text-muted-foreground">Components</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-xl text-purple-600">{architecture.connections.length}</div>
              <div className="text-muted-foreground">Connections</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-xl text-green-600">{architecture.apiCalls.length}</div>
              <div className="text-muted-foreground">API Calls</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-xl text-orange-600">{architecture.buildTools.length}</div>
              <div className="text-muted-foreground">Build Tools</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-xl text-red-600">{visibleLayers.size}</div>
              <div className="text-muted-foreground">Active Layers</div>
            </div>
          </div>

          {/* (Interaction tips removed as requested) */}
        </CardContent>
      </Card>

      {/* Main Visualization */}
      <Card>
        <CardContent className="p-0">
          <div 
            ref={containerRef}
            className="relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-green-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
          >
            {/* Loading overlay to prevent glitching */}
            {isInitializing && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-sm text-muted-foreground">Initializing architecture layout...</p>
                </div>
              </div>
            )}
            <svg
              ref={svgRef}
              width="100%"
              height="950"
              viewBox={`${-pan.x} ${-pan.y} ${1600 / scale} ${950 / scale}`}
              className="w-full h-[950px] cursor-crosshair"
              onMouseMove={handleMouseMove}
              style={{ 
                cursor: dragState.isDragging ? 'grabbing' : 'default'
              }}
            >
              <defs>
                {/* Enhanced arrow markers */}
                <marker
                  id="arrowhead"
                  markerWidth="12"
                  markerHeight="8"
                  refX="11"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon
                    points="0 0, 12 4, 0 8"
                    fill="#666"
                    className="drop-shadow-sm"
                  />
                </marker>
                
                <marker
                  id="arrowhead-highlighted"
                  markerWidth="12"
                  markerHeight="8"
                  refX="11"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon
                    points="0 0, 12 4, 0 8"
                    fill="#FF5722"
                    className="drop-shadow-sm"
                  />
                </marker>
                
                {/* Enhanced drop shadow */}
                <filter id="dropshadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                  <feOffset dx="2" dy="2" result="offset"/>
                  <feComponentTransfer>
                    <feFuncA type="linear" slope="0.3"/>
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>

                {/* Glow effect for selected components */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Grid background */}
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1" opacity="0.3"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Clean, beginner-friendly legend - positioned top-left */}
              <g className="legend" transform="translate(20, 20)">
                <rect
                  x="0"
                  y="0"
                  width="220"
                  height="120"
                  fill="rgba(255, 255, 255, 0.98)"
                  stroke="rgba(74, 144, 226, 0.4)"
                  strokeWidth="1"
                  rx="8"
                  className="drop-shadow-sm"
                />
                
                <text
                  x="20"
                  y="22"
                  className="fill-gray-800 text-base font-bold"
                  style={{ fontSize: '14px', fontWeight: '700' }}
                >
                  � BEGINNER'S GUIDE
                </text>
                
                {/* Component types explanation */}
                <text
                  x="20"
                  y="42"
                  className="fill-gray-700 text-sm font-semibold"
                  style={{ fontSize: '12px', fontWeight: '600' }}
                >
                  Component Types:
                </text>
                
                {[
                  { emoji: '🌐', layer: 'runtime', name: 'Browser', description: 'Where your app runs', color: '#3B82F6' },
                  { emoji: '⚡', layer: 'source', name: 'Your Code', description: 'Files you wrote', color: '#F59E0B' },
                  { emoji: '🔧', layer: 'development', name: 'Dev Tools', description: 'Build & test tools', color: '#8B5CF6' },
                  { emoji: '📁', layer: 'static', name: 'Assets', description: 'Images, styles, etc.', color: '#22C55E' },
                ].map((comp, idx) => (
                  <g key={comp.layer} transform={`translate(0, ${52 + idx * 22})`}>
                    <circle
                      cx="30"
                      cy="8"
                      r="8"
                      fill={comp.color}
                      className="opacity-90"
                    />
                    <text
                      x="30"
                      y="12"
                      className="text-white text-xs font-bold"
                      textAnchor="middle"
                      style={{ fontSize: '10px' }}
                    >
                      {comp.emoji}
                    </text>
                    <text
                      x="45"
                      y="12"
                      className="fill-gray-800 text-sm font-semibold"
                      style={{ fontSize: '11px', fontWeight: '600' }}
                    >
                      {comp.name}
                    </text>
                    <text
                      x="110"
                      y="12"
                      className="fill-gray-600 text-xs"
                      style={{ fontSize: '10px' }}
                    >
                      {comp.description}
                    </text>
                  </g>
                ))}
                
                {/* Connection types explanation */}
                <text
                  x="20"
                  y="158"
                  className="fill-gray-700 text-sm font-semibold"
                  style={{ fontSize: '12px', fontWeight: '600' }}
                >
                  Connection Types:
                </text>
                
                {[
                  { type: 'imports', color: '#8B5CF6', label: 'Code Imports', description: 'One component uses another' },
                  { type: 'api', color: '#F59E0B', label: 'API Calls', description: 'Fetches data from services' },
                  { type: 'config', color: '#EF4444', label: 'Configuration', description: 'Settings and setup files' }
                ].map((conn, idx) => (
                  <g key={conn.type} transform={`translate(0, ${168 + idx * 18})`}>
                    {/* Enhanced arrow with animation hint */}
                    <line
                      x1="20"
                      y1="8"
                      x2="40"
                      y2="8"
                      stroke={conn.color}
                      strokeWidth="3"
                      markerEnd={`url(#arrowhead-${conn.type})`}
                      className="drop-shadow-sm"
                    />
                    {/* Flow dot animation preview */}
                    <circle r="1.5" fill={conn.color} opacity="0.7" cx="30" cy="8">
                      <animate
                        attributeName="cx"
                        values="20;40;20"
                        dur="3s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    
                    <text
                      x="50"
                      y="12"
                      className="fill-gray-800 text-sm font-semibold"
                      style={{ fontSize: '11px', fontWeight: '600' }}
                    >
                      {conn.label}
                    </text>
                  </g>
                ))}
              </g>

              {/* Subtle layer indicators - non-restrictive guides */}
              {architecture.layers.map((layer, index) => {
                const isVisible = visibleLayers.has(layer.id)
                
                return (
                  <g key={`layer-${layer.id}`}>
                    {/* Minimal layer indicator - just a subtle line */}
                    <line
                      x1={30}
                      y1={120 + index * 180}
                      x2={1570}
                      y2={120 + index * 180}
                      stroke={isVisible ? "rgba(74, 144, 226, 0.15)" : "rgba(229, 231, 235, 0.3)"}
                      strokeWidth="1"
                      strokeDasharray="15,10"
                      className="transition-all duration-300"
                    />
                    
                    {/* Floating layer label - top left corner */}
                    {isVisible && (
                      <g className="layer-label">
                        <rect
                          x={40}
                          y={100 + index * 180}
                          width={Math.max(80, layer.name.length * 8)}
                          height={24}
                          fill="rgba(255, 255, 255, 0.9)"
                          stroke="rgba(74, 144, 226, 0.3)"
                          strokeWidth="1"
                          rx="12"
                          className="drop-shadow-sm"
                        />
                        
                        {/* Layer name - compact and clean */}
                        <text
                          x={50}
                          y={116 + index * 180}
                          className="fill-gray-700 text-xs font-semibold"
                          style={{ 
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          {layer.name.replace(' (Runtime)', '').replace('Browser', 'RUNTIME').toUpperCase()}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}

              {/* Combined connections with dynamic hover + filter highlighting behavior */}
              {allConnections
                .filter(connection => {
                  const sourceComp = components.find(c => c.id === connection.source)
                  const targetComp = components.find(c => c.id === connection.target)
                  if (!sourceComp || !targetComp) return false
                  if (!visibleLayers.has(sourceComp.layer) || !visibleLayers.has(targetComp.layer)) return false
                  // Hover rule: if hovering a component, only show incident edges
                  if (hoveredComponent) {
                    return connection.source === hoveredComponent || connection.target === hoveredComponent
                  }
                  // Otherwise show everything
                  return true
                })
                .map(connection => {
                  const path = getConnectionPath(connection)
                  if (!path) return null
                  const isHighlighted = highlightedConnections.has(connection.id)
                  const isIncident = hoveredComponent && (connection.source === hoveredComponent || connection.target === hoveredComponent)

                  // Connection type matching for filter highlighting (do NOT hide non-matching, just dim)
                  const matchesFilter = (filter: string, conn: ArchitectureConnection) => {
                    if (filter === 'all') return true
                    const label = (conn.label || '').toLowerCase()
                    switch(filter) {
                      case 'imports': return conn.type === 'import'
                      case 'api': return conn.type === 'http' || label.includes('api')
                      case 'config': return conn.type === 'config' || label.includes('config')
                      case 'build': return conn.type === 'build' || conn.type === 'transform' || label.includes('build')
                      default: return true
                    }
                  }
                  const typeMatch = matchesFilter(connectionFilter, connection)

                  // Base style
                  const baseStyle = getConnectionStyle(connection)

                  // Opacity logic
                  let opacity = 0.85
                  if (hoveredComponent) {
                    // When hovering: only incident edges are rendered; highlight type matches stronger
                    opacity = typeMatch || connectionFilter === 'all' ? 1 : 0.25
                  } else {
                    // Not hovering: show all; dim non-type matches if a specific filter chosen
                    if (connectionFilter !== 'all' && !typeMatch) opacity = 0.12
                    else opacity = typeMatch && connectionFilter !== 'all' ? 1 : 0.7
                  }

                  const strokeColor = (isIncident ? '#FF6B35' : (typeMatch && connectionFilter !== 'all' ? '#FF6B35' : baseStyle.stroke))
                  const strokeWidth = isIncident ? 4 : (typeMatch && connectionFilter !== 'all' ? 4 : (isHighlighted ? 4 : baseStyle.strokeWidth))

                  return (
                    <g key={connection.id} className="transition-all duration-300">
                      <path
                        d={path}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={baseStyle.strokeDasharray}
                        opacity={opacity}
                        markerEnd={isIncident || typeMatch ? "url(#arrowhead-highlighted)" : "url(#arrowhead)"}
                        className="drop-shadow-sm hover:cursor-pointer transition-all duration-300"
                      />

                      {/* Flow animation only for incident edges */}
                      {isIncident && (
                        <circle r="3" fill="#FF6B35" opacity="0.8">
                          <animateMotion dur="2s" repeatCount="indefinite" path={path} />
                          <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                      )}

                      {/* Information box for incident edges OR selected highlight */}
                      {showConnectionLabels && connection.label && (isIncident || isHighlighted) && (() => {
                        const sourceComp = components.find(c => c.id === connection.source)
                        const targetComp = components.find(c => c.id === connection.target)
                        if (!sourceComp || !targetComp) return null
                        const sourcePos = (dragState.draggedId === sourceComp.id && draggedComponentPosition) ? draggedComponentPosition : sourceComp.position
                        const targetPos = (dragState.draggedId === targetComp.id && draggedComponentPosition) ? draggedComponentPosition : targetComp.position
                        const midX = (sourcePos.x + sourceComp.size.width/2 + targetPos.x + targetComp.size.width/2) / 2
                        const midY = (sourcePos.y + sourceComp.size.height/2 + targetPos.y + targetComp.size.height/2) / 2
                        return (
                          <g transform={`translate(${midX - connection.label.length * 3.5}, ${midY - 9})`}>
                            <rect
                              x={0}
                              y={0}
                              width={connection.label.length * 7 + 12}
                              height={20}
                              fill="rgba(255, 255, 255, 0.95)"
                              stroke="rgba(74, 144, 226, 0.3)"
                              strokeWidth="1"
                              rx="8"
                              className="drop-shadow-md"
                            />
                            <text
                              x={6}
                              y={14}
                              className="fill-gray-800 text-xs font-semibold"
                              style={{ fontSize: '11px' }}
                            >
                              {connection.label}
                            </text>
                          </g>
                        )
                      })()}
                    </g>
                  )
                })}

              {/* Enhanced Components with improved styling */}
              {components.map(component => {
                const isSelected = selectedComponent?.id === component.id
                const isDragged = dragState.draggedId === component.id
                const isVisible = visibleLayers.has(component.layer)
                
                // Use dragged position if this component is being dragged
                const position = isDragged && draggedComponentPosition 
                  ? draggedComponentPosition 
                  : component.position

                return (
                  <g
                    key={component.id}
                    className={`architecture-component transition-all duration-200 ${
                      isLayoutLocked ? 'cursor-pointer' : 'cursor-grab'
                    } ${isDragged ? 'dragging cursor-grabbing' : ''} ${hoveredComponent === component.id ? 'hovered' : ''}`}
                    onClick={() => handleComponentClick(component)}
                    onMouseDown={(e) => handleMouseDown(e, component)}
                    onMouseEnter={() => setHoveredComponent(component.id)}
                    onMouseLeave={() => setHoveredComponent(null)}
                    style={{ 
                      opacity: isVisible ? 1 : 0.3,
                      transform: isDragged ? 'scale(1.05)' : (hoveredComponent === component.id ? 'scale(1.02)' : 'scale(1)'),
                      transformOrigin: 'center'
                    }}
                  >
                    {/* Enhanced component background with hover effects */}
                    <rect
                      x={position.x}
                      y={position.y}
                      width={component.size.width}
                      height={component.size.height}
                      fill={getComponentColor(component)}
                      stroke={isSelected ? "#FF1744" : isDragged ? "#FFB74D" : (hoveredComponent === component.id ? "#FF6B35" : "#4A90E2")}
                      strokeWidth={isSelected ? 4 : isDragged ? 3 : (hoveredComponent === component.id ? 3 : 2)}
                      rx="12"
                      filter={isSelected ? "url(#glow)" : "url(#dropshadow)"}
                      className="transition-all duration-200 hover:brightness-110"
                      style={{
                        filter: hoveredComponent === component.id ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.15))' : undefined
                      }}
                    />
                    
                    {/* Component type icon */}
                    <circle
                      cx={position.x + 25}
                      cy={position.y + 25}
                      r="12"
                      fill={component.color || '#4A90E2'}
                      className="opacity-90 drop-shadow-sm"
                    />
                    
                    {/* Component type indicator */}
                    <text
                      x={position.x + 25}
                      y={position.y + 30}
                      className="fill-white text-xs font-bold"
                      textAnchor="middle"
                      style={{ fontSize: '10px' }}
                    >
                      {component.type.charAt(0).toUpperCase()}
                    </text>
                    
                    {/* Enhanced component name */}
                    <text
                      x={position.x + component.size.width / 2}
                      y={position.y + component.size.height / 2 - 8}
                      className="fill-gray-800 text-base font-bold"
                      textAnchor="middle"
                      style={{ 
                        fontSize: '14px',
                        fontWeight: 'bold',
                        textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                        opacity: isVisible ? 1 : 0.5 
                      }}
                    >
                      {component.name}
                    </text>
                    
                    {/* Enhanced component purpose */}
                    <text
                      x={position.x + component.size.width / 2}
                      y={position.y + component.size.height / 2 + 10}
                      className="fill-gray-600 text-sm font-medium"
                      textAnchor="middle"
                      style={{ 
                        fontSize: '11px',
                        fontWeight: '500',
                        opacity: isVisible ? 0.8 : 0.4 
                      }}
                    >
                      {component.purpose}
                    </text>

                    {/* File extension indicator instead of unclear tech badges */}
                    {component.files[0] && (
                      <text
                        x={position.x + component.size.width - 15}
                        y={position.y + 20}
                        className="fill-blue-600 text-xs font-bold"
                        textAnchor="middle"
                        style={{ 
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}
                      >
                        {component.files[0].split('.').pop()?.toUpperCase().substring(0, 3) || 'FILE'}
                      </text>
                    )}

                    {/* Enhanced drag indicator */}
                    {isDragged && (
                      <>
                        <circle
                          cx={position.x + component.size.width / 2}
                          cy={position.y + component.size.height / 2}
                          r="60"
                          fill="rgba(255, 23, 68, 0.15)"
                          stroke="#FF1744"
                          strokeWidth="3"
                          strokeDasharray="8,4"
                          className="animate-pulse"
                        />
                        <circle
                          cx={position.x + component.size.width / 2}
                          cy={position.y + component.size.height / 2}
                          r="80"
                          fill="rgba(255, 23, 68, 0.08)"
                          stroke="#FF1744"
                          strokeWidth="2"
                          strokeDasharray="12,6"
                          className="animate-pulse"
                          style={{ animationDelay: '0.5s' }}
                        />
                      </>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Comprehensive Educational Component Details Panel */}
      {selectedComponent && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Network className="h-5 w-5" />
              {selectedComponent.name}
              <Badge variant="outline" className="ml-auto">
                {selectedComponent.layer}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Educational Explanation Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold mb-3 text-blue-800 flex items-center gap-2">
                <span>💡</span> What does this component do?
              </h4>
              <p className="text-blue-700 leading-relaxed">
                {getEducationalExplanation(selectedComponent)}
              </p>
            </div>

            {/* Architectural Role Section */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold mb-3 text-green-800 flex items-center gap-2">
                <span>🏗️</span> Role in Architecture
              </h4>
              <p className="text-green-700 leading-relaxed">
                {getArchitecturalRole(selectedComponent)}
              </p>
            </div>

            {/* Component Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-primary flex items-center gap-2">
                    <span>📋</span> Component Details
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <strong>Type:</strong> 
                      <Badge variant="secondary">{selectedComponent.type}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <strong>Layer:</strong> 
                      <Badge variant="outline">{selectedComponent.layer}</Badge>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <strong className="block mb-1">Purpose:</strong>
                      <p className="text-muted-foreground italic">{selectedComponent.purpose}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 text-primary flex items-center gap-2">
                    <span>🔧</span> Technologies Used
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedComponent.technologies.map(tech => (
                      <Badge key={tech} variant="secondary" className="text-xs px-2 py-1">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-primary flex items-center gap-2">
                    <span>📊</span> Connection Statistics
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
                      <div className="font-bold text-2xl text-blue-600">
                        {architecture.connections.filter(c => c.source === selectedComponent.id).length}
                      </div>
                      <div className="text-blue-700 font-medium">Outgoing</div>
                      <div className="text-xs text-blue-600 mt-1">sends data to</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg">
                      <div className="font-bold text-2xl text-green-600">
                        {architecture.connections.filter(c => c.target === selectedComponent.id).length}
                      </div>
                      <div className="text-green-700 font-medium">Incoming</div>
                      <div className="text-xs text-green-600 mt-1">receives data from</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* File Browser Section */}
            {selectedComponent.files.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 text-primary flex items-center gap-2">
                  <span>📁</span> Associated Files ({selectedComponent.files.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg bg-muted/20">
                  {selectedComponent.files.map(file => (
                    <div key={file} className="text-sm font-mono bg-white border hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors cursor-pointer">
                      <div className="font-semibold text-gray-800">
                        {file.replace(/^.*[/\\]/, '')} {/* Show just filename */}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {file}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enhanced API Calls & External Dependencies */}
            {architecture.apiCalls.filter(call => 
              selectedComponent.files.some(file => call.file === file)
            ).length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 text-primary flex items-center gap-2">
                  <span>🌐</span> API Calls & External Dependencies
                </h4>
                <div className="space-y-3 max-h-64 overflow-y-auto p-2 border rounded-lg bg-muted/10">
                  {architecture.apiCalls
                    .filter(call => selectedComponent.files.some(file => call.file === file))
                    .map((call, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant={call.method === 'GET' ? 'default' : 
                                   call.method === 'POST' ? 'destructive' : 
                                   call.method === 'PUT' ? 'secondary' : 'outline'} 
                            className="text-xs font-bold"
                          >
                            {call.method}
                          </Badge>
                          <Badge variant={call.type === 'external' ? 'destructive' : 'secondary'} className="text-xs">
                            {call.type === 'external' ? '🌍 External' : '🏠 Internal'}
                          </Badge>
                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                            {call.url}
                          </code>
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">� {call.file.split('/').pop()}</span>
                            <span className="text-blue-600">Line {call.line}</span>
                          </div>
                          <div className="font-mono bg-white px-2 py-1 rounded text-xs border">
                            {call.context.trim()}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Interactive Connected Components */}
            <div>
              <h4 className="font-semibold mb-3 text-primary flex items-center gap-2">
                <span>🔗</span> Connected Components
              </h4>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/10">
                {Array.from(new Set([
                  ...architecture.connections.filter(c => c.source === selectedComponent.id).map(c => c.target),
                  ...architecture.connections.filter(c => c.target === selectedComponent.id).map(c => c.source)
                ])).map(componentId => {
                  const comp = architecture.components.find(c => c.id === componentId)
                  const isOutgoing = architecture.connections.some(c => c.source === selectedComponent.id && c.target === componentId)
                  const isIncoming = architecture.connections.some(c => c.target === selectedComponent.id && c.source === componentId)
                  
                  return comp ? (
                    <Button
                      key={componentId}
                      variant="outline"
                      size="sm"
                      onClick={() => handleComponentClick(comp)}
                      className={`text-xs transition-all hover:scale-105 ${
                        isOutgoing && isIncoming ? 'border-purple-300 hover:border-purple-500' :
                        isOutgoing ? 'border-blue-300 hover:border-blue-500' :
                        'border-green-300 hover:border-green-500'
                      }`}
                    >
                      {isOutgoing && isIncoming ? '↔️' : isOutgoing ? '➡️' : '⬅️'} {comp.name}
                    </Button>
                  ) : null
                })}
                {Array.from(new Set([
                  ...architecture.connections.filter(c => c.source === selectedComponent.id).map(c => c.target),
                  ...architecture.connections.filter(c => c.target === selectedComponent.id).map(c => c.source)
                ])).length === 0 && (
                  <p className="text-muted-foreground italic text-sm">No connected components visible in current view.</p>
                )}
              </div>
            </div>

            {/* Learning Tips */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold mb-2 text-amber-800 flex items-center gap-2">
                <span>💡</span> Pro Tips for Understanding This Component
              </h4>
              <ul className="text-amber-700 text-sm space-y-1 list-disc list-inside">
                <li>Click on connected components (arrows above) to explore the data flow</li>
                <li>Look at the connection statistics to understand this component's importance</li>
                <li>Check the associated files to see the actual code implementation</li>
                <li>API calls show how this component interacts with external services</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ArchitectureVisualizer
