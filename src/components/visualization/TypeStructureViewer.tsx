import { useEffect, useMemo, useRef, useState } from 'react'
import { FileNode, TypeGraph } from '@/types'
import { buildTypeGraph } from '@/lib/type-analyzer'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface TypeStructureViewerProps {
  root: FileNode
  getFileContent: (path: string) => Promise<string | undefined>
}

interface PositionedNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  group: string
  raw: TypeGraph['nodes'][0]
}

export function TypeStructureViewer({ root, getFileContent }: TypeStructureViewerProps) {
  const [graph, setGraph] = useState<TypeGraph | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const g = await buildTypeGraph(root, getFileContent)
        if (!cancelled) setGraph(g)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to build type graph')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [root, getFileContent])

  // Simple layout (radial by kind)
  const layout = useMemo(() => {
    if (!graph) return { nodes: [] as PositionedNode[] }
    const byKind: Record<string, PositionedNode[]> = {}
    const radiusStep = 140
    const centerX = 800 / 2
    const centerY = 600 / 2

  graph.nodes.forEach((n) => {
      const arr = byKind[n.kind] || (byKind[n.kind] = [])
      arr.push({ id: n.name, x: 0, y: 0, vx: 0, vy: 0, group: n.kind, raw: n })
    })

    const kinds = Object.keys(byKind)
    kinds.forEach((kind, ki) => {
      const ring = ki + 1
      const nodes = byKind[kind]
      nodes.forEach((node, i) => {
        const angle = (i / nodes.length) * Math.PI * 2
        node.x = centerX + Math.cos(angle) * ring * radiusStep * 0.5
        node.y = centerY + Math.sin(angle) * ring * radiusStep * 0.5
      })
    })

    return { nodes: Object.values(byKind).flat() }
  }, [graph])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Building type graph...</div>
  }
  if (error) {
    return <div className="text-sm text-red-600 p-4">{error}</div>
  }
  if (!graph) return null

  const colorFor = (kind: string) => (
    kind === 'interface' ? '#2563eb' : kind === 'class' ? '#7e22ce' : kind === 'enum' ? '#db8b00' : '#059669'
  )

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <Badge variant="secondary">Interfaces {graph.stats.interfaces}</Badge>
          <Badge variant="secondary">Classes {graph.stats.classes}</Badge>
            <Badge variant="secondary">Types {graph.stats.types}</Badge>
          <Badge variant="secondary">Enums {graph.stats.enums}</Badge>
        </div>
        <div className="relative">
          <svg ref={svgRef} width={800} height={600} className="border rounded bg-white dark:bg-neutral-900">
            {/* edges */}
            {graph.edges.map(e => {
              const s = layout.nodes.find(n => n.id === e.source)
              const t = layout.nodes.find(n => n.id === e.target)
              if (!s || !t) return null
              const stroke = e.relation === 'extends' ? '#6366f1' : e.relation === 'implements' ? '#f59e0b' : '#94a3b8'
              return (
                <g key={e.id}>
                  <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={stroke} strokeWidth={1.2} markerEnd="url(#arrow)" strokeDasharray={e.relation === 'uses' ? '4 4' : undefined} opacity={selected && selected !== e.source && selected !== e.target ? 0.15 : 0.7} />
                </g>
              )
            })}
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L10,5 L0,10 z" fill="#64748b" />
              </marker>
            </defs>
            {layout.nodes.map(n => (
              <g key={n.id} onMouseEnter={() => setSelected(n.id)} onMouseLeave={() => setSelected(null)}>
                <circle cx={n.x} cy={n.y} r={18} fill={colorFor(n.group)} fillOpacity={selected && selected !== n.id ? 0.25 : 0.85} stroke="#1e293b" strokeWidth={0.5} />
                <text x={n.x} y={n.y + 32} textAnchor="middle" fontSize={10} className="select-none fill-current" fill="#334155">{n.id}</text>
              </g>
            ))}
          </svg>
          {selected && (
            <div className="absolute top-2 right-2 bg-white dark:bg-neutral-800 shadow rounded p-3 text-xs max-w-xs border">
              <div className="font-medium mb-1">{selected}</div>
              {(() => {
                const node = graph.nodes.find(n => n.name === selected)
                if (!node) return null
                return (
                  <div className="space-y-1">
                    {node.extends && node.extends.length > 0 && <div><span className="font-semibold">extends:</span> {node.extends.join(', ')}</div>}
                    {node.implements && node.implements.length > 0 && <div><span className="font-semibold">implements:</span> {node.implements.join(', ')}</div>}
                    {node.dependsOn.length > 0 && <div><span className="font-semibold">uses:</span> {node.dependsOn.slice(0,6).join(', ')}{node.dependsOn.length>6?'…':''}</div>}
                    <div className="text-[10px] text-muted-foreground truncate">{node.file}</div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
