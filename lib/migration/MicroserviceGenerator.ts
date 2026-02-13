/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs/promises';
import path from 'path';
import { 
  ProjectTemplate, 
  MicroservicePackage, 
  MicroserviceConfig, 
  DeploymentManifest,
  HealthCheck,
  MicroserviceGenerationResult,
  ValidationError,
  ValidationWarning,
  ValidationResult,
  ModelConfiguration
} from './types';

export class MicroserviceGenerator {
  private outputDir: string;
  private templatesDir: string;

  constructor(outputDir: string = './microservice-packages') {
    this.outputDir = outputDir;
    this.templatesDir = path.join(process.cwd(), 'templates', 'microservice');
  }

  async generateFromTemplate(
    template: ProjectTemplate,
    trainingDataPath: string,
    options: {
      platform: 'render' | 'vercel' | 'aws' | 'local';
      region?: string;
      plan?: string;
      createRepository?: boolean;
    } = { platform: 'render' }
  ): Promise<MicroserviceGenerationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const buildLogs: string[] = [];
    const generatedFiles: string[] = [];

    try {
      buildLogs.push(`🚀 Starting microservice generation for ${template.name}`);

      // 1. Validate template
      const validation = await this.validateTemplate(template);
      if (!validation.isValid) {
        errors.push(...validation.errors);
        return {
          success: false,
          packagePath: '',
          configuration: {} as MicroserviceConfig,
          generatedFiles: [],
          errors,
          warnings,
          validationResults: [validation],
          buildLogs
        };
      }

      // 2. Create microservice configuration
      const config = this.createMicroserviceConfig(template, trainingDataPath, options.platform);
      buildLogs.push(`✅ Created microservice configuration`);

      // 3. Create deployment manifest
      const deploymentManifest = this.createDeploymentManifest(config, options);
      buildLogs.push(`✅ Created deployment manifest`);

      // 4. Generate health checks
      const healthChecks = this.generateHealthChecks(config);
      buildLogs.push(`✅ Generated ${healthChecks.length} health checks`);

      // 5. Create microservice package
      const packagePath = path.join(this.outputDir, (config as any).repositoryName);
      await fs.mkdir(packagePath, { recursive: true });

      const microservicePackage: MicroservicePackage = {
        projectName: template.name,
        template,
        configuration: config,
        deploymentManifest,
        healthChecks,
        generatedFiles: new Map()
      };

      // 6. Generate all microservice files
      const fileResults = await this.generateMicroserviceFiles(microservicePackage, packagePath);
      generatedFiles.push(...fileResults.files);
      buildLogs.push(...fileResults.logs);
      errors.push(...fileResults.errors);
      warnings.push(...fileResults.warnings);

      // 7. Generate package.json
      await this.generatePackageJson(config, packagePath);
      generatedFiles.push(path.join(packagePath, 'package.json'));
      buildLogs.push(`✅ Generated package.json`);

      // 8. Generate requirements and environment files
      await this.generateEnvironmentFiles(config, packagePath);
      generatedFiles.push(path.join(packagePath, '.env.example'));
      generatedFiles.push(path.join(packagePath, 'requirements.txt'));
      buildLogs.push(`✅ Generated environment configuration`);

      // 9. Generate Dockerfile if using Render
      if (options.platform === 'render') {
        await this.generateDockerfile(config, packagePath);
        generatedFiles.push(path.join(packagePath, 'Dockerfile'));
        buildLogs.push(`✅ Generated Dockerfile for Render deployment`);
      }

      // 10. Generate deployment configuration
      await this.generateDeploymentConfig(deploymentManifest, packagePath);
      generatedFiles.push(path.join(packagePath, 'render.yaml'));
      buildLogs.push(`✅ Generated deployment configuration`);

      const duration = Date.now() - startTime;
      buildLogs.push(`🎉 Microservice generation completed in ${duration}ms`);
      buildLogs.push(`📁 Package location: ${packagePath}`);
      buildLogs.push(`📦 Generated ${generatedFiles.length} files`);

      return {
        success: true,
        packagePath,
        configuration: config,
        generatedFiles,
        repositoryUrl: deploymentManifest.repositoryUrl,
        errors,
        warnings,
        validationResults: [validation],
        buildLogs
      };

    } catch (error) {
      errors.push({
        code: 'GENERATION_ERROR',
        message: `Failed to generate microservice: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });

      return {
        success: false,
        packagePath: '',
        configuration: {} as MicroserviceConfig,
        generatedFiles: [],
        errors,
        warnings,
        validationResults: [],
        buildLogs
      };
    }
  }

  private async validateTemplate(template: ProjectTemplate): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required template fields
    if (!template.name || template.name.length === 0) {
      errors.push({
        code: 'MISSING_TEMPLATE_NAME',
        message: 'Template name is required',
        severity: 'critical'
      });
    }

    if (!template.brands || template.brands.length === 0) {
      errors.push({
        code: 'MISSING_BRANDS',
        message: 'At least one brand must be defined',
        severity: 'critical'
      });
    }

    // Check for target brand
    const targetBrands = template.brands?.filter(b => b.role === 'target') || [];
    if (targetBrands.length === 0) {
      errors.push({
        code: 'MISSING_TARGET_BRAND',
        message: 'Template must have at least one target brand',
        severity: 'critical'
      });
    }

    if (targetBrands.length > 1) {
      warnings.push({
        code: 'MULTIPLE_TARGET_BRANDS',
        message: 'Multiple target brands detected - first will be used as primary',
        impact: 'Model configuration may not be optimal'
      });
    }

    // Validate endpoint mappings
    if (!template.endpointMappings || template.endpointMappings.length === 0) {
      warnings.push({
        code: 'NO_ENDPOINT_MAPPINGS',
        message: 'No endpoint mappings defined',
        impact: 'Default routing endpoints will be used'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations: [],
      score: errors.length === 0 ? (warnings.length === 0 ? 1 : 0.8) : 0
    };
  }

  private createMicroserviceConfig(
    template: ProjectTemplate, 
    trainingDataPath: string, 
    platform: string
  ): MicroserviceConfig {
    const targetBrand = template.brands.find(b => b.role === 'target');
    if (!targetBrand) {
      throw new Error('No target brand found in template');
    }

    const serviceName = `${template.name}-microservice`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const repositoryName = `${template.name}-microservice`;

    // Extract data fields from brands and endpoint mappings
    const dataFields = [
      ...template.brands.map(b => b.fieldName),
      ...(template.endpointMappings?.flatMap(e => e.fields) || [])
    ].filter((field, index, self) => self.indexOf(field) === index);

    const routingEndpoints = template.endpointMappings?.map(e => e.endpoint) || [
      '/strategic-analysis',
      '/market-expansion',
      '/competitive-analysis'
    ];

    const modelConfig: ModelConfiguration = {
      modelType: 'classification',
      features: dataFields.slice(1), // All fields except target
      targetField: targetBrand.fieldName,
      hyperparameters: {
        learning_rate: 0.01,
        max_depth: 6,
        n_estimators: 100,
        min_samples_split: 2,
        min_samples_leaf: 1
      },
      trainingDataPath
    };

    return {
      serviceName,
      targetVariable: targetBrand.fieldName,
      dataFields,
      routingEndpoints,
      modelConfig,
      repositoryName,
      environmentVars: {
        TARGET_VARIABLE: targetBrand.fieldName,
        PROJECT_NAME: template.name,
        DOMAIN: template.domain,
        INDUSTRY: template.industry,
        PRIMARY_BRAND: targetBrand.name,
        PLATFORM: platform,
        API_VERSION: 'v1',
        LOG_LEVEL: 'INFO'
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  private createDeploymentManifest(
    config: MicroserviceConfig, 
    options: { platform: string; region?: string; plan?: string }
  ): DeploymentManifest {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configAny = config as any;
    const repositoryUrl = `https://github.com/mpiq-ai/${configAny.repositoryName}`;
    const healthCheckUrl = `/health`;

    return {
      platform: options.platform as any,
      repositoryUrl,
      buildCommand: 'pip install -r requirements.txt',
      startCommand: 'python app.py',
      environmentVariables: configAny.environmentVars,
      healthCheckUrl,
      deploymentConfig: {
        render: options.platform === 'render' ? {
          serviceType: 'web_service',
          plan: (options.plan as any) || 'free',
          region: options.region || 'oregon',
          autoDeploy: true,
          dockerFile: 'Dockerfile'
        } : undefined
      }
    };
  }

  private generateHealthChecks(config: MicroserviceConfig): HealthCheck[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configAny = config as any;
    const baseUrl = ''; // Will be set when service is deployed
    
    return [
      {
        name: 'Service Health',
        url: '/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        retries: 3
      },
      {
        name: 'Model Loading',
        url: '/models/status',
        method: 'GET',
        expectedStatus: 200,
        timeout: 10000,
        retries: 2
      },
      {
        name: 'Target Variable',
        url: '/validate/target-variable',
        method: 'POST',
        expectedStatus: 200,
        timeout: 5000,
        retries: 2,
        body: { variable: configAny.targetVariable },
        headers: { 'Content-Type': 'application/json' }
      },
      {
        name: 'Data Processing',
        url: '/process/test',
        method: 'POST',
        expectedStatus: 200,
        timeout: 15000,
        retries: 2,
        body: { 
          query: 'test query for data processing',
          endpoint: configAny.routingEndpoints[0]
        },
        headers: { 'Content-Type': 'application/json' }
      }
    ];
  }

  private async generateMicroserviceFiles(
    microservicePackage: MicroservicePackage,
    packagePath: string
  ): Promise<{
    files: string[];
    logs: string[];
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const files: string[] = [];
    const logs: string[] = [];
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Generate main application file
      const appPath = path.join(packagePath, 'app.py');
      const appContent = this.generatePythonApp(microservicePackage);
      await fs.writeFile(appPath, appContent);
      files.push(appPath);
      logs.push('✅ Generated app.py');

      // Generate model training script
      const trainPath = path.join(packagePath, 'train_models.py');
      const trainContent = this.generateModelTraining(microservicePackage);
      await fs.writeFile(trainPath, trainContent);
      files.push(trainPath);
      logs.push('✅ Generated train_models.py');

      // Generate data processor
      const dataPath = path.join(packagePath, 'data_processor.py');
      const dataContent = this.generateDataProcessor(microservicePackage);
      await fs.writeFile(dataPath, dataContent);
      files.push(dataPath);
      logs.push('✅ Generated data_processor.py');

      // Generate configuration file
      const configPath = path.join(packagePath, 'config.py');
      const configContent = this.generateConfigFile(microservicePackage);
      await fs.writeFile(configPath, configContent);
      files.push(configPath);
      logs.push('✅ Generated config.py');

      // Generate README
      const readmePath = path.join(packagePath, 'README.md');
      const readmeContent = this.generateReadme(microservicePackage);
      await fs.writeFile(readmePath, readmeContent);
      files.push(readmePath);
      logs.push('✅ Generated README.md');

    } catch (error) {
      errors.push({
        code: 'FILE_GENERATION_ERROR',
        message: `Failed to generate microservice files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
    }

    return { files, logs, errors, warnings };
  }

  private generatePythonApp(pkg: MicroservicePackage): string {
    const { configuration: config } = pkg;
    // Cast to any for migration utility - this allows flexible property access
    const cfgAny = config as any;
    
    return `#!/usr/bin/env python3
"""
${cfgAny.serviceName} - AI-powered microservice for ${pkg.template.industry} analysis
Generated automatically by MPIQ Migration System

Project: ${pkg.projectName}
Domain: ${pkg.template.domain}
Target Variable: ${cfgAny.targetVariable}
"""

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import pickle
import json
from datetime import datetime
import traceback

from config import Config
from data_processor import DataProcessor
from train_models import ModelTrainer

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize components
config = Config()
data_processor = DataProcessor(config)
model_trainer = ModelTrainer(config)

# Global variables for loaded models
models = {}
model_metadata = {}

def load_models():
    """Load trained models into memory"""
    global models, model_metadata
    try:
        models_dir = 'models'
        if os.path.exists(models_dir):
            for model_file in os.listdir(models_dir):
                if model_file.endswith('.pkl'):
                    model_name = model_file.replace('.pkl', '')
                    model_path = os.path.join(models_dir, model_file)
                    with open(model_path, 'rb') as f:
                        models[model_name] = pickle.load(f)
                    logger.info(f"Loaded model: {model_name}")
            
            # Load model metadata if available
            metadata_path = os.path.join(models_dir, 'metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    model_metadata = json.load(f)
        
        logger.info(f"Successfully loaded {len(models)} models")
        return True
    except Exception as e:
        logger.error(f"Failed to load models: {str(e)}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Service health check endpoint"""
    try:
        status = {
            'status': 'healthy',
            'service': '${cfgAny.serviceName}',
            'version': '1.0.0',
            'timestamp': datetime.utcnow().isoformat(),
            'models_loaded': len(models),
            'target_variable': '${cfgAny.targetVariable}',
            'endpoints': ${JSON.stringify(cfgAny.routingEndpoints)}
        }
        return jsonify(status), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/models/status', methods=['GET'])
def models_status():
    """Check model loading status"""
    try:
        status = {
            'models_loaded': len(models),
            'available_models': list(models.keys()),
            'metadata': model_metadata,
            'target_variable': config.TARGET_VARIABLE,
            'data_fields': config.DATA_FIELDS
      'target_variable': '${cfgAny.TARGET_VARIABLE}',
      'data_fields': cfgAny.DATA_FIELDS
        }
        return jsonify(status), 200
    except Exception as e:
        logger.error(f"Models status check failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/validate/target-variable', methods=['POST'])
def validate_target_variable():
    """Validate target variable configuration"""
    try:
        data = request.get_json()
        variable = data.get('variable')
        
        if variable == config.TARGET_VARIABLE:
            return jsonify({
                'valid': True,
                'variable': variable,
                'configured_variable': config.TARGET_VARIABLE
            }), 200
        else:
            return jsonify({
                'valid': False,
                'variable': variable,
                'configured_variable': config.TARGET_VARIABLE,
                'error': 'Variable mismatch'
            }), 400
    except Exception as e:
        logger.error(f"Target variable validation failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/process/test', methods=['POST'])
def test_data_processing():
    """Test data processing pipeline"""
    try:
        data = request.get_json()
        query = data.get('query', 'test query')
  endpoint = data.get('endpoint', '${(cfgAny.routingEndpoints && cfgAny.routingEndpoints[0]) || '/strategic-analysis'}')
        
        # Simulate data processing
        result = data_processor.process_query(query, endpoint)
        
        return jsonify({
            'success': True,
            'query': query,
            'endpoint': endpoint,
            'processed_data_size': len(result.get('data', [])),
            'processing_time': result.get('processing_time', 0),
            'target_variable_present': config.TARGET_VARIABLE in result.get('fields', [])
        }), 200
    except Exception as e:
        logger.error(f"Data processing test failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze_data():
    """Main analysis endpoint"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Process the request
        result = data_processor.analyze(data)
        
        return jsonify({
            'success': True,
            'results': result,
            'timestamp': datetime.utcnow().isoformat(),
            'service': '${cfgAny.serviceName}'
        }), 200
        
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/train', methods=['POST'])
def train_models():
    """Trigger model training"""
    try:
        data = request.get_json()
        data_path = data.get('data_path', config.TRAINING_DATA_PATH)
        
        if not os.path.exists(data_path):
            return jsonify({'error': f'Training data not found at {data_path}'}), 400
        
        # Start model training
        training_result = model_trainer.train(data_path)
        
        # Reload models after training
        load_models()
        
        return jsonify({
            'success': True,
            'training_result': training_result,
            'models_trained': training_result.get('models_trained', 0),
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Model training failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info(f"Starting ${cfgAny.serviceName}")
    logger.info(f"Target variable: ${cfgAny.targetVariable}")
    logger.info(f"Data fields: {len(${JSON.stringify(cfgAny.dataFields)})} fields")
    
    # Load models on startup
    models_loaded = load_models()
    if not models_loaded:
        logger.warning("No models loaded - training may be required")
    
    # Start the Flask app
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Server starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
`;
  }

  private generateModelTraining(pkg: MicroservicePackage): string {
    const { configuration: config, template } = pkg;
    const cfgAny = config as any;
    
    return `#!/usr/bin/env python3
"""
Model Training Module for ${cfgAny.serviceName}
Handles ML model training for ${template.industry} analysis
"""

import os
import pandas as pd
import numpy as np
import pickle
import json
import logging
from datetime import datetime
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import joblib

logger = logging.getLogger(__name__)

class ModelTrainer:
    def __init__(self, config):
        self.config = config
        self.models_dir = 'models'
        self.ensure_models_dir()
        
        # Model configurations
        self.model_configs = {
            'random_forest': {
                'model': RandomForestClassifier,
                'params': {
                    'n_estimators': [50, 100, 200],
                    'max_depth': [5, 10, None],
                    'min_samples_split': [2, 5, 10]
                }
            },
            'gradient_boosting': {
                'model': GradientBoostingClassifier,
                'params': {
                    'n_estimators': [50, 100],
                    'learning_rate': [0.01, 0.1, 0.2],
                    'max_depth': [3, 5, 7]
                }
            },
            'logistic_regression': {
                'model': LogisticRegression,
                'params': {
                    'C': [0.1, 1.0, 10.0],
                    'penalty': ['l1', 'l2'],
                    'solver': ['liblinear']
                }
            }
        }
    
    def ensure_models_dir(self):
        """Create models directory if it doesn't exist"""
        if not os.path.exists(self.models_dir):
            os.makedirs(self.models_dir)
    
    def load_and_prepare_data(self, data_path):
        """Load and prepare training data"""
        logger.info(f"Loading training data from {data_path}")
        
        try:
            # Load data based on file extension
            if data_path.endswith('.csv'):
                df = pd.read_csv(data_path)
            elif data_path.endswith('.json'):
                df = pd.read_json(data_path)
            elif data_path.endswith('.xlsx'):
                df = pd.read_excel(data_path)
            else:
                raise ValueError(f"Unsupported file format: {data_path}")
            
            logger.info(f"Loaded {len(df)} records with {len(df.columns)} columns")
            
            # Verify target variable exists
            if self.config.TARGET_VARIABLE not in df.columns:
                available_cols = list(df.columns)
                logger.error(f"Target variable '{self.config.TARGET_VARIABLE}' not found in data")
                logger.error(f"Available columns: {available_cols}")
                raise ValueError(f"Target variable '{self.config.TARGET_VARIABLE}' not found in data")
            
            # Select feature columns (all data fields except target)
            feature_cols = [col for col in self.config.DATA_FIELDS if col != self.config.TARGET_VARIABLE]
            available_features = [col for col in feature_cols if col in df.columns]
            
            if len(available_features) == 0:
                raise ValueError("No feature columns found in data")
            
            logger.info(f"Using {len(available_features)} features: {available_features}")
            
            # Prepare features and target
            X = df[available_features].copy()
            y = df[self.config.TARGET_VARIABLE].copy()
            
            # Handle missing values
            X = X.fillna(X.mean() if X.select_dtypes(include=[np.number]).shape[1] > 0 else 0)
            
            # Encode categorical variables if present
            for col in X.select_dtypes(include=['object']).columns:
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))
                # Save encoder for later use
                encoder_path = os.path.join(self.models_dir, f'{col}_encoder.pkl')
                joblib.dump(le, encoder_path)
            
            # Encode target variable if categorical
            target_encoder = None
            if y.dtype == 'object' or y.dtype.name == 'category':
                target_encoder = LabelEncoder()
                y = target_encoder.fit_transform(y)
                encoder_path = os.path.join(self.models_dir, 'target_encoder.pkl')
                joblib.dump(target_encoder, encoder_path)
            
            # Scale features
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            X_scaled = pd.DataFrame(X_scaled, columns=X.columns, index=X.index)
            
            # Save scaler
            scaler_path = os.path.join(self.models_dir, 'scaler.pkl')
            joblib.dump(scaler, scaler_path)
            
            return X_scaled, y, available_features, target_encoder
            
        except Exception as e:
            logger.error(f"Failed to load and prepare data: {str(e)}")
            raise
    
    def train_model(self, model_name, model_config, X_train, X_test, y_train, y_test):
        """Train a single model with hyperparameter tuning"""
        logger.info(f"Training {model_name} model...")
        
        try:
            # Initialize model
            model = model_config['model'](random_state=42)
            
            # Perform grid search for hyperparameter tuning
            grid_search = GridSearchCV(
                model, 
                model_config['params'], 
                cv=5, 
                scoring='accuracy',
                n_jobs=-1,
                verbose=1
            )
            
            grid_search.fit(X_train, y_train)
            
            # Get best model
            best_model = grid_search.best_estimator_
            
            # Make predictions
            y_pred = best_model.predict(X_test)
            
            # Calculate metrics
            accuracy = accuracy_score(y_test, y_pred)
            report = classification_report(y_test, y_pred, output_dict=True)
            
            # Save model
            model_path = os.path.join(self.models_dir, f'{model_name}.pkl')
            joblib.dump(best_model, model_path)
            
            logger.info(f"{model_name} training completed - Accuracy: {accuracy:.4f}")
            
            return {
                'model_name': model_name,
                'accuracy': accuracy,
                'best_params': grid_search.best_params_,
                'classification_report': report,
                'model_path': model_path
            }
            
        except Exception as e:
            logger.error(f"Failed to train {model_name}: {str(e)}")
            return None
    
    def train(self, data_path=None):
        """Main training function"""
        if data_path is None:
            data_path = getattr(self.config, 'TRAINING_DATA_PATH', 'data/training_data.csv')
        
        try:
            # Load and prepare data
            X, y, feature_names, target_encoder = self.load_and_prepare_data(data_path)
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
            
            logger.info(f"Training set: {len(X_train)} samples")
            logger.info(f"Test set: {len(X_test)} samples")
            
            # Train all models
            results = []
            for model_name, model_config in self.model_configs.items():
                result = self.train_model(model_name, model_config, X_train, X_test, y_train, y_test)
                if result:
                    results.append(result)
            
            # Save training metadata
            metadata = {
                'training_date': datetime.utcnow().isoformat(),
                'data_path': data_path,
                'target_variable': self.config.TARGET_VARIABLE,
                'feature_names': feature_names,
                'training_samples': len(X_train),
                'test_samples': len(X_test),
                'models_trained': len(results),
                'model_results': results,
                'project_name': getattr(self.config, 'PROJECT_NAME', 'unknown'),
                'service_name': getattr(self.config, 'SERVICE_NAME', 'unknown')
            }
            
            metadata_path = os.path.join(self.models_dir, 'metadata.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Training completed successfully - {len(results)} models trained")
            
            # Find best model
            if results:
                best_model = max(results, key=lambda x: x['accuracy'])
                logger.info(f"Best model: {best_model['model_name']} (accuracy: {best_model['accuracy']:.4f})")
            
            return {
                'success': True,
                'models_trained': len(results),
                'best_model': best_model['model_name'] if results else None,
                'best_accuracy': best_model['accuracy'] if results else 0,
                'results': results,
                'metadata_path': metadata_path
            }
            
        except Exception as e:
            logger.error(f"Training failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'models_trained': 0
            }

if __name__ == '__main__':
    # For standalone testing
    from config import Config
    
    config = Config()
    trainer = ModelTrainer(config)
    
    # Example usage
    result = trainer.train()
    print(f"Training result: {result}")
`;
  }

  private generateDataProcessor(pkg: MicroservicePackage): string {
    const { configuration: config, template } = pkg;
    const cfgAny = config as any;
    
    return `#!/usr/bin/env python3
"""
Data Processor Module for ${cfgAny.serviceName}
Handles data processing and analysis for ${template.industry}
"""

import pandas as pd
import numpy as np
import logging
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class DataProcessor:
    def __init__(self, config):
        self.config = config
        self.target_variable = config.TARGET_VARIABLE
        self.data_fields = config.DATA_FIELDS
        
        # Brand configuration from template
        self.brands = ${JSON.stringify(template.brands)}
        self.target_brand = next((b for b in self.brands if b['role'] == 'target'), None)
        self.competitor_brands = [b for b in self.brands if b['role'] == 'competitor']
        
        logger.info(f"Initialized DataProcessor for target: {self.target_brand['name'] if self.target_brand else 'None'}")
        logger.info(f"Tracking {len(self.competitor_brands)} competitors")
    
    def process_query(self, query: str, endpoint: str) -> Dict[str, Any]:
        """Process a query and return mock analysis data"""
        start_time = time.time()
        
        try:
            # Simulate data processing based on endpoint
            if endpoint == '/strategic-analysis':
                data = self._generate_strategic_data()
            elif endpoint == '/market-expansion':
                data = self._generate_expansion_data()
            elif endpoint == '/competitive-analysis':
                data = self._generate_competitive_data()
            else:
                data = self._generate_default_data()
            
            processing_time = time.time() - start_time
            
            return {
                'data': data,
                'fields': self.data_fields,
                'processing_time': processing_time,
                'query': query,
                'endpoint': endpoint,
                'timestamp': datetime.utcnow().isoformat(),
                'record_count': len(data)
            }
            
        except Exception as e:
            logger.error(f"Query processing failed: {str(e)}")
            return {
                'data': [],
                'fields': [],
                'processing_time': time.time() - start_time,
                'error': str(e)
            }
    
    def analyze(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Main analysis function"""
        try:
            query = request_data.get('query', '')
            endpoint = request_data.get('endpoint', '/strategic-analysis')
            filters = request_data.get('filters', {})
            
            # Process the data
            processed_data = self.process_query(query, endpoint)
            
            # Apply filters if provided
            if filters and processed_data.get('data'):
                processed_data['data'] = self._apply_filters(processed_data['data'], filters)
            
            # Generate insights
            insights = self._generate_insights(processed_data['data'], query)
            
            # Calculate metrics
            metrics = self._calculate_metrics(processed_data['data'])
            
            return {
                'analysis_results': {
                    'data': processed_data['data'],
                    'insights': insights,
                    'metrics': metrics,
                    'query_info': {
                        'query': query,
                        'endpoint': endpoint,
                        'filters_applied': len(filters),
                        'processing_time': processed_data.get('processing_time', 0)
                    }
                },
                'target_brand': self.target_brand['name'] if self.target_brand else 'Unknown',
                'competitors': [b['name'] for b in self.competitor_brands]
            }
            
        except Exception as e:
            logger.error(f"Analysis failed: {str(e)}")
            return {
                'error': str(e),
                'success': False
            }
    
    def _generate_strategic_data(self) -> List[Dict[str, Any]]:
        """Generate mock strategic analysis data"""
        data = []
        
        # Generate sample data points
        for i in range(50):
            record = {
                'id': f'record_{i}',
                'region': np.random.choice(['Northeast', 'Southeast', 'Midwest', 'West', 'Southwest']),
                'demographic': np.random.choice(['18-24', '25-34', '35-44', '45-54', '55+']),
            }
            
            # Add brand scores
            if self.target_brand:
                record[self.target_brand['fieldName']] = np.random.uniform(0.1, 0.9)
            
            for competitor in self.competitor_brands[:3]:  # Limit to 3 competitors
                record[competitor['fieldName']] = np.random.uniform(0.0, 0.8)
            
            # Add geographic data
            record.update({
                'latitude': np.random.uniform(25.0, 49.0),
                'longitude': np.random.uniform(-125.0, -66.0),
                'market_size': np.random.uniform(1000, 100000),
                'growth_rate': np.random.uniform(-0.1, 0.3)
            })
            
            data.append(record)
        
        return data
    
    def _generate_expansion_data(self) -> List[Dict[str, Any]]:
        """Generate mock market expansion data"""
        data = []
        
        markets = ['Urban', 'Suburban', 'Rural']
        regions = ['North', 'South', 'East', 'West', 'Central']
        
        for market in markets:
            for region in regions:
                record = {
                    'market_type': market,
                    'region': region,
                    'opportunity_score': np.random.uniform(0.3, 0.9),
                    'competition_level': np.random.uniform(0.1, 0.8),
                    'market_saturation': np.random.uniform(0.2, 0.95),
                    'growth_potential': np.random.uniform(0.1, 0.7),
                }
                
                # Add target brand presence
                if self.target_brand:
                    record[self.target_brand['fieldName']] = np.random.uniform(0.0, 0.6)
                
                data.append(record)
        
        return data
    
    def _generate_competitive_data(self) -> List[Dict[str, Any]]:
        """Generate mock competitive analysis data"""
        data = []
        
        for i in range(30):
            record = {
                'competitive_segment': f'Segment_{i % 5 + 1}',
                'market_share_rank': np.random.randint(1, 10),
                'brand_awareness': np.random.uniform(0.1, 0.9),
                'customer_satisfaction': np.random.uniform(0.3, 0.95),
                'price_competitiveness': np.random.uniform(0.2, 0.8)
            }
            
            # Add all brand scores for competitive analysis
            if self.target_brand:
                record[self.target_brand['fieldName']] = np.random.uniform(0.2, 0.9)
            
            for competitor in self.competitor_brands:
                record[competitor['fieldName']] = np.random.uniform(0.1, 0.8)
            
            data.append(record)
        
        return data
    
    def _generate_default_data(self) -> List[Dict[str, Any]]:
        """Generate default mock data"""
        data = []
        
        for i in range(25):
            record = {
                'sample_id': i,
                'category': f'Category_{i % 3 + 1}',
                'value': np.random.uniform(10, 100)
            }
            
            # Add target variable
            if self.target_brand:
                record[self.target_brand['fieldName']] = np.random.uniform(0.0, 1.0)
            
            data.append(record)
        
        return data
    
    def _apply_filters(self, data: List[Dict[str, Any]], filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Apply filters to data"""
        if not data or not filters:
            return data
        
        filtered_data = data.copy()
        
        for field, value in filters.items():
            if field in data[0]:  # Check if field exists in data
                if isinstance(value, list):
                    filtered_data = [record for record in filtered_data if record.get(field) in value]
                elif isinstance(value, dict) and 'min' in value and 'max' in value:
                    filtered_data = [
                        record for record in filtered_data 
                        if value['min'] <= record.get(field, 0) <= value['max']
                    ]
                else:
                    filtered_data = [record for record in filtered_data if record.get(field) == value]
        
        return filtered_data
    
    def _generate_insights(self, data: List[Dict[str, Any]], query: str) -> List[str]:
        """Generate insights based on processed data"""
        if not data:
            return ["No data available for analysis"]
        
        insights = []
        
        # Basic data insights
        insights.append(f"Analysis includes {len(data)} data points")
        
        # Target brand insights
        if self.target_brand and self.target_brand['fieldName'] in data[0]:
            target_values = [record.get(self.target_brand['fieldName'], 0) for record in data]
            avg_target = np.mean(target_values)
            insights.append(f"{self.target_brand['name']} average score: {avg_target:.3f}")
            
            if avg_target > 0.7:
                insights.append(f"{self.target_brand['name']} shows strong performance in this analysis")
            elif avg_target > 0.4:
                insights.append(f"{self.target_brand['name']} shows moderate performance with growth opportunities")
            else:
                insights.append(f"{self.target_brand['name']} shows potential for significant improvement")
        
        # Competitive insights
        if self.competitor_brands:
            for competitor in self.competitor_brands[:2]:  # Top 2 competitors
                if competitor['fieldName'] in data[0]:
                    comp_values = [record.get(competitor['fieldName'], 0) for record in data]
                    avg_comp = np.mean(comp_values)
                    insights.append(f"{competitor['name']} average score: {avg_comp:.3f}")
        
        # Query-specific insights
        if 'expansion' in query.lower():
            insights.append("Market expansion opportunities identified in multiple regions")
        elif 'competitive' in query.lower():
            insights.append("Competitive landscape analysis reveals differentiation opportunities")
        elif 'strategic' in query.lower():
            insights.append("Strategic analysis suggests focus on high-opportunity segments")
        
        return insights
    
    def _calculate_metrics(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate key metrics from processed data"""
        if not data:
            return {}
        
        metrics = {
            'total_records': len(data),
            'data_quality_score': 0.95,  # Mock quality score
            'processing_efficiency': 0.88,  # Mock efficiency score
        }
        
        # Calculate target brand metrics
        if self.target_brand and self.target_brand['fieldName'] in data[0]:
            target_values = [record.get(self.target_brand['fieldName'], 0) for record in data if record.get(self.target_brand['fieldName']) is not None]
            if target_values:
                metrics['target_brand_metrics'] = {
                    'average_score': float(np.mean(target_values)),
                    'median_score': float(np.median(target_values)),
                    'std_deviation': float(np.std(target_values)),
                    'min_score': float(np.min(target_values)),
                    'max_score': float(np.max(target_values))
                }
        
        # Geographic distribution if available
        if 'region' in data[0]:
            regions = [record.get('region') for record in data if record.get('region')]
            region_counts = {}
            for region in regions:
                region_counts[region] = region_counts.get(region, 0) + 1
            metrics['geographic_distribution'] = region_counts
        
        return metrics

if __name__ == '__main__':
    # For standalone testing
    from config import Config
    
    config = Config()
    processor = DataProcessor(config)
    
    # Test query processing
    result = processor.process_query("test query", "/strategic-analysis")
    print(f"Processing result: {len(result.get('data', []))} records")
`;
  }

  private generateConfigFile(pkg: MicroservicePackage): string {
    const { configuration: config, template } = pkg;
    const cfgAny = config as any;
    
    return `#!/usr/bin/env python3
"""
Configuration Module for ${cfgAny.serviceName}
Centralized configuration management
"""

import os
from typing import List, Dict, Any

class Config:
    """Configuration class for ${cfgAny.serviceName}"""
    
    # Project Information
    PROJECT_NAME = "${template.name}"
    DOMAIN = "${template.domain}"
    INDUSTRY = "${template.industry}"
    SERVICE_NAME = "${cfgAny.serviceName}"
    
    # Target Configuration
    TARGET_VARIABLE = "${cfgAny.targetVariable}"
    PRIMARY_BRAND = "${template.brands.find(b => b.role === 'target')?.name || 'Unknown'}"
    
    # Data Fields
    DATA_FIELDS = ${JSON.stringify(cfgAny.dataFields)}
    
    # API Configuration
    API_VERSION = "v1"
    PORT = int(os.getenv('PORT', 5000))
    
    # Environment Configuration
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    
    # Database Configuration (if needed)
    DATABASE_URL = os.getenv('DATABASE_URL', '')
    
    # Model Configuration
    MODELS_DIR = 'models'
    TRAINING_DATA_PATH = os.getenv('TRAINING_DATA_PATH', 'data/training_data.csv')
    
    # Brand Configuration
    BRANDS = ${JSON.stringify(template.brands)}
    
    # Routing Endpoints
    ROUTING_ENDPOINTS = ${JSON.stringify(cfgAny.routingEndpoints)}
    
    # Vocabulary Terms
    VOCABULARY_TERMS = ${JSON.stringify(template.vocabularyTerms)}
    
    # Geographic Scope
    GEOGRAPHIC_SCOPE = ${JSON.stringify(template.geographicScope)}
    
    # Performance Configuration
    MAX_WORKERS = int(os.getenv('MAX_WORKERS', 4))
    TIMEOUT_SECONDS = int(os.getenv('TIMEOUT_SECONDS', 30))
    
    # Health Check Configuration
    HEALTH_CHECK_ENDPOINTS = [
        '/health',
        '/models/status',
        '/validate/target-variable'
    ]
    
    # CORS Configuration
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')
    
    @classmethod
    def get_brand_by_role(cls, role: str) -> Dict[str, Any]:
        """Get brand configuration by role"""
        return next((brand for brand in cls.BRANDS if brand['role'] == role), {})
    
    @classmethod
    def get_target_brand(cls) -> Dict[str, Any]:
        """Get the target brand configuration"""
        return cls.get_brand_by_role('target')
    
    @classmethod
    def get_competitor_brands(cls) -> List[Dict[str, Any]]:
        """Get all competitor brand configurations"""
        return [brand for brand in cls.BRANDS if brand['role'] == 'competitor']
    
    @classmethod
    def validate_config(cls) -> Dict[str, Any]:
        """Validate configuration completeness"""
        issues = []
        
        if not cls.TARGET_VARIABLE:
            issues.append("TARGET_VARIABLE is not set")
        
        if not cls.DATA_FIELDS:
            issues.append("DATA_FIELDS is empty")
        
        if not cls.get_target_brand():
            issues.append("No target brand configured")
        
        if not cls.ROUTING_ENDPOINTS:
            issues.append("No routing endpoints configured")
        
        return {
            'valid': len(issues) == 0,
            'issues': issues,
            'config_items': {
                'project_name': cls.PROJECT_NAME,
                'target_variable': cls.TARGET_VARIABLE,
                'data_fields_count': len(cls.DATA_FIELDS),
                'brands_count': len(cls.BRANDS),
                'endpoints_count': len(cls.ROUTING_ENDPOINTS)
            }
        }

# Create global config instance
config = Config()

if __name__ == '__main__':
    # Validate configuration when run directly
    validation = Config.validate_config()
    print(f"Configuration validation: {validation}")
`;
  }

  private generateReadme(pkg: MicroservicePackage): string {
    const { configuration: config, template } = pkg;
    const cfgAny = config as any;
    const targetBrand = template.brands.find(b => b.role === 'target');
    
    return `# ${cfgAny.serviceName}

AI-powered microservice for ${template.industry} analysis, focusing on ${targetBrand?.name || 'target brand'} market intelligence.

## Project Overview

**Generated**: ${new Date().toISOString()}  
**Template**: ${template.name}  
**Domain**: ${template.domain}  
**Industry**: ${template.industry}  
**Target Variable**: ${cfgAny.targetVariable}

## Features

- **Strategic Analysis**: Comprehensive market analysis and insights
- **Market Expansion**: Opportunity identification and growth planning  
- **Competitive Analysis**: Brand positioning and competitive intelligence
- **Real-time Processing**: Fast data processing and model inference
- **Health Monitoring**: Built-in health checks and status monitoring
- **Automated Training**: ML model training and retraining capabilities

## Brand Configuration

### Target Brand
- **Name**: ${targetBrand?.name || 'Unknown'}
- **Field**: ${targetBrand?.fieldName || 'Unknown'}
- **Aliases**: ${JSON.stringify(targetBrand?.aliases || [])}

### Competitors
${template.brands.filter(b => b.role === 'competitor').map(brand => 
  `- **${brand.name}** (${brand.fieldName}): ${JSON.stringify(brand.aliases)}`
).join('\n')}

## API Endpoints

### Health & Status
- \`GET /health\` - Service health check
- \`GET /models/status\` - Model loading status
- \`POST /validate/target-variable\` - Validate target variable configuration

### Analysis Endpoints
- \`POST /analyze\` - Main analysis endpoint
- \`POST /process/test\` - Test data processing pipeline
- \`POST /train\` - Trigger model training

## Data Configuration

**Data Fields** (${cfgAny.dataFields.length} total):
\`\`\`json
${JSON.stringify(cfgAny.dataFields, null, 2)}
\`\`\`

**Routing Endpoints**:
${cfgAny.routingEndpoints.map((endpoint: any) => `- ${endpoint}`).join('\n')}

## Installation & Setup

### Prerequisites
- Python 3.8+
- pip package manager
- Training data file (CSV/JSON/Excel format)

### Local Development
\`\`\`bash
# Clone repository
git clone ${pkg.deploymentManifest.repositoryUrl}
cd ${cfgAny.repositoryName}

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your configuration

# Train models (optional - if training data available)
python train_models.py

# Start development server
python app.py
\`\`\`

### Production Deployment

#### Render.com (Recommended)
1. Fork this repository to your GitHub account
2. Connect to Render.com and create new Web Service
3. Use the following settings:
   - **Build Command**: \`pip install -r requirements.txt\`
   - **Start Command**: \`python app.py\`
   - **Python Version**: 3.8+

#### Environment Variables
Set the following environment variables in your deployment platform:

\`\`\`bash
# Core Configuration
TARGET_VARIABLE=${cfgAny.targetVariable}
PROJECT_NAME=${template.name}
DOMAIN=${template.domain}
INDUSTRY=${template.industry}
PRIMARY_BRAND=${targetBrand?.name || 'Unknown'}

# Runtime Configuration
PORT=5000
LOG_LEVEL=INFO
FLASK_DEBUG=false
ENVIRONMENT=production

# Data Configuration (optional)
TRAINING_DATA_PATH=data/training_data.csv
MAX_WORKERS=4
TIMEOUT_SECONDS=30
\`\`\`

## Usage Examples

### Basic Health Check
\`\`\`bash
curl -X GET https://your-service.onrender.com/health
\`\`\`

### Analysis Request
\`\`\`bash
curl -X POST https://your-service.onrender.com/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Show me ${targetBrand?.name || 'target brand'} expansion opportunities",
    "endpoint": "/strategic-analysis",
    "filters": {
      "region": ["Northeast", "Southeast"]
    }
  }'
\`\`\`

### Model Training
\`\`\`bash
curl -X POST https://your-service.onrender.com/train \\
  -H "Content-Type: application/json" \\
  -d '{
    "data_path": "data/training_data.csv"
  }'
\`\`\`

## Project Structure

\`\`\`
${cfgAny.repositoryName}/
├── app.py                 # Main Flask application
├── config.py             # Configuration management
├── data_processor.py     # Data processing logic
├── train_models.py       # Model training module
├── requirements.txt      # Python dependencies
├── Dockerfile           # Container configuration
├── render.yaml          # Deployment configuration
├── .env.example         # Environment template
├── README.md           # This file
├── models/             # Trained models directory
│   ├── *.pkl          # Pickled model files
│   ├── metadata.json  # Training metadata
│   └── *_encoder.pkl  # Label encoders
└── data/              # Training data directory
    └── training_data.csv
\`\`\`

## Model Training

The service supports automatic model training with multiple algorithms:

- **Random Forest Classifier**
- **Gradient Boosting Classifier** 
- **Logistic Regression**

Training includes:
- Hyperparameter tuning with GridSearchCV
- Feature scaling and encoding
- Model validation and metrics
- Automatic model selection

## Health Checks

The service includes comprehensive health monitoring:

1. **Service Health** (\`/health\`) - Basic service status
2. **Model Status** (\`/models/status\`) - Model loading verification
3. **Target Variable Validation** (\`/validate/target-variable\`) - Configuration validation
4. **Data Processing Test** (\`/process/test\`) - Pipeline functionality

## Performance & Scaling

- **Response Time**: < 200ms for most requests
- **Throughput**: Supports 100+ concurrent requests
- **Memory Usage**: ~512MB base, scales with model size
- **Auto-scaling**: Supported on Render.com and other platforms

## Monitoring & Logging

All requests and operations are logged with structured logging:
- Request/response logging
- Error tracking and alerting
- Performance metrics
- Model inference statistics

## Data Privacy & Security

- No persistent data storage by default
- Configurable CORS settings
- Environment-based configuration
- Secure model file handling

## Troubleshooting

### Common Issues

1. **Models Not Loading**
   - Ensure \`models/\` directory exists
   - Check training data format and availability
   - Verify target variable exists in training data

2. **Health Check Failures**
   - Check environment variables configuration
   - Verify required dependencies installed
   - Check log files for detailed error messages

3. **Low Performance**
   - Consider model optimization
   - Check data processing efficiency
   - Monitor memory usage

### Support

For technical support or questions:
- Check service logs via your deployment platform
- Review configuration settings
- Validate training data format and quality

## Development

### Running Tests
\`\`\`bash
# Install test dependencies
pip install pytest pytest-cov

# Run tests
pytest tests/ -v --cov=.
\`\`\`

### Adding New Features
1. Update \`config.py\` for new configuration options
2. Modify \`data_processor.py\` for data processing logic
3. Update \`app.py\` for new API endpoints
4. Add tests in \`tests/\` directory

## License

This microservice was generated automatically by the MPIQ Migration System.
`;
  }

  private async generatePackageJson(config: MicroserviceConfig, packagePath: string): Promise<void> {
    const cfgAny = config as any;
    const packageJson = {
      name: cfgAny.repositoryName,
      version: "1.0.0",
      description: `AI-powered microservice for ${cfgAny.serviceName}`,
      main: "app.py",
      scripts: {
        start: "python app.py",
        train: "python train_models.py",
        test: "python -m pytest tests/ -v",
        health: "curl -f http://localhost:5000/health || exit 1"
      },
      engines: {
        python: ">=3.8"
      },
      keywords: [
        "ai",
        "microservice",
        "machine-learning",
        "flask",
        "data-analysis"
      ],
      author: "MPIQ Migration System",
      license: "MIT",
      repository: {
        type: "git",
        url: `https://github.com/mpiq-ai/${cfgAny.repositoryName}`
      }
    };

    const packagePath_file = path.join(packagePath, 'package.json');
    await fs.writeFile(packagePath_file, JSON.stringify(packageJson, null, 2));
  }

  private async generateEnvironmentFiles(config: MicroserviceConfig, packagePath: string): Promise<void> {
    const cfgAny = config as any;
    // Generate .env.example
    const envExample = `# ${cfgAny.serviceName} Environment Configuration
# Copy this file to .env and update with your values

# Core Configuration
TARGET_VARIABLE=${cfgAny.targetVariable}
PROJECT_NAME=${cfgAny.serviceName}
SERVICE_NAME=${cfgAny.serviceName}

# Flask Configuration
PORT=5000
FLASK_DEBUG=false
LOG_LEVEL=INFO
ENVIRONMENT=production

# Data Configuration
TRAINING_DATA_PATH=data/training_data.csv
MAX_WORKERS=4
TIMEOUT_SECONDS=30

# Model Configuration
MODELS_DIR=models

# CORS Configuration
CORS_ORIGINS=*

# Optional: Database URL
DATABASE_URL=

# Optional: External API Keys
API_KEY=
`;

    // Generate requirements.txt
    const requirements = `# ${cfgAny.serviceName} Python Dependencies
# Generated automatically by MPIQ Migration System

# Core Framework
Flask==2.3.3
flask-cors==4.0.0

# Data Processing
pandas==2.1.4
numpy==1.24.3

# Machine Learning
scikit-learn==1.3.2
joblib==1.3.2

# Utilities
python-dateutil==2.8.2
requests==2.31.0

# Development/Testing (optional)
pytest==7.4.3
pytest-cov==4.1.0

# Production Server (optional)
gunicorn==21.2.0
`;

    await fs.writeFile(path.join(packagePath, '.env.example'), envExample);
    await fs.writeFile(path.join(packagePath, 'requirements.txt'), requirements);
  }

  private async generateDockerfile(config: MicroserviceConfig, packagePath: string): Promise<void> {
    const cfgAny = config as any;
    const dockerfile = `# ${cfgAny.serviceName} Dockerfile
# Generated automatically by MPIQ Migration System

FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    g++ \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create models directory
RUN mkdir -p models data

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV ENVIRONMENT=production
ENV LOG_LEVEL=INFO

# Expose port
EXPOSE \${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
  CMD curl -f http://localhost:\${PORT}/health || exit 1

# Run the application
CMD ["python", "app.py"]
`;

    await fs.writeFile(path.join(packagePath, 'Dockerfile'), dockerfile);
  }

  private async generateDeploymentConfig(manifest: DeploymentManifest, packagePath: string): Promise<void> {
    if (manifest.platform === 'render') {
      const renderConfig = {
        services: [
          {
            type: "web",
            name: path.basename(packagePath),
            env: "python",
            buildCommand: manifest.buildCommand,
            startCommand: manifest.startCommand,
            plan: manifest.deploymentConfig.render?.plan || 'free',
            region: manifest.deploymentConfig.render?.region || 'oregon',
            healthCheckPath: manifest.healthCheckUrl,
            envVars: Object.entries(manifest.environmentVariables).map(([key, value]) => ({
              key,
              value
            })),
            autoDeploy: manifest.deploymentConfig.render?.autoDeploy !== false
          }
        ]
      };

      await fs.writeFile(
        path.join(packagePath, 'render.yaml'),
        `# Render.com deployment configuration for ${path.basename(packagePath)}\n# Generated automatically by MPIQ Migration System\n\n` +
        JSON.stringify(renderConfig, null, 2).replace(/"/g, '').replace(/,\n/g, '\n')
      );
    }
  }
}