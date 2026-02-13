"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: 
                    t = op; 
                    break;
                case 1: 
                    t = op; 
                    break;
                case 4: 
                    _.label++; 
                    return { value: op[1], done: false };
                case 5: 
                    _.label++; 
                    y = op[1]; 
                    op = [0]; 
                    continue;
                case 7: 
                    op = _.ops.pop(); 
                    _.trys.pop(); 
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { 
                        _ = 0; 
                        continue; 
                    }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { 
                        _.label = op[1]; 
                        break; 
                    }
                    if (op[0] === 6 && _.label < t[1]) { 
                        _.label = t[1]; 
                        t = op; 
                        break; 
                    }
                    if (t && _.label < t[2]) { 
                        _.label = t[2]; 
                        _.ops.push(op); 
                        break; 
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); 
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLQueryClassifier = void 0;
/**
 * ML Query Classifier using the Vercel serverless function
 * This class provides machine learning-based classification of queries
 * with a fallback to pattern matching if needed
 */
var MLQueryClassifier = /** @class */ (function () {
    /**
     * Create a new ML Query Classifier
     * @param config Configuration options
     */
    function MLQueryClassifier(config) {
        if (config === void 0) { config = {}; }
        this.predictionCache = new Map();
        this.apiEndpoint = config.apiEndpoint || '/api/classify-query';
        this.confidenceThreshold = config.confidenceThreshold || 0.7;
        this.cacheTimeout = config.cacheTimeout || 30 * 60 * 1000; // 30 minutes
        this.timeoutMs = config.timeoutMs || 1000; // 1 second timeout
    }
    /**
     * Classify a query using the ML service
     * @param query The query to classify
     * @returns Promise with prediction or null if error/timeout
     */
    MLQueryClassifier.prototype.classifyQuery = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var cachedResult, controller_1, timeoutId, response, prediction, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!query)
                            return [2 /*return*/, null];
                        cachedResult = this.getCachedPrediction(query);
                        if (cachedResult) {
                            console.log('Using cached ML prediction for query:', query);
                            return [2 /*return*/, cachedResult];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        controller_1 = new AbortController();
                        timeoutId = setTimeout(function () { return controller_1.abort(); }, this.timeoutMs);
                        return [4 /*yield*/, fetch(this.apiEndpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ query: query }),
                                signal: controller_1.signal
                            })];
                    case 2:
                        response = _a.sent();
                        // Clear timeout
                        clearTimeout(timeoutId);
                        if (!response.ok) {
                            throw new Error("HTTP error ".concat(response.status));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        prediction = _a.sent();
                        // Cache the result
                        this.cachePrediction(query, prediction);
                        return [2 /*return*/, prediction];
                    case 4:
                        error_1 = _a.sent();
                        if (error_1.name === 'AbortError') {
                            console.warn('ML service request timed out for query:', query);
                        }
                        else {
                            console.warn('Error calling ML service:', error_1);
                        }
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if an ML prediction has sufficient confidence
     * @param prediction The ML prediction
     * @returns True if the prediction is confident enough
     */
    MLQueryClassifier.prototype.isConfident = function (prediction) {
        return !!(prediction && prediction.confidence >= this.confidenceThreshold);
    };
    /**
     * Get cached prediction if available and not expired
     * @param query The query to look up
     * @returns The cached prediction or null
     */
    MLQueryClassifier.prototype.getCachedPrediction = function (query) {
        var normalizedQuery = this.normalizeQuery(query);
        var cached = this.predictionCache.get(normalizedQuery);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.prediction;
        }
        return null;
    };
    /**
     * Cache a prediction for future use
     * @param query The query
     * @param prediction The prediction to cache
     */
    MLQueryClassifier.prototype.cachePrediction = function (query, prediction) {
        var normalizedQuery = this.normalizeQuery(query);
        this.predictionCache.set(normalizedQuery, {
            prediction: prediction,
            timestamp: Date.now()
        });
        // Manage cache size - keep it under 100 entries
        if (this.predictionCache.size > 100) {
            // Delete oldest entry
            const entries = Array.from(this.predictionCache.entries());
            var oldestTime = Infinity;
            var oldestKey = null;
            for (let i = 0; i < entries.length; i++) {
                const [key, entry] = entries[i];
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = key;
                }
            }
            if (oldestKey) {
                this.predictionCache.delete(oldestKey);
            }
        }
    };
    /**
     * Normalize a query for caching
     * (removes extra spaces, converts to lowercase)
     */
    MLQueryClassifier.prototype.normalizeQuery = function (query) {
        return query.toLowerCase().trim().replace(/\s+/g, ' ');
    };
    /**
     * Clear the prediction cache
     */
    MLQueryClassifier.prototype.clearCache = function () {
        this.predictionCache.clear();
    };
    /**
     * Update configuration options
     * @param config New configuration options
     */
    MLQueryClassifier.prototype.updateConfig = function (config) {
        if (config.apiEndpoint !== undefined) {
            this.apiEndpoint = config.apiEndpoint;
        }
        if (config.confidenceThreshold !== undefined) {
            this.confidenceThreshold = config.confidenceThreshold;
        }
        if (config.cacheTimeout !== undefined) {
            this.cacheTimeout = config.cacheTimeout;
        }
        if (config.timeoutMs !== undefined) {
            this.timeoutMs = config.timeoutMs;
        }
    };
    return MLQueryClassifier;
}());
exports.MLQueryClassifier = MLQueryClassifier;
