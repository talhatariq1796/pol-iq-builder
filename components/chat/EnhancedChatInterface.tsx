/* eslint-disable @typescript-eslint/no-explicit-any */
// Enhanced ChatInterface component with Vercel AI Elements integration
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Send, Bot, User, Loader2, Copy, Check, X, RotateCcw, Share, FileText, Target, Database, Brain, Settings, Zap, FileDown, Sparkles } from 'lucide-react';
import { ErrorBoundary } from '../ErrorBoundary';
import { StatsWithInfo } from '@/components/stats/StatsWithInfo';
import type { AnalysisResult, AnalysisMetadata } from '@/lib/analysis/types';

// Import Vercel AI Elements
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Actions, Action } from '@/components/ai-elements/actions';
import { PromptInput, PromptInputTextarea, PromptInputToolbar } from '@/components/ai-elements/prompt-input';

// Import Phase 2 AI Elements
import { AnalysisBranching } from '@/components/ai-elements/AnalysisBranching';
import { DataProvenance } from '@/components/ai-elements/DataProvenance';
import { AIReasoning } from '@/components/ai-elements/AIReasoning';

// Import Phase 3 AI Elements
import { InteractiveAnalysisConfig } from '@/components/ai-elements/InteractiveAnalysisConfig';
import { WhatIfAnalysisPreview } from '@/components/ai-elements/WhatIfAnalysisPreview';
import { ConfigurationTemplates } from '@/components/ai-elements/ConfigurationTemplates';

// Import Phase 4 Integration Wrapper
import { Phase4IntegrationWrapper } from '@/components/phase4/Phase4IntegrationWrapper';
import { isPhase4FeatureEnabled } from '@/config/phase4-features';

// Same interfaces as original ChatInterface
type LocalChatMetadata = Partial<AnalysisMetadata> & {
  query?: string;
  spatialFilterIds?: string[];
  filterType?: string;
  rankingContext?: unknown;
};

interface UnifiedAnalysisResponse {
  analysisResult: AnalysisResult;
  metadata?: unknown;
}

interface ChatInterfaceProps {
  analysisResult: UnifiedAnalysisResponse;
  onExportChart?: () => void;
  onZipCodeClick?: (zipCode: string) => void;
  persona?: string;
  messages?: ChatMessage[];
  setMessages?: (messages: ChatMessage[]) => void;
  hasGeneratedNarrative?: boolean;
  setHasGeneratedNarrative?: (value: boolean) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Keep all utility functions from original

const THINKING_MESSAGES = [
  "Thinking",
  "Analyzing",
  "Processing", 
  "Considering",
  "Evaluating",
  "Reviewing",
  "Calculating",
  "Examining",
  "Understanding",
  "Interpreting"
];

function getRandomThinkingMessage(): string {
  return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
}

const EnhancedChatInterfaceInner: React.FC<ChatInterfaceProps> = ({ 
  analysisResult, 
  onZipCodeClick, 
  persona = 'strategist',
  messages: externalMessages,
  setMessages: externalSetMessages,
  hasGeneratedNarrative: externalHasGeneratedNarrative,
  setHasGeneratedNarrative: externalSetHasGeneratedNarrative
}) => {

  // Use external state if provided, otherwise fall back to local state
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [localHasGeneratedNarrative, setLocalHasGeneratedNarrative] = useState(false);
  
  const messages = externalMessages || localMessages;
  const setMessages = externalSetMessages || setLocalMessages;
  const hasGeneratedNarrative = externalHasGeneratedNarrative ?? localHasGeneratedNarrative;
  const setHasGeneratedNarrative = externalSetHasGeneratedNarrative || setLocalHasGeneratedNarrative;

  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'full' | 'stats-only'>('full');
  
  // Phase 2 AI Elements state
  const [showBranching, setShowBranching] = useState(false);
  const [showDataProvenance, setShowDataProvenance] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [reasoningEnabled, setReasoningEnabled] = useState(false); // User preference for reasoning display
  
  // Phase 3 AI Elements state
  const [showInteractiveConfig, setShowInteractiveConfig] = useState(false);
  const [showWhatIfPreview, setShowWhatIfPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [analysisConfig, setAnalysisConfig] = useState<any>(null); // Interactive config state
  const [configTemplates, setConfigTemplates] = useState<any[]>([]); // User templates

  // Phase 4 Integration state (unified wrapper)
  const [showPhase4Integration, setShowPhase4Integration] = useState(false);
  const phase4Available = useMemo(() => {
    // Check if any Phase 4 features are enabled
    return isPhase4FeatureEnabled('scholarlyResearch') ||
           isPhase4FeatureEnabled('realTimeDataStreams') ||
           isPhase4FeatureEnabled('advancedVisualization') ||
           isPhase4FeatureEnabled('aiInsights');
  }, []);
  
  // Abort controller for cancelling chat requests
  const chatAbortControllerRef = useRef<AbortController | null>(null);
  
  // Track if initial narrative generation is in progress to prevent duplicates
  const isGeneratingNarrativeRef = useRef(false);
  
  // Stop chat processing function
  const stopChatProcessing = useCallback(() => {
    if (chatAbortControllerRef.current) {
      chatAbortControllerRef.current.abort();
      chatAbortControllerRef.current = null;
    }
    setIsProcessing(false);
  }, []);

  // Enhanced Actions for AI Elements
  const handleRetryAnalysis = useCallback(() => {
    if (isProcessing) return;
    
    // Re-run the analysis with the same parameters
    if (!hasGeneratedNarrative && analysisResult) {
      setHasGeneratedNarrative(false);
      setMessages([]);
      // This will trigger the useEffect to regenerate the narrative
    } else {
      // For follow-up questions, regenerate the last question
      const lastUserMessage = messages.findLast(m => m.role === 'user');
      if (lastUserMessage) {
        setInputValue(lastUserMessage.content);
      }
    }
  }, [isProcessing, hasGeneratedNarrative, analysisResult, setHasGeneratedNarrative, setMessages, messages]);

  const handleCopyAnalysis = useCallback(async () => {
    try {
      const latestMessage = messages.find(m => m.role === 'assistant');
      if (latestMessage) {
        await navigator.clipboard.writeText(latestMessage.content);
        setCopiedMessageId(latestMessage.id);
        setTimeout(() => setCopiedMessageId(null), 2000);
      }
    } catch (error) {
      console.error('Failed to copy analysis:', error);
    }
  }, [messages]);

  const handleShareAnalysis = useCallback(async () => {
    try {
      const { analysisResult: result } = analysisResult;
      const analysisType = result.endpoint?.replace('/', '').replace(/-/g, ' ') || 'Analysis';
      const recordCount = result.data?.records?.length || 0;
      
      const shareText = `MPIQ AI Analysis: ${analysisType}\n\nAnalyzed ${recordCount} areas with comprehensive insights.\n\nView the full analysis at: ${window.location.href}`;
      
      if (navigator.share) {
        await navigator.share({
          title: `MPIQ AI Analysis: ${analysisType}`,
          text: shareText,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        // Could show a toast notification here
      }
    } catch (error) {
      console.error('Failed to share analysis:', error);
    }
  }, [analysisResult]);

  const handleExportAnalysis = useCallback(() => {
    try {
      const conversationText = messages.map(message => {
        const timestamp = message.timestamp.toLocaleString();
        const role = message.role === 'user' ? 'User' : 'AI Assistant';
        return `## ${role} (${timestamp})

${message.content}

---
`;
      }).join('\n');

      const fullExport = `# MPIQ AI Analysis Export

Generated on: ${new Date().toLocaleString()}
Analysis Type: ${analysisResult.analysisResult.endpoint?.replace('/', '').replace(/-/g, ' ') || 'Unknown'}
Total Messages: ${messages.length}

---

${conversationText}

*Exported from MPIQ AI Chat Interface*`;

      const blob = new Blob([fullExport], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mpiq-analysis-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export analysis:', error);
    }
  }, [messages, analysisResult]);

  const handleZipCodeClick = useCallback((zipCode: string) => {
    if (onZipCodeClick) {
      onZipCodeClick(zipCode);
    }
  }, [onZipCodeClick]);

  // Phase 2 AI Elements handlers with proper state management
  const handleBranchSelect = useCallback((endpoint: string, query: string) => {
    console.log('Branch selected:', endpoint, query);
    setShowBranching(false);
    
    // Respect existing analysis flow: only allow new analysis after initial narrative
    if (!hasGeneratedNarrative) {
      console.warn('Branch selection blocked: waiting for initial narrative completion');
      return;
    }
    
    // Add the selected query as a user message to maintain conversation flow
    const branchMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `${query} [Analysis Type: ${endpoint.replace(/-/g, ' ')}]`,
      timestamp: new Date()
    };
    
    // Update messages to maintain chat continuity
    setMessages([...messages, branchMessage]);
    
    // Here you would trigger the actual analysis with the new endpoint/query
    // This integrates with the existing SemanticEnhancedHybridEngine
  }, [hasGeneratedNarrative, setMessages, messages]);

  const handleAnalysisRun = useCallback((endpoint: string, query: string) => {
    console.log('Running analysis:', endpoint, query);
    
    // Respect existing analysis flow: ensure we have proper context
    if (!hasGeneratedNarrative) {
      console.warn('Analysis run blocked: waiting for initial narrative completion');
      return;
    }
    
    // Trigger input value update to show user what analysis will run
    setInputValue(`${query} [Running ${endpoint.replace(/-/g, ' ')}]`);
    
    // Auto-submit the message to maintain natural chat flow
    setTimeout(() => {
      handleSendMessage();
    }, 100);
    
    // This would trigger a new analysis run
    // Integration point with existing analysis pipeline
  }, [hasGeneratedNarrative]);

  // Phase 2 Components Visibility Control
  // Only show advanced AI Elements AFTER initial analysis narrative is complete
  const shouldShowPhase2Components = useMemo(() => {
    return hasGeneratedNarrative && messages.length > 0;
  }, [hasGeneratedNarrative, messages]);

  // Enhanced state management for AI Elements integration
  const handleAIElementInteraction = useCallback((action: string, data?: any) => {
    // Ensure all AI Element interactions respect the existing flow
    if (!hasGeneratedNarrative) {
      console.warn(`AI Elements interaction '${action}' blocked: waiting for initial narrative`);
      return false;
    }
    
    // Log interaction for debugging and analytics
    console.log(`AI Elements interaction: ${action}`, data);
    return true;
  }, [hasGeneratedNarrative]);

  // Enhanced component cleanup when narrative state changes
  React.useEffect(() => {
    // Reset AI Elements panel states when narrative is regenerated
    if (!hasGeneratedNarrative) {
      setShowBranching(false);
      setShowDataProvenance(false);
      setShowReasoning(false);
      // Keep reasoningEnabled as user preference
      
      // Reset Phase 3 components
      setShowInteractiveConfig(false);
      setShowWhatIfPreview(false);
      setShowTemplates(false);
    }
  }, [hasGeneratedNarrative]);

  // Extract analysis context for Phase 2 components
  const analysisContext = React.useMemo(() => {
    const { analysisResult: result, metadata } = analysisResult;
    const meta = (metadata || {}) as LocalChatMetadata;
    
    return {
      endpoint: result.endpoint || 'strategic-analysis',
      query: meta.query || 'Analysis request',
      selectedAreaName: 'Selected Area', // Would come from map context
      zipCodes: result.data?.records?.map(r => String((r as any).ZIP_CODE || (r as any).zip_code || (r as any).zipcode)).filter(Boolean) || [],
      fieldCount: Object.keys(result.data?.records?.[0] || {}).length,
      routingConfidence: 0.92, // Would come from SemanticEnhancedHybridEngine
      shapFeatures: [], // Would come from SHAP analysis
      processingTime: 1250, // Would be tracked during analysis
      persona: persona || 'strategist' // Include persona in context
    };
  }, [analysisResult, persona]);

  // Keep the original message rendering logic
  const renderFormattedMessage = useCallback((message: ChatMessage) => {
    const content = message.content;
    const firstAssistantIndex = messages.findIndex(m => m.role === 'assistant');
    const messageIndex = messages.findIndex(m => m.id === message.id);
    const isInitialAssistant = message.role === 'assistant' && messageIndex === firstAssistantIndex;

    let previousUserContent = '';
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        previousUserContent = messages[i].content || '';
        break;
      }
    }

    const explicitStatsRequestPattern = /(\bquick\s*stats\b|\bstats\b|statistics|model\s*stats|model\s*performance|\br2\b|r²|confidence|model\s*used|show\s*stats|summary\s*stats|distribution|quartiles|\biqr\b)/i;
    const userExplicitlyRequestedStats = explicitStatsRequestPattern.test(previousUserContent);
    const allowEnhancedStats = isInitialAssistant || userExplicitlyRequestedStats;

    const statsKeywords = ['Quick Statistics', 'Brand Difference Statistics', 'Distribution Analysis', 'Key Patterns', 'AI Analysis'];
    const hasStatsLikeContent = statsKeywords.some(keyword => content.includes(`**${keyword}**`)) ||
                                content.includes('Model Used:') ||
                                content.includes('R² Score:') ||
                                content.includes('Quartiles:') ||
                                content.includes('IQR:');

    if (allowEnhancedStats && hasStatsLikeContent) {
      return <StatsWithInfo content={content} className="space-y-2" onZipCodeClick={handleZipCodeClick} />;
    }

    // Split content into lines to preserve formatting
    const lines = content.split('\n');
    
    return lines.map((line, lineIndex) => {
      const isHeader = /^[A-Z\s]+:?\s*$/.test(line.trim()) && line.trim().length > 0;
      const isBulletPoint = line.trim().startsWith('•') || line.trim().startsWith('-');
      const isNumberedItem = /^\d+\.\s/.test(line.trim());
      
      const processLine = (text: string) => {
        const zipParts = text.split(/\b(\d{5})\b/);
        
        return zipParts.map((part, partIndex) => {
          if (/^\d{5}$/.test(part)) {
            return (
              <button
                key={`${lineIndex}-${partIndex}`}
                className="inline-flex items-center px-1 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors cursor-pointer mr-1"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  handleZipCodeClick(part);
                }}
                title={`Click to zoom to ZIP code ${part}`}
              >
                {part}
              </button>
            );
          }
          
          const boldParts = part.split(/(\*\*[^*]+\*\*)/);
          return boldParts.map((boldPart, boldIndex) => {
            if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
              const boldText = boldPart.slice(2, -2);
              return (
                <strong key={`${lineIndex}-${partIndex}-${boldIndex}`}>
                  {boldText}
                </strong>
              );
            }
            return boldPart;
          });
        });
      };
      
      if (isHeader) {
        return (
          <div key={lineIndex} className="font-bold text-sm mt-3 mb-2 first:mt-0">
            {processLine(line)}
          </div>
        );
      } else if (isBulletPoint) {
        return (
          <div key={lineIndex} className="ml-4 mb-1">
            {processLine(line)}
          </div>
        );
      } else if (isNumberedItem) {
        return (
          <div key={lineIndex} className="font-semibold mb-2 mt-2">
            {processLine(line)}
          </div>
        );
      } else if (line.trim() === '') {
        return <div key={lineIndex} className="h-2"></div>;
      } else {
        return (
          <div key={lineIndex} className="mb-2">
            {processLine(line)}
          </div>
        );
      }
    });
  }, [handleZipCodeClick, messages]);

  // Basic implementation - will be enhanced in next iterations
  const generateInitialNarrative = useCallback(async () => {
    if (isGeneratingNarrativeRef.current || hasGeneratedNarrative) {
      return;
    }
    
    isGeneratingNarrativeRef.current = true;
    setHasGeneratedNarrative(true);
    setIsProcessing(true);

    try {
      const { analysisResult: result, metadata } = analysisResult;
      const meta = (metadata || {}) as LocalChatMetadata;
      const analysisData = result.data?.records || [];
      
      const queryText = meta.query || 'Analysis';
      const messageContent = `**Query:** "${queryText}"\n\nAnalyzed ${analysisData.length} areas with AI Elements enhancement.`;
      
      const message: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: messageContent,
        timestamp: new Date()
      };
      
      setMessages([message]);
    } catch (error) {
      console.error('Error generating narrative:', error);
    } finally {
      setIsProcessing(false);
      isGeneratingNarrativeRef.current = false;
    }
  }, [analysisResult, setMessages, setHasGeneratedNarrative, hasGeneratedNarrative]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Simulate AI response for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Enhanced AI response to: "${userMessage.content}"\n\nThis response is enhanced with AI Elements components for better UX.`,
        timestamp: new Date()
      };
      
      const finalMessages = [...updatedMessages, aiMessage];
      setMessages(finalMessages);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [inputValue, isProcessing, messages, setMessages]);

  // Auto-generate initial narrative when analysisResult is available
  React.useEffect(() => {
    if (!hasGeneratedNarrative && analysisResult) {
      generateInitialNarrative();
    }
  }, [hasGeneratedNarrative, analysisResult, generateInitialNarrative]);



  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)] overflow-hidden">
      {/* Enhanced with Vercel AI Elements Conversation wrapper */}
      <Conversation className="flex-1 min-h-0 max-h-[calc(100vh-440px)]">
        <ConversationContent className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-green-500 text-white'
              }`}>
                {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`flex-1 max-w-[90%] ${
                message.role === 'user' ? 'text-right' : 'text-left'
              }`}>
                <div className="relative group">
                  <div 
                    className={`inline-block p-3 rounded-lg text-xs cursor-pointer transition-all hover:shadow-md ${
                      message.role === 'user'
                        ? 'bg-blue-500/80 text-white hover:bg-blue-600/80'
                        : 'theme-message-container'
                    }`}
                    onClick={() => setSelectedMessage(message)}
                  >
                    <div className="whitespace-pre-wrap" style={{ lineHeight: '1.5' }}>
                      {renderFormattedMessage(message)}
                    </div>
                  </div>
                  
                  {/* Enhanced Actions with AI Elements */}
                  {message.role === 'assistant' && (
                    <Actions className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Action 
                        tooltip="Copy message"
                        onClick={() => navigator.clipboard.writeText(message.content)}
                      >
                        {copiedMessageId === message.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Action>
                      <Action 
                        tooltip="Retry analysis"
                        onClick={handleRetryAnalysis}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Action>
                      <Action 
                        tooltip="Share analysis"
                        onClick={handleShareAnalysis}
                      >
                        <Share className="w-3 h-3" />
                      </Action>
                    </Actions>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-gray-500">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-3 p-3 rounded-lg theme-processing-indicator">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs theme-text-secondary">{getRandomThinkingMessage()}…</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stopChatProcessing}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    title="Stop generation"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </ConversationContent>
        
        {/* Enhanced scroll to bottom with AI Elements */}
        <ConversationScrollButton />
      </Conversation>

      {/* Enhanced Input area with AI Elements PromptInput */}
      <div className="flex-shrink-0 p-4 border-t theme-border">
        <PromptInput 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="w-full"
        >
          <PromptInputTextarea
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
            placeholder={`Ask questions about your analysis results... (${analysisMode === 'full' ? 'Full Analysis' : 'Stats-only'} mode)`}
            disabled={isProcessing}
            className="text-xs"
            minHeight={60}
            maxHeight={120}
          />
          <PromptInputToolbar>
            <div className="flex-1" />
            <Actions>
              <Action
                tooltip={analysisMode === 'full' ? 'Switch to stats-only mode' : 'Switch to full analysis mode'}
                onClick={() => setAnalysisMode(analysisMode === 'full' ? 'stats-only' : 'full')}
              >
                {analysisMode === 'full' ? '🤖' : '📊'}
              </Action>
              <Button
                type="submit"
                disabled={!inputValue.trim() || isProcessing}
                size="sm"
                className="h-8 w-8 p-0"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </Actions>
          </PromptInputToolbar>
        </PromptInput>
        
        {/* Enhanced action buttons */}
        <div className="mt-2 pb-2 flex justify-between">
          <Actions>
            <Action
              tooltip="Retry last analysis"
              onClick={handleRetryAnalysis}
              disabled={isProcessing}
            >
              <RotateCcw className="w-3 h-3" />
            </Action>
            <Action
              tooltip="Copy latest analysis"
              onClick={handleCopyAnalysis}
            >
              <Copy className="w-3 h-3" />
            </Action>
            <Action
              tooltip="Share analysis"
              onClick={handleShareAnalysis}
            >
              <Share className="w-3 h-3" />
            </Action>
            <Action
              tooltip="Show analysis options"
              onClick={() => {
                if (handleAIElementInteraction('toggle-branching')) {
                  setShowBranching(!showBranching);
                }
              }}
            >
              <Target className="w-3 h-3" />
            </Action>
            <Action
              tooltip="Show data sources"
              onClick={() => {
                if (handleAIElementInteraction('toggle-provenance')) {
                  setShowDataProvenance(!showDataProvenance);
                }
              }}
            >
              <Database className="w-3 h-3" />
            </Action>
            <Action
              tooltip={reasoningEnabled ? "Hide AI reasoning" : "Show AI reasoning"}
              onClick={() => {
                if (handleAIElementInteraction('toggle-reasoning')) {
                  const newEnabled = !reasoningEnabled;
                  setReasoningEnabled(newEnabled);
                  // Auto-show reasoning panel when enabled
                  if (newEnabled) {
                    setShowReasoning(true);
                  } else {
                    setShowReasoning(false);
                  }
                }
              }}
              className={reasoningEnabled ? "bg-blue-100 dark:bg-blue-900/30" : ""}
            >
              <Brain className="w-3 h-3" />
            </Action>
            <Action
              tooltip="Interactive configuration"
              onClick={() => {
                if (handleAIElementInteraction('toggle-config')) {
                  setShowInteractiveConfig(!showInteractiveConfig);
                }
              }}
              className={showInteractiveConfig ? "bg-green-100 dark:bg-green-900/30" : ""}
            >
              <Settings className="w-3 h-3" />
            </Action>
            <Action
              tooltip="What-if analysis preview"
              onClick={() => {
                if (handleAIElementInteraction('toggle-what-if')) {
                  setShowWhatIfPreview(!showWhatIfPreview);
                }
              }}
              className={showWhatIfPreview ? "bg-purple-100 dark:bg-purple-900/30" : ""}
            >
              <Zap className="w-3 h-3" />
            </Action>
            <Action
              tooltip="Configuration templates"
              onClick={() => {
                if (handleAIElementInteraction('toggle-templates')) {
                  setShowTemplates(!showTemplates);
                }
              }}
              className={showTemplates ? "bg-orange-100 dark:bg-orange-900/30" : ""}
            >
              <FileDown className="w-3 h-3" />
            </Action>
            
            {/* Phase 4 Advanced Integration - Only show if feature flags are enabled */}
            {!!phase4Available && (
              <Action
                tooltip="Advanced analysis features"
                onClick={() => {
                  if (handleAIElementInteraction('toggle-phase4-integration')) {
                    setShowPhase4Integration(!showPhase4Integration);
                  }
                }}
                className={showPhase4Integration ? "bg-purple-100 dark:bg-purple-900/30" : ""}
              >
                <Sparkles className="w-3 h-3" />
              </Action>
            )}
          </Actions>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAnalysis}
            className="text-xs h-8 px-3 gap-2"
            title="Export entire conversation as markdown file"
          >
            <FileText className="w-3 h-3" />
            Export
          </Button>
        </div>
      </div>

      {/* Phase 2 AI Elements Components - Only show after initial analysis */}
      {shouldShowPhase2Components && showBranching && (
        <div className="mt-4 p-4 border-t border-border">
          <AnalysisBranching
            selectedAreaName={analysisContext.selectedAreaName}
            currentQuery={analysisContext.query}
            onBranchSelect={handleBranchSelect}
            onAnalysisRun={handleAnalysisRun}
            mapContext={{
              selectedZipCodes: analysisContext.zipCodes,
              selectedAreaName: analysisContext.selectedAreaName
            }}
            persona={analysisContext.persona}
          />
        </div>
      )}

      {shouldShowPhase2Components && showDataProvenance && (
        <div className="mt-4 p-4 border-t border-border">
          <DataProvenance
            endpoint={analysisContext.endpoint}
            zipCodes={analysisContext.zipCodes}
            fieldCount={analysisContext.fieldCount}
            analysisResult={analysisResult}
          />
        </div>
      )}

      {shouldShowPhase2Components && reasoningEnabled && showReasoning && (
        <div className="mt-4 p-4 border-t border-border">
          <AIReasoning
            query={analysisContext.query}
            endpoint={analysisContext.endpoint}
            routingConfidence={analysisContext.routingConfidence}
            selectedAreaName={analysisContext.selectedAreaName}
            zipCodes={analysisContext.zipCodes}
            fieldCount={analysisContext.fieldCount}
            shapFeatures={analysisContext.shapFeatures}
            processingTime={analysisContext.processingTime}
            analysisResult={analysisResult}
            expanded={true}
            persona={analysisContext.persona}
          />
        </div>
      )}

      {/* Phase 3 AI Elements Components - Interactive Configuration */}
      {shouldShowPhase2Components && showInteractiveConfig && (
        <div className="mt-4 p-4 border-t border-border">
          <InteractiveAnalysisConfig
            initialConfig={analysisConfig}
            onConfigChange={(config) => setAnalysisConfig(config)}
            onRunAnalysis={(config) => {
              console.log('Running analysis with config:', config);
              setAnalysisConfig(config);
              // Here you would trigger the actual analysis
            }}
            onSaveTemplate={(template) => {
              const newTemplate = {
                ...template,
                id: `template-${Date.now()}`,
                createdAt: new Date(),
                updatedAt: new Date(),
                usageCount: 0
              };
              setConfigTemplates((prev: any[]) => [...prev, newTemplate]);
            }}
            onLoadTemplate={(templateId) => {
              console.log('Loading template:', templateId);
            }}
            availableTemplates={configTemplates}
            validationEnabled={true}
          />
        </div>
      )}

      {/* Phase 3 AI Elements Components - What-If Analysis */}
      {shouldShowPhase2Components && showWhatIfPreview && analysisConfig && (
        <div className="mt-4 p-4 border-t border-border">
          <WhatIfAnalysisPreview
            baseConfig={analysisConfig}
            proposedConfig={analysisConfig}
            onRunScenario={(scenario) => {
              console.log('Running scenario:', scenario);
              // Here you would execute the what-if scenario
            }}
            onApplyChanges={(config) => {
              setAnalysisConfig(config);
              console.log('Applied config changes:', config);
            }}
          />
        </div>
      )}

      {/* Phase 3 AI Elements Components - Configuration Templates */}
      {shouldShowPhase2Components && showTemplates && (
        <div className="mt-4 p-4 border-t border-border">
          <ConfigurationTemplates
            templates={configTemplates}
            currentConfig={analysisConfig}
            onLoadTemplate={(template) => {
              setAnalysisConfig({ ...analysisConfig, ...template.config });
              setShowTemplates(false);
              setShowInteractiveConfig(true);
            }}
            onSaveTemplate={(template) => {
              const newTemplate = {
                ...template,
                id: `template-${Date.now()}`,
                createdAt: new Date(),
                updatedAt: new Date(),
                usageCount: 0
              };
              setConfigTemplates((prev: any) => [...prev, newTemplate]);
            }}
            onUpdateTemplate={(id, updates) => {
              // @ts-expect-error: configTemplates is typed as any[] - implicit any in callbacks is expected
              setConfigTemplates(prev =>
                // @ts-expect-error: t parameter implicit any from any[] parent type
                prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t)
              );
            }}
            onDeleteTemplate={(id) => {
              // @ts-expect-error: configTemplates is typed as any[] - implicit any in callbacks is expected
              setConfigTemplates((prev: any) => prev.filter(t => t.id !== id));
            }}
            onToggleFavorite={(id) => {
              // @ts-expect-error: configTemplates is typed as any[] - implicit any in callbacks is expected
              setConfigTemplates(prev =>
                // @ts-expect-error: t parameter implicit any from any[] parent type
                prev.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t)
              );
            }}
            onImportTemplates={(templates) => {
              const importedTemplates = templates.map((template: any) => ({
                ...template,
                id: template.id || `imported-${Date.now()}-${Math.random()}`,
                createdAt: template.createdAt ? new Date(template.createdAt) : new Date(),
                updatedAt: template.updatedAt ? new Date(template.updatedAt) : new Date(),
                usageCount: template.usageCount || 0,
                isBuiltIn: false
              }));
              setConfigTemplates((prev: any) => [...prev, ...importedTemplates]);
            }}
            onExportTemplate={(template) => {
              console.log('Exporting template:', template);
            }}
          />
        </div>
      )}

      {/* Phase 4 Advanced Integration - Unified wrapper */}
      {shouldShowPhase2Components && showPhase4Integration && !!phase4Available && (
        <div className="mt-4 p-4 border-t border-border">
          <Phase4IntegrationWrapper
            analysisResult={analysisResult}
            analysisContext={{
              selectedAreaName: (analysisResult?.metadata as any)?.location || 'Selected Region',
              zipCodes: (analysisResult as any)?.zipCodes?.map((z: any) => z.zipCode) || [],
              endpoint: analysisContext.endpoint,
              query: analysisContext.query,
              persona: analysisContext.persona
            }}
            onClose={() => setShowPhase4Integration(false)}
          />
        </div>
      )}

      {/* MessageDialog for expanded message viewing */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto theme-dialog">
          <DialogHeader>
            <DialogTitle>Analysis Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm leading-relaxed">
                {selectedMessage && renderFormattedMessage(selectedMessage)}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Outer component with ErrorBoundary
export const EnhancedChatInterface: React.FC<ChatInterfaceProps> = (props) => {
  return React.createElement(
    ErrorBoundary as unknown as React.ComponentType<{ children: React.ReactNode }>,
    null,
    React.createElement(EnhancedChatInterfaceInner, props)
  );
};