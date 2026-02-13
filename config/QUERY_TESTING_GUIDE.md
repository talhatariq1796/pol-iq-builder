# Query Testing Configuration Guide

This guide explains how to customize the queries used for deployment testing.

## Quick Start

All test queries are configured in `config/query-test-config.ts`. Simply edit this file to modify your tests.

## Query Categories

### 🔴 Critical Queries (MUST PASS)
These queries **must** pass for deployment to proceed. Edit `CRITICAL_TEST_QUERIES`:

```typescript
{
  id: 'my-critical-test',
  query: 'Show me population by county',
  description: 'Test county-level population mapping',
  expectedClassification: VisualizationType.CHOROPLETH,
  minimumConfidence: 0.3,
  priority: 'critical',
  enabled: true
}
```

### 🟡 Important Queries (SHOULD PASS) 
These should pass but won't block deployment. Edit `IMPORTANT_TEST_QUERIES`.

### ⚪ Optional Queries (NICE TO HAVE)
These are tested but failures are ignored. Edit `OPTIONAL_TEST_QUERIES`.

### 🔧 Custom Industry Queries
Add your domain-specific queries to `CUSTOM_TEST_QUERIES`:

```typescript
// Real Estate Example
{
  id: 'property-values',
  query: 'Map average home prices by neighborhood',
  description: 'Real estate value visualization',
  expectedClassification: VisualizationType.CHOROPLETH,
  minimumConfidence: 0.3,
  priority: 'important',
  enabled: true  // Set to true to enable
}
```

## Common Modifications

### Add a New Test Query
```typescript
// Add to any category array
{
  id: 'unique-test-id',
  query: 'Your natural language query here',
  description: 'What this test validates',
  expectedClassification: VisualizationType.CHOROPLETH, // Optional
  minimumConfidence: 0.3,
  priority: 'critical', // 'critical' | 'important' | 'optional'
  enabled: true
}
```

### Disable a Test
```typescript
{
  // ... existing test ...
  enabled: false  // Simply set to false
}
```

### Lower Confidence Requirements
```typescript
{
  // ... existing test ...
  minimumConfidence: 0.1  // Lower = more lenient
}
```

### Enable Industry-Specific Tests
```typescript
// In CUSTOM_TEST_QUERIES, find your industry and set:
enabled: true
```

## Visualization Types

Available `expectedClassification` options:
- `VisualizationType.CHOROPLETH` - Geographic regions colored by value
- `VisualizationType.CORRELATION` - Relationship between two variables  
- `VisualizationType.COMPARISON` - Compare values across areas
- `VisualizationType.HEATMAP` - Density/intensity mapping
- `VisualizationType.CLUSTER` - Group similar areas
- `VisualizationType.SCATTER` - Point mapping
- `VisualizationType.TRENDS` - Temporal analysis
- And many more... (see `config/dynamic-layers.ts`)

## Testing Architecture

The system tests your **actual production query flow**:

```
Your Query → QueryClassifier → VisualizationType → Field Validation → Success/Failure
```

This ensures that if tests pass, your real users' queries will work.

## Example Configurations

### Basic Geographic Project
```typescript
CRITICAL_TEST_QUERIES: [
  {
    id: 'basic-mapping',
    query: 'Show me all regions',
    expectedClassification: VisualizationType.CHOROPLETH,
    minimumConfidence: 0.3,
    priority: 'critical',
    enabled: true
  }
]
```

### Analytics-Heavy Project  
```typescript
CRITICAL_TEST_QUERIES: [
  {
    id: 'correlation-test',
    query: 'Show correlation between income and education',
    expectedClassification: VisualizationType.CORRELATION,
    minimumConfidence: 0.4,
    priority: 'critical',
    enabled: true
  },
  {
    id: 'comparison-test', 
    query: 'Compare population across counties',
    expectedClassification: VisualizationType.COMPARISON,
    minimumConfidence: 0.3,
    priority: 'critical',
    enabled: true
  }
]
```

## Tips

1. **Start Simple**: Begin with basic queries and add complexity gradually
2. **Test Your Domain**: Add queries specific to your industry/use case
3. **Be Realistic**: Set confidence thresholds based on your classifier's performance
4. **Use Priorities**: Critical tests block deployment, optional tests provide insights
5. **Enable Gradually**: Start with fewer tests enabled, add more as you tune

## Troubleshooting

- **All tests failing?** Lower `minimumConfidence` values
- **Tests too lenient?** Raise confidence thresholds or add more specific tests  
- **Domain-specific failures?** Add your industry terms to `CUSTOM_TEST_QUERIES`
- **Want faster testing?** Disable optional tests by setting `enabled: false`

## Configuration Settings

Global settings in `QUERY_TEST_CONFIG`:
- `defaultMinimumConfidence: 0.3` - Default confidence threshold
- `allowFallbackClassification: true` - Use pattern matching when ML fails
- `enableCompatibleTypeMatching: true` - Accept related visualization types
- `timeoutPerQuery: 5000` - 5 second timeout per test
- `maxRetries: 2` - Retry failed tests twice

Happy testing! 🚀 