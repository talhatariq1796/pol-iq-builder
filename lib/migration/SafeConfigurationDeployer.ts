import { BaseValidator } from './BaseValidator';
import { ValidationResult, ValidationError, ValidationWarning } from './types';
import { TemplateEngine } from './TemplateEngine';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

/**
 * Safe Configuration Deployer
 * 
 * Provides safe deployment of template-generated configurations with
 * automatic backup, validation, and rollback capabilities.
 */
export class SafeConfigurationDeployer {
  private backupDir = './backups/configurations';
  private templateEngine: TemplateEngine;

  constructor(templateEngine?: TemplateEngine) {
    this.templateEngine = templateEngine || new TemplateEngine();
  }

  /**
   * Deploy configuration with full safety measures
   */
  async safeDeployConfiguration(templateName: string, options: DeploymentOptions = {}): Promise<DeploymentResult> {
    const startTime = Date.now();
    const deploymentId = this.generateDeploymentId();
    
    console.log(`🚀 Starting safe configuration deployment: ${deploymentId}`);
    console.log(`📋 Template: ${templateName}`);
    
    try {
      // 1. Pre-deployment validation
      console.log('🔍 Running pre-deployment validation...');
      const preValidation = await this.validatePreDeployment(templateName);
      if (!preValidation.isValid && !options.force) {
        throw new DeploymentError('Pre-deployment validation failed', preValidation.errors);
      }

      // 2. Create system backup
      console.log('💾 Creating system backup...');
      const backup = await this.createSystemBackup(deploymentId);

      // 3. Generate configurations
      console.log('⚙️ Generating configurations from template...');
      const generationResult = await this.templateEngine.generateAllConfigurations(templateName, './temp-config');

      if (!generationResult.success) {
        throw new DeploymentError('Configuration generation failed', generationResult.summary.errors);
      }

      // 4. Validate generated configurations
      console.log('✅ Validating generated configurations...');
      const configValidation = await this.validateGeneratedConfigurations('./temp-config');
      if (!configValidation.isValid && !options.force) {
        throw new DeploymentError('Generated configuration validation failed', configValidation.errors);
      }

      // 5. Deploy configurations (dry run first if requested)
      if (options.dryRun) {
        console.log('🧪 Dry run mode - configurations generated but not deployed');
        return {
          deploymentId,
          success: true,
          dryRun: true,
          duration: Date.now() - startTime,
          backup,
          generationResult,
          validation: configValidation,
          deployedFiles: [],
          summary: 'Dry run completed successfully - configurations ready for deployment'
        };
      }

      console.log('📦 Deploying configurations...');
      const deployedFiles = await this.deployConfigurations('./temp-config');

      // 6. Post-deployment validation
      console.log('🔬 Running post-deployment validation...');
      const postValidation = await this.validatePostDeployment();
      
      if (!postValidation.isValid && !options.skipPostValidation) {
        console.log('⚠️ Post-deployment validation failed - initiating rollback...');
        await this.rollbackDeployment(backup.id);
        throw new DeploymentError('Post-deployment validation failed - rolled back', postValidation.errors);
      }

      // 7. Cleanup temporary files
      await this.cleanupTempFiles('./temp-config');

      const duration = Date.now() - startTime;
      console.log(`✅ Deployment completed successfully in ${duration}ms`);

      return {
        deploymentId,
        success: true,
        dryRun: false,
        duration,
        backup,
        generationResult,
        validation: postValidation,
        deployedFiles,
        summary: `Successfully deployed ${deployedFiles.length} configuration files`
      };

    } catch (error) {
      console.log('❌ Deployment failed:', error instanceof Error ? error.message : 'Unknown error');
      
      // Cleanup temp files on failure
      await this.cleanupTempFiles('./temp-config').catch(() => {});

      if (error instanceof DeploymentError) {
        return {
          deploymentId,
          success: false,
          dryRun: false,
          duration: Date.now() - startTime,
          error: error.message,
          errors: error.validationErrors,
          summary: `Deployment failed: ${error.message}`
        };
      }

      throw error;
    }
  }

  /**
   * Create comprehensive system backup
   */
  async createSystemBackup(deploymentId?: string): Promise<BackupManifest> {
    const backupId = deploymentId || this.generateDeploymentId();
    const timestamp = new Date().toISOString();
    const backupPath = path.join(this.backupDir, backupId);

    await fs.mkdir(backupPath, { recursive: true });

    const filesToBackup = [
      'lib/analysis/utils/BrandNameResolver.ts',
      'utils/field-aliases.ts',
      'components/chat/chat-constants.ts',
      'lib/embedding/EndpointDescriptions.ts',
      'lib/analysis/ConfigurationManager.ts',
      'lib/routing/DomainConfigurationLoader.ts'
    ];

    const backedUpFiles: BackedUpFile[] = [];
    const errors: string[] = [];

    for (const filePath of filesToBackup) {
      try {
        const exists = await this.fileExists(filePath);
        if (exists) {
          const content = await fs.readFile(filePath, 'utf-8');
          const checksum = this.calculateChecksum(content);
          const backupFilePath = path.join(backupPath, path.basename(filePath));
          
          await fs.writeFile(backupFilePath, content, 'utf-8');
          
          backedUpFiles.push({
            originalPath: filePath,
            backupPath: backupFilePath,
            checksum,
            size: content.length,
            lastModified: (await fs.stat(filePath)).mtime
          });
          
          console.log(`  ✅ Backed up: ${filePath}`);
        } else {
          console.log(`  ⚠️ File not found (skipped): ${filePath}`);
        }
      } catch (error) {
        const errorMsg = `Failed to backup ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.log(`  ❌ ${errorMsg}`);
      }
    }

    const manifest: BackupManifest = {
      id: backupId,
      timestamp,
      backupPath,
      files: backedUpFiles,
      errors,
      totalFiles: backedUpFiles.length,
      totalSize: backedUpFiles.reduce((sum, file) => sum + file.size, 0)
    };

    // Save manifest
    const manifestPath = path.join(backupPath, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`💾 Backup created: ${backupId} (${manifest.totalFiles} files, ${this.formatBytes(manifest.totalSize)})`);

    return manifest;
  }

  /**
   * Rollback to previous configuration
   */
  async rollbackDeployment(backupId: string): Promise<RollbackResult> {
    console.log(`🔄 Rolling back deployment: ${backupId}`);
    
    try {
      const backupPath = path.join(this.backupDir, backupId);
      const manifestPath = path.join(backupPath, 'manifest.json');
      
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: BackupManifest = JSON.parse(manifestContent);
      
      const restoredFiles: string[] = [];
      const errors: string[] = [];

      for (const file of manifest.files) {
        try {
          const backupContent = await fs.readFile(file.backupPath, 'utf-8');
          const backupChecksum = this.calculateChecksum(backupContent);
          
          if (backupChecksum !== file.checksum) {
            errors.push(`Checksum mismatch for ${file.originalPath} - backup may be corrupted`);
            continue;
          }
          
          // Ensure directory exists
          await fs.mkdir(path.dirname(file.originalPath), { recursive: true });
          
          // Restore file
          await fs.writeFile(file.originalPath, backupContent, 'utf-8');
          restoredFiles.push(file.originalPath);
          
          console.log(`  ✅ Restored: ${file.originalPath}`);
          
        } catch (error) {
          const errorMsg = `Failed to restore ${file.originalPath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.log(`  ❌ ${errorMsg}`);
        }
      }

      const success = errors.length === 0;
      const duration = Date.now();

      if (success) {
        console.log(`✅ Rollback completed successfully (${restoredFiles.length} files restored)`);
      } else {
        console.log(`⚠️ Rollback completed with errors (${restoredFiles.length} files restored, ${errors.length} errors)`);
      }

      return {
        backupId,
        success,
        restoredFiles,
        errors,
        duration,
        summary: success 
          ? `Successfully restored ${restoredFiles.length} files`
          : `Restored ${restoredFiles.length} files with ${errors.length} errors`
      };

    } catch (error) {
      const errorMsg = `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.log(`❌ ${errorMsg}`);
      
      return {
        backupId,
        success: false,
        restoredFiles: [],
        errors: [errorMsg],
        duration: 0,
        summary: errorMsg
      };
    }
  }

  /**
   * Validate system before deployment
   */
  private async validatePreDeployment(templateName: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if template exists
    const template = this.templateEngine.getTemplate(templateName);
    if (!template) {
      errors.push({
        code: 'TEMPLATE_NOT_FOUND',
        message: `Template '${templateName}' not found`,
        severity: 'critical'
      });
      return { isValid: false, errors, warnings, recommendations: [], score: 0 };
    }

    // Validate current system state
    const configFiles = [
      'lib/analysis/utils/BrandNameResolver.ts',
      'utils/field-aliases.ts'
    ];

    for (const filePath of configFiles) {
      const exists = await this.fileExists(filePath);
      if (!exists) {
        warnings.push({
          code: 'MISSING_CONFIG_FILE',
          message: `Configuration file ${filePath} does not exist - will be created`,
          impact: 'New file will be created during deployment'
        });
      }
    }

    const isValid = errors.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0;
    const score = Math.max(0, 1.0 - (errors.length * 0.3 + warnings.length * 0.1));

    return { isValid, errors, warnings, recommendations: [], score };
  }

  /**
   * Validate generated configurations
   */
  private async validateGeneratedConfigurations(configDir: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    try {
      const files = await fs.readdir(configDir);
      
      if (files.length === 0) {
        errors.push({
          code: 'NO_CONFIGS_GENERATED',
          message: 'No configuration files were generated',
          severity: 'critical'
        });
      }

      // Basic validation of generated files
      for (const file of files) {
        const filePath = path.join(configDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        if (content.length === 0) {
          errors.push({
            code: 'EMPTY_CONFIG_FILE',
            message: `Generated configuration file ${file} is empty`,
            severity: 'high'
          });
        }

        // Check for template markers
        if (!content.includes('Auto-generated')) {
          warnings.push({
            code: 'MISSING_GENERATION_MARKER',
            message: `Configuration file ${file} missing generation marker`,
            impact: 'File may not be recognized as template-generated'
          });
        }
      }

    } catch (error) {
      errors.push({
        code: 'CONFIG_VALIDATION_FAILED',
        message: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'high'
      });
    }

    const isValid = errors.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0;
    const score = Math.max(0, 1.0 - (errors.length * 0.3 + warnings.length * 0.1));

    return { isValid, errors, warnings, recommendations: [], score };
  }

  /**
   * Deploy configurations to target locations
   */
  private async deployConfigurations(configDir: string): Promise<DeployedFile[]> {
    const fileMapping: Record<string, string> = {
      'BrandNameResolver.ts': 'lib/analysis/utils/BrandNameResolver.ts',
      'field-aliases.ts': 'utils/field-aliases.ts',
      'chat-constants.ts': 'components/chat/chat-constants.ts',
      'EndpointDescriptions.ts': 'lib/embedding/EndpointDescriptions.ts',
      'ConfigurationManager.ts': 'lib/analysis/ConfigurationManager.ts',
      'DomainConfigurationLoader.ts': 'lib/routing/DomainConfigurationLoader.ts'
    };

    const deployedFiles: DeployedFile[] = [];
    const files = await fs.readdir(configDir);

    for (const file of files) {
      const targetPath = fileMapping[file];
      if (!targetPath) {
        console.log(`  ⚠️ No target mapping for ${file} - skipping`);
        continue;
      }

      try {
        const sourcePath = path.join(configDir, file);
        const content = await fs.readFile(sourcePath, 'utf-8');
        
        // Ensure target directory exists
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        
        // Deploy file
        await fs.writeFile(targetPath, content, 'utf-8');
        
        deployedFiles.push({
          sourceFile: file,
          targetPath: targetPath,
          size: content.length,
          checksum: this.calculateChecksum(content),
          deployedAt: new Date()
        });
        
        console.log(`  ✅ Deployed: ${file} → ${targetPath}`);
        
      } catch (error) {
        console.log(`  ❌ Failed to deploy ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    }

    return deployedFiles;
  }

  /**
   * Validate system after deployment
   */
  private async validatePostDeployment(): Promise<ValidationResult> {
    // Run the existing migration readiness validation
    try {
      const { spawn } = require('child_process');
      
      return new Promise((resolve) => {
        const process = spawn('npm', ['run', 'validate-migration-readiness', '--', '--json'], {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let output = '';
        
        process.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        process.on('close', (code: number | null) => {
          if (code === 0) {
            resolve({
              isValid: true,
              errors: [],
              warnings: [],
              recommendations: ['Post-deployment validation passed'],
              score: 1.0
            });
          } else {
            resolve({
              isValid: false,
              errors: [{
                code: 'POST_DEPLOYMENT_VALIDATION_FAILED',
                message: 'System validation failed after deployment',
                severity: 'high'
              }],
              warnings: [],
              recommendations: ['Check system logs and consider rollback'],
              score: 0.3
            });
          }
        });
      });
      
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          code: 'VALIDATION_EXECUTION_FAILED',
          message: `Could not run post-deployment validation: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'medium'
        }],
        warnings: [],
        recommendations: ['Manually verify system functionality'],
        score: 0.5
      };
    }
  }

  // Utility methods
  private generateDeploymentId(): string {
    return `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async cleanupTempFiles(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up temporary files: ${tempDir}`);
    } catch (error) {
      console.log(`⚠️ Could not cleanup temp files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Supporting types and classes
export interface DeploymentOptions {
  dryRun?: boolean;
  force?: boolean;
  skipPostValidation?: boolean;
}

export interface DeploymentResult {
  deploymentId: string;
  success: boolean;
  dryRun: boolean;
  duration: number;
  backup?: BackupManifest;
  generationResult?: any;
  validation?: ValidationResult;
  deployedFiles?: DeployedFile[];
  error?: string;
  errors?: ValidationError[];
  summary: string;
}

export interface BackupManifest {
  id: string;
  timestamp: string;
  backupPath: string;
  files: BackedUpFile[];
  errors: string[];
  totalFiles: number;
  totalSize: number;
}

export interface BackedUpFile {
  originalPath: string;
  backupPath: string;
  checksum: string;
  size: number;
  lastModified: Date;
}

export interface DeployedFile {
  sourceFile: string;
  targetPath: string;
  size: number;
  checksum: string;
  deployedAt: Date;
}

export interface RollbackResult {
  backupId: string;
  success: boolean;
  restoredFiles: string[];
  errors: string[];
  duration: number;
  summary: string;
}

export class DeploymentError extends Error {
  constructor(
    message: string,
    public validationErrors: ValidationError[] = []
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}