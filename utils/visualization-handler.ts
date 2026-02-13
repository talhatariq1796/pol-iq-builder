import { VisualizationFactory } from './visualization-factory'; // Adjust path as needed

export async function handleVisualization(data: any): Promise<void> {
  const factory = new VisualizationFactory({
    analysisResult: data.analysisResult,
    enhancedAnalysis: data.enhancedAnalysis,
    features: data.features
  });
  // Example usage of the factory
  console.log('VisualizationFactory initialized:', factory);

  try {
    // Fix argument count issue by providing required options
    const options = { query: 'default query', visualizationMode: 'single-layer' }; // Example options
    const viz = await factory.createVisualization(data, options);

    // Fix invalid method call by handling the returned VisualizationResult
    if (viz.layer) {
      console.log('Visualization layer created:', viz.layer);
    } else {
      console.error('Failed to create visualization layer');
    }
  } catch (error) {
    console.error('[handleVisualization] Visualization creation failed:', error);
    throw new Error('Failed to create multi-layer visualization');
  }
}