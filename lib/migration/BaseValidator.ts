import { ValidationResult, ValidationError, ValidationWarning } from './types';

/**
 * Base validation class providing common functionality for all validators
 * Implements consistent error handling, scoring, and reporting
 */
export abstract class BaseValidator {
  abstract readonly name: string;
  abstract readonly description: string;
  protected readonly version: string = '1.0.0';

  /**
   * Main validation method - must be implemented by subclasses
   */
  abstract validate(context?: any): Promise<ValidationResult>;

  /**
   * Create a validation error with consistent formatting
   */
  protected createError(
    code: string, 
    message: string, 
    severity: ValidationError['severity'], 
    file?: string,
    line?: number,
    suggestion?: string
  ): ValidationError {
    return { 
      code: `${this.name.toUpperCase()}_${code}`,
      message, 
      severity, 
      file, 
      line,
      suggestion
    };
  }

  /**
   * Create a validation warning with consistent formatting
   */
  protected createWarning(
    code: string, 
    message: string, 
    impact: string,
    recommendation?: string
  ): ValidationWarning {
    return { 
      code: `${this.name.toUpperCase()}_${code}`,
      message, 
      impact,
      recommendation
    };
  }

  /**
   * Calculate validation score based on errors and warnings
   * Score: 1.0 = perfect, 0.0 = critical failure
   */
  protected calculateScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
    if (errors.length === 0 && warnings.length === 0) return 1.0;

    let deductions = 0;
    
    // Deduct points for errors based on severity
    errors.forEach(error => {
      switch (error.severity) {
        case 'critical': deductions += 0.5; break;
        case 'high': deductions += 0.3; break;
        case 'medium': deductions += 0.15; break;
        case 'low': deductions += 0.05; break;
      }
    });

    // Deduct smaller amounts for warnings
    deductions += warnings.length * 0.02;

    // Ensure score doesn't go below 0
    return Math.max(0, 1.0 - deductions);
  }

  /**
   * Create a successful validation result
   */
  protected createSuccessResult(recommendations: string[] = []): ValidationResult {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations,
      score: 1.0
    };
  }

  /**
   * Create a validation result from errors and warnings
   */
  protected createResult(
    errors: ValidationError[], 
    warnings: ValidationWarning[] = [],
    recommendations: string[] = []
  ): ValidationResult {
    const score = this.calculateScore(errors, warnings);
    const isValid = errors.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0;

    return {
      isValid,
      errors,
      warnings,
      recommendations,
      score
    };
  }

  /**
   * Format validation result for console output
   */
  formatResult(result: ValidationResult): string {
    const lines: string[] = [];
    
    lines.push(`\n🔍 ${this.name} Validation Results`);
    lines.push(`Score: ${(result.score * 100).toFixed(1)}% | Status: ${result.isValid ? '✅ PASS' : '❌ FAIL'}`);
    
    if (result.errors.length > 0) {
      lines.push(`\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach((error, i) => {
        const severity = error.severity.toUpperCase().padEnd(8);
        const location = error.file ? ` (${error.file}${error.line ? `:${error.line}` : ''})` : '';
        lines.push(`  ${i + 1}. [${severity}] ${error.message}${location}`);
        if (error.suggestion) {
          lines.push(`     💡 ${error.suggestion}`);
        }
      });
    }

    if (result.warnings.length > 0) {
      lines.push(`\n⚠️ Warnings (${result.warnings.length}):`);
      result.warnings.forEach((warning, i) => {
        lines.push(`  ${i + 1}. ${warning.message}`);
        lines.push(`     Impact: ${warning.impact}`);
        if (warning.recommendation) {
          lines.push(`     💡 ${warning.recommendation}`);
        }
      });
    }

    if (result.recommendations.length > 0) {
      lines.push(`\n💡 Recommendations:`);
      result.recommendations.forEach((rec, i) => {
        lines.push(`  ${i + 1}. ${rec}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Validate that a file exists and is readable
   */
  protected async validateFileExists(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file content safely
   */
  protected async readFile(filePath: string): Promise<string | null> {
    try {
      const fs = await import('fs/promises');
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Parse JSON file safely
   */
  protected async readJsonFile<T = any>(filePath: string): Promise<T | null> {
    try {
      const content = await this.readFile(filePath);
      if (!content) return null;
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Extract field names from TypeScript/JavaScript content
   */
  protected extractFieldNames(content: string): string[] {
    const fieldPattern = /['"](MP\d+[A-Z_]*)['"]/g;
    const fields: string[] = [];
    let match;
    
    while ((match = fieldPattern.exec(content)) !== null) {
      if (!fields.includes(match[1])) {
        fields.push(match[1]);
      }
    }
    
    return fields;
  }

  /**
   * Check if two arrays have the same elements (order independent)
   */
  protected arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, i) => val === sorted2[i]);
  }
}