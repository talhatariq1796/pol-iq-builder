// services/local-config-manager.ts
// Local development configuration manager with file system access

import { ProjectConfiguration, ValidationResult, DeploymentResult } from '@/types/project-config';
import { layers, baseLayerConfigs } from '@/config/layers';
import * as fs from 'fs';
import * as path from 'path';

export class LocalConfigurationManager {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  // Convert current configuration to ProjectConfiguration format
  async getCurrentConfiguration(): Promise<ProjectConfiguration> {
    const currentConfig: ProjectConfiguration = {
      id: 'local-config',
      name: 'Local Development Configuration',
      description: 'Configuration for local development and testing',
      version: '1.0.0',
      layers: this.convertLayersToEnhanced(),
      groups: this.extractGroups(),
      conceptMappings: await this.extractConceptMappings(),
      dependencies: await this.scanDependencies(),
      settings: {
        defaultVisibility: {},
        defaultCollapsed: {
          'nesto-group': false,
          'demographics-group': true,
          'housing-group': true,
          'income-group': true,
          'spending-group': true
        },
        globalSettings: {
          defaultOpacity: 0.8,
          maxVisibleLayers: 10,
          performanceMode: 'standard',
          autoSave: true,
          previewMode: false
        },
        ui: {
          theme: 'auto',
          compactMode: false,
          showAdvanced: false
        }
      },
      metadata: {
        industry: 'Development',
        useCase: 'Local Testing',
        targetAudience: ['developers', 'testers'],
        dataRequirements: ['test data'],
        performanceRequirements: {
          maxLoadTime: 5000,
          maxLayers: 20,
          memoryLimit: 512
        },
        integrations: ['arcgis']
      },
      services: {
        arcgis: [],
        microservices: []
      }
    };

    return currentConfig;
  }

  private convertLayersToEnhanced() {
    const enhancedLayers: Record<string, any> = {};

    Object.entries(layers).forEach(([id, layer]) => {
      enhancedLayers[id] = {
        id: layer.id,
        name: layer.name,
        type: layer.type,
        url: layer.url,
        group: layer.group,
        description: layer.description,
        status: layer.status,
        fields: layer.fields || [],
        metadata: layer.metadata || {},
        usage: {
          queryFrequency: null, // P1-29: Removed Math.random() placeholder - would need real analytics
          lastUsed: new Date().toISOString(),
          popularCombinations: []
        }
      };
    });

    return enhancedLayers;
  }

  private extractGroups() {
    const groups = [
      {
        id: 'nesto-group',
        name: 'Nesto',
        description: 'Mortgage related data',
        layers: Object.keys(layers).filter(id => layers[id].group === 'nesto-group'),
        isCollapsed: false,
        priority: 1,
        color: '#3b82f6'
      },
      {
        id: 'demographics-group',
        name: 'Demographics',
        description: 'Population and demographic data',
        layers: Object.keys(layers).filter(id => layers[id].group === 'demographics-group'),
        isCollapsed: true,
        priority: 2,
        color: '#10b981'
      },
      {
        id: 'housing-group',
        name: 'Housing',
        description: 'Housing and dwelling data',
        layers: Object.keys(layers).filter(id => layers[id].group === 'housing-group'),
        isCollapsed: true,
        priority: 3,
        color: '#f59e0b'
      },
      {
        id: 'income-group',
        name: 'Income',
        description: 'Household income data',
        layers: Object.keys(layers).filter(id => layers[id].group === 'income-group'),
        isCollapsed: true,
        priority: 4,
        color: '#8b5cf6'
      },
      {
        id: 'spending-group',
        name: 'Spending',
        description: 'Household spending data',
        layers: Object.keys(layers).filter(id => layers[id].group === 'spending-group'),
        isCollapsed: true,
        priority: 5,
        color: '#ef4444'
      }
    ];

    return groups;
  }

  private async extractConceptMappings() {
    try {
      // Try to read existing concept map
      const conceptMapPath = path.join(this.projectRoot, 'config/concept-map.json');
      
      if (fs.existsSync(conceptMapPath)) {
        const conceptMapContent = fs.readFileSync(conceptMapPath, 'utf8');
        const conceptMap = JSON.parse(conceptMapContent);
        
        return {
          layerMappings: this.extractLayerMappings(conceptMap),
          fieldMappings: this.extractFieldMappings(conceptMap),
          synonyms: this.extractSynonyms(conceptMap),
          weights: this.extractWeights(conceptMap),
          customConcepts: []
        };
      }
    } catch (error) {
      console.warn('Could not read concept map:', error);
    }

    // Fallback to basic mappings
    return {
      layerMappings: {
        'mortgage': ['conversionRate', 'applications'],
        'demographics': ['totalPopulation', 'visibleMinorityPopulation'],
        'income': ['householdIncome', 'medianHouseholdIncome'],
        'housing': ['totalHouseholds', 'ownerOccupied']
      },
      fieldMappings: {
        'thematic_value': 'CONVERSIONRATE',
        'applications': 'FREQUENCY',
        'population': 'thematic_value'
      },
      synonyms: {
        'mortgage': ['loan', 'financing', 'lending'],
        'demographics': ['population', 'people', 'residents'],
        'income': ['earnings', 'salary', 'wages']
      },
      weights: {
        'mortgage': 25,
        'demographics': 20,
        'income': 25,
        'housing': 15
      },
      customConcepts: []
    };
  }

  private extractLayerMappings(conceptMap: any): Record<string, string[]> {
    const mappings: Record<string, string[]> = {};
    
    Object.entries(conceptMap).forEach(([key, value]: [string, any]) => {
      if (value.layers && Array.isArray(value.layers)) {
        mappings[value.concept || key] = value.layers;
      }
    });

    return mappings;
  }

  private extractFieldMappings(conceptMap: any): Record<string, string> {
    // Extract field mappings from concept map
    return {};
  }

  private extractSynonyms(conceptMap: any): Record<string, string[]> {
    const synonyms: Record<string, string[]> = {};
    
    Object.entries(conceptMap).forEach(([key, value]: [string, any]) => {
      if (value.synonyms && Array.isArray(value.synonyms)) {
        synonyms[value.concept || key] = value.synonyms;
      }
    });

    return synonyms;
  }

  private extractWeights(conceptMap: any): Record<string, number> {
    // Extract weights from concept map
    return {};
  }

  private async scanDependencies() {
    const dependencies = {
      files: await this.scanFileReferences(),
      services: this.getServiceDependencies(),
      components: await this.scanComponentReferences()
    };

    return dependencies;
  }

  private async scanFileReferences() {
    const fileDeps = [];
    const searchPaths = [
      'lib/',
      'components/',
      'services/',
      'utils/',
      'pages/api/',
      'adapters/'
    ];

    for (const searchPath of searchPaths) {
      const fullPath = path.join(this.projectRoot, searchPath);
      if (fs.existsSync(fullPath)) {
        const files = await this.findFilesWithLayerReferences(fullPath);
        fileDeps.push(...files);
      }
    }

    return fileDeps;
  }

  private async findFilesWithLayerReferences(dirPath: string): Promise<any[]> {
    const references: any[] = [];
    
    try {
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(dirPath, file.name);
        
        if (file.isDirectory()) {
          const subRefs = await this.findFilesWithLayerReferences(filePath);
          references.push(...subRefs);
        } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
          const content = fs.readFileSync(filePath, 'utf8');
          const layerRefs = this.extractLayerReferences(content, filePath);
          if (layerRefs.length > 0) {
            references.push({
              path: filePath.replace(this.projectRoot, ''),
              type: this.getFileType(filePath),
              layerReferences: layerRefs,
              updateStrategy: 'manual'
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Error scanning directory ${dirPath}:`, error);
    }

    return references;
  }

  private extractLayerReferences(content: string, filePath: string) {
    const references: any[] = [];
    const lines = content.split('\n');
    
    // Look for layer ID references
    Object.keys(layers).forEach(layerId => {
      lines.forEach((line, index) => {
        if (line.includes(`'${layerId}'`) || line.includes(`"${layerId}"`)) {
          references.push({
            layerId,
            referenceType: 'hardcoded',
            location: {
              line: index + 1,
              context: line.trim()
            }
          });
        }
      });
    });

    return references;
  }

  private getFileType(filePath: string): string {
    if (filePath.includes('/config/')) return 'config';
    if (filePath.includes('/components/')) return 'component';
    if (filePath.includes('/services/')) return 'service';
    return 'utility';
  }

  private getServiceDependencies() {
    return [
      {
        name: 'SHAP Microservice',
        endpoint: process.env.SHAP_SERVICE_URL || 'http://localhost:5000',
        layerDependencies: Object.keys(layers),
        configPath: 'shap-microservice/enhanced_analysis_worker.py'
      },
      {
        name: 'Claude Service',
        layerDependencies: ['applications', 'conversionRate'],
        configPath: 'services/claude-service.ts'
      }
    ];
  }

  private async scanComponentReferences() {
    return [
      {
        name: 'LayerController',
        path: 'components/LayerController/LayerController.tsx',
        layerProps: ['config', 'view'],
        configProps: ['projectLayerConfig']
      },
      {
        name: 'GeospatialChatInterface',
        path: 'components/geospatial-chat-interface.tsx',
        layerProps: ['layers'],
        configProps: ['conceptMapping']
      }
    ];
  }

  // Deploy configuration by writing files
  async deployConfiguration(config: ProjectConfiguration): Promise<DeploymentResult> {
    const filesUpdated: string[] = [];
    const errors: any[] = [];

    try {
      // 1. Update main layer configuration
      await this.updateLayerConfigFile(config, filesUpdated, errors);
      
      // 2. Update concept mappings
      await this.updateConceptMapFile(config, filesUpdated, errors);
      
      // 3. Create backup
      await this.createBackup();

      return {
        success: errors.length === 0,
        filesUpdated,
        errors,
        rollbackAvailable: true,
        deploymentId: `local_${Date.now()}`
      };
    } catch (error) {
      return {
        success: false,
        filesUpdated,
        errors: [{ file: 'deployment', error: String(error), critical: true }],
        rollbackAvailable: true,
        deploymentId: `local_${Date.now()}`
      };
    }
  }

  private async updateLayerConfigFile(config: ProjectConfiguration, filesUpdated: string[], errors: any[]) {
    try {
      const configPath = path.join(this.projectRoot, 'config/layers.ts');
      const backupPath = `${configPath}.backup.${Date.now()}`;
      
      // Create backup
      fs.copyFileSync(configPath, backupPath);
      
      // Generate new configuration
      const newContent = this.generateLayerConfigContent(config);
      
      // Write new file
      fs.writeFileSync(configPath, newContent, 'utf8');
      filesUpdated.push('config/layers.ts');
      
      console.log('✅ Updated layer configuration file');
    } catch (error) {
      errors.push({ file: 'config/layers.ts', error: String(error), critical: true });
    }
  }

  private async updateConceptMapFile(config: ProjectConfiguration, filesUpdated: string[], errors: any[]) {
    try {
      const conceptMapPath = path.join(this.projectRoot, 'config/concept-map.json');
      const conceptMapContent = JSON.stringify(config.conceptMappings, null, 2);
      
      fs.writeFileSync(conceptMapPath, conceptMapContent, 'utf8');
      filesUpdated.push('config/concept-map.json');
      
      console.log('✅ Updated concept map file');
    } catch (error) {
      errors.push({ file: 'config/concept-map.json', error: String(error), critical: false });
    }
  }

  private generateLayerConfigContent(config: ProjectConfiguration): string {
    const timestamp = new Date().toISOString();
    
    const layersArray = Object.values(config.layers).map(layer => 
      `  {
    id: '${layer.id}',
    name: '${layer.name}',
    type: '${layer.type}',
    url: '${layer.url}',
    group: '${layer.group}',
    description: '${layer.description || ''}',
    status: '${layer.status}',
    geographicType: 'postal',
    geographicLevel: 'local',
    fields: ${JSON.stringify(layer.fields, null, 4)},
    metadata: ${JSON.stringify(layer.metadata, null, 4)},
    processing: { strategy: 'traditional' },
    caching: { strategy: 'memory' },
    performance: { timeoutMs: 30000 },
    security: { accessLevels: ['read'] },
    analysis: { availableOperations: ['query'] }
  }`
    ).join(',\n');

    return `// Auto-generated layer configuration
// Generated on: ${timestamp}
// DO NOT EDIT MANUALLY - Use Project Configuration Manager at /admin/project-config

import { LayerConfig, GeographicLevel } from '../types/layers';

export const baseLayerConfigs: LayerConfig[] = [
${layersArray}
];

export const layers: { [key: string]: LayerConfig } = Object.fromEntries(
  baseLayerConfigs.map(config => [config.id, config])
);

export const projectLayerConfig = {
  layers: Object.values(layers).reduce((acc, layer) => {
    acc[layer.id] = layer;
    return acc;
  }, {} as Record<string, LayerConfig>),
  groups: ${JSON.stringify(config.groups, null, 2)},
  defaultVisibility: ${JSON.stringify(config.settings.defaultVisibility, null, 2)},
  defaultCollapsed: ${JSON.stringify(config.settings.defaultCollapsed, null, 2)},
  globalSettings: ${JSON.stringify(config.settings.globalSettings, null, 2)}
};

// Utility functions (preserved from original)
export const validateLayerOperation = (layerId: string, operation: string): boolean => {
  const layer = layers[layerId];
  if (!layer || !layer.analysis?.availableOperations) return false;
  return layer.analysis.availableOperations.includes(operation);
};

export const getLayerConstraints = (layerId: string) => {
  const layer = layers[layerId];
  return {
    geographic: layer?.geographicLevel || 'local',
    dataType: layer?.type || 'unknown'
  };
};

export const canAccessLayer = (layerId: string, accessLevel: string = 'read'): boolean => {
  const layer = layers[layerId];
  if (!layer || !layer.security?.accessLevels) return false;
  return layer.security.accessLevels.includes(accessLevel);
};

export const getLayerMetadata = (layerId: string) => {
  return layers[layerId]?.metadata || null;
};

export const exportLayerConfig = (layerId: string) => {
  return layers[layerId] || null;
};

export const getLayerConfigById = (id: string): LayerConfig | undefined => {
  return layers[id];
};
`;
  }

  private async createBackup() {
    const backupDir = path.join(this.projectRoot, 'backups', `config_${Date.now()}`);
    
    if (!fs.existsSync(path.dirname(backupDir))) {
      fs.mkdirSync(path.dirname(backupDir), { recursive: true });
    }
    fs.mkdirSync(backupDir);

    // Backup key files
    const filesToBackup = [
      'config/layers.ts',
      'config/concept-map.json',
      'lib/concept-mapping.ts'
    ];

    for (const file of filesToBackup) {
      const sourcePath = path.join(this.projectRoot, file);
      if (fs.existsSync(sourcePath)) {
        const destPath = path.join(backupDir, path.basename(file));
        fs.copyFileSync(sourcePath, destPath);
      }
    }

    console.log(`✅ Created backup at: ${backupDir}`);
  }
}

export const localConfigManager = new LocalConfigurationManager(); 