// Define worker configuration
export const workerConfig = {
  // Base URL for workers - adjust based on your project structure
  baseUrl: process.env.PUBLIC_URL || '',
  
  // Worker path for clustering
  clusteringWorkerPath: '/clustering/clustering.worker',

  // Worker creation with error handling
  createWorker: (workerPath: string): Worker | undefined => {
    try {
      // Ensure we're in a browser environment
      if (typeof Window === 'undefined' || typeof Worker === 'undefined') {
        console.warn('Clustering worker is not supported in this environment');
        return undefined;
      }

      // Create worker with full path
      const fullPath = `${workerConfig.baseUrl}${workerPath}`;
      return new Worker(fullPath);
    } catch (error) {
      console.error('Error creating clustering worker:', error);
      return undefined;
    }
  }
};

// Helper function to safely initialize clustering worker
export function initializeClusteringWorker(): Worker | undefined {
  const worker = workerConfig.createWorker(workerConfig.clusteringWorkerPath);
  
  if (worker) {
    // Add error handling
    worker.onerror = (error) => {
      console.error('Clustering worker error:', error);
    };
    
    worker.onmessageerror = (error) => {
      console.error('Clustering worker message error:', error);
    };
  }
  
  return worker;
}

// Export clustering worker instance
export const clusteringWorker = initializeClusteringWorker(); 