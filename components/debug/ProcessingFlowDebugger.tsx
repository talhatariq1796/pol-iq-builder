import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Activity, AlertCircle } from 'lucide-react';

interface ProcessedLayerState {
  queryResults?: {
    features: any[];
    fields: any[];
    hasQueryResults: boolean;
  };
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface ProcessingFlowDebuggerProps {
  query: string;
  layerStates: Record<string, ProcessedLayerState>;
  processingType: 'TRADITIONAL' | 'AI' | 'HYBRID';
  onProcessingComplete?: (result: any) => void;
}

const ProcessingFlowDebugger: React.FC<ProcessingFlowDebuggerProps> = ({ 
  query,
  layerStates,
  processingType,
  onProcessingComplete
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<'initializing' | 'processing' | 'complete' | 'error'>('initializing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const debugFlow = async () => {
      try {
        setStatus('processing');
        setLogs((prev: any[]) => [...prev, {
          timestamp: new Date().toISOString(),
          message: `Starting ${processingType} processing`,
          type: 'info'
        }]);

        // Monitor the processing flow
        const processingStart = Date.now();
        
        // Check layer states
        const layerCount = Object.keys(layerStates || {}).length;
        setLogs((prev: LogEntry[]) => [...prev, {
          timestamp: new Date().toISOString(),
          message: `Found ${layerCount} layers to process`,
          type: 'info'
        }]);

        if (layerCount === 0) {
          throw new Error('No layer states available for processing');
        }

        // Validate layers have features
        const layersWithFeatures = Object.values(layerStates).filter(
          state => state?.queryResults?.features?.length ?? 0 > 0
        ).length;

        setLogs((prev: LogEntry[]) => [...prev, {
          timestamp: new Date().toISOString(),
          message: `${layersWithFeatures} layers contain features`,
          type: layersWithFeatures > 0 ? 'success' : 'warning'
        }]);

        // Check processing duration
        const duration = Date.now() - processingStart;
        setLogs((prev: LogEntry[]) => [...prev, {
          timestamp: new Date().toISOString(),
          message: `Processing completed in ${duration}ms`,
          type: 'info'
        }]);

        setStatus('complete');
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setError(errorMessage);
        setStatus('error');
        setLogs((prev: LogEntry[]) => [...prev, {
          timestamp: new Date().toISOString(),
          message: `Error: ${errorMessage}`,
          type: 'error'
        }]);
      }
    };

    debugFlow();
  }, [query, layerStates, processingType]);

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Processing Flow Debug
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <div className="text-sm font-medium">Status: {status}</div>
          <div className="text-sm font-medium">Query: {query}</div>
          <div className="text-sm font-medium">Processing Type: {processingType}</div>
          
          <div className="border rounded-md p-2 mt-4 bg-gray-50 max-h-48 overflow-y-auto">
            {logs.map((log, i) => (
              <div 
                key={i} 
                className={`text-sm mb-1 ${
                  log.type === 'error' ? 'text-red-600' :
                  log.type === 'warning' ? 'text-yellow-600' :
                  log.type === 'success' ? 'text-green-600' :
                  'text-gray-600'
                }`}
              >
                [{log.timestamp.split('T')[1].split('.')[0]}] {log.message}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProcessingFlowDebugger;