"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LayerProviderFactory = exports.layerRegistry = exports.visualizationTypesConfig = exports.VisualizationType = void 0;
exports.initializeLayerRegistry = initializeLayerRegistry;
const layers_1 = require("../config/layers");
/**
 * Enum defining all supported visualization types
 * This should be used instead of hardcoded strings throughout the application
 */
var VisualizationType;
(function (VisualizationType) {
    VisualizationType["CHOROPLETH"] = "choropleth";
    VisualizationType["HEATMAP"] = "heatmap";
    VisualizationType["SCATTER"] = "scatter";
    VisualizationType["CLUSTER"] = "cluster";
    VisualizationType["CATEGORICAL"] = "categorical";
    VisualizationType["TRENDS"] = "trends";
    VisualizationType["CORRELATION"] = "correlation";
    VisualizationType["JOINT_HIGH"] = "joint_high";
    VisualizationType["PROPORTIONAL_SYMBOL"] = "proportional_symbol";
    VisualizationType["COMPARISON"] = "comparison";
    VisualizationType["TOP_N"] = "top_n";
    VisualizationType["HEXBIN"] = "hexbin";
    VisualizationType["BIVARIATE"] = "bivariate";
    VisualizationType["BUFFER"] = "buffer";
    VisualizationType["HOTSPOT"] = "hotspot";
    VisualizationType["NETWORK"] = "network";
    VisualizationType["MULTIVARIATE"] = "multivariate";
    VisualizationType["OUTLIER"] = "outlier";
    VisualizationType["SCENARIO"] = "scenario";
    VisualizationType["INTERACTION"] = "interaction";
    VisualizationType["BUBBLE"] = "bubble";
    VisualizationType["ISOLINE"] = "isoline";
    VisualizationType["FLOW"] = "flow";
    VisualizationType["TEMPORAL"] = "temporal";
    VisualizationType["COMPARATIVE"] = "comparative";
    VisualizationType["THRESHOLD"] = "threshold";
    VisualizationType["SEGMENT"] = "segment";
    VisualizationType["COMPARATIVE_ANALYSIS"] = "comparative_analysis";
    VisualizationType["CROSS_GEOGRAPHY_CORRELATION"] = "cross_geography_correlation";
    VisualizationType["DENSITY"] = "density";
    VisualizationType["TIME_SERIES"] = "time_series";
    VisualizationType["PROXIMITY"] = "proximity";
    VisualizationType["COMPOSITE"] = "composite";
    VisualizationType["OVERLAY"] = "overlay";
    VisualizationType["AGGREGATION"] = "aggregation";
    VisualizationType["SINGLE_LAYER"] = "single_layer";
    VisualizationType["POINT_LAYER"] = "point_layer";
})(VisualizationType || (exports.VisualizationType = VisualizationType = {}));
/**
 * Configuration for visualization types
 * Provides default settings and metadata for each type
 */
exports.visualizationTypesConfig = {
    [VisualizationType.CHOROPLETH]: {
        label: 'Choropleth Map',
        description: 'Shows values across geographic areas using color intensity',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'Blues',
            classes: 5,
            classification: 'quantile'
        },
        aiQueryPatterns: [
            'Show me {field} by {region}',
            'Display {field} across {regions}',
            'Visualize {field} distribution'
        ]
    },
    [VisualizationType.HEATMAP]: {
        label: 'Heat Map',
        description: 'Shows density of points using a heat gradient',
        requiresFields: 0,
        supportsGeometryTypes: ['point'],
        supportsLayerTypes: ['point'],
        defaultSymbology: {
            radius: 25,
            colorScheme: 'Reds'
        },
        aiQueryPatterns: [
            'Show density of {points}',
            'Heat map of {points}',
            'Where are {points} concentrated'
        ]
    },
    [VisualizationType.SCATTER]: {
        label: 'Scatter Plot',
        description: 'Shows points with optional size and color encoding',
        requiresFields: 1,
        supportsGeometryTypes: ['point'],
        supportsLayerTypes: ['point', 'index'],
        defaultSymbology: {
            size: 8,
            color: '#1f77b4',
            outlineWidth: 0.5,
            outlineColor: '#ffffff'
        },
        aiQueryPatterns: [
            'Plot {points} on the map',
            'Show locations of {points}',
            'Map all {points}'
        ]
    },
    [VisualizationType.CLUSTER]: {
        label: 'Cluster Map',
        description: 'Groups nearby points into clusters',
        requiresFields: 0,
        supportsGeometryTypes: ['point'],
        supportsLayerTypes: ['point'],
        defaultSymbology: {
            clusterRadius: 50,
            clusterMinSize: 10,
            clusterMaxSize: 25,
            colors: ['#1f77b4', '#ff7f0e', '#2ca02c']
        },
        aiQueryPatterns: [
            'Cluster {points} on the map',
            'Group {points} by location',
            'Show clusters of {points}'
        ]
    },
    [VisualizationType.CATEGORICAL]: {
        label: 'Categorical Map',
        description: 'Colors features based on categories',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon', 'point'],
        supportsLayerTypes: ['index', 'point'],
        defaultSymbology: {
            colorScheme: 'Category10',
            outlineWidth: 0.5,
            outlineColor: '#ffffff'
        },
        aiQueryPatterns: [
            'Show {field} by category',
            'Categorize {regions} by {field}',
            'Color {regions} by {field} type'
        ]
    },
    [VisualizationType.TRENDS]: {
        label: 'Trends Map',
        description: 'Shows temporal trends across geography',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'RdBu',
            classes: 7,
            classification: 'standard-deviation'
        },
        aiQueryPatterns: [
            'Show trends in {field}',
            'How has {field} changed over time',
            'Temporal patterns of {field}'
        ]
    },
    [VisualizationType.CORRELATION]: {
        label: 'Correlation Map',
        description: 'Shows the relationship between two variables',
        requiresFields: 2,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'RdBu',
            classes: 5,
            classification: 'natural-breaks'
        },
        aiQueryPatterns: [
            'Compare {field1} with {field2}',
            'Relationship between {field1} and {field2}',
            'Correlation of {field1} and {field2}'
        ]
    },
    [VisualizationType.JOINT_HIGH]: {
        label: 'Joint High Analysis',
        description: 'Identifies areas where multiple indicators are high',
        requiresFields: 2,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage'],
        defaultSymbology: {
            highColor: '#ff0000',
            midColor: '#ffff00',
            lowColor: '#ffffff',
            outlineColor: '#000000'
        },
        aiQueryPatterns: [
            'Where are both {field1} and {field2} high',
            'Areas with high {field1} and high {field2}',
            'Joint high values of {field1} and {field2}'
        ]
    },
    [VisualizationType.PROPORTIONAL_SYMBOL]: {
        label: 'Proportional Symbol',
        description: 'Shows values through symbol size',
        requiresFields: 1,
        supportsGeometryTypes: ['point', 'polygon'],
        supportsLayerTypes: ['index', 'feature-service'],
        defaultSymbology: {
            minSize: 5,
            maxSize: 50,
            color: '#1f77b4',
            shape: 'circle'
        },
        aiQueryPatterns: [
            'Show {field} with symbol size',
            'Proportional symbols of {field}',
            'Bubble map of {field}'
        ]
    },
    [VisualizationType.COMPARISON]: {
        label: 'Comparison Map',
        description: 'Compares values against a benchmark',
        requiresFields: 2,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage'],
        defaultSymbology: {
            colorScheme: 'RdYlBu',
            classes: 5,
            classification: 'standard-deviation'
        },
        aiQueryPatterns: [
            'Compare {field1} to {field2}',
            'Difference between {field1} and {field2}',
            'How does {field1} compare to average'
        ]
    },
    [VisualizationType.OUTLIER]: {
        label: 'Outlier Detection',
        description: 'Identifies statistically unusual areas and explains what makes them outliers',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon', 'point'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            outlierColor: '#ff0000',
            normalColor: '#cccccc',
            highlightColor: '#ff6600',
            outlineColor: '#000000'
        },
        aiQueryPatterns: [
            'What areas are unusual outliers for {field}',
            'Show me anomalous regions with {field}',
            'Which areas stand out as different',
            'Find outliers in {field} data'
        ]
    },
    [VisualizationType.SCENARIO]: {
        label: 'Scenario Analysis',
        description: 'Models what-if scenarios and predicts impacts of changes',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon', 'point'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            baselineColor: '#cccccc',
            improvementColor: '#00ff00',
            declineColor: '#ff0000',
            outlineColor: '#000000'
        },
        aiQueryPatterns: [
            'What if {field} increased by {percent}%',
            'How would {field} change if {condition}',
            'Simulate {percent}% increase in {field}',
            'What would happen if {field} improved'
        ]
    },
    [VisualizationType.INTERACTION]: {
        label: 'Feature Interaction',
        description: 'Analyzes how variables work together and their combined effects',
        requiresFields: 2,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            synergyColor: '#00ff00',
            antagonistColor: '#ff0000',
            neutralColor: '#ffff00',
            outlineColor: '#000000'
        },
        aiQueryPatterns: [
            'How do {field1} and {field2} work together',
            'What combinations of {field1} and {field2} amplify effects',
            'Interaction between {field1} and {field2}',
            'Combined effect of {field1} and {field2}'
        ]
    },
    [VisualizationType.BUBBLE]: {
        label: 'Bubble Map',
        description: 'Shows values through bubble size',
        requiresFields: 1,
        supportsGeometryTypes: ['point'],
        supportsLayerTypes: ['point'],
        defaultSymbology: {
            size: 8,
            color: '#1f77b4',
            outlineWidth: 0.5,
            outlineColor: '#ffffff'
        },
        aiQueryPatterns: [
            'Show {field} with bubble size',
            'Bubble map of {field}',
            'Bubble chart of {field}'
        ]
    },
    [VisualizationType.ISOLINE]: {
        label: 'Isoline Map',
        description: 'Shows values along lines',
        requiresFields: 1,
        supportsGeometryTypes: ['polyline'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'Blues',
            classes: 5,
            classification: 'quantile'
        },
        aiQueryPatterns: [
            'Show isolines of {field}',
            'Isoline map of {field}',
            'Isoline chart of {field}'
        ]
    },
    [VisualizationType.FLOW]: {
        label: 'Flow Map',
        description: 'Shows movement between areas',
        requiresFields: 1,
        supportsGeometryTypes: ['polyline'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'Blues',
            classes: 5,
            classification: 'quantile'
        },
        aiQueryPatterns: [
            'Show flow between {field}',
            'Flow map of {field}',
            'Flow chart of {field}'
        ]
    },
    [VisualizationType.TEMPORAL]: {
        label: 'Temporal Map',
        description: 'Shows values over time',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'RdBu',
            classes: 7,
            classification: 'standard-deviation'
        },
        aiQueryPatterns: [
            'Show trends in {field}',
            'How has {field} changed over time',
            'Temporal patterns of {field}'
        ]
    },
    [VisualizationType.COMPARATIVE]: {
        label: 'Comparative Map',
        description: 'Compares values between different groups or categories',
        requiresFields: 2,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage'],
        defaultSymbology: {
            colorScheme: 'RdYlBu',
            classes: 5,
            classification: 'standard-deviation'
        },
        aiQueryPatterns: [
            'Compare {field1} to {field2}',
            'Difference between {field1} and {field2}',
            'How does {field1} compare to {field2}'
        ]
    },
    [VisualizationType.THRESHOLD]: {
        label: 'Threshold Analysis',
        description: 'Identifies critical thresholds and inflection points',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: {
                type: 'sequential',
                colors: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'],
                stops: [0, 0.25, 0.5, 0.75, 1.0]
            },
            symbolConfig: {
                type: 'simple-marker',
                style: 'circle',
                size: 8,
                outline: {
                    color: [255, 255, 255, 0.8],
                    width: 1
                }
            },
            legendConfig: {
                title: 'Threshold Impact',
                type: 'gradient',
                showLabels: true,
                precision: 2
            },
            queryPatterns: [
                'threshold analysis',
                'critical level',
                'inflection point',
                'at what level',
                'break point'
            ],
            useCases: [
                'Income thresholds for approval rates',
                'Critical population density levels',
                'Performance tipping points'
            ]
        },
        aiQueryPatterns: [
            'threshold analysis',
            'critical level',
            'inflection point',
            'at what level',
            'break point'
        ]
    },
    [VisualizationType.SEGMENT]: {
        label: 'Segment Profiling',
        description: 'Profiles and characterizes different segments',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: {
                type: 'categorical',
                colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'],
                stops: []
            },
            symbolConfig: {
                type: 'simple-marker',
                style: 'circle',
                size: 10,
                outline: {
                    color: [255, 255, 255, 0.9],
                    width: 2
                }
            },
            legendConfig: {
                title: 'Segment Profile',
                type: 'categorical',
                showLabels: true,
                showCounts: true
            },
            queryPatterns: [
                'segment profiling',
                'what characterizes',
                'profile of',
                'high performing',
                'segment characteristics'
            ],
            useCases: [
                'High vs low performing areas',
                'Customer segment profiles',
                'Demographic group characteristics'
            ]
        },
        aiQueryPatterns: [
            'segment profiling',
            'what characterizes',
            'profile of',
            'high performing',
            'segment characteristics'
        ]
    },
    [VisualizationType.COMPARATIVE_ANALYSIS]: {
        label: 'Comparative Analysis',
        description: 'Compares different groups or categories',
        requiresFields: 2,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage'],
        defaultSymbology: {
            colorScheme: {
                type: 'diverging',
                colors: ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4'],
                stops: []
            },
            symbolConfig: {
                type: 'simple-marker',
                style: 'diamond',
                size: 9,
                outline: {
                    color: [0, 0, 0, 0.7],
                    width: 1.5
                }
            },
            legendConfig: {
                title: 'Group Comparison',
                type: 'categorical',
                showLabels: true,
                showPercentages: true
            },
            queryPatterns: [
                'comparative analysis',
                'compare groups',
                'urban vs rural',
                'difference between',
                'group comparison'
            ],
            useCases: [
                'Urban vs rural comparison',
                'Regional performance differences',
                'Demographic group comparisons'
            ]
        },
        aiQueryPatterns: [
            'comparative analysis',
            'compare groups',
            'urban vs rural',
            'difference between',
            'group comparison'
        ]
    },
    [VisualizationType.TOP_N]: {
        label: 'Top N Analysis',
        description: 'Shows the top performing areas by a specific metric',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'Oranges',
            classes: 5,
            classification: 'quantile'
        },
        aiQueryPatterns: [
            'top {n} areas by {field}',
            'highest {n} regions for {field}',
            'best performing {n} locations'
        ]
    },
    [VisualizationType.HEXBIN]: {
        label: 'Hexbin Map',
        description: 'Aggregates point data into hexagonal bins',
        requiresFields: 1,
        supportsGeometryTypes: ['point'],
        supportsLayerTypes: ['point'],
        defaultSymbology: {
            colorScheme: 'Blues',
            binSize: 50,
            aggregationType: 'count'
        },
        aiQueryPatterns: [
            'hexbin map of {points}',
            'aggregate {points} into hexagons',
            'hexagonal binning of {data}'
        ]
    },
    [VisualizationType.BIVARIATE]: {
        label: 'Bivariate Map',
        description: 'Shows the relationship between two variables using color mixing',
        requiresFields: 2,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'bivariate',
            classes: 9,
            classification: 'quantile'
        },
        aiQueryPatterns: [
            'bivariate map of {field1} and {field2}',
            'two-variable map showing {field1} and {field2}',
            'combined visualization of {field1} and {field2}'
        ]
    },
    [VisualizationType.BUFFER]: {
        label: 'Buffer Analysis',
        description: 'Shows areas within a specified distance of features',
        requiresFields: 0,
        supportsGeometryTypes: ['point', 'polyline', 'polygon'],
        supportsLayerTypes: ['point', 'feature-service'],
        defaultSymbology: {
            bufferColor: '#0066cc',
            bufferOpacity: 0.3,
            outlineColor: '#003d7a'
        },
        aiQueryPatterns: [
            'areas within {distance} of {features}',
            'buffer around {features}',
            '{distance} mile radius from {features}'
        ]
    },
    [VisualizationType.HOTSPOT]: {
        label: 'Hotspot Analysis',
        description: 'Identifies statistically significant spatial clusters',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon', 'point'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            hotColor: '#ff0000',
            coldColor: '#0000ff',
            neutralColor: '#cccccc'
        },
        aiQueryPatterns: [
            'hotspots of {field}',
            'spatial clusters of {field}',
            'significant clusters in {field}'
        ]
    },
    [VisualizationType.NETWORK]: {
        label: 'Network Analysis',
        description: 'Shows connections and relationships between locations',
        requiresFields: 1,
        supportsGeometryTypes: ['polyline', 'point'],
        supportsLayerTypes: ['feature-service'],
        defaultSymbology: {
            nodeColor: '#0066cc',
            edgeColor: '#666666',
            nodeSize: 8
        },
        aiQueryPatterns: [
            'network of {connections}',
            'connections between {locations}',
            'relationship network of {features}'
        ]
    },
    [VisualizationType.MULTIVARIATE]: {
        label: 'Multivariate Analysis',
        description: 'Analyzes multiple variables simultaneously',
        requiresFields: 3,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'Spectral',
            classes: 7,
            classification: 'natural-breaks'
        },
        aiQueryPatterns: [
            'multivariate analysis of {fields}',
            'multiple variables {field1}, {field2}, {field3}',
            'combined analysis of several factors'
        ]
    },
    [VisualizationType.CROSS_GEOGRAPHY_CORRELATION]: {
        label: 'Cross-Geography Correlation',
        description: 'Shows correlations across different geographic levels',
        requiresFields: 2,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage'],
        defaultSymbology: {
            colorScheme: 'RdBu',
            classes: 7,
            classification: 'standard-deviation'
        },
        aiQueryPatterns: [
            'correlation across {geography1} and {geography2}',
            'cross-geographic relationship between {field1} and {field2}'
        ]
    },
    [VisualizationType.DENSITY]: {
        label: 'Density Map',
        description: 'Shows the density distribution of features',
        requiresFields: 0,
        supportsGeometryTypes: ['point'],
        supportsLayerTypes: ['point'],
        defaultSymbology: {
            colorScheme: 'Reds',
            radius: 30,
            blur: 15
        },
        aiQueryPatterns: [
            'density of {points}',
            'concentration of {features}',
            'density distribution of {data}'
        ]
    },
    [VisualizationType.TIME_SERIES]: {
        label: 'Time Series Map',
        description: 'Shows changes over time',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'Viridis',
            classes: 5,
            classification: 'quantile'
        },
        aiQueryPatterns: [
            'time series of {field}',
            'changes in {field} over time',
            'temporal analysis of {field}'
        ]
    },
    [VisualizationType.PROXIMITY]: {
        label: 'Proximity Analysis',
        description: 'Analyzes spatial relationships and distances',
        requiresFields: 1,
        supportsGeometryTypes: ['point', 'polygon'],
        supportsLayerTypes: ['point', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'Purples',
            classes: 5,
            classification: 'natural-breaks'
        },
        aiQueryPatterns: [
            'proximity to {features}',
            'distance to {locations}',
            'near to {points}'
        ]
    },
    [VisualizationType.COMPOSITE]: {
        label: 'Composite Visualization',
        description: 'Combines multiple visualization techniques',
        requiresFields: 2,
        supportsGeometryTypes: ['polygon', 'point'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'Set3',
            classes: 8,
            classification: 'quantile'
        },
        aiQueryPatterns: [
            'composite view of {fields}',
            'combined visualization',
            'multiple techniques for {data}'
        ]
    },
    [VisualizationType.OVERLAY]: {
        label: 'Overlay Analysis',
        description: 'Overlays multiple data layers for analysis',
        requiresFields: 2,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['feature-service'],
        defaultSymbology: {
            colorScheme: 'Paired',
            opacity: 0.7,
            classes: 6
        },
        aiQueryPatterns: [
            'overlay {layer1} with {layer2}',
            'combine {data1} and {data2}',
            'layer {field1} over {field2}'
        ]
    },
    [VisualizationType.AGGREGATION]: {
        label: 'Aggregation Analysis',
        description: 'Aggregates data at different geographic levels',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service'],
        defaultSymbology: {
            colorScheme: 'YlOrRd',
            classes: 5,
            classification: 'quantile'
        },
        aiQueryPatterns: [
            'aggregate {field} by {geography}',
            'sum {field} by region',
            'total {field} by area'
        ]
    },
    [VisualizationType.SINGLE_LAYER]: {
        label: 'Single Layer Display',
        description: 'Displays a single data layer',
        requiresFields: 1,
        supportsGeometryTypes: ['polygon', 'point', 'polyline'],
        supportsLayerTypes: ['index', 'percentage', 'feature-service', 'point'],
        defaultSymbology: {
            colorScheme: 'Blues',
            classes: 5,
            classification: 'quantile'
        },
        aiQueryPatterns: [
            'show {field}',
            'display {layer}',
            'map {data}'
        ]
    },
    [VisualizationType.POINT_LAYER]: {
        label: 'Point Layer Display',
        description: 'Displays point data with styling',
        requiresFields: 1,
        supportsGeometryTypes: ['point'],
        supportsLayerTypes: ['point'],
        defaultSymbology: {
            color: '#0066cc',
            size: 8,
            outlineColor: '#ffffff'
        },
        aiQueryPatterns: [
            'show points for {field}',
            'display {points}',
            'map {point_data}'
        ]
    }
};
/**
 * Layer registry for dynamic configuration
 * Central registry for layer configurations and providers
 */
class LayerRegistry {
    constructor() {
        this.providers = new Map();
        this.layerConfigs = new Map();
    }
    // Register a layer provider
    registerProvider(provider) {
        this.providers.set(provider.id, provider);
    }
    // Get a provider by ID
    getProvider(id) {
        return this.providers.get(id);
    }
    // Register a layer config
    registerLayerConfig(id, config) {
        this.layerConfigs.set(id, config);
    }
    // Get a layer config by ID
    getLayerConfig(id) {
        return this.layerConfigs.get(id);
    }
    // Get all layer configs
    getAllLayerConfigs() {
        return this.layerConfigs;
    }
    // Get all layer configs as array
    getLayerConfigsArray() {
        return Array.from(this.layerConfigs.values());
    }
    // Find layers matching criteria
    findLayers(criteria) {
        return this.getLayerConfigsArray().filter(config => {
            return Object.entries(criteria).every(([key, value]) => {
                return config[key] === value;
            });
        });
    }
    // Find layer best matching a query using semantic matching
    async findLayerForQuery(query) {
        var _a, _b, _c, _d;
        try {
            // This would be implemented with existing layer matching logic
            // For now, return a placeholder implementation
            const matches = [];
            // Simple keyword matching - would be replaced with actual implementation
            const layerConfigs = this.getLayerConfigsArray();
            for (const config of layerConfigs) {
                // Check if any tags or name match keywords in query
                const configName = ((_a = config.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                const configDesc = ((_b = config.description) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                const configTags = ((_d = (_c = config.metadata) === null || _c === void 0 ? void 0 : _c.tags) === null || _d === void 0 ? void 0 : _d.map((t) => t.toLowerCase())) || [];
                const queryLower = query.toLowerCase();
                const nameMatch = configName && queryLower.includes(configName);
                const descMatch = configDesc && configDesc.split(' ').some(word => queryLower.includes(word) && word.length > 3);
                const tagMatch = configTags.some((tag) => queryLower.includes(tag));
                if (nameMatch || descMatch || tagMatch) {
                    matches.push({
                        layerId: String(config.id),
                        relevance: nameMatch ? 0.9 : (tagMatch ? 0.7 : 0.5),
                        reasons: [
                            nameMatch ? `Name match: ${configName}` : '',
                            tagMatch ? `Tag match in: ${configTags.join(', ')}` : '',
                            descMatch ? 'Description match' : ''
                        ].filter(Boolean),
                        matchMethod: 'rules',
                        confidence: nameMatch ? 0.9 : (tagMatch ? 0.7 : 0.5)
                    });
                }
            }
            return matches.sort((a, b) => b.relevance - a.relevance);
        }
        catch (error) {
            console.error('Error in findLayerForQuery:', error);
            return []; // Return empty array on error
        }
    }
    // Suggest visualization type based on query and selected layer
    suggestVisualizationType(query, layerId) {
        var _a, _b;
        const layerConfig = this.getLayerConfig(layerId);
        if (!layerConfig) {
            return VisualizationType.CHOROPLETH; // Default if no config
        }
        // Example: Simple keyword matching for visualization types
        const queryLower = query.toLowerCase();
        for (const [vizType, metadata] of Object.entries(exports.visualizationTypesConfig)) {
            if (metadata.aiQueryPatterns.some(pattern => queryLower.includes(pattern.split(' ')[0]))) {
                // Basic check, more sophisticated NLP would be needed here
                // Also check if layer supports this visualization type
                if ((_b = (_a = layerConfig.analysis) === null || _a === void 0 ? void 0 : _a.supportedVisualizationTypes) === null || _b === void 0 ? void 0 : _b.includes(vizType)) {
                    return vizType;
                }
            }
        }
        // Additional specific checks
        if (queryLower.includes('compare') || queryLower.includes('relationship') ||
            queryLower.includes('correlation')) {
            return VisualizationType.CORRELATION;
        }
        if (queryLower.includes('trend') || queryLower.includes('change over time')) {
            return VisualizationType.TRENDS;
        }
        if (queryLower.includes('both high') || queryLower.includes('joint')) {
            return VisualizationType.JOINT_HIGH;
        }
        if (queryLower.includes('heat') || queryLower.includes('density')) {
            return VisualizationType.HEATMAP;
        }
        if (queryLower.includes('cluster') || queryLower.includes('group')) {
            return VisualizationType.CLUSTER;
        }
        if (queryLower.includes('category') || queryLower.includes('type')) {
            return VisualizationType.CATEGORICAL;
        }
        // Default based on geometry type
        const geometryType = layerConfig.geometryType;
        if ((geometryType === null || geometryType === void 0 ? void 0 : geometryType.toLowerCase()) === 'point') {
            return VisualizationType.SCATTER;
        }
        // Default fallback
        return VisualizationType.CHOROPLETH;
    }
    // Load layer configuration from external source 
    async loadConfigFromSource(source) {
        try {
            // This would fetch from API, file, database, etc.
            const configs = await fetch(source).then(res => res.json());
            configs.forEach((config) => {
                this.registerLayerConfig(config.id.toString(), config);
            });
        }
        catch (error) {
            console.error('Failed to load layer configurations from source:', source, error);
        }
    }
    // Initialize with existing layer configs
    initializeWithExistingConfigs(layerConfigs) {
        Object.entries(layerConfigs).forEach(([id, config]) => {
            this.registerLayerConfig(id, config);
        });
        console.log(`Initialized registry with ${this.layerConfigs.size} layer configurations`);
    }
}
// Create singleton instance
exports.layerRegistry = new LayerRegistry();
// Function to initialize the registry with configs
async function initializeLayerRegistry(existingConfigs, configSource) {
    // If existing configs provided, load them
    if (existingConfigs) {
        exports.layerRegistry.initializeWithExistingConfigs(existingConfigs);
    }
    // If config source provided, load from there
    if (configSource) {
        await exports.layerRegistry.loadConfigFromSource(configSource);
    }
    // If neither provided, load from baseLayerConfigs imported from config/layers
    if (!existingConfigs && !configSource) {
        const configsAsRecord = {};
        if (layers_1.baseLayerConfigs && Array.isArray(layers_1.baseLayerConfigs)) {
            layers_1.baseLayerConfigs.forEach(config => {
                if (config && config.id != null) { // Check config and id are not null/undefined
                    configsAsRecord[String(config.id)] = config;
                }
            });
        }
        exports.layerRegistry.initializeWithExistingConfigs(configsAsRecord);
    }
}
// Factory for creating layer providers
class LayerProviderFactory {
    static createProvider(type, config) {
        switch (type) {
            case 'feature-service':
                return new FeatureServiceProvider(config);
            case 'geojson':
                return new GeoJSONProvider(config);
            case 'virtual':
                return new VirtualLayerProvider(config);
            default:
                throw new Error(`Unsupported provider type: ${type}`);
        }
    }
}
exports.LayerProviderFactory = LayerProviderFactory;
// Provider implementation for Feature Services
class FeatureServiceProvider {
    constructor(config) {
        this.id = config.id;
        this.name = config.name || config.id;
        this.description = config.description || '';
        this.supportedVisualizationTypes = config.supportedVisualizationTypes || Object.values(VisualizationType);
        this.config = config;
    }
    async load(options) {
        // Implementation using the existing executeQuery logic
        // This would be connected to the actual executeQuery in the component
        return {
            layerId: this.id,
            layerName: this.name,
            esriLayer: null, // This would be populated with actual layer
            features: [],
            extent: null,
            layerType: 'feature'
        };
    }
    async getFields() {
        // This would be implemented using existing field fetching logic
        return [];
    }
    async executeQuery(query, options) {
        // This would be implemented using existing query execution logic
        return {};
    }
    async createVisualization(type, options) {
        // This would be implemented using visualization creation logic
        return {
            layerId: this.id,
            esriLayer: null, // This would be the actual visualization layer
            extent: null,
            features: []
        };
    }
}
// Provider implementation for GeoJSON
class GeoJSONProvider {
    constructor(config) {
        this.id = config.id;
        this.name = config.name || config.id;
        this.description = config.description || '';
        this.supportedVisualizationTypes = config.supportedVisualizationTypes || Object.values(VisualizationType);
        this.config = config;
    }
    async load(options) {
        return {
            layerId: this.id,
            layerName: this.name,
            esriLayer: null,
            features: [],
            extent: null,
            layerType: 'geojson'
        };
    }
    async getFields() {
        return [];
    }
    async executeQuery(query, options) {
        return {};
    }
    async createVisualization(type, options) {
        return {
            layerId: this.id,
            esriLayer: null,
            extent: null,
            features: []
        };
    }
}
// Provider implementation for Virtual Layers
class VirtualLayerProvider {
    constructor(config) {
        this.id = config.id;
        this.name = config.name || config.id;
        this.description = config.description || '';
        this.supportedVisualizationTypes = config.supportedVisualizationTypes || Object.values(VisualizationType);
        this.config = config;
        this.virtualLayers = config.virtualLayers || [];
    }
    async load(options) {
        return {
            layerId: this.id,
            layerName: this.name,
            esriLayer: null,
            features: [],
            extent: null,
            layerType: 'virtual'
        };
    }
    async getFields() {
        return [];
    }
    async executeQuery(query, options) {
        return {};
    }
    async createVisualization(type, options) {
        return {
            layerId: this.id,
            esriLayer: null,
            extent: null,
            features: []
        };
    }
}
