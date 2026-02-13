'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, Search, Check, Plus, AlertCircle, MapPin, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import type { BoundaryType, EntitySearchResult } from '@/lib/comparison';

interface BatchEntitySelectorProps {
  boundaryType: BoundaryType;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  maxEntities?: number;
  minEntities?: number;
  onLoadComparison?: () => void;
}

interface ListResult {
  id: string;
  name: string;
  type?: string;
  partisanLean?: number;
  population?: number;
  jurisdiction?: string;
  precinctCount?: number;
}

export function BatchEntitySelector({
  boundaryType,
  selectedIds,
  onChange,
  maxEntities = 8,
  minEntities = 3,
  onLoadComparison,
}: BatchEntitySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [entities, setEntities] = useState<EntitySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch entities when boundary type changes
  useEffect(() => {
    fetchEntities();
  }, [boundaryType]);

  const fetchEntities = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const listType = getListType(boundaryType);
      const url = `/api/comparison?list=${listType}&boundaryType=${boundaryType}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch entities');
      }

      const data = await response.json();

      // Map different response formats to EntitySearchResult
      const results: EntitySearchResult[] = mapToEntitySearchResults(data, listType);
      setEntities(results);
    } catch (err) {
      console.error('Error fetching entities:', err);
      setError(err instanceof Error ? err.message : 'Failed to load entities');
    } finally {
      setIsLoading(false);
    }
  };

  // Map API response to EntitySearchResult format
  const mapToEntitySearchResults = (data: any, listType: string): EntitySearchResult[] => {
    let items: ListResult[] = [];

    if (listType === 'precincts' && data.precincts) {
      items = data.precincts;
    } else if (listType === 'jurisdictions' && data.jurisdictions) {
      items = data.jurisdictions;
    } else if (listType === 'municipalities' && data.municipalities) {
      items = data.municipalities;
    } else if (listType === 'state_house' && data.districts) {
      items = data.districts;
    }

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      type: listType === 'precincts' ? 'precinct' : 'jurisdiction',
      parentName: item.jurisdiction || undefined,
      partisanLean: item.partisanLean || 0,
      population: item.population || 0,
    }));
  };

  // Get list type from boundary type
  const getListType = (type: BoundaryType): string => {
    switch (type) {
      case 'precincts':
        return 'precincts';
      case 'municipalities':
        return 'municipalities';
      case 'state_house':
        return 'state_house';
      default:
        return 'municipalities';
    }
  };

  // Filter entities based on search query
  const filteredEntities = useMemo(() => {
    if (!searchQuery.trim()) {
      return entities;
    }

    const query = searchQuery.toLowerCase();
    return entities.filter((entity) => {
      const nameMatch = entity.name.toLowerCase().includes(query);
      const parentMatch = entity.parentName?.toLowerCase().includes(query);
      return nameMatch || parentMatch;
    });
  }, [entities, searchQuery]);

  // Get selected entity names for display
  const selectedEntities = useMemo(() => {
    return entities.filter((entity) => selectedIds.includes(entity.id));
  }, [entities, selectedIds]);

  // Handle entity selection
  const handleSelectEntity = useCallback(
    (entityId: string) => {
      if (selectedIds.includes(entityId)) {
        // Remove if already selected
        onChange(selectedIds.filter((id) => id !== entityId));
      } else {
        // Add if not at max
        if (selectedIds.length < maxEntities) {
          onChange([...selectedIds, entityId]);
        }
      }
    },
    [selectedIds, maxEntities, onChange]
  );

  // Handle remove entity
  const handleRemoveEntity = useCallback(
    (entityId: string) => {
      onChange(selectedIds.filter((id) => id !== entityId));
    },
    [selectedIds, onChange]
  );

  // Handle clear all
  const handleClearAll = useCallback(() => {
    onChange([]);
    setSearchQuery('');
  }, [onChange]);

  // Handle load comparison
  const handleLoadComparison = useCallback(() => {
    if (selectedIds.length >= minEntities && onLoadComparison) {
      onLoadComparison();
      setIsOpen(false);
    }
  }, [selectedIds, minEntities, onLoadComparison]);

  // Calculate progress percentage
  const progressPercentage = (selectedIds.length / maxEntities) * 100;

  // Check if at capacity
  const isAtMax = selectedIds.length >= maxEntities;
  const canLoadComparison = selectedIds.length >= minEntities;
  const needsMoreEntities = selectedIds.length < minEntities;

  return (
    <div className="space-y-3">
      {/* Search Input with Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between"
            disabled={isAtMax}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              {isAtMax ? 'Maximum entities selected' : 'Search entities...'}
            </span>
            <Plus className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="flex flex-col">
            {/* Search input */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Entity list */}
            <ScrollArea className="max-h-[300px]">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading entities...
                </div>
              ) : filteredEntities.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {searchQuery ? 'No entities found' : 'No entities available'}
                </div>
              ) : (
                <div className="p-1">
                  {filteredEntities.map((entity) => {
                    const isSelected = selectedIds.includes(entity.id);
                    const isDisabled = !isSelected && isAtMax;

                    return (
                      <button
                        key={entity.id}
                        onClick={() => handleSelectEntity(entity.id)}
                        disabled={isDisabled}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm',
                          'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
                          isSelected && 'bg-blue-50 dark:bg-blue-900/20',
                          isDisabled && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0">
                          {entity.type === 'precinct' ? (
                            <MapPin className="h-4 w-4 text-gray-500" />
                          ) : (
                            <Building2 className="h-4 w-4 text-gray-500" />
                          )}
                        </div>

                        {/* Entity info */}
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-medium truncate">{entity.name}</div>
                          {entity.parentName && (
                            <div className="text-xs text-muted-foreground truncate">
                              {entity.parentName}
                            </div>
                          )}
                        </div>

                        {/* Type badge */}
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {entity.type}
                        </Badge>

                        {/* Check icon if selected */}
                        {isSelected && (
                          <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected entities chips */}
      {selectedEntities.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {selectedEntities.map((entity) => (
              <Badge
                key={entity.id}
                variant="secondary"
                className="px-3 py-1 gap-2"
              >
                <span className="truncate max-w-[200px]">{entity.name}</span>
                <button
                  onClick={() => handleRemoveEntity(entity.id)}
                  className="ml-1 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Progress and count */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selectedIds.length} of {maxEntities} selected
            {needsMoreEntities && (
              <span className="text-orange-600 dark:text-orange-400 ml-2">
                (min {minEntities} required)
              </span>
            )}
          </span>
          {selectedIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-auto py-1 px-2 text-xs"
            >
              Clear All
            </Button>
          )}
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Warning for minimum entities */}
      {selectedIds.length > 0 && needsMoreEntities && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Select at least {minEntities} entities to load comparison
          </AlertDescription>
        </Alert>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Load comparison button */}
      {onLoadComparison && (
        <Button
          onClick={handleLoadComparison}
          disabled={!canLoadComparison}
          className="w-full"
        >
          Load Comparison
          {canLoadComparison && ` (${selectedIds.length} entities)`}
        </Button>
      )}
    </div>
  );
}
