/**
 * Field Filter Tab Component
 * 
 * Dynamic field filtering interface that adapts based on available endpoint fields.
 * Provides numeric, categorical, text, and null filtering capabilities.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Sliders,
  Hash,
  Type,
  Filter,
  Search,
  X,
  Plus,
  Info,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react';

import { FilterTabProps, FieldDefinition, NumericFilter, CategoricalFilter, TextFilter, NullFilter } from '../types';
import { fieldDiscoveryService } from '../services/FieldDiscoveryService';

/**
 * Category icons mapping
 */
const CATEGORY_ICONS = {
  demographic: Hash,
  geographic: Hash,
  business: Hash,
  calculated: Hash,
  other: Hash,
};

/**
 * Field type icons mapping
 */
const TYPE_ICONS = {
  numeric: Hash,
  categorical: Filter,
  text: Type,
  boolean: CheckCircle,
  date: Hash,
};

export default function FieldFilterTab({
  config,
  onConfigChange,
  availableFields,
  endpoint,
}: FilterTabProps) {
  
  // Local state for field search and UI
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get fields from discovery service or fallback to common fields
  const discoveredFields = useMemo(() => {
    if (endpoint && fieldDiscoveryService.supportsEndpoint(endpoint)) {
      return fieldDiscoveryService.getFieldsForEndpoint(endpoint);
    }
    return fieldDiscoveryService.getCommonFields();
  }, [endpoint]);

  // Use discovered fields or provided fields
  const fields = availableFields || discoveredFields;

  // Filter fields based on search and category
  const filteredFields = useMemo(() => {
    let filtered = fields;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(field => 
        field.name.toLowerCase().includes(query) ||
        field.displayName.toLowerCase().includes(query) ||
        field.description?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(field => field.category === selectedCategory);
    }

    return filtered;
  }, [fields, searchQuery, selectedCategory]);

  // Get available categories
  const categories = useMemo(() => {
    const categorySet = new Set(fields.map(field => field.category));
    return Array.from(categorySet).sort();
  }, [fields]);

  // Calculate filter statistics
  const filterStats = useMemo(() => {
    const totalFilters = Object.keys(config.fieldFilters.numericFilters).length +
                        Object.keys(config.fieldFilters.categoricalFilters).length +
                        Object.keys(config.fieldFilters.textFilters).length +
                        Object.keys(config.fieldFilters.nullFilters).length;

    const activeFilters = Object.values(config.fieldFilters.numericFilters).filter(f => f.enabled).length +
                         Object.values(config.fieldFilters.categoricalFilters).filter(f => f.enabled).length +
                         Object.values(config.fieldFilters.textFilters).filter(f => f.enabled).length +
                         Object.values(config.fieldFilters.nullFilters).filter(f => f.enabled).length;

    return { totalFilters, activeFilters };
  }, [config.fieldFilters]);

  // Handle numeric filter changes
  const handleNumericFilterChange = useCallback((fieldName: string, filter: Partial<NumericFilter>) => {
    const currentFilter = config.fieldFilters.numericFilters[fieldName] || { enabled: false };
    const newFilter = { ...currentFilter, ...filter };
    
    onConfigChange({
      ...config,
      fieldFilters: {
        ...config.fieldFilters,
        numericFilters: {
          ...config.fieldFilters.numericFilters,
          [fieldName]: newFilter,
        },
      },
    });
  }, [config, onConfigChange]);

  // Handle categorical filter changes
  const handleCategoricalFilterChange = useCallback((fieldName: string, filter: Partial<CategoricalFilter>) => {
    const currentFilter = config.fieldFilters.categoricalFilters[fieldName] || { 
      enabled: false, 
      included: [], 
      excluded: [], 
      mode: 'include' as const 
    };
    const newFilter = { ...currentFilter, ...filter };
    
    onConfigChange({
      ...config,
      fieldFilters: {
        ...config.fieldFilters,
        categoricalFilters: {
          ...config.fieldFilters.categoricalFilters,
          [fieldName]: newFilter,
        },
      },
    });
  }, [config, onConfigChange]);

  // Handle text filter changes
  const handleTextFilterChange = useCallback((fieldName: string, filter: Partial<TextFilter>) => {
    const currentFilter = config.fieldFilters.textFilters[fieldName] || { 
      enabled: false, 
      query: '', 
      mode: 'contains' as const, 
      caseSensitive: false 
    };
    const newFilter = { ...currentFilter, ...filter };
    
    onConfigChange({
      ...config,
      fieldFilters: {
        ...config.fieldFilters,
        textFilters: {
          ...config.fieldFilters.textFilters,
          [fieldName]: newFilter,
        },
      },
    });
  }, [config, onConfigChange]);

  // Handle null filter changes
  const handleNullFilterChange = useCallback((fieldName: string, filter: Partial<NullFilter>) => {
    const currentFilter = config.fieldFilters.nullFilters[fieldName] || { 
      enabled: false, 
      mode: 'include' as const 
    };
    const newFilter = { ...currentFilter, ...filter };
    
    onConfigChange({
      ...config,
      fieldFilters: {
        ...config.fieldFilters,
        nullFilters: {
          ...config.fieldFilters.nullFilters,
          [fieldName]: newFilter,
        },
      },
    });
  }, [config, onConfigChange]);

  // Remove field filter
  const handleRemoveFilter = useCallback((fieldName: string, filterType: 'numeric' | 'categorical' | 'text' | 'null') => {
    const newFieldFilters = { ...config.fieldFilters };
    
    switch (filterType) {
      case 'numeric':
        delete newFieldFilters.numericFilters[fieldName];
        break;
      case 'categorical':
        delete newFieldFilters.categoricalFilters[fieldName];
        break;
      case 'text':
        delete newFieldFilters.textFilters[fieldName];
        break;
      case 'null':
        delete newFieldFilters.nullFilters[fieldName];
        break;
    }

    onConfigChange({
      ...config,
      fieldFilters: newFieldFilters,
    });
  }, [config, onConfigChange]);

  // Render numeric filter component
  const renderNumericFilter = (field: FieldDefinition) => {
    const filter = config.fieldFilters.numericFilters[field.name] || { enabled: false };
    const range = field.range || { min: 0, max: 100, step: 1 };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={filter.enabled}
              onCheckedChange={(enabled: boolean) => handleNumericFilterChange(field.name, { enabled })}
            />
            <Label className="text-sm font-medium">{field.displayName}</Label>
          </div>
          {filter.enabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveFilter(field.name, 'numeric')}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {filter.enabled && (
          <div className="space-y-2 ml-6">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Min</Label>
                <Input
                  type="number"
                  placeholder={range.min.toString()}
                  value={filter.min || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNumericFilterChange(field.name, { 
                    min: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Max</Label>
                <Input
                  type="number"
                  placeholder={range.max.toString()}
                  value={filter.max || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNumericFilterChange(field.name, { 
                    max: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  className="h-7 text-xs"
                />
              </div>
            </div>
            
            {filter.range && (
              <div className="space-y-1">
                <Label className="text-xs">Range: {filter.range[0]} - {filter.range[1]}</Label>
                <Slider
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={filter.range[0]}
                  onValueChange={(value: number[]) => handleNumericFilterChange(field.name, { range: [value[0], filter.range?.[1] || range.max] })}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}
        
        {field.description && (
          <p className="text-xs text-muted-foreground ml-6">{field.description}</p>
        )}
      </div>
    );
  };

  // Render categorical filter component
  const renderCategoricalFilter = (field: FieldDefinition) => {
    const filter = config.fieldFilters.categoricalFilters[field.name] || { 
      enabled: false, 
      included: [], 
      excluded: [], 
      mode: 'include' as const 
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={filter.enabled}
              onCheckedChange={(enabled: boolean) => handleCategoricalFilterChange(field.name, { enabled })}
            />
            <Label className="text-sm font-medium">{field.displayName}</Label>
          </div>
          {filter.enabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveFilter(field.name, 'categorical')}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {filter.enabled && (
          <div className="space-y-2 ml-6">
            <Select
              value={filter.mode}
              onValueChange={(mode: 'include' | 'exclude') => 
                handleCategoricalFilterChange(field.name, { mode })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="include">Include selected</SelectItem>
                <SelectItem value="exclude">Exclude selected</SelectItem>
              </SelectContent>
            </Select>
            
            {field.categories && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {field.categories.slice(0, 20).map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${field.name}-${category}`}
                      checked={filter.mode === 'include' ? 
                        filter.included.includes(category) : 
                        filter.excluded.includes(category)
                      }
                      onCheckedChange={(checked: boolean) => {
                        if (filter.mode === 'include') {
                          const included = checked 
                            ? [...filter.included, category]
                            : filter.included.filter(c => c !== category);
                          handleCategoricalFilterChange(field.name, { included });
                        } else {
                          const excluded = checked 
                            ? [...filter.excluded, category]
                            : filter.excluded.filter(c => c !== category);
                          handleCategoricalFilterChange(field.name, { excluded });
                        }
                      }}
                    />
                    <Label 
                      htmlFor={`${field.name}-${category}`}
                      className="text-xs font-normal"
                    >
                      {category}
                    </Label>
                  </div>
                ))}
                {field.categories.length > 20 && (
                  <p className="text-xs text-muted-foreground">
                    ... and {field.categories.length - 20} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        
        {field.description && (
          <p className="text-xs text-muted-foreground ml-6">{field.description}</p>
        )}
      </div>
    );
  };

  // Render text filter component
  const renderTextFilter = (field: FieldDefinition) => {
    const filter = config.fieldFilters.textFilters[field.name] || { 
      enabled: false, 
      query: '', 
      mode: 'contains' as const, 
      caseSensitive: false 
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={filter.enabled}
              onCheckedChange={(enabled: boolean) => handleTextFilterChange(field.name, { enabled })}
            />
            <Label className="text-sm font-medium">{field.displayName}</Label>
          </div>
          {filter.enabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveFilter(field.name, 'text')}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {filter.enabled && (
          <div className="space-y-2 ml-6">
            <div className="flex gap-2">
              <Input
                placeholder="Enter search text..."
                value={filter.query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTextFilterChange(field.name, { query: e.target.value })}
                className="h-7 text-xs flex-1"
              />
              <Select
                value={filter.mode}
                onValueChange={(mode: TextFilter['mode']) => 
                  handleTextFilterChange(field.name, { mode })
                }
              >
                <SelectTrigger className="h-7 text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="exact">Exact</SelectItem>
                  <SelectItem value="startswith">Starts with</SelectItem>
                  <SelectItem value="endswith">Ends with</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${field.name}-case-sensitive`}
                checked={filter.caseSensitive}
                onCheckedChange={(caseSensitive: boolean) => 
                  handleTextFilterChange(field.name, { caseSensitive: Boolean(caseSensitive) })
                }
              />
              <Label 
                htmlFor={`${field.name}-case-sensitive`}
                className="text-xs font-normal"
              >
                Case sensitive
              </Label>
            </div>
          </div>
        )}
        
        {field.description && (
          <p className="text-xs text-muted-foreground ml-6">{field.description}</p>
        )}
      </div>
    );
  };

  // Group fields by category for better organization
  const fieldsByCategory = useMemo(() => {
    const grouped: Record<string, FieldDefinition[]> = {};
    
    filteredFields.forEach(field => {
      if (!grouped[field.category]) {
        grouped[field.category] = [];
      }
      grouped[field.category].push(field);
    });
    
    return grouped;
  }, [filteredFields]);

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4" />
            <span className="font-medium">Field Filters</span>
            {filterStats.activeFilters > 0 && (
              <Badge variant="secondary">
                {filterStats.activeFilters} active
              </Badge>
            )}
          </div>
          
          {endpoint && fieldDiscoveryService.supportsEndpoint(endpoint) && (
            <Badge variant="outline" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              {endpoint} fields
            </Badge>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs"
        >
          {showAdvanced ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
          {showAdvanced ? 'Simple' : 'Advanced'}
        </Button>
      </div>

      {/* Search and filter controls */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search fields..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Field discovery status */}
        {!endpoint && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Showing common fields. Select a specific analysis type to see endpoint-specific fields.
            </AlertDescription>
          </Alert>
        )}
        
        {endpoint && !fieldDiscoveryService.supportsEndpoint(endpoint) && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Field discovery not yet available for {endpoint}. Showing common fields.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Fields list organized by category */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(fieldsByCategory).length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No fields found matching your search</p>
            </div>
          </div>
        ) : (
          <Accordion className="space-y-2">
            {Object.entries(fieldsByCategory).map(([category, categoryFields]) => {
              const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || Hash;
              
              return (
                <AccordionItem key={category} value={category}>
                  <AccordionTrigger className="py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="capitalize">{category}</span>
                      <Badge variant="outline" className="text-xs">
                        {categoryFields.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {categoryFields.map(field => {
                        const TypeIcon = TYPE_ICONS[field.type] || Hash;
                        
                        return (
                          <Card key={field.name} className="p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <TypeIcon className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{field.type}</span>
                              {field.common && (
                                <Badge variant="secondary" className="text-xs">
                                  Common
                                </Badge>
                              )}
                            </div>
                            
                            {/* Render appropriate filter component based on field type */}
                            {field.type === 'numeric' && renderNumericFilter(field)}
                            {field.type === 'categorical' && renderCategoricalFilter(field)}
                            {field.type === 'text' && renderTextFilter(field)}
                          </Card>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}