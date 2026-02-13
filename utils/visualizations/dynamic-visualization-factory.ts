/**
 * DEPRECATED: This file is maintained for backwards compatibility only.
 * Please use lib/DynamicVisualizationFactory.ts for all new code.
 * 
 * This file simply exports a proxy to the main DynamicVisualizationFactory.
 */

import { DynamicVisualizationFactory } from '../../lib/DynamicVisualizationFactory';

// Re-export the main factory
export { DynamicVisualizationFactory };

// For backwards compatibility: export the factory instance directly
// This maintains compatibility with code that imports from this location
const factoryInstance = new DynamicVisualizationFactory();

export default factoryInstance; 