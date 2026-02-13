"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAnalysisError = exports.DataRetrievalError = void 0;
class DataRetrievalError extends Error {
    constructor(message, status, code, url) {
        super(message);
        this.status = status;
        this.code = code;
        this.url = url;
        this.name = 'DataRetrievalError';
    }
}
exports.DataRetrievalError = DataRetrievalError;
class AIAnalysisError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'AIAnalysisError';
    }
}
exports.AIAnalysisError = AIAnalysisError;
