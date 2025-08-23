import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Folder, FolderOpen, FileText } from 'lucide-react';
import { SystemArchitecture, ArchitectureComponent, ArchitectureConnection } from '@/lib/enhanced-analyzer';

interface ArchitectureVisualizerV2Props {
	architecture: SystemArchitecture;
}

interface TreeState {
	[id: string]: boolean;
}

const getComponentIcon = (comp: ArchitectureComponent, expanded: boolean) => {
	if (comp.type === 'component' || comp.type === 'service') {
		return expanded ? <FolderOpen className="h-4 w-4 text-blue-600" /> : <Folder className="h-4 w-4 text-blue-600" />;
	}
	return <FileText className="h-4 w-4 text-gray-500" />;
};

const getComponentColor = (comp: ArchitectureComponent) => {
	switch (comp.layer) {
		case 'runtime': return 'bg-gray-100 border-gray-300';
		case 'source': return 'bg-blue-50 border-blue-200';
		case 'static': return 'bg-green-50 border-green-200';
		case 'external': return 'bg-purple-50 border-purple-200';
		case 'development': return 'bg-yellow-50 border-yellow-200';
		default: return 'bg-white border-gray-200';
	}
};

const getChildren = (comp: ArchitectureComponent, connections: ArchitectureConnection[]) => {
	// Find components that this one connects to (outgoing)
	return connections.filter(c => c.source === comp.id).map(c => c.target);
};

export const ArchitectureVisualizerV2: React.FC<ArchitectureVisualizerV2Props> = ({ architecture }) => {
	const [treeState, setTreeState] = useState<TreeState>({});
	const [hoveredConn, setHoveredConn] = useState<string | null>(null);

	// Expand/collapse logic
	const toggleNode = useCallback((id: string) => {
		setTreeState(prev => ({ ...prev, [id]: !prev[id] }));
	}, []);

	// Render tree recursively
	const renderTree = (comp: ArchitectureComponent, depth: number = 0) => {
		const childrenIds = getChildren(comp, architecture.connections);
		const expanded = !!treeState[comp.id];
		const hasChildren = childrenIds.length > 0;
		return (
			<div key={comp.id} style={{ marginLeft: depth * 28, marginBottom: 8 }}>
				<div
					className={`flex items-center rounded-lg px-3 py-2 border ${getComponentColor(comp)} transition-shadow ${expanded ? 'shadow-md' : ''}`}
					style={{ cursor: hasChildren ? 'pointer' : 'default', minHeight: 40 }}
					onClick={() => hasChildren && toggleNode(comp.id)}
				>
					{/* Expand/collapse arrow */}
					{hasChildren && (
						<ChevronRight
							className={`h-4 w-4 mr-1 transition-transform ${expanded ? 'rotate-90' : ''}`}
						/>
					)}
					{/* Icon */}
					<span className="mr-2">{getComponentIcon(comp, expanded)}</span>
					{/* Name */}
					<span className="font-medium text-base text-gray-800">{comp.name}</span>
					{/* Layer badge */}
					<Badge variant="secondary" className="ml-2 text-xs">{comp.layer}</Badge>
					{/* Tech badges */}
					{comp.technologies.map(tech => (
						<Badge key={tech} variant="outline" className="ml-1 text-xs">{tech}</Badge>
					))}
				</div>
				{/* Children */}
				{hasChildren && expanded && (
					<div className="mt-1">
						{childrenIds.map(childId => {
							const childComp = architecture.components.find(c => c.id === childId);
							return childComp ? renderTree(childComp, depth + 1) : null;
						})}
					</div>
				)}
				{/* Connector lines and info tiles */}
				{hasChildren && expanded && (
					<div className="ml-6">
						{architecture.connections.filter(c => c.source === comp.id).map(conn => (
							<div
								key={conn.id}
								className="relative group flex items-center mt-1"
								onMouseEnter={() => setHoveredConn(conn.id)}
								onMouseLeave={() => setHoveredConn(null)}
							>
								<div className="w-6 h-0.5 bg-gray-300 group-hover:bg-blue-400 transition-colors mr-2" />
								<span className="text-xs text-gray-500">{architecture.components.find(c => c.id === conn.target)?.name}</span>
								{/* Info tile on hover */}
								{hoveredConn === conn.id && (
									<div className="absolute left-10 top-0 z-10 bg-white border border-blue-200 rounded shadow-lg px-3 py-2 text-xs text-gray-700" style={{ minWidth: 180 }}>
										<div className="font-semibold text-blue-700 mb-1">{conn.label}</div>
										<div>{conn.description}</div>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		);
	};

	// Find root components (no incoming connections)
	const rootIds = architecture.components
		.filter(comp => !architecture.connections.some(conn => conn.target === comp.id))
		.map(comp => comp.id);

	// Background styling for mature look
	return (
		<div className="min-h-[600px] w-full flex flex-col items-start justify-start p-8" style={{ background: 'linear-gradient(120deg, #f8fafc 0%, #e2e8f0 100%)' }}>
			<Card className="w-full max-w-4xl mx-auto shadow-lg border border-gray-200">
				<CardHeader>
					<CardTitle className="text-2xl font-bold text-gray-800">Repository Architecture</CardTitle>
					<div className="text-sm text-gray-500 mt-1">Explore the structure by expanding components. Hover connector lines for details.</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{rootIds.length === 0 ? (
							<div className="text-gray-500 italic">No root components found.</div>
						) : (
							rootIds.map(rootId => {
								const rootComp = architecture.components.find(c => c.id === rootId);
								return rootComp ? renderTree(rootComp) : null;
							})
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
};
