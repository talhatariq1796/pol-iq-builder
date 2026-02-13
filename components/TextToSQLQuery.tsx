import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface QueryResult {
  text: string;
  features: any[]; // Replace with your ArcGIS feature type
}

interface TextToSQLProps {
  featureServiceUrl: string;
  onFeaturesFound: (features: any[]) => void;
}

const TextToSQLQuery: React.FC<TextToSQLProps> = ({ 
  featureServiceUrl, 
  onFeaturesFound 
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);

  const convertToSQL = async (text: string) => {
    try {
      const response = await fetch('/api/claude/text-to-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant that converts natural language questions into SQL queries for an ArcGIS Feature Service. Rules:
                - Output only the SQL WHERE clause (no SELECT or FROM)
                - Use valid ArcGIS SQL syntax
                - Handle spatial queries appropriately
                - Do not include ORDER BY, GROUP BY, or LIMIT clauses
                - Ensure proper escaping of strings
                - Use AND/OR operators explicitly
                - Handle numeric comparisons appropriately
                
                Example conversions:
                "Show me all parks larger than 5 acres" -> "park_type = 'Public Park' AND acres > 5"
                "Find buildings built before 1950" -> "construction_year < 1950"
                "Show schools within 5 miles of downtown" -> "ST_DWithin(geometry, ST_Point(-73.935242, 40.730610), 8046.72)" // 5 miles in meters`
            },
            {
              role: "user",
              content: text
            }
          ],
          temperature: 0.3,
          max_tokens: 200
        })
      });

      if (!response.ok) throw new Error('Failed to convert text to SQL');
      
      const data = await response.json();
      const sqlQuery = data.content;

      // Validate the SQL query format
      if (!sqlQuery || 
          sqlQuery.toLowerCase().includes('select') || 
          sqlQuery.toLowerCase().includes('from')) {
        throw new Error('Invalid SQL query generated');
      }

      return sqlQuery;
    } catch (err) {
      throw new Error(`Failed to convert question to SQL query: ${
        err instanceof Error ? err.message : 'Unknown error'
      }`);
    }
  };

  const queryFeatureService = async (sqlQuery: string) => {
    try {
      const queryParams = new URLSearchParams({
        where: sqlQuery,
        outFields: '*',
        f: 'json'
      });

      const response = await fetch(
        `${featureServiceUrl}/query?${queryParams.toString()}`
      );

      if (!response.ok) throw new Error('Failed to query feature service');
      
      const data = await response.json();
      return data.features;
    } catch (err) {
      throw new Error('Failed to query ArcGIS feature service');
    }
  };

  const generateTextResponse = async (
    question: string,
    features: any[]
  ) => {
    try {
      const response = await fetch('/api/claude/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that generates natural language responses about spatial data analysis results. Keep responses clear and concise."
            },
            {
              role: "user",
              content: `Question: ${question}\n\nFeatures found: ${JSON.stringify(features, null, 2)}`
            }
          ],
          max_tokens: 500
        })
      });

      if (!response.ok) throw new Error('Failed to generate response');
      
      const data = await response.json();
      return data.content;
    } catch (err) {
      throw new Error('Failed to generate text response');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Convert question to SQL
      const sqlQuery = await convertToSQL(question);

      // Query ArcGIS feature service
      const features = await queryFeatureService(sqlQuery);

      // Generate text response
      const text = await generateTextResponse(question, features);

      // Update state and trigger map update
      setResult({ text, features });
      onFeaturesFound(features);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={question}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuestion(e.target.value)}
            placeholder="Ask a question about the data..."
            className="w-full h-24"
            disabled={loading}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={!question.trim() || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Submit Question'
            )}
          </Button>
        </form>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="mt-4 space-y-2">
            <h3 className="font-medium">Response:</h3>
            <p className="text-sm text-gray-600">{result.text}</p>
            <p className="text-sm text-gray-500">
              Found {result.features.length} matching features
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TextToSQLQuery;