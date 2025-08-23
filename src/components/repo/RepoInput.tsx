import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { GitHubRepo } from '@/types'
import { Github, Link, Loader2 } from 'lucide-react'

interface RepoInputProps {
  onSubmit: (repo: GitHubRepo) => void
  isLoading: boolean
}

export function RepoInput({ onSubmit, isLoading }: RepoInputProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const parseGitHubUrl = (url: string): GitHubRepo | null => {
    try {
      const regex = /github\.com\/([^/]+)\/([^/]+)/
      const match = url.match(regex)
      
      if (!match) {
        throw new Error('Invalid GitHub URL format')
      }

      const [, owner, name] = match
      const cleanName = name.replace(/\.git$/, '')

      return {
        owner,
        name: cleanName,
        url: `https://github.com/${owner}/${cleanName}`,
        description: '',
        language: '',
        stars: 0,
        forks: 0
      }
    } catch {
      return null
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!url.trim()) {
      setError('Please enter a GitHub repository URL')
      return
    }

    const repo = parseGitHubUrl(url)
    if (!repo) {
      setError('Please enter a valid GitHub repository URL')
      return
    }

    onSubmit(repo)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center"
        >
          <div className="relative">
            <Github className="h-16 w-16 text-primary" />
            <motion.div
              className="absolute -top-1 -right-1 h-4 w-4 bg-success rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
        
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Explore Any Repository
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Get AI-powered insights, visual architecture maps, and step-by-step walkthroughs 
          of any GitHub repository. Perfect for understanding new codebases quickly.
        </p>
      </div>

      {/* Input Form */}
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Enter GitHub Repository
          </CardTitle>
          <CardDescription>
            Paste any public GitHub repository URL to start exploring
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="url"
                placeholder="https://github.com/owner/repository"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                className="text-center"
              />
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Repository...
                </>
              ) : (
                <>
                  <Github className="h-4 w-4 mr-2" />
                  Explore Repository
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-xl mx-auto space-y-4"
        >
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Features */}
      {!isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
        >
          <Card className="text-center">
            <CardContent className="pt-6">
              <Github className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Smart Analysis</h3>
              <p className="text-sm text-muted-foreground">
                AI-powered code analysis with dependency mapping and architecture insights
              </p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="pt-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <Link className="h-8 w-8 mx-auto mb-3 text-primary" />
              </motion.div>
              <h3 className="font-semibold mb-2">Visual Flow</h3>
              <p className="text-sm text-muted-foreground">
                Interactive node graphs showing file relationships and data flow
              </p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="pt-6">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Github className="h-8 w-8 mx-auto mb-3 text-primary" />
              </motion.div>
              <h3 className="font-semibold mb-2">Step-by-Step</h3>
              <p className="text-sm text-muted-foreground">
                Guided walkthroughs perfect for onboarding and code reviews
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
