import { LayerConfig, LayerGroup, LayerState, GroupState, PersistedState, ProjectLayerConfig } from '../types/layers';
import { createProjectConfig } from '../adapters/layerConfigAdapter';

const STORAGE_KEY = 'nesto_layer_state';

class LayerStatePersistence {
  private static instance: LayerStatePersistence;
  private state: PersistedState;

  private constructor() {
    this.state = this.loadState();
  }

  public static getInstance(): LayerStatePersistence {
    if (!LayerStatePersistence.instance) {
      LayerStatePersistence.instance = new LayerStatePersistence();
    }
    return LayerStatePersistence.instance;
  }

  private loadState(): PersistedState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PersistedState;
        // Validate the stored state
        if (this.isValidState(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error loading layer state:', error);
    }

    // Return default state if no valid state is found
    return this.createDefaultState();
  }

  private createDefaultState(): PersistedState {
    const layers: Record<string, LayerState> = {};
    const groups: Record<string, GroupState> = {};
    
    // Get project config from adapter
    const projectLayerConfig = createProjectConfig();

    // Initialize layer states
    Object.entries(projectLayerConfig.layers).forEach(([id, layer]: [string, LayerConfig]) => {
      layers[id] = {
        id,
        name: layer.name,
        layer: null,
        visible: (projectLayerConfig.defaultVisibility as Record<string, boolean>)?.[id] ?? false,
        opacity: projectLayerConfig.globalSettings.defaultOpacity,
        order: 0,
        group: layer.group,
        loading: false,
        filters: [],
        isVirtual: false,
        active: false
      };
    });

    // Initialize group states
    projectLayerConfig.groups.forEach((group: LayerGroup) => {
      groups[group.id] = {
        id: group.id,
        expanded: !(projectLayerConfig.defaultCollapsed as Record<string, boolean>)?.[group.id],
        title: group.title,
        description: group.description
      };
    });

    return {
      layers,
      groups,
      lastUpdated: new Date().toISOString()
    };
  }

  private isValidState(state: any): state is PersistedState {
    return (
      state &&
      typeof state === 'object' &&
      typeof state.layers === 'object' &&
      typeof state.groups === 'object' &&
      typeof state.lastUpdated === 'string'
    );
  }

  public saveState(state: PersistedState): void {
    try {
      const stateToSave = {
        ...state,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      this.state = stateToSave;
    } catch (error) {
      console.error('Error saving layer state:', error);
    }
  }

  public getState(): PersistedState {
    return this.state;
  }

  public updateLayerState(layerId: string, updates: Partial<LayerState>): void {
    if (this.state.layers[layerId]) {
      this.state.layers[layerId] = {
        ...this.state.layers[layerId],
        ...updates
      };
      this.saveState(this.state);
    }
  }

  public updateGroupState(groupId: string, updates: Partial<GroupState>): void {
    if (this.state.groups[groupId]) {
      this.state.groups[groupId] = {
        ...this.state.groups[groupId],
        ...updates
      };
      this.saveState(this.state);
    }
  }

  public resetToDefaults(): void {
    this.state = this.createDefaultState();
    this.saveState(this.state);
  }

  public clearState(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.state = this.createDefaultState();
  }
}

export const layerStatePersistence = LayerStatePersistence.getInstance(); 