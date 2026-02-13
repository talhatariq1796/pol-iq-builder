import memoizee from 'memoizee';

export interface SchemaResponse {
  success: boolean;
  columns: string[];
}

// Known columns based on the microservice endpoints and our analysis
const KNOWN_COLUMNS = [
  'area_name', 'value', 'category', 'rank', 'latitude', 'longitude',
  'population', 'income', 'age_median', 'score', 'brand_preference',
  'market_share', 'competitive_index', 'demographic_score'
];

async function _fetchSchema(): Promise<string[]> {
  // Return known columns without making HTTP requests
  // since the microservice doesn't have a schema endpoint
  return Promise.resolve(KNOWN_COLUMNS);
}

// Memoise for the lifetime of the client session
export const fetchColumnSchema = memoizee(_fetchSchema, { promise: true });
