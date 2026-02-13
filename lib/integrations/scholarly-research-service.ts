interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  published_date: string;
  doi?: string;
  arxiv_id?: string;
  url: string;
  citation_count?: number;
  relevance_score: number;
  source: 'arxiv' | 'crossref' | 'core';
  keywords: string[];
  journal?: string;
}

interface ResearchQuery {
  query: string;
  max_results: number;
  relevance_threshold: number;
  include_preprints: boolean;
  date_range?: {
    start: string;
    end: string;
  };
}

interface ResearchResponse {
  papers: ResearchPaper[];
  total_found: number;
  query_used: string;
  search_time_ms: number;
  sources_searched: string[];
  cache_status: 'fresh' | 'cached' | 'stale';
}

class ScholarlyResearchService {
  private cacheMap = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private arxivBaseUrl: string;
  private crossrefBaseUrl: string;
  private coreBaseUrl: string;

  constructor() {
    this.arxivBaseUrl = process.env.ARXIV_API_BASE_URL || 'http://export.arxiv.org/api/query';
    this.crossrefBaseUrl = process.env.CROSSREF_API_BASE_URL || 'https://api.crossref.org/works';
    this.coreBaseUrl = process.env.CORE_API_BASE_URL || 'https://core.ac.uk/api-v2';
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.cacheMap.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.timestamp + cached.ttl) {
      this.cacheMap.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  private setCachedData<T>(key: string, data: T, ttlSeconds: number = 7200): void {
    this.cacheMap.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    });
  }

  async searchArxiv(query: string, maxResults: number = 10): Promise<ResearchPaper[]> {
    try {
      // Clean and format query for arXiv
      const cleanQuery = this.formatArxivQuery(query);
      const url = `${this.arxivBaseUrl}?search_query=${encodeURIComponent(cleanQuery)}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

      const response = await fetch(url);
      const xmlText = await response.text();
      
      // Parse arXiv XML response
      return this.parseArxivResponse(xmlText);

    } catch (error) {
      console.error('Error searching arXiv:', error);
      return [];
    }
  }

  async searchCrossref(query: string, maxResults: number = 10): Promise<ResearchPaper[]> {
    try {
      const url = `${this.crossrefBaseUrl}?query=${encodeURIComponent(query)}&rows=${maxResults}&sort=relevance&order=desc&filter=type:journal-article`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'ok' && data.message && data.message.items) {
        return this.parseCrossrefResponse(data.message.items);
      }

      return [];

    } catch (error) {
      console.error('Error searching CrossRef:', error);
      return [];
    }
  }

  async searchCore(query: string, maxResults: number = 10): Promise<ResearchPaper[]> {
    try {
      // Use CORE's free search endpoint (no API key required for basic search)
      const url = `https://core.ac.uk/api-v2/articles/search?query=${encodeURIComponent(query)}&page=1&pageSize=${maxResults}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        return this.parseCoreResponse(data.data);
      }

      return [];

    } catch (error) {
      console.error('Error searching CORE:', error);
      return [];
    }
  }

  async searchRelevantResearch(queryConfig: ResearchQuery): Promise<ResearchResponse> {
    const startTime = Date.now();
    const cacheKey = `research-${JSON.stringify(queryConfig)}`;
    
    // Check cache first
    const cached = this.getCachedData<ResearchResponse>(cacheKey);
    if (cached) {
      return { ...cached, cache_status: 'cached' };
    }

    try {
      // Enhance query for academic context
      const enhancedQuery = this.enhanceQueryForAcademicSearch(queryConfig.query);
      
      // Search multiple sources in parallel
      const searchPromises = [
        this.searchArxiv(enhancedQuery, Math.ceil(queryConfig.max_results / 3)),
        this.searchCrossref(enhancedQuery, Math.ceil(queryConfig.max_results / 3)),
        this.searchCore(enhancedQuery, Math.ceil(queryConfig.max_results / 3))
      ];

      const [arxivResults, crossrefResults, coreResults] = await Promise.all(
        searchPromises.map(p => p.catch(error => {
          console.warn('Search source failed:', error);
          return [];
        }))
      );

      // Combine and deduplicate results
      const allResults = [...arxivResults, ...crossrefResults, ...coreResults];
      const deduplicatedResults = this.deduplicatePapers(allResults);

      // Calculate relevance scores and filter
      const scoredResults = deduplicatedResults
        .map(paper => ({
          ...paper,
          relevance_score: this.calculateRelevanceScore(paper, queryConfig.query)
        }))
        .filter(paper => paper.relevance_score >= queryConfig.relevance_threshold)
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, queryConfig.max_results);

      const response: ResearchResponse = {
        papers: scoredResults,
        total_found: allResults.length,
        query_used: enhancedQuery,
        search_time_ms: Date.now() - startTime,
        sources_searched: ['arxiv', 'crossref', 'core'],
        cache_status: 'fresh'
      };

      // Cache the results
      this.setCachedData(cacheKey, response, 7200); // 2 hour cache

      return response;

    } catch (error) {
      console.error('Error in research search:', error);
      
      return {
        papers: [],
        total_found: 0,
        query_used: queryConfig.query,
        search_time_ms: Date.now() - startTime,
        sources_searched: [],
        cache_status: 'stale'
      };
    }
  }

  private formatArxivQuery(query: string): string {
    // Format query for arXiv's search syntax
    // Focus on relevant categories: stat (Statistics), econ (Economics), cs (Computer Science)
    const keywords = query.toLowerCase();
    let formattedQuery = query;

    // Add relevant arXiv categories
    if (keywords.includes('demographic') || keywords.includes('population')) {
      formattedQuery += ' AND (cat:stat.AP OR cat:econ.EM)';
    }
    if (keywords.includes('geographic') || keywords.includes('spatial')) {
      formattedQuery += ' AND (cat:stat.AP OR cat:cs.CY)';
    }
    if (keywords.includes('market') || keywords.includes('consumer')) {
      formattedQuery += ' AND cat:econ.EM';
    }

    return formattedQuery;
  }

  private parseArxivResponse(xmlText: string): ResearchPaper[] {
    try {
      // Simple XML parsing for arXiv feed
      const papers: ResearchPaper[] = [];
      const entries = xmlText.match(/<entry>([\s\S]*?)<\/entry>/g) || [];

      entries.forEach((entry, index) => {
        const title = this.extractXmlContent(entry, 'title')?.replace(/\s+/g, ' ').trim() || '';
        const summary = this.extractXmlContent(entry, 'summary')?.replace(/\s+/g, ' ').trim() || '';
        const published = this.extractXmlContent(entry, 'published') || '';
        const arxivId = this.extractXmlContent(entry, 'id')?.split('/').pop() || '';
        
        // Extract authors
        const authorMatches = entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g) || [];
        const authors = authorMatches.map(match => {
          const name = this.extractXmlContent(match, 'name');
          return name || '';
        }).filter(name => name);

        if (title && summary) {
          papers.push({
            id: `arxiv-${arxivId}`,
            title,
            authors,
            abstract: summary,
            published_date: published,
            arxiv_id: arxivId,
            url: `https://arxiv.org/abs/${arxivId}`,
            relevance_score: 0.5, // Will be calculated later
            source: 'arxiv' as const,
            keywords: this.extractKeywordsFromText(title + ' ' + summary)
          });
        }
      });

      return papers;

    } catch (error) {
      console.error('Error parsing arXiv response:', error);
      return [];
    }
  }

  private parseCrossrefResponse(items: any[]): ResearchPaper[] {
    return items.map((item, index) => {
      const authors = item.author ? item.author.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()) : [];
      const publishedDate = item.published ? this.formatCrossrefDate(item.published) : '';
      
      return {
        id: `crossref-${item.DOI || index}`,
        title: Array.isArray(item.title) ? item.title[0] : item.title || '',
        authors,
        abstract: item.abstract || '',
        published_date: publishedDate,
        doi: item.DOI,
        url: `https://doi.org/${item.DOI}`,
        citation_count: item['is-referenced-by-count'] || 0,
        relevance_score: 0.5, // Will be calculated later
        source: 'crossref' as const,
        keywords: this.extractKeywordsFromText((item.title || '').toString()),
        journal: Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title']
      };
    }).filter(paper => paper.title);
  }

  private parseCoreResponse(items: any[]): ResearchPaper[] {
    return items.map((item, index) => ({
      id: `core-${item.id || index}`,
      title: item.title || '',
      authors: item.authors ? item.authors.map((a: any) => a.name || a).filter(Boolean) : [],
      abstract: item.description || item.abstract || '',
      published_date: item.publishedDate || item.year || '',
      doi: item.doi || undefined,
      url: item.downloadUrl || item.fulltextUrls?.[0] || `https://core.ac.uk/display/${item.id}`,
      relevance_score: 0.5, // Will be calculated later
      source: 'core' as const,
      keywords: this.extractKeywordsFromText(item.title || ''),
      journal: item.journals?.[0]?.title
    })).filter(paper => paper.title);
  }

  private extractXmlContent(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's');
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private formatCrossrefDate(dateArray: number[]): string {
    if (Array.isArray(dateArray) && dateArray.length >= 1) {
      const year = dateArray[0];
      const month = dateArray[1] || 1;
      const day = dateArray[2] || 1;
      return new Date(year, month - 1, day).toISOString().split('T')[0];
    }
    return '';
  }

  private deduplicatePapers(papers: ResearchPaper[]): ResearchPaper[] {
    const seen = new Set<string>();
    return papers.filter(paper => {
      // Use multiple criteria for deduplication
      const key = paper.doi || 
                 paper.arxiv_id || 
                 paper.title.toLowerCase().replace(/\s+/g, ' ').trim();
      
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private calculateRelevanceScore(paper: ResearchPaper, originalQuery: string): number {
    let score = 0.5; // Base score

    const queryTerms = originalQuery.toLowerCase().split(/\s+/);
    const paperText = `${paper.title} ${paper.abstract}`.toLowerCase();

    // Title relevance (high weight)
    const titleMatches = queryTerms.filter(term => 
      paper.title.toLowerCase().includes(term)
    ).length;
    score += (titleMatches / queryTerms.length) * 0.4;

    // Abstract relevance (medium weight)
    const abstractMatches = queryTerms.filter(term => 
      paper.abstract.toLowerCase().includes(term)
    ).length;
    score += (abstractMatches / queryTerms.length) * 0.3;

    // Citation count bonus (if available)
    if (paper.citation_count && paper.citation_count > 0) {
      score += Math.min(paper.citation_count / 100, 0.2); // Max 0.2 bonus
    }

    // Recent publication bonus
    if (paper.published_date) {
      const publishedYear = new Date(paper.published_date).getFullYear();
      const currentYear = new Date().getFullYear();
      const yearsDiff = currentYear - publishedYear;
      if (yearsDiff <= 5) {
        score += (5 - yearsDiff) * 0.02; // Max 0.1 bonus for very recent papers
      }
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  private extractKeywordsFromText(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Remove common academic words
    const stopWords = new Set(['paper', 'study', 'research', 'analysis', 'data', 'results', 'method', 'approach']);
    return Array.from(new Set(words.filter(word => !stopWords.has(word)))).slice(0, 10);
  }

  private enhanceQueryForAcademicSearch(query: string): string {
    // Add academic context terms to improve relevance
    const academicTerms = [
      'demographic analysis',
      'geographic information systems',
      'spatial analysis',
      'consumer behavior',
      'market research',
      'statistical analysis'
    ];

    const lowerQuery = query.toLowerCase();
    const relevantTerms = academicTerms.filter(term => 
      lowerQuery.includes(term.split(' ')[0])
    );

    return relevantTerms.length > 0 ? 
      `${query} ${relevantTerms[0]}` : 
      query;
  }

  // Test API connectivity
  async testConnectivity(): Promise<{ arxiv: boolean; crossref: boolean; core: boolean }> {
    const tests = await Promise.all([
      this.testArxivConnection(),
      this.testCrossrefConnection(),
      this.testCoreConnection()
    ]);

    return {
      arxiv: tests[0],
      crossref: tests[1],
      core: tests[2]
    };
  }

  private async testArxivConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.arxivBaseUrl}?search_query=test&max_results=1`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async testCrossrefConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.crossrefBaseUrl}?query=test&rows=1`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async testCoreConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://core.ac.uk/api-v2/articles/search?query=test&pageSize=1');
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance with caching
const scholarlyResearchService = new ScholarlyResearchService();

// Export functions for Next.js usage
export const searchRelevantResearch = async (query: ResearchQuery): Promise<ResearchResponse> => {
  return scholarlyResearchService.searchRelevantResearch(query);
};

export const testResearchConnectivity = async () => {
  return scholarlyResearchService.testConnectivity();
};

export { scholarlyResearchService };
export type { ResearchPaper, ResearchQuery, ResearchResponse };