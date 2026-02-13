/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  MicroservicePackage, 
  MicroserviceDeploymentResult, 
  RenderCredentials, 
  GitHubCredentials,
  ValidationError,
  ValidationWarning,
  HealthCheckResult
} from './types';
import { MicroserviceValidator } from './MicroserviceValidator';

const execAsync = promisify(exec);

export class MicroserviceDeployer {
  private validator: MicroserviceValidator;
  private deploymentLogs: string[] = [];

  constructor() {
    this.validator = new MicroserviceValidator();
  }

  async deployToRender(
    microservicePackage: MicroservicePackage,
    renderCredentials: RenderCredentials,
    githubCredentials: GitHubCredentials,
    options: {
      createRepository?: boolean;
      waitForDeployment?: boolean;
      runHealthChecks?: boolean;
      enableAutoRollback?: boolean;
    } = {}
  ): Promise<MicroserviceDeploymentResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const logs: string[] = [];
    let healthCheckResults: HealthCheckResult[] = [];

    try {
      // Narrow local cast to avoid touching public types/signatures while
      // allowing safer property access for template interpolation.
      const cfgAny = microservicePackage.configuration as any;

      logs.push(`🚀 Starting deployment for ${microservicePackage.projectName}`);
      logs.push(`📦 Package: ${cfgAny.serviceName ?? cfgAny.serviceName ?? microservicePackage.projectName}`);
      logs.push(`🎯 Target: ${cfgAny.targetVariable ?? cfgAny.targetVariable ?? 'unknown'}`);

      // 1. Validate deployment readiness
      const validationResult = await this.validateDeploymentReadiness(microservicePackage);
      if (!validationResult.success) {
        errors.push(...validationResult.errors);
        return this.createFailureResult(errors, warnings, logs, startTime);
      }
      logs.push(`✅ Deployment readiness validation passed`);

      // 2. Create GitHub repository (if requested)
      let repositoryUrl = microservicePackage.deploymentManifest.repositoryUrl;
      if (options.createRepository) {
        const repoResult = await this.createGitHubRepository(
          microservicePackage,
          githubCredentials
        );
        if (repoResult.success) {
          repositoryUrl = repoResult.repositoryUrl!;
          logs.push(`✅ GitHub repository created: ${repositoryUrl}`);
        } else {
          warnings.push({
            code: 'REPO_CREATION_WARNING',
            message: 'GitHub repository creation failed, using existing URL',
            impact: 'Manual repository setup may be required'
          });
        }
      }

      // 3. Upload code to GitHub
      const uploadResult = await this.uploadCodeToGitHub(
        microservicePackage,
        repositoryUrl,
        githubCredentials
      );
      if (!uploadResult.success) {
        errors.push({
          code: 'CODE_UPLOAD_FAILED',
          message: `Failed to upload code to GitHub: ${uploadResult.error}`,
          severity: 'critical'
        });
        return this.createFailureResult(errors, warnings, logs, startTime);
      }
      logs.push(`✅ Code uploaded to GitHub repository`);

      // 4. Create Render service
      const renderResult = await this.createRenderService(
        microservicePackage,
        renderCredentials,
        repositoryUrl
      );
      if (!renderResult.success) {
        errors.push({
          code: 'RENDER_DEPLOYMENT_FAILED',
          message: `Failed to create Render service: ${renderResult.error}`,
          severity: 'critical'
        });
        return this.createFailureResult(errors, warnings, logs, startTime);
      }
      logs.push(`✅ Render service created: ${renderResult.serviceId}`);

      const serviceUrl = renderResult.serviceUrl;
      logs.push(`🌐 Service URL: ${serviceUrl}`);

      // 5. Wait for deployment to complete (if requested)
      if (options.waitForDeployment && serviceUrl) {
        logs.push(`⏳ Waiting for deployment to complete...`);
        const deploymentReady = await this.validator.waitForDeployment(serviceUrl, 300000); // 5 minutes timeout
        if (!deploymentReady) {
          warnings.push({
            code: 'DEPLOYMENT_TIMEOUT',
            message: 'Deployment did not complete within timeout period',
            impact: 'Manual verification may be required'
          });
        } else {
          logs.push(`✅ Deployment completed successfully`);
        }
      }

      // 6. Run health checks (if requested)
      if (options.runHealthChecks && serviceUrl) {
        logs.push(`🔍 Running health checks...`);
        healthCheckResults = await this.runHealthChecks(microservicePackage, serviceUrl);
        const failedChecks = healthCheckResults.filter(r => !r.success);
        
        if (failedChecks.length > 0) {
          warnings.push({
            code: 'HEALTH_CHECK_FAILURES',
            message: `${failedChecks.length} health checks failed`,
            impact: 'Service may not be fully functional'
          });
          logs.push(`⚠️  ${failedChecks.length} health checks failed`);
        } else {
          logs.push(`✅ All health checks passed`);
        }
      }

      // 7. Configure monitoring and alerts (future enhancement)
      logs.push(`🔧 Deployment configuration completed`);

      const duration = Date.now() - startTime;
      logs.push(`🎉 Deployment completed in ${duration}ms`);

      return {
        success: true,
        serviceUrl,
        deploymentId: renderResult.serviceId,
        platform: 'render',
        healthCheckResults,
        errors,
        warnings,
        logs,
        duration,
        rollbackAvailable: true
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      errors.push({
        code: 'DEPLOYMENT_ERROR',
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });

      return {
        success: false,
        platform: 'render',
        healthCheckResults,
        errors,
        warnings,
        logs,
        duration,
        rollbackAvailable: false
      };
    }
  }

  private async validateDeploymentReadiness(
    microservicePackage: MicroservicePackage
  ): Promise<{ success: boolean; errors: ValidationError[] }> {
    const errors: ValidationError[] = [];

    // Check required files exist
    const requiredFiles = ['app.py', 'requirements.txt', 'config.py'];
    for (const file of requiredFiles) {
      const filePath = path.join((microservicePackage.configuration as any).repositoryName, file);
      try {
        await fs.access(filePath);
      } catch {
        errors.push({
          code: 'MISSING_REQUIRED_FILE',
          message: `Required file missing: ${file}`,
          severity: 'critical'
        });
      }
    }

    // Validate configuration completeness
    const config = microservicePackage.configuration as any;
    if (!config.serviceName) {
      errors.push({
        code: 'MISSING_SERVICE_NAME',
        message: 'Service name is required',
        severity: 'critical'
      });
    }

    if (!config.targetVariable) {
      errors.push({
        code: 'MISSING_TARGET_VARIABLE',
        message: 'Target variable is required',
        severity: 'critical'
      });
    }

    if (!config.dataFields || config.dataFields.length === 0) {
      errors.push({
        code: 'MISSING_DATA_FIELDS',
        message: 'Data fields configuration is required',
        severity: 'high'
      });
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  private async createGitHubRepository(
    microservicePackage: MicroservicePackage,
    credentials: GitHubCredentials
  ): Promise<{ success: boolean; repositoryUrl?: string; error?: string }> {
    try {
      const repoName = (microservicePackage.configuration as any).repositoryName;
      const orgName = credentials.organization || credentials.username;

      // Create repository using GitHub API
      const createRepoUrl = credentials.organization 
        ? `https://api.github.com/orgs/${credentials.organization}/repos`
        : 'https://api.github.com/user/repos';

      const createRepoCommand = `curl -X POST "${createRepoUrl}" \
        -H "Authorization: token ${credentials.token}" \
        -H "Accept: application/vnd.github.v3+json" \
        -d '{
          "name": "${repoName}",
          "description": "AI-powered microservice for ${microservicePackage.template.industry} analysis",
          "private": false,
          "has_issues": true,
          "has_projects": false,
          "has_wiki": false,
          "auto_init": false
        }'`;

      const { stdout, stderr } = await execAsync(createRepoCommand);
      
      if (stderr && !stderr.includes('already exists')) {
        return { success: false, error: stderr };
      }

      const repositoryUrl = `https://github.com/${orgName}/${repoName}`;
      return { success: true, repositoryUrl };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async uploadCodeToGitHub(
    microservicePackage: MicroservicePackage,
    repositoryUrl: string,
    credentials: GitHubCredentials
  ): Promise<{ success: boolean; error?: string }> {
    try {
  // Local narrow cast for configuration to avoid changing exported types.
  const pkgCfg: any = microservicePackage.configuration as any;
  const packagePath = path.resolve(pkgCfg.repositoryName ?? (microservicePackage.configuration as any).repositoryName);
      
      // Initialize git repository if not already initialized
      const commands = [
        `cd "${packagePath}" && git init`,
        `cd "${packagePath}" && git add .`,
  `cd "${packagePath}" && git commit -m "Initial commit: Generated microservice for ${microservicePackage.projectName}

🤖 Generated with Claude Code Migration System

Target: ${pkgCfg.targetVariable ?? (microservicePackage.configuration as any).targetVariable}
Domain: ${microservicePackage.template.domain}
Industry: ${microservicePackage.template.industry}
Generated: ${new Date().toISOString()}"`,
        `cd "${packagePath}" && git branch -M main`,
        `cd "${packagePath}" && git remote add origin ${repositoryUrl}`,
        `cd "${packagePath}" && git push -u origin main`
      ];

      // Set git credentials for authentication
      const authUrl = repositoryUrl.replace('https://', `https://${credentials.username}:${credentials.token}@`);
      commands[4] = `cd "${packagePath}" && git remote add origin ${authUrl}`;
      commands[5] = `cd "${packagePath}" && git push -u origin main`;

      for (const command of commands) {
        try {
          await execAsync(command);
        } catch (error) {
          // Some git commands may fail harmlessly (e.g., remote already exists)
          if (error instanceof Error && !error.message.includes('already exists')) {
            console.warn(`Git command warning: ${error.message}`);
          }
        }
      }

      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async createRenderService(
    microservicePackage: MicroservicePackage,
    credentials: RenderCredentials,
    repositoryUrl: string
  ): Promise<{ 
    success: boolean; 
    serviceId?: string; 
    serviceUrl?: string; 
    error?: string 
  }> {
    try {
      const config = microservicePackage.configuration;
      const manifest = microservicePackage.deploymentManifest || ({} as any);
      const configAny = config as any;

      const renderPayload = {
        type: 'web_service',
        name: configAny.serviceName ?? (config as any).serviceName,
        repo: repositoryUrl,
        branch: 'main',
        rootDir: '.',
        buildCommand: manifest.buildCommand,
        startCommand: manifest.startCommand,
        plan: manifest.deploymentConfig.render?.plan || 'free',
        region: manifest.deploymentConfig.render?.region || 'oregon',
        envVars: Object.entries(manifest.environmentVariables ?? {}).map(([key, value]) => ({
          key,
          value: value == null ? '' : value.toString()
        })),
        healthCheckPath: manifest.healthCheckUrl,
        autoDeploy: manifest.deploymentConfig.render?.autoDeploy !== false
      };

      // Create service using Render API
      const createServiceCommand = `curl -X POST "https://api.render.com/v1/services" \
        -H "Authorization: Bearer ${credentials.apiKey}" \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(renderPayload)}'`;

      const { stdout, stderr } = await execAsync(createServiceCommand);
      
      if (stderr) {
        return { success: false, error: stderr };
      }

      const response = JSON.parse(stdout);
      
      if (response.id) {
        const serviceUrl = `https://${(config as any).serviceName}.onrender.com`;
        return {
          success: true,
          serviceId: response.id,
          serviceUrl
        };
      } else {
        return {
          success: false,
          error: response.message || 'Failed to create Render service'
        };
      }

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async runHealthChecks(
    microservicePackage: MicroservicePackage,
    serviceUrl: string
  ): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const healthCheck of microservicePackage.healthChecks) {
      const result = await this.validator.runHealthCheck(healthCheck, serviceUrl);
      results.push(result);
    }

    return results;
  }

  private createFailureResult(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    logs: string[],
    startTime: number
  ): MicroserviceDeploymentResult {
    return {
      success: false,
      platform: 'render',
      healthCheckResults: [],
      errors,
      warnings,
      logs,
      duration: Date.now() - startTime,
      rollbackAvailable: false
    };
  }

  async rollbackDeployment(
    serviceId: string,
    credentials: RenderCredentials
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // In a real implementation, this would rollback to a previous deployment
      // For now, we'll suspend the service
      const suspendCommand = `curl -X POST "https://api.render.com/v1/services/${serviceId}/suspend" \
        -H "Authorization: Bearer ${credentials.apiKey}"`;

      const { stdout, stderr } = await execAsync(suspendCommand);
      
      if (stderr) {
        return { success: false, error: stderr };
      }

      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getDeploymentStatus(
    serviceId: string,
    credentials: RenderCredentials
  ): Promise<{
    success: boolean;
    status?: string;
    url?: string;
    error?: string;
  }> {
    try {
      const statusCommand = `curl -X GET "https://api.render.com/v1/services/${serviceId}" \
        -H "Authorization: Bearer ${credentials.apiKey}"`;

      const { stdout, stderr } = await execAsync(statusCommand);
      
      if (stderr) {
        return { success: false, error: stderr };
      }

      const response = JSON.parse(stdout);
      
      return {
        success: true,
        status: response.serviceDetails?.deployStatus || 'unknown',
        url: response.serviceDetails?.url
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  getDeploymentLogs(): string[] {
    return [...this.deploymentLogs];
  }

  clearLogs(): void {
    this.deploymentLogs = [];
  }
}