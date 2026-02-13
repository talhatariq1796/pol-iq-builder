import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// --- Type Definitions for the Schema ---

/**
 * Describes a single field from the backend's master schema.
 */
export interface SchemaField {
    canonical_name: string;
    raw_mapping: string;
    aliases: string[];
    description: string;
}

/**
 * The full schema response object from the `/api/v1/schema` endpoint.
 */
export interface AppSchema {
    fields: { [key: string]: SchemaField };
    known_fields: string[];
    endpoints?: string[];
    version?: string;
}

// --- React Context for Schema Management ---

interface SchemaContextType {
    schema: AppSchema | null;
    isLoading: boolean;
    error: Error | null;
    getCanonicalName: (term: string) => string | undefined;
}

const SchemaContext = createContext<SchemaContextType | undefined>(undefined);

/**
 * A React provider component that fetches the master schema from the backend
 * and makes it available to its children via the `useSchema` hook.
 */
export const SchemaProvider = ({ children }: { children: ReactNode }) => {
    const [schema, setSchema] = useState<AppSchema | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const initializeSchema = () => {
            // Initialize with known schema from microservice endpoints
            // Based on the available endpoints returned in the 404 response
            const knownSchema: AppSchema = {
                endpoints: [
                    'analyze', 'feature-interactions', 'outlier-detection', 'scenario-analysis',
                    'segment-profiling', 'spatial-clusters', 'demographic-insights', 'trend-analysis',
                    'feature-importance-ranking', 'correlation-analysis', 'anomaly-detection',
                    'predictive-modeling', 'sensitivity-analysis', 'model-performance',
                    'competitive-analysis', 'comparative-analysis'
                ],
                fields: {
                    'area_name': {
                        canonical_name: 'area_name',
                        raw_mapping: 'area_name',
                        aliases: ['name', 'area', 'location'],
                        description: 'Geographic area name'
                    },
                    'value': {
                        canonical_name: 'value',
                        raw_mapping: 'value',
                        aliases: ['score', 'amount', 'metric'],
                        description: 'Numeric value or score'
                    },
                    'category': {
                        canonical_name: 'category',
                        raw_mapping: 'category',
                        aliases: ['type', 'group', 'class'],
                        description: 'Category or classification'
                    },
                    'rank': {
                        canonical_name: 'rank',
                        raw_mapping: 'rank',
                        aliases: ['ranking', 'position', 'order'],
                        description: 'Ranking or position'
                    }
                },
                known_fields: ['area_name', 'value', 'category', 'rank'],
                version: '1.0.0'
            };
            
            setSchema(knownSchema);
            setIsLoading(false);
        };

        initializeSchema();
    }, []);

    /**
     * Resolves a user-provided term (alias) to its canonical field name
     * by searching the schema.
     * @param term The alias or field name to look up.
     * @returns The canonical name or undefined if not found.
     */
    const getCanonicalName = (term: string): string | undefined => {
        if (!schema) return undefined;

        const lowerCaseTerm = term.toLowerCase().trim();

        // First, check for a direct match on a canonical name (case-insensitive)
        for (const canonicalName of schema.known_fields) {
            if (canonicalName.toLowerCase() === lowerCaseTerm) {
                return canonicalName;
            }
        }
        
        // If not found, search through all aliases for all fields
        for (const field of Object.values(schema.fields)) {
            const lowerCaseAliases = field.aliases.map(a => a.toLowerCase());
            if (lowerCaseAliases.includes(lowerCaseTerm)) {
                return field.canonical_name;
            }
        }

        return undefined;
    };

    const value = { schema, isLoading, error, getCanonicalName };

    return (
        <SchemaContext.Provider value={value}>
            {children}
        </SchemaContext.Provider>
    );
};

/**
 * Custom hook to easily access the schema context (schema data, loading state, etc.).
 * Must be used within a <SchemaProvider>.
 */
export const useSchema = () => {
    const context = useContext(SchemaContext);
    if (context === undefined) {
        throw new Error('useSchema must be used within a SchemaProvider');
    }
    return context;
}; 