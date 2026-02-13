// Migration Types & Interfaces
// Core types for the migration automation system

export interface ArcGISLayer {
  id: number;
  name: string;
  type: string;
  geometryType: 'esriGeometryPoint' | 'esriGeometryPolygon' | 'esriGeometryPolyline';
  fields: ArcGISField[];
  url: string;
  recordCount: number;
  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

export interface ArcGISField {
  name: string;
  type: 'esriFieldTypeOID' | 'esriFieldTypeString' | 'esriFieldTypeInteger' | 'esriFieldTypeDouble' | 'esriFieldTypeDate';
  alias: string;
  length?: number;
  nullable: boolean;
  editable: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  recommendations: string[];
  score: number; // 0-1, where 1 is perfect
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  impact: string;
  recommendation?: string;
}

export interface FieldDefinition {
  fieldName: string;
  endpoint: string;
  dataType: 'score' | 'demographic' | 'geographic' | 'competitive';
  required: boolean;
  description: string;
  aliases?: string[];
}

export interface BrandDefinition {
  name: string;
  fieldName: string;
  role: 'target' | 'competitor' | 'market_category';
  aliases: string[];
  industry?: string;
}

export interface ProjectTemplate {
  name: string;
  domain: string;
  industry: string;
  brands: BrandDefinition[];
  geographicScope: GeographicScope;
  vocabularyTerms: DomainVocabulary;
  endpointMappings: EndpointMapping[];
}

export interface GeographicScope {
  country: string;
  regions: string[];
  focusAreas: string[];
  boundaryType: 'zip' | 'county' | 'state' | 'custom';
}

export interface DomainVocabulary {
  primary: string[];
  secondary: string[];
  context: string[];
  synonyms: Record<string, string[]>;
}

export interface EndpointMapping {
  endpoint: string;
  fields: string[];
  boostTerms: string[];
  penaltyTerms: string[];
  confidenceThreshold: number;
}

export interface ConfigurationFile {
  path: string;
  type: 'typescript' | 'javascript' | 'json';
  purpose: string;
  dependencies: string[];
}

export interface SystemSnapshot {
  id: string;
  timestamp: Date;
  configurations: Map<string, ConfigurationBackup>;
  systemHealth: SystemHealthCheck;
  description: string;
}

export interface ConfigurationBackup {
  filePath: string;
  content: string;
  checksum: string;
  lastModified: Date;
}

export interface SystemHealthCheck {
  routingAccuracy: number;
  endpointHealth: boolean;
  dataIntegrity: boolean;
  performanceMetrics: PerformanceMetrics;
  timestamp: Date;
}

export interface PerformanceMetrics {
  averageRoutingTime: number;
  queriesPerSecond: number;
  memoryUsage: number;
  errorRate: number;
}

export interface MigrationOptions {
  projectName: string;
  template: string;
  dataSourceUrl?: string;
  dryRun: boolean;
  skipTests: boolean;
  force: boolean;
  deployMicroservice: boolean;
  createSnapshot: boolean;
}

export interface MigrationResult {
  success: boolean;
  duration: number;
  stepsCompleted: number;
  stepsTotal: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  snapshotId?: string;
  microserviceUrl?: string;
  summary: string;
}

// Base class for all validation steps
export abstract class BaseValidator {
  abstract name: string;
  abstract description: string;
  
  abstract validate(context?: any): Promise<ValidationResult>;
  
  protected createError(code: string, message: string, severity: ValidationError['severity'], file?: string): ValidationError {
    return { code, message, severity, file };
  }
  
  protected createWarning(code: string, message: string, impact: string): ValidationWarning {
    return { code, message, impact };
  }
}

// Base class for migration steps
export abstract class BaseMigrationStep {
  abstract name: string;
  abstract description: string;
  abstract requiredInputs: string[];
  
  abstract execute(options: MigrationOptions, previousResults: StepResult[]): Promise<StepResult>;
  
  protected getRequiredInput(key: string, previousResults: StepResult[]): any {
    const result = previousResults.find(r => r.outputs.has(key));
    if (!result) {
      throw new Error(`Required input '${key}' not found in previous step results`);
    }
    return result.outputs.get(key);
  }
}

export interface StepResult {
  stepName: string;
  success: boolean;
  duration: number;
  outputs: Map<string, any>;
  error?: Error;
  validationResult?: ValidationResult;
}

export class MigrationError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'MigrationError';
  }
}

// Phase 3 interfaces for microservice automation

export interface MicroservicePackage {
  projectName: string;
  template: ProjectTemplate;
  configuration: MicroserviceConfig;
  deploymentManifest: DeploymentManifest;
  healthChecks: HealthCheck[];
  generatedFiles: Map<string, string>;
}

export interface MicroserviceConfig {
  project: {
    name: string;
    description: string;
    version: string;
  };
  data_sources: {
    arcgis_service_url: string;
    training_data_url: string;
    backup_data_url: string;
    data_format: string;
    arcgis_layers: ArcGISLayer[];
    layer_analysis?: {
      total_layers: number;
      polygon_layers: number;
      point_layers: number;
      analysis_date: string;
    };
    last_extraction?: string;
    extraction_metadata?: any;
  };
  target_configuration: {
    target_variable: string;
    target_brand: string;
    custom_field_mapping: Record<string, string>;
  };
  geographic_configuration: {
    boundary_service: string;
    default_extent: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    };
    coordinate_system: string;
    sample_cities?: string[];
  };
  deployment: {
    environment: string;
    platform: string;
    region: string;
    plan: string;
    auto_deploy: boolean;
    health_check_enabled: boolean;
  };
  integration: {
    main_app_url: string;
    api_endpoints: string[];
    auth_required: boolean;
    cors_origins: string[];
  };
  model_configuration: {
    algorithms: string[];
    hyperparameter_tuning: boolean;
    cross_validation_folds: number;
    test_size: number;
    random_state: number;
    model_storage: string;
  };
  monitoring: {
    health_check_interval: number;
    performance_alerts: boolean;
    error_threshold: number;
    response_time_threshold: number;
    log_level: string;
  };
  security: {
    api_key_required: boolean;
    rate_limiting: {
      enabled: boolean;
      requests_per_minute: number;
    };
    allowed_ips: string[];
    https_only: boolean;
  };
}

export interface ModelConfiguration {
  modelType: 'classification' | 'regression' | 'ensemble';
  features: string[];
  targetField: string;
  hyperparameters: Record<string, any>;
  trainingDataPath: string;
}

export interface DeploymentManifest {
  platform: 'render' | 'vercel' | 'aws' | 'local';
  repositoryUrl: string;
  buildCommand: string;
  startCommand: string;
  environmentVariables: Record<string, string>;
  healthCheckUrl: string;
  deploymentConfig: PlatformConfig;
}

export interface PlatformConfig {
  render?: {
    serviceType: 'web_service' | 'private_service';
    plan: 'free' | 'starter' | 'standard' | 'pro';
    region: string;
    autoDeploy: boolean;
    dockerFile?: string;
  };
  vercel?: {
    framework: string;
    buildCommand: string;
    outputDirectory: string;
  };
}

export interface HealthCheck {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  expectedStatus: number;
  timeout: number;
  retries: number;
  body?: any;
  headers?: Record<string, string>;
}

export interface MicroserviceGenerationResult {
  success: boolean;
  packagePath: string;
  configuration: MicroserviceConfig;
  generatedFiles: string[];
  repositoryUrl?: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validationResults: ValidationResult[];
  buildLogs: string[];
}

export interface MicroserviceDeploymentResult {
  success: boolean;
  serviceUrl?: string;
  deploymentId?: string;
  platform: string;
  healthCheckResults: HealthCheckResult[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  logs: string[];
  duration: number;
  rollbackAvailable: boolean;
}

export interface HealthCheckResult {
  check: HealthCheck;
  success: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
  response?: any;
  timestamp: Date;
}

export interface RenderCredentials {
  apiKey: string;
  userId?: string;
  teamId?: string;
}

export interface GitHubCredentials {
  token: string;
  username: string;
  organization?: string;
}

export interface MicroserviceValidationResult {
  success: boolean;
  serviceHealth: boolean;
  targetVariableValid: boolean;
  modelsLoaded: boolean;
  endpointsResponding: boolean;
  dataIntegrationValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  performanceMetrics: MicroservicePerformanceMetrics;
}

export interface MicroservicePerformanceMetrics extends PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
  uptime: number;
  diskUsage: number;
}

export interface IntegrationTestResult {
  query: string;
  expectedEndpoint: string;
  actualEndpoint: string;
  success: boolean;
  responseTime: number;
  dataQuality: number;
  error?: string;
}

export interface DeploymentResult {
  success: boolean;
  url?: string;
  error?: string;
  deploymentId?: string;
  status?: 'pending' | 'building' | 'live' | 'failed';
  buildLogs?: string[];
  healthCheck?: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    responseTime?: number;
    lastChecked?: string;
  };
}

// Phase 4: Migration Orchestration Types
export interface OrchestrationOptions {
  projectName: string;
  arcgisServiceUrl?: string;
  targetVariable?: string;
  deploy?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export interface OrchestrationStep {
  name: string;
  type: 'validation' | 'data_analysis' | 'data_extraction' | 'config_generation' | 
        'code_generation' | 'code_validation' | 'deployment' | 'deployment_validation' | 
        'sample_areas_generation' | 'post_deployment_config';
  description: string;
  estimatedTime: number; // seconds
}

export interface StepResultData {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

export interface MigrationOrchestrationResult {
  success: boolean;
  steps: StepResultData[];
  totalTime: number;
  deploymentUrl?: string;
  generatedFiles?: string[];
  config: MicroserviceConfig;
  error?: string;
  failedStep?: number;
}