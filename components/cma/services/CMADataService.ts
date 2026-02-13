import fs from 'fs';
import path from 'path';

/**
 * CMADataService - Isolated service for Page 3 table data
 * Loads from comparative-market-analysis.json for living_area field
 * DOES NOT replace PropertyDataService - only supplements Page 3 table
 * Works both client-side (fetch) and server-side (fs)
 */
export class CMADataService {
  private static instance: CMADataService;
  private cmaData: Map<string, CMATableData> = new Map();
  private isLoaded = false;

  private constructor() {}

  static getInstance(): CMADataService {
    if (!CMADataService.instance) {
      CMADataService.instance = new CMADataService();
    }
    return CMADataService.instance;
  }

  async loadCMAData(): Promise<void> {
    if (this.isLoaded) return;

    try {
      let data: any;

      // Check if running server-side (Node.js) or client-side (browser)
      if (typeof window === 'undefined') {
        // Server-side: Use fs to read file
        const filePath = path.join(process.cwd(), 'public', 'data', 'real-estate', 'comparative-market-analysis.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(fileContent);
      } else {
        // Client-side: Use fetch
        const response = await fetch('/data/real-estate/comparative-market-analysis.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch CMA data: ${response.statusText}`);
        }
        data = await response.json();
      }

      const features = data.features || [];

      // Build lookup map by mls_number (centris_no)
      features.forEach((feature: any) => {
        const props = feature.properties;
        const mlsNumber = props.mls_number?.toString();

        if (mlsNumber) {
          this.cmaData.set(mlsNumber, {
            address: props.address,
            municipality: props.municipality,
            postal_code: props.postal_code,
            living_area: props.living_area,
            mls_number: props.mls_number,
          });
        }
      });

      this.isLoaded = true;
      console.log(`[CMADataService] Loaded ${this.cmaData.size} properties with living_area data`);
      console.log(`[CMADataService] First 5 keys:`, Array.from(this.cmaData.keys()).slice(0, 5));
    } catch (error) {
      console.error('[CMADataService] Failed to load CMA data:', error);
    }
  }

  /**
   * Get Page 3 table data by MLS number
   */
  getCMATableData(mlsNumber: string | number): CMATableData | null {
    const key = mlsNumber?.toString();
    const result = key ? this.cmaData.get(key) || null : null;

    // Log first 3 lookups for debugging
    if (this.cmaData.size > 0 && Math.random() < 0.3) {
      console.log(`[CMADataService] Lookup: key="${key}", found=${!!result}`);
    }

    return result;
  }
}

export interface CMATableData {
  address: string;
  municipality: string;
  postal_code: string;
  living_area: number | null;
  mls_number: number;
}
