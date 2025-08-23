import React, { useState, useCallback } from 'react';
import './InteractiveFileTree.css';
import { Badge } from '@/components/ui/badge';
import { FileNode } from '@/types';
import { ChevronRight, File, Folder, FolderOpen, Code, Image, FileText, Settings, Package } from 'lucide-react';
import { GitBranch } from 'lucide-react';

interface InteractiveFileTreeProps {
  structure: FileNode;
  onFileSelect: (file: FileNode) => void;
  selectedFile?: FileNode | null;
}

interface TreeNodeState {
  expanded: boolean;
  hovered: boolean;
  children: Map<string, TreeNodeState>;
}

const getFileIcon = (node: FileNode, isExpanded?: boolean) => {
  if (node.type === 'directory') {
    return isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />;
  }
  const extension = node.extension?.toLowerCase();
  const fileName = node.name.toLowerCase();
  if (fileName === 'package.json') return <Package className="h-4 w-4 text-green-500" />;
  if (fileName === 'readme.md') return <FileText className="h-4 w-4 text-blue-500" />;
  if (fileName.includes('config') || fileName.includes('.json')) return <Settings className="h-4 w-4 text-yellow-500" />;
  if (fileName.includes('git')) return <GitBranch className="h-4 w-4 text-orange-500" />;
  if ([ '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c' ].includes(extension || '')) {
    return <Code className="h-4 w-4 text-blue-400" />;
  }
  if ([ '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico' ].includes(extension || '')) {
    return <Image className="h-4 w-4 text-purple-400" />;
  }
  return <File className="h-4 w-4 text-zinc-400" />;
};

const groupByLayer = (node: FileNode): Record<string, FileNode[]> => {
  // Layered grouping for diagram style
  const layers: Record<string, FileNode[]> = {
    'Root': [],
    'UI Layer': [],
    'Routing & Pages': [],
    'Other': []
  };
  const traverse = (n: FileNode) => {
    let layer = 'Other';
    if (n.depth === 0) layer = 'Root';
    else if (n.depth === 1) layer = 'UI Layer';
    else if (n.depth === 2) layer = 'Routing & Pages';
    layers[layer].push(n);
    if (n.children) n.children.forEach(traverse);
  };
  traverse(node);
  return layers;
};

const InteractiveFileTree: React.FC<InteractiveFileTreeProps> = (props) => {
  const { structure, onFileSelect, selectedFile } = props;
  const [progressiveMode] = useState(true);
  const [showHiddenFiles] = useState(true);
  const [searchTerm] = useState('');
  const [nodeStates, setNodeStates] = useState<Map<string, TreeNodeState>>(new Map());

  const initializeNodeStates = useCallback((node: FileNode, states: Map<string, TreeNodeState> = new Map()): Map<string, TreeNodeState> => {
    const shouldExpand = progressiveMode ? node.depth === 0 : node.depth <= 1;
    const state: TreeNodeState = {
      expanded: shouldExpand,
      hovered: false,
      children: new Map()
    };
    states.set(node.id, state);
    if (node.children && node.type === 'directory') {
      node.children.forEach(child => initializeNodeStates(child, states));
    }
    return states;
  }, [progressiveMode]);

  React.useEffect(() => {
    if (nodeStates.size === 0) {
      const initialStates = initializeNodeStates(structure);
      setNodeStates(initialStates);
    }
  }, [structure, nodeStates.size, initializeNodeStates]);

  const toggleNode = useCallback((nodeId: string) => {
    setNodeStates(prev => {
      const newStates = new Map(prev);
      const currentState = newStates.get(nodeId);
      if (currentState) {
        newStates.set(nodeId, {
          ...currentState,
          expanded: !currentState.expanded
        });
      }
      return newStates;
    });
  }, []);

  const filterNode = useCallback((node: FileNode): boolean => {
    if (!showHiddenFiles && node.name.startsWith('.')) return false;
    if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      if (node.children) {
        return node.children.some(child => filterNode(child));
      }
      return false;
    }
    return true;
  }, [showHiddenFiles, searchTerm]);

  const NodeBranch: React.FC<{ node: FileNode; depth?: number }> = ({ node, depth = 0 }) => {
    // Hooks must run unconditionally; compute visibility after hooks
    const containerRef = React.useRef<HTMLDivElement>(null);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const chevronRef = React.useRef<SVGSVGElement>(null);
    // Multi-row child layout
    const childRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
    const setChildRef = useCallback((id: string, el: HTMLDivElement | null) => {
      childRefs.current[id] = el;
    }, []);
    // Responsive layout config: use more width, less vertical depth
    const getMaxChildPerRow = useCallback(() => {
      // Use up to 4 per row, but never let nodes overflow the screen
      const screenWidth = window.innerWidth || 1200;
      // Each node is ~340px wide + 64px gap, so max per row = floor((screenWidth - 128) / 404)
      const max = Math.max(2, Math.min(4, Math.floor((screenWidth - 128) / 404)));
      return max;
    }, []);
    const getChildRows = useCallback((children: FileNode[] = []) => {
      const maxPerRow = getMaxChildPerRow();
      const rows: FileNode[][] = [];
      for (let i = 0; i < children.length; i += maxPerRow) {
        rows.push(children.slice(i, i + maxPerRow));
      }
      return rows;
    }, [getMaxChildPerRow]);

    const nodeState = nodeStates.get(node.id);
    const isExpanded = nodeState?.expanded || false;
    const isSelected = selectedFile?.id === node.id;
    const hasChildren = !!(node.children && node.children.length > 0);
    const isVisible = filterNode(node);

    const [svgSize, setSvgSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [paths, setPaths] = useState<string[]>([]);

    // Multi-row connector logic with balanced vertical/horizontal spacing
    const recompute = useCallback(() => {
      const container = containerRef.current;
      const parentEl = parentRef.current;
      if (!container || !parentEl || !hasChildren || !isExpanded) {
        setPaths([]);
        return;
      }
      const cRect = container.getBoundingClientRect();
      let startX: number, startY: number;
      if (chevronRef.current) {
        const chevRect = chevronRef.current.getBoundingClientRect();
        startX = chevRect.left + chevRect.width / 2 - cRect.left;
        startY = chevRect.top + chevRect.height / 2 - cRect.top;
      } else {
        const pRect = parentEl.getBoundingClientRect();
        startX = pRect.left + pRect.width / 2 - cRect.left;
        startY = pRect.bottom - cRect.top;
      }
      const newPaths: string[] = [];
      // Get child rows
      const childRows = getChildRows(node.children || []);
      childRows.forEach((row, rowIdx) => {
        row.forEach((child) => {
          const childEl = childRefs.current[child.id];
          if (!childEl) return;
          const chRect = childEl.getBoundingClientRect();
          const endX = chRect.left + chRect.width / 2 - cRect.left;
          const endY = chRect.top - cRect.top;
          // Balanced vertical gap for multi-row
          const dy = Math.max(96 + rowIdx * 24, (endY - startY));
          const c1x = startX;
          const c1y = startY + dy * 0.4;
          const c2x = endX;
          const c2y = endY - dy * 0.4;
          const d = `M ${startX},${startY} C ${c1x},${c1y} ${c2x},${c2y} ${endX},${endY}`;
          newPaths.push(d);
        });
      });
      setPaths(newPaths);
      setSvgSize({ width: cRect.width, height: cRect.height });
  }, [hasChildren, isExpanded, node.children, getChildRows]);

    React.useLayoutEffect(() => {
      recompute();
    }, [recompute]);
    React.useEffect(() => {
      const onResize = () => recompute();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [recompute]);

    if (!isVisible) return null;

    // Multi-row child layout rendering with more spacing and visual grouping
    return (
      <div ref={containerRef} className="branch-container" style={{ position: 'relative', marginBottom: 48 }}>
        <div
          ref={parentRef}
          className={`tree-node flex items-center px-6 py-4 rounded-xl border transition-all bg-zinc-900/80 shadow-md ${isSelected ? 'border-blue-400 bg-blue-500/10' : 'border-zinc-800'} ${hasChildren ? 'cursor-pointer' : ''}`}
          style={{ margin: '0 auto', minWidth: 220, maxWidth: 340 }}
          onClick={() => {
            if (hasChildren && node.type === 'directory') toggleNode(node.id);
            else onFileSelect(node);
          }}
        >
          {hasChildren && node.type === 'directory' && (
            <ChevronRight ref={chevronRef} className={`h-5 w-5 mr-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          )}
          {getFileIcon(node, isExpanded)}
          <span className={`ml-3 font-semibold text-lg ${isSelected ? 'text-blue-400' : 'text-zinc-200'}`}>{node.name}</span>
          {hasChildren && node.children && (
            <Badge variant="secondary" className="ml-3 text-sm bg-zinc-800/80 text-zinc-300 border border-zinc-700">{node.children.length}</Badge>
          )}
        </div>

        {hasChildren && isExpanded && (
          <svg className="branch-svg" width={svgSize.width} height={svgSize.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
              <marker id={`arrow-${node.id}`} markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L14,7 L0,14 L4,7 z" fill="#94a3b8" />
              </marker>
            </defs>
            {paths.map((d, i) => (
              <path key={i} d={d} stroke="#475569" strokeWidth={2.6} fill="none" markerEnd={`url(#arrow-${node.id})`} />
            ))}
          </svg>
        )}

        {hasChildren && isExpanded && (
          <div className="tree-children" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48, marginTop: 64 }}>
            {getChildRows(node.children || []).map((row, rowIdx) => (
              <div key={rowIdx} style={{ display: 'flex', justifyContent: 'center', gap: 64, marginBottom: 0, background: 'rgba(39,39,42,0.5)', borderRadius: 16, padding: '24px 0' }}>
                {row.map(child => (
                  <div key={child.id} ref={(el) => setChildRef(child.id, el)} style={{ position: 'relative', margin: '0 16px' }}>
                    {renderTreeNode(child, depth + 1)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTreeNode = (node: FileNode, depth: number = 0): React.ReactNode => {
    return <NodeBranch node={node} depth={depth} />;
  };

  const layers = groupByLayer(structure);

  // Layered boxes, horizontal node grouping, labeled connectors
  return (
    <div className="architecture-tree-view text-zinc-200 w-full" style={{ background: 'transparent', minHeight: '100vh', padding: '32px 0', width: '100vw', overflowX: 'auto' }}>
      <div className="flex flex-col gap-16 w-full" style={{ width: '100%' }}>
        {Object.entries(layers).map(([layerName, nodes]) => (
          <div key={layerName} className="layer-box p-8 rounded-2xl border border-zinc-700 bg-zinc-900/70 shadow-lg w-full" style={{ position: 'relative', minHeight: 180, width: '100%' }}>
            <div className="layer-label text-xl font-bold text-zinc-100 mb-8 text-center" style={{ letterSpacing: 1 }}>{layerName}</div>
            <div className="layer-nodes flex flex-row flex-wrap justify-start gap-32 w-full" style={{ padding: '24px 0', width: '100%' }}>
              {nodes.map((node: FileNode) => renderTreeNode(node, node.depth))}
            </div>
            {/* Optionally, add SVG connectors and labels between nodes here for advanced relationship labeling */}
          </div>
        ))}
      </div>
    </div>
  );
};

export { InteractiveFileTree };
