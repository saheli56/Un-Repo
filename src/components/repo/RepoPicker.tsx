import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GitHubAPI } from '@/lib/github-api'
import { GitHubRepo } from '@/types'
import { Github, RefreshCcw } from 'lucide-react'

interface RepoPickerProps {
  onSelect: (repo: GitHubRepo) => void
}

export function RepoPicker({ onSelect }: RepoPickerProps) {
  type ApiRepo = {
    id: number
    name: string
    full_name: string
    description: string | null
    html_url: string
    language: string | null
    stargazers_count: number
    forks_count: number
    owner: { login: string }
  }
  const [repos, setRepos] = useState<ApiRepo[]>([])
  const [filtered, setFiltered] = useState<ApiRepo[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
  const res = await GitHubAPI.listUserRepos({ per_page: 100 })
    if (res.error) setError(res.error)
  const items = (res.data as unknown as ApiRepo[]) || []
    setRepos(items)
    setFiltered(items)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const term = q.toLowerCase()
    setFiltered(repos.filter(r => r.name.toLowerCase().includes(term)))
  }, [q, repos])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Github className="h-5 w-5"/> Your Repositories</CardTitle>
        <div className="flex items-center gap-2">
          <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter..." className="h-8 w-48"/>
          <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && <div className="text-sm text-destructive mb-2">{error}</div>}
        {!loading && filtered.length === 0 && <div className="text-sm text-muted-foreground">No repos.</div>}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-auto">
            {filtered.map((r) => (
              <Button key={r.id} variant="outline" className="justify-start" onClick={() => onSelect({ owner: r.owner.login, name: r.name, url: r.html_url, description: r.description ?? undefined, language: r.language ?? undefined, stars: r.stargazers_count, forks: r.forks_count })}>
                <div className="text-left">
                  <div className="font-medium">{r.full_name}</div>
                  <div className="text-xs text-muted-foreground">★ {r.stargazers_count} • {r.language || 'n/a'}</div>
                </div>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
