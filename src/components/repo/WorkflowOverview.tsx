import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GitHubRepo, RepoAnalysis, WorkflowNode } from '@/types'
import { 
  Code, 
  GitBranch, 
  Zap, 
  Target, 
  Brain, 
  Network,
  ExternalLink,
  FileCode,
  Settings,
  TestTube
} from 'lucide-react'

interface WorkflowOverviewProps {
  repo: GitHubRepo
  analysis: RepoAnalysis
  onViewWorkflow: () => void
}

export function WorkflowOverview({ analysis, onViewWorkflow }: WorkflowOverviewProps) {
  const workflow = analysis.workflow

  if (!workflow) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Workflow Analysis Unavailable</h3>
          <p className="text-muted-foreground mb-4">
            AST-based workflow analysis could not be performed for this repository.
          </p>
          <Button onClick={onViewWorkflow} variant="outline">
            <Network className="h-4 w-4 mr-2" />
            View Basic Structure
          </Button>
        </CardContent>
      </Card>
    )
  }

  const getNodeTypeIcon = (type: WorkflowNode['type']) => {
    const icons = {
      entry: <Zap className="h-4 w-4" />,
      component: <Code className="h-4 w-4" />,
      service: <Settings className="h-4 w-4" />,
      utility: <FileCode className="h-4 w-4" />,
      config: <Settings className="h-4 w-4" />,
      test: <TestTube className="h-4 w-4" />,
      type: <FileCode className="h-4 w-4" />,
    }
    return icons[type] || <FileCode className="h-4 w-4" />
  }

  const getNodeTypeColor = (type: WorkflowNode['type']) => {
    const colors = {
      entry: 'bg-error-muted text-error-foreground border-error',
      component: 'bg-info-muted text-info-foreground border-info',
      service: 'bg-success-muted text-success-foreground border-success',
      utility: 'bg-warning-muted text-warning-foreground border-warning',
      config: 'bg-muted text-muted-foreground border-border',
      test: 'bg-muted text-muted-foreground border-border',
      type: 'bg-muted text-muted-foreground border-border',
    }
    return colors[type] || 'bg-muted text-muted-foreground border-border'
  }

  const entryPointNodes = workflow.nodes.filter(n => n.type === 'entry')
  const highImportanceNodes = workflow.nodes.filter(n => n.importance === 'high')
  const complexNodes = workflow.nodes.filter(n => n.complexity > 10).slice(0, 5)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Repository Workflow Analysis
            </div>
            <Button onClick={onViewWorkflow}>
              <Network className="h-4 w-4 mr-2" />
              View Interactive Diagram
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{workflow.metrics.totalFiles}</div>
              <div className="text-sm text-muted-foreground">Files Analyzed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-info">{workflow.metrics.totalFunctions}</div>
              <div className="text-sm text-muted-foreground">Functions Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{workflow.metrics.totalClasses}</div>
              <div className="text-sm text-muted-foreground">Classes Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">
                {Math.round(workflow.metrics.avgComplexity * 10) / 10}
              </div>
              <div className="text-sm text-muted-foreground">Avg Complexity</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entry Points */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Entry Points ({entryPointNodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {entryPointNodes.slice(0, 5).map((node) => (
              <div key={node.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${getNodeTypeColor(node.type)}`}>
                    {getNodeTypeIcon(node.type)}
                  </div>
                  <div>
                    <div className="font-medium">{node.name}</div>
                    <div className="text-sm text-muted-foreground">{node.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    Complexity: {node.complexity}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(node.githubUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {entryPointNodes.length > 5 && (
              <div className="text-center py-2">
                <Button variant="ghost" size="sm" onClick={onViewWorkflow}>
                  View {entryPointNodes.length - 5} more entry points
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* High Importance Files */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            High Importance Files ({highImportanceNodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {highImportanceNodes.slice(0, 6).map((node) => (
              <div key={node.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${getNodeTypeColor(node.type)}`}>
                    {getNodeTypeIcon(node.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{node.name}</div>
                    <div className="text-xs text-muted-foreground">{node.role}</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(node.githubUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          {highImportanceNodes.length > 6 && (
            <div className="text-center pt-3">
              <Button variant="ghost" size="sm" onClick={onViewWorkflow}>
                View {highImportanceNodes.length - 6} more important files
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complex Files */}
      {complexNodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Most Complex Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {complexNodes.map((node) => (
                <div key={node.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${getNodeTypeColor(node.type)}`}>
                      {getNodeTypeIcon(node.type)}
                    </div>
                    <div>
                      <div className="font-medium">{node.name}</div>
                      <div className="text-sm text-muted-foreground">{node.role}</div>
                      {node.astInfo && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {node.astInfo.functions.length} functions, {node.astInfo.classes.length} classes
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">
                      {node.complexity} complexity
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(node.githubUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Paths */}
      {workflow.criticalPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Critical Paths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workflow.criticalPaths.slice(0, 3).map((path, index) => (
                <div key={index} className="p-3 bg-muted/50 rounded-lg">
                  <div className="font-medium mb-2">{path.description}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {path.path.slice(0, 3).map((nodeId, idx) => {
                      const node = workflow.nodes.find(n => n.id === nodeId)
                      return (
                        <React.Fragment key={nodeId}>
                          <span className="font-mono bg-background px-2 py-1 rounded">
                            {node?.name || nodeId.split('/').pop()}
                          </span>
                          {idx < Math.min(path.path.length - 1, 2) && (
                            <span>→</span>
                          )}
                        </React.Fragment>
                      )
                    })}
                    {path.path.length > 3 && (
                      <span className="text-muted-foreground">
                        ... +{path.path.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clusters */}
      {workflow.clusters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              File Clusters ({workflow.clusters.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workflow.clusters.slice(0, 4).map((cluster) => (
                <div key={cluster.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="font-medium mb-1">{cluster.name}</div>
                  <div className="text-sm text-muted-foreground mb-2">{cluster.purpose}</div>
                  <div className="text-xs text-muted-foreground">
                    {cluster.nodeIds.length} files
                  </div>
                </div>
              ))}
            </div>
            {workflow.clusters.length > 4 && (
              <div className="text-center pt-3">
                <Button variant="ghost" size="sm" onClick={onViewWorkflow}>
                  View all {workflow.clusters.length} clusters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Call to Action */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-6 text-center">
          <Network className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ready to Explore?</h3>
          <p className="text-muted-foreground mb-4">
            View the interactive workflow diagram to see how all files connect and interact.
          </p>
          <Button onClick={onViewWorkflow} size="lg">
            <Brain className="h-4 w-4 mr-2" />
            Open Interactive Visualizer
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
