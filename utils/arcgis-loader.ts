import dynamic from 'next/dynamic';

// Direct imports for ArcGIS modules
import MapView from '@arcgis/core/views/MapView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Query from '@arcgis/core/rest/support/Query';
import Extent from '@arcgis/core/geometry/Extent';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import Color from '@arcgis/core/Color';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Legend from '@arcgis/core/widgets/Legend';
import Search from '@arcgis/core/widgets/Search';
import Print from '@arcgis/core/widgets/Print';
import Bookmarks from '@arcgis/core/widgets/Bookmarks';
import FeatureTable from '@arcgis/core/widgets/FeatureTable';
import LayerList from '@arcgis/core/widgets/LayerList';
import Draw from '@arcgis/core/views/draw/Draw';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import * as projection from '@arcgis/core/geometry/projection';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Polyline from '@arcgis/core/geometry/Polyline';
import FeatureFilter from '@arcgis/core/layers/support/FeatureFilter';
import FeatureEffect from '@arcgis/core/layers/support/FeatureEffect';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import Layer from '@arcgis/core/layers/Layer';
import Field from '@arcgis/core/layers/support/Field';
import Collection from '@arcgis/core/core/Collection';
import { whenOnce } from '@arcgis/core/core/reactiveUtils';
import IHandle from '@arcgis/core/core/Handles';
import Camera from '@arcgis/core/Camera';
import Viewpoint from '@arcgis/core/Viewpoint';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import esriConfig from '@arcgis/core/config';

// Dynamic component wrapper for components using ArcGIS
export const withArcGIS = (Component: React.ComponentType<any>) => {
  return dynamic(() => Promise.resolve(Component), {
    ssr: false,
  });
};

// Export all modules
export {
  MapView,
  FeatureLayer,
  GraphicsLayer,
  Graphic,
  Query,
  Extent,
  SimpleRenderer,
  SimpleMarkerSymbol,
  SimpleFillSymbol,
  SimpleLineSymbol,
  Color,
  PopupTemplate,
  Legend,
  Search,
  Print,
  Bookmarks,
  FeatureTable,
  LayerList,
  Draw,
  geometryEngine,
  projection,
  SpatialReference,
  Point,
  Polygon,
  Polyline,
  FeatureFilter,
  FeatureEffect,
  ClassBreaksRenderer,
  UniqueValueRenderer,
  Layer,
  Field,
  Collection,
  whenOnce,
  IHandle,
  Camera,
  Viewpoint,
  FeatureSet,
  esriConfig
}; 