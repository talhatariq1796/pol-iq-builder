/**
 * Hybrid Routing Test Suite
 * 
 * Comprehensive testing for the hybrid routing system including validation,
 * intent classification, and end-to-end routing accuracy
 */

import { HybridRoutingEngine } from '../HybridRoutingEngine';
import { domainConfigLoader } from '../DomainConfigurationLoader';
import { DatasetContext } from '../types/ContextTypes';
import { QueryScope } from '../types/DomainTypes';

export interface TestCase {
  query: string;
  expected_endpoint?: string;
  expected_scope: QueryScope;
  min_confidence?: number;
  description: string;
  category: 'in_scope' | 'out_of_scope' | 'borderline' | 'malformed';
}

export interface TestSuiteResult {
  overall_accuracy: number;
  in_scope_accuracy: number;
  out_of_scope_rejection_rate: number;
  borderline_appropriate_handling: number;
  false_positives: TestCase[];        // Out-of-scope routed to endpoints
  false_negatives: TestCase[];        // In-scope queries rejected
  confidence_calibration: number;
  performance_metrics: {
    avg_processing_time: number;
    max_processing_time: number;
    min_processing_time: number;
  };
  detailed_results: Array<{
    test_case: TestCase;
    result: any;
    passed: boolean;
    issues: string[];
  }>;
}

export class HybridRoutingTestSuite {
  private routingEngine: HybridRoutingEngine;
  
  constructor() {
    this.routingEngine = new HybridRoutingEngine();
  }

  /**
   * Run comprehensive test suite
   */
  async runTestSuite(
    customTestCases?: TestCase[],
    datasetContext?: DatasetContext
  ): Promise<TestSuiteResult> {
    await this.routingEngine.initialize();
    
    const testCases = customTestCases || this.getDefaultTestCases();
    const detailedResults = [];
    const processingTimes: number[] = [];
    
    let totalPassed = 0;
    let inScopeCorrect = 0;
    let inScopeTotal = 0;
    let outOfScopeCorrect = 0;
    let outOfScopeTotal = 0;
    let borderlineAppropriate = 0;
    let borderlineTotal = 0;
    
    const falsePositives: TestCase[] = [];
    const falseNegatives: TestCase[] = [];
    
    console.log(`[HybridRoutingTestSuite] Running ${testCases.length} test cases...`);
    
    for (const testCase of testCases) {
      const startTime = performance.now();
      const result = await this.routingEngine.route(testCase.query, datasetContext);
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      processingTimes.push(processingTime);
      
      const evaluation = this.evaluateTestCase(testCase, result);
      detailedResults.push({
        test_case: testCase,
        result: result,
        passed: evaluation.passed,
        issues: evaluation.issues
      });
      
      if (evaluation.passed) {
        totalPassed++;
      }
      
      // Category-specific tracking
      if (testCase.category === 'in_scope') {
        inScopeTotal++;
        if (result.success && 
            (!testCase.expected_endpoint || result.endpoint === testCase.expected_endpoint) &&
            (!testCase.min_confidence || (result.confidence || 0) >= testCase.min_confidence)) {
          inScopeCorrect++;
        } else if (!result.success) {
          falseNegatives.push(testCase);
        }
      } else if (testCase.category === 'out_of_scope') {
        outOfScopeTotal++;
        if (!result.success && result.validation.scope === QueryScope.OUT_OF_SCOPE) {
          outOfScopeCorrect++;
        } else if (result.success) {
          falsePositives.push(testCase);
        }
      } else if (testCase.category === 'borderline') {
        borderlineTotal++;
        if (this.isBorderlineHandledAppropriately(result)) {
          borderlineAppropriate++;
        }
      }
    }
    
    const overallAccuracy = totalPassed / testCases.length;
    const inScopeAccuracy = inScopeTotal > 0 ? inScopeCorrect / inScopeTotal : 1;
    const outOfScopeRejectionRate = outOfScopeTotal > 0 ? outOfScopeCorrect / outOfScopeTotal : 1;
    const borderlineHandlingRate = borderlineTotal > 0 ? borderlineAppropriate / borderlineTotal : 1;
    
    // Optional debug output for failures
    if (process.env.DEBUG_HYBRID_SUITE === 'true') {
      const inScopeFailures = detailedResults.filter(r => r.test_case.category === 'in_scope' && !r.passed);
      if (inScopeFailures.length > 0) {
        console.log('[HybridRoutingTestSuite][DEBUG] In-scope failures:');
        inScopeFailures.forEach(f => {
          console.log(` - Q: ${f.test_case.query}`);
          console.log(`   Expected: ${f.test_case.expected_endpoint || 'N/A'} minConf=${f.test_case.min_confidence ?? 'n/a'}`);
          console.log(`   Got: ${f.result.endpoint || 'N/A'} conf=${(f.result.confidence ?? 0).toFixed(2)} scope=${f.result.validation?.scope}`);
          console.log(`   Issues: ${f.issues.join('; ')}`);
        });
      }
    }

    return {
      overall_accuracy: overallAccuracy,
      in_scope_accuracy: inScopeAccuracy,
      out_of_scope_rejection_rate: outOfScopeRejectionRate,
      borderline_appropriate_handling: borderlineHandlingRate,
      false_positives: falsePositives,
      false_negatives: falseNegatives,
      confidence_calibration: this.calculateConfidenceCalibration(detailedResults),
      performance_metrics: {
        avg_processing_time: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length,
        max_processing_time: Math.max(...processingTimes),
        min_processing_time: Math.min(...processingTimes)
      },
      detailed_results: detailedResults
    };
  }

  /**
   * Get default comprehensive test cases
   */
  private getDefaultTestCases(): TestCase[] {
    return [
      // IN-SCOPE QUERIES
      {
        query: "Show me demographic analysis for tax preparation markets",
        expected_endpoint: "/demographic-insights",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.6,
        description: "Clear demographic analysis request with domain context",
        category: "in_scope"
      },
      {
        query: "Analyze strategic expansion opportunities",
        expected_endpoint: "/strategic-analysis",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.5,
        description: "Strategic analysis with clear intent",
        category: "in_scope"
      },
      {
        query: "Compare competitive positioning between different markets",
        expected_endpoint: "/competitive-analysis",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.5,
        description: "Competitive analysis with comparison element",
        category: "in_scope"
      },
      {
        query: "What are the demographics in high-performing areas?",
        expected_endpoint: "/demographic-insights",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.4,
        description: "Question form demographic query",
        category: "in_scope"
      },
      {
        query: "Show me market insights",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.3,
        description: "General analysis request",
        category: "in_scope"
      },

      // OUT-OF-SCOPE QUERIES
      {
        query: "What's the weather forecast for tomorrow?",
        expected_scope: QueryScope.OUT_OF_SCOPE,
        description: "Weather query - clearly out of scope",
        category: "out_of_scope"
      },
      {
        query: "How do I cook pasta?",
        expected_scope: QueryScope.OUT_OF_SCOPE,
        description: "Cooking recipe - personal request",
        category: "out_of_scope"
      },
      {
        query: "Fix my computer error",
        expected_scope: QueryScope.OUT_OF_SCOPE,
        description: "Technical support request",
        category: "out_of_scope"
      },
      {
        query: "Write me a story about dragons",
        expected_scope: QueryScope.OUT_OF_SCOPE,
        description: "Creative writing request",
        category: "out_of_scope"
      },
      {
        query: "What is the capital of France?",
        expected_scope: QueryScope.OUT_OF_SCOPE,
        description: "General knowledge question",
        category: "out_of_scope"
      },
      {
        query: "I need relationship advice",
        expected_scope: QueryScope.OUT_OF_SCOPE,
        description: "Personal advice request",
        category: "out_of_scope"
      },

      // BORDERLINE QUERIES
      {
        query: "analyze",
        expected_scope: QueryScope.BORDERLINE,
        description: "Single word - needs clarification",
        category: "borderline"
      },
      {
        query: "Tell me about the data",
        expected_scope: QueryScope.BORDERLINE,
        description: "Vague data request - could be analysis related",
        category: "borderline"
      },
      {
        query: "What can you do?",
        expected_scope: QueryScope.BORDERLINE,
        description: "Meta question about capabilities",
        category: "borderline"
      },
      {
        query: "Show me information about markets",
        expected_scope: QueryScope.BORDERLINE,
        description: "Vague market request - needs specification",
        category: "borderline"
      },

      // MALFORMED QUERIES
      {
        query: "",
        expected_scope: QueryScope.MALFORMED,
        description: "Empty query",
        category: "malformed"
      },
      {
        query: "???",
        expected_scope: QueryScope.MALFORMED,
        description: "Only punctuation",
        category: "malformed"
      },
      {
        query: "a",
        expected_scope: QueryScope.MALFORMED,
        description: "Single character",
        category: "malformed"
      },
      {
        query: "123 456 789",
        expected_scope: QueryScope.MALFORMED,
        description: "Only numbers",
        category: "malformed"
      },

      // NOVEL PHRASING TESTS
      {
        query: "I'm interested in understanding the customer base characteristics",
        expected_endpoint: "/demographic-insights",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.4,
        description: "Natural language demographic request",
        category: "in_scope"
      },
      {
        query: "Could you help me figure out which areas would be best for expansion?",
        expected_endpoint: "/strategic-analysis",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.4,
        description: "Conversational strategic question",
        category: "in_scope"
      },
      {
        query: "I'd like to see how we stack up against the competition",
        expected_endpoint: "/competitive-analysis",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.4,
        description: "Informal competitive analysis request",
        category: "in_scope"
      },

      // COMPOUND QUERIES
      {
        query: "Show me demographics and competitive analysis",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.3,
        description: "Multi-intent query",
        category: "borderline"
      },
      {
        query: "Compare demographics between cities and show strategic opportunities",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.3,
        description: "Complex multi-part query",
        category: "borderline"
      },

      // DOMAIN-SPECIFIC TESTS
      {
        query: "Tax preparation market demographic analysis",
        expected_endpoint: "/demographic-insights",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.6,
        description: "Domain-specific demographic query",
        category: "in_scope"
      },
      {
        query: "H&R Block vs TurboTax market positioning",
        expected_endpoint: "/brand-difference",
        expected_scope: QueryScope.IN_SCOPE,
        min_confidence: 0.5,
        description: "Brand comparison with domain context",
        category: "in_scope"
      }
    ];
  }

  /**
   * Evaluate a single test case
   */
  private evaluateTestCase(testCase: TestCase, result: any): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check scope validation
    if (result.validation.scope !== testCase.expected_scope) {
      issues.push(`Expected scope ${testCase.expected_scope}, got ${result.validation.scope}`);
    }
    
    // Check endpoint routing for in-scope queries
    if (testCase.expected_endpoint && result.success) {
      if (result.endpoint !== testCase.expected_endpoint) {
        issues.push(`Expected endpoint ${testCase.expected_endpoint}, got ${result.endpoint}`);
      }
    }
    
    // Check confidence threshold
    if (testCase.min_confidence && result.confidence) {
      if (result.confidence < testCase.min_confidence) {
        issues.push(`Confidence ${result.confidence.toFixed(2)} below minimum ${testCase.min_confidence}`);
      }
    }
    
    // Check that out-of-scope queries are properly rejected
    if (testCase.category === 'out_of_scope' && result.success) {
      issues.push('Out-of-scope query was incorrectly routed to an endpoint');
    }
    
    // Check that in-scope queries are not rejected
    if (testCase.category === 'in_scope' && !result.success && result.validation.scope === QueryScope.OUT_OF_SCOPE) {
      issues.push('In-scope query was incorrectly rejected');
    }
    
    return {
      passed: issues.length === 0,
      issues
    };
  }

  /**
   * Check if borderline query is handled appropriately
   */
  private isBorderlineHandledAppropriately(result: any): boolean {
    // Borderline queries should either:
    // 1. Be routed with clarification/warning
    // 2. Request clarification
    // 3. Provide fallback with explanation
    
    return result.user_response.type === 'clarification' ||
           result.user_response.type === 'fallback' ||
           (result.success && result.user_response.type === 'success' && result.confidence && result.confidence < 0.7);
  }

  /**
   * Calculate confidence calibration score
   */
  private calculateConfidenceCalibration(detailedResults: any[]): number {
    // Measure how well confidence scores predict actual success
    const buckets = [0.2, 0.4, 0.6, 0.8, 1.0];
    let totalCalibrationError = 0;
    let totalSamples = 0;
    
    for (const bucket of buckets) {
      const bucketResults = detailedResults.filter(r => 
        r.result.confidence >= (bucket - 0.2) && r.result.confidence < bucket
      );
      
      if (bucketResults.length > 0) {
        const actualSuccessRate = bucketResults.filter(r => r.passed).length / bucketResults.length;
        const expectedSuccessRate = bucket - 0.1; // Midpoint of bucket
        const calibrationError = Math.abs(actualSuccessRate - expectedSuccessRate);
        
        totalCalibrationError += calibrationError * bucketResults.length;
        totalSamples += bucketResults.length;
      }
    }
    
    return totalSamples > 0 ? 1 - (totalCalibrationError / totalSamples) : 1;
  }

  /**
   * Run performance benchmark
   */
  async runPerformanceBenchmark(iterations: number = 100): Promise<{
    avg_processing_time: number;
    throughput_per_second: number;
    memory_usage?: number;
  }> {
    const testQuery = "Show me demographic analysis for market expansion";
    const times: number[] = [];
    
    console.log(`[HybridRoutingTestSuite] Running performance benchmark with ${iterations} iterations...`);
    
    // Warm up
    for (let i = 0; i < 10; i++) {
      await this.routingEngine.route(testQuery);
    }
    
    // Benchmark
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      await this.routingEngine.route(testQuery);
      const iterationEnd = performance.now();
      times.push(iterationEnd - iterationStart);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    return {
      avg_processing_time: times.reduce((a, b) => a + b, 0) / times.length,
      throughput_per_second: (iterations / totalTime) * 1000
    };
  }

  /**
   * Generate test report
   */
  generateReport(result: TestSuiteResult): string {
    const report = [];
    
    report.push("# Hybrid Routing System Test Report");
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push("");
    
    report.push("## Overall Results");
    report.push(`- **Overall Accuracy**: ${(result.overall_accuracy * 100).toFixed(1)}%`);
    report.push(`- **In-Scope Accuracy**: ${(result.in_scope_accuracy * 100).toFixed(1)}%`);
    report.push(`- **Out-of-Scope Rejection Rate**: ${(result.out_of_scope_rejection_rate * 100).toFixed(1)}%`);
    report.push(`- **Borderline Handling**: ${(result.borderline_appropriate_handling * 100).toFixed(1)}%`);
    report.push(`- **Confidence Calibration**: ${(result.confidence_calibration * 100).toFixed(1)}%`);
    report.push("");
    
    report.push("## Performance Metrics");
    report.push(`- **Average Processing Time**: ${result.performance_metrics.avg_processing_time.toFixed(2)}ms`);
    report.push(`- **Max Processing Time**: ${result.performance_metrics.max_processing_time.toFixed(2)}ms`);
    report.push(`- **Min Processing Time**: ${result.performance_metrics.min_processing_time.toFixed(2)}ms`);
    report.push("");
    
    if (result.false_positives.length > 0) {
      report.push("## False Positives (Out-of-scope queries routed to endpoints)");
      result.false_positives.forEach(fp => {
        report.push(`- "${fp.query}" - ${fp.description}`);
      });
      report.push("");
    }
    
    if (result.false_negatives.length > 0) {
      report.push("## False Negatives (In-scope queries rejected)");
      result.false_negatives.forEach(fn => {
        report.push(`- "${fn.query}" - ${fn.description}`);
      });
      report.push("");
    }
    
    report.push("## Detailed Results");
    const failed = result.detailed_results.filter(r => !r.passed);
    if (failed.length > 0) {
      failed.forEach(failure => {
        report.push(`**FAILED**: "${failure.test_case.query}"`);
        report.push(`  - Expected: ${failure.test_case.expected_endpoint || 'N/A'} (${failure.test_case.expected_scope})`);
        report.push(`  - Got: ${failure.result.endpoint || 'N/A'} (${failure.result.validation.scope})`);
        report.push(`  - Issues: ${failure.issues.join(', ')}`);
        report.push("");
      });
    } else {
      report.push("All test cases passed! 🎉");
    }
    // Add additional sections to enrich report content for debugging
    report.push("");
    report.push("## Passed Test Cases Summary");
    const passed = result.detailed_results.filter(r => r.passed);
    passed.slice(0, 50).forEach(success => {
      report.push(`- "${success.test_case.query}" -> ${success.result.endpoint || 'N/A'} (${success.result.validation.scope}) conf=${(success.result.confidence ?? 0).toFixed(2)} time=${(success.result.processing_time ?? 0).toFixed(2)}ms`);
    });
    report.push("");
    report.push("## Configuration & Thresholds Snapshot");
    try {
      const active = domainConfigLoader.getActiveConfiguration();
      report.push(`- Domain: ${active.domain.name} v${active.domain.version}`);
      report.push(`- Endpoints: ${Object.keys(active.endpoint_mappings).length}`);
      report.push(`- Validation thresholds: accept=${active.validation.thresholds.accept_threshold}, clarify=${active.validation.thresholds.clarify_threshold}, reject=${active.validation.thresholds.reject_threshold}`);
      report.push(`- Avoid terms configured for: ${Object.keys(active.avoid_terms).length} endpoints`);
    } catch {}
    
    return report.join("\n");
  }
}

// Export test runner
export const hybridRoutingTestSuite = new HybridRoutingTestSuite();