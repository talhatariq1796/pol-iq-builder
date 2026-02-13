// components/ProjectConfigManager/ServiceManager.tsx
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Globe, 
  Layers, 
  Download, 
  RefreshCw, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Zap
} from 'lucide-react';

import { ArcGISService, ServiceDerivedLayer } from '@/types/project-config';
import { arcgisServiceManager } from '@/services/arcgis-service-manager';

interface ServiceManagerProps {
  services: ArcGISService[];
  layers: ServiceDerivedLayer[];
  onServiceAdded: (service: ArcGISService) => void;
  onServiceUpdated: (service: ArcGISService) => void;
  onServiceRemoved: (serviceId: string) => void;
  onLayersGenerated: (layers: ServiceDerivedLayer[]) => void;
  onLayersUpdated: (layers: ServiceDerivedLayer[]) => void;
}

export const ServiceManager: React.FC<ServiceManagerProps> = ({
  services,
  layers,
  onServiceAdded,
  onServiceUpdated,
  onServiceRemoved,
  onLayersGenerated,
  onLayersUpdated
}) => {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryUrl, setDiscoveryUrl] = useState('');
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<ArcGISService | null>(null);
  const [bulkOperation, setBulkOperation] = useState<string>('');

  // Example URLs for user reference
  const exampleUrls = [
    'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Vetements_layers/FeatureServer',
    'https://services.arcgis.com/example/arcgis/rest/services/Demographics/FeatureServer',
    'https://services.arcgis.com/example/arcgis/rest/services/Economic_Data/FeatureServer'
  ];

  const handleDiscoverService = useCallback(async () => {
    if (!discoveryUrl.trim()) return;

    setIsDiscovering(true);
    try {
      const serviceInfo = await arcgisServiceManager.discoverService(discoveryUrl);
      setDiscoveryResult(serviceInfo);
    } catch (error) {
      console.error('Service discovery failed:', error);
      setDiscoveryResult({ error: String(error) });
    } finally {
      setIsDiscovering(false);
    }
  }, [discoveryUrl]);

  const handleAddService = useCallback(async () => {
    if (!discoveryResult || discoveryResult.error) return;

    try {
      const service = await arcgisServiceManager.createServiceConfiguration(discoveryUrl, {
        name: discoveryResult.name,
        description: discoveryResult.serviceDescription,
        defaultGroup: 'service-layers'
      });

      onServiceAdded(service);
      setDiscoveryResult(null);
      setDiscoveryUrl('');
    } catch (error) {
      console.error('Failed to add service:', error);
    }
  }, [discoveryUrl, discoveryResult, onServiceAdded]);

  const handleGenerateLayers = useCallback(async (service: ArcGISService) => {
    try {
      const layers = await arcgisServiceManager.generateLayersFromService(service, {
        autoGenerateGroups: true
      });
      onLayersGenerated(layers);
    } catch (error) {
      console.error('Failed to generate layers:', error);
    }
  }, [onLayersGenerated]);

  const handleSyncService = useCallback(async (service: ArcGISService) => {
    try {
      const serviceLayers = layers.filter(l => l.serviceId === service.id);
      const syncResult = await arcgisServiceManager.syncServiceLayers(service, serviceLayers);
      
      // Combine all changes
      const updatedLayers = [
        ...syncResult.updated,
        ...syncResult.added,
        ...layers.filter(l => l.serviceId !== service.id || !syncResult.removed.includes(l.id))
      ];
      
      onLayersUpdated(updatedLayers);
    } catch (error) {
      console.error('Failed to sync service:', error);
    }
  }, [layers, onLayersUpdated]);

  const handleBulkOperation = useCallback(async (serviceId: string, operation: string) => {
    const serviceLayers = layers.filter(l => l.serviceId === serviceId);
    
    const updates: any = {};
    
    switch (operation) {
      case 'activate':
        updates.status = 'active';
        break;
      case 'deactivate':
        updates.status = 'inactive';
        break;
      case 'group_demographics':
        updates.group = 'demographics-group';
        break;
      case 'group_income':
        updates.group = 'income-group';
        break;
      case 'group_housing':
        updates.group = 'housing-group';
        break;
      case 'group_spending':
        updates.group = 'spending-group';
        break;
    }

    try {
      const updatedLayers = await arcgisServiceManager.bulkUpdateLayers(serviceId, serviceLayers, updates);
      
      // Replace the service layers with updated ones
      const otherLayers = layers.filter(l => l.serviceId !== serviceId);
      onLayersUpdated([...otherLayers, ...updatedLayers]);
    } catch (error) {
      console.error('Bulk operation failed:', error);
    }
  }, [layers, onLayersUpdated]);

  const getServiceStats = (service: ArcGISService) => {
    const serviceLayers = layers.filter(l => l.serviceId === service.id);
    const activeCount = serviceLayers.filter(l => l.status === 'active').length;
    const groups = [...new Set(serviceLayers.map(l => l.group))];
    
    return {
      totalLayers: serviceLayers.length,
      activeLayers: activeCount,
      groups: groups.length,
      lastSynced: service.layerDiscovery.lastDiscovered
    };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            ArcGIS Service Manager
          </CardTitle>
          <CardDescription>
            Manage layers from ArcGIS FeatureServers efficiently
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-url">Service URL</Label>
            <Input
              id="service-url"
              placeholder="https://services8.arcgis.com/.../FeatureServer"
              value={discoveryUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiscoveryUrl(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleDiscoverService} 
            disabled={isDiscovering || !discoveryUrl.trim()}
            className="w-full"
          >
            {isDiscovering ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Discover Service
              </>
            )}
          </Button>

          {discoveryResult && (
            <div className="mt-4">
              {discoveryResult.error ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Discovery Failed:</strong> {discoveryResult.error}
                  </AlertDescription>
                </Alert>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Service Found!</CardTitle>
                    <CardDescription>{discoveryResult.serviceDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium">Layers Found</p>
                        <p className="text-2xl font-bold text-green-600">
                          {discoveryResult.layers?.length || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Max Records</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {discoveryResult.maxRecordCount?.toLocaleString() || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <Button onClick={handleAddService} className="w-full">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Add Service & Generate Layers
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ServiceManager; 