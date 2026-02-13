"use strict";
// src/config/layers.ts
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportLayerConfig = exports.getLayerMetadata = exports.canAccessLayer = exports.getLayerConstraints = exports.validateLayerOperation = exports.projectLayerConfig = exports.layers = exports.baseLayerConfigs = exports.concepts = void 0;
exports.concepts = {
    population: {
        terms: [
            'population', 'people', 'residents', 'inhabitants',
            'demographics', 'age', 'gender', 'household', 'family',
            'diversity', 'cultural groups'
        ],
        weight: 10,
    },
    income: {
        terms: ['income', 'earnings', 'salary', 'wage', 'affluence', 'wealth', 'disposable'],
        weight: 25
    },
    race: {
        terms: ['race', 'ethnicity', 'diverse', 'diversity', 'racial', 'white', 'black', 'asian', 'american indian', 'pacific islander', 'hispanic'],
        weight: 20
    },
    spending: {
        terms: ['spending', 'purchase', 'bought', 'shopped', 'consumer', 'expense', 'shopping'],
        weight: 25
    },
    sports: {
        terms: ['sports', 'athletic', 'exercise', 'fan', 'participation', 'NBA', 'NFL', 'MLB', 'NHL', 'soccer', 'running', 'jogging', 'yoga', 'weight lifting'],
        weight: 20
    },
    brands: {
        terms: [
            'brand', 'Nike', 'Adidas', 'Jordan', 'Converse', 'Reebok', 'Puma',
            'New Balance', 'Asics', 'Skechers', 'Alo', 'Lululemon', 'On'
        ],
        weight: 25
    },
    retail: {
        terms: ['retail', 'store', 'shop', 'Dick\'s Sporting Goods', 'Foot Locker', 'outlet', 'mall'],
        weight: 15
    },
    clothing: {
        terms: ['clothing', 'apparel', 'wear', 'workout wear', 'athletic wear', 'shoes', 'footwear', 'sneakers'],
        weight: 20
    },
    household: {
        terms: ['household', 'family', 'home', 'housing', 'residence'],
        weight: 15
    },
    trends: {
        terms: [
            'trends', 'google', 'search', 'interest', 'popularity',
            'search volume', 'search data', 'search analytics', 'trending', 'search patterns',
            'consumer interest', 'market attention', 'brand awareness', 'search interest',
            'online demand', 'consumer demand', 'brand popularity', 'search frequency',
            'search trends', 'search queries', 'google search', 'search index'
        ],
        weight: 20
    },
    geographic: {
        terms: ['ZIP', 'DMA', 'local', 'regional', 'area', 'location', 'zone', 'region'],
        weight: 15
    }
};
// Helper function to ensure each layer has a DESCRIPTION field
var ensureLayerHasDescriptionField = function (layerConfig) {
    // Clone the layer config
    var updatedConfig = __assign({}, layerConfig);
    // Check if fields array exists
    if (!updatedConfig.fields) {
        updatedConfig.fields = [];
    }
    // Check if DESCRIPTION field already exists
    var hasDescription = updatedConfig.fields.some(function (field) { return field.name === 'DESCRIPTION'; });
    // If DESCRIPTION field doesn't exist, add it
    if (!hasDescription) {
        updatedConfig.fields.push({
            name: 'DESCRIPTION',
            type: 'string',
            alias: 'ZIP Code',
            label: 'ZIP Code'
        });
    }
    return updatedConfig;
};
// Define base layer configurations
exports.baseLayerConfigs = [
    {
        id: 'totalPopulation',
        name: 'Total Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/7',
        group: 'demographics-group',
        description: 'Total population count',
        isVisible: false,
        isPrimary: true,
        skipLayerList: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'totalPopulation', type: 'double', description: 'Total population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: {
            strategy: 'traditional',
            timeout: 30000,
            priority: 1,
            batchSize: 1000,
            retryAttempts: 3,
            concurrencyLimit: 5
        },
        caching: {
            enabled: true,
            ttl: 3600,
            strategy: 'memory',
            maxEntries: 1000,
            prefetch: false
        },
        performance: {
            maxFeatures: 10000,
            maxGeometryComplexity: 1000000,
            timeoutMs: 30000,
            rateLimits: {
                requestsPerSecond: 10,
                burstSize: 20
            }
        },
        security: {
            requiresAuthentication: true,
            accessLevels: ['read'],
            encryptionRequired: false,
            auditEnabled: true
        },
        analysis: {
            availableOperations: ['query'],
            aggregationMethods: ['sum', 'average'],
            supportedVisualizationTypes: ['choropleth'],
            complexityThresholds: {
                spatialComplexity: 1000000,
                computationalComplexity: 1000
            }
        }
    },
    {
        id: 'marriedOrCommonLaw',
        name: 'Married or living with a common-law partner',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/17',
        group: 'demographics-group',
        description: 'Population married or in common law relationships',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'marriedOrCommonLaw', type: 'double', description: 'Married or common law population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['marriage', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'marriedNotSeparated',
        name: 'Married (and not separated)',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/9',
        group: 'demographics-group',
        description: 'Population married and not separated',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'marriedNotSeparated', type: 'double', description: 'Married not separated population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['marriage', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'livingCommonLaw',
        name: 'Living common law',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/12',
        group: 'demographics-group',
        description: 'Population living in common law relationships',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'livingCommonLaw', type: 'double', description: 'Living common law population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['marriage', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'notMarriedNotCommonLaw',
        name: 'Not married and not living with a common-law partner',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/11',
        group: 'demographics-group',
        description: 'Population not married and not in common law relationships',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'notMarriedNotCommonLaw', type: 'double', description: 'Not married and not common law population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['marriage', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'singleNeverMarried',
        name: 'Single (never legally married)',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/1',
        group: 'demographics-group',
        description: 'Population who have never been legally married',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'singleNeverMarried', type: 'double', description: 'Single never married population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['marriage', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'separated',
        name: 'Separated',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/15',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Separated', label: 'Separated' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['marriage', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'Separated',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'divorced',
        name: 'Divorced',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/14',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Divorced', label: 'Divorced' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['marriage', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'Divorced',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'widowed',
        name: 'Widowed',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/16',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Widowed', label: 'Widowed' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['marriage', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'Widowed',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'populationChange2021To2022',
        name: '2021 To 2022 Population Change',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/18',
        group: 'demographics-group',
        description: 'Population change from 2021 to 2022',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'populationChange2021To2022', type: 'double', description: 'Population change 2021-2022' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'change', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'populationChange2022To2023',
        name: '2022 To 2023 Population Change',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/19',
        group: 'demographics-group',
        description: 'Population change from 2022 to 2023',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'populationChange2022To2023', type: 'double', description: 'Population change 2022-2023' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'change', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'populationChange2023To2024',
        name: '2023 To 2024 Population Change',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/20',
        group: 'demographics-group',
        description: 'Population change from 2023 to 2024',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'populationChange2023To2024', type: 'double', description: 'Population change 2023-2024' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'change', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'populationChange2024To2025',
        name: '2024 To 2025 Population Change',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/21',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: '2024 To 2025 Population Change', label: '2024 To 2025 Population Change' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: '2024 To 2025 Population Change',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'populationChange2025To2026',
        name: '2025 To 2026 Population Change',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/22',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: '2025 To 2026 Population Change', label: '2025 To 2026 Population Change' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: '2025 To 2026 Population Change',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'populationChange2026To2027',
        name: '2026 To 2027 Population Change',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/23',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: '2026 To 2027 Population Change', label: '2026 To 2027 Population Change' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: '2026 To 2027 Population Change',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'participationRate',
        name: 'Participation Rate',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/24',
        group: 'demographics-group',
        description: 'Labor force participation rate',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'participationRate', type: 'double', description: 'Labor force participation rate' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['employment', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'employmentRate',
        name: 'Employment Rate',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/25',
        group: 'demographics-group',
        description: 'Employment rate',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'employmentRate', type: 'double', description: 'Employment rate' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['employment', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'unemploymentRate',
        name: 'Unemployment Rate',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/26',
        group: 'demographics-group',
        description: 'Unemployment rate',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'unemploymentRate', type: 'double', description: 'Unemployment rate' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['employment', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'maintainers2534',
        name: 'Maintainers 25 To 34',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/27',
        group: 'demographics-group',
        description: 'Maintainers aged 25 to 34',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'maintainers2534', type: 'double', description: 'Maintainers aged 25-34' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['maintainers', 'age', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'maintainers3544',
        name: 'Maintainers 35 To 44',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/28',
        group: 'demographics-group',
        description: 'Maintainers aged 35 to 44',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'maintainers3544', type: 'double', description: 'Maintainers aged 35-44' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['maintainers', 'age', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'maintainers4554',
        name: 'Maintainers 45 To 54',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/29',
        group: 'demographics-group',
        description: 'Maintainers aged 45 to 54',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'maintainers4554', type: 'double', description: 'Maintainers aged 45-54' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['maintainers', 'age', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'maintainers5564',
        name: 'Maintainers 55 To 64',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/30',
        group: 'demographics-group',
        description: 'Maintainers aged 55 to 64',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'maintainers5564', type: 'double', description: 'Maintainers aged 55-64' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['maintainers', 'age', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'maintainersMedianAge',
        name: 'Maintainers Median Age',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/31',
        group: 'demographics-group',
        description: 'Median age of maintainers',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'maintainersMedianAge', type: 'double', description: 'Median age of maintainers' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['maintainers', 'age', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'maleHouseholdPopulation',
        name: 'Male Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/32',
        group: 'demographics-group',
        description: 'Male household population',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'maleHouseholdPopulation', type: 'double', description: 'Male household population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'gender', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'femaleHouseholdPopulation',
        name: 'Female Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/33',
        group: 'demographics-group',
        description: 'Female household population',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'femaleHouseholdPopulation', type: 'double', description: 'Female household population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'gender', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'visibleMinorityHouseholdPopulation',
        name: 'Visible Minority Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/8',
        group: 'demographics-group',
        description: 'Visible minority household population',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'visibleMinorityHouseholdPopulation', type: 'double', description: 'Visible minority household population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics', 'diversity'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'chineseHouseholdPopulation',
        name: 'Chinese Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/34',
        group: 'demographics-group',
        description: 'Chinese household population',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'chineseHouseholdPopulation', type: 'double', description: 'Chinese household population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics', 'diversity'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'southAsianHouseholdPopulation',
        name: 'South Asian Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/36',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'South Asian Household Population', label: 'South Asian Household Population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['ethnicity', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'South Asian Household Population',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'blackHouseholdPopulation',
        name: 'Black Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/37',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Black Household Population', label: 'Black Household Population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['ethnicity', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'Black Household Population',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'filipinoHouseholdPopulation',
        name: 'Filipino Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/38',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Filipino Household Population', label: 'Filipino Household Population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['ethnicity', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'Filipino Household Population',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'latinAmericanHouseholdPopulation',
        name: 'Latin American Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/38',
        group: 'demographics-group',
        description: 'Latin American household population',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'latinAmericanHouseholdPopulation', type: 'double', description: 'Latin American household population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics', 'diversity'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'southeastAsianHouseholdPopulation',
        name: 'Southeast Asian Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/39',
        group: 'demographics-group',
        description: 'Southeast Asian household population',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'southeastAsianHouseholdPopulation', type: 'double', description: 'Southeast Asian household population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics', 'diversity'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'arabHouseholdPopulation',
        name: 'Arab Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/41',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Arab Household Population', label: 'Arab Household Population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['ethnicity', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'Arab Household Population',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'westAsianHouseholdPopulation',
        name: 'West Asian Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/41',
        group: 'demographics-group',
        description: 'West Asian household population',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'westAsianHouseholdPopulation', type: 'double', description: 'West Asian household population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics', 'diversity'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'koreanHouseholdPopulation',
        name: 'Korean Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/42',
        group: 'demographics-group',
        description: 'Korean household population',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'koreanHouseholdPopulation', type: 'double', description: 'Korean household population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics', 'diversity'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'japaneseHouseholdPopulation',
        name: 'Japanese Household Population',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/43',
        group: 'demographics-group',
        description: 'Japanese household population',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'japaneseHouseholdPopulation', type: 'double', description: 'Japanese household population' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['population', 'demographics', 'diversity'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'householdDiscretionaryIncome',
        name: 'Household Discretionary Income',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/45',
        group: 'demographics-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Household Discretionary Income', label: 'Household Discretionary Income' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['income', 'demographics'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'Household Discretionary Income',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'totalHouseholds',
        name: 'Total Households',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/46',
        group: 'housing-group',
        description: 'Total number of households',
        isVisible: false,
        isPrimary: true,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'totalHouseholds', type: 'double', description: 'Total households' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['households', 'housing'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'totalByTenure',
        name: 'Total by Tenure',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/45',
        group: 'housing-group',
        description: 'Total households by tenure',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'totalByTenure', type: 'double', description: 'Total households by tenure' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['households', 'housing', 'tenure'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'ownerOccupiedByTenure',
        name: 'Owner Occupied by Tenure',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/47',
        group: 'housing-group',
        description: 'Owner occupied households by tenure',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'ownerOccupiedByTenure', type: 'double', description: 'Owner occupied households by tenure' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['households', 'housing', 'tenure'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'renterOccupiedByTenure',
        name: 'Renter Occupied by Tenure',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/48',
        group: 'housing-group',
        description: 'Renter occupied households by tenure',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'renterOccupiedByTenure', type: 'double', description: 'Renter occupied households by tenure' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['households', 'housing', 'tenure'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'bandHousingByTenure',
        name: 'Band housing by Tenure',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/49',
        group: 'housing-group',
        description: 'Band housing households by tenure',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'bandHousingByTenure', type: 'double', description: 'Band housing households by tenure' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['households', 'housing', 'tenure'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'totalByCondominiumStatus',
        name: 'Total by condominium status',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/50',
        group: 'housing-group',
        description: 'Total households by condominium status',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'totalByCondominiumStatus', type: 'double', description: 'Total households by condominium status' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['households', 'housing', 'condominium'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'condominium',
        name: 'Condominium',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/52',
        group: 'housing-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Condominium', label: 'Condominium' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'condominium'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'Condominium',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'notCondominium',
        name: 'Not Condominium',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/53',
        group: 'housing-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Not Condominium', label: 'Not Condominium' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'condominium'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'Not Condominium',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'householdIncome',
        name: 'Household Income',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/68',
        group: 'income-group',
        description: 'Household income',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'householdIncome', type: 'double', description: 'Household income' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['income'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'averageHouseholdIncome',
        name: 'Average Household Income',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/69',
        group: 'income-group',
        description: 'Average household income',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'averageHouseholdIncome', type: 'double', description: 'Average household income' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['income'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'medianHouseholdIncome',
        name: 'Median Household Income',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/70',
        group: 'income-group',
        description: 'Median household income',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'medianHouseholdIncome', type: 'double', description: 'Median household income' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['income'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'financialServices',
        name: 'Financial Services',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/71',
        group: 'spending-group',
        description: 'Financial services spending',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'financialServices', type: 'double', description: 'Financial services spending' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['spending'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'serviceChargesBanks',
        name: 'Service Charges - Banks',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/72',
        group: 'spending-group',
        description: 'Bank service charges spending',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'serviceChargesBanks', type: 'double', description: 'Bank service charges spending' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['spending'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'periodOfConstruction1961To1980',
        name: 'Period of Construction - 1961 to 1980',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/54',
        group: 'housing-group',
        description: 'Housing constructed between 1961 and 1980',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'periodOfConstruction1961To1980', type: 'double', description: 'Housing constructed between 1961 and 1980' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'construction'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'periodOfConstruction1981To1990',
        name: 'Period of Construction - 1981 to 1990',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/55',
        group: 'housing-group',
        description: 'Housing constructed between 1981 and 1990',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'periodOfConstruction1981To1990', type: 'double', description: 'Housing constructed between 1981 and 1990' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'construction'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'periodOfConstruction1991To2000',
        name: 'Period of Construction - 1991 to 2000',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/56',
        group: 'housing-group',
        description: 'Housing constructed between 1991 and 2000',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'periodOfConstruction1991To2000', type: 'double', description: 'Housing constructed between 1991 and 2000' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'construction'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'periodOfConstruction2001To2005',
        name: 'Period of Construction - 2001 to 2005',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/57',
        group: 'housing-group',
        description: 'Housing constructed between 2001 and 2005',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'periodOfConstruction2001To2005', type: 'double', description: 'Housing constructed between 2001 and 2005' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'construction'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'periodOfConstruction2006To2010',
        name: 'Period of Construction - 2006 to 2010',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/58',
        group: 'housing-group',
        description: 'Housing constructed between 2006 and 2010',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'periodOfConstruction2006To2010', type: 'double', description: 'Housing constructed between 2006 and 2010' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'construction'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'periodOfConstruction2011To2015',
        name: 'Period of Construction - 2011 to 2015',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/59',
        group: 'housing-group',
        description: 'Housing constructed between 2011 and 2015',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'periodOfConstruction2011To2015', type: 'double', description: 'Housing constructed between 2011 and 2015' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'construction'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'periodOfConstruction2016To2021',
        name: 'Period of Construction - 2016 to 2021',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/60',
        group: 'housing-group',
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Period of Construction - 2016 to 2021', label: 'Period of Construction - 2016 to 2021' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'construction'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] },
        description: 'Period of Construction - 2016 to 2021',
        isVisible: false,
        isPrimary: false
    },
    {
        id: 'periodOfConstruction2016To2020',
        name: 'Period of Construction - 2016 to 2020',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/60',
        group: 'housing-group',
        description: 'Housing constructed between 2016 and 2020',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'periodOfConstruction2016To2020', type: 'double', description: 'Housing constructed between 2016 and 2020' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'construction'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'periodOfConstruction2021OrLater',
        name: 'Period of Construction - 2021 or Later',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/61',
        group: 'housing-group',
        description: 'Housing constructed in 2021 or later',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'periodOfConstruction2021OrLater', type: 'double', description: 'Housing constructed in 2021 or later' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'construction'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'apartmentFewerThanFiveStoreys',
        name: 'Apartment in a building that has fewer than five storeys',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/65',
        group: 'housing-group',
        description: 'Apartments in buildings with fewer than five storeys',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'apartmentFewerThanFiveStoreys', type: 'double', description: 'Apartments in buildings with fewer than five storeys' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'dwelling'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'apartmentFiveOrMoreStoreys',
        name: 'Apartment in a building that has five or more storeys',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/66',
        group: 'housing-group',
        description: 'Apartment in a building that has five or more storeys',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Apartment in a building that has five or more storeys', label: 'Apartment in a building that has five or more storeys' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'dwelling'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'otherSingleAttachedHouse',
        name: 'Other single-attached house',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/82',
        group: 'housing-group',
        description: 'Other single-attached house',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Other single-attached house', label: 'Other single-attached house' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'dwelling'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'movableDwelling',
        name: 'Movable dwelling',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/83',
        group: 'housing-group',
        description: 'Movable dwelling',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'OBJECTID', type: 'oid', alias: 'Object ID', label: 'ID' },
            { name: 'thematic_value', type: 'double', alias: 'Movable dwelling', label: 'Movable dwelling' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'dwelling'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'apartmentOrFlatInDuplex',
        name: 'Apartment or Flat in Duplex',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54_Nesto_layers/FeatureServer/64',
        group: 'housing-group',
        description: 'Apartments or flats in duplexes',
        isVisible: false,
        isPrimary: false,
        rendererField: 'thematic_value',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'apartmentOrFlatInDuplex', type: 'double', description: 'Apartments or flats in duplexes' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['housing', 'dwelling'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    // START NEW MORTGAGE LAYERS
    {
        id: 'applications',
        name: 'Applications',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/ca_mortgages/FeatureServer/1',
        group: 'nesto-group', // Renamed from mortgages-group
        description: 'Mortgage applications count',
        isVisible: false,
        isPrimary: false,
        skipLayerList: false,
        rendererField: 'FREQUENCY',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'FREQUENCY', type: 'double', description: 'Mortgage applications' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['mortgages', 'applications'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'conversions',
        name: 'Conversions',
        type: 'feature-service',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/ca_mortgages/FeatureServer/2',
        group: 'nesto-group', // Renamed from mortgages-group
        description: 'Mortgage conversions count',
        isVisible: false,
        isPrimary: false,
        skipLayerList: false,
        rendererField: 'SUM_FUNDED',
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'SUM_FUNDED', type: 'double', description: 'Mortgage conversions' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['mortgages', 'conversions'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    },
    {
        id: 'conversionRate',
        name: 'Conversion Rate',
        type: 'percentage',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/ca_mortgages/FeatureServer/0',
        group: 'nesto-group', // Renamed from mortgages-group
        description: 'Mortgage conversion rate',
        isVisible: false,
        isPrimary: false,
        skipLayerList: false,
        rendererField: 'CONVERSIONRATE',
        filterField: 'FREQUENCY', // Add filter field
        filterThreshold: 25, // Add filter threshold of 25 applications
        status: 'active',
        geographicType: 'postal',
        geographicLevel: 'local',
        fields: [
            { name: 'CONVERSIONRATE', type: 'double', description: 'Mortgage conversion rate' }
        ],
        metadata: {
            provider: 'ArcGIS',
            updateFrequency: 'annual',
            tags: ['mortgages', 'rate', 'conversion'],
            geographicType: 'postal',
            geographicLevel: 'local'
        },
        processing: { strategy: 'traditional' },
        caching: { strategy: 'memory' },
        performance: { timeoutMs: 30000 },
        security: { accessLevels: ['read'] },
        analysis: { availableOperations: ['query'] }
    }
    // END NEW MORTGAGE LAYERS
];
// Layer configurations
exports.layers = Object.fromEntries(Object.entries(exports.baseLayerConfigs).map(function (_a) {
    var key = _a[0], config = _a[1];
    return [key, ensureLayerHasDescriptionField(config)];
}));
// Project configuration
exports.projectLayerConfig = {
    groups: [
        {
            id: 'nesto-group', // Renamed and moved to top
            title: 'Nesto', // Renamed
            description: 'Mortgage related data',
            layers: Object.values(exports.layers).filter(function (layer) { return layer.group === 'nesto-group'; })
        },
        {
            id: 'demographics-group',
            title: 'Demographics',
            description: 'Population and demographic data',
            layers: Object.values(exports.layers).filter(function (layer) { return layer.group === 'demographics-group'; })
        },
        {
            id: 'housing-group',
            title: 'Housing',
            description: 'Housing and dwelling data',
            layers: Object.values(exports.layers).filter(function (layer) { return layer.group === 'housing-group'; })
        },
        {
            id: 'income-group',
            title: 'Income',
            description: 'Household income data',
            layers: Object.values(exports.layers).filter(function (layer) { return layer.group === 'income-group'; })
        },
        {
            id: 'spending-group',
            title: 'Spending',
            description: 'Household spending data',
            layers: Object.values(exports.layers).filter(function (layer) { return layer.group === 'spending-group'; })
        }
    ],
    defaultVisibility: {
    // All layers are hidden by default
    },
    defaultCollapsed: {
        'nesto-group': false, // Renamed and set to expanded
        'demographics-group': false,
        'housing-group': true,
        'income-group': true,
        'spending-group': true
    }
};
// Utility functions
var validateLayerOperation = function (layerId, operation) {
    var _a;
    var layer = exports.layers[layerId];
    if (!layer || !((_a = layer.analysis) === null || _a === void 0 ? void 0 : _a.availableOperations))
        return false;
    return layer.analysis.availableOperations.includes(operation);
};
exports.validateLayerOperation = validateLayerOperation;
var getLayerConstraints = function (layerId) {
    var layer = exports.layers[layerId];
    return {
        geographic: (layer === null || layer === void 0 ? void 0 : layer.geographicLevel) || 'local',
        dataType: (layer === null || layer === void 0 ? void 0 : layer.type) || 'unknown'
    };
};
exports.getLayerConstraints = getLayerConstraints;
var canAccessLayer = function (layerId, accessLevel) {
    var _a;
    if (accessLevel === void 0) { accessLevel = 'read'; }
    var layer = exports.layers[layerId];
    if (!layer || !((_a = layer.security) === null || _a === void 0 ? void 0 : _a.accessLevels))
        return false;
    return layer.security.accessLevels.includes(accessLevel);
};
exports.canAccessLayer = canAccessLayer;
var getLayerMetadata = function (layerId) {
    var _a;
    return ((_a = exports.layers[layerId]) === null || _a === void 0 ? void 0 : _a.metadata) || null;
};
exports.getLayerMetadata = getLayerMetadata;
var exportLayerConfig = function (layerId) {
    return exports.layers[layerId] || null;
};
exports.exportLayerConfig = exportLayerConfig;
