import { NextResponse } from 'next/server';

// Add a more detailed feature analysis helper function
function analyzeFeatureSet(features: any[]) {
  const summary = {
    totalFeatures: features.length,
    sampleFeatures: features.slice(0, 3),
    zipCodesFound: 0,
    distinctFields: new Set<string>(),
    hasThematicValue: 0,
    propertiesTypes: {
      direct: 0,
      nestedInProperties: 0,
      unknown: 0
    }
  };
  
  // Check for common property types
  const uniqueZipCodes = new Set<string>();
  
  features.forEach(feature => {
    // Check property structure
    if (feature.properties && typeof feature.properties === 'object') {
      summary.propertiesTypes.nestedInProperties++;
      
      // Collect field names from properties
      Object.keys(feature.properties).forEach(key => {
        summary.distinctFields.add(key);
      });
      
      // Check for ZIP codes
      if (feature.properties.DESCRIPTION || 
          feature.properties.ZIP_CODE ||
          feature.properties.ZIPCODE ||
          feature.properties.ZIP) {
        summary.zipCodesFound++;
        
        // Add to unique ZIP codes
        const zipCode = feature.properties.DESCRIPTION || 
                         feature.properties.ZIP_CODE ||
                         feature.properties.ZIPCODE ||
                         feature.properties.ZIP;
        if (zipCode) {
          uniqueZipCodes.add(zipCode);
        }
      }
      
      // Check for thematic value
      if (feature.properties.thematic_value !== undefined) {
        summary.hasThematicValue++;
      }
    } else {
      // Direct properties
      summary.propertiesTypes.direct++;
      
      // Collect field names directly
      Object.keys(feature).forEach(key => {
        if (key !== 'geometry') {
          summary.distinctFields.add(key);
        }
      });
      
      // Check for ZIP codes in direct properties
      if (feature.DESCRIPTION || 
          feature.ZIP_CODE ||
          feature.ZIPCODE ||
          feature.ZIP) {
        summary.zipCodesFound++;
        
        // Add to unique ZIP codes
        const zipCode = feature.DESCRIPTION || 
                         feature.ZIP_CODE ||
                         feature.ZIPCODE ||
                         feature.ZIP;
        if (zipCode) {
          uniqueZipCodes.add(zipCode);
        }
      }
      
      // Check for thematic value
      if (feature.thematic_value !== undefined) {
        summary.hasThematicValue++;
      }
    }
  });
  
  return {
    ...summary,
    uniqueZipCodes: Array.from(uniqueZipCodes).slice(0, 10),
    uniqueZipCodeCount: uniqueZipCodes.size,
    fieldCount: summary.distinctFields.size,
    commonFields: Array.from(summary.distinctFields).slice(0, 10)
  };
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    
    // Check if we have the uploadData or blobUrl
    const { uploadData, blobUrl } = body;
    
    let dataToAnalyze = uploadData;
    
    // If there's no uploadData but there is a blobUrl, fetch from the blob
    if (!uploadData && blobUrl) {
      const response = await fetch(blobUrl);
      if (!response.ok) {
        return NextResponse.json({ 
          error: `Failed to fetch blob data: ${response.statusText}` 
        }, { status: 500 });
      }
      dataToAnalyze = await response.json();
    }
    
    if (!dataToAnalyze) {
      return NextResponse.json({ 
        error: 'No data provided in uploadData or blobUrl' 
      }, { status: 400 });
    }
    
    // Count features
    const summary = {
      totalLayers: 0,
      totalFeatures: 0,
      featureDetails: [] as any[],
      enhancedAnalysis: null as any
    };
    
    // If layers exist, iterate through them
    if (dataToAnalyze.layers && Array.isArray(dataToAnalyze.layers)) {
      summary.totalLayers = dataToAnalyze.layers.length;
      
      dataToAnalyze.layers.forEach((layer: any, index: number) => {
        const featureCount = layer.features?.length || 0;
        summary.totalFeatures += featureCount;
        
        const zipCodes = new Set<string>();
        const thematicValues: any[] = [];
        
        // Sample up to 5 features for detailed inspection
        const sampleFeatures = layer.features?.slice(0, 5) || [];
        sampleFeatures.forEach((feature: any) => {
          if (feature.properties?.DESCRIPTION) {
            zipCodes.add(feature.properties.DESCRIPTION);
          } else if (feature.properties?.ZIP) {
            zipCodes.add(feature.properties.ZIP);
          }
          
          if (feature.properties?.thematic_value !== undefined) {
            thematicValues.push(feature.properties.thematic_value);
          }
        });
        
        summary.featureDetails.push({
          layerIndex: index,
          layerId: layer.layerId || `layer_${index}`,
          featureCount,
          sampleZipCodes: Array.from(zipCodes),
          sampleThematicValues: thematicValues,
        });
      });
      
      // Add enhanced analysis for first layer
      if (dataToAnalyze.layers.length > 0 && dataToAnalyze.layers[0].features?.length > 0) {
        summary.enhancedAnalysis = analyzeFeatureSet(dataToAnalyze.layers[0].features);
      }
    } else if (dataToAnalyze.features && Array.isArray(dataToAnalyze.features)) {
      // Case 1: Single array of features directly
      if (dataToAnalyze.features.length > 0 && !dataToAnalyze.features[0].features) {
        summary.totalLayers = 1;
        summary.totalFeatures = dataToAnalyze.features.length;
        
        const zipCodes = new Set<string>();
        const thematicValues: any[] = [];
        
        // Sample up to 5 features
        const sampleFeatures = dataToAnalyze.features.slice(0, 5);
        sampleFeatures.forEach((feature: any) => {
          if (feature.properties?.DESCRIPTION) {
            zipCodes.add(feature.properties.DESCRIPTION);
          } else if (feature.properties?.ZIP) {
            zipCodes.add(feature.properties.ZIP);
          }
          
          if (feature.properties?.thematic_value !== undefined) {
            thematicValues.push(feature.properties.thematic_value);
          }
        });
        
        summary.featureDetails.push({
          layerIndex: 0,
          layerId: 'single_layer',
          featureCount: dataToAnalyze.features.length,
          sampleZipCodes: Array.from(zipCodes),
          sampleThematicValues: thematicValues,
        });
        
        // Add enhanced analysis
        summary.enhancedAnalysis = analyzeFeatureSet(dataToAnalyze.features);
      } 
      // Case 2: Array of OptimizedLayerData objects
      else if (dataToAnalyze.features.length > 0 && dataToAnalyze.features[0].features) {
        summary.totalLayers = dataToAnalyze.features.length;
        
        dataToAnalyze.features.forEach((layer: any, index: number) => {
          const featureCount = layer.features?.length || 0;
          summary.totalFeatures += featureCount;
          
          const zipCodes = new Set<string>();
          const thematicValues: any[] = [];
          
          // Sample up to 5 features
          const sampleFeatures = layer.features?.slice(0, 5) || [];
          sampleFeatures.forEach((feature: any) => {
            if (feature.properties?.DESCRIPTION) {
              zipCodes.add(feature.properties.DESCRIPTION);
            } else if (feature.properties?.ZIP) {
              zipCodes.add(feature.properties.ZIP);
            }
            
            if (feature.properties?.thematic_value !== undefined) {
              thematicValues.push(feature.properties.thematic_value);
            }
          });
          
          summary.featureDetails.push({
            layerIndex: index,
            layerId: layer.layerId || `layer_${index}`,
            featureCount,
            sampleZipCodes: Array.from(zipCodes),
            sampleThematicValues: thematicValues,
          });
        });
        
        // Add enhanced analysis for first layer
        if (dataToAnalyze.features[0].features?.length > 0) {
          summary.enhancedAnalysis = analyzeFeatureSet(dataToAnalyze.features[0].features);
        }
      }
    }
    
    return NextResponse.json({
      status: 'success',
      summary
    });
    
  } catch (error: any) {
    console.error('Diagnostic error:', error);
    return NextResponse.json({ 
      error: `Error analyzing data: ${error.message}` 
    }, { status: 500 });
  }
} 