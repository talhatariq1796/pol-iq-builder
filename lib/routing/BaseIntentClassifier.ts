/**
 * BaseIntentClassifier - Domain-agnostic intent recognition
 * 
 * Extracts fundamental analytical intent without domain-specific vocabulary
 */

import { 
  BaseIntent, 
  IntentSignatures, 
  IntentClassification, 
  IntentMatchResult 
} from './types/BaseIntentTypes';

export class BaseIntentClassifier {
  private readonly INTENT_SIGNATURES: IntentSignatures = {
    [BaseIntent.DEMOGRAPHIC_ANALYSIS]: {
      subject_indicators: ['population', 'demographic', 'customer', 'people', 'residents', 'users', 'consumers'],
      analysis_indicators: ['characteristics', 'breakdown', 'composition', 'profile', 'attributes', 'traits'],
      scope_indicators: ['areas', 'regions', 'markets', 'locations', 'segments', 'communities'],
      quality_indicators: ['best', 'ideal', 'target', 'optimal', 'suitable', 'preferred']
    },
    
    [BaseIntent.COMPETITIVE_ANALYSIS]: {
  subject_indicators: ['competitive', 'competition', 'competitors', 'rivalry', 'rival', 'rivals'],
      analysis_indicators: ['positioning', 'advantage', 'landscape', 'dynamics', 'strength', 'performance'],
      scope_indicators: ['market', 'industry', 'sector', 'space', 'environment'],
      quality_indicators: ['strong', 'weak', 'leading', 'dominant', 'superior', 'winning']
    },
    
    [BaseIntent.STRATEGIC_ANALYSIS]: {
  subject_indicators: ['strategic', 'strategy', 'business', 'investment', 'opportunity'],
  analysis_indicators: ['opportunity', 'opportunities', 'potential', 'expansion', 'expand', 'expanding', 'growth', 'development', 'planning'],
  scope_indicators: ['market', 'markets', 'areas', 'regions', 'territories', 'locations'],
      quality_indicators: ['top', 'best', 'priority', 'key', 'critical', 'prime']
    },
    
    [BaseIntent.COMPARATIVE_ANALYSIS]: {
      subject_indicators: ['comparison', 'compare', 'versus', 'between', 'against', 'model', 'algorithm', 'agree', 'consensus'],
      analysis_indicators: ['difference', 'similarity', 'contrast', 'evaluation', 'assessment', 'performance', 'best', 'agree', 'consensus'],
      scope_indicators: ['cities', 'regions', 'markets', 'areas', 'locations', 'prediction', 'modeling', 'models', 'predictions'],
      quality_indicators: ['better', 'worse', 'superior', 'inferior', 'different', 'best', 'optimal', 'all', 'agreement']
    },
    
    [BaseIntent.PERFORMANCE_RANKING]: {
      subject_indicators: ['performance', 'ranking', 'score', 'rating', 'results', 'factors', 'importance', 'important'],
      analysis_indicators: ['rank', 'order', 'sort', 'list', 'top', 'bottom', 'important', 'predict', 'influence'],
      scope_indicators: ['markets', 'areas', 'regions', 'locations', 'segments', 'prediction', 'usage'],
      quality_indicators: ['highest', 'lowest', 'best', 'worst', 'top', 'bottom', 'most', 'key', 'critical']
    },
    
    [BaseIntent.DIFFERENCE_ANALYSIS]: {
      subject_indicators: ['difference', 'gap', 'variation', 'disparity', 'variance'],
      analysis_indicators: ['analyze', 'examine', 'study', 'investigate', 'explore'],
      scope_indicators: ['between', 'among', 'across', 'within'],
      quality_indicators: ['significant', 'major', 'minor', 'notable', 'substantial']
    },
    
    [BaseIntent.RELATIONSHIP_ANALYSIS]: {
      subject_indicators: ['relationship', 'correlation', 'connection', 'association', 'link', 'interaction', 'interactions'],
      analysis_indicators: ['relate', 'connect', 'influence', 'affect', 'impact', 'interact'],
      scope_indicators: ['factors', 'variables', 'elements', 'components', 'demographics', 'features'],
      quality_indicators: ['strong', 'weak', 'significant', 'positive', 'negative', 'strongest', 'key']
    },
    
    [BaseIntent.TREND_ANALYSIS]: {
      subject_indicators: ['trend', 'pattern', 'direction', 'movement', 'change', 'time', 'timing', 'velocity', 'duration', 'pace'],
      analysis_indicators: ['growth', 'decline', 'increase', 'decrease', 'evolution', 'selling', 'market', 'time on market', 'days on market'],
      scope_indicators: ['over time', 'temporal', 'historical', 'recent', 'dom', 'tom', 'market timing', 'market velocity', 'sales pace'],
      quality_indicators: ['rising', 'falling', 'stable', 'volatile', 'consistent', 'fast', 'slow', 'quick', 'average']
    },
    
    [BaseIntent.PREDICTION_MODELING]: {
      subject_indicators: ['prediction', 'forecast', 'future', 'projection', 'estimate', 'scenario', 'what if', 'if', 'ensemble', 'confidence'],
      analysis_indicators: ['predict', 'model', 'project', 'anticipate', 'expect', 'change', 'changes', 'impact', 'affect', 'ensemble', 'combined'],
      scope_indicators: ['future', 'next', 'upcoming', 'projected', 'strategy', 'pricing', 'market', 'predictions', 'highest', 'resilient'],
      quality_indicators: ['likely', 'probable', 'expected', 'anticipated', 'potential', 'resilient', 'stable', 'best', 'highest', 'most']
    },
    
    [BaseIntent.CLUSTERING_SEGMENTATION]: {
      subject_indicators: ['segment', 'cluster', 'group', 'category', 'classification', 'segmentation'],
      analysis_indicators: ['segmentation', 'clustering', 'grouping', 'classification', 'categorization', 'segment'],
      scope_indicators: ['markets', 'customers', 'areas', 'regions', 'strategies', 'targeted'],
      quality_indicators: ['similar', 'distinct', 'unique', 'homogeneous', 'heterogeneous', 'targeted', 'should']
    },
    
    [BaseIntent.ANOMALY_DETECTION]: {
      subject_indicators: ['anomaly', 'outlier', 'exception', 'unusual', 'abnormal', 'outliers', 'unique'],
      analysis_indicators: ['detect', 'identify', 'find', 'discover', 'locate', 'show'],
      scope_indicators: ['patterns', 'behavior', 'data', 'values', 'market', 'characteristics'],
      quality_indicators: ['unusual', 'rare', 'exceptional', 'unique', 'strange', 'biggest', 'opportunities']
    },
    
    [BaseIntent.OPTIMIZATION]: {
      subject_indicators: ['optimization', 'optimize', 'improve', 'enhance', 'maximize', 'adjust', 'weight', 'optimal', 'selection'],
      analysis_indicators: ['optimize', 'improve', 'enhance', 'maximize', 'minimize', 'adjust', 'change', 'select', 'choose'],
      scope_indicators: ['performance', 'results', 'outcomes', 'efficiency', 'rankings', 'weights', 'algorithm', 'geographic'],
      quality_indicators: ['optimal', 'best', 'maximum', 'minimum', 'efficient', 'sensitive', 'impact', 'each', 'area']
    },
    
    [BaseIntent.GENERAL_EXPLORATION]: {
      subject_indicators: ['explore', 'investigate', 'examine', 'study', 'research'],
      analysis_indicators: ['exploration', 'investigation', 'examination', 'study', 'research'],
      scope_indicators: ['data', 'information', 'insights', 'patterns'],
      quality_indicators: ['interesting', 'relevant', 'important', 'significant', 'notable']
    },
    
    [BaseIntent.COMPREHENSIVE_OVERVIEW]: {
      subject_indicators: ['overview', 'summary', 'comprehensive', 'complete', 'full', 'insights'],
      analysis_indicators: ['analyze', 'review', 'assess', 'evaluate', 'examine', 'provide'],
      scope_indicators: ['overall', 'general', 'broad', 'complete', 'entire', 'market'],
      quality_indicators: ['comprehensive', 'complete', 'thorough', 'detailed', 'full']
    }
  };

  /**
   * Classify the intent of a query
   */
  classifyIntent(query: string): IntentClassification {
    const tokens = this.tokenizeAndNormalize(query);
    const intentScores = new Map<BaseIntent, IntentMatchResult>();
    
    // Score each intent based on signature matching
    for (const [intent, signature] of Object.entries(this.INTENT_SIGNATURES)) {
      const matchResult = this.scoreIntentMatch(tokens, intent as BaseIntent, signature);
      intentScores.set(intent as BaseIntent, matchResult);
    }
    
    return this.selectTopIntents(intentScores, query);
  }

  /**
   * Tokenize and normalize query text
   */
  private tokenizeAndNormalize(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(token => token.length > 2) // Remove short tokens
      .filter(token => !this.isStopWord(token));
  }

  /**
   * Check if a word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these',
      'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
      'can', 'may', 'might', 'must', 'shall', 'me', 'you', 'him', 'her',
      'it', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
    ]);
    return stopWords.has(word);
  }

  /**
   * Score an intent match against a signature
   */
  private scoreIntentMatch(
    tokens: string[], 
    intent: BaseIntent, 
    signature: any
  ): IntentMatchResult {
    let totalScore = 0;
    let matchedCategories = 0;
    const matchedTerms: string[] = [];
    
    const categoryScores = {
      subject: 0,
      analysis: 0,
      scope: 0,
      quality: 0
    };

    // Subject matching (35% weight)
  const subjectMatches = this.countMatches(tokens, signature.subject_indicators);
    if (subjectMatches.count > 0) {
      categoryScores.subject = 0.35 * (subjectMatches.count / signature.subject_indicators.length);
      totalScore += categoryScores.subject;
      matchedCategories++;
      matchedTerms.push(...subjectMatches.matched);
    }
    
    // Analysis type matching (25% weight)
  const analysisMatches = this.countMatches(tokens, signature.analysis_indicators);
    if (analysisMatches.count > 0) {
      categoryScores.analysis = 0.25 * (analysisMatches.count / signature.analysis_indicators.length);
      totalScore += categoryScores.analysis;
      matchedCategories++;
      matchedTerms.push(...analysisMatches.matched);
    }
    
    // Scope matching (20% weight)
  const scopeMatches = this.countMatches(tokens, signature.scope_indicators);
    if (scopeMatches.count > 0) {
      categoryScores.scope = 0.20 * (scopeMatches.count / signature.scope_indicators.length);
      totalScore += categoryScores.scope;
      matchedCategories++;
      matchedTerms.push(...scopeMatches.matched);
    }
    
    // Quality matching (20% weight)
  const qualityMatches = this.countMatches(tokens, signature.quality_indicators);
    if (qualityMatches.count > 0) {
      categoryScores.quality = 0.20 * (qualityMatches.count / signature.quality_indicators.length);
      totalScore += categoryScores.quality;
      matchedCategories++;
      matchedTerms.push(...qualityMatches.matched);
    }
    
    // Intent-specific adjustments
    // Curb false positives for difference analysis when no explicit difference terms appear
    if (intent === BaseIntent.DIFFERENCE_ANALYSIS) {
      const hasDifferenceKeyword = signature.subject_indicators.some((kw: string) => tokens.includes(kw.replace(/\s+/g, ' ')));
      if (!hasDifferenceKeyword) {
        totalScore *= 0.5; // reduce weight if no explicit diff words
      }
    }

    // Boost clearly signaled intents
    const joined = tokens.join(' ');
    // Special handling: "competitive positioning" should strongly signal competitive intent
    const hasCompetitivePositioningPhrase = joined.includes('competitive positioning') ||
      (tokens.includes('competitive') && (tokens.includes('positioning') || joined.includes('market positioning')));
    if (intent === BaseIntent.DEMOGRAPHIC_ANALYSIS && (signature.subject_indicators.some((kw: string) => joined.includes(kw)) )) {
      totalScore += 0.15;
    }
    if (intent === BaseIntent.COMPETITIVE_ANALYSIS && (signature.subject_indicators.some((kw: string) => joined.includes(kw)) )) {
      totalScore += 0.12;
      if (hasCompetitivePositioningPhrase) {
        totalScore += 0.5; // Strong phrase boost
        if (tokens.includes('compare') || joined.includes('between')) {
          totalScore += 0.2; // Comparative context with competitive positioning
        }
      }
    }
    if (intent === BaseIntent.STRATEGIC_ANALYSIS) {
      // Base boost when explicit strategic wording present
      if (signature.subject_indicators.some((kw: string) => joined.includes(kw))) {
        totalScore += 0.20;
      }

      // Clear phrase boosts for common strategic requests
      const clearPhrases = [
        'strategic expansion',
        'expansion opportunities',
        'market expansion',
        'growth opportunity',
        'growth opportunities',
        'strategic market analysis',
        'best markets',
        'where should we expand'
      ];
      if (clearPhrases.some(p => joined.includes(p))) {
        totalScore += 0.30;
      }

      // Co-occurrence signal boosts (broad but specific to strategic intent)
      const strongSignals = ['strategic', 'strategy', 'expansion', 'expand', 'growth', 'opportunity', 'opportunities'];
      const strongCount = strongSignals.reduce((acc, s) => acc + (joined.includes(s) ? 1 : 0), 0);
      if (strongCount >= 3) {
        totalScore += 0.18;
      } else if (strongCount >= 2) {
        totalScore += 0.12;
      }

      // Quality+scope combo (e.g., "best markets")
      const hasQuality = qualityMatches.count > 0;
      const hasScope = scopeMatches.count > 0;
      if (hasQuality && hasScope) {
        totalScore += 0.10;
      }
    }
    // Dampening: if the phrase clearly targets competitive positioning, reduce other ambiguous intents
    if (hasCompetitivePositioningPhrase) {
      if (intent === BaseIntent.PERFORMANCE_RANKING) {
        totalScore *= 0.7; // reduce weight to avoid hijack
      }
      if (intent === BaseIntent.COMPARATIVE_ANALYSIS) {
        totalScore *= 0.8;
      }
    }

    // Bonus for multi-category matching
    if (matchedCategories >= 2) {
      totalScore *= 1.25;
    }

    // Intent-specific confidence floors to stabilize base layer results
    // Demographic: if clear demographic subject and either scope or analysis signals exist, ensure a reasonable floor
    if (intent === BaseIntent.DEMOGRAPHIC_ANALYSIS) {
      const hasDemoSubject = ['population','demographic','demographics','customer','people','residents','users','consumers']
        .some(kw => tokens.includes(kw));
      const hasDemoContext = (scopeMatches.count > 0) || (analysisMatches.count > 0);
      if (hasDemoSubject && hasDemoContext) {
        totalScore = Math.max(totalScore, 0.5);
      } else if (hasDemoSubject) {
        totalScore = Math.max(totalScore, 0.42);
      }
    }

    // Competitive: if competitive/rival signals or common comparative phrases appear, ensure a reasonable floor
    if (intent === BaseIntent.COMPETITIVE_ANALYSIS) {
      const hasCompSubject = ['competitive','competition','competitor','competitors','rival','rivals']
        .some(kw => tokens.includes(kw));
      const hasVs = joined.includes(' vs ') || joined.includes(' versus ') || joined.includes(' vs. ');
      const hasStackUp = joined.includes('stack up') || (tokens.includes('stack') && tokens.includes('up'));
      const hasMarketPositioning = joined.includes('market positioning') || tokens.includes('positioning');
      const hasCompPhrases = joined.includes('market share') || joined.includes('competitive landscape') ||
        hasVs || tokens.includes('versus') || tokens.includes('compare') || hasStackUp || hasMarketPositioning;
      const hasCompContext = (scopeMatches.count > 0) || (analysisMatches.count > 0) || (qualityMatches.count > 0);
      // Debug competitive scoring path (opt-in via env flag)
      const __debugCompetitive = typeof process !== 'undefined' && process.env && process.env.DEBUG_ROUTING === '1';
      try {
        if (__debugCompetitive && (hasCompSubject || hasCompPhrases)) {
          // eslint-disable-next-line no-console
          console.log('[BaseIntentClassifier][competitive]', JSON.stringify({
            tokens,
            hasCompSubject,
            hasVs,
            hasStackUp,
            hasCompPhrases,
            hasCompContext,
            matchedCategories,
            preScore: totalScore
          }));
        }
      } catch {}
      if ((hasCompSubject || hasCompPhrases) && hasCompContext) {
        const prev = totalScore;
        totalScore = Math.max(totalScore, 0.52);
        if (__debugCompetitive && totalScore !== prev) {
          try { console.log('[BaseIntentClassifier][competitive] applied_floor', { level: 0.52 }); } catch {}
        }
      } else if (hasCompSubject || hasCompPhrases) {
        // If at least subject or phrase evidence exists and any category matched, ensure the base passes threshold
        if (matchedCategories >= 1) {
          const prev = totalScore;
          totalScore = Math.max(totalScore, 0.45);
          if (__debugCompetitive && totalScore !== prev) {
            try { console.log('[BaseIntentClassifier][competitive] applied_floor', { level: 0.45 }); } catch {}
          }
        } else {
          const prev = totalScore;
          totalScore = Math.max(totalScore, 0.40);
          if (__debugCompetitive && totalScore !== prev) {
            try { console.log('[BaseIntentClassifier][competitive] applied_floor', { level: 0.40 }); } catch {}
          }
        }
      }
    }
    
    return {
      intent,
      score: totalScore,
      matched_categories: matchedCategories,
      category_scores: categoryScores,
      matched_terms: [...new Set(matchedTerms)] // Remove duplicates
    };
  }

  /**
   * Count matches between tokens and indicators
   */
  private countMatches(tokens: string[], indicators: string[]): { count: number; matched: string[] } {
    const matched: string[] = [];
    let count = 0;
    
    for (const indicator of indicators) {
      const indicatorTokens = indicator.toLowerCase().split(/\s+/);
      
      if (indicatorTokens.length === 1) {
        // Single word indicator
        if (this.wordMatchExists(tokens, indicatorTokens[0])) {
          count++;
          matched.push(indicator);
        }
      } else {
        // Multi-word indicator - check for phrase match
        const queryText = tokens.join(' ');
        if (queryText.includes(indicator.toLowerCase())) {
          count++;
          matched.push(indicator);
        }
      }
    }
    
    return { count, matched };
  }

  /**
   * Simple morphological matching for plural/verb/noun variants
   */
  private wordMatchExists(tokens: string[], indicator: string): boolean {
    if (tokens.includes(indicator)) return true;
    // Plural forms: markets -> market, opportunities -> opportunity
    const pluralS = indicator + 's';
    if (tokens.includes(pluralS)) return true;
    if (indicator.endsWith('y')) {
      const ies = indicator.slice(0, -1) + 'ies';
      if (tokens.includes(ies)) return true;
    }
    // Past/continuous: expand -> expansion/expanding, predict -> prediction
    const nounIon = indicator + 'ion';
    if (indicator.endsWith('e')) {
      const ing = indicator + 'ing';
      if (tokens.includes(ing)) return true;
    } else {
      const ing = indicator + 'ing';
      if (tokens.includes(ing)) return true;
    }
    if (tokens.includes(nounIon)) return true;
    return false;
  }

  /**
   * Select top intents from scored results
   */
  private selectTopIntents(
    intentScores: Map<BaseIntent, IntentMatchResult>, 
    originalQuery: string
  ): IntentClassification {
  // Reference originalQuery to avoid unused parameter lint error (may be used for future heuristics)
  const _origLen = originalQuery.length;
  void _origLen;
    const sortedResults = Array.from(intentScores.values())
      .sort((a, b) => b.score - a.score);
    
    if (sortedResults.length === 0 || sortedResults[0].score === 0) {
      return {
        primary_intent: BaseIntent.GENERAL_EXPLORATION,
        confidence: 0.1,
        secondary_intents: [],
        matched_categories: 0,
        reasoning: ['No clear intent detected, defaulting to general exploration']
      };
    }
    
    const topResult = sortedResults[0];
    const secondaryIntents = sortedResults
      .slice(1, 3)
      .filter(result => result.score > 0.1)
      .map(result => ({
        intent: result.intent,
        confidence: result.score
      }));
    
    const reasoning = [
      `Primary intent: ${topResult.intent} (${(topResult.score * 100).toFixed(1)}% confidence)`,
      `Matched categories: ${topResult.matched_categories}/4`,
      `Key terms: ${topResult.matched_terms.join(', ')}`
    ];
    
    if (topResult.category_scores.subject > 0) {
      reasoning.push(`Subject indicators: ${(topResult.category_scores.subject * 100).toFixed(1)}%`);
    }
    if (topResult.category_scores.analysis > 0) {
      reasoning.push(`Analysis indicators: ${(topResult.category_scores.analysis * 100).toFixed(1)}%`);
    }
    
    return {
      primary_intent: topResult.intent,
      confidence: topResult.score,
      secondary_intents: secondaryIntents,
      matched_categories: topResult.matched_categories,
      reasoning
    };
  }

  /**
   * Get detailed scoring breakdown for debugging
   */
  getDetailedScoring(query: string): Map<BaseIntent, IntentMatchResult> {
    const tokens = this.tokenizeAndNormalize(query);
    const intentScores = new Map<BaseIntent, IntentMatchResult>();
    
    for (const [intent, signature] of Object.entries(this.INTENT_SIGNATURES)) {
      const matchResult = this.scoreIntentMatch(tokens, intent as BaseIntent, signature);
      intentScores.set(intent as BaseIntent, matchResult);
    }
    
    return intentScores;
  }

  /**
   * Test intent classification with sample queries
   */
  testClassification(queries: string[]): Array<{
    query: string;
    classification: IntentClassification;
    processingTime: number;
  }> {
    const results = [];
    
    for (const query of queries) {
      const startTime = performance.now();
      const classification = this.classifyIntent(query);
      const endTime = performance.now();
      
      results.push({
        query,
        classification,
        processingTime: endTime - startTime
      });
    }
    
    return results;
  }
}