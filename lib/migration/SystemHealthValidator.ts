import { BaseValidator } from './BaseValidator';
import { ValidationResult, ValidationError, ValidationWarning } from './types';
import { spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

/**
 * System Health Pre-flight Validator
 * 
 * Validates that the current system is in a healthy state before migration:
 * - Routing system accuracy and performance
 * - Endpoint data availability and integrity
 * - Critical dependencies and services
 * - Build and test status
 */
export class SystemHealthValidator extends BaseValidator {
  readonly name = 'system-health';
  readonly description = 'Validates current system health and readiness for migration';

  private readonly criticalTests = [
    '__tests__/hybrid-routing-detailed.test.ts',
    '__tests__/hybrid-routing-random-query-optimization.test.ts'
  ];

  private readonly criticalEndpoints = [
    'strategic-analysis', 'competitive-analysis', 'demographic-analysis',
    'expansion-opportunity', 'market-penetration', 'customer-profile'
  ];

  private readonly dataDirectories = [
    'public/data/endpoints',
    'public/data/boundaries'
  ];

  async validate(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    try {
      console.log('🔍 Checking system health...');
      
      // 1. Validate build system
      await this.validateBuildSystem(errors, warnings);
      
      // 2. Check routing system accuracy
      await this.validateRoutingSystem(errors, warnings);
      
      // 3. Verify endpoint data availability
      await this.validateEndpointData(errors, warnings);
      
      // 4. Check critical dependencies
      await this.validateDependencies(errors, warnings);
      
      // 5. Test system performance
      await this.validatePerformance(warnings);
      
      // 6. Generate recommendations
      this.generateHealthRecommendations(recommendations);

      return this.createResult(errors, warnings, recommendations);
      
    } catch (error) {
      errors.push(this.createError(
        'HEALTH_CHECK_FAILED',
        `System health validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'critical'
      ));
      return this.createResult(errors);
    }
  }

  private async validateBuildSystem(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
    console.log('  📦 Checking build system...');
    
    // Check if TypeScript compiles without errors
    try {
      const tscResult = await this.runCommand('npx', ['tsc', '--noEmit', '--skipLibCheck'], 30000);
      
      if (!tscResult.success) {
        errors.push(this.createError(
          'TYPESCRIPT_ERRORS',
          'TypeScript compilation has errors that must be fixed before migration',
          'critical',
          undefined,
          undefined,
          'Run `npx tsc --noEmit` to see detailed TypeScript errors and fix them'
        ));
      }
    } catch (error) {
      warnings.push(this.createWarning(
        'BUILD_CHECK_FAILED',
        'Could not verify TypeScript compilation status',
        'Migration may encounter build issues'
      ));
    }

    // Check package.json dependencies
    try {
      const packageJsonExists = await this.validateFileExists('package.json');
      if (!packageJsonExists) {
        errors.push(this.createError(
          'MISSING_PACKAGE_JSON',
          'package.json file not found',
          'critical',
          'package.json'
        ));
      } else {
        const packageJson = await this.readJsonFile('package.json');
        if (packageJson && !packageJson.dependencies) {
          warnings.push(this.createWarning(
            'NO_DEPENDENCIES',
            'No dependencies found in package.json',
            'System may be missing required packages'
          ));
        }
      }
    } catch (error) {
      warnings.push(this.createWarning(
        'PACKAGE_CHECK_FAILED',
        'Could not verify package.json status',
        'Dependency validation was skipped'
      ));
    }
  }

  private async validateRoutingSystem(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
    console.log('  🧭 Testing routing system accuracy...');
    
    // Run hybrid routing tests
    for (const testFile of this.criticalTests) {
      const exists = await this.validateFileExists(testFile);
      if (!exists) {
        warnings.push(this.createWarning(
          'MISSING_TEST_FILE',
          `Critical test file missing: ${testFile}`,
          'Cannot verify routing system accuracy'
        ));
        continue;
      }

      try {
        const testResult = await this.runCommand('npm', ['test', '--', testFile, '--silent'], 60000);
        
        if (!testResult.success) {
          const failureType = testResult.output.includes('timeout') ? 'TIMEOUT' : 'FAILURE';
          const severity = failureType === 'TIMEOUT' ? 'medium' : 'high';
          
          errors.push(this.createError(
            `ROUTING_TEST_${failureType}`,
            `Routing system test failed: ${testFile}`,
            severity,
            testFile,
            undefined,
            'Fix routing system issues before attempting migration'
          ));
        } else {
          // Extract success rate from test output if available
          const successRateMatch = testResult.output.match(/Success Rate:\s*(\d+\.?\d*)%/);
          if (successRateMatch) {
            const successRate = parseFloat(successRateMatch[1]);
            if (successRate < 80) {
              warnings.push(this.createWarning(
                'LOW_ROUTING_SUCCESS_RATE',
                `Routing success rate is ${successRate}% (target: >80%)`,
                'Migration may result in poor query routing performance',
                'Investigate and fix routing configuration issues'
              ));
            }
          }
        }
      } catch (error) {
        warnings.push(this.createWarning(
          'TEST_EXECUTION_FAILED',
          `Could not execute test: ${testFile}`,
          'Routing system validation was skipped'
        ));
      }
    }
  }

  private async validateEndpointData(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
    console.log('  📊 Validating endpoint data...');
    
    // Check if data directories exist
    for (const dataDir of this.dataDirectories) {
      try {
        const stats = await fs.stat(dataDir);
        if (!stats.isDirectory()) {
          errors.push(this.createError(
            'INVALID_DATA_DIRECTORY',
            `Data directory is not a directory: ${dataDir}`,
            'high',
            dataDir
          ));
        }
      } catch (error) {
        errors.push(this.createError(
          'MISSING_DATA_DIRECTORY',
          `Required data directory missing: ${dataDir}`,
          'critical',
          dataDir,
          undefined,
          'Ensure data processing has been completed and directories are present'
        ));
      }
    }

    // Check critical endpoint files
    let validEndpointCount = 0;
    for (const endpoint of this.criticalEndpoints) {
      const endpointFile = `public/data/endpoints/${endpoint}.json`;
      const exists = await this.validateFileExists(endpointFile);
      
      if (exists) {
        try {
          const data = await this.readJsonFile(endpointFile);
          if (data && data.results && Array.isArray(data.results)) {
            if (data.results.length === 0) {
              warnings.push(this.createWarning(
                'EMPTY_ENDPOINT_DATA',
                `Endpoint data file is empty: ${endpoint}.json`,
                'This endpoint will not function properly',
                'Regenerate endpoint data or verify data processing completed successfully'
              ));
            } else {
              validEndpointCount++;
              
              // Validate data structure
              const firstRecord = data.results[0];
              if (!firstRecord.DESCRIPTION || !firstRecord.GEOID) {
                warnings.push(this.createWarning(
                  'INVALID_ENDPOINT_STRUCTURE',
                  `Endpoint data missing required fields in ${endpoint}.json`,
                  'Geographic analysis may not work correctly'
                ));
              }
            }
          } else {
            warnings.push(this.createWarning(
              'INVALID_ENDPOINT_FORMAT',
              `Endpoint data file has invalid format: ${endpoint}.json`,
              'This endpoint will not function properly'
            ));
          }
        } catch (error) {
          warnings.push(this.createWarning(
            'ENDPOINT_READ_ERROR',
            `Could not read endpoint data file: ${endpoint}.json`,
            'Endpoint may not be accessible during migration'
          ));
        }
      } else {
        errors.push(this.createError(
          'MISSING_ENDPOINT_DATA',
          `Critical endpoint data missing: ${endpoint}.json`,
          'high',
          endpointFile,
          undefined,
          'Run data processing pipeline or verify endpoint generation completed'
        ));
      }
    }

    const dataCompleteness = validEndpointCount / this.criticalEndpoints.length;
    if (dataCompleteness < 0.8) {
      errors.push(this.createError(
        'INSUFFICIENT_ENDPOINT_DATA',
        `Only ${validEndpointCount}/${this.criticalEndpoints.length} critical endpoints have valid data`,
        'high',
        'public/data/endpoints',
        undefined,
        'Complete data processing for all endpoints before migration'
      ));
    }
  }

  private async validateDependencies(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
    console.log('  🔗 Checking critical dependencies...');
    
    const criticalFiles = [
      'lib/routing/SemanticEnhancedHybridEngine.ts',
      'lib/analysis/ConfigurationManager.ts',
      'utils/chat/client-summarizer.ts',
      'components/chat/chat-constants.ts'
    ];

    for (const file of criticalFiles) {
      const exists = await this.validateFileExists(file);
      if (!exists) {
        errors.push(this.createError(
          'MISSING_CRITICAL_FILE',
          `Critical system file missing: ${file}`,
          'critical',
          file,
          undefined,
          'Restore missing file from backup or repository'
        ));
      }
    }

    // Check node_modules
    const nodeModulesExists = await this.validateFileExists('node_modules');
    if (!nodeModulesExists) {
      errors.push(this.createError(
        'MISSING_NODE_MODULES',
        'node_modules directory not found',
        'critical',
        'node_modules',
        undefined,
        'Run `npm install` to install dependencies'
      ));
    }
  }

  private async validatePerformance(warnings: ValidationWarning[]): Promise<void> {
    console.log('  ⚡ Checking system performance...');
    
    try {
      // Test basic routing performance
      const performanceTestExists = await this.validateFileExists('__tests__/hybrid-routing-random-query-optimization.test.ts');
      
      if (performanceTestExists) {
        const perfResult = await this.runCommand(
          'npm', 
          ['test', '--', '__tests__/hybrid-routing-random-query-optimization.test.ts', '--silent'], 
          90000
        );
        
        if (perfResult.success) {
          // Extract performance metrics if available
          const qpsMatch = perfResult.output.match(/(\d+\.?\d*)\s*queries\/second/i);
          if (qpsMatch) {
            const qps = parseFloat(qpsMatch[1]);
            if (qps < 5000) {
              warnings.push(this.createWarning(
                'LOW_PERFORMANCE',
                `Routing performance is ${qps} queries/second (target: >5000)`,
                'System may be slow after migration',
                'Investigate performance bottlenecks in routing system'
              ));
            }
          }
        } else {
          warnings.push(this.createWarning(
            'PERFORMANCE_TEST_FAILED',
            'Could not measure routing system performance',
            'Performance status unknown before migration'
          ));
        }
      }
    } catch (error) {
      warnings.push(this.createWarning(
        'PERFORMANCE_CHECK_FAILED',
        'Performance validation could not be completed',
        'Performance impact of migration unknown'
      ));
    }
  }

  private generateHealthRecommendations(recommendations: string[]): void {
    recommendations.push(
      'Run a full backup of the current system before proceeding with migration'
    );
    
    recommendations.push(
      'Create a system snapshot to enable rollback if migration encounters issues'
    );
    
    recommendations.push(
      'Monitor system performance after migration to detect any regressions'
    );
    
    recommendations.push(
      'Consider running migration on a staging environment first to validate the process'
    );
  }

  private async runCommand(command: string, args: string[], timeout: number = 30000): Promise<CommandResult> {
    return new Promise((resolve) => {
      const process = spawn(command, args, { 
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout 
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout + stderr,
          exitCode: code || 0
        });
      });
      
      process.on('error', (error) => {
        resolve({
          success: false,
          output: error.message,
          exitCode: -1
        });
      });
      
      // Handle timeout
      setTimeout(() => {
        process.kill();
        resolve({
          success: false,
          output: 'Command timed out',
          exitCode: -1
        });
      }, timeout);
    });
  }
}

interface CommandResult {
  success: boolean;
  output: string;
  exitCode: number;
}