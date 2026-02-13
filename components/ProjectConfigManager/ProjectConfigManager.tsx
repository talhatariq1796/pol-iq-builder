// components/ProjectConfigManager/ProjectConfigManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Info, Settings, Eye, Save, Upload, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  ProjectConfiguration, 
  ProjectTemplate, 
  ValidationResult,
  DeploymentResult,
  ImpactAnalysis,
  ConfigurationChange,
  ProjectConfigUIState,
  ArcGISService,
  ServiceDerivedLayer,
  LayerGroupConfiguration
} from '@/types/project-config';
import { projectConfigManager } from '@/services/project-config-manager';
import { LayerConfigurationEditor } from './LayerConfigurationEditor';
import { GroupManagementPanel } from './GroupManagementPanel';
import { ConceptMappingEditor } from './ConceptMappingEditor';
import { DependencyAnalyzer } from './DependencyAnalyzer';
import { ProjectPreview } from './ProjectPreview';
import { TemplateLibrary } from './TemplateLibrary';
import { AdvancedServiceManager } from './AdvancedServiceManager';
import { MicroserviceManager } from './MicroserviceManager';
import { DeploymentTestDialog } from './DeploymentTestDialog';
import { DeploymentResultsDialog } from './DeploymentResultsDialog';

interface ProjectConfigManagerProps {
  onClose?: () => void;
  initialConfig?: ProjectConfiguration;
}

export const ProjectConfigManager: React.FC<ProjectConfigManagerProps> = ({
  onClose,
  initialConfig
}) => {
  const [uiState, setUIState] = useState<ProjectConfigUIState>({
    activeTab: 'services',
    editMode: false,
    previewMode: false,
    unsavedChanges: false,
    validationStatus: null,
    deploymentStatus: 'idle'
  });

  const [currentConfig, setCurrentConfig] = useState<ProjectConfiguration | null>(initialConfig || null);

  // Create a default configuration for testing purposes
  useEffect(() => {
    if (!currentConfig && !initialConfig) {
      const defaultConfig: ProjectConfiguration = {
        id: 'test-config-' + Date.now(),
        name: 'Test Project Configuration',
        description: 'Default configuration for testing the Project Configuration Management System',
        version: '1.0.0',
        layers: {},
        groups: [],
        conceptMappings: {
          layerMappings: {},
          fieldMappings: {},
          synonyms: {},
          weights: {},
          customConcepts: []
        },
        dependencies: {
          files: [],
          services: [],
          components: []
        },
        settings: {
          defaultVisibility: {},
          defaultCollapsed: {},
          globalSettings: {
            defaultOpacity: 0.8,
            maxVisibleLayers: 10,
            performanceMode: 'standard',
            autoSave: true,
            previewMode: false
          },
          ui: {
            theme: 'light',
            compactMode: false,
            showAdvanced: false
          }
        },
        metadata: {
          industry: 'Testing',
          useCase: 'System Testing',
          targetAudience: ['Developers', 'Testers'],
          dataRequirements: ['ArcGIS Services'],
          performanceRequirements: {
            maxLoadTime: 5000,
            maxLayers: 50,
            memoryLimit: 512
          },
          integrations: ['ArcGIS Online']
        },
        services: {
          arcgis: [],
          microservices: []
        }
      };
      setCurrentConfig(defaultConfig);
    }
  }, [currentConfig, initialConfig]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [changes, setChanges] = useState<ConfigurationChange[]>([]);
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  
  // Deployment test dialog state
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<{
    validationReport: any;
    simulationResult: DeploymentResult | null;
    isLoading: boolean;
  }>({
    validationReport: null,
    simulationResult: null,
    isLoading: false
  });

  // Deployment results dialog state
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [deployResults, setDeployResults] = useState<{
    deploymentResult: DeploymentResult | null;
    isLoading: boolean;
  }>({
    deploymentResult: null,
    isLoading: false
  });

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Validate configuration when it changes
  useEffect(() => {
    if (currentConfig) {
      validateCurrentConfig();
    }
  }, [currentConfig]);

  const loadTemplates = async () => {
    try {
      // For testing, use mock templates instead of Supabase
      const mockTemplates: ProjectTemplate[] = [
        {
          id: 'demo-template',
          name: 'Demo Template',
          description: 'A demo template for testing',
          category: 'custom',
          tags: ['demo', 'test'],
          author: 'System',
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: true,
          configuration: currentConfig || {} as ProjectConfiguration
        }
      ];
      setTemplates(mockTemplates);
      console.log('✅ Loaded mock templates for testing');
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const validateCurrentConfig = async () => {
    if (!currentConfig) return;

    const validation = projectConfigManager.validateConfiguration(currentConfig);
    setUIState((prev: any) => ({ ...prev, validationStatus: validation }));
  };

  const handleConfigChange = useCallback((newConfig: ProjectConfiguration, changeType: ConfigurationChange) => {
    setCurrentConfig(newConfig);
    setChanges((prev: any) => [...prev, changeType]);
    setUIState((prev: any) => ({ ...prev, unsavedChanges: true }));
    
    // Analyze impact of changes
    if (changes.length > 0) {
      const analysis = projectConfigManager.analyzeImpact(newConfig, [...changes, changeType]);
      setImpactAnalysis(analysis);
    }
  }, [changes]);

  const handleSave = async () => {
    if (!currentConfig) return;

    try {
      setUIState((prev: any) => ({ ...prev, deploymentStatus: 'validating' }));
      
      const validation = projectConfigManager.validateConfiguration(currentConfig);
      if (!validation.isValid) {
        setUIState((prev: any) => ({ ...prev, deploymentStatus: 'error' }));
        return;
      }

      await projectConfigManager.saveConfiguration(currentConfig);
      setUIState((prev: any) => ({ 
        ...prev, 
        unsavedChanges: false, 
        deploymentStatus: 'success' 
      }));
      setChanges([]);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setUIState((prev: any) => ({ ...prev, deploymentStatus: 'error' }));
    }
  };

  const handleDeploy = async () => {
    if (!currentConfig) return;

    // Open dialog and start loading
    setIsDeployDialogOpen(true);
    setDeployResults({
      deploymentResult: null,
      isLoading: true
    });

    try {
      setUIState((prev: any) => ({ ...prev, deploymentStatus: 'deploying' }));
      
      const result = await projectConfigManager.deployConfiguration(currentConfig);
      
      // Update dialog with results
      setDeployResults({
        deploymentResult: result,
        isLoading: false
      });
      
      if (result.success) {
        setUIState((prev: any) => ({ 
          ...prev, 
          deploymentStatus: 'success',
          unsavedChanges: false 
        }));
        setChanges([]);
      } else {
        setUIState((prev: any) => ({ ...prev, deploymentStatus: 'error' }));
      }
    } catch (error) {
      console.error('Deployment failed:', error);
      setDeployResults((prev: any) => ({
        ...prev,
        isLoading: false
      }));
      setUIState((prev: any) => ({ ...prev, deploymentStatus: 'error' }));
    }
  };

  const handleTestDeploy = async () => {
    if (!currentConfig) return;

    console.log('🎯 Starting unified deployment validation with mandatory requirements...');
    setIsTestDialogOpen(true);
    setTestResults({
      validationReport: null,
      simulationResult: null,
      isLoading: true
    });

    try {
      // Use the new unified system with mandatory requirements
      const simulationResult = await projectConfigManager.testDeploymentUnified(currentConfig);
      console.log('🎯 Unified deployment test completed:', {
        success: simulationResult.success,
        queryTestingEnabled: simulationResult.queryTestingEnabled,
        filesUpdated: simulationResult.filesUpdated?.length || 0,
        errors: simulationResult.errors?.length || 0
      });
      
      // Generate validation report for UI display
      const validationReport = {
        isValid: simulationResult.success,
        recommendDeployment: simulationResult.success,
        errors: simulationResult.errors?.map(e => ({
          type: e.file as any,
          message: e.error,
          path: e.file,
          severity: e.critical ? 'error' as const : 'warning' as const,
          autoFixAvailable: false
        })) || [],
        warnings: simulationResult.warnings?.map(w => ({
          type: 'performance' as const,
          message: w,
          path: '',
          recommendation: ''
        })) || [],
        suggestions: []
      };
      
      // Update dialog with results
      setTestResults({
        validationReport,
        simulationResult,
        isLoading: false
      });
      
      // Update UI state based on mandatory requirements
      // Success only if ALL requirements are met:
      // 1. Configuration validation passed
      // 2. 100% structure preservation achieved  
      // 3. Query testing passed
      const allRequirementsMet = simulationResult.success && 
                                simulationResult.queryTestingEnabled &&
                                (simulationResult.queryTestResults?.criticalTestsPassed ?? false);
      
      setUIState((prev: any) => ({ 
        ...prev, 
        deploymentStatus: allRequirementsMet ? 'success' : 'error' 
      }));
      
      // Log deployment readiness
      if (allRequirementsMet) {
        console.log('✅ All deployment requirements met - ready for production deployment');
      } else {
        console.error('🚨 Deployment requirements not met:', {
          basicValidation: simulationResult.success,
          queryTesting: simulationResult.queryTestingEnabled,
          criticalTests: simulationResult.queryTestResults?.criticalTestsPassed,
          structurePreservation: simulationResult.errors?.some(e => e.file === 'structure-preservation') ? 'FAILED' : 'SUCCESS'
        });
      }
      
    } catch (error) {
      console.error('🚨 Unified deployment test failed:', error);
      setTestResults({
        validationReport: {
          isValid: false,
          recommendDeployment: false,
          errors: [{
            type: 'deployment-system' as any,
            message: `System failure: ${error instanceof Error ? error.message : 'Unknown error'}`,
            path: 'deployment-system',
            severity: 'error' as const,
            autoFixAvailable: false
          }],
          warnings: [],
          suggestions: []
        },
        simulationResult: null,
        isLoading: false
      });
      setUIState((prev: any) => ({ ...prev, deploymentStatus: 'error' }));
    }
  };

  const handleProceedWithDeployment = async () => {
    setIsTestDialogOpen(false);
    await handleDeploy();
  };

  const handleCloseTestDialog = () => {
    setIsTestDialogOpen(false);
    setTestResults({
      validationReport: null,
      simulationResult: null,
      isLoading: false
    });
  };

  const handleCloseDeployDialog = () => {
    setIsDeployDialogOpen(false);
    setDeployResults({
      deploymentResult: null,
      isLoading: false
    });
  };

  const handleCreateFromTemplate = async (templateId: string, projectName: string) => {
    try {
      const newConfig = await projectConfigManager.createConfigurationFromTemplate(templateId, projectName);
      setCurrentConfig(newConfig);
      setUIState((prev: any) => ({ ...prev, editMode: true, unsavedChanges: true }));
    } catch (error) {
      console.error('Failed to create from template:', error);
    }
  };

  const handleExportConfig = () => {
    if (!currentConfig) return;
    
    const dataStr = JSON.stringify(currentConfig, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${currentConfig.name}_config.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);
        
        // Validate that it's a proper ProjectConfiguration
        if (!config.id || !config.name || !config.version) {
          throw new Error('Invalid configuration file format');
        }
        
        console.log('📥 Importing configuration:', config.name, {
          layers: Object.keys(config.layers || {}).length,
          groups: (config.groups || []).length,
          version: config.version
        });
        
        setCurrentConfig(config);
        setUIState((prev: any) => ({ ...prev, editMode: true, unsavedChanges: true }));
        
        // Explicitly trigger validation after import
        setTimeout(() => {
          const validation = projectConfigManager.validateConfiguration(config);
          setUIState((prev: any) => ({ ...prev, validationStatus: validation }));
          console.log('🔍 Validation after import:', { isValid: validation.isValid, errors: validation.errors.length });
        }, 100);
        
        // Clear the file input so the same file can be imported again if needed
        event.target.value = '';
        
        console.log('✅ Configuration imported successfully!');
      } catch (error) {
        console.error('❌ Failed to import configuration:', error);
        alert(`Failed to import configuration: ${error instanceof Error ? error.message : 'Invalid file format'}`);
      }
    };
    reader.readAsText(file);
  };

  const renderValidationStatus = () => {
    const { validationStatus } = uiState;
    if (!validationStatus) return null;

    const { errors, warnings, suggestions } = validationStatus;
    
    return (
      <div className="space-y-2">
        {errors.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {errors.length} error{errors.length > 1 ? 's' : ''} found
            </AlertDescription>
          </Alert>
        )}
        
        {warnings.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {warnings.length} warning{warnings.length > 1 ? 's' : ''} found
            </AlertDescription>
          </Alert>
        )}
        
        {suggestions.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {suggestions.length} optimization{suggestions.length > 1 ? 's' : ''} suggested
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  const renderDeploymentStatus = () => {
    const { deploymentStatus } = uiState;
    
    switch (deploymentStatus) {
      case 'validating':
        return (
          <div className="flex items-center space-x-2">
            <Progress value={33} className="w-32" />
            <span className="text-sm">Validating...</span>
          </div>
        );
      case 'deploying':
        return (
          <div className="flex items-center space-x-2">
            <Progress value={66} className="w-32" />
            <span className="text-sm">Deploying...</span>
          </div>
        );
      case 'success':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Deployed
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="secondary" className="bg-red-500 text-white">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  if (!currentConfig) {
    return (
      <div className="h-full flex items-center justify-center">
        <TemplateLibrary
          templates={templates}
          onCreateFromTemplate={handleCreateFromTemplate}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Compact Header */}
      <div className="border-b p-2 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-lg font-semibold truncate max-w-64">{currentConfig.name}</h1>
            </div>
            
            {/* Inline validation status - compact */}
            <div className="flex items-center space-x-2">
              {uiState.validationStatus?.isValid ? (
                <Badge variant="default" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Valid
                </Badge>
              ) : uiState.validationStatus ? (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {uiState.validationStatus.errors.length} errors
                </Badge>
              ) : null}
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {renderDeploymentStatus()}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUIState((prev: any) => ({ ...prev, previewMode: !prev.previewMode }))}
              className="h-7 px-2 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              {uiState.previewMode ? 'Edit' : 'Preview'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportConfig}
              className="h-7 px-2 text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('config-import-input')?.click()}
              className="h-7 px-2 text-xs"
            >
              <Upload className="h-3 w-3 mr-1" />
              Import
            </Button>
            
            <input
              id="config-import-input"
              type="file"
              accept=".json"
              onChange={handleImportConfig}
              style={{ display: 'none' }}
            />
            
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!uiState.unsavedChanges || uiState.deploymentStatus === 'deploying'}
              className="h-7 px-2 text-xs"
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            
            <Button
              variant="outline"
              onClick={handleTestDeploy}
              disabled={!uiState.validationStatus?.isValid || uiState.deploymentStatus === 'deploying'}
              className="h-7 px-2 text-xs"
            >
              🧪 Test Deploy
            </Button>
            
            <Button
              onClick={handleDeploy}
              disabled={!uiState.validationStatus?.isValid || uiState.deploymentStatus === 'deploying'}
              className="h-7 px-2 text-xs"
            >
              Deploy
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {uiState.previewMode ? (
          <ProjectPreview 
            config={currentConfig}
            impactAnalysis={impactAnalysis}
          />
        ) : (
          <Tabs 
            value={uiState.activeTab} 
            onValueChange={(value) => setUIState((prev: any) => ({ ...prev, activeTab: value as any }))}
            className="h-full flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-8 h-8 p-0">
              <TabsTrigger value="services" className="text-xs py-1 px-2">ArcGIS Services</TabsTrigger>
              <TabsTrigger value="microservices" className="text-xs py-1 px-2">Microservices</TabsTrigger>
              <TabsTrigger value="layers" className="text-xs py-1 px-2">Layer Editor</TabsTrigger>
              <TabsTrigger value="groups" className="text-xs py-1 px-2">Groups</TabsTrigger>
              <TabsTrigger value="concepts" className="text-xs py-1 px-2">Concepts</TabsTrigger>
              <TabsTrigger value="dependencies" className="text-xs py-1 px-2">Dependencies</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs py-1 px-2">Settings</TabsTrigger>
              <TabsTrigger value="preview" className="text-xs py-1 px-2">Preview</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-auto p-0">
              <TabsContent value="services" className="h-full m-0 p-0">
                <AdvancedServiceManager
                  services={currentConfig.services?.arcgis || []}
                  layers={Object.values(currentConfig.layers).filter(layer => 'serviceId' in layer) as ServiceDerivedLayer[]}
                  groups={currentConfig.groups || []}
                  onServiceAdded={(service: ArcGISService) => {
                    const newConfig = {
                      ...currentConfig,
                      services: {
                        ...currentConfig.services,
                        arcgis: [...(currentConfig.services?.arcgis || []), service]
                      }
                    };
                    handleConfigChange(newConfig, {
                      type: 'add',
                      target: 'service',
                      path: `services.arcgis.${service.id}`,
                      oldValue: null,
                      newValue: service
                    });
                  }}
                  onServiceUpdated={(service: ArcGISService) => {
                    const newConfig = {
                      ...currentConfig,
                      services: {
                        ...currentConfig.services,
                        arcgis: (currentConfig.services?.arcgis || []).map(s => s.id === service.id ? service : s)
                      }
                    };
                    handleConfigChange(newConfig, {
                      type: 'modify',
                      target: 'service',
                      path: `services.arcgis.${service.id}`,
                      oldValue: currentConfig.services?.arcgis?.find(s => s.id === service.id),
                      newValue: service
                    });
                  }}
                  onServiceRemoved={(serviceId: string) => {
                    const newConfig = {
                      ...currentConfig,
                      services: {
                        ...currentConfig.services,
                        arcgis: (currentConfig.services?.arcgis || []).filter(s => s.id !== serviceId)
                      }
                    };
                    handleConfigChange(newConfig, {
                      type: 'remove',
                      target: 'service',
                      path: `services.arcgis.${serviceId}`,
                      oldValue: currentConfig.services?.arcgis?.find(s => s.id === serviceId),
                      newValue: null
                    });
                  }}
                  onLayersGenerated={(layers: ServiceDerivedLayer[]) => {
                    const newLayers = { ...currentConfig.layers };
                    layers.forEach(layer => {
                      newLayers[layer.id] = layer;
                    });
                    const newConfig = { ...currentConfig, layers: newLayers };
                    handleConfigChange(newConfig, {
                      type: 'add',
                      target: 'layers',
                      path: 'layers',
                      oldValue: currentConfig.layers,
                      newValue: newLayers
                    });
                  }}
                  onLayersUpdated={(layers: ServiceDerivedLayer[]) => {
                    const newLayers = { ...currentConfig.layers };
                    layers.forEach(layer => {
                      newLayers[layer.id] = layer;
                    });
                    const newConfig = { ...currentConfig, layers: newLayers };
                    handleConfigChange(newConfig, {
                      type: 'modify',
                      target: 'layers',
                      path: 'layers',
                      oldValue: currentConfig.layers,
                      newValue: newLayers
                    });
                  }}
                  onLayerAdded={(layer: ServiceDerivedLayer) => {
                    const newLayers = { ...currentConfig.layers };
                    newLayers[layer.id] = layer;
                    const newConfig = { ...currentConfig, layers: newLayers };
                    handleConfigChange(newConfig, {
                      type: 'add',
                      target: 'layer',
                      path: `layers.${layer.id}`,
                      oldValue: null,
                      newValue: layer
                    });
                  }}
                  onLayerRemoved={(layerId: string) => {
                    const newLayers = { ...currentConfig.layers };
                    delete newLayers[layerId];
                    const newConfig = { ...currentConfig, layers: newLayers };
                    handleConfigChange(newConfig, {
                      type: 'remove',
                      target: 'layer',
                      path: `layers.${layerId}`,
                      oldValue: currentConfig.layers[layerId],
                      newValue: null
                    });
                  }}
                  onLayerGroupChanged={(layerId: string, newGroupId: string) => {
                    const newLayers = { ...currentConfig.layers };
                    if (newLayers[layerId]) {
                      newLayers[layerId] = { ...newLayers[layerId], group: newGroupId };
                    }
                    const newConfig = { ...currentConfig, layers: newLayers };
                    handleConfigChange(newConfig, {
                      type: 'modify',
                      target: 'layer',
                      path: `layers.${layerId}.group`,
                      oldValue: currentConfig.layers[layerId]?.group,
                      newValue: newGroupId
                    });
                  }}
                  onGroupsUpdated={(groups: LayerGroupConfiguration[]) => {
                    const newConfig = { ...currentConfig, groups };
                    handleConfigChange(newConfig, {
                      type: 'modify',
                      target: 'group',
                      path: 'groups',
                      oldValue: currentConfig.groups,
                      newValue: groups
                    });
                  }}
                />
              </TabsContent>
              
              <TabsContent value="microservices" className="h-full m-0 p-0">
                <div className="p-4 h-full overflow-auto">
                  <MicroserviceManager
                    microservices={currentConfig.services?.microservices || []}
                    onMicroserviceAdded={(microservice) => {
                      const newConfig = {
                        ...currentConfig,
                        services: {
                          ...currentConfig.services,
                          microservices: [...(currentConfig.services?.microservices || []), microservice]
                        }
                      };
                      handleConfigChange(newConfig, {
                        type: 'add',
                        target: 'service',
                        path: `services.microservices.${microservice.id}`,
                        oldValue: null,
                        newValue: microservice
                      });
                    }}
                    onMicroserviceUpdated={(microservice) => {
                      const newConfig = {
                        ...currentConfig,
                        services: {
                          ...currentConfig.services,
                          microservices: (currentConfig.services?.microservices || []).map(ms => 
                            ms.id === microservice.id ? microservice : ms
                          )
                        }
                      };
                      handleConfigChange(newConfig, {
                        type: 'modify',
                        target: 'service',
                        path: `services.microservices.${microservice.id}`,
                        oldValue: currentConfig.services?.microservices?.find(ms => ms.id === microservice.id),
                        newValue: microservice
                      });
                    }}
                    onMicroserviceRemoved={(microserviceId) => {
                      const newConfig = {
                        ...currentConfig,
                        services: {
                          ...currentConfig.services,
                          microservices: (currentConfig.services?.microservices || []).filter(ms => ms.id !== microserviceId)
                        }
                      };
                      handleConfigChange(newConfig, {
                        type: 'remove',
                        target: 'service',
                        path: `services.microservices.${microserviceId}`,
                        oldValue: currentConfig.services?.microservices?.find(ms => ms.id === microserviceId),
                        newValue: null
                      });
                    }}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="layers" className="h-full m-0 p-0">
                <LayerConfigurationEditor
                  config={currentConfig}
                  onChange={handleConfigChange}
                  validationErrors={uiState.validationStatus?.errors.filter(e => e.path.startsWith('layers')) || []}
                />
              </TabsContent>
              
              <TabsContent value="groups" className="h-full m-0 p-0">
                <GroupManagementPanel
                  config={currentConfig}
                  onChange={handleConfigChange}
                  validationErrors={uiState.validationStatus?.errors.filter(e => e.path.startsWith('groups')) || []}
                />
              </TabsContent>
              
              <TabsContent value="concepts" className="h-full m-0 p-0">
                <ConceptMappingEditor
                  config={currentConfig}
                  onChange={handleConfigChange}
                  validationErrors={uiState.validationStatus?.errors.filter(e => e.path.startsWith('conceptMappings')) || []}
                />
              </TabsContent>
              
              <TabsContent value="dependencies" className="h-full m-0 p-0">
                <DependencyAnalyzer
                  config={currentConfig}
                  onChange={handleConfigChange}
                  impactAnalysis={impactAnalysis}
                  validationErrors={uiState.validationStatus?.errors.filter(e => e.path.startsWith('dependencies')) || []}
                />
              </TabsContent>
              
              <TabsContent value="settings" className="h-full m-0 p-0">
                <div className="p-4 space-y-4 h-full overflow-auto">
                  <Card>
                    <CardHeader>
                      <CardTitle>Project Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="project-name">Project Name</Label>
                        <Input
                          id="project-name"
                          value={currentConfig.name}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                            const newConfig = { ...currentConfig, name: e.target.value };
                            handleConfigChange(newConfig, {
                              type: 'modify',
                              target: 'setting',
                              path: 'name',
                              oldValue: currentConfig.name,
                              newValue: e.target.value
                            });
                          }}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="project-description">Description</Label>
                        <Textarea
                          id="project-description"
                          value={currentConfig.description}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                            const newConfig = { ...currentConfig, description: e.target.value };
                            handleConfigChange(newConfig, {
                              type: 'modify',
                              target: 'setting',
                              path: 'description',
                              oldValue: currentConfig.description,
                              newValue: e.target.value
                            });
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="preview" className="h-full m-0 p-0">
                <ProjectPreview 
                  config={currentConfig}
                  impactAnalysis={impactAnalysis}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>
      
      {/* Deployment Test Dialog */}
      <DeploymentTestDialog
        isOpen={isTestDialogOpen}
        onClose={handleCloseTestDialog}
        onProceedWithDeployment={handleProceedWithDeployment}
        validationReport={testResults.validationReport}
        simulationResult={testResults.simulationResult}
        isLoading={testResults.isLoading}
      />

      {/* Deployment Results Dialog */}
      <DeploymentResultsDialog
        isOpen={isDeployDialogOpen}
        onClose={handleCloseDeployDialog}
        deploymentResult={deployResults.deploymentResult}
        isLoading={deployResults.isLoading}
      />
    </div>
  );
}; 