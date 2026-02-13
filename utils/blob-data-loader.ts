// Utility to load large endpoint data files from Vercel Blob storage
// This avoids the 100MB deployment limit by storing large files externally

type BlobEndpointData = Record<string, unknown>;

// Cache for blob data to avoid repeated fetches
const blobDataCache = new Map<string, unknown>();

// Cache for blob URL mappings
let blobUrlMappings: Record<string, string> | null = null;

/**
 * Load blob URL mappings from the static file
 */
async function loadBlobUrlMappings(): Promise<Record<string, string>> {
  if (blobUrlMappings !== null) {
    return blobUrlMappings;
  }

  try {
    // Check if we're running in browser or server context
    if (typeof window !== 'undefined') {
      // Browser context - use standardized mapping file
      const response = await fetch('/data/blob-urls.json');
      if (response.ok) {
        blobUrlMappings = await response.json();
        return blobUrlMappings!;
      }
    } else {
      // Server context - load directly from file system
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public/data/blob-urls.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      blobUrlMappings = JSON.parse(fileContent);
      return blobUrlMappings!;
    }
  } catch (error) {
    console.warn('Failed to load blob URL mappings:', error);
  }

  blobUrlMappings = {};
  return blobUrlMappings;
}

/**
 * Load endpoint data from Vercel Blob storage
 * Falls back to local files if blob storage fails
 */
export async function loadEndpointData(endpoint: string): Promise<BlobEndpointData | null> {
  // Check cache first
  if (blobDataCache.has(endpoint)) {
    return blobDataCache.get(endpoint) as BlobEndpointData;
  }

  try {
    // Load blob URL mappings and get the actual URL
    const urlMappings = await loadBlobUrlMappings();
    const actualBlobUrl = urlMappings[endpoint];
    
    if (actualBlobUrl) {
      const response = await fetch(actualBlobUrl);
      
      if (response.ok) {
  const data = (await response.json()) as BlobEndpointData;
  blobDataCache.set(endpoint, data);
        console.log(`✅ Loaded ${endpoint} from blob storage`);
        return data;
      }
    } else {
      console.warn(`No blob URL mapping found for endpoint: ${endpoint}`);
    }
  } catch (error) {
    console.warn(`Failed to load ${endpoint} from blob storage:`, error);
  }

  try {
    // Fallback to local file
    if (typeof window !== 'undefined') {
      // Browser context
      const localResponse = await fetch(`/data/endpoints/${endpoint}.json`);
      if (localResponse.ok) {
        const data = await localResponse.json();
        blobDataCache.set(endpoint, data);
        return data;
      }
    } else {
      // Server context - load directly from file system
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public/data/endpoints', `${endpoint}.json`);
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent) as BlobEndpointData;
        blobDataCache.set(endpoint, data);
        console.log(`✅ Loaded ${endpoint} from local file system`);
        return data;
      } catch {
        console.warn(`Local file not found: ${filePath}`);
      }
    }
  } catch (error) {
    console.warn(`Failed to load ${endpoint} from local storage:`, error);
  }

  return null;
}

/**
 * Upload endpoint data to Vercel Blob storage with project-specific directory
 * This would be used in a migration script
 */
export async function uploadEndpointData(endpoint: string, data: unknown, projectDir: string = 'endpoints'): Promise<string | null> {
  try {
    const { put } = await import('@vercel/blob');
    
  const blob = await put(`${projectDir}/${endpoint}.json`, JSON.stringify(data as unknown as object), {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log(`Uploaded ${endpoint} to blob storage (${projectDir}):`, blob.url);
    return blob.url;
  } catch (error) {
    console.error(`Failed to upload ${endpoint} to blob storage:`, error);
    return null;
  }
}

/**
 * Upload endpoint data to energy project directory
 */
export async function uploadEnergyEndpointData(endpoint: string, data: unknown): Promise<string | null> {
  return uploadEndpointData(endpoint, data, 'energy');
}

/**
 * Load boundary data from Vercel Blob storage
 * Falls back to local files if blob storage fails
 */
export async function loadBoundaryData(boundaryName: string): Promise<unknown | null> {
  const cacheKey = `boundary_${boundaryName}`;
  
  // Check cache first
  if (blobDataCache.has(cacheKey)) {
    return blobDataCache.get(cacheKey);
  }

  try {
    // Load blob URL mappings and get the actual URL for boundaries
    const urlMappings = await loadBlobUrlMappings();
    const boundaryKey = `boundaries/${boundaryName}`;
    const actualBlobUrl = urlMappings[boundaryKey];
    
    if (actualBlobUrl) {
      const response = await fetch(actualBlobUrl);
      
      if (response.ok) {
  const data = (await response.json()) as unknown;
        blobDataCache.set(cacheKey, data);
        console.log(`✅ Loaded ${boundaryName} boundary from blob storage`);
        return data;
      }
    } else {
      console.warn(`No blob URL mapping found for boundary: ${boundaryKey}`);
    }
  } catch (error) {
    console.warn(`Failed to load ${boundaryName} boundary from blob storage:`, error);
  }

  try {
    // Fallback to local file
    if (typeof window !== 'undefined') {
      // Browser context
      const localResponse = await fetch(`/data/boundaries/${boundaryName}.json`);
      if (localResponse.ok) {
        const data = await localResponse.json();
        blobDataCache.set(cacheKey, data);
        console.log(`✅ Loaded ${boundaryName} boundary from local file`);
        return data;
      }
    } else {
      // Server context - load directly from file system
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public/data/boundaries', `${boundaryName}.json`);
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent) as unknown;
        blobDataCache.set(cacheKey, data);
        console.log(`✅ Loaded ${boundaryName} boundary from local file system`);
        return data;
      } catch {
        console.warn(`Local boundary file not found: ${filePath}`);
      }
    }
  } catch (error) {
    console.warn(`Failed to load ${boundaryName} boundary from local storage:`, error);
  }

  return null;
}

/**
 * Clear the cache for a specific endpoint/boundary or all cached data
 */
export function clearBlobDataCache(endpoint?: string): void {
  if (endpoint) {
    blobDataCache.delete(endpoint);
    // Also clear boundary cache if it might be a boundary
    blobDataCache.delete(`boundary_${endpoint}`);
  } else {
    blobDataCache.clear();
  }
}