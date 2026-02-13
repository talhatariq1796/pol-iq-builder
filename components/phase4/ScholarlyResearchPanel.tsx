'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  isPhase4FeatureEnabled, 
  getPhase4FeatureConfig 
} from '@/config/phase4-features';
import { 
  searchRelevantResearch, 
  type ResearchQuery as ServiceResearchQuery
} from '@/lib/integrations/scholarly-research-service';
import {
  BookOpen,
  ExternalLink,
  Star,
  Calendar,
  FileText,
  CheckCircle,
  Copy,
  Filter,
  RefreshCw
} from 'lucide-react';

// Types for scholarly research
interface ScholarlyPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  year: number;
  journal?: string;
  doi?: string;
  url?: string;
  citationCount: number;
  relevanceScore: number;
  source: 'pubmed' | 'arxiv' | 'semantic-scholar' | 'google-scholar';
  keywords: string[];
  isOpenAccess: boolean;
}

interface ScholarlyResearchPanelProps {
  analysisResult?: any;
  analysisContext?: {
    query: string;
    selectedAreaName: string;
    zipCodes: string[];
    endpoint: string;
    persona?: string;
  };
  onPaperSelect?: (paper: ScholarlyPaper) => void;
  onCiteInReport?: (paper: ScholarlyPaper) => void;
  className?: string;
}


/**
 * ScholarlyResearchPanel - Advanced Feature Implementation
 * 
 * This component is completely modular and will gracefully degrade
 * when the feature is disabled via feature flags.
 */
export const ScholarlyResearchPanel: React.FC<ScholarlyResearchPanelProps> = ({
  analysisResult,
  analysisContext,
  onPaperSelect,
  onCiteInReport,
  className
}) => {
  // Check if feature is enabled
  const isEnabled = isPhase4FeatureEnabled('scholarlyResearch');
  
  // State
  const [papers, setPapers] = useState<ScholarlyPaper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'citations' | 'year'>('relevance');
  const [hasSearched, setHasSearched] = useState(false);

  // If feature is disabled, return null (no UI)
  if (!isEnabled) {
    return null;
  }

  // Build contextual search query from analysis
  const buildContextualQuery = useCallback(() => {
    if (!analysisContext) return '';
    
    const { query, selectedAreaName, endpoint } = analysisContext;
    let searchTerms = [];
    
    // Add energy drink market-specific terms based on endpoint
    if (endpoint?.includes('demographic')) {
      searchTerms.push('energy drink consumer demographics', 'beverage market demographics');
    }
    if (endpoint?.includes('strategic')) {
      searchTerms.push('energy drink market strategy', 'beverage consumer behavior');
    }
    if (endpoint?.includes('competitive')) {
      searchTerms.push('energy drink brand competition', 'beverage market share');
    }
    
    // Add location context with energy drink focus
    if (selectedAreaName && selectedAreaName !== 'Custom Area') {
      searchTerms.push(selectedAreaName + ' energy drink market', 'regional beverage preferences');
    }
    
    // Add original query terms with energy drink context
    if (query) {
      searchTerms.push(query + ' energy drinks');
    }
    
    // Add energy drink industry-specific terms
    searchTerms.push('energy drink consumption patterns', 'caffeine beverage market', 'functional beverage demographics');
    
    return searchTerms.join(' ');
  }, [analysisContext]);

  // Automatic paper search based on analysis context
  const searchPapers = useCallback(async () => {
    const searchTerm = buildContextualQuery();
    if (!searchTerm || hasSearched) return;
    
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      const searchQuery: ServiceResearchQuery = {
        query: searchTerm,
        max_results: 10,
        relevance_threshold: 0.6,
        include_preprints: true
      };

      const response = await searchRelevantResearch(searchQuery);
      
      // Convert API response to component format
      const convertedPapers: ScholarlyPaper[] = response.papers.map((paper: any) => ({
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        abstract: paper.abstract || 'No abstract available',
        year: paper.published_date ? new Date(paper.published_date).getFullYear() : new Date().getFullYear(),
        journal: paper.journal || undefined,
        doi: paper.doi || undefined,
        url: paper.url,
        citationCount: paper.citation_count || 0,
        relevanceScore: paper.relevance_score,
        source: paper.source as ScholarlyPaper['source'],
        keywords: paper.keywords || [],
        isOpenAccess: true // Assume true for now
      }));
      
      setPapers(convertedPapers);
    } catch (error) {
      console.error('Error searching papers:', error);
      // Set empty array on error - no mock data in production
      setPapers([]);
    } finally {
      setIsLoading(false);
    }
  }, [buildContextualQuery, hasSearched]);

  // Auto-search when component mounts or context changes
  useEffect(() => {
    if (analysisContext && !hasSearched) {
      searchPapers();
    }
  }, [analysisContext, searchPapers, hasSearched]);

  // Sort papers
  const sortedPapers = useMemo(() => {
    const sorted = [...papers];
    switch (sortBy) {
      case 'relevance':
        return sorted.sort((a, b) => b.relevanceScore - a.relevanceScore);
      case 'citations':
        return sorted.sort((a, b) => b.citationCount - a.citationCount);
      case 'year':
        return sorted.sort((a, b) => b.year - a.year);
      default:
        return sorted;
    }
  }, [papers, sortBy]);

  // Filter by source
  const filteredPapers = useMemo(() => {
    if (selectedSource === 'all') return sortedPapers;
    return sortedPapers.filter(p => p.source === selectedSource);
  }, [sortedPapers, selectedSource]);

  // Handle citation formatting
  const formatCitation = useCallback((paper: ScholarlyPaper) => {
    const authors = paper.authors.join(', ');
    const year = paper.year;
    const title = paper.title;
    const journal = paper.journal || 'Preprint';
    const doi = paper.doi ? `, DOI: ${paper.doi}` : '';
    
    return `${authors} (${year}). ${title}. ${journal}${doi}`;
  }, []);

  // Handle copy citation
  const copyCitation = useCallback((paper: ScholarlyPaper) => {
    const citation = formatCitation(paper);
    navigator.clipboard.writeText(citation);
  }, [formatCitation]);

  // Get source color
  const getSourceColor = (source: string) => {
    switch (source) {
      case 'google-scholar': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'pubmed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'arxiv': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'semantic-scholar': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold">Scholarly Research</h3>
            <p className="text-xs text-muted-foreground">
              Academic papers supporting your analysis
            </p>
          </div>
        </div>
      </div>

      {/* Auto-search Status */}
      {isLoading && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Searching for relevant academic papers based on your analysis...
          </span>
        </div>
      )}
      
      {!isLoading && papers.length > 0 && (
        <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
          <span className="text-xs text-green-600 dark:text-green-400">
            Found {papers.length} relevant papers supporting your analysis
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setHasSearched(false);
              searchPapers();
            }}
            className="h-6 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <select
            value={selectedSource}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSource(e.target.value)}
            className="text-xs px-2 py-1 rounded border"
          >
            <option value="all">All Sources</option>
            <option value="google-scholar">Google Scholar</option>
            <option value="pubmed">PubMed</option>
            <option value="arxiv">arXiv</option>
            <option value="semantic-scholar">Semantic Scholar</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs px-2 py-1 rounded border"
          >
            <option value="relevance">Relevance</option>
            <option value="citations">Citations</option>
            <option value="year">Year</option>
          </select>
        </div>
        
        {analysisContext && (
          <Badge variant="secondary" className="text-xs">
            Context: {analysisContext.selectedAreaName || analysisContext.endpoint}
          </Badge>
        )}
      </div>

      {/* Results */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-4">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-12 w-full mb-2" />
                  <Skeleton className="h-3 w-1/4" />
                </CardContent>
              </Card>
            ))
          ) : filteredPapers.length > 0 ? (
            filteredPapers.map((paper) => (
              <Card 
                key={paper.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onPaperSelect?.(paper)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-xs line-clamp-2">
                        {paper.title}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {paper.authors.slice(0, 3).join(', ')}
                        {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
                      </CardDescription>
                    </div>
                    <Badge className={cn("text-xs", getSourceColor(paper.source))}>
                      {paper.source}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Abstract */}
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {paper.abstract}
                  </p>
                  
                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {paper.year}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {paper.citationCount} citations
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {Math.round(paper.relevanceScore * 100)}% relevant
                    </div>
                    {paper.isOpenAccess && (
                      <Badge variant="outline" className="text-xs">
                        Open Access
                      </Badge>
                    )}
                  </div>
                  
                  {/* Keywords */}
                  <div className="flex flex-wrap gap-1">
                    {paper.keywords.slice(0, 4).map((keyword) => (
                      <Badge key={keyword} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        copyCitation(paper);
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Citation
                    </Button>
                    
                    {onCiteInReport && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onCiteInReport(paper);
                        }}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Add to Report
                      </Button>
                    )}
                    
                    {paper.url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          window.open(paper.url, '_blank');
                        }}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Paper
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  No relevant papers found for this analysis
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setHasSearched(false);
                    searchPapers();
                  }}
                  className="mt-4"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Summary */}
      {filteredPapers.length > 0 && !isLoading && (
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Found {filteredPapers.length} relevant papers
          </p>
          <p className="text-xs text-muted-foreground">
            Avg. relevance: {Math.round(
              filteredPapers.reduce((acc, p) => acc + p.relevanceScore, 0) / 
              filteredPapers.length * 100
            )}%
          </p>
        </div>
      )}
    </div>
  );
};

export default ScholarlyResearchPanel;
