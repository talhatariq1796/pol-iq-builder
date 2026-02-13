import { NextRequest, NextResponse } from 'next/server';

export interface CMADebugRequest {
  test_type: 'data_loading' | 'spatial_filtering' | 'price_calculation' | 'full_pipeline';
  geometry?: {
    type: string;
    coordinates?: number[] | number[][][];
    rings?: number[][];
    extent?: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    };
  };
  debug_level?: 'basic' | 'detailed' | 'verbose';
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * CMA Debug Test Endpoint
 * Tests specific parts of the CMA pipeline to isolate failures
 */
export async function POST(request: NextRequest) {
  try {
    const requestData: CMADebugRequest = await request.json();
    console.log('🔍 [CMA DEBUG] Starting debug test:', requestData.test_type);

    const results: any = {
      test_type: requestData.test_type,
      timestamp: new Date().toISOString(),
      success: false,
      details: {},
      errors: []
    };

    // Import the processor for testing
    const { RealEstateCMAProcessor } = await import('@/lib/analysis/strategies/processors/RealEstateCMAProcessor');
    const processor = new RealEstateCMAProcessor();

    switch (requestData.test_type) {
      case 'data_loading':
        try {
          console.log('🔍 [CMA DEBUG] Testing data loading...');
          
          // Access the private method via reflection for testing
          const loadMethod = (processor as any).loadRealPropertyData.bind(processor);
          const properties = await loadMethod();
          
          results.success = true;
          results.details = {
            propertiesLoaded: properties.length,
            sampleProperty: properties[0] ? {
              address: properties[0].address,
              price: properties[0].price || properties[0].askedsold_price,
              coordinates: properties[0].coordinates,
              hasCoordinates: !!(properties[0].coordinates)
            } : null,
            dataQuality: {
              withCoordinates: properties.filter((p: any) => (processor as any).extractCoordinates(p)).length,
              coordinatePercentage: properties.length > 0 ? 
                (properties.filter((p: any) => (processor as any).extractCoordinates(p)).length / properties.length * 100).toFixed(1) + '%' : '0%'
            }
          };
          
          console.log('🔍 [CMA DEBUG] Data loading test completed successfully');
        } catch (error) {
          results.errors.push({
            stage: 'data_loading',
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
          });
          console.error('🔍 [CMA DEBUG] Data loading test failed:', error);
        }
        break;

      case 'spatial_filtering':
        try {
          console.log('🔍 [CMA DEBUG] Testing spatial filtering...');
          
          // Load test data first
          const loadMethod = (processor as any).loadRealPropertyData.bind(processor);
          const properties = await loadMethod();
          
          if (!requestData.geometry) {
            throw new Error('Geometry required for spatial filtering test');
          }
          
          // Test spatial filtering
          const filterMethod = (processor as any).filterPropertiesByArea.bind(processor);
          const filteredProperties = await filterMethod(properties, requestData.geometry);
          
          results.success = true;
          results.details = {
            originalCount: properties.length,
            filteredCount: filteredProperties.length,
            filterEfficiency: properties.length > 0 ? 
              `${((filteredProperties.length / properties.length) * 100).toFixed(1)}%` : '0%',
            geometry: {
              type: requestData.geometry.type,
              hasExtent: !!requestData.geometry.extent,
              hasRings: !!requestData.geometry.rings,
              hasCoordinates: !!requestData.geometry.coordinates
            },
            sampleFiltered: filteredProperties.slice(0, 3).map((p: any) => ({
              address: p.address,
              coordinates: (processor as any).extractCoordinates(p)
            }))
          };
          
          console.log('🔍 [CMA DEBUG] Spatial filtering test completed successfully');
        } catch (error) {
          results.errors.push({
            stage: 'spatial_filtering',
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
          });
          console.error('🔍 [CMA DEBUG] Spatial filtering test failed:', error);
        }
        break;

      case 'price_calculation':
        try {
          console.log('🔍 [CMA DEBUG] Testing price calculation...');
          
          // Load test data first
          const loadMethod = (processor as any).loadRealPropertyData.bind(processor);
          const properties = await loadMethod();
          
          // Test price extraction on first 10 properties
          const priceTests = properties.slice(0, 10).map((p: any, index: number) => {
            const extractedPrice = (processor as any).extractPrice(p);
            return {
              index,
              address: p.address,
              rawPrice: p.price,
              rawAskedSoldPrice: p.askedsold_price,
              extractedPrice,
              priceFields: {
                price: p.price,
                askedsold_price: p.askedsold_price,
                price_per_sqft: p.price_per_sqft,
                building_area: p.BUILDING_AREA || p.living_area
              }
            };
          });
          
          const validPrices = priceTests.filter((t: any) => t.extractedPrice > 0);
          
          results.success = true;
          results.details = {
            totalTested: priceTests.length,
            validPrices: validPrices.length,
            invalidPrices: priceTests.length - validPrices.length,
            priceRange: validPrices.length > 0 ? {
              min: Math.min(...validPrices.map((t: any) => t.extractedPrice)),
              max: Math.max(...validPrices.map((t: any) => t.extractedPrice)),
              avg: Math.round(validPrices.reduce((sum: number, t: any) => sum + t.extractedPrice, 0) / validPrices.length)
            } : null,
            sampleTests: priceTests.slice(0, 5)
          };
          
          console.log('🔍 [CMA DEBUG] Price calculation test completed successfully');
        } catch (error) {
          results.errors.push({
            stage: 'price_calculation',
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
          });
          console.error('🔍 [CMA DEBUG] Price calculation test failed:', error);
        }
        break;

      case 'full_pipeline':
        try {
          console.log('🔍 [CMA DEBUG] Testing full CMA pipeline...');
          
          // Create minimal test data for the processor
          const testRawData = {
            success: true,
            results: [],
            geometry: requestData.geometry,
            filters: {
              priceRange: { min: 0, max: 10000000 },
              propertyType: 'all'
            }
          };
          
          // Test the full pipeline
          const processedData = await processor.process(testRawData);
          
          results.success = true;
          results.details = {
            processedType: processedData.type,
            recordCount: processedData.records?.length || 0,
            targetVariable: processedData.targetVariable,
            hasStatistics: !!processedData.statistics,
            hasSummary: !!processedData.summary,
            sampleRecords: processedData.records?.slice(0, 3).map(r => ({
              area_name: r.area_name,
              value: r.value,
              coordinates: r.coordinates
            })) || []
          };
          
          console.log('🔍 [CMA DEBUG] Full pipeline test completed successfully');
        } catch (error) {
          results.errors.push({
            stage: 'full_pipeline',
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
          });
          console.error('🔍 [CMA DEBUG] Full pipeline test failed:', error);
        }
        break;

      default:
        results.errors.push({
          stage: 'validation',
          error: `Invalid test_type: ${requestData.test_type}`,
          stack: undefined
        });
        break;
    }

    // Set overall success based on whether any errors occurred
    results.success = results.errors.length === 0;
    
    console.log('🔍 [CMA DEBUG] Debug test completed:', {
      test_type: requestData.test_type,
      success: results.success,
      errorCount: results.errors.length
    });

    return NextResponse.json(results, { status: results.success ? 200 : 500 });

  } catch (error) {
    console.error('🔍 [CMA DEBUG] Debug endpoint failed:', error);
    
    return NextResponse.json({
      test_type: 'unknown',
      timestamp: new Date().toISOString(),
      success: false,
      details: {},
      errors: [{
        stage: 'endpoint',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
      }]
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'CMA Debug Test API',
    description: 'Tests specific parts of the CMA pipeline to isolate failures',
    available_tests: [
      {
        test_type: 'data_loading',
        description: 'Tests if blob data can be loaded successfully',
        required_fields: ['test_type']
      },
      {
        test_type: 'spatial_filtering',
        description: 'Tests spatial filtering with provided geometry',
        required_fields: ['test_type', 'geometry']
      },
      {
        test_type: 'price_calculation',
        description: 'Tests price extraction from property data',
        required_fields: ['test_type']
      },
      {
        test_type: 'full_pipeline',
        description: 'Tests the complete CMA processing pipeline',
        required_fields: ['test_type'],
        optional_fields: ['geometry']
      }
    ],
    sample_request: {
      test_type: 'data_loading',
      debug_level: 'detailed'
    }
  });
}