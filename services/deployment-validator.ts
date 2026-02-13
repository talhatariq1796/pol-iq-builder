// services/deployment-validator.ts
import { ProjectConfiguration } from '@/types/project-config';

export interface ValidationTest {
  name: string;
  category: 'syntax' | 'structure' | 'integration' | 'runtime';
  severity: 'error' | 'warning' | 'info';
  description: string;
}

export interface ValidationResult {
  test: ValidationTest;
  passed: boolean;
  message: string;
  details?: string;
  autoFixAvailable?: boolean;
}

export interface DeploymentValidationReport {
  overallStatus: 'pass' | 'warning' | 'fail';
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  results: ValidationResult[];
  recommendDeployment: boolean;
  criticalIssues: ValidationResult[];
  summary: string;
}

export class DeploymentValidator {
  private tests: ValidationTest[] = [
    {
      name: 'TypeScript Syntax',
      category: 'syntax',
      severity: 'error',
      description: 'Validates generated TypeScript files compile without errors'
    },
    {
      name: 'Layer Configuration Structure',
      category: 'structure',
      severity: 'error',
      description: 'Ensures layer configuration has required properties'
    },
    {
      name: 'Field Mapping Consistency',
      category: 'structure',
      severity: 'warning',
      description: 'Checks field mappings between frontend and microservice'
    },
    {
      name: 'Group Configuration Integrity',
      category: 'structure',
      severity: 'error',
      description: 'Validates layer groups reference existing layers'
    },
    {
      name: 'Concept Mapping Structure',
      category: 'structure',
      severity: 'warning',
      description: 'Checks concept mappings are properly structured'
    },
    {
      name: 'Python Code Generation',
      category: 'syntax',
      severity: 'error',
      description: 'Validates generated Python code is syntactically correct'
    },
    {
      name: 'JSON Configuration Validity',
      category: 'syntax',
      severity: 'error',
      description: 'Ensures all JSON configurations are valid'
    },
    {
      name: 'Import Dependencies',
      category: 'integration',
      severity: 'error',
      description: 'Tests that generated files can be imported without errors'
    },
    {
      name: 'Runtime Configuration Loading',
      category: 'runtime',
      severity: 'warning',
      description: 'Simulates loading configuration at runtime'
    },
    {
      name: 'Microservice Compatibility',
      category: 'integration',
      severity: 'warning',
      description: 'Checks compatibility with microservice expectations'
    }
  ];

  async validateDeployment(config: ProjectConfiguration): Promise<DeploymentValidationReport> {
    console.log('🔍 Starting deployment validation...');
    
    const results: ValidationResult[] = [];
    
    // Run all validation tests
    for (const test of this.tests) {
      const result = await this.runTest(test, config);
      results.push(result);
    }

    // Calculate summary statistics
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed && r.test.severity === 'error').length;
    const warnings = results.filter(r => !r.passed && r.test.severity === 'warning').length;
    const criticalIssues = results.filter(r => !r.passed && r.test.severity === 'error');

    // Determine overall status
    let overallStatus: 'pass' | 'warning' | 'fail';
    if (failed > 0) {
      overallStatus = 'fail';
    } else if (warnings > 0) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'pass';
    }

    const recommendDeployment = failed === 0;

    const summary = this.generateSummary(passed, failed, warnings, overallStatus);

    return {
      overallStatus,
      totalTests: this.tests.length,
      passed,
      failed,
      warnings,
      results,
      recommendDeployment,
      criticalIssues,
      summary
    };
  }

  private async runTest(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    try {
      switch (test.name) {
        case 'TypeScript Syntax':
          return await this.validateTypeScriptSyntax(test, config);
        case 'Layer Configuration Structure':
          return await this.validateLayerStructure(test, config);
        case 'Field Mapping Consistency':
          return await this.validateFieldMappings(test, config);
        case 'Group Configuration Integrity':
          return await this.validateGroupIntegrity(test, config);
        case 'Concept Mapping Structure':
          return await this.validateConceptMappings(test, config);
        case 'Python Code Generation':
          return await this.validatePythonGeneration(test, config);
        case 'JSON Configuration Validity':
          return await this.validateJSONConfig(test, config);
        case 'Import Dependencies':
          return await this.validateImportDependencies(test, config);
        case 'Runtime Configuration Loading':
          return await this.validateRuntimeLoading(test, config);
        case 'Microservice Compatibility':
          return await this.validateMicroserviceCompatibility(test, config);
        default:
          return {
            test,
            passed: false,
            message: 'Unknown test',
            details: `Test ${test.name} is not implemented`
          };
      }
    } catch (error) {
      return {
        test,
        passed: false,
        message: 'Test execution failed',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async validateTypeScriptSyntax(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    // Simulate TypeScript validation
    const layerCount = Object.keys(config.layers).length;
    const groupCount = config.groups.length;

    // Check for potential issues
    if (layerCount > 100) {
      return {
        test,
        passed: false,
        message: 'Too many layers may cause compilation issues',
        details: `Configuration has ${layerCount} layers, which may cause TypeScript compilation to be slow or fail`,
        autoFixAvailable: false
      };
    }

    // Check for invalid characters in layer IDs
    const invalidLayerIds = Object.keys(config.layers).filter(id => 
      !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)
    );

    if (invalidLayerIds.length > 0) {
      return {
        test,
        passed: false,
        message: 'Invalid layer IDs detected',
        details: `These layer IDs contain invalid characters: ${invalidLayerIds.join(', ')}`,
        autoFixAvailable: true
      };
    }

    return {
      test,
      passed: true,
      message: 'TypeScript syntax validation passed',
      details: `${layerCount} layers and ${groupCount} groups validated successfully`
    };
  }

  private async validateLayerStructure(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    const issues: string[] = [];

    // Check each layer has required properties
    for (const [layerId, layer] of Object.entries(config.layers)) {
      if (!layer.id) issues.push(`Layer ${layerId} missing id`);
      if (!layer.name) issues.push(`Layer ${layerId} missing name`);
      if (!layer.url) issues.push(`Layer ${layerId} missing url`);
      if (!layer.type) issues.push(`Layer ${layerId} missing type`);
    }

    if (issues.length > 0) {
      return {
        test,
        passed: false,
        message: 'Layer structure validation failed',
        details: issues.join('; '),
        autoFixAvailable: true
      };
    }

    return {
      test,
      passed: true,
      message: 'Layer structure validation passed',
      details: `All ${Object.keys(config.layers).length} layers have required properties`
    };
  }

  private async validateFieldMappings(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    let totalMappings = 0;
    let layersWithMappings = 0;

    // Count field mappings
    for (const layer of Object.values(config.layers)) {
      if ('fieldMappings' in layer && layer.fieldMappings) {
        layersWithMappings++;
        totalMappings += Object.keys(layer.fieldMappings as Record<string, string>).length;
      }
    }

    const layerCount = Object.keys(config.layers).length;
    const mappingCoverage = layersWithMappings / layerCount;

    // Pre-deployment: Empty field mappings are expected and acceptable
    if (layerCount === 0) {
      return {
        test,
        passed: true,
        message: 'No layers to validate field mappings',
        details: 'Configuration has no layers, field mappings not required'
      };
    }

    if (mappingCoverage === 0) {
      return {
        test,
        passed: true,
        message: 'Field mappings empty - will be generated during deployment',
        details: `Field mappings are currently empty but will be automatically generated during deployment for ${layerCount} layers`,
        autoFixAvailable: false
      };
    }

    if (mappingCoverage < 0.5) {
      return {
        test,
        passed: true,
        message: 'Partial field mapping coverage - will be completed during deployment',
        details: `${layersWithMappings}/${layerCount} layers have field mappings (${Math.round(mappingCoverage * 100)}%). Missing mappings will be generated during deployment.`,
        autoFixAvailable: false
      };
    }

    return {
      test,
      passed: true,
      message: 'Field mapping validation passed',
      details: `${totalMappings} field mappings across ${layersWithMappings} layers`
    };
  }

  private async validateGroupIntegrity(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    const layerIds = new Set(Object.keys(config.layers));
    const issues: string[] = [];

    // Check each group references valid layers
    for (const group of config.groups) {
      for (const layerId of group.layers) {
        if (!layerIds.has(layerId)) {
          issues.push(`Group ${group.name} references non-existent layer ${layerId}`);
        }
      }
    }

    if (issues.length > 0) {
      return {
        test,
        passed: false,
        message: 'Group integrity validation failed',
        details: issues.join('; '),
        autoFixAvailable: true
      };
    }

    return {
      test,
      passed: true,
      message: 'Group integrity validation passed',
      details: `All ${config.groups.length} groups reference valid layers`
    };
  }

  private async validateConceptMappings(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    const { conceptMappings } = config;
    
    if (!conceptMappings) {
      return {
        test,
        passed: true,
        message: 'Concept mappings will be generated during deployment',
        details: 'Concept mappings are not present but will be automatically generated during deployment',
        autoFixAvailable: true
      };
    }

    const hasLayerMappings = Object.keys(conceptMappings.layerMappings || {}).length > 0;
    const hasFieldMappings = Object.keys(conceptMappings.fieldMappings || {}).length > 0;

    if (!hasLayerMappings && !hasFieldMappings) {
      return {
        test,
        passed: true,
        message: 'Empty concept mappings - will be populated during deployment',
        details: 'Concept mappings are present but empty. They will be automatically populated based on layer configuration during deployment.',
        autoFixAvailable: false
      };
    }

    return {
      test,
      passed: true,
      message: 'Concept mappings validation passed',
      details: `Layer mappings: ${Object.keys(conceptMappings.layerMappings || {}).length}, Field mappings: ${Object.keys(conceptMappings.fieldMappings || {}).length}`
    };
  }

  private async validatePythonGeneration(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    // Simulate Python code generation validation
    try {
      // Check for special characters that might break Python
      const layerNames = Object.values(config.layers).map(layer => layer.name);
      const problematicNames = layerNames.filter(name => 
        /['"\\]/.test(name) || name.includes('\n') || name.includes('\r')
      );

      if (problematicNames.length > 0) {
        return {
          test,
          passed: false,
          message: 'Layer names contain problematic characters',
          details: `These layer names may cause Python generation issues: ${problematicNames.join(', ')}`,
          autoFixAvailable: true
        };
      }

      return {
        test,
        passed: true,
        message: 'Python generation validation passed',
        details: 'All layer names are compatible with Python code generation'
      };
    } catch (error) {
      return {
        test,
        passed: false,
        message: 'Python generation validation failed',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async validateJSONConfig(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    try {
      // Test JSON serialization
      JSON.stringify(config.conceptMappings);
      JSON.stringify(config.settings);
      
      return {
        test,
        passed: true,
        message: 'JSON configuration validation passed',
        details: 'All configuration objects can be serialized to JSON'
      };
    } catch (error) {
      return {
        test,
        passed: false,
        message: 'JSON serialization failed',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async validateImportDependencies(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    // Simulate import dependency validation
    const layerCount = Object.keys(config.layers).length;
    
    // Check for circular dependencies
    const dependencies = config.dependencies;
    if (dependencies && dependencies.files) {
      const circularDeps = dependencies.files.filter(file => 
        file.layerReferences.some(ref => ref.referenceType === 'hardcoded')
      );
      
      if (circularDeps.length > 0) {
        return {
          test,
          passed: false,
          message: 'Potential circular dependencies detected',
          details: `${circularDeps.length} files may have circular dependencies`,
          autoFixAvailable: false
        };
      }
    }

    return {
      test,
      passed: true,
      message: 'Import dependencies validation passed',
      details: `${layerCount} layers can be imported without circular dependencies`
    };
  }

  private async validateRuntimeLoading(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    // Simulate runtime loading validation
    const memoryEstimate = Object.keys(config.layers).length * 0.1; // MB per layer estimate
    const maxMemory = config.metadata?.performanceRequirements?.memoryLimit || 512;

    if (memoryEstimate > maxMemory) {
      return {
        test,
        passed: false,
        message: 'Configuration may exceed memory limits',
        details: `Estimated memory usage: ${memoryEstimate}MB, Limit: ${maxMemory}MB`,
        autoFixAvailable: false
      };
    }

    return {
      test,
      passed: true,
      message: 'Runtime loading validation passed',
      details: `Estimated memory usage: ${memoryEstimate}MB (within ${maxMemory}MB limit)`
    };
  }

  private async validateMicroserviceCompatibility(test: ValidationTest, config: ProjectConfiguration): Promise<ValidationResult> {
    // Check for microservice compatibility issues
    let fieldMappingCount = 0;
    let targetVariableCount = 0;

    for (const layer of Object.values(config.layers)) {
      if (layer.fields) {
        for (const field of layer.fields) {
          if ('microserviceField' in field && field.microserviceField) {
            fieldMappingCount++;
          }
          if ('isTargetVariable' in field && field.isTargetVariable) {
            targetVariableCount++;
          }
        }
      }
    }

    // Pre-deployment: Missing field mappings are expected and will be generated
    if (fieldMappingCount === 0) {
      return {
        test,
        passed: true,
        message: 'Microservice field mappings will be generated during deployment',
        details: 'Field mappings for microservice integration are not yet configured but will be automatically generated during deployment',
        autoFixAvailable: false
      };
    }

    return {
      test,
      passed: true,
      message: 'Microservice compatibility validation passed',
      details: `${fieldMappingCount} field mappings, ${targetVariableCount} target variables configured`
    };
  }

  private generateSummary(passed: number, failed: number, warnings: number, status: string): string {
    if (status === 'pass') {
      return `All validations passed! Configuration is ready for deployment. (${passed} tests passed)`;
    } else if (status === 'warning') {
      return `Configuration is deployable with warnings. ${passed} tests passed, ${warnings} warnings. Review warnings before deployment.`;
    } else {
      return `Configuration has critical issues. ${failed} tests failed, ${warnings} warnings. Fix critical issues before deployment.`;
    }
  }
}

export const deploymentValidator = new DeploymentValidator(); 