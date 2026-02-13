import { LayerConfig } from '@/types/layers';

export interface QueryHistoryItem {
  id: string;
  timestamp: Date;
  type: 'spatial' | 'temporal' | 'attribute' | 'combined';
  name: string;
  description?: string;
  layers: string[];
  settings: {
    spatial?: {
      operation: string;
      geometry?: any;
      bufferDistance?: number;
    };
    temporal?: {
      operation: string;
      startDate?: Date;
      endDate?: Date;
      useTimeRange?: boolean;
    };
    attribute?: {
      field: string;
      operator: string;
      value: any;
    };
  };
  results?: {
    featureCount: number;
    layers: {
      layerId: string;
      count: number;
    }[];
  };
  isFavorite: boolean;
}

export class QueryHistoryManager {
  private static instance: QueryHistoryManager;
  private readonly STORAGE_KEY = 'query_history';
  private readonly MAX_HISTORY_ITEMS = 100;
  private history: QueryHistoryItem[] = [];

  private constructor() {
    this.loadHistory();
  }

  public static getInstance(): QueryHistoryManager {
    if (!QueryHistoryManager.instance) {
      QueryHistoryManager.instance = new QueryHistoryManager();
    }
    return QueryHistoryManager.instance;
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading query history:', error);
      this.history = [];
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Error saving query history:', error);
    }
  }

  public addQuery(query: Omit<QueryHistoryItem, 'id' | 'timestamp' | 'isFavorite'>): string {
    const id = Math.random().toString(36).substring(2, 15);
    const newItem: QueryHistoryItem = {
      ...query,
      id,
      timestamp: new Date(),
      isFavorite: false
    };

    this.history.unshift(newItem);
    
    // Maintain maximum history size
    if (this.history.length > this.MAX_HISTORY_ITEMS) {
      this.history = this.history.slice(0, this.MAX_HISTORY_ITEMS);
    }

    this.saveHistory();
    return id;
  }

  public getQuery(id: string): QueryHistoryItem | undefined {
    return this.history.find(item => item.id === id);
  }

  public getAllQueries(): QueryHistoryItem[] {
    return [...this.history];
  }

  public getFavorites(): QueryHistoryItem[] {
    return this.history.filter(item => item.isFavorite);
  }

  public getQueriesByType(type: QueryHistoryItem['type']): QueryHistoryItem[] {
    return this.history.filter(item => item.type === type);
  }

  public getQueriesByLayer(layerId: string): QueryHistoryItem[] {
    return this.history.filter(item => item.layers.includes(layerId));
  }

  public toggleFavorite(id: string): boolean {
    const item = this.history.find(item => item.id === id);
    if (item) {
      item.isFavorite = !item.isFavorite;
      this.saveHistory();
      return item.isFavorite;
    }
    return false;
  }

  public updateQuery(id: string, updates: Partial<QueryHistoryItem>): boolean {
    const index = this.history.findIndex(item => item.id === id);
    if (index !== -1) {
      this.history[index] = {
        ...this.history[index],
        ...updates,
        timestamp: new Date() // Update timestamp on modification
      };
      this.saveHistory();
      return true;
    }
    return false;
  }

  public deleteQuery(id: string): boolean {
    const initialLength = this.history.length;
    this.history = this.history.filter(item => item.id !== id);
    if (this.history.length !== initialLength) {
      this.saveHistory();
      return true;
    }
    return false;
  }

  public clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  public searchQueries(searchTerm: string): QueryHistoryItem[] {
    const term = searchTerm.toLowerCase();
    return this.history.filter(item => 
      item.name.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.layers.some(layerId => layerId.toLowerCase().includes(term))
    );
  }

  public getRecentQueries(limit: number = 10): QueryHistoryItem[] {
    return this.history.slice(0, limit);
  }

  public getMostUsedQueries(limit: number = 10): QueryHistoryItem[] {
    // This would require tracking usage count, which we can add later
    return this.history.slice(0, limit);
  }
} 