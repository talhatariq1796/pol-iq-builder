import { LayerConfig, LayerGroup, ProjectLayerConfig } from '../types/layers';
import { layers } from '../config/layers';
import { createProjectConfig } from '../adapters/layerConfigAdapter';

interface LayerState {
  id: string;
  visible: boolean;
  opacity: number;
  order: number;
  groupId: string | null;
}

interface ILayerStateManager {
  states: Record<string, LayerState>;
  groups: LayerGroup[];
  defaultVisibility: Record<string, boolean>;
  defaultCollapsed: Record<string, boolean>;
}

class LayerStateManager {
  private static instance: LayerStateManager;
  private storageKey = 'layer_states';

  public states: Record<string, LayerState>;
  public groups: LayerGroup[];
  public defaultVisibility: Record<string, boolean>;
  public defaultCollapsed: Record<string, boolean>;

  private constructor() {
    this.states = {};
    const projectLayerConfig = createProjectConfig();
    this.groups = projectLayerConfig.groups;
    this.defaultVisibility = projectLayerConfig.defaultVisibility || {};
    this.defaultCollapsed = projectLayerConfig.defaultCollapsed || {};
    this.loadState();
  }

  public static getInstance(): LayerStateManager {
    if (!LayerStateManager.instance) {
      LayerStateManager.instance = new LayerStateManager();
    }
    return LayerStateManager.instance;
  }

  private loadState(): void {
    try {
      const savedState = localStorage.getItem(this.storageKey);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.states = parsed.states;
        this.groups = parsed.groups;
        this.defaultVisibility = parsed.defaultVisibility;
        this.defaultCollapsed = parsed.defaultCollapsed;
      } else {
        this.initializeDefaultState();
      }
    } catch (error) {
      console.error('Error loading layer state:', error);
      this.initializeDefaultState();
    }
  }

  private initializeDefaultState(): void {
    Object.entries(layers).forEach(([id, layer], index) => {
      this.states[id] = {
        id,
        visible: this.defaultVisibility[id] ?? false,
        opacity: 1,
        order: index,
        groupId: layer.group || null
      };
    });
    this.saveState();
  }

  private saveState(): void {
    try {
      const stateToSave = {
        states: this.states,
        groups: this.groups,
        defaultVisibility: this.defaultVisibility,
        defaultCollapsed: this.defaultCollapsed
      };
      localStorage.setItem(this.storageKey, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Error saving layer state:', error);
    }
  }

  public getLayerState(layerId: string): LayerState | null {
    return this.states[layerId] || null;
  }

  public setLayerVisibility(layerId: string, visible: boolean): void {
    if (this.states[layerId]) {
      this.states[layerId].visible = visible;
      this.saveState();
    }
  }

  public setLayerOpacity(layerId: string, opacity: number): void {
    if (this.states[layerId]) {
      this.states[layerId].opacity = Math.max(0, Math.min(1, opacity));
      this.saveState();
    }
  }

  public setLayerOrder(layerId: string, newOrder: number): void {
    if (this.states[layerId]) {
      this.states[layerId].order = newOrder;
      this.saveState();
    }
  }

  public setLayerGroup(layerId: string, groupId: string | null): void {
    if (this.states[layerId]) {
      this.states[layerId].groupId = groupId;
      this.saveState();
    }
  }

  public getVisibleLayers(): string[] {
    return Object.entries(this.states)
      .filter(([_, state]) => state.visible)
      .map(([id]) => id);
  }

  public getLayersByGroup(groupId: string): string[] {
    return Object.entries(this.states)
      .filter(([_, state]) => state.groupId === groupId)
      .map(([id]) => id);
  }

  public getOrderedLayers(): string[] {
    return Object.entries(this.states)
      .sort(([_, a], [__, b]) => a.order - b.order)
      .map(([id]) => id);
  }

  public resetToDefaults(): void {
    this.initializeDefaultState();
  }
}

export const layerStateManager = LayerStateManager.getInstance(); 