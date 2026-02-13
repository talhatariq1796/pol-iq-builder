import { QueryClassifier, ClassificationResult } from './query-classifier';
import { chatStateManager } from './chat-state-manager';
import { VisualizationType } from '../reference/dynamic-layers';
import { MLQueryClassifier } from './ml-query-classifier';
import { ClaudeAIAnalysisService } from '../services/claude-service';
import { AnalysisResult } from './analytics/types';

/**
 * Handles chat-based query processing with multi-stage AI classification.
 * Implements the new flow: ML/microservice classifier → pattern/keyword fallback → Claude AI enhancement.
 */
export class ChatQueryHandler {
  private classifier: QueryClassifier;
  private mlClassifier: MLQueryClassifier;
  private claudeService: ClaudeAIAnalysisService;
  private readonly CONFIDENCE_THRESHOLD = 0.75;

  constructor(classifier: QueryClassifier, mlClassifier: MLQueryClassifier, claudeService: ClaudeAIAnalysisService) {
    this.classifier = classifier;
    this.mlClassifier = mlClassifier;
    this.claudeService = claudeService;
  }

  /**
   * Process a user query with multi-stage AI classification and clarification.
   * @param sessionId - Chat session ID
   * @param query - User's query
   * @param context - (Optional) Context for future contextual chat
   */
  async processQuery(sessionId: string, query: string, context?: any): Promise<{
    response: string;
    visualizationType?: VisualizationType;
    confidence: number;
    needsClarification: boolean;
    source: 'ml' | 'pattern' | 'claude' | 'clarification';
  }> {
    // Add user message to chat history
    chatStateManager.addMessage(sessionId, query, 'user');

    // Check for pending clarification questions
    const pendingQuestions = chatStateManager.getPendingClarifications(sessionId);
    if (pendingQuestions.length > 0) {
      const result = await this.handleClarificationResponse(sessionId, query, pendingQuestions[0]);
      return { ...result, source: 'clarification' };
    }

    // === 1. ML/Microservice Classifier (Primary) ===
    let mlResult: ClassificationResult | null = null;
    try {
      const mlPrediction = await this.mlClassifier.classifyQuery(query);
      if (mlPrediction && mlPrediction.confidence >= this.CONFIDENCE_THRESHOLD) {
        mlResult = {
          visualizationType: mlPrediction.type,
          confidence: mlPrediction.confidence,
          explanation: 'ML classifier',
        };
      }
    } catch (e) {
      // ML service unavailable or error
      mlResult = null;
    }
    if (mlResult) {
      chatStateManager.addMessage(sessionId, this.generateClassificationMessage(mlResult), 'system', {
        visualizationType: mlResult.visualizationType,
        confidence: mlResult.confidence,
        source: 'ml',
      });
      return {
        response: this.generateResponse(mlResult),
        visualizationType: mlResult.visualizationType,
        confidence: mlResult.confidence,
        needsClarification: false,
        source: 'ml',
      };
    }

    // === 2. Pattern/Keyword Classifier (Fallback) ===
    const patternResult = await this.classifier.classifyQuery(query);
    if (patternResult && patternResult.confidence >= this.CONFIDENCE_THRESHOLD) {
      chatStateManager.addMessage(sessionId, this.generateClassificationMessage(patternResult), 'system', {
        visualizationType: patternResult.visualizationType,
        confidence: patternResult.confidence,
        source: 'pattern',
      });
      return {
        response: this.generateResponse(patternResult),
        visualizationType: patternResult.visualizationType,
        confidence: patternResult.confidence,
        needsClarification: false,
        source: 'pattern',
      };
    }

    // === 3. Claude AI API (Enhancement for Ambiguity) ===
    let claudeResult: ClassificationResult | null = null;
    try {
      // Use Claude for enhanced analysis (pass context if available)
      const aiResult = await this.claudeService.analyze({ prompt: query, context });
      if (aiResult && aiResult.analysis && aiResult.analysis.confidence && aiResult.analysis.confidence >= this.CONFIDENCE_THRESHOLD) {
        claudeResult = {
          visualizationType: undefined, // Map Claude's output to VisualizationType if possible
          confidence: aiResult.analysis.confidence,
          explanation: aiResult.analysis.summary || 'Claude AI',
        };
        // TODO: Map Claude's analysis to a VisualizationType if possible
      }
    } catch (e) {
      claudeResult = null;
    }
    if (claudeResult) {
      chatStateManager.addMessage(sessionId, this.generateClassificationMessage(claudeResult), 'system', {
        visualizationType: claudeResult.visualizationType,
        confidence: claudeResult.confidence,
        source: 'claude',
      });
      return {
        response: this.generateResponse(claudeResult),
        visualizationType: claudeResult.visualizationType,
        confidence: claudeResult.confidence,
        needsClarification: false,
        source: 'claude',
      };
    }

    // === 4. Clarification (All methods low confidence or failed) ===
    const fallbackResult = patternResult || { confidence: 0 };
    const clarificationQuestion = this.generateClarificationQuestion(query, fallbackResult);
    if (clarificationQuestion) {
      chatStateManager.addClarificationQuestion(
        sessionId,
        clarificationQuestion.question,
        clarificationQuestion.options,
        {
          originalQuery: query,
          currentConfidence: fallbackResult.confidence,
          matchedPatterns: [{
            type: clarificationQuestion.expectedType as VisualizationType,
            weight: fallbackResult.confidence,
            pattern: query,
          }],
        }
      );
      return {
        response: clarificationQuestion.question,
        needsClarification: true,
        confidence: fallbackResult.confidence,
        source: 'clarification',
      };
    }

    // Fallback: Unable to classify or clarify
    return {
      response: "I'm having trouble understanding that. Could you rephrase?",
      confidence: 0,
      needsClarification: true,
      source: 'clarification',
    };
  }

  /**
   * Handle a response to a clarification question
   */
  private async handleClarificationResponse(
    sessionId: string,
    response: string,
    question: {
      id: string;
      question: string;
      options: string[];
      expectedType: string;
      context: {
        originalQuery: string;
        currentConfidence: number;
        matchedPatterns: Array<{
          type: VisualizationType;
          weight: number;
          pattern: string;
        }>;
      };
    }
  ): Promise<{
    response: string;
    visualizationType?: VisualizationType;
    confidence: number;
    needsClarification: boolean;
  }> {
    // Remove the answered question
    chatStateManager.removeClarificationQuestion(sessionId, question.id);

    // Process the response
    const selectedOption = this.matchResponseToOptions(response, question.options);
    if (selectedOption) {
      // Update confidence based on user's response
      const newConfidence = Math.min(0.9, question.context.currentConfidence + 0.2);

      // Convert string expectedType to VisualizationType
      const visualizationType = question.expectedType as VisualizationType;

      // Add system message
      chatStateManager.addMessage(
        sessionId,
        `I'll show you ${selectedOption.toLowerCase()}.`,
        'system',
        {
          visualizationType,
          confidence: newConfidence
        }
      );

      // Update data context
      chatStateManager.updateDataContext(sessionId, {
        visualizationType
      });

      return {
        response: `I'll show you ${selectedOption.toLowerCase()}.`,
        visualizationType,
        confidence: newConfidence,
        needsClarification: false
      };
    }

    // If response doesn't match options, ask for clarification again
    return {
      response: "I didn't quite understand. " + question.question,
      needsClarification: true,
      confidence: question.context.currentConfidence
    };
  }

  /**
   * Generate a clarification question based on classification result
   */
  private generateClarificationQuestion(
    query: string,
    classification: ClassificationResult
  ): {
    question: string;
    options: string[];
    expectedType: VisualizationType;
    context: {
      originalQuery: string;
      currentConfidence: number;
      matchedPatterns: Array<{
        type: VisualizationType;
        weight: number;
        pattern: string;
      }>;
    };
  } | null {
    if (!classification.visualizationType) {
      return {
        question: "Would you like to see individual points or grouped data?",
        options: ["Individual points", "Grouped data"],
        expectedType: VisualizationType.SCATTER,
        context: {
          originalQuery: query,
          currentConfidence: classification.confidence,
          matchedPatterns: []
        }
      };
    }

    // Generate specific questions based on visualization type
    switch (classification.visualizationType) {
      case VisualizationType.SCATTER:
        return {
          question: "Would you like to see all points or focus on specific areas?",
          options: ["All points", "Specific areas"],
          expectedType: VisualizationType.SCATTER,
          context: {
            originalQuery: query,
            currentConfidence: classification.confidence,
            matchedPatterns: []
          }
        };

      case VisualizationType.CLUSTER:
        return {
          question: "Would you like to see clusters by similarity or by geographic area?",
          options: ["By similarity", "By geographic area"],
          expectedType: VisualizationType.CLUSTER,
          context: {
            originalQuery: query,
            currentConfidence: classification.confidence,
            matchedPatterns: []
          }
        };

      case VisualizationType.TRENDS:
        return {
          question: "Would you like to see changes over time or compare different time periods?",
          options: ["Changes over time", "Compare time periods"],
          expectedType: VisualizationType.TRENDS,
          context: {
            originalQuery: query,
            currentConfidence: classification.confidence,
            matchedPatterns: []
          }
        };

      default:
        return null;
    }
  }

  /**
   * Check if a classification result needs clarification
   */
  private needsClarification(classification: ClassificationResult): boolean {
    return (
      !classification.visualizationType ||
      classification.confidence < this.CONFIDENCE_THRESHOLD ||
      classification.error !== undefined
    );
  }

  /**
   * Match user response to clarification options
   */
  private matchResponseToOptions(response: string, options: string[]): string | null {
    const lowerResponse = response.toLowerCase();
    for (const option of options) {
      if (lowerResponse.includes(option.toLowerCase())) {
        return option;
      }
    }
    return null;
  }

  /**
   * Generate a response message based on classification result
   */
  private generateResponse(classification: ClassificationResult): string {
    if (classification.error) {
      return `I'm having trouble understanding that. ${classification.error}`;
    }

    if (!classification.visualizationType) {
      return "I'm not sure what type of visualization you're looking for. Could you provide more details?";
    }

    return `I'll show you a ${classification.visualizationType.toLowerCase()} visualization.`;
  }

  /**
   * Generate a message about the classification result
   */
  private generateClassificationMessage(classification: ClassificationResult): string {
    if (classification.error) {
      return `Error: ${classification.error}`;
    }

    if (!classification.visualizationType) {
      return "No specific visualization type identified.";
    }

    return `Classified as ${classification.visualizationType} with ${Math.round(classification.confidence * 100)}% confidence.`;
  }
}

// DOCUMENTATION:
// - This file now implements the new multi-stage query classification flow as described in ai-system-workflow.md and query-visualization-flow-reference.md.
// - The process is: ML classifier → pattern/keyword fallback → Claude AI enhancement → clarification.
// - The result includes a 'source' field for transparency.
// - Context parameter is supported for future contextual chat integration.

// Export a singleton instance
export const chatQueryHandler = new ChatQueryHandler(new QueryClassifier(), new MLQueryClassifier(), new ClaudeAIAnalysisService()); 