'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';

interface SearchResult {
  searchId: string;
  query: string;
  status: string;
  totalQueued: number;
  createdAt: string;
}

interface SearchResponse {
  searchId: string;
  query: string;
  totalQueued: number;
}

type SearchMode = 'simple' | 'advanced';

export default function SearchPage() {
  const router = useRouter();
  const [searchMode, setSearchMode] = useState<SearchMode>('simple');
  
  // Simple mode
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState(1);
  
  // Advanced mode
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [patterns, setPatterns] = useState<string[]>([]);
  const [patternInput, setPatternInput] = useState('');
  const [location, setLocation] = useState('');
  const [delayMs, setDelayMs] = useState(200);
  const [deepSearch, setDeepSearch] = useState(false);
  const [searchDepth, setSearchDepth] = useState(1);
  
  // Common state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Calculate total jobs that will be created
  const estimatedJobs = useMemo(() => {
    if (searchMode === 'simple') {
      const estimatedUrls = 15 * pages; // ~15 URLs per page from Google
      return estimatedUrls;
    } else {
      // Advanced mode: keywords * URLs per keyword * patterns (if any)
      if (keywords.length === 0) return 0;
      const estimatedUrls = 15 * searchDepth;
      const totalJobs = keywords.length * estimatedUrls;
      return Math.min(totalJobs, 500); // Cap at 500 for display
    }
  }, [searchMode, pages, keywords.length, searchDepth]);

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const addPattern = () => {
    if (patternInput.trim() && !patterns.includes(patternInput.trim())) {
      setPatterns([...patterns, patternInput.trim()]);
      setPatternInput('');
    }
  };

  const removePattern = (index: number) => {
    setPatterns(patterns.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (searchMode === 'simple') {
      if (!query.trim()) {
        setError('Please enter a search query');
        return;
      }
      if (query.length < 3) {
        setError('Search query must be at least 3 characters');
        return;
      }
    } else {
      if (keywords.length === 0) {
        setError('Please add at least one keyword');
        return;
      }
      if (keywords.length > 10) {
        setError('Maximum 10 keywords per search');
        return;
      }
    }

    // Show preview warning for large jobs
    if (estimatedJobs > 200 && !window.confirm(
      `This search will create approximately ${estimatedJobs} extraction jobs. Continue?`
    )) {
      return;
    }

    setIsSubmitting(true);

    try {
      const searchPayload = searchMode === 'simple' 
        ? {
            query: query.trim(),
            pages: Math.min(Math.max(pages, 1), 5),
          }
        : {
            keywords: keywords,
            location: location.trim(),
            patterns: patterns,
            searchDepth: Math.min(Math.max(searchDepth, 1), 5),
            delayMs: delayMs,
          };

      // Use native fetch with automatic cookie handling
      const response = await fetch('/api/dashboard/search', {
        method: 'POST',
        credentials: 'include', // Send httpOnly cookies
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      setSuccess(`Search submitted! Created ${result.totalQueued} extraction jobs.`);
      
      // Reset form
      setQuery('');
      setPages(1);
      setKeywords([]);
      setKeywordInput('');
      setPatterns([]);
      setPatternInput('');
      setLocation('');
      setDelayMs(200);
      setDeepSearch(false);
      setSearchDepth(1);
      setShowPreview(false);

      // Add to recent searches
      const displayQuery = searchMode === 'simple' 
        ? query 
        : `${keywords.join(', ')} ${location}`;
      
      setRecentSearches([
        {
          searchId: result.searchId,
          query: displayQuery,
          status: 'running',
          totalQueued: result.totalQueued,
          createdAt: new Date().toISOString(),
        },
        ...recentSearches,
      ].slice(0, 5));
    } catch (err) {
      let message = 'Failed to submit search';
      if (err instanceof ApiError) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      console.error('[search] Error submitting search:', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Business Email Discovery</h1>
        <p className="text-muted-foreground mt-1">
          Find and extract business emails using advanced search options
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={searchMode === 'simple' ? 'default' : 'outline'}
          onClick={() => setSearchMode('simple')}
          className="flex-1"
        >
          Quick Search
        </Button>
        <Button
          variant={searchMode === 'advanced' ? 'default' : 'outline'}
          onClick={() => setSearchMode('advanced')}
          className="flex-1"
        >
          Advanced Discovery
        </Button>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {searchMode === 'simple' ? 'Quick Search' : 'Business Discovery'}
          </CardTitle>
          <CardDescription>
            {searchMode === 'simple' 
              ? 'Enter a search query to find relevant websites'
              : 'Define keywords, patterns, and location for targeted discovery'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Alert */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Success Alert */}
            {success && (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
              </div>
            )}

            {/* SIMPLE MODE */}
            {searchMode === 'simple' && (
              <>
                <div>
                  <label htmlFor="query" className="block text-sm font-medium text-foreground mb-2">
                    Search Query *
                  </label>
                  <input
                    id="query"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g., tech startups san francisco"
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isSubmitting}
                    minLength={3}
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {query.length} / 200 characters
                  </p>
                </div>

                <div>
                  <label htmlFor="pages" className="block text-sm font-medium text-foreground mb-2">
                    Search Results Pages
                  </label>
                  <input
                    id="pages"
                    type="number"
                    value={pages}
                    onChange={(e) => setPages(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 5))}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isSubmitting}
                    min={1}
                    max={5}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    1 - 5 pages (more pages = more jobs)
                  </p>
                </div>

                <div className="pt-2 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-foreground font-medium">
                    Estimated emails: ~{estimatedJobs} websites
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Actual count depends on search results
                  </p>
                </div>
              </>
            )}

            {/* ADVANCED MODE */}
            {searchMode === 'advanced' && (
              <>
                {/* Keywords Section */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Keywords * (Business Type/Role)
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                      placeholder="e.g., hedge fund manager, real estate broker"
                      className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isSubmitting}
                      maxLength={100}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addKeyword}
                      disabled={isSubmitting || !keywordInput.trim() || keywords.length >= 10}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((kw, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 px-3 py-1 bg-primary/10 border border-primary/30 rounded-full text-sm"
                        >
                          <span>{kw}</span>
                          <button
                            type="button"
                            onClick={() => removeKeyword(idx)}
                            className="hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {keywords.length} / 10 keywords added
                  </p>
                </div>

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-foreground mb-2">
                    Location (Optional)
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Florida, USA; London; Singapore"
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isSubmitting}
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Helps filter results to specific regions
                  </p>
                </div>

                {/* Email Patterns */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email Patterns (Optional)
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={patternInput}
                      onChange={(e) => setPatternInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPattern())}
                      placeholder="e.g., @company.com, @domain.org"
                      className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isSubmitting}
                      maxLength={100}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addPattern}
                      disabled={isSubmitting || !patternInput.trim() || patterns.length >= 10}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {patterns.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {patterns.map((pattern, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 px-3 py-1 bg-secondary/30 border border-secondary rounded-full text-sm"
                        >
                          <span>{pattern}</span>
                          <button
                            type="button"
                            onClick={() => removePattern(idx)}
                            className="hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Only extract emails matching these domains. Max {10 - patterns.length} more.
                  </p>
                </div>

                {/* Search Depth & Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="searchDepth" className="block text-sm font-medium text-foreground mb-2">
                      Search Depth
                    </label>
                    <input
                      id="searchDepth"
                      type="number"
                      value={searchDepth}
                      onChange={(e) => setSearchDepth(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 5))}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isSubmitting}
                      min={1}
                      max={5}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Pages per keyword (1-5)
                    </p>
                  </div>

                  <div>
                    <label htmlFor="delay" className="block text-sm font-medium text-foreground mb-2">
                      Request Delay (ms)
                    </label>
                    <input
                      id="delay"
                      type="number"
                      value={delayMs}
                      onChange={(e) => setDelayMs(Math.min(Math.max(parseInt(e.target.value) || 100, 100), 2000))}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isSubmitting}
                      min={100}
                      max={2000}
                      step={100}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Delay between requests (100-2000ms)
                    </p>
                  </div>
                </div>

                {/* Deep Search Toggle */}
                <div className="flex items-center p-3 border border-border rounded-lg bg-muted/50">
                  <input
                    id="deepSearch"
                    type="checkbox"
                    checked={deepSearch}
                    onChange={(e) => setDeepSearch(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="deepSearch" className="ml-3 text-sm font-medium text-foreground cursor-pointer flex-1">
                    Deep Search (Enhanced)
                  </label>
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                    Pro
                  </span>
                </div>

                {/* Job Estimate */}
                <div className="pt-2 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-foreground font-medium">
                    Estimated emails: ~{estimatedJobs} websites
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {keywords.length} keywords × ~{15 * searchDepth} URLs per keyword
                  </p>
                </div>

                {/* Preview Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPreview ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide Preview
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show Preview
                    </>
                  )}
                </button>

                {/* Search Preview */}
                {showPreview && (
                  <div className="p-4 bg-muted rounded-lg border border-border space-y-3">
                    <h4 className="font-medium text-sm text-foreground">Search Preview</h4>
                    
                    {keywords.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Keywords to search:</p>
                        <div className="space-y-1">
                          {keywords.map((kw, idx) => (
                            <div key={idx} className="text-xs p-2 bg-background rounded border border-border">
                              "{kw}" {location && `in ${location}`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {patterns.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Filter by email domains:</p>
                        <div className="flex flex-wrap gap-1">
                          {patterns.map((p, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-background rounded border border-border">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      <p>Search depth: {searchDepth} page{searchDepth !== 1 ? 's' : ''}</p>
                      <p>Request delay: {delayMs}ms</p>
                      {deepSearch && <p className="text-blue-600 dark:text-blue-400">Deep search enabled</p>}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || (searchMode === 'simple' ? !query.trim() : keywords.length === 0)}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? 'Starting Search...' : `Start Search (${estimatedJobs} websites)`}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Searches</CardTitle>
            <CardDescription>Your recent search submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSearches.map((search) => (
                <div
                  key={search.searchId}
                  className="p-3 border border-border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => router.push(`/dashboard/jobs`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{search.query}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {search.totalQueued} jobs • {new Date(search.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                      {search.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
