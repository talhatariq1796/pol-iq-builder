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
import { Progress } from '@/components/ui/progress';
import { 
  Brain,
  Network,
  Zap,
  Target,
  Link,
  Unlink,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Search,
  Filter,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Save,
  Download,
  Upload,
  Lightbulb,
  MessageSquare,
  Database,
  Layers,
  Users,
  Settings,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Info,
  Wand2,
  GitBranch,
  Workflow,
  Map
} from 'lucide-react';

import { 
  ProjectConfiguration, 
  ConfigurationChange, 
  ValidationError,
  LayerGroupConfiguration,
  EnhancedLayerConfig,
  ConceptMapping,
  AIConceptDefinition,
  ConceptLayerRelationship
} from '@/types/project-config';

interface ConceptMappingEditorProps {
  config: ProjectConfiguration;
  onChange: (config: ProjectConfiguration, change: ConfigurationChange) => void;
  validationErrors: ValidationError[];
}

interface ConceptNode {
  id: string;
  name: string;
  description: string;
  category: 'demographic' | 'economic' | 'environmental' | 'infrastructure' | 'social' | 'custom';
  confidence: number;
  keywords: string[];
  synonyms: string[];
  relatedConcepts: string[];
  mappedGroups: string[];
  mappedLayers: string[];
  queryPatterns: string[];
  examples: string[];
  position: { x: number; y: number };
}

interface MappingConnection {
  id: string;
  conceptId: string;
  targetId: string;
  targetType: 'group' | 'layer';
  strength: number;
  confidence: number;
  reasoning: string;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

interface ConceptSuggestion {
  id: string;
  conceptName: string;
  description: string;
  suggestedMappings: {
    groupId: string;
    groupName: string;
    confidence: number;
    reasoning: string;
  }[];
  keywords: string[];
  category: string;
  priority: number;
}

export const ConceptMappingEditor: React.FC<ConceptMappingEditorProps> = ({
  config,
  onChange,
  validationErrors
}) => {
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<ConceptNode[]>([]);
  const [connections, setConnections] = useState<MappingConnection[]>([]);
  const [suggestions, setSuggestions] = useState<ConceptSuggestion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('visual');
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [showInactiveMappings, setShowInactiveMappings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedConcept, setDraggedConcept] = useState<string | null>(null);

  // Get all layers and groups
  const layers = useMemo(() => Object.values(config.layers), [config.layers]);
  const groups = useMemo(() => config.groups || [], [config.groups]);

  // Filter concepts based on search and category
  const filteredConcepts = useMemo(() => {
    return concepts.filter(concept => {
      const matchesSearch = concept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          concept.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          concept.keywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory === 'all' || concept.category === filterCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [concepts, searchTerm, filterCategory]);

  // Get active connections
  const activeConnections = useMemo(() => {
    return connections.filter(conn => conn.isActive || showInactiveMappings);
  }, [connections, showInactiveMappings]);

  // Initialize default concepts
  useEffect(() => {
    if (concepts.length === 0) {
      const defaultConcepts: ConceptNode[] = [
        {
          id: 'concept_population',
          name: 'Population',
          description: 'Demographic data including population counts, density, and distribution',
          category: 'demographic',
          confidence: 0.95,
          keywords: ['population', 'demographic', 'census', 'residents', 'people'],
          synonyms: ['inhabitants', 'citizens', 'residents'],
          relatedConcepts: ['concept_housing', 'concept_income'],
          mappedGroups: [],
          mappedLayers: [],
          queryPatterns: ['show population data', 'population in area', 'demographic information'],
          examples: ['Total population by census tract', 'Population density analysis'],
          position: { x: 100, y: 100 }
        },
        {
          id: 'concept_income',
          name: 'Income & Economics',
          description: 'Economic indicators including income, employment, and financial data',
          category: 'economic',
          confidence: 0.92,
          keywords: ['income', 'salary', 'economic', 'employment', 'financial'],
          synonyms: ['earnings', 'wages', 'revenue'],
          relatedConcepts: ['concept_population', 'concept_housing'],
          mappedGroups: [],
          mappedLayers: [],
          queryPatterns: ['income levels', 'economic data', 'employment statistics'],
          examples: ['Median household income', 'Employment rate by industry'],
          position: { x: 300, y: 100 }
        },
        {
          id: 'concept_housing',
          name: 'Housing & Development',
          description: 'Housing stock, property values, and development patterns',
          category: 'infrastructure',
          confidence: 0.88,
          keywords: ['housing', 'property', 'development', 'residential', 'building'],
          synonyms: ['homes', 'dwellings', 'real estate'],
          relatedConcepts: ['concept_population', 'concept_income'],
          mappedGroups: [],
          mappedLayers: [],
          queryPatterns: ['housing data', 'property values', 'residential development'],
          examples: ['Housing units by type', 'Property value trends'],
          position: { x: 200, y: 250 }
        },
        {
          id: 'concept_transportation',
          name: 'Transportation',
          description: 'Transportation networks, traffic, and mobility infrastructure',
          category: 'infrastructure',
          confidence: 0.90,
          keywords: ['transportation', 'traffic', 'roads', 'transit', 'mobility'],
          synonyms: ['transport', 'travel', 'commute'],
          relatedConcepts: ['concept_infrastructure'],
          mappedGroups: [],
          mappedLayers: [],
          queryPatterns: ['transportation data', 'traffic patterns', 'transit options'],
          examples: ['Road network analysis', 'Public transit accessibility'],
          position: { x: 400, y: 200 }
        },
        {
          id: 'concept_environment',
          name: 'Environment',
          description: 'Environmental factors including air quality, green spaces, and natural features',
          category: 'environmental',
          confidence: 0.87,
          keywords: ['environment', 'green', 'parks', 'air quality', 'nature'],
          synonyms: ['ecology', 'natural', 'conservation'],
          relatedConcepts: [],
          mappedGroups: [],
          mappedLayers: [],
          queryPatterns: ['environmental data', 'green spaces', 'air quality'],
          examples: ['Park accessibility', 'Air quality monitoring'],
          position: { x: 150, y: 400 }
        }
      ];
      
      setConcepts(defaultConcepts);
    }
  }, [concepts.length]);

  // Generate concept mapping suggestions
  const generateMappingSuggestions = useCallback(async () => {
    setIsGeneratingSuggestions(true);
    
    try {
      const newSuggestions: ConceptSuggestion[] = [];
      
      // Analyze groups for concept mapping opportunities
      groups.forEach(group => {
        concepts.forEach(concept => {
          // Check if group name/description matches concept keywords
          const groupText = `${group.name} ${group.description || ''}`.toLowerCase();
          const matchingKeywords = concept.keywords.filter(keyword => 
            groupText.includes(keyword.toLowerCase())
          );
          
          if (matchingKeywords.length > 0) {
            const confidence = Math.min(0.95, (matchingKeywords.length / concept.keywords.length) * 0.8 + 0.2);
            
            // Check if this mapping already exists
            const existingConnection = connections.find(conn => 
              conn.conceptId === concept.id && conn.targetId === group.id
            );
            
            if (!existingConnection) {
              let existingSuggestion = newSuggestions.find(s => s.conceptName === concept.name);
              
              if (!existingSuggestion) {
                existingSuggestion = {
                  id: `suggestion_${concept.id}`,
                  conceptName: concept.name,
                  description: concept.description,
                  suggestedMappings: [],
                  keywords: concept.keywords,
                  category: concept.category,
                  priority: confidence
                };
                newSuggestions.push(existingSuggestion);
              }
              
              existingSuggestion.suggestedMappings.push({
                groupId: group.id,
                groupName: group.name,
                confidence,
                reasoning: `Group contains keywords: ${matchingKeywords.join(', ')}`
              });
            }
          }
        });
      });
      
      // Sort suggestions by priority
      newSuggestions.sort((a, b) => b.priority - a.priority);
      
      setSuggestions(newSuggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, [groups, concepts, connections]);

  // Create concept mapping
  const createMapping = useCallback((conceptId: string, targetId: string, targetType: 'group' | 'layer', strength = 0.8) => {
    const newConnection: MappingConnection = {
      id: `mapping_${Date.now()}`,
      conceptId,
      targetId,
      targetType,
      strength,
      confidence: 0.85,
      reasoning: 'Manual mapping created by user',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    setConnections((prev: MappingConnection[]) => [...prev, newConnection]);
    
    // Update concept mappings
    setConcepts((prev: ConceptNode[]) => prev.map(concept => {
      if (concept.id === conceptId) {
        const updatedConcept = { ...concept };
        if (targetType === 'group') {
          updatedConcept.mappedGroups = [...updatedConcept.mappedGroups, targetId];
        } else {
          updatedConcept.mappedLayers = [...updatedConcept.mappedLayers, targetId];
        }
        return updatedConcept;
      }
      return concept;
    }));
    
    // Update project configuration
    const updatedMappings = {
      ...config.conceptMappings,
      connections: [
        ...(config.conceptMappings?.connections || []),
        newConnection
      ]
    };
    
    const newConfig = { ...config, conceptMappings: updatedMappings };
    onChange(newConfig, {
      type: 'add',
      target: 'conceptMapping',
      path: `conceptMappings.${newConnection.id}`,
      oldValue: null,
      newValue: newConnection
    });
  }, [config, onChange]);

  // Remove concept mapping
  const removeMapping = useCallback((connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;
    
    setConnections((prev: MappingConnection[]) => prev.filter(c => c.id !== connectionId));
    
    // Update concept mappings
    setConcepts((prev: ConceptNode[]) => prev.map(concept => {
      if (concept.id === connection.conceptId) {
        const updatedConcept = { ...concept };
        if (connection.targetType === 'group') {
          updatedConcept.mappedGroups = updatedConcept.mappedGroups.filter(id => id !== connection.targetId);
        } else {
          updatedConcept.mappedLayers = updatedConcept.mappedLayers.filter(id => id !== connection.targetId);
        }
        return updatedConcept;
      }
      return concept;
    }));
    
    // Update project configuration
    const updatedMappings = {
      ...config.conceptMappings,
      connections: (config.conceptMappings?.connections || []).filter(c => c.id !== connectionId)
    };
    
    const newConfig = { ...config, conceptMappings: updatedMappings };
    onChange(newConfig, {
      type: 'remove',
      target: 'conceptMapping',
      path: `conceptMappings.${connectionId}`,
      oldValue: connection,
      newValue: null
    });
  }, [connections, config, onChange]);

  // Apply suggestion
  const applySuggestion = useCallback((suggestion: ConceptSuggestion) => {
    const concept = concepts.find(c => c.name === suggestion.conceptName);
    if (!concept) return;
    
    suggestion.suggestedMappings.forEach(mapping => {
      createMapping(concept.id, mapping.groupId, 'group', mapping.confidence);
    });
    
    // Remove applied suggestion
    setSuggestions((prev: ConceptSuggestion[]) => prev.filter(s => s.id !== suggestion.id));
  }, [concepts, createMapping]);

  // Create new concept
  const createConcept = useCallback((name: string, description: string, category: ConceptNode['category']) => {
    const newConcept: ConceptNode = {
      id: `concept_${Date.now()}`,
      name,
      description,
      category,
      confidence: 0.75,
      keywords: [name.toLowerCase()],
      synonyms: [],
      relatedConcepts: [],
      mappedGroups: [],
      mappedLayers: [],
      queryPatterns: [],
      examples: [],
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 }
    };
    
    setConcepts((prev: ConceptNode[]) => [...prev, newConcept]);
    setSelectedConceptId(newConcept.id);
  }, []);

  // Update concept
  const updateConcept = useCallback((conceptId: string, updates: Partial<ConceptNode>) => {
    setConcepts((prev: ConceptNode[]) => prev.map(concept => 
      concept.id === conceptId ? { ...concept, ...updates } : concept
    ));
  }, []);

  // Delete concept
  const deleteConcept = useCallback((conceptId: string) => {
    if (!confirm('Are you sure you want to delete this concept? All mappings will be removed.')) return;
    
    // Remove all connections for this concept
    const conceptConnections = connections.filter(c => c.conceptId === conceptId);
    conceptConnections.forEach(conn => removeMapping(conn.id));
    
    // Remove concept
    setConcepts((prev: ConceptNode[]) => prev.filter(c => c.id !== conceptId));
    
    if (selectedConceptId === conceptId) {
      setSelectedConceptId(null);
    }
  }, [connections, removeMapping, selectedConceptId]);

  // Auto-generate suggestions on component mount
  useEffect(() => {
    if (groups.length > 0 && concepts.length > 0 && suggestions.length === 0) {
      generateMappingSuggestions();
    }
  }, [groups.length, concepts.length, suggestions.length, generateMappingSuggestions]);

  const renderVisualMapping = () => (
    <div className="space-y-6">
      {/* Visual Mapping Canvas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Concept-Group Mapping Canvas
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const name = prompt('Concept name:');
                  if (name) {
                    const description = prompt('Description:');
                    const category = prompt('Category (demographic/economic/environmental/infrastructure/social):') as ConceptNode['category'] || 'custom';
                    createConcept(name, description || '', category);
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Concept
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateMappingSuggestions}
                disabled={isGeneratingSuggestions}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                Generate Suggestions
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative border-2 border-dashed border-gray-200 rounded-lg p-6 min-h-96 bg-gray-50">
            {/* Concepts */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredConcepts.map(concept => {
                  const isSelected = selectedConceptId === concept.id;
                  const mappedGroupsCount = concept.mappedGroups.length;
                  const errors = validationErrors.filter(e => e.path.includes(`concepts.${concept.id}`));
                  
                  return (
                    <div
                      key={concept.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'bg-white hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedConceptId(concept.id)}
                      draggable
                      onDragStart={() => {
                        setIsDragging(true);
                        setDraggedConcept(concept.id);
                      }}
                      onDragEnd={() => {
                        setIsDragging(false);
                        setDraggedConcept(null);
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-blue-500" />
                          <h4 className="font-medium">{concept.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {concept.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {errors.length > 0 && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <Progress value={concept.confidence * 100} className="w-12 h-2" />
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{concept.description}</p>
                      
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {concept.keywords.slice(0, 3).map(keyword => (
                            <Badge key={keyword} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {concept.keywords.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{concept.keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">
                            {mappedGroupsCount} group{mappedGroupsCount !== 1 ? 's' : ''} mapped
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                setSelectedConceptId(concept.id);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                deleteConcept(concept.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Group Mapping Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Layer Groups (Drop Targets)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => {
              const isSelected = selectedGroupId === group.id;
              const mappedConcepts = concepts.filter(c => c.mappedGroups.includes(group.id));
              
              return (
                <div
                  key={group.id}
                  className={`p-4 border-2 border-dashed rounded-lg transition-all ${
                    isSelected ? 'border-green-500 bg-green-50' : 
                    isDragging ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedGroupId(group.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSelectedGroupId(group.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedConcept) {
                      createMapping(draggedConcept, group.id, 'group');
                    }
                    setSelectedGroupId(null);
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-green-500" />
                    <h4 className="font-medium">{group.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {group.layers.length} layers
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{group.description}</p>
                  
                  <div className="space-y-2">
                    <div className="text-sm text-gray-500">
                      Mapped Concepts ({mappedConcepts.length}):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {mappedConcepts.map(concept => (
                        <Badge key={concept.id} variant="default" className="text-xs">
                          {concept.name}
                        </Badge>
                      ))}
                      {mappedConcepts.length === 0 && (
                        <span className="text-xs text-gray-400">No concepts mapped</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderConceptConfiguration = () => {
    const selectedConcept = selectedConceptId ? concepts.find(c => c.id === selectedConceptId) : null;
    
    if (!selectedConcept) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Select a concept to configure its properties</p>
          </CardContent>
        </Card>
      );
    }
    
    const mappedGroups = groups.filter(g => selectedConcept.mappedGroups.includes(g.id));
    const conceptConnections = connections.filter(c => c.conceptId === selectedConcept.id);
    
    return (
      <div className="space-y-6">
        {/* Concept Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  {selectedConcept.name}
                </CardTitle>
                <p className="text-gray-600 mt-1">{selectedConcept.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedConcept.category}</Badge>
                <Progress value={selectedConcept.confidence * 100} className="w-20 h-2" />
                <span className="text-sm text-gray-500">
                  {Math.round(selectedConcept.confidence * 100)}%
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Concept Properties */}
        <Card>
          <CardHeader>
            <CardTitle>Concept Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="concept-name">Concept Name</Label>
                <Input
                  id="concept-name"
                  value={selectedConcept.name}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateConcept(selectedConcept.id, { name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="concept-category">Category</Label>
                <Select
                  value={selectedConcept.category}
                  onValueChange={(value) => updateConcept(selectedConcept.id, { category: value as ConceptNode['category'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demographic">Demographic</SelectItem>
                    <SelectItem value="economic">Economic</SelectItem>
                    <SelectItem value="environmental">Environmental</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="concept-description">Description</Label>
              <Textarea
                id="concept-description"
                value={selectedConcept.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateConcept(selectedConcept.id, { description: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="concept-keywords">Keywords (comma-separated)</Label>
              <Input
                id="concept-keywords"
                value={selectedConcept.keywords.join(', ')}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateConcept(selectedConcept.id, {
                  keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k.length > 0)
                })}
              />
            </div>

            <div>
              <Label htmlFor="concept-synonyms">Synonyms (comma-separated)</Label>
              <Input
                id="concept-synonyms"
                value={selectedConcept.synonyms.join(', ')}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateConcept(selectedConcept.id, {
                  synonyms: e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
                })}
              />
            </div>

            <div>
              <Label htmlFor="concept-patterns">Query Patterns (one per line)</Label>
              <Textarea
                id="concept-patterns"
                value={selectedConcept.queryPatterns.join('\n')}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateConcept(selectedConcept.id, {
                  queryPatterns: e.target.value.split('\n').map(p => p.trim()).filter(p => p.length > 0)
                })}
                rows={4}
                placeholder="show population data&#10;population in area&#10;demographic information"
              />
            </div>
          </CardContent>
        </Card>

        {/* Mapped Groups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Mapped Groups ({mappedGroups.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mappedGroups.map(group => {
                const connection = conceptConnections.find(c => c.targetId === group.id);
                
                return (
                  <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-green-500" />
                      <div>
                        <div className="font-medium">{group.name}</div>
                        <div className="text-sm text-gray-500">{group.layers.length} layers</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {connection && (
                        <>
                          <Progress value={connection.strength * 100} className="w-16 h-2" />
                          <span className="text-xs text-gray-500">
                            {Math.round(connection.strength * 100)}%
                          </span>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => connection && removeMapping(connection.id)}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {mappedGroups.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Link className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm">No groups mapped to this concept</p>
                  <p className="text-xs">Drag and drop from the Visual Mapping tab</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSmartSuggestions = () => (
    <div className="space-y-6">
      {/* Suggestions Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Smart Mapping Suggestions
            </CardTitle>
            <Button
              onClick={generateMappingSuggestions}
              disabled={isGeneratingSuggestions}
            >
              {isGeneratingSuggestions ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </div>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-1" />
                  Generate Suggestions
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            AI-powered analysis of your layer groups to suggest optimal concept mappings based on 
            semantic similarity, naming patterns, and content analysis.
          </p>
        </CardContent>
      </Card>

      {/* Suggestions List */}
      <div className="space-y-4">
        {suggestions.map(suggestion => (
          <Card key={suggestion.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{suggestion.conceptName}</h4>
                    <Badge variant="outline" className="text-xs">
                      {suggestion.category}
                    </Badge>
                    <Progress value={suggestion.priority * 100} className="w-16 h-2" />
                    <span className="text-xs text-gray-500">
                      {Math.round(suggestion.priority * 100)}%
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Suggested Mappings:</div>
                    {suggestion.suggestedMappings.map(mapping => (
                      <div key={mapping.groupId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <Layers className="h-3 w-3" />
                          <span className="text-sm">{mapping.groupName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={mapping.confidence * 100} className="w-12 h-2" />
                          <span className="text-xs text-gray-500">
                            {Math.round(mapping.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    Keywords: {suggestion.keywords.join(', ')}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applySuggestion(suggestion)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Apply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {suggestions.length === 0 && !isGeneratingSuggestions && (
          <Card>
            <CardContent className="p-8 text-center">
              <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No mapping suggestions available</p>
              <Button onClick={generateMappingSuggestions}>
                <Wand2 className="h-4 w-4 mr-1" />
                Generate Suggestions
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const renderMappingAnalytics = () => (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{concepts.length}</div>
            <div className="text-sm text-gray-500">Total Concepts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{activeConnections.length}</div>
            <div className="text-sm text-gray-500">Active Mappings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round((activeConnections.length / (concepts.length * groups.length)) * 100)}%
            </div>
            <div className="text-sm text-gray-500">Coverage Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {activeConnections.reduce((sum, c) => sum + c.strength, 0) / activeConnections.length || 0}
            </div>
            <div className="text-sm text-gray-500">Avg Strength</div>
          </CardContent>
        </Card>
      </div>

      {/* Mapping Quality Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Mapping Quality Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {concepts.map(concept => {
              const conceptConnections = activeConnections.filter(c => c.conceptId === concept.id);
              const avgStrength = conceptConnections.reduce((sum, c) => sum + c.strength, 0) / conceptConnections.length || 0;
              const coverage = (conceptConnections.length / groups.length) * 100;
              
              return (
                <div key={concept.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{concept.name}</h4>
                    <Badge variant={coverage > 50 ? 'default' : 'secondary'}>
                      {coverage.toFixed(1)}% coverage
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Mappings</div>
                      <div className="font-medium">{conceptConnections.length}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Avg Strength</div>
                      <div className="font-medium">{(avgStrength * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Keywords</div>
                      <div className="font-medium">{concept.keywords.length}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Confidence</div>
                      <div className="font-medium">{(concept.confidence * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <Progress value={coverage} className="h-2" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="h-full p-6">
      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search concepts..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="demographic">Demographic</SelectItem>
                <SelectItem value="economic">Economic</SelectItem>
                <SelectItem value="environmental">Environmental</SelectItem>
                <SelectItem value="infrastructure">Infrastructure</SelectItem>
                <SelectItem value="social">Social</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={showInactiveMappings}
                onCheckedChange={setShowInactiveMappings}
              />
              <Label>Show Inactive</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="visual">Visual Mapping</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="suggestions">Smart Suggestions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-auto">
          <TabsContent value="visual" className="h-full">
            {renderVisualMapping()}
          </TabsContent>
          
          <TabsContent value="configuration" className="h-full">
            {renderConceptConfiguration()}
          </TabsContent>
          
          <TabsContent value="suggestions" className="h-full">
            {renderSmartSuggestions()}
          </TabsContent>
          
          <TabsContent value="analytics" className="h-full">
            {renderMappingAnalytics()}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}; 