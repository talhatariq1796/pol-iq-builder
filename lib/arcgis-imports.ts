// Centralized ArcGIS imports
export const loadArcGISModules = async () => {
  // Import intl first to set locale before loading any widgets
  const intl = await import('@arcgis/core/intl');
  intl.setLocale("en");
  
  const [
    Map,
    MapView,
    VectorTileLayer,
    Basemap,
    esriConfig,
    Color,
    Graphic,
    Point,
    PopupTemplate,
    FeatureLayer,
    Home,
    Zoom,
    Extent,
    SpatialReference
  ] = await Promise.all([
    import('@arcgis/core/Map'),
    import('@arcgis/core/views/MapView'),
    import('@arcgis/core/layers/VectorTileLayer'),
    import('@arcgis/core/Basemap'),
    import('@arcgis/core/config'),
    import('@arcgis/core/Color'),
    import('@arcgis/core/Graphic'),
    import('@arcgis/core/geometry/Point'),
    import('@arcgis/core/PopupTemplate'),
    import('@arcgis/core/layers/FeatureLayer'),
    import('@arcgis/core/widgets/Home'),
    import('@arcgis/core/widgets/Zoom'),
    import('@arcgis/core/geometry/Extent'),
    import('@arcgis/core/geometry/SpatialReference')
  ]);

  return {
    Map: Map.default,
    MapView: MapView.default,
    VectorTileLayer: VectorTileLayer.default,
    Basemap: Basemap.default,
    esriConfig: esriConfig.default,
    Color: Color.default,
    Graphic: Graphic.default,
    Point: Point.default,
    PopupTemplate: PopupTemplate.default,
    FeatureLayer: FeatureLayer.default,
    Home: Home.default,
    Zoom: Zoom.default,
    Extent: Extent.default,
    SpatialReference: SpatialReference.default
  };
}; 