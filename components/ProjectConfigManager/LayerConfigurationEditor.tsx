'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { 
  Edit3, 
  Save, 
  // TestTube, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Settings, 
  Database, 
  Tag,
  Link,
  Search,
  Filter,
  Trash2,
  Plus,
  Copy,
  RefreshCw,
  MapPin,
  Table
} from 'lucide-react';

import { 
  ProjectConfiguration, 
  ConfigurationChange, 
  ValidationError,
  EnhancedLayerConfig,
  ServiceDerivedLayer,
  ArcGISField,
  LayerFieldConfiguration
} from '@/types/project-config';

interface LayerConfigurationEditorProps {
  config: ProjectConfiguration;
  onChange: (config: ProjectConfiguration, change: ConfigurationChange) => void;
  validationErrors: ValidationError[];
}

interface LayerTestResult {
  success: boolean;
  responseTime?: number;
  recordCount?: number;
  error?: string;
  fields?: ArcGISField[];
}

export const LayerConfigurationEditor: React.FC<LayerConfigurationEditorProps> = ({
  config,
  onChange,
  validationErrors
}) => {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, LayerTestResult>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [isTestingLayer, setIsTestingLayer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('basic');

  // Get all layers as an array
  const layers = useMemo(() => {
    return Object.values(config.layers);
  }, [config.layers]);

  // Filter layers based on search and filters
  const filteredLayers = useMemo(() => {
    return layers.filter(layer => {
      const matchesSearch = layer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          layer.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || layer.status === filterStatus;
      const matchesType = filterType === 'all' || layer.type === filterType;
      
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [layers, searchTerm, filterStatus, filterType]);

  // Get selected layer
  const selectedLayer = useMemo(() => {
    return selectedLayerId ? config.layers[selectedLayerId] : null;
  }, [config.layers, selectedLayerId]);

  // Auto-select first layer if none selected
  useEffect(() => {
    if (!selectedLayerId && filteredLayers.length > 0) {
      setSelectedLayerId(filteredLayers[0].id);
    }
  }, [selectedLayerId, filteredLayers]);

  const handleLayerUpdate = useCallback((layerId: string, updates: Partial<EnhancedLayerConfig>) => {
    const updatedLayers = {
      ...config.layers,
      [layerId]: {
        ...config.layers[layerId],
        ...updates
      }
    };

    const newConfig = { ...config, layers: updatedLayers };
    onChange(newConfig, {
      type: 'modify',
      target: 'layer',
      path: `layers.${layerId}`,
      oldValue: config.layers[layerId],
      newValue: updatedLayers[layerId]
    });
  }, [config, onChange]);

  const handleFieldUpdate = useCallback((layerId: string, fieldName: string, fieldConfig: Partial<LayerFieldConfiguration>) => {
    const layer = config.layers[layerId];
    if (!layer) return;

    const updatedFields = {
      ...layer.fieldConfiguration,
      [fieldName]: {
        ...layer.fieldConfiguration?.[fieldName],
        ...fieldConfig
      }
    };

    handleLayerUpdate(layerId, { fieldConfiguration: updatedFields });
  }, [config.layers, handleLayerUpdate]);

  const testLayerConnectivity = useCallback(async (layerId: string) => {
    const layer = config.layers[layerId];
    if (!layer) return;

    setIsTestingLayer(layerId);
    
    try {
      const startTime = Date.now();
      
      // Simulate layer connectivity test
      const response = await fetch(`${layer.url}?f=json`);
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        
        setTestResults((prev: any) => ({
          ...prev,
          [layerId]: {
            success: true,
            responseTime,
            recordCount: data.count || 0,
            fields: data.fields || []
          }
        }));
      } else {
        setTestResults((prev: any) => ({
          ...prev,
          [layerId]: {
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`
          }
        }));
      }
    } catch (error) {
      setTestResults((prev: any) => ({
        ...prev,
        [layerId]: {
          success: false,
          error: String(error)
        }
      }));
    } finally {
      setIsTestingLayer(null);
    }
  }, [config.layers]);

  const duplicateLayer = useCallback((layerId: string) => {
    const originalLayer = config.layers[layerId];
    if (!originalLayer) return;

    const newLayerId = `${layerId}_copy_${Date.now()}`;
    const newLayer = {
      ...originalLayer,
      id: newLayerId,
      name: `${originalLayer.name} (Copy)`,
      status: 'inactive' as const
    };

    const updatedLayers = {
      ...config.layers,
      [newLayerId]: newLayer
    };

    const newConfig = { ...config, layers: updatedLayers };
    onChange(newConfig, {
      type: 'add',
      target: 'layer',
      path: `layers.${newLayerId}`,
      oldValue: null,
      newValue: newLayer
    });

    setSelectedLayerId(newLayerId);
  }, [config, onChange]);

  const deleteLayer = useCallback((layerId: string) => {
    if (!confirm('Are you sure you want to delete this layer?')) return;

    const updatedLayers = { ...config.layers };
    delete updatedLayers[layerId];

    const newConfig = { ...config, layers: updatedLayers };
    onChange(newConfig, {
      type: 'remove',
      target: 'layer',
      path: `layers.${layerId}`,
      oldValue: config.layers[layerId],
      newValue: null
    });

    // Select another layer if this was selected
    if (selectedLayerId === layerId) {
      const remainingLayers = Object.keys(updatedLayers);
      setSelectedLayerId(remainingLayers.length > 0 ? remainingLayers[0] : null);
    }
  }, [config, onChange, selectedLayerId]);

  const getLayerValidationErrors = (layerId: string) => {
    return validationErrors.filter(error => error.path.startsWith(`layers.${layerId}`));
  };

  const renderLayerList = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Layers ({filteredLayers.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search layers..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="deprecated">Deprecated</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="raster">Raster</SelectItem>
                <SelectItem value="vector">Vector</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Layer List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLayers.map(layer => {
            const errors = getLayerValidationErrors(layer.id);
            const testResult = testResults[layer.id];
            
            return (
              <div
                key={layer.id}
                className={`p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedLayerId === layer.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedLayerId(layer.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{layer.name}</h4>
                      <Badge variant={layer.status === 'active' ? 'default' : 'secondary'}>
                        {layer.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{layer.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {layer.type}
                      </Badge>
                      {layer.group && (
                        <Badge variant="outline" className="text-xs">
                          {layer.group}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {errors.length > 0 && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    {testResult && (
                      testResult.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const renderLayerDetails = () => {
    if (!selectedLayer) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Select a layer to view and edit its configuration</p>
          </CardContent>
        </Card>
      );
    }

    const errors = getLayerValidationErrors(selectedLayer.id);
    const testResult = testResults[selectedLayer.id];

    return (
      <div className="space-y-6">
        {/* Layer Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  {selectedLayer.name}
                </CardTitle>
                <p className="text-gray-600 mt-1">{selectedLayer.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testLayerConnectivity(selectedLayer.id)}
                  disabled={isTestingLayer === selectedLayer.id}
                >
                  {isTestingLayer === selectedLayer.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <div className="h-4 w-4 bg-gray-400 rounded-full" />
                  )}
                  Test
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => duplicateLayer(selectedLayer.id)}
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteLayer(selectedLayer.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {/* Validation Errors */}
          {errors.length > 0 && (
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    {errors.map((error, index) => (
                      <div key={index} className="text-sm">
                        {error.message}
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          )}

          {/* Test Results */}
          {testResult && (
            <CardContent>
              <Alert>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {testResult.success ? (
                    <div className="space-y-1">
                      <div>✅ Layer connectivity test passed</div>
                      <div className="text-xs text-gray-600">
                        Response time: {testResult.responseTime}ms
                        {testResult.recordCount !== undefined && (
                          <> • Records: {testResult.recordCount.toLocaleString()}</>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>❌ Layer connectivity test failed: {testResult.error}</div>
                  )}
                </AlertDescription>
              </Alert>
            </CardContent>
          )}
        </Card>

        {/* Layer Configuration Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="layer-name">Layer Name</Label>
                    <Input
                      id="layer-name"
                      value={selectedLayer.name}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLayerUpdate(selectedLayer.id, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="layer-type">Layer Type</Label>
                    <Select
                      value={selectedLayer.type}
                      onValueChange={(value) => handleLayerUpdate(selectedLayer.id, { type: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="feature">Feature Layer</SelectItem>
                        <SelectItem value="raster">Raster Layer</SelectItem>
                        <SelectItem value="vector">Vector Layer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="layer-description">Description</Label>
                  <Textarea
                    id="layer-description"
                    value={selectedLayer.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLayerUpdate(selectedLayer.id, { description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="layer-url">Service URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="layer-url"
                      value={selectedLayer.url}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLayerUpdate(selectedLayer.id, { url: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      onClick={() => testLayerConnectivity(selectedLayer.id)}
                      disabled={isTestingLayer === selectedLayer.id}
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="layer-status">Status</Label>
                    <Select
                      value={selectedLayer.status}
                      onValueChange={(value) => handleLayerUpdate(selectedLayer.id, { status: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="deprecated">Deprecated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="layer-group">Group</Label>
                    <Select
                      value={selectedLayer.group || ''}
                      onValueChange={(value) => handleLayerUpdate(selectedLayer.id, { group: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select group..." />
                      </SelectTrigger>
                      <SelectContent>
                        {config.groups?.map(group => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fields" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Table className="h-5 w-5" />
                  Field Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedLayer.fields && selectedLayer.fields.length > 0 ? (
                  <div className="space-y-3">
                    {selectedLayer.fields.map(field => {
                      const fieldConfig = selectedLayer.fieldConfiguration?.[field.name] || {};
                      
                      return (
                        <div key={field.name} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{field.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {field.type}
                              </Badge>
                              {fieldConfig.visible !== false && (
                                <Eye className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={fieldConfig.visible !== false}
                                onCheckedChange={(checked: boolean) => 
                                  handleFieldUpdate(selectedLayer.id, field.name, { visible: checked })
                                }
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingField(editingField === field.name ? null : field.name)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {editingField === field.name && (
                            <div className="space-y-3 mt-3 pt-3 border-t">
                              <div>
                                <Label>Display Alias</Label>
                                <Input
                                  value={fieldConfig.alias || field.alias || field.name}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                                    handleFieldUpdate(selectedLayer.id, field.name, { alias: e.target.value })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Description</Label>
                                <Textarea
                                  value={fieldConfig.description || ''}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                                    handleFieldUpdate(selectedLayer.id, field.name, { description: e.target.value })
                                  }
                                  rows={2}
                                />
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={fieldConfig.searchable !== false}
                                    onCheckedChange={(checked: boolean) => 
                                      handleFieldUpdate(selectedLayer.id, field.name, { searchable: checked })
                                    }
                                  />
                                  <Label>Searchable</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={fieldConfig.filterable !== false}
                                    onCheckedChange={(checked: boolean) => 
                                      handleFieldUpdate(selectedLayer.id, field.name, { filterable: checked })
                                    }
                                  />
                                  <Label>Filterable</Label>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Table className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p>No fields available. Test the layer connection to load field information.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metadata" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Metadata & Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    value={selectedLayer.metadata?.tags?.join(', ') || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
                      handleLayerUpdate(selectedLayer.id, {
                        metadata: { ...selectedLayer.metadata, tags }
                      });
                    }}
                    placeholder="demographics, census, population"
                  />
                </div>

                <div>
                  <Label>Category</Label>
                  <Input
                    value={selectedLayer.metadata?.category || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLayerUpdate(selectedLayer.id, {
                      metadata: { ...selectedLayer.metadata, category: e.target.value }
                    })}
                    placeholder="Demographics"
                  />
                </div>

                <div>
                  <Label>Data Source</Label>
                  <Input
                    value={selectedLayer.metadata?.source || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLayerUpdate(selectedLayer.id, {
                      metadata: { ...selectedLayer.metadata, source: e.target.value }
                    })}
                    placeholder="U.S. Census Bureau"
                  />
                </div>

                <div>
                  <Label>Update Frequency</Label>
                  <Select
                    value={selectedLayer.metadata?.updateFrequency || ''}
                    onValueChange={(value) => handleLayerUpdate(selectedLayer.id, {
                      metadata: { ...selectedLayer.metadata, updateFrequency: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real-time">Real-time</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                      <SelectItem value="static">Static</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Advanced Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Max Record Count</Label>
                    <Input
                      type="number"
                      value={selectedLayer.maxRecordCount || 5000}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLayerUpdate(selectedLayer.id, { 
                        maxRecordCount: parseInt(e.target.value) || 5000 
                      })}
                    />
                  </div>
                  <div>
                    <Label>Geometry Type</Label>
                    <Select
                      value={selectedLayer.geometryType || 'polygon'}
                      onValueChange={(value) => handleLayerUpdate(selectedLayer.id, { geometryType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="point">Point</SelectItem>
                        <SelectItem value="polyline">Polyline</SelectItem>
                        <SelectItem value="polygon">Polygon</SelectItem>
                        <SelectItem value="multipoint">Multipoint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedLayer.supportsQuery !== false}
                      onCheckedChange={(checked: boolean) => handleLayerUpdate(selectedLayer.id, { supportsQuery: checked })}
                    />
                    <Label>Supports Query</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedLayer.supportsStatistics !== false}
                      onCheckedChange={(checked: boolean) => handleLayerUpdate(selectedLayer.id, { supportsStatistics: checked })}
                    />
                    <Label>Supports Statistics</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedLayer.supportsPagination !== false}
                      onCheckedChange={(checked: boolean) => handleLayerUpdate(selectedLayer.id, { supportsPagination: checked })}
                    />
                    <Label>Supports Pagination</Label>
                  </div>
                </div>

                <div>
                  <Label>Custom Where Clause</Label>
                  <Textarea
                    value={selectedLayer.whereClause || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleLayerUpdate(selectedLayer.id, { whereClause: e.target.value })}
                    placeholder="1=1"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <div className="h-full p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Layer List - Left Panel */}
        <div className="lg:col-span-1">
          {renderLayerList()}
        </div>

        {/* Layer Details - Right Panel */}
        <div className="lg:col-span-2">
          {renderLayerDetails()}
        </div>
      </div>
    </div>
  );
}; 