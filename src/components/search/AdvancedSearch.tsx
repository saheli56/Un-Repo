import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FileNode, SearchResult } from '@/types'
import { RepoSearchEngine, SearchOptions, searchUtils } from '@/lib/search-engine'
import { cn, debounce } from '@/lib/utils'
import { 
  Search, 
  Filter, 
  FileText, 
  Code, 
  X, 
  ChevronDown,
  Clock,
  Hash,
  FileCode,
  Zap,
} from 'lucide-react'

interface AdvancedSearchProps {
  files: FileNode[]
  onFileSelect: (file: FileNode) => void
  className?: string
}

export function AdvancedSearch({ files, onFileSelect, className }: AdvancedSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [searchEngine] = useState(() => new RepoSearchEngine(files))
  
  const searchRef = useRef<HTMLInputElement>(null)
  const [filters, setFilters] = useState({
    fileTypes: [] as string[],
    languages: [] as string[],
    includeContent: false,
    caseSensitive: false,
    useRegex: false
  })

  // Update search engine when files change
  useEffect(() => {
    searchEngine.updateFiles(files)
  }, [files, searchEngine])

  // Debounced search function
  const debouncedSearch = debounce((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    
    const searchOptions: SearchOptions = {
      query: searchQuery,
      filters: {
        fileTypes: filters.fileTypes.length > 0 ? filters.fileTypes : undefined,
        languages: filters.languages.length > 0 ? filters.languages : undefined,
        includeContent: filters.includeContent
      },
      caseSensitive: filters.caseSensitive,
      useRegex: filters.useRegex,
      maxResults: 50
    }

    setTimeout(() => {
      const searchResults = searchEngine.search(searchOptions)
      setResults(searchResults)
      setIsSearching(false)
    }, 300) // Simulate search delay
  }, 300)

  // Handle search input
  const handleSearch = (value: string) => {
    setQuery(value)
    
    if (value.trim()) {
      const newSuggestions = searchUtils.generateSuggestions(value, files)
      setSuggestions(newSuggestions)
      debouncedSearch(value)
    } else {
      setSuggestions([])
      setResults([])
    }
  }

  // Get available file types and languages
  const availableFileTypes = Object.keys(searchEngine.getFileTypeStats())
  const availableLanguages = Object.keys(searchEngine.getLanguageStats())

  // Handle filter changes
  const toggleFileType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      fileTypes: prev.fileTypes.includes(type)
        ? prev.fileTypes.filter(t => t !== type)
        : [...prev.fileTypes, type]
    }))
  }

  const toggleLanguage = (language: string) => {
    setFilters(prev => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter(l => l !== language)
        : [...prev.languages, language]
    }))
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => searchRef.current?.focus(), 100)
      }
      
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
        setResults([])
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <>
      {/* Search Trigger Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className={cn("w-full justify-start text-muted-foreground", className)}
      >
        <Search className="h-4 w-4 mr-2" />
        Search files... 
        <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
          Ctrl+K
        </kbd>
      </Button>

      {/* Search Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Search Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-2xl mx-4"
            >
              <Card className="shadow-2xl border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Search className="h-5 w-5 text-muted-foreground" />
                    <Input
                      ref={searchRef}
                      placeholder="Search files, functions, classes..."
                      value={query}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="border-0 shadow-none text-lg focus-visible:ring-0"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className={showFilters ? 'bg-accent' : ''}
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                {/* Filters */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t px-6 py-4 space-y-4"
                    >
                      {/* File Types */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">File Types</label>
                        <div className="flex flex-wrap gap-2">
                          {availableFileTypes.slice(0, 8).map(type => (
                            <Button
                              key={type}
                              variant={filters.fileTypes.includes(type) ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => toggleFileType(type)}
                              className="text-xs"
                            >
                              .{type}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Languages */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Languages</label>
                        <div className="flex flex-wrap gap-2">
                          {availableLanguages.slice(0, 6).map(language => (
                            <Button
                              key={language}
                              variant={filters.languages.includes(language) ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => toggleLanguage(language)}
                              className="text-xs capitalize"
                            >
                              {language}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Options */}
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.includeContent}
                            onChange={(e) => setFilters(prev => ({
                              ...prev,
                              includeContent: e.target.checked
                            }))}
                            className="rounded"
                          />
                          Search in content
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.caseSensitive}
                            onChange={(e) => setFilters(prev => ({
                              ...prev,
                              caseSensitive: e.target.checked
                            }))}
                            className="rounded"
                          />
                          Case sensitive
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.useRegex}
                            onChange={(e) => setFilters(prev => ({
                              ...prev,
                              useRegex: e.target.checked
                            }))}
                            className="rounded"
                          />
                          Use regex
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <CardContent className="max-h-96 overflow-auto">
                  {/* Suggestions */}
                  {suggestions.length > 0 && !query.trim() && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Suggestions</div>
                      <div className="grid grid-cols-2 gap-2">
                        {suggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSearch(suggestion)}
                            className="justify-start text-left"
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Loading */}
                  {isSearching && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Zap className="h-4 w-4 animate-pulse" />
                        Searching...
                      </div>
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-4 w-4" />
                          <div className="space-y-1 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Results */}
                  {!isSearching && results.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground mb-3">
                        {results.length} result{results.length !== 1 ? 's' : ''} found
                      </div>
                      {results.map((result, index) => (
                        <motion.div
                          key={`${result.file.id}-${index}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                          onClick={() => {
                            onFileSelect(result.file)
                            setIsOpen(false)
                            setQuery('')
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <FileCode className="h-4 w-4 text-info" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{result.file.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {result.file.path}
                              </div>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                  Score: {result.relevanceScore}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* No Results */}
                  {!isSearching && query.trim() && results.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <div className="text-sm">No files found matching "{query}"</div>
                      <div className="text-xs mt-1">Try different keywords or adjust filters</div>
                    </div>
                  )}

                  {/* Empty State */}
                  {!query.trim() && suggestions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <div className="text-sm">Start typing to search files</div>
                      <div className="text-xs mt-1">Search by filename, content, or file type</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
