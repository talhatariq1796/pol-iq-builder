// CORRECT CLUSTERING APPROACH: Create cluster territories, not individual ZIP codes

// This is what should replace the current clustering approach in ClusteringService.ts

const enhanceAnalysisWithClusters_CORRECT = (originalResult: any, clusteringResult: any) => {
  
  // Create cluster-level records (territories) instead of individual ZIP codes
  const clusterRecords: any[] = [];
  
  console.log(`[ClusteringService] 🎯 Creating cluster territory records from ${clusteringResult.clusters.length} clusters`);
  
  for (const cluster of clusteringResult.clusters) {
    // Get all original ZIP code records belonging to this cluster
    const clusterZipRecords = (originalResult.data.records || []).filter((record: any) => {
      const zipCode = record.properties?.geo_id || record.properties?.zip_code || record.area_name;
      return cluster.zipCodes.includes(zipCode);
    });

    if (clusterZipRecords.length === 0) {
      console.warn(`[ClusteringService] No records found for cluster ${cluster.clusterId}`);
      continue;
    }

    // Aggregate cluster metrics
    const totalValue = clusterZipRecords.reduce((sum: any, record: any) => sum + (record.value || 0), 0);
    const avgValue = totalValue / clusterZipRecords.length;
    const totalPopulation = clusterZipRecords.reduce((sum: any, record: any) => 
      sum + (record.properties?.total_population || 0), 0);

    // Create cluster territory boundary from all ZIP codes in the cluster
    const clusterBoundary = createClusterTerritoryBoundary(clusterZipRecords);
    
    console.log(`[ClusteringService] 🗺️ Created territory boundary for cluster ${cluster.clusterId}:`, {
      name: cluster.name,
      zipCodeCount: cluster.zipCodes.length,
      avgValue,
      boundaryType: clusterBoundary?.type,
      hasCoordinates: !!clusterBoundary?.coordinates
    });
    
    const clusterRecord = {
      area_id: `cluster_${cluster.clusterId}`,
      area_name: cluster.name,
      value: cluster.clusterId, // CRITICAL: Put cluster ID in value field for renderer
      rank: cluster.clusterId + 1,
      coordinates: cluster.centroid,
      properties: {
        ...clusterZipRecords[0].properties, // Base properties from first record
        cluster_id: cluster.clusterId,
        cluster_name: cluster.name,
        zip_codes_count: cluster.zipCodes.length,
        zip_codes: cluster.zipCodes.slice(0, 10),
        zip_codes_sample: `${cluster.zipCodes.slice(0, 5).join(', ')}${cluster.zipCodes.length > 5 ? ` and ${cluster.zipCodes.length - 5} more` : ''}`,
        total_population: totalPopulation,
        avg_value: avgValue,
        total_value: totalValue,
        radius_miles: cluster.radiusMiles,
        is_cluster: true,
        centroid: cluster.centroid
      },
      // Use the proper territory boundary geometry
      geometry: clusterBoundary
    };
    
    clusterRecords.push(clusterRecord);
  }

  console.log(`[ClusteringService] ✅ Created ${clusterRecords.length} cluster territory records from ${originalResult.data.records?.length || 0} original ZIP codes`);

  // Enhanced data with cluster territory records
  const enhancedData = {
    ...originalResult.data,
    records: clusterRecords, // Use cluster territories instead of individual ZIP codes
    totalRecords: clusterRecords.length, // Now shows cluster count (12), not ZIP count (3983)
    clusters: clusteringResult.clusters,
    clusteringSummary: `Generated ${clusteringResult.clusters.length} cluster territories`,
    isClustered: true,
    clusteringApproach: 'cluster_territories',
    originalRecordCount: originalResult.data.records?.length || 0
  };
  
  // Update the summary to include clustering information
  const originalSummary = originalResult.data.summary || '';
  const enhancedSummary = `${originalSummary}

**Territory Clustering Applied:** Created ${clusterRecords.length} campaign territories from ${originalResult.data.records?.length || 0} strategic ZIP codes. Each territory represents a cluster of similar markets for targeted campaign deployment.`;
  
  enhancedData.summary = enhancedSummary;

  return {
    ...originalResult,
    data: enhancedData,
    // ... rest of the result
  };
};

const createClusterTerritoryBoundary = (zipRecords: any[]) => {
  if (zipRecords.length === 0) return null;
  
  // Extract all coordinates from ZIP code geometries that have been joined with boundaries
  const allCoordinates: any[] = [];
  
  zipRecords.forEach((record: any) => {
    if (record.geometry?.type === 'Polygon' && record.geometry.coordinates?.[0]) {
      // Extract coordinates from polygon rings
      record.geometry.coordinates[0].forEach((coord: any) => {
        allCoordinates.push(coord);
      });
    } else if (record.geometry?.type === 'Point' && record.geometry.coordinates) {
      // Use point coordinates directly
      allCoordinates.push([record.geometry.coordinates[0], record.geometry.coordinates[1]]);
    }
  });
  
  if (allCoordinates.length === 0) {
    console.warn(`[ClusteringService] No valid coordinates found for cluster territory`);
    return null;
  }
  
  // Calculate bounding box for the territory
  const lons = allCoordinates.map(coord => coord[0]);
  const lats = allCoordinates.map(coord => coord[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  
  // Add padding to create a proper territory boundary
  const lonRange = maxLon - minLon;
  const latRange = maxLat - minLat;
  const padding = Math.max(0.01, lonRange * 0.1, latRange * 0.1);
  
  // Create territory boundary polygon
  return {
    type: 'Polygon',
    coordinates: [[
      [minLon - padding, minLat - padding],  // Bottom-left
      [minLon - padding, maxLat + padding],  // Top-left
      [maxLon + padding, maxLat + padding],  // Top-right
      [maxLon + padding, minLat - padding],  // Bottom-right
      [minLon - padding, minLat - padding]   // Close polygon
    ]]
  };
};