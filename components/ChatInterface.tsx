// ChatInterface component - complete chat functionality for analysis results
import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
// Removed unused Alert imports
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Send, Bot, User, Loader2, Copy, Check, X, Download } from 'lucide-react';
// import { renderPerformanceMetrics } from '@/lib/utils/performanceMetrics'; // Commented out - badges no longer displayed
import { 
  calculateBasicStats, 
  calculateDistribution, 
  formatStatsForChat,
  formatDistributionForChat
} from '@/lib/analysis/statsCalculator';
import { ErrorBoundary } from './ErrorBoundary';
import { sendEnhancedChatMessage, type EnhancedChatResponse } from '@/services/enhanced-chat-service';
import { StatsWithInfo } from '@/components/stats/StatsWithInfo';
import type { AnalysisResult, AnalysisMetadata } from '@/lib/analysis/types';

// Extend AnalysisMetadata with chat-specific optional fields used in UI payloads
type LocalChatMetadata = Partial<AnalysisMetadata> & {
  query?: string;
  spatialFilterIds?: string[];
  filterType?: string;
  rankingContext?: unknown;
};

// Wrapper component for performance metrics - commented out as badges are no longer displayed
// const PerformanceMetrics = ({ analysisResult, className }: { analysisResult: any, className: string }) => {
//   if (!analysisResult) return null;
//   return renderPerformanceMetrics(analysisResult, className);
// };

interface UnifiedAnalysisResponse {
  analysisResult: AnalysisResult;
  // Accept any upstream metadata shape (e.g., from UnifiedAnalysisWrapper);
  // this component safely narrows to LocalChatMetadata at usage sites.
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

// Utility: create a clean, serializable copy of records for safe transport
type SafeRecord = Record<string, unknown>;
function sanitizeFeatureData(records: unknown[]): SafeRecord[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  return records.map((record) => {
    if (!record || typeof record !== 'object') return record as SafeRecord;

    const cleanRecord: SafeRecord = {};
    for (const [key, value] of Object.entries(record)) {
      if (
        value !== undefined &&
        value !== null &&
        typeof value !== 'function' &&
        typeof value !== 'symbol'
      ) {
        if (typeof value === 'object') {
          try {
            cleanRecord[key] = JSON.parse(JSON.stringify(value));
          } catch (e) {
            console.warn(`[ChatInterface] Skipping problematic property ${key}:`, e);
          }
        } else {
          cleanRecord[key] = value;
        }
      }
    }
    return cleanRecord;
  });
}

// Randomized thinking messages to make chat feel more natural
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

// Inner component - following QueryInterface pattern with full UnifiedAnalysisChat functionality
const ChatInterfaceInner: React.FC<ChatInterfaceProps> = ({ 
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'full' | 'stats-only'>('full');
  
  // Abort controller for cancelling chat requests
  const chatAbortControllerRef = useRef<AbortController | null>(null);
  
  // Track if initial narrative generation is in progress to prevent duplicates
  const isGeneratingNarrativeRef = useRef(false);
  
  // Stop chat processing function
  const stopChatProcessing = useCallback(() => {
    // console.log('[ChatInterface] Stopping chat processing...');
    
    // Abort any ongoing requests
    if (chatAbortControllerRef.current) {
      chatAbortControllerRef.current.abort();
      chatAbortControllerRef.current = null;
    }
    
    // Reset processing state
    setIsProcessing(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end',
      inline: 'nearest'
    });
  }, []);

  // Command processing
  const processCommand = useCallback((input: string): { isCommand: boolean; response?: string; action?: string } => {
    if (!input.startsWith('/')) {
      return { isCommand: false };
    }

    const [command] = input.slice(1).split(' ');
    const lowerCommand = command.toLowerCase();

    switch (lowerCommand) {
      case 'quick':
      case 'stats':
        setAnalysisMode('stats-only');
        return { 
          isCommand: true, 
          response: '📊 **Stats-Only Mode Enabled**\n\nFuture analysis will show statistics only without AI insights. This is faster and uses fewer resources.\n\nUse `/full` to re-enable AI analysis.',
          action: 'mode-change'
        };

      case 'full':
      case 'ai':
        setAnalysisMode('full');
        return { 
          isCommand: true, 
          response: '🤖 **Full Analysis Mode Enabled**\n\nFuture analysis will include comprehensive AI insights along with statistics.\n\nUse `/quick` for stats-only mode.',
          action: 'mode-change'
        };

      case 'export':
        try {
          const latestMessage = messages.find(m => m.role === 'assistant');
          if (latestMessage) {
            navigator.clipboard.writeText(latestMessage.content);
            return { 
              isCommand: true, 
              response: '✅ **Analysis Exported**\n\nThe latest analysis has been copied to your clipboard.',
              action: 'export'
            };
          } else {
            return { 
              isCommand: true, 
              response: '❌ **Export Failed**\n\nNo analysis found to export. Please run an analysis first.',
              action: 'export'
            };
          }
  } catch {
          return { 
            isCommand: true, 
            response: '❌ **Export Failed**\n\nUnable to copy to clipboard. Please try selecting and copying manually.',
            action: 'export'
          };
        }

      case 'help':
      case 'commands':
        return { 
          isCommand: true, 
          response: `🔧 **Available Commands**

**Analysis Modes:**
• \`/quick\` or \`/stats\` - Stats-only mode (faster, no AI)
• \`/full\` or \`/ai\` - Full analysis with AI insights (default)

**Utilities:**
• \`/export\` - Copy current analysis to clipboard
• \`/help\` - Show this command list

**Tips:**
- Commands work anywhere in the chat
- Current mode: **${analysisMode === 'full' ? 'Full Analysis' : 'Stats Only'}**
- Stats always appear within 3 seconds
- Full AI analysis takes 5-10 seconds`,
          action: 'help'
        };

      case 'status':
        const { analysisResult: result } = analysisResult;
        const recordCount = result.data?.records?.length || 0;
        const contextSize = messages.length > 5 ? 
          (messages.reduce((sum, msg) => sum + msg.content.length, 0) / messages.length > 3000 ? 4 :
           messages.reduce((sum, msg) => sum + msg.content.length, 0) / messages.length > 1500 ? 6 : 7) :
          messages.length;
        
        return { 
          isCommand: true, 
          response: `📊 **Analysis Status**

**Current Dataset:**
• Areas analyzed: ${recordCount}
• Analysis type: ${result.endpoint?.replace('/', '').replace(/-/g, ' ') || 'Unknown'}
• Mode: ${analysisMode === 'full' ? 'Full Analysis' : 'Stats Only'}

**Chat Context:**
• Total messages: ${messages.length}
• Context window: ${contextSize} messages (adaptive)
• Avg message length: ${messages.length ? Math.round(messages.reduce((sum, msg) => sum + msg.content.length, 0) / messages.length) : 0} chars

**Available Data:**
• Basic statistics ✅
• Distribution analysis ✅
• Pattern detection ✅
• AI insights ${analysisMode === 'full' ? '✅' : '⚠️ Disabled'}

Use \`/help\` for available commands.`,
          action: 'status'
        };

      default:
        return { 
          isCommand: true, 
          response: `❓ **Unknown Command: "${command}"**\n\nUse \`/help\` to see available commands.`,
          action: 'unknown'
        };
    }
  }, [analysisMode, messages, analysisResult]);

  const handleMessageClick = useCallback((message: ChatMessage) => {
    setSelectedMessage(message);
  }, []);

  const handleCopyMessage = useCallback(async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  }, []);

  const handleExportConversation = useCallback(() => {
    try {
      // Format the conversation as markdown
      const conversationText = messages.map(message => {
        const timestamp = message.timestamp.toLocaleString();
        const role = message.role === 'user' ? 'User' : 'AI Assistant';
        return `## ${role} (${timestamp})

${message.content}

---
`;
      }).join('\n');

      const fullExport = `# Analysis Conversation Export

Generated on: ${new Date().toLocaleString()}
Analysis Type: ${analysisResult.analysisResult.endpoint?.replace('/', '').replace(/-/g, ' ') || 'Unknown'}
Total Messages: ${messages.length}

---

${conversationText}

*Exported from MPIQ AI Chat Interface*`;

      // Create and download the file
      const blob = new Blob([fullExport], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analysis-conversation-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export conversation:', error);
    }
  }, [messages, analysisResult]);

  const handleZipCodeClick = useCallback((zipCode: string) => {
    // console.log(`[ChatInterface] ZIP code ${zipCode} clicked - zooming to feature`);
    if (onZipCodeClick) {
      onZipCodeClick(zipCode);
    } else {
      console.warn('[ChatInterface] onZipCodeClick prop not provided - cannot zoom to ZIP code');
    }
  }, [onZipCodeClick]);

  const renderFormattedMessage = useCallback((message: ChatMessage) => {
    const content = message.content;
    // Determine if enhanced stats rendering should be allowed for this message
    // Rule: Only for the initial assistant analysis or when user explicitly asks for stats
    const firstAssistantIndex = messages.findIndex(m => m.role === 'assistant');
    const messageIndex = messages.findIndex(m => m.id === message.id);
    const isInitialAssistant = message.role === 'assistant' && messageIndex === firstAssistantIndex;

    // Find the most recent user message before this one
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

    // Check if this content contains stats/model metrics
    const statsKeywords = ['Quick Statistics', 'Brand Difference Statistics', 'Distribution Analysis', 'Key Patterns', 'AI Analysis'];
    const hasStatsLikeContent = statsKeywords.some(keyword => content.includes(`**${keyword}**`)) ||
                                content.includes('Model Used:') ||
                                content.includes('R² Score:') ||
                                content.includes('Quartiles:') ||
                                content.includes('IQR:');

    // Use enhanced rendering only when allowed
    if (allowEnhancedStats && hasStatsLikeContent) {
      return <StatsWithInfo content={content} className="space-y-2" onZipCodeClick={handleZipCodeClick} />;
    }

    // Split content into lines to preserve formatting
    const lines = content.split('\n');
    
    return lines.map((line, lineIndex) => {
      // Check if line is a header (all caps or starts with ###)
      const isHeader = /^[A-Z\s]+:?\s*$/.test(line.trim()) && line.trim().length > 0;
      const isBulletPoint = line.trim().startsWith('•') || line.trim().startsWith('-');
      const isNumberedItem = /^\d+\.\s/.test(line.trim());
      
      // Process ZIP codes, FSA codes, and markdown formatting in the line
      const processLine = (text: string) => {
        // First, split by ZIP codes and FSA codes (Canadian postal code format: A1A)
        const areaParts = text.split(/\b((?:\d{5})|(?:[A-Z]\d[A-Z]))\b/);
        
        return areaParts.map((part, partIndex) => {
          if (/^\d{5}$/.test(part)) {
            // This is a ZIP code - make it clickable
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
          } else if (/^[A-Z]\d[A-Z]$/.test(part)) {
            // This is an FSA code (Canadian postal code format) - make it clickable
            return (
              <button
                key={`${lineIndex}-${partIndex}`}
                className="inline-flex items-center px-1 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors cursor-pointer mr-1"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  handleZipCodeClick(part); // Reuse the same handler - it handles both ZIP and FSA codes
                }}
                title={`Click to zoom to FSA ${part}`}
              >
                {part}
              </button>
            );
          }
          
          // Process markdown bold formatting (**text**)
          const boldParts = part.split(/(\*\*[^*]+\*\*)/);
          return boldParts.map((boldPart, boldIndex) => {
            if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
              // Remove ** and make bold
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
      
      // Apply styling based on line type
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
        return <div key={lineIndex} className="h-2"></div>; // Empty line spacing
      } else {
        return (
          <div key={lineIndex} className="mb-2">
            {processLine(line)}
          </div>
        );
      }
    });
  }, [handleZipCodeClick, messages]);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const generateInitialNarrative = useCallback(async () => {
    // Prevent multiple simultaneous generations using ref
    if (isGeneratingNarrativeRef.current || hasGeneratedNarrative) {
      return;
    }
    
    isGeneratingNarrativeRef.current = true;
    setHasGeneratedNarrative(true);
    setIsProcessing(true);

    // Get the analysis data
  const { analysisResult: result, metadata } = analysisResult;
  const meta = (metadata || {}) as LocalChatMetadata;
  const analysisData = result.data?.records || [];
    
  // Start with query display and analyzing message  
  const queryText = meta.query || 'Analysis';
    let messageContent = `**Query:** "${queryText}"\n\n---\n\nAnalyzing ${analysisData.length} areas...`;
    
    // Declare at top level so it's accessible in error handler
    const messageId = Date.now().toString();
    const messageTimestamp = new Date();
    
    const initialMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: messageContent,
      timestamp: messageTimestamp
    };
    setMessages([initialMessage]);
    
    // Calculate and append basic stats immediately (Phase 1)
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX
      
      const basicStats = calculateBasicStats(analysisData);
      const analysisType = result.endpoint?.replace('/', '') || result.data?.type;
      messageContent += '\n\n' + formatStatsForChat(basicStats, analysisType, undefined, analysisData);
      
      setMessages([{
        ...initialMessage,
        content: messageContent
      }]);
      
      // Calculate and append distribution (Phase 2)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const distribution = calculateDistribution(analysisData);
      messageContent += '\n\n' + formatDistributionForChat(distribution, analysisType);
      
      setMessages([{
        ...initialMessage,
        content: messageContent
      }]);
      
      // Phase 3: Key Patterns section removed per user feedback
      
      setMessages([{
        ...initialMessage,
        content: messageContent
      }]);
      
      // Only proceed with AI if in full mode
      if (analysisMode === 'stats-only') {
        messageContent += '\n\n✅ **Analysis Complete**\n\n*Stats-only mode - use `/full` to enable AI insights, or ask specific questions below.*';
        
        setMessages([{
          id: messageId,
          role: 'assistant',
          content: messageContent,
          timestamp: messageTimestamp
        }]);
        return; // Exit early for stats-only mode
      }

      // Add AI analysis loading indicator for full mode
      messageContent += '\n\n**AI Analysis**\n*Generating comprehensive insights...*';
      
      setMessages([{
        ...initialMessage,
        content: messageContent
      }]);
      
    } catch (statsError) {
      console.error('[ChatInterface] Error calculating stats:', statsError);
      // Continue with AI analysis even if stats fail (in full mode only)
    }

    // Only generate AI analysis in full mode
    if (analysisMode !== 'full') return;

  try {
      // console.log('[ChatInterface] Generating initial AI narrative...');
      
      // Narrow metadata typing for safe access
  // meta already defined above for this scope

  const requestPayload = {
        messages: [{
          role: 'user' as const,
          content: `Provide a comprehensive analysis of the ${result.endpoint?.replace('/', '').replace(/-/g, ' ')} results`
        }],
        metadata: {
          query: `Analyze the ${result.endpoint?.replace('/', '').replace(/-/g, ' ')} results`,
          analysisType: result.endpoint?.replace('/', '').replace(/-/g, '_') || 'strategic_analysis',
          relevantLayers: ['unified_analysis'],
          spatialFilterIds: meta.spatialFilterIds,
          filterType: meta.filterType,
          rankingContext: meta.rankingContext,
          isClustered: result.data?.isClustered,
          // Skip clusterAnalysis to reduce complexity
          isContextualChat: false
        },
        featureData: [{
          layerId: 'unified_analysis',
          layerName: 'Analysis Results',
          layerType: 'polygon',
          // Wrap records as properties so the summarizer can read fields consistently
          features: sanitizeFeatureData(result.data?.records || []).map(r => ({ properties: r }))
        }],
        persona: persona
      };

      // console.log('[ChatInterface] Request payload prepared:', {
      //   endpoint: result.endpoint,
      //   recordCount: result.data?.records?.length,
      //   spatialFilter: !!(metadata as any)?.spatialFilterIds,
      //   isClustered: !!result.data?.isClustered
      // });

      // Clean up any existing abort controller
      if (chatAbortControllerRef.current) {
        chatAbortControllerRef.current.abort();
      }
      
      // Create new abort controller for this request
      chatAbortControllerRef.current = new AbortController();
      const controller = chatAbortControllerRef.current;
      const timeoutId = setTimeout(() => {
        // console.log('[ChatInterface] AI analysis timeout reached (290s)');
        controller.abort();
      }, 290000); // Set to 290 seconds - 10 seconds less than server timeout (300s) to avoid race condition

      // Use enhanced chat service with multi-endpoint support for initial analysis
      const enhancedRequest = {
        messages: requestPayload.messages,
        metadata: {
          ...requestPayload.metadata,
          enableMultiEndpoint: false, // Don't auto-fetch for initial analysis to keep it fast
          conversationHistory: []
        },
        featureData: requestPayload.featureData,
        persona: requestPayload.persona,
        analysisResult: analysisResult
      };

      const claudeResponse = await sendEnhancedChatMessage(enhancedRequest, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      if (claudeResponse.content) {
        // Clean the response content to remove any leaked prompt instructions
        let cleanContent = claudeResponse.content;
        
        // Remove any prompt instructions that might have leaked into the response
        const promptMarkers = [
          'STRATEGIC ANALYSIS TECHNICAL CONTEXT:',
          'REQUIRED RESPONSE FORMAT:',
          'DATA STRUCTURE:',
          'CRITICAL REQUIREMENTS:',
          'ANALYSIS FOCUS:',
          'ACTIONABLE RECOMMENDATIONS REQUIRED:',
          'CLUSTERING-SPECIFIC INSTRUCTIONS:',
          'CITY-LEVEL ANALYSIS SUPPORT:',
          'MODEL ATTRIBUTION REQUIREMENTS:',
          'CRITICAL FIELD DATA TYPE INSTRUCTIONS:',
          'MANDATORY FIELD TYPE RECOGNITION:',
          'SAMPLE-BASED ANALYSIS CONTEXT'
        ];
        
        // Find the first occurrence of any prompt marker and cut off there
        let cutIndex = cleanContent.length;
        promptMarkers.forEach(marker => {
          const index = cleanContent.indexOf(marker);
          if (index !== -1 && index < cutIndex) {
            cutIndex = index;
          }
        });
        
        if (cutIndex < cleanContent.length) {
          cleanContent = cleanContent.substring(0, cutIndex).trim();
          // console.log('[ChatInterface] Removed leaked prompt instructions from response');
        }
        
        // Remove the loading indicator and append AI analysis
    const statsEndIndex = messageContent.lastIndexOf('**AI Analysis**');
        if (statsEndIndex > -1) {
          messageContent = messageContent.substring(0, statsEndIndex);
        }
        
        // Append the AI analysis to the existing message with stats
        messageContent += '\n\n**AI Analysis**\n' + cleanContent;
        
        const completeMessage: ChatMessage = {
          id: messageId,
          role: 'assistant',
          content: messageContent,
          timestamp: messageTimestamp
        };
        setMessages([completeMessage]);
        // console.log('[ChatInterface] AI narrative generated successfully');
      } else {
        throw new Error('No content in API response');
      }
    } catch (error) {
      console.error('[ChatInterface] Failed to generate AI narrative:', error);
      
      // Determine error type and provide appropriate fallback
      let errorMessage = 'Failed to generate AI analysis.';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = chatAbortControllerRef.current === null ? 
            'Analysis was cancelled.' : 
            'AI analysis timed out after 290 seconds. Please try asking a specific question instead.';
        } else if (error.message.includes('429')) {
          errorMessage = 'Too many requests. Please wait a moment before trying again.';
        } else if (error.message.includes('401')) {
          errorMessage = 'Authentication error. Please check API configuration.';
        } else {
          errorMessage = `AI analysis failed: ${error.message}`;
        }
      }
      
      // Keep the stats and show error for AI portion
  const statsEndIndex = messageContent.lastIndexOf('**AI Analysis**');
      if (statsEndIndex > -1) {
        messageContent = messageContent.substring(0, statsEndIndex);
      }
      messageContent += `\n\n⚠️ ${errorMessage}\n\nYou can ask specific questions about the data in the chat below.`;
      
      const fallbackMessage: ChatMessage = {
        id: messageId,
        role: 'assistant',
        content: messageContent,
        timestamp: messageTimestamp
      };
      setMessages([fallbackMessage]);
    } finally {
      // Clean up abort controller and reset generation flag
      chatAbortControllerRef.current = null;
      setIsProcessing(false);
      isGeneratingNarrativeRef.current = false;
    }
  }, [analysisResult, persona, setMessages, setHasGeneratedNarrative, analysisMode, hasGeneratedNarrative]);

  // Auto-generate AI narrative when analysisResult is available (only once initially)
  React.useEffect(() => {
    if (!hasGeneratedNarrative && analysisResult) {
      // console.log('[ChatInterface] Starting auto-generation of AI narrative');
      generateInitialNarrative();
    }
    // Remove generateInitialNarrative from dependencies to prevent infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGeneratedNarrative, analysisResult]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isProcessing) return;

    const trimmedInput = inputValue.trim();
    
    // Check if this is a command
    const commandResult = processCommand(trimmedInput);
    if (commandResult.isCommand) {
      // Add user command message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: trimmedInput,
        timestamp: new Date()
      };
      
      // Add command response
      const commandResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: commandResult.response || 'Command processed.',
        timestamp: new Date()
      };
      
      const newMessages = [...messages, userMessage, commandResponse];
      setMessages(newMessages);
      setInputValue('');
      return; // Don't process as regular message
    }

    // Regular message processing
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsProcessing(true);

  try {
      // console.log('[ChatInterface] Sending chat message via service');
      
      const { analysisResult: result, metadata } = analysisResult;
      
      // Smart payload optimization for follow-up questions
      const isFollowUpQuestion = messages.length > 1;
      
      // Adaptive context management for better conversation flow
      const getOptimalContextSize = (msgs: ChatMessage[]): number => {
        if (msgs.length <= 5) return msgs.length; // Keep all if few messages
        
        // Calculate average message length to determine context size
        const avgLength = msgs.reduce((sum, msg) => sum + msg.content.length, 0) / msgs.length;
        
        // Adaptive sizing: fewer messages if they're very long, more if they're short
        if (avgLength > 3000) return 4;      // Large messages (initial analysis) - keep fewer
        if (avgLength > 1500) return 6;      // Medium messages - balanced approach  
        return 7;                            // Short messages - keep more for context
      };
      
      const truncateMessage = (content: string, maxLength: number = 4000): string => {
        if (content.length <= maxLength) return content;
        
        // Try to truncate at a natural break point (paragraph, sentence, etc.)
        const truncated = content.substring(0, maxLength);
        const lastParagraph = truncated.lastIndexOf('\n\n');
        const lastSentence = truncated.lastIndexOf('. ');
        
        if (lastParagraph > maxLength * 0.7) {
          return truncated.substring(0, lastParagraph) + '\n\n...[message truncated for context efficiency]';
        } else if (lastSentence > maxLength * 0.7) {
          return truncated.substring(0, lastSentence + 1) + ' ...[truncated]';
        } else {
          return truncated + '...[truncated]';
        }
      };
      
      // For follow-ups, use adaptive context with smart truncation
      const optimizedMessages = isFollowUpQuestion ? 
        [
          ...messages.slice(-getOptimalContextSize(messages)).map(msg => ({
            role: msg.role,
            content: truncateMessage(msg.content)
          })),
          {
            role: 'user' as const,
            content: userMessage.content
          }
        ] :
        [
          ...messages.map(msg => ({
            role: msg.role,
            content: msg.content // Keep full content for initial conversations
          })),
          {
            role: 'user' as const,
            content: userMessage.content
          }
        ];

  const meta = (metadata || {}) as LocalChatMetadata;

  const requestPayload = {
        messages: optimizedMessages,
        metadata: {
          query: userMessage.content,
          analysisType: result.endpoint?.replace('/', '').replace(/-/g, '_') || 'strategic_analysis',
          relevantLayers: ['unified_analysis'],
          spatialFilterIds: meta.spatialFilterIds,
          filterType: meta.filterType,
          rankingContext: meta.rankingContext,
          isClustered: result.data?.isClustered,
          // Skip clusterAnalysis entirely to reduce payload complexity
          targetVariable: result.data?.targetVariable,
          endpoint: result.endpoint,
          isContextualChat: true
        },
        featureData: [{
          layerId: 'unified_analysis',
          layerName: 'Analysis Results',
          layerType: 'polygon',
          features: sanitizeFeatureData(result.data?.records || []).map(r => ({ properties: r }))
        }],
        persona: persona
      };

      // Debug: Log context optimization results
      const contextSize = optimizedMessages.length - 1; // -1 for current message
      const totalChars = optimizedMessages.reduce((sum, msg) => sum + msg.content.length, 0);
      console.log(`[ChatInterface] Context optimization: ${contextSize} messages, ${totalChars} chars, avg: ${Math.round(totalChars/contextSize)}chars/msg`);
      
      // Use enhanced chat service with multi-endpoint support
      const enhancedRequest = {
        messages: optimizedMessages,
        metadata: {
          ...requestPayload.metadata,
          enableMultiEndpoint: true,
          conversationHistory: messages.slice(-5).map(m => m.content) // Last 5 messages for context
        },
        featureData: requestPayload.featureData,
        persona: requestPayload.persona,
        analysisResult: analysisResult
      };

      const claudeResponse = await sendEnhancedChatMessage(enhancedRequest);
      
      if (claudeResponse.content) {
        // Enhanced response with multi-endpoint context
        let responseContent = claudeResponse.content;
        
        // Add multi-endpoint context information if available
        if (claudeResponse.multiEndpointContext?.additionalDataFetched) {
          const { endpointsFetched, fetchTime, reasoning } = claudeResponse.multiEndpointContext;
          responseContent += `\n\n---\n**📊 Enhanced Analysis**: Included data from ${endpointsFetched.length} additional endpoint${endpointsFetched.length > 1 ? 's' : ''}: ${endpointsFetched.map(e => e.replace('/', '').replace(/-/g, ' ')).join(', ')} (fetched in ${fetchTime.toFixed(0)}ms)\n*${reasoning}*`;
        }

        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: responseContent,
          timestamp: new Date()
        };
        
        const finalMessages = [...updatedMessages, aiMessage];
        setMessages(finalMessages);
        
        console.log('[ChatInterface] Enhanced chat response received successfully', {
          multiEndpoint: claudeResponse.multiEndpointContext?.additionalDataFetched,
          suggestions: claudeResponse.suggestions?.length || 0
        });
      } else {
        throw new Error('No content in API response');
      }
    } catch (error) {
      console.error('[ChatInterface] Failed to get chat response:', error);
      
      // Provide a helpful error message
      let errorMessage = 'Sorry, I encountered an error processing your question.';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = chatAbortControllerRef.current === null ? 
            'Request was cancelled.' : 
            'Request timed out. Please try a simpler question.';
        } else if (error.message.includes('429')) {
          errorMessage = 'Too many requests. Please wait a moment before trying again.';
        }
      }
      
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      };
      const errorMessages = [...updatedMessages, errorResponse];
      setMessages(errorMessages);
    } finally {
      // Clean up abort controller
      chatAbortControllerRef.current = null;
      setIsProcessing(false);
    }
  }, [inputValue, isProcessing, analysisResult, messages, persona, setMessages, processCommand]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)] overflow-hidden">
      {/* Chat messages */}
      <div className="flex-1 min-h-0 max-h-[calc(100vh-440px)] overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.role === 'user' 
                ? 'bg-green-600 text-white' 
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
                      ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                      : 'theme-message-container'
                  }`}
                  onClick={() => handleMessageClick(message)}
                >
                  <div className="whitespace-pre-wrap" style={{ lineHeight: '1.5' }}>
                    {renderFormattedMessage(message)}
                  </div>
                </div>
                {/* Copy button - only for AI messages */}
                {message.role === 'assistant' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6 theme-text-secondary hover:theme-bg-tertiary"
                    onClick={() => handleCopyMessage(message)}
                    title="Copy message"
                  >
                    {copiedMessageId === message.id ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
              
              {/* Bottom area with timestamp */}
              <div className="flex items-center justify-start mt-1">
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
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-4 border-t theme-border max-h-[200px] overflow-y-auto">
        <div className="flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={`Ask questions about your analysis results... (or try /help for commands, current mode: ${analysisMode === 'full' ? 'Full' : 'Stats-only'})`}
            className="flex-1 min-h-[60px] !text-xs"
            disabled={isProcessing}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isProcessing}
            size="sm"
            className="self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {/* Export conversation button (replacing the performance metrics badges) */}
        <div className="mt-2 pb-2 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportConversation}
            className="text-xs h-8 px-3 gap-2"
            title="Export entire conversation as markdown file"
          >
            <Download className="w-3 h-3" />
            Export Conversation
          </Button>
        </div>
      </div>

      {/* MessageDialog for expanded message viewing - same as original UI */}
      <TooltipProvider delayDuration={300}>
        <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto theme-dialog" aria-describedby="analysis-details-description">
            <DialogHeader>
              <DialogTitle>Analysis Details</DialogTitle>
            </DialogHeader>
            <div id="analysis-details-description" className="space-y-4">
              <div>
                <div className="text-sm leading-relaxed">
                  {selectedMessage && renderFormattedMessage(selectedMessage)}
                </div>
              </div>
              {/* Removed features count from dialog to avoid showing total features */}
            </div>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </div>
  );
};

// Outer component with ErrorBoundary - following QueryInterface pattern
export const ChatInterface: React.FC<ChatInterfaceProps> = (props) => {
  return React.createElement(
    ErrorBoundary as unknown as React.ComponentType<{ children: React.ReactNode }>,
    null,
    React.createElement(ChatInterfaceInner, props)
  );
};