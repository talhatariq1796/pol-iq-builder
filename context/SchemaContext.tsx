import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchColumnSchema } from '@/utils/schema';

const SchemaContext = createContext<string[]>([]);

export const SchemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    fetchColumnSchema()
      .then(setColumns)
      .catch((err: unknown) => console.error('[SchemaProvider] Failed to load schema', err));
  }, []);

  return <SchemaContext.Provider value={columns}>{children}</SchemaContext.Provider>;
};

export const useSchema = (): string[] => useContext(SchemaContext); 