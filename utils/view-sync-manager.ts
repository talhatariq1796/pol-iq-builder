import { MapView } from '@/types/map';
import { LayerErrorHandler } from './layer-error-handler';
import { __esri } from '@/types/esri';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';

interface SyncConfig {
  enabled: boolean;
  syncExtent: boolean;
  syncRotation: boolean;
  syncZoom: boolean;
  syncLayers: boolean;
  syncTime: boolean;
  syncSelection: boolean;
  syncPopups: boolean;
}

export class ViewSyncManager {
  private static instance: ViewSyncManager;
  private views: Map<string, MapView> = new Map();
  private syncConfigs: Map<string, SyncConfig> = new Map();
  private errorHandler: LayerErrorHandler;

  private constructor() {
    this.errorHandler = LayerErrorHandler.getInstance();
  }

  public static getInstance(): ViewSyncManager {
    if (!ViewSyncManager.instance) {
      ViewSyncManager.instance = new ViewSyncManager();
    }
    return ViewSyncManager.instance;
  }

  public registerView(view: MapView): void {
    if (!view || !view.id) {
      throw new Error('Invalid view provided for registration');
    }

    this.views.set(view.id, view);
    this.setupViewListeners(view);
  }

  public unregisterView(viewId: string): void {
    const view = this.views.get(viewId);
    if (view) {
      this.removeViewListeners(view);
      this.views.delete(viewId);
      this.syncConfigs.delete(viewId);
    }
  }

  public updateViewSyncConfig(viewId: string, config: SyncConfig): void {
    if (!this.views.has(viewId)) {
      throw new Error(`View with ID ${viewId} not found`);
    }

    this.syncConfigs.set(viewId, config);
    this.syncViews(viewId);
  }

  public clearSyncConfig(viewId: string): void {
    this.syncConfigs.delete(viewId);
  }

  private setupViewListeners(view: MapView): void {
    if (!view) return;

    // Extent change listener
    view.watch('extent', () => {
      if (this.syncConfigs.get(view.id)?.syncExtent) {
        this.syncExtent(view);
      }
    });

    // Rotation change listener
    view.watch('rotation', () => {
      if (this.syncConfigs.get(view.id)?.syncRotation) {
        this.syncRotation(view);
      }
    });

    // Zoom level change listener
    view.watch('zoom', () => {
      if (this.syncConfigs.get(view.id)?.syncZoom) {
        this.syncZoom(view);
      }
    });

    // Layer visibility change listener
    reactiveUtils.watch(
      () => view.map.layers.length,
      () => {
      if (this.syncConfigs.get(view.id)?.syncLayers) {
        this.syncLayers(view);
        }
      }
    );

    // Time extent change listener
    if ('timeExtent' in view) {
      view.watch('timeExtent', () => {
        if (this.syncConfigs.get(view.id)?.syncTime) {
          this.syncTimeExtent(view);
        }
      });
    }

    // Selection change listener
    view.watch('popup.visible', () => {
      if (this.syncConfigs.get(view.id)?.syncPopups) {
        this.syncPopups(view);
      }
    });
  }

  private removeViewListeners(view: MapView): void {
    if (!view) return;

    // Remove all watchers
    // Note: view.removeAll() is not a standard method. Watch handles should be removed individually.
    // Since we don't store them in this class, this is a simplification.
    // A more robust implementation would store and remove each watch handle.
  }

  private syncViews(sourceViewId: string): void {
    const sourceView = this.views.get(sourceViewId);
    const sourceConfig = this.syncConfigs.get(sourceViewId);

    if (!sourceView || !sourceConfig || !sourceConfig.enabled) return;

    this.views.forEach((targetView, targetId) => {
      if (targetId === sourceViewId) return;

      const targetConfig = this.syncConfigs.get(targetId);
      if (!targetConfig || !targetConfig.enabled) return;

      try {
        if (sourceConfig.syncExtent && targetConfig.syncExtent) {
          this.syncExtent(sourceView, targetView);
        }

        if (sourceConfig.syncRotation && targetConfig.syncRotation) {
          this.syncRotation(sourceView, targetView);
        }

        if (sourceConfig.syncZoom && targetConfig.syncZoom) {
          this.syncZoom(sourceView, targetView);
        }

        if (sourceConfig.syncLayers && targetConfig.syncLayers) {
          this.syncLayers(sourceView, targetView);
        }

        if (sourceConfig.syncTime && targetConfig.syncTime) {
          this.syncTimeExtent(sourceView, targetView);
        }

        if (sourceConfig.syncPopups && targetConfig.syncPopups) {
          this.syncPopups(sourceView, targetView);
        }
      } catch (error) {
        this.errorHandler.handleValidationError('view-sync', error);
      }
    });
  }

  private syncExtent(sourceView: MapView, targetView?: MapView): void {
    if (!targetView) {
      this.views.forEach(view => {
        if (view.id !== sourceView.id) {
          view.extent = sourceView.extent;
        }
      });
    } else {
      targetView.extent = sourceView.extent;
    }
  }

  private syncRotation(sourceView: MapView, targetView?: MapView): void {
    if (!targetView) {
      this.views.forEach(view => {
        if (view.id !== sourceView.id) {
          view.rotation = sourceView.rotation;
        }
      });
    } else {
      targetView.rotation = sourceView.rotation;
    }
  }

  private syncZoom(sourceView: MapView, targetView?: MapView): void {
    if (!targetView) {
      this.views.forEach(view => {
        if (view.id !== sourceView.id) {
          view.zoom = sourceView.zoom;
        }
      });
    } else {
      targetView.zoom = sourceView.zoom;
    }
  }

  private syncLayers(sourceView: MapView, targetView?: MapView): void {
    if (!targetView) {
      this.views.forEach(view => {
        if (view.id !== sourceView.id) {
          sourceView.map.layers.forEach((sourceLayer: __esri.Layer) => {
            const targetLayer = view.map.findLayerById(sourceLayer.id);
            if (targetLayer) {
              targetLayer.visible = sourceLayer.visible;
            }
          });
        }
      });
    } else {
      sourceView.map.layers.forEach((sourceLayer: __esri.Layer) => {
        const targetLayer = targetView.map.findLayerById(sourceLayer.id);
        if (targetLayer) {
          targetLayer.visible = sourceLayer.visible;
        }
      });
    }
  }

  private syncTimeExtent(sourceView: MapView, targetView?: MapView): void {
    if (!('timeExtent' in sourceView)) return;

    const timeExtent = (sourceView as any).timeExtent;
    if (!targetView) {
      this.views.forEach(view => {
        if (view.id !== sourceView.id && 'timeExtent' in view) {
          (view as any).timeExtent = timeExtent;
        }
      });
    } else if ('timeExtent' in targetView) {
      (targetView as any).timeExtent = timeExtent;
    }
  }

  private syncPopups(sourceView: MapView, targetView?: MapView): void {
    const popupVisible = sourceView.popup?.visible;
    if (!targetView) {
      this.views.forEach(view => {
        if (view.id !== sourceView.id) {
          view.popup.visible = popupVisible;
        }
      });
    } else {
      targetView.popup.visible = popupVisible;
    }
  }
} 