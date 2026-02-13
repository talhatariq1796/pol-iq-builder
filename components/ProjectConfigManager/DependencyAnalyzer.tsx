'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  Network,
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  GitBranch,
  Layers,
  Code,
  Zap,
  Shield,
  Target,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Download,
  Upload,
  Eye,
  EyeOff,
  Filter,
  RefreshCw,
  Database,
  Component,
  Settings,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Workflow,
  Link,
  Unlink,
  Plus,
  Minus,
  Edit,
  Trash2,
  Save,
  AlertCircle,
  Info,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

import { 
  ProjectConfiguration, 
  ConfigurationChange, 
  ValidationError,
  FileDependency,
  ServiceDependency,
  ComponentDependency,
  LayerReference,
  EnhancedLayerConfig
} from '@/types/project-config';

interface DependencyAnalyzerProps {
  config: ProjectConfiguration;
  onChange: (config: ProjectConfiguration, change: ConfigurationChange) => void;
  validationErrors: ValidationError[];
  impactAnalysis?: ImpactAnalysis | null;
}

interface DependencyNode {
  id: string;
  name: string;
  type: 'layer' | 'component' | 'service' | 'file' | 'group';
  path?: string;
  dependencies: string[];
  dependents: string[];
  status: 'active' | 'inactive' | 'deprecated' | 'error';
  lastModified?: string;
  size?: number;
  complexity: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  clusters: DependencyCluster[];
}

interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  type: 'import' | 'hardcoded' | 'dynamic' | 'config';
  strength: number;
  isOptional: boolean;
  lastUsed?: string;
}

interface DependencyCluster {
  id: string;
  name: string;
  nodes: string[];
  type: 'circular' | 'isolated' | 'hub' | 'chain';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface ImpactAnalysis {
  affectedFiles: string[];
  affectedComponents: string[];
  affectedServices: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedDowntime: number;
  rollbackComplexity: 'simple' | 'moderate' | 'complex';
  recommendations: string[];
  breakingChanges: BreakingChange[];
}

interface BreakingChange {
  type: 'layer_removal' | 'layer_modification' | 'service_change' | 'config_change';
  description: string;
  affectedFiles: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoFixAvailable: boolean;
  recommendation: string;
}

interface OptimizationSuggestion {
  id: string;
  type: 'unused_layer' | 'circular_dependency' | 'performance' | 'bundle_size' | 'lazy_loading';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  savings: {
    bundleSize?: number;
    loadTime?: number;
    memoryUsage?: number;
  };
  implementation: string[];
}

export const DependencyAnalyzer: React.FC<DependencyAnalyzerProps> = ({
  config,
  onChange,
  validationErrors
}) => {
  const [dependencyGraph, setDependencyGraph] = useState<DependencyGraph>({ nodes: [], edges: [], clusters: [] });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('graph');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showOptionalDeps, setShowOptionalDeps] = useState(true);
  const [selectedChanges, setSelectedChanges] = useState<ConfigurationChange[]>([]);

  // Get all layers and groups
  const layers = useMemo(() => Object.values(config.layers), [config.layers]);
  const groups = useMemo(() => config.groups || [], [config.groups]);

  // Calculate node position for visualization
  const getNodePosition = (node: DependencyNode, index: number, totalNodes: number) => {
    const width = 600;
    const height = 350;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Different layouts based on node type
    if (node.type === 'layer') {
      const layerNodes = dependencyGraph.nodes.filter(n => n.type === 'layer');
      const layerIndex = layerNodes.findIndex(n => n.id === node.id);
      const angle = (layerIndex / Math.max(layerNodes.length, 1)) * 2 * Math.PI;
      const radius = 120;
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    } else if (node.type === 'group') {
      const groupNodes = dependencyGraph.nodes.filter(n => n.type === 'group');
      const groupIndex = groupNodes.findIndex(n => n.id === node.id);
      const angle = (groupIndex / Math.max(groupNodes.length, 1)) * 2 * Math.PI;
      const radius = 80;
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    } else if (node.type === 'file') {
      const fileNodes = dependencyGraph.nodes.filter(n => n.type === 'file');
      const fileIndex = fileNodes.findIndex(n => n.id === node.id);
      return {
        x: 50 + (fileIndex * 100) % (width - 100),
        y: 50 + Math.floor((fileIndex * 100) / (width - 100)) * 60
      };
    } else {
      // Service or other types - place in outer ring
      const otherNodes = dependencyGraph.nodes.filter(n => !['layer', 'group', 'file'].includes(n.type));
      const otherIndex = otherNodes.findIndex(n => n.id === node.id);
      const angle = (otherIndex / Math.max(otherNodes.length, 1)) * 2 * Math.PI;
      const radius = 180;
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    }
  };

  // Filter nodes based on search and filters
  const filteredNodes = useMemo(() => {
    return dependencyGraph.nodes.filter(node => {
      const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (node.path && node.path.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesType = filterType === 'all' || node.type === filterType;
      const matchesRisk = filterRisk === 'all' || node.riskLevel === filterRisk;
      
      return matchesSearch && matchesType && matchesRisk;
    });
  }, [dependencyGraph.nodes, searchTerm, filterType, filterRisk]);

  // Analyze dependencies
  const analyzeDependencies = useCallback(async () => {
    setIsAnalyzing(true);
    
    try {
      const nodes: DependencyNode[] = [];
      const edges: DependencyEdge[] = [];
      const clusters: DependencyCluster[] = [];

      // Create nodes for layers
      layers.forEach(layer => {
        nodes.push({
          id: layer.id,
          name: layer.name,
          type: 'layer',
          dependencies: [],
          dependents: [],
          status: layer.status || 'active',
          complexity: Math.random() * 10, // Mock complexity calculation
          riskLevel: layer.status === 'deprecated' ? 'high' : 'low'
        });
      });

      // Create nodes for groups
      groups.forEach(group => {
        nodes.push({
          id: group.id,
          name: group.name,
          type: 'group',
          dependencies: group.layers,
          dependents: [],
          status: 'active',
          complexity: group.layers.length,
          riskLevel: group.layers.length > 20 ? 'high' : 'low'
        });

        // Create edges from group to layers
        group.layers.forEach(layerId => {
          edges.push({
            id: `${group.id}-${layerId}`,
            source: group.id,
            target: layerId,
            type: 'config',
            strength: 1.0,
            isOptional: false
          });
        });
      });

      // Mock file dependencies
      const mockFiles = [
        { path: 'lib/concept-mapping.ts', layers: ['population', 'income'] },
        { path: 'services/claude-service.ts', layers: ['housing', 'transportation'] },
        { path: 'components/LayerController.tsx', layers: ['*'] },
        { path: 'config/layers.ts', layers: ['*'] }
      ];

      mockFiles.forEach((file, index) => {
        const fileId = `file_${index}`;
        nodes.push({
          id: fileId,
          name: file.path.split('/').pop() || file.path,
          type: 'file',
          path: file.path,
          dependencies: file.layers[0] === '*' ? layers.map(l => l.id) : file.layers,
          dependents: [],
          status: 'active',
          complexity: file.layers.length,
          riskLevel: file.layers[0] === '*' ? 'high' : 'medium'
        });

        // Create edges from file to layers
        const layerDeps = file.layers[0] === '*' ? layers.map(l => l.id) : file.layers;
        layerDeps.forEach(layerId => {
          edges.push({
            id: `${fileId}-${layerId}`,
            source: fileId,
            target: layerId,
            type: 'import',
            strength: 0.8,
            isOptional: false
          });
        });
      });

      // Detect circular dependencies
      const circularDeps = detectCircularDependencies(nodes, edges);
      if (circularDeps.length > 0) {
        clusters.push({
          id: 'circular_1',
          name: 'Circular Dependencies',
          nodes: circularDeps,
          type: 'circular',
          riskLevel: 'critical',
          description: 'Components with circular dependency relationships'
        });
      }

      // Update dependents
      edges.forEach(edge => {
        const targetNode = nodes.find(n => n.id === edge.target);
        if (targetNode && !targetNode.dependents.includes(edge.source)) {
          targetNode.dependents.push(edge.source);
        }
      });

      setDependencyGraph({ nodes, edges, clusters });
      
      // Generate optimization suggestions
      generateOptimizationSuggestions(nodes, edges);
      
    } catch (error) {
      console.error('Error analyzing dependencies:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [layers, groups]);

  // Detect circular dependencies
  const detectCircularDependencies = (nodes: DependencyNode[], edges: DependencyEdge[]): string[] => {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularNodes = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        circularNodes.add(nodeId);
        return true;
      }
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const dependencies = edges.filter(e => e.source === nodeId).map(e => e.target);
      for (const depId of dependencies) {
        if (dfs(depId)) {
          circularNodes.add(nodeId);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    });

    return Array.from(circularNodes);
  };

  // Generate optimization suggestions
  const generateOptimizationSuggestions = useCallback((nodes: DependencyNode[], edges: DependencyEdge[]) => {
    const suggestions: OptimizationSuggestion[] = [];

    // Find unused layers
    const unusedLayers = nodes.filter(n => n.type === 'layer' && n.dependents.length === 0);
    if (unusedLayers.length > 0) {
      suggestions.push({
        id: 'unused_layers',
        type: 'unused_layer',
        title: `Remove ${unusedLayers.length} Unused Layers`,
        description: `Found ${unusedLayers.length} layers that are not referenced by any components or groups`,
        impact: 'medium',
        effort: 'low',
        savings: {
          bundleSize: unusedLayers.length * 15, // KB
          loadTime: unusedLayers.length * 50 // ms
        },
        implementation: [
          'Review unused layers for actual usage',
          'Remove layer configurations from config/layers.ts',
          'Clean up any remaining references'
        ]
      });
    }

    // Find high-complexity components
    const complexComponents = nodes.filter(n => n.complexity > 8);
    if (complexComponents.length > 0) {
      suggestions.push({
        id: 'complex_components',
        type: 'performance',
        title: 'Optimize High-Complexity Components',
        description: `${complexComponents.length} components have high complexity and may benefit from optimization`,
        impact: 'high',
        effort: 'high',
        savings: {
          loadTime: complexComponents.length * 200,
          memoryUsage: complexComponents.length * 50
        },
        implementation: [
          'Break down complex components into smaller pieces',
          'Implement lazy loading for heavy components',
          'Consider code splitting strategies'
        ]
      });
    }

    // Bundle size optimization
    const totalLayers = nodes.filter(n => n.type === 'layer').length;
    if (totalLayers > 50) {
      suggestions.push({
        id: 'bundle_optimization',
        type: 'bundle_size',
        title: 'Implement Layer Lazy Loading',
        description: 'Large number of layers detected. Consider implementing lazy loading to improve initial load time',
        impact: 'high',
        effort: 'medium',
        savings: {
          bundleSize: totalLayers * 8,
          loadTime: 1500
        },
        implementation: [
          'Implement dynamic imports for layer configurations',
          'Add lazy loading for non-critical layers',
          'Consider layer prioritization system'
        ]
      });
    }

    setOptimizationSuggestions(suggestions);
  }, []);

  // Perform impact analysis
  const performImpactAnalysis = useCallback((changes: ConfigurationChange[]) => {
    const affectedFiles = new Set<string>();
    const affectedComponents = new Set<string>();
    const affectedServices = new Set<string>();
    const breakingChanges: BreakingChange[] = [];

    changes.forEach(change => {
      if (change.target === 'layer') {
        // Find all files that depend on this layer
        const layerId = change.path.split('.')[1];
        const dependentNodes = dependencyGraph.nodes.filter(n => 
          n.dependencies.includes(layerId) || n.dependents.includes(layerId)
        );

        dependentNodes.forEach(node => {
          if (node.type === 'file' && node.path) {
            affectedFiles.add(node.path);
          } else if (node.type === 'component') {
            affectedComponents.add(node.name);
          } else if (node.type === 'service') {
            affectedServices.add(node.name);
          }
        });

        if (change.type === 'remove') {
          breakingChanges.push({
            type: 'layer_removal',
            description: `Removing layer ${layerId} will break ${dependentNodes.length} components`,
            affectedFiles: dependentNodes.filter(n => n.path).map(n => n.path!),
            severity: dependentNodes.length > 5 ? 'critical' : 'medium',
            autoFixAvailable: false,
            recommendation: 'Update all dependent components before removing layer'
          });
        }
      }
    });

    const analysis: ImpactAnalysis = {
      affectedFiles: Array.from(affectedFiles),
      affectedComponents: Array.from(affectedComponents),
      affectedServices: Array.from(affectedServices),
      riskLevel: breakingChanges.some(c => c.severity === 'critical') ? 'critical' : 
                breakingChanges.some(c => c.severity === 'high') ? 'high' : 'medium',
      estimatedDowntime: breakingChanges.length * 5, // minutes
      rollbackComplexity: breakingChanges.length > 3 ? 'complex' : 'simple',
      recommendations: [
        'Create backup before deployment',
        'Test changes in staging environment',
        'Update dependent components gradually'
      ],
      breakingChanges
    };

    setImpactAnalysis(analysis);
    setSelectedChanges(changes);
  }, [dependencyGraph]);

  // Initialize dependency analysis
  useEffect(() => {
    if (layers.length > 0) {
      analyzeDependencies();
    }
  }, [layers, groups, analyzeDependencies]);

  const renderDependencyGraph = () => (
    <div className="space-y-6">
      {/* Graph Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Dependency Graph
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={analyzeDependencies}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Refresh Analysis
              </Button>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={showOptionalDeps}
                  onCheckedChange={setShowOptionalDeps}
                />
                <Label>Show Optional</Label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Graph Visualization */}
            <div className="lg:col-span-3">
              <div className="border rounded-lg bg-white min-h-96 relative overflow-hidden">
                {dependencyGraph.nodes.length > 0 ? (
                  <svg width="100%" height="400" className="absolute inset-0">
                    {/* Background Grid */}
                    <defs>
                      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    
                    {/* Render Edges */}
                    {dependencyGraph.edges
                      .filter(edge => showOptionalDeps || !edge.isOptional)
                      .map((edge, index) => {
                        const sourceNode = dependencyGraph.nodes.find(n => n.id === edge.source);
                        const targetNode = dependencyGraph.nodes.find(n => n.id === edge.target);
                        if (!sourceNode || !targetNode) return null;
                        
                        // Calculate positions based on node type and index
                        const sourcePos = getNodePosition(sourceNode, index, dependencyGraph.nodes.length);
                        const targetPos = getNodePosition(targetNode, index, dependencyGraph.nodes.length);
                        
                        return (
                          <g key={edge.id}>
                            <line
                              x1={sourcePos.x}
                              y1={sourcePos.y}
                              x2={targetPos.x}
                              y2={targetPos.y}
                              stroke={edge.type === 'import' ? '#3b82f6' : edge.type === 'config' ? '#10b981' : '#6b7280'}
                              strokeWidth={edge.strength * 3}
                              strokeOpacity={edge.isOptional ? 0.4 : 0.8}
                              strokeDasharray={edge.isOptional ? "5,5" : "none"}
                            />
                            {/* Arrow marker */}
                            <polygon
                              points={`${targetPos.x-5},${targetPos.y-3} ${targetPos.x},${targetPos.y} ${targetPos.x-5},${targetPos.y+3}`}
                              fill={edge.type === 'import' ? '#3b82f6' : edge.type === 'config' ? '#10b981' : '#6b7280'}
                              opacity={edge.isOptional ? 0.4 : 0.8}
                            />
                          </g>
                        );
                      })}
                    
                    {/* Render Nodes */}
                    {dependencyGraph.nodes.map((node, index) => {
                      const pos = getNodePosition(node, index, dependencyGraph.nodes.length);
                      const nodeColor = 
                        node.type === 'layer' ? '#3b82f6' :
                        node.type === 'group' ? '#10b981' :
                        node.type === 'file' ? '#f59e0b' :
                        node.type === 'service' ? '#8b5cf6' : '#6b7280';
                      
                      const isSelected = selectedNode === node.id;
                      const radius = isSelected ? 12 : 8;
                      
                      return (
                        <g key={node.id}>
                          {/* Node circle */}
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={radius}
                            fill={nodeColor}
                            stroke={isSelected ? '#1f2937' : 'white'}
                            strokeWidth={isSelected ? 3 : 2}
                            className="cursor-pointer hover:opacity-80 transition-all"
                            onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                          />
                          
                          {/* Risk indicator */}
                          {node.riskLevel === 'high' || node.riskLevel === 'critical' ? (
                            <circle
                              cx={pos.x + 6}
                              cy={pos.y - 6}
                              r={3}
                              fill={node.riskLevel === 'critical' ? '#ef4444' : '#f59e0b'}
                            />
                          ) : null}
                          
                          {/* Node label */}
                          <text
                            x={pos.x}
                            y={pos.y + radius + 12}
                            textAnchor="middle"
                            className="text-xs fill-gray-700"
                            style={{ fontSize: '10px' }}
                          >
                            {node.name.length > 12 ? `${node.name.slice(0, 12)}...` : node.name}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                ) : (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <Network className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-600 mb-2">No Dependencies Found</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Click &quot;Refresh Analysis&quot; to analyze current configuration
                      </p>
                      <Button onClick={analyzeDependencies}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Start Analysis
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm border rounded-lg p-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Layers ({dependencyGraph.nodes.filter(n => n.type === 'layer').length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Groups ({dependencyGraph.nodes.filter(n => n.type === 'group').length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span>Files ({dependencyGraph.nodes.filter(n => n.type === 'file').length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <span>Services ({dependencyGraph.nodes.filter(n => n.type === 'service').length})</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t text-gray-500">
                    {dependencyGraph.edges.length} connections
                  </div>
                </div>
              </div>
            </div>

            {/* Node Details */}
            <div className="space-y-4">
              <h4 className="font-medium">Node Details</h4>
              {selectedNode ? (
                <div className="space-y-3">
                  {(() => {
                    const node = dependencyGraph.nodes.find(n => n.id === selectedNode);
                    if (!node) return null;
                    
                    return (
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          {node.type === 'layer' && <Layers className="h-4 w-4 text-blue-500" />}
                          {node.type === 'group' && <Database className="h-4 w-4 text-green-500" />}
                          {node.type === 'file' && <FileText className="h-4 w-4 text-orange-500" />}
                          <span className="font-medium">{node.name}</span>
                          <Badge variant={node.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                            {node.riskLevel}
                          </Badge>
                        </div>
                        
                        {node.path && (
                          <p className="text-xs text-gray-500 mb-2">{node.path}</p>
                        )}
                        
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-500">Dependencies:</span>
                            <span className="ml-1 font-medium">{node.dependencies.length}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Dependents:</span>
                            <span className="ml-1 font-medium">{node.dependents.length}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Complexity:</span>
                            <Progress value={node.complexity * 10} className="w-full h-2 mt-1" />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Target className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm">Select a node to view details</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dependency Clusters */}
      {dependencyGraph.clusters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Dependency Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dependencyGraph.clusters.map(cluster => (
                <div key={cluster.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      cluster.riskLevel === 'critical' ? 'bg-red-500' :
                      cluster.riskLevel === 'high' ? 'bg-orange-500' :
                      cluster.riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div>
                      <div className="font-medium">{cluster.name}</div>
                      <div className="text-sm text-gray-500">{cluster.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={cluster.riskLevel === 'critical' ? 'destructive' : 'secondary'}>
                      {cluster.nodes.length} nodes
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderImpactAnalysis = () => (
    <div className="space-y-6">
      {/* Impact Analysis Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              Analyze the impact of configuration changes before deployment to prevent breaking changes 
              and understand system-wide effects.
            </p>
            
            <Button
              onClick={() => {
                // Mock configuration changes for demo
                const mockChanges: ConfigurationChange[] = [
                  {
                    type: 'remove',
                    target: 'layer',
                    path: 'layers.population_layer',
                    oldValue: { id: 'population_layer', name: 'Population Data' },
                    newValue: null,
                    reason: 'Layer no longer needed'
                  }
                ];
                performImpactAnalysis(mockChanges);
              }}
            >
              <Target className="h-4 w-4 mr-1" />
              Analyze Sample Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Impact Results */}
      {impactAnalysis && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Impact Analysis Results</CardTitle>
              <Badge variant={
                impactAnalysis.riskLevel === 'critical' ? 'destructive' :
                impactAnalysis.riskLevel === 'high' ? 'destructive' :
                impactAnalysis.riskLevel === 'medium' ? 'secondary' : 'default'
              }>
                {impactAnalysis.riskLevel.toUpperCase()} RISK
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Affected Files */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Affected Files ({impactAnalysis.affectedFiles.length})
                </h4>
                <div className="space-y-2">
                  {impactAnalysis.affectedFiles.slice(0, 5).map(file => (
                    <div key={file} className="text-sm p-2 bg-gray-50 rounded">
                      {file}
                    </div>
                  ))}
                  {impactAnalysis.affectedFiles.length > 5 && (
                    <div className="text-sm text-gray-500">
                      +{impactAnalysis.affectedFiles.length - 5} more files
                    </div>
                  )}
                </div>
              </div>

              {/* Affected Components */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Component className="h-4 w-4" />
                  Affected Components ({impactAnalysis.affectedComponents.length})
                </h4>
                <div className="space-y-2">
                  {impactAnalysis.affectedComponents.slice(0, 5).map(component => (
                    <div key={component} className="text-sm p-2 bg-gray-50 rounded">
                      {component}
                    </div>
                  ))}
                  {impactAnalysis.affectedComponents.length > 5 && (
                    <div className="text-sm text-gray-500">
                      +{impactAnalysis.affectedComponents.length - 5} more components
                    </div>
                  )}
                </div>
              </div>

              {/* Impact Metrics */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Impact Metrics
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-500">Estimated Downtime</div>
                    <div className="font-medium">{impactAnalysis.estimatedDowntime} minutes</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Rollback Complexity</div>
                    <div className="font-medium capitalize">{impactAnalysis.rollbackComplexity}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Breaking Changes</div>
                    <div className="font-medium">{impactAnalysis.breakingChanges.length}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Breaking Changes */}
            {impactAnalysis.breakingChanges.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Breaking Changes
                </h4>
                <div className="space-y-3">
                  {impactAnalysis.breakingChanges.map((change, index) => (
                    <Alert key={index} variant={change.severity === 'critical' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <div className="font-medium">{change.description}</div>
                          <div className="text-sm">
                            <strong>Recommendation:</strong> {change.recommendation}
                          </div>
                          {change.autoFixAvailable && (
                            <Badge variant="secondary" className="text-xs">
                              Auto-fix available
                            </Badge>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="mt-6">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Recommendations
              </h4>
              <div className="space-y-2">
                {impactAnalysis.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderOptimizationSuggestions = () => (
    <div className="space-y-6">
      {/* Optimization Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Performance Optimization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            AI-powered analysis of your project structure to identify optimization opportunities 
            and performance improvements.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{optimizationSuggestions.length}</div>
              <div className="text-sm text-gray-500">Suggestions Available</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {optimizationSuggestions.reduce((sum, s) => sum + (s.savings.bundleSize || 0), 0)}KB
              </div>
              <div className="text-sm text-gray-500">Potential Bundle Savings</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {optimizationSuggestions.reduce((sum, s) => sum + (s.savings.loadTime || 0), 0)}ms
              </div>
              <div className="text-sm text-gray-500">Load Time Savings</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimization Suggestions */}
      <div className="space-y-4">
        {optimizationSuggestions.map(suggestion => (
          <Card key={suggestion.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{suggestion.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {suggestion.type.replace('_', ' ')}
                    </Badge>
                    <Badge variant={
                      suggestion.impact === 'high' ? 'default' :
                      suggestion.impact === 'medium' ? 'secondary' : 'outline'
                    } className="text-xs">
                      {suggestion.impact} impact
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                    {suggestion.savings.bundleSize && (
                      <div>
                        <div className="text-gray-500">Bundle Size</div>
                        <div className="font-medium">-{suggestion.savings.bundleSize}KB</div>
                      </div>
                    )}
                    {suggestion.savings.loadTime && (
                      <div>
                        <div className="text-gray-500">Load Time</div>
                        <div className="font-medium">-{suggestion.savings.loadTime}ms</div>
                      </div>
                    )}
                    {suggestion.savings.memoryUsage && (
                      <div>
                        <div className="text-gray-500">Memory</div>
                        <div className="font-medium">-{suggestion.savings.memoryUsage}MB</div>
                      </div>
                    )}
                    <div>
                      <div className="text-gray-500">Effort</div>
                      <div className="font-medium capitalize">{suggestion.effort}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Implementation Steps:</div>
                    {suggestion.implementation.map((step, index) => (
                      <div key={index} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-gray-400">{index + 1}.</span>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button size="sm">
                    <Zap className="h-4 w-4 mr-1" />
                    Apply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {optimizationSuggestions.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No Optimization Needed</h3>
            <p className="text-sm text-gray-500">
              Your project structure is well-optimized. Check back after making changes.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderFileAnalysis = () => {
    const fileNodes = dependencyGraph.nodes.filter(n => n.type === 'file');
    
    return (
      <div className="space-y-6">
        {/* File Analysis Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              File Dependency Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{fileNodes.length}</div>
                <div className="text-sm text-gray-500">Files Analyzed</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {fileNodes.filter(n => n.riskLevel === 'high').length}
                </div>
                <div className="text-sm text-gray-500">High Risk Files</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {dependencyGraph.edges.filter(e => e.type === 'import').length}
                </div>
                <div className="text-sm text-gray-500">Import Dependencies</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {dependencyGraph.edges.filter(e => e.type === 'hardcoded').length}
                </div>
                <div className="text-sm text-gray-500">Hardcoded References</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File List */}
        <Card>
          <CardHeader>
            <CardTitle>File Dependencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fileNodes.map(file => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-orange-500" />
                    <div>
                      <div className="font-medium">{file.name}</div>
                      <div className="text-sm text-gray-500">{file.path}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <span className="text-gray-500">Dependencies:</span>
                      <span className="ml-1 font-medium">{file.dependencies.length}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Risk:</span>
                      <Badge variant={file.riskLevel === 'high' ? 'destructive' : 'secondary'} className="ml-1">
                        {file.riskLevel}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedNode(file.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="h-full p-6">
      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search dependencies..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="layer">Layers</SelectItem>
                <SelectItem value="group">Groups</SelectItem>
                <SelectItem value="file">Files</SelectItem>
                <SelectItem value="component">Components</SelectItem>
                <SelectItem value="service">Services</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="critical">Critical Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="graph">Dependency Graph</TabsTrigger>
          <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="files">File Analysis</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-auto">
          <TabsContent value="graph" className="h-full">
            {renderDependencyGraph()}
          </TabsContent>
          
          <TabsContent value="impact" className="h-full">
            {renderImpactAnalysis()}
          </TabsContent>
          
          <TabsContent value="optimization" className="h-full">
            {renderOptimizationSuggestions()}
          </TabsContent>
          
          <TabsContent value="files" className="h-full">
            {renderFileAnalysis()}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}; 