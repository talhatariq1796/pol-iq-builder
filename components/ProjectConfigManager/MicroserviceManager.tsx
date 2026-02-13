'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Zap, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Activity,
  Database,
  Clock,
  Users
} from 'lucide-react';

import { MicroserviceConfiguration } from '@/types/project-config';

interface MicroserviceManagerProps {
  microservices: MicroserviceConfiguration[];
  onMicroserviceAdded: (microservice: MicroserviceConfiguration) => void;
  onMicroserviceUpdated: (microservice: MicroserviceConfiguration) => void;
  onMicroserviceRemoved: (microserviceId: string) => void;
}

export const MicroserviceManager: React.FC<MicroserviceManagerProps> = ({
  microservices,
  onMicroserviceAdded,
  onMicroserviceUpdated,
  onMicroserviceRemoved
}) => {
  const [isAddingService, setIsAddingService] = useState(false);
  const [newService, setNewService] = useState<Partial<MicroserviceConfiguration>>({
    type: 'shap',
    status: 'testing',
    endpoints: {
      health: '/api/v1/schema',
      main: '/analyze'
    },
    capabilities: [],
    metadata: {
      version: '1.0.0',
      author: '',
      tags: []
    }
  });
  const [testingService, setTestingService] = useState<string | null>(null);

  // Predefined SHAP microservice template
  const shapTemplate: Partial<MicroserviceConfiguration> = {
    name: 'SHAP Analysis Microservice',
    type: 'shap',
    description: 'Provides SHAP (SHapley Additive exPlanations) analysis for demographic and consumer behavior data',
    url: process.env.NEXT_PUBLIC_SHAP_MICROSERVICE_URL || '', // Set NEXT_PUBLIC_SHAP_MICROSERVICE_URL in .env.local
    status: 'active',
    endpoints: {
      health: '/api/v1/schema', // Use schema endpoint as health check since /health doesn't exist
      main: '/analyze',
      predict: '/analyze',
      features: '/api/v1/schema'
    },
    capabilities: [
      'SHAP Value Analysis',
      'Demographic Insights',
      'Consumer Behavior Analysis',
      'Athletic Brand Preferences',
      'Population Predictions',
      'Zip Code Analysis'
    ],
    dataSource: {
      type: 'arcgis',
      source: 'Synapse54_Vetements_layers FeatureServer',
      lastUpdated: new Date().toISOString(),
      recordCount: 3983
    },
    metadata: {
      version: '2.0.0',
      author: 'Data Science Team',
      tags: ['shap', 'ml', 'demographics', 'analysis', 'xgboost'],
      documentation: 'https://github.com/your-repo/shap-microservice'
    }
  };

  const handleAddSHAPService = useCallback(() => {
    const shapService: MicroserviceConfiguration = {
      ...shapTemplate as MicroserviceConfiguration,
      id: `shap-service-${Date.now()}`
    };
    
    onMicroserviceAdded(shapService);
    setIsAddingService(false);
  }, [onMicroserviceAdded]);

  const handleAddCustomService = useCallback(() => {
    if (!newService.name || !newService.url) return;

    const service: MicroserviceConfiguration = {
      id: `service-${Date.now()}`,
      name: newService.name,
      type: newService.type || 'custom',
      url: newService.url,
      description: newService.description,
      status: newService.status || 'testing',
      endpoints: newService.endpoints || { health: '/api/v1/schema', main: '/analyze' },
      capabilities: newService.capabilities || [],
      metadata: {
        version: newService.metadata?.version || '1.0.0',
        author: newService.metadata?.author || '',
        tags: newService.metadata?.tags || []
      }
    };

    onMicroserviceAdded(service);
    setIsAddingService(false);
    setNewService({
      type: 'custom',
      status: 'testing',
      endpoints: { health: '/api/v1/schema', main: '/analyze' },
      capabilities: [],
      metadata: { version: '1.0.0', author: '', tags: [] }
    });
  }, [newService, onMicroserviceAdded]);

  const handleTestService = useCallback(async (service: MicroserviceConfiguration) => {
    setTestingService(service.id);
    
    try {
      const response = await fetch(`${service.url}${service.endpoints.health}`);
      const isHealthy = response.ok;
      
      const updatedService = {
        ...service,
        status: isHealthy ? 'active' as const : 'inactive' as const,
        performance: {
          avgResponseTime: Date.now() - performance.now(),
          uptime: isHealthy ? 100 : 0,
          lastCheck: new Date().toISOString()
        }
      };
      
      onMicroserviceUpdated(updatedService);
    } catch (error) {
      const updatedService = {
        ...service,
        status: 'inactive' as const,
        performance: {
          avgResponseTime: 0,
          uptime: 0,
          lastCheck: new Date().toISOString()
        }
      };
      onMicroserviceUpdated(updatedService);
    } finally {
      setTestingService(null);
    }
  }, [onMicroserviceUpdated]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'testing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'shap': return <Zap className="h-4 w-4" />;
      case 'analytics': return <Activity className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Microservices</h3>
          <p className="text-sm text-gray-600">Manage microservices for enhanced functionality</p>
        </div>
        <Button onClick={() => setIsAddingService(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Service
        </Button>
      </div>

      {/* Quick Add SHAP Service */}
      {microservices.length === 0 && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>
            Ready to add your SHAP microservice? This will connect your demographic analysis capabilities.
            <Button 
              onClick={handleAddSHAPService} 
              className="ml-4 h-8 px-3"
              variant="outline"
            >
              Add SHAP Service
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Add Service Dialog */}
      {isAddingService && (
        <Card>
          <CardHeader>
            <CardTitle>Add Microservice</CardTitle>
            <CardDescription>
              Configure a new microservice for your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="service-name">Service Name</Label>
                <Input
                  id="service-name"
                  value={newService.name || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewService((prev: any) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter service name"
                />
              </div>
              <div>
                <Label htmlFor="service-type">Service Type</Label>
                <Select 
                  value={newService.type} 
                  onValueChange={(value) => setNewService((prev: any) => ({ ...prev, type: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shap">SHAP Analysis</SelectItem>
                    <SelectItem value="analytics">Analytics</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="service-url">Service URL</Label>
              <Input
                id="service-url"
                value={newService.url || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewService((prev: any) => ({ ...prev, url: e.target.value }))}
                placeholder="https://your-service.onrender.com"
              />
            </div>

            <div>
              <Label htmlFor="service-description">Description</Label>
              <Textarea
                id="service-description"
                value={newService.description || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewService((prev: any) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this service does"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddCustomService}>Add Service</Button>
              <Button variant="outline" onClick={() => setIsAddingService(false)}>
                Cancel
              </Button>
              {newService.type === 'shap' && (
                <Button onClick={handleAddSHAPService} variant="secondary">
                  Use SHAP Template
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services List */}
      <div className="grid gap-4">
        {microservices.map((service) => (
          <Card key={service.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getTypeIcon(service.type)}
                  <div>
                    <CardTitle className="text-base">{service.name}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(service.status)}>
                    {service.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestService(service)}
                    disabled={testingService === service.id}
                  >
                    {testingService === service.id ? 'Testing...' : 'Test'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(service.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onMicroserviceRemoved(service.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-500">URL</div>
                  <div className="truncate">{service.url}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-500">Version</div>
                  <div>{service.metadata.version}</div>
                </div>
                {service.dataSource && (
                  <div>
                    <div className="font-medium text-gray-500">Records</div>
                    <div className="flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      {service.dataSource.recordCount.toLocaleString()}
                    </div>
                  </div>
                )}
                {service.performance && (
                  <div>
                    <div className="font-medium text-gray-500">Uptime</div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {service.performance.uptime}%
                    </div>
                  </div>
                )}
              </div>
              
              {service.capabilities.length > 0 && (
                <div className="mt-4">
                  <div className="font-medium text-gray-500 mb-2">Capabilities</div>
                  <div className="flex flex-wrap gap-1">
                    {service.capabilities.map((capability, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}; 