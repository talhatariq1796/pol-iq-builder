'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Actions, Action } from './actions';
import { CodeBlock, CodeBlockCopyButton } from './code-block';
import { cn } from '@/lib/utils';
import {
  Download,
  Upload,
  Save,
  Copy,
  Trash2,
  Edit,
  Plus,
  FileText,
  Star,
  StarOff,
  Clock,
  User,
  Building2,
  Heart,
  Home,
  DollarSign,
  Briefcase
} from 'lucide-react';

// Types for configuration templates
interface AnalysisConfig {
  endpoint: string;
  confidence: number;
  geographicScope: string;
  zipCodes: string[];
  targetBrand?: string;
  detectedFields: string[];
  relevanceThreshold: number;
  scoreConfig: {
    weights: Record<string, number>;
    filters: Record<string, any>;
    clustering: {
      enabled: boolean;
      algorithm: 'DBSCAN' | 'HDBSCAN';
      eps: number;
      minSamples: number;
    };
  };
  analysisType: 'strategic' | 'demographic' | 'competitive' | 'trend' | 'location' | 'predictive';
  persona: 'strategist' | 'analyst' | 'consultant';
  includeShap: boolean;
  generateInsights: boolean;
  confidenceLevel: number;
  maxResults: number;
}

interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  config: Partial<AnalysisConfig>;
  category: 'retail' | 'healthcare' | 'realestate' | 'finance' | 'custom';
  tags: string[];
  isBuiltIn: boolean;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  author?: string;
  usageCount: number;
  version: string;
}

interface ConfigurationTemplatesProps {
  templates: ConfigTemplate[];
  currentConfig?: AnalysisConfig;
  onLoadTemplate: (template: ConfigTemplate) => void;
  onSaveTemplate: (template: Omit<ConfigTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
  onUpdateTemplate: (id: string, template: Partial<ConfigTemplate>) => void;
  onDeleteTemplate: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onImportTemplates: (templates: ConfigTemplate[]) => void;
  onExportTemplate: (template: ConfigTemplate) => void;
  className?: string;
}

// Built-in templates with comprehensive configurations
const BUILTIN_TEMPLATES: ConfigTemplate[] = [
  {
    id: 'retail-expansion-premium',
    name: 'Premium Retail Expansion',
    description: 'Comprehensive retail expansion analysis with advanced demographic weighting and clustering for premium brands',
    category: 'retail',
    tags: ['retail', 'expansion', 'premium', 'demographics'],
    isBuiltIn: true,
    isFavorite: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    author: 'MPIQ AI Team',
    usageCount: 247,
    version: '2.1',
    config: {
      analysisType: 'strategic',
      persona: 'strategist',
      confidenceLevel: 0.92,
      relevanceThreshold: 0.85,
      maxResults: 150,
      includeShap: true,
      generateInsights: true,
      scoreConfig: {
        weights: {
          demographic: 0.45,
          economic: 0.35,
          competitive: 0.15,
          geographic: 0.05
        },
        filters: {
          minPopulation: 15000,
          minMedianIncome: 55000,
          maxCompetitorDensity: 0.3
        },
        clustering: {
          enabled: true,
          algorithm: 'HDBSCAN',
          eps: 0.3,
          minSamples: 4
        }
      }
    }
  },
  {
    id: 'healthcare-demographics',
    name: 'Healthcare Demographics Study',
    description: 'Population health analysis with focus on age demographics, income levels, and healthcare accessibility',
    category: 'healthcare',
    tags: ['healthcare', 'demographics', 'population', 'accessibility'],
    isBuiltIn: true,
    isFavorite: false,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-02-01'),
    author: 'MPIQ AI Team',
    usageCount: 89,
    version: '1.3',
    config: {
      analysisType: 'demographic',
      persona: 'analyst',
      confidenceLevel: 0.95,
      relevanceThreshold: 0.90,
      maxResults: 200,
      includeShap: false,
      generateInsights: true,
      scoreConfig: {
        weights: {
          demographic: 0.65,
          economic: 0.25,
          geographic: 0.10,
          competitive: 0.00
        },
        filters: {
          ageGroups: ['65+', '45-64', '25-44'],
          healthcareAccess: 'required'
        },
        clustering: {
          enabled: true,
          algorithm: 'DBSCAN',
          eps: 0.4,
          minSamples: 6
        }
      }
    }
  },
  {
    id: 'real-estate-investment',
    name: 'Real Estate Investment Analysis',
    description: 'Property investment opportunity analysis focusing on economic indicators and growth trends',
    category: 'realestate',
    tags: ['realestate', 'investment', 'growth', 'economic'],
    isBuiltIn: true,
    isFavorite: false,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-15'),
    author: 'MPIQ AI Team',
    usageCount: 156,
    version: '1.8',
    config: {
      analysisType: 'predictive',
      persona: 'consultant',
      confidenceLevel: 0.88,
      relevanceThreshold: 0.80,
      maxResults: 100,
      includeShap: true,
      generateInsights: true,
      scoreConfig: {
        weights: {
          economic: 0.50,
          demographic: 0.25,
          geographic: 0.20,
          competitive: 0.05
        },
        filters: {
          propertyTypes: ['residential', 'commercial'],
          priceRanges: ['medium', 'high'],
          growthTrend: 'positive'
        },
        clustering: {
          enabled: true,
          algorithm: 'HDBSCAN',
          eps: 0.25,
          minSamples: 3
        }
      }
    }
  },
  {
    id: 'competitive-landscape-analysis',
    name: 'Competitive Landscape Deep Dive',
    description: 'Comprehensive market competition analysis with brand positioning and market gap identification',
    category: 'custom',
    tags: ['competitive', 'market', 'brands', 'positioning'],
    isBuiltIn: true,
    isFavorite: false,
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-03-01'),
    author: 'MPIQ AI Team',
    usageCount: 134,
    version: '2.0',
    config: {
      analysisType: 'competitive',
      persona: 'strategist',
      confidenceLevel: 0.85,
      relevanceThreshold: 0.75,
      maxResults: 250,
      includeShap: false,
      generateInsights: true,
      scoreConfig: {
        weights: {
          competitive: 0.55,
          economic: 0.25,
          demographic: 0.15,
          geographic: 0.05
        },
        filters: {
          includeDirectCompetitors: true,
          includeIndirectCompetitors: true,
          marketMaturity: 'all'
        },
        clustering: {
          enabled: false,
          algorithm: 'DBSCAN',
          eps: 0.5,
          minSamples: 5
        }
      }
    }
  },
  {
    id: 'financial-services-targeting',
    name: 'Financial Services Customer Targeting',
    description: 'Customer segmentation and targeting for financial services with income and investment behavior focus',
    category: 'finance',
    tags: ['finance', 'targeting', 'segmentation', 'investment'],
    isBuiltIn: true,
    isFavorite: false,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-15'),
    author: 'MPIQ AI Team',
    usageCount: 67,
    version: '1.5',
    config: {
      analysisType: 'demographic',
      persona: 'analyst',
      confidenceLevel: 0.93,
      relevanceThreshold: 0.88,
      maxResults: 125,
      includeShap: true,
      generateInsights: true,
      scoreConfig: {
        weights: {
          economic: 0.45,
          demographic: 0.40,
          geographic: 0.10,
          competitive: 0.05
        },
        filters: {
          minIncome: 75000,
          investmentBehavior: 'active',
          creditScore: 'good+'
        },
        clustering: {
          enabled: true,
          algorithm: 'HDBSCAN',
          eps: 0.35,
          minSamples: 4
        }
      }
    }
  }
];

export const ConfigurationTemplates: React.FC<ConfigurationTemplatesProps> = ({
  templates,
  currentConfig,
  onLoadTemplate,
  onSaveTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onToggleFavorite,
  onImportTemplates,
  onExportTemplate,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConfigTemplate | null>(null);
  
  // Form state for creating/editing templates
  interface FormData {
    name: string;
    description: string;
    category: ConfigTemplate['category'];
    tags: string;
  }

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    category: 'custom' as ConfigTemplate['category'],
    tags: ''
  });

  // Combine built-in and user templates
  const allTemplates = useMemo(() => [...BUILTIN_TEMPLATES, ...templates], [templates]);

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      const matchesFavorites = !showFavoritesOnly || template.isFavorite;
      
      return matchesSearch && matchesCategory && matchesFavorites;
    });
  }, [allTemplates, searchTerm, selectedCategory, showFavoritesOnly]);

  // Get category icon
  const getCategoryIcon = (category: ConfigTemplate['category']) => {
    switch (category) {
      case 'retail': return Building2;
      case 'healthcare': return Heart;
      case 'realestate': return Home;
      case 'finance': return DollarSign;
      case 'custom': return User;
      default: return Briefcase;
    }
  };

  // Get category color
  const getCategoryColor = (category: ConfigTemplate['category']) => {
    switch (category) {
      case 'retail': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'healthcare': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'realestate': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'finance': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'custom': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
    }
  };

  // Handle form submission for creating/editing templates
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentConfig) return;

    const templateData = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      config: currentConfig,
      isBuiltIn: false,
      isFavorite: false,
      author: 'User',
      version: '1.0'
    };

    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, templateData);
    } else {
      onSaveTemplate(templateData);
    }

    // Reset form
    setFormData({ name: '', description: '', category: 'custom', tags: '' });
    setIsCreateDialogOpen(false);
    setEditingTemplate(null);
  }, [formData, currentConfig, editingTemplate, onSaveTemplate, onUpdateTemplate]);

  // Handle template editing
  const handleEdit = useCallback((template: ConfigTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags.join(', ')
    });
    setIsCreateDialogOpen(true);
  }, []);

  // Handle template export
  const handleExport = useCallback((template: ConfigTemplate) => {
    const exportData = {
      ...template,
      exportedAt: new Date().toISOString(),
      exportedBy: 'MPIQ AI Platform'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${template.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    onExportTemplate(template);
  }, [onExportTemplate]);

  // Handle bulk export
  const handleBulkExport = useCallback(() => {
    const exportData = {
      templates: filteredTemplates,
      exportedAt: new Date().toISOString(),
      exportedBy: 'MPIQ AI Platform',
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mpiq-templates-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredTemplates]);

  // Handle import
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const importedTemplates = Array.isArray(data.templates) ? data.templates : [data];
        onImportTemplates(importedTemplates);
      } catch (error) {
        console.error('Failed to import templates:', error);
        alert('Failed to import templates. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  }, [onImportTemplates]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Configuration Templates</h3>
          <p className="text-xs text-muted-foreground">
            Save, load, and manage analysis configurations
          </p>
        </div>
        
        <Actions>
          <Action
            tooltip="Import templates"
            onClick={() => document.getElementById('template-import')?.click()}
          >
            <Upload className="w-3 h-3" />
          </Action>
          <Action
            tooltip="Export all templates"
            onClick={handleBulkExport}
          >
            <Download className="w-3 h-3" />
          </Action>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Action tooltip="Create new template">
                <Plus className="w-3 h-3" />
              </Action>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData((prev: FormData) => ({ ...prev, name: e.target.value }))}
                    placeholder="Template name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData((prev: FormData) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this template is optimized for..."
                    rows={3}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium">Category</label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: ConfigTemplate['category']) => 
                      setFormData((prev: FormData) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="realestate">Real Estate</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium">Tags (comma-separated)</label>
                  <Input
                    value={formData.tags}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData((prev: FormData) => ({ ...prev, tags: e.target.value }))}
                    placeholder="retail, expansion, demographics"
                  />
                </div>
                
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setEditingTemplate(null);
                      setFormData({ name: '', description: '', category: 'custom', tags: '' });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingTemplate ? 'Update' : 'Create'} Template
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </Actions>
        
        {/* Hidden file input for import */}
        <input
          id="template-import"
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSearchTerm(e.target.value)}
            className="text-xs"
          />
        </div>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="retail">Retail</SelectItem>
            <SelectItem value="healthcare">Healthcare</SelectItem>
            <SelectItem value="realestate">Real Estate</SelectItem>
            <SelectItem value="finance">Finance</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className="text-xs"
        >
          {showFavoritesOnly ? <Star className="w-3 h-3 mr-1" /> : <StarOff className="w-3 h-3 mr-1" />}
          Favorites
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => {
          const CategoryIcon = getCategoryIcon(template.category);
          
          return (
            <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-1 rounded", getCategoryColor(template.category))}>
                      <CategoryIcon className="w-3 h-3" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm line-clamp-1">{template.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          v{template.version}
                        </Badge>
                        {template.isBuiltIn && (
                          <Badge variant="secondary" className="text-xs">
                            Built-in
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Actions>
                    <Action
                      tooltip={template.isFavorite ? "Remove from favorites" : "Add to favorites"}
                      onClick={() => onToggleFavorite(template.id)}
                    >
                      {template.isFavorite ? (
                        <Star className="w-3 h-3 fill-current text-yellow-500" />
                      ) : (
                        <StarOff className="w-3 h-3" />
                      )}
                    </Action>
                  </Actions>
                </div>
              </CardHeader>
              
              <CardContent>
                <CardDescription className="text-xs mb-3 line-clamp-2">
                  {template.description}
                </CardDescription>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {template.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{template.tags.length - 3}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {template.updatedAt.toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {template.usageCount} uses
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onLoadTemplate(template)}
                    className="text-xs flex-1"
                  >
                    Load Template
                  </Button>
                  
                  <Actions className="ml-2">
                    {!template.isBuiltIn && (
                      <Action
                        tooltip="Edit template"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit className="w-3 h-3" />
                      </Action>
                    )}
                    <Action
                      tooltip="Export template"
                      onClick={() => handleExport(template)}
                    >
                      <Download className="w-3 h-3" />
                    </Action>
                    <Action
                      tooltip="Copy configuration"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(template.config, null, 2));
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Action>
                    {!template.isBuiltIn && (
                      <Action
                        tooltip="Delete template"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this template?')) {
                            onDeleteTemplate(template.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Action>
                    )}
                  </Actions>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">No templates found</p>
            <p className="text-xs text-muted-foreground">
              {searchTerm || selectedCategory !== 'all' || showFavoritesOnly
                ? 'Try adjusting your filters or create a new template'
                : 'Create your first template to get started'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConfigurationTemplates;