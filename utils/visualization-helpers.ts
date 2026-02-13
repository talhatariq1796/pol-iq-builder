// Query type detection functions
export const isCorrelationQuery = (query: string): boolean => {
  const correlationKeywords = [
    'correlation',
    'relationship',
    'compare',
    'versus',
    'vs',
    'between',
    'against'
  ];
  
  return correlationKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );
};

export const is3DVisualizationQuery = (query: string): boolean => {
  const threeDKeywords = [
    '3d',
    'three dimensional',
    'height',
    'elevation',
    'terrain',
    'buildings',
    'skyline'
  ];
  
  return threeDKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );
};

export const isSimpleDisplayQuery = (query: string): boolean => {
  const displayKeywords = [
    '^show',
    '^display',
    '^visualize',
    '^map',
    '^where'
  ];
  
  return displayKeywords.some(keyword => 
    new RegExp(keyword, 'i').test(query)
  );
};

// Update the isTopNQuery function to handle more cases
export const isTopNQuery = (query: string): boolean => {
  const topNPatterns = [
    /top\s+\d+/i,
    /highest\s+\d+/i,
    /largest\s+\d+/i,
    /greatest\s+\d+/i,
    /show\s+\d+\s+.*(?:highest|largest|greatest|most)/i,
    /(?:highest|largest|greatest|most)\s+\d+/i,
    /(?:top|highest|largest|greatest|most)\s+(\d+)\s+(?:areas|regions|zones|locations)/i,
    /(?:top|highest|largest|greatest|most)\s+(\d+)\s+(?:by|in|of|for)/i,
    // Add patterns for queries without explicit numbers
    /^(?:which|what|show|find|list|display)\s+(?:areas?|regions?|zones?|locations?)\s+(?:have|has|with)\s+(?:the\s+)?(?:most|highest|largest|greatest)/i,
    /^(?:most|highest|largest|greatest)\s+(?:areas?|regions?|zones?|locations?)/i,
    /^(?:which|what|show|find|list|display)\s+(?:areas?|regions?|zones?|locations?)\s+(?:have|has)\s+(?:the\s+)?(?:most|highest|largest|greatest)/i,
    // Add patterns for application-specific queries
    /^(?:which|what|show|find|list|display)\s+(?:areas?|regions?|zones?|locations?)\s+(?:have|has|with)\s+(?:the\s+)?(?:most|highest|largest|greatest)\s+applications?/i,
    /^(?:most|highest|largest|greatest)\s+applications?/i,
    /^(?:areas?|regions?|zones?|locations?)\s+(?:with|having)\s+(?:the\s+)?(?:most|highest|largest|greatest)\s+applications?/i,
    // Add patterns for simple "most applications" queries
    /^(?:which|what|show|find|list|display)\s+(?:areas?|regions?|zones?|locations?)\s+(?:have|has|with)\s+(?:the\s+)?most\s+applications?/i,
    /^most\s+applications?/i,
    /^areas?\s+(?:with|having)\s+(?:the\s+)?most\s+applications?/i
  ];
  
  const isTopN = topNPatterns.some(pattern => pattern.test(query));
  console.log('TopN query detection:', { query, isTopN });
  return isTopN;
}; 