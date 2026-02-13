import { useState, useEffect } from 'react';

// Assuming the schema is at this path
const SCHEMA_PATH = '/schema.json';

export const useSchema = () => {
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const response = await fetch(SCHEMA_PATH);
        if (!response.ok) {
          throw new Error(`Failed to fetch schema: ${response.statusText}`);
        }
        const data = await response.json();
        setSchema(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, []);

  return { schema, loading, error };
}; 