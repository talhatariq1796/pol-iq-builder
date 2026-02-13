/**
 * Clustering Tab Component
 *
 * Migrates the existing ClusterConfigPanel into the new tabbed filtering system.
 * Maintains 100% compatibility with existing clustering functionality.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { ClusterConfigPanel } from '@/components/clustering/ClusterConfigPanel';
import { FilterTabProps } from '../types';
import { ClusterConfig } from '@/lib/clustering/types';

interface ZIPAggregate {
  zipCode: string;
  totalAmount: number;
  donorCount: number;
  avgContribution: number;
  [key: string]: any;
}

export default function ClusteringTab({
  config,
  onConfigChange,
  availableFields,
  endpoint,
}: FilterTabProps) {
  const [zipData, setZipData] = useState<ZIPAggregate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load actual ZIP data on mount
  useEffect(() => {
    const loadZipData = async () => {
      try {
        const response = await fetch('/data/donors/zip-aggregates.json');
        if (response.ok) {
          const data = await response.json();
          setZipData(data);
        }
      } catch (error) {
        console.error('Failed to load ZIP data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadZipData();
  }, []);

  // Calculate actual statistics from loaded data
  const datasetInfo = React.useMemo(() => {
    if (zipData.length === 0) {
      return {
        totalZipCodes: 0,
        totalPopulation: 0,
        geographicSpread: {
          minDistance: 0,
          maxDistance: 100
        }
      };
    }

    // Actual ZIP count from loaded data
    const totalZipCodes = zipData.length;

    // Calculate total donor population from all ZIPs
    const totalPopulation = zipData.reduce((sum, zip) => sum + (zip.donorCount || 0), 0);

    return {
      totalZipCodes,
      totalPopulation,
      geographicSpread: {
        minDistance: 0,
        maxDistance: 100
      }
    };
  }, [zipData]);

  // Handle clustering configuration changes
  const handleClusterConfigChange = useCallback((clusterConfig: ClusterConfig) => {
    onConfigChange({
      ...config,
      clustering: clusterConfig,
    });
  }, [config, onConfigChange]);

  // Handle save action from ClusterConfigPanel
  const handleSave = useCallback(() => {
    // In the original implementation, save just closed the dialog
    // In our new system, this is handled by the parent dialog
    // So we don't need to do anything here
  }, []);

  return (
    <div className="h-full">
      <ClusterConfigPanel
        config={config.clustering}
        onConfigChange={handleClusterConfigChange}
        onSave={handleSave}
        datasetInfo={datasetInfo}
      />
    </div>
  );
}