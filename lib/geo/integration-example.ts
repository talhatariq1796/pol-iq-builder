/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Geo-Awareness Integration Example
 * 
 * Shows how to integrate the new geo-awareness system with existing analysis pipeline
 */

import { DataProcessor } from '../analysis/DataProcessor';
import { ConfigurationManager } from '../analysis/ConfigurationManager';

// Mock data representing a typical microservice response
const mockAnalysisResult = {
  success: true,
  results: [
    {
      area_id: 'nyc_manhattan',
      DESCRIPTION: 'Financial District (New York)', 
      ZIP_CODE: '10001',
      value: 85.5,
      coordinates: [-74.0059, 40.7128],
      properties: { population: 50000, income: 85000 }
    },
    {
      area_id: 'la_hollywood',
      DESCRIPTION: 'Hollywood District (Los Angeles)',
      ZIP_CODE: '90028', 
      value: 92.1,
      coordinates: [-118.3267, 34.0928],
      properties: { population: 75000, income: 62000 }
    },
    {
      area_id: 'chi_loop',
      DESCRIPTION: 'Loop Business District (Chicago)',
      ZIP_CODE: '60601',
      value: 87.3, 
      coordinates: [-87.6298, 41.8781],
      properties: { population: 40000, income: 78000 }
    },
    {
      area_id: 'sf_financial',
      DESCRIPTION: 'Financial District (San Francisco)',
      ZIP_CODE: '94104',
      value: 94.7,
      coordinates: [-122.4194, 37.7749], 
      properties: { population: 35000, income: 95000 }
    },
    {
      area_id: 'philly_center',
      DESCRIPTION: 'Center City (Philadelphia)',
      ZIP_CODE: '19102',
      value: 76.8,
      coordinates: [-75.1652, 39.9526],
      properties: { population: 60000, income: 55000 }
    }
  ],
  summary: 'Competitive analysis completed successfully',
  feature_importance: [],
  model_info: { 
    target_variable: 'competitive_score',
    feature_count: 5,
    accuracy: 0.85
  }
};

/**
 * Example 1: Basic geo-aware analysis
 */
export async function basicGeoAnalysisExample() {
  console.log('🏙️  Example 1: Basic Geo-Aware Analysis\n');
  
  const configManager = ConfigurationManager.getInstance();
  const dataProcessor = new DataProcessor(configManager);
  
  // Test various geographic queries
  const queries = [
    'Show me New York performance',
    'Compare California vs New York',
    'How is Chicago doing?',
    'Analyze ZIP code 10001',
    'West Coast analysis'
  ];
  
  for (const query of queries) {
    console.log(`📍 Query: "${query}"`);
    console.log('-'.repeat(40));
    
    try {
      // Use the new geographic analysis method
      const result = await dataProcessor.processResultsWithGeographicAnalysis(
        mockAnalysisResult, 
        '/competitive-analysis', 
        query
      );
      
      console.log(`✅ Processed ${result.records.length} records`);
      
      if (result.geoAnalysis) {
        console.log(`🌍 Geographic Analysis:`);
        console.log(`   - Entities: ${result.geoAnalysis.entities?.map((e: { name: string }) => e.name).join(', ')}`);
        console.log(`   - Method: ${result.geoAnalysis.filterStats?.filterMethod}`);
        console.log(`   - Processing Time: ${result.geoAnalysis.filterStats?.processingTimeMs}ms`);
        
        if (result.geoAnalysis.warnings?.length > 0) {
          console.log(`   - Warnings: ${result.geoAnalysis.warnings.join(', ')}`);
        }
      }
      
      // Show filtered results
      if (result.records.length < mockAnalysisResult.results.length) {
        console.log(`🎯 Filtered Results:`);
        result.records.forEach((record) => {
          const description = (record.properties.DESCRIPTION as string) || record.area_name;
          console.log(`   - ${description}: ${record.value}`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Error:`, error);
    }
    
    console.log();
  }
}

/**
 * Example 2: Performance comparison between old and new systems
 */
export async function performanceComparisonExample() {
  console.log('⚡ Example 2: Performance Comparison\n');
  
  const configManager = ConfigurationManager.getInstance();
  const dataProcessor = new DataProcessor(configManager);
  
  const testQuery = 'Show me New York and California data';
  const iterations = 10;
  
  console.log(`📊 Testing "${testQuery}" with ${iterations} iterations\n`);
  
  // Test new geo-awareness system
  console.log('🚀 New Geo-Awareness System:');
  const newSystemTimes: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    
    try {
      const result = await dataProcessor.processResultsWithGeographicAnalysis(
        mockAnalysisResult,
        '/competitive-analysis', 
        testQuery
      );
      
      const processingTime = Date.now() - startTime;
      newSystemTimes.push(processingTime);
      
      if (i === 0) {
        console.log(`   First run: ${result.records.length} records, ${processingTime}ms`);
        if (result.geoAnalysis?.entities) {
          console.log(`   Entities: ${result.geoAnalysis.entities.map((e: { name: string }) => e.name).join(', ')}`);
        }
      }
    } catch (error) {
      console.error(`   Error on iteration ${i + 1}:`, error);
    }
  }
  
  // Test legacy city analysis system  
  console.log('\n🔄 Legacy City Analysis System:');
  const legacySystemTimes: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    
    try {
      const result = dataProcessor.processResultsWithCityAnalysis(
        mockAnalysisResult,
        '/competitive-analysis',
        testQuery
      );
      
      const processingTime = Date.now() - startTime;
      legacySystemTimes.push(processingTime);
      
      if (i === 0) {
        console.log(`   First run: ${(result as any).records?.length || 0} records, ${processingTime}ms`);
        if ((result as any).cityAnalysis) {
          console.log(`   Cities: ${(result as any).cityAnalysis.detectedCities.join(', ')}`);
        }
      }
    } catch (error) {
      console.error(`   Error on iteration ${i + 1}:`, error);
    }
  }
  
  // Calculate statistics
  const newAvg = newSystemTimes.reduce((a, b) => a + b, 0) / newSystemTimes.length;
  const legacyAvg = legacySystemTimes.reduce((a, b) => a + b, 0) / legacySystemTimes.length;
  
  console.log('\n📈 Performance Results:');
  console.log(`   New System Average: ${newAvg.toFixed(2)}ms`);
  console.log(`   Legacy System Average: ${legacyAvg.toFixed(2)}ms`);
  console.log(`   Performance Change: ${((newAvg - legacyAvg) / legacyAvg * 100).toFixed(1)}%`);
}

/**
 * Example 3: Error handling and fallback behavior
 */
export async function errorHandlingExample() {
  console.log('🛡️  Example 3: Error Handling and Fallback\n');
  
  const configManager = ConfigurationManager.getInstance();
  const dataProcessor = new DataProcessor(configManager);
  
  // Test queries that might cause issues
  const edgeCaseQueries = [
    '',                           // Empty query
    'Show me Mars data',          // Non-existent location
    'Gibberish xyz abc',          // Random text
    'Show me data for 00000',     // Invalid ZIP code
    'New Yrok',                   // Typo in city name
    'West Coast vs East Coast'    // Regional comparison
  ];
  
  for (const query of edgeCaseQueries) {
    console.log(`🧪 Testing: "${query}"`);
    
    try {
      const result = await dataProcessor.processResultsWithGeographicAnalysis(
        mockAnalysisResult,
        '/competitive-analysis',
        query
      );
      
      console.log(`   ✅ Success: ${result.records.length} records`);
      
      if (result.geoAnalysis?.warnings) {
        console.log(`   ⚠️  Warnings: ${result.geoAnalysis.warnings.join(', ')}`);
      }
      
      if (result.geoAnalysis?.fallbackUsed) {
        console.log(`   🔄 Fallback was used`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log();
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 Geo-Awareness Integration Examples\n');
  console.log('='.repeat(60));
  
  await basicGeoAnalysisExample();
  
  console.log('='.repeat(60));
  await performanceComparisonExample();
  
  console.log('\n' + '='.repeat(60));
  await errorHandlingExample();
  
  console.log('='.repeat(60));
  console.log('🎉 All examples completed successfully!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}