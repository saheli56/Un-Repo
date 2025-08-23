import { FileNode, TypeGraph, TypeNode, TypeEdge } from '@/types'

// Lightweight type structure analyzer (regex based quick pass)
// For deeper accuracy we could integrate ts-morph like ASTAnalyzer, but this is a fast extraction.

interface AnalyzeOptions {
  maxFiles?: number
}

export function buildTypeGraph(root: FileNode, getContent: (path: string) => Promise<string | undefined>, options: AnalyzeOptions = {}): Promise<TypeGraph> {
  const { maxFiles = 400 } = options
  const codeFiles = collectCodeFiles(root)
    .filter(f => /\.(ts|tsx|js|jsx)$/.test(f.name) && !f.name.endsWith('.d.ts'))
    .slice(0, maxFiles)

  const nodes: TypeNode[] = []
  const edges: TypeEdge[] = []
  const nodeMap = new Map<string, TypeNode>()

  const tasks = codeFiles.map(async file => {
    const content = await getContent(file.path)
    if (!content) return

    // Interfaces
    const interfaceRegex = /export?\s*interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*{/g
    let match: RegExpExecArray | null
    while ((match = interfaceRegex.exec(content)) !== null) {
      const name = match[1]
      const extendsList = match[2]?.split(/[,]/).map(s => s.trim()).filter(Boolean) || []
      const id = `${file.path}::${name}`
      const node: TypeNode = {
        id,
        name,
        kind: 'interface',
        file: file.path,
        dependsOn: [...extendsList],
        extends: extendsList
      }
      nodes.push(node)
      nodeMap.set(name, node)
      extendsList.forEach(parent => {
        edges.push({ id: `${name}-extends-${parent}-${edges.length}` , source: name, target: parent, relation: 'extends' })
      })
    }

    // Type aliases
    const typeRegex = /export?\s*type\s+(\w+)\s*=\s*([^;\n]+)/g
    while ((match = typeRegex.exec(content)) !== null) {
      const name = match[1]
      const right = match[2]
  const referenced = extractReferencedTypes(right)
      nodes.push({
        id: `${file.path}::${name}`,
        name,
        kind: 'type',
        file: file.path,
        dependsOn: referenced
      })
      referenced.forEach(dep => edges.push({ id: `${name}-uses-${dep}-${edges.length}`, source: name, target: dep, relation: 'uses' }))
    }

    // Enums
    const enumRegex = /export?\s*enum\s+(\w+)\s*{/g
    while ((match = enumRegex.exec(content)) !== null) {
      const name = match[1]
      nodes.push({ id: `${file.path}::${name}` , name, kind: 'enum', file: file.path, dependsOn: [] })
    }

    // Classes
    const classRegex = /export?\s*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*{/g
    while ((match = classRegex.exec(content)) !== null) {
      const name = match[1]
      const extendsBase = match[2] ? [match[2]] : []
      const implementsList = match[3]?.split(/[,]/).map(s => s.trim()).filter(Boolean) || []
      const deps = [...extendsBase, ...implementsList]
      nodes.push({ id: `${file.path}::${name}`, name, kind: 'class', file: file.path, dependsOn: deps, extends: extendsBase, implements: implementsList })
      extendsBase.forEach(parent => edges.push({ id: `${name}-extends-${parent}-${edges.length}`, source: name, target: parent, relation: 'extends' }))
      implementsList.forEach(parent => edges.push({ id: `${name}-implements-${parent}-${edges.length}`, source: name, target: parent, relation: 'implements' }))
    }
  })

  return Promise.all(tasks).then(() => {
    const stats = {
      interfaces: nodes.filter(n => n.kind === 'interface').length,
      types: nodes.filter(n => n.kind === 'type').length,
      enums: nodes.filter(n => n.kind === 'enum').length,
      classes: nodes.filter(n => n.kind === 'class').length
    }

    return { nodes, edges, stats }
  })
}

function collectCodeFiles(root: FileNode): FileNode[] {
  const result: FileNode[] = []
  const walk = (node: FileNode) => {
    if (node.type === 'file') result.push(node)
    node.children?.forEach(walk)
  }
  walk(root)
  return result
}

function extractReferencedTypes(text: string): string[] {
  const refs = new Set<string>()
  const identifierRegex = /\b[A-Z][A-Za-z0-9_]+\b/g
  let match: RegExpExecArray | null
  while ((match = identifierRegex.exec(text)) !== null) {
    const id = match[0]
    // Heuristic: skip common built-ins
    if (['String','Number','Boolean','Array','Record','Partial','Pick','Omit','Promise','Date','Error','Map','Set'].includes(id)) continue
    refs.add(id)
  }
  return Array.from(refs)
}
