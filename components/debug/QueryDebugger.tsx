import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface QueryDebuggerProps {
  layerMatches: Array<{
    layerId: string;
    relevance: number;
    confidence: number;
  }>;
  sqlQuery: string;
  features: any[];
  onDebugComplete: (results: any) => void;
}

const QueryDebugger: React.FC<QueryDebuggerProps> = ({
  layerMatches,
  sqlQuery,
  features,
  onDebugComplete
}) => {
  const [debugResults, setDebugResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateQuery = async () => {
      try {
        // Basic validation checks
        const issues = [];
        
        // Check layer matches
        if (layerMatches.length > 5) {
          issues.push('Too many layer matches. Consider limiting to most relevant layers.');
        }

        // Check SQL query
        if (!sqlQuery || sqlQuery === '1=1') {
          issues.push('SQL query is too generic. Ensure specific conditions are being generated.');
        }

        // Check for proper field references
        const fieldPattern = /[A-Za-z_][A-Za-z0-9_]*\s*[=<>]/;  // Matches field_name = or field_name > etc.
        if (!sqlQuery.match(fieldPattern)) {
          issues.push('No field references found in query. Ensure proper field names are being used.');
        }

        // Feature validation
        if (!features || features.length === 0) {
          issues.push('No features returned. Query may be too restrictive.');
        }

        const results = {
          layerMatchCount: layerMatches.length,
          sqlQueryValid: sqlQuery !== '1=1',
          featureCount: features?.length || 0,
          issues: issues,
          referencedFields: sqlQuery.match(fieldPattern) || []
        };

        setDebugResults(results);
        onDebugComplete(results);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error during debugging');
      }
    };

    validateQuery();
  }, [layerMatches, sqlQuery, features, onDebugComplete]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">Query Debug Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="font-semibold">Layer Matches:</div>
            <div>{debugResults?.layerMatchCount || 0}</div>
            
            <div className="font-semibold">SQL Query Valid:</div>
            <div>{debugResults?.sqlQueryValid ? 'Yes' : 'No'}</div>
            
            <div className="font-semibold">Features Found:</div>
            <div>{debugResults?.featureCount || 0}</div>
          </div>

          {debugResults?.issues.length > 0 && (
            <div className="mt-4">
              <div className="font-semibold mb-2">Issues Found:</div>
              <ul className="list-disc pl-4">
                {debugResults.issues.map((issue: string, index: number) => (
                  <li key={index} className="text-red-600">{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default QueryDebugger;