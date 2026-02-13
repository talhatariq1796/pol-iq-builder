const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

// Path to model files
const MODEL_PATH = path.join(__dirname, 'model');
const LABELS_PATH = path.join(MODEL_PATH, 'labels.txt');

// Cache for model and labels
let model;
let labelMapping;

/**
 * Load label mapping from file
 */
async function loadLabels() {
  if (labelMapping) return labelMapping;
  
  try {
    const data = await fs.promises.readFile(LABELS_PATH, 'utf-8');
    labelMapping = {};
    
    data.split('\n').forEach(line => {
      if (!line.trim()) return;
      const [index, label] = line.split('\t');
      labelMapping[parseInt(index)] = label;
    });
    
    return labelMapping;
  } catch (error) {
    console.error('Error loading labels:', error);
    throw error;
  }
}

/**
 * Load model if not already loaded
 */
async function loadModel() {
  if (model) return model;
  
  try {
    model = await tf.loadGraphModel(`file://${MODEL_PATH}/model.json`);
    return model;
  } catch (error) {
    console.error('Error loading model:', error);
    throw error;
  }
}

/**
 * Tokenize input text
 * This is a simplified version - in production, you would use the same 
 * tokenizer used during training
 */
function tokenize(text) {
  // For a real implementation, use the tokenizer saved from training
  // This is placeholder logic that would need to be replaced
  const tokens = text.toLowerCase().split(/\s+/).slice(0, 128);
  
  // Pad or truncate to MAX_LENGTH
  const MAX_LENGTH = 128;
  const padded = tokens.length < MAX_LENGTH 
    ? [...tokens, ...Array(MAX_LENGTH - tokens.length).fill('[PAD]')]
    : tokens.slice(0, MAX_LENGTH);
    
  return padded;
}

/**
 * Format prediction results
 */
async function formatPredictions(predictions, input) {
  const labels = await loadLabels();
  
  // Get the raw output
  const logits = predictions.arraySync()[0];
  
  // Apply softmax to get probabilities
  const probabilities = tf.tidy(() => {
    return tf.softmax(tf.tensor(logits)).arraySync();
  });
  
  // Get top prediction
  const maxIndex = logits.indexOf(Math.max(...logits));
  const predictedType = labels[maxIndex];
  const confidence = probabilities[maxIndex];
  
  // Return formatted result
  return {
    query: input,
    type: predictedType,
    confidence,
    // Include top 3 alternatives for debugging
    alternatives: Object.entries(labels)
      .map(([idx, label]) => ({ 
        type: label, 
        confidence: probabilities[parseInt(idx)] 
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
  };
}

/**
 * Main handler function
 */
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`Processing query: ${query}`);
    
    // Load model
    const model = await loadModel();
    
    // Tokenize (simplified here)
    const tokens = tokenize(query);
    
    // Create input tensor
    const inputTensor = tf.tensor([tokens]);
    
    // Run prediction
    const predictions = await model.predict(inputTensor);
    
    // Format results
    const result = await formatPredictions(predictions, query);
    
    // Set cache headers (1 hour)
    res.setHeader('Cache-Control', 's-maxage=3600');
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing query:', error);
    return res.status(500).json({ 
      error: 'Error processing query',
      message: error.message
    });
  }
}; 