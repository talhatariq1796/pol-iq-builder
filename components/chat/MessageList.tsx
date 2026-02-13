import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Copy,
  FileSpreadsheet,
  BarChart,
  Save,
  MessageSquare,
  Cog,
  Loader2,
  AlertCircle,
  X,
  Check,
  Brain,
  Database,
  Reply,
  GitBranch,
  Share2
} from 'lucide-react';
import Image from 'next/image';
import ProcessingIndicator from './ProcessingIndicator';
import { ChatMessage, GeoProcessingStep } from '@/lib/analytics/types';
const SyntaxHighlighter = (require('react-syntax-highlighter') as { Prism: React.ComponentType<any> }).Prism;
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import StreamingText from '@/components/StreamingText';
import { CitationTag } from './CitationTag';

type LocalChatMessage = ChatMessage & {
  role: 'user' | 'assistant' | 'system';
  metadata?: {
    analysisResult?: any;
    context?: string;
    totalFeatures?: number;
    visualizationResult?: any;
    debugInfo?: any;
    error?: string;
    isStreaming?: boolean;
  };
};

interface MessageListProps {
  messages: LocalChatMessage[];
  isProcessing: boolean;
  processingSteps: GeoProcessingStep[];
  messagesEndRef: { current: HTMLDivElement | null };
  onMessageClick: (message: LocalChatMessage) => void;
  onCopyText: (text: string) => void;
  onExportData: (messageId: string) => void;
  onSHAPChart: (messageId: string) => void;
  onInfographicsClick: (e: React.MouseEvent) => void;
  onReplyClick: (messageId: string) => void;
  onCustomizeVisualization: (messageId: string) => void;
  onZoomToFeature?: (featureId: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isProcessing,
  processingSteps,
  messagesEndRef,
  onMessageClick,
  onCopyText,
  onExportData,
  onSHAPChart,
  onInfographicsClick,
  onReplyClick,
  onCustomizeVisualization,
  onZoomToFeature
}) => {
  // Check if an endpoint supports SHAP feature importance charts
  const shouldShowSHAPChart = (message: LocalChatMessage): boolean => {
    if (!message.metadata?.analysisResult?.data) return false;
    
    // Get endpoint from various possible sources
    const endpoint = message.metadata.analysisResult?.endpoint || 
                    (message.metadata as any).endpoint || 
                    message.metadata.analysisResult?.data?.type ||
                    message.metadata.analysisResult?.data?.analysis_type || '';
    
    // Endpoints that don't use ML calculations and shouldn't have SHAP charts
    const nonMLEndpoints = [
      'brand-difference',
      'market-share-difference', 
      'spatial-clusters',
      'difference',
      '/brand-difference',
      '/market-share-difference',
      '/spatial-clusters', 
      '/difference'
    ];
    
    const cleanEndpoint = endpoint.replace('/', '');
    return !nonMLEndpoints.includes(cleanEndpoint) && !nonMLEndpoints.includes(endpoint);
  };
  const codeBlockRegex = /```(json|typescript|javascript|python|html|css|bash|sql)\n([\s\S]*?)```/g;

  // Helper function to detect and linkify FSA/ID patterns
  const linkifyFSAIds = (text: string): React.ReactNode[] => {
    if (!onZoomToFeature) return [text];
    
    // Patterns for different ID types - more specific to avoid false positives
    const patterns = [
      // Canadian FSA pattern (e.g., M5V, H3B, etc.) - letter, digit, letter
      {
        regex: /\b[A-Z]\d[A-Z]\b/g,
        priority: 1
      },
      // Specific FSA references with context (e.g., "FSA M5V", "area M5V")
      {
        regex: /\b(?:FSA|area|region|postal code)\s+([A-Z]\d[A-Z])\b/gi,
        priority: 2,
        captureGroup: 1
      },
      // US ZIP codes (5 digits, optionally followed by dash and 4 more digits)
      {
        regex: /\b\d{5}(?:-\d{4})?\b/g,
        priority: 3
      },
      // Generic ID patterns with prefixes (e.g., ID123, FSA_456, etc.)
      {
        regex: /\b(?:ID|FSA|ZIP|CODE)[-_]?\d+\b/gi,
        priority: 4
      }
    ];
    
    let parts: (string | React.ReactElement)[] = [text];
    let keyCounter = 0;
    
    // Sort patterns by priority (lower number = higher priority)
    patterns.sort((a, b) => a.priority - b.priority);
    
    patterns.forEach(({ regex, captureGroup }) => {
      const newParts: (string | React.ReactElement)[] = [];
      
      parts.forEach(part => {
        if (typeof part === 'string') {
          const matches = [...part.matchAll(regex)];
          if (matches.length === 0) {
            newParts.push(part);
            return;
          }
          
          let lastIndex = 0;
          matches.forEach(match => {
            const fullMatch = match[0];
            const matchText = captureGroup ? match[captureGroup] : fullMatch;
            const matchIndex = match.index!;
            
            // Add text before match
            if (matchIndex > lastIndex) {
              newParts.push(part.substring(lastIndex, matchIndex));
            }
            
            // Add clickable link
            newParts.push(
              <button
                key={`fsa-link-${keyCounter++}`}
                className="inline text-[#33a852] hover:text-[#2d9748] font-semibold underline cursor-pointer bg-transparent border-none p-0 m-0 transition-colors duration-200"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onZoomToFeature(matchText);
                }}
                title={`Zoom to ${matchText}`}
              >
                {captureGroup ? fullMatch : matchText}
              </button>
            );
            
            lastIndex = matchIndex + fullMatch.length;
          });
          
          // Add remaining text after last match
          if (lastIndex < part.length) {
            newParts.push(part.substring(lastIndex));
          }
        } else {
          newParts.push(part);
        }
      });
      
      parts = newParts;
    });
    
    return parts;
  };

  // Helper function to detect and render citation tags like [ELECTIONS], [DEMOGRAPHICS]
  const processCitations = (parts: React.ReactNode[]): React.ReactNode[] => {
    const citationRegex = /\[([A-Z_]+)\]/g;
    let keyCounter = 0;

    const newParts: React.ReactNode[] = [];

    parts.forEach((part, partIdx) => {
      if (typeof part === 'string') {
        const matches = [...part.matchAll(citationRegex)];
        if (matches.length === 0) {
          newParts.push(part);
          return;
        }

        let lastIndex = 0;
        matches.forEach(match => {
          const fullMatch = match[0];
          const matchIndex = match.index!;

          // Add text before match
          if (matchIndex > lastIndex) {
            newParts.push(part.substring(lastIndex, matchIndex));
          }

          // Add citation tag component
          newParts.push(
            <CitationTag
              key={`citation-${partIdx}-${keyCounter++}`}
              citationKey={fullMatch}
            />
          );

          lastIndex = matchIndex + fullMatch.length;
        });

        // Add remaining text after last match
        if (lastIndex < part.length) {
          newParts.push(part.substring(lastIndex));
        }
      } else {
        newParts.push(part);
      }
    });

    return newParts;
  };

  const renderContent = (content: string) => {
    const parts = content.split(codeBlockRegex);
    return parts.map((part, index) => {
      if (index % 3 === 2) {
        const language = parts[index - 1];
        return (
          <div key={index} className="my-2 rounded-md overflow-hidden">
            <div className="bg-gray-800 text-gray-200 px-4 py-2 text-xs font-sans flex justify-between items-center">
              <span>{language}</span>
              <Button variant="ghost" size="sm" onClick={() => onCopyText(part)} className="text-xs p-1 h-auto">
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
            <SyntaxHighlighter language={language} style={oneDark} customStyle={{ margin: 0, borderRadius: '0 0 0.375rem 0.375rem' }}>
              {part}
            </SyntaxHighlighter>
          </div>
        );
      } else if (part.trim()) {
        return <p key={index} className="whitespace-pre-wrap">{part}</p>;
      }
      return null;
    });
  };

  const formatAssistantContent = (content: string) => {
    // Split content into sections and paragraphs for better formatting
    const sections = content.split(/\n\s*\n/); // Split on double newlines
    
    return sections.map((section, sectionIndex) => {
      const trimmedSection = section.trim();
      if (!trimmedSection) return null;
      
      // Check if this is a header (starts with number or bullet)
      const isHeader = /^[\d]+\./.test(trimmedSection) || /^[•▪▫-]\s/.test(trimmedSection);
      const isList = /^[\d]+\.\s|^[•▪▫-]\s/.test(trimmedSection);
      
      if (isList) {
        // Handle lists
        const listItems = trimmedSection.split(/\n(?=[\d]+\.|[•▪▫-]\s)/);
        return (
          <div key={sectionIndex} className="mb-4">
            {listItems.map((item, itemIndex) => {
              const cleanItem = item.trim();
              if (!cleanItem) return null;
              
              // Check if it's a numbered list or bullet list
              const isNumbered = /^[\d]+\./.test(cleanItem);
              const content = cleanItem.replace(/^[\d]+\.\s*|^[•▪▫-]\s*/, '');
              
              const linkedContent = linkifyFSAIds(content);
              const contentWithCitations = processCitations(linkedContent);

              return (
                <div key={itemIndex} className="mb-2 flex items-start gap-2">
                  <span className="text-[#33a852] font-semibold text-xs mt-0.5 flex-shrink-0">
                    {isNumbered ? cleanItem.match(/^[\d]+\./)?.[0] : '•'}
                  </span>
                  <span className="text-gray-800 text-xs leading-relaxed">
                    {contentWithCitations}
                  </span>
                </div>
              );
            })}
          </div>
        );
      } else if (isHeader) {
        // Handle headers
        return (
          <h4 key={sectionIndex} className="font-bold text-gray-900 text-xs mb-2 mt-4 first:mt-0">
            {trimmedSection}
          </h4>
        );
      } else {
        // Handle regular paragraphs
        const lines = trimmedSection.split('\n');
        return (
          <div key={sectionIndex} className="mb-3">
            {lines.map((line, lineIndex) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return <br key={lineIndex} />;
              
              // Check for bold text patterns
              const formattedLine = trimmedLine
                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
              
              // Apply FSA/ID linking and citation processing to the formatted line
              const linkedContent = linkifyFSAIds(formattedLine);
              const contentWithCitations = processCitations(linkedContent);

              return (
                <p
                  key={lineIndex}
                  className="text-gray-800 text-xs leading-relaxed mb-1 last:mb-0"
                >
                  {contentWithCitations.map((part, partIndex) => {
                    if (typeof part === 'string') {
                      return (
                        <span
                          key={partIndex}
                          dangerouslySetInnerHTML={{ __html: part }}
                        />
                      );
                    }
                    return part; // React element (link button or citation tag)
                  })}
                </p>
              );
            })}
          </div>
        );
      }
    }).filter(Boolean);
  };

  // Simple animated indicator while Claude is "typing"
  const TypingIndicator: React.FC = () => (
    <div className="flex items-center gap-2 py-1">
      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      <span className="text-xs theme-text-secondary">Thinking</span>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-4 py-4 space-y-4">
              {messages.length === 0 ? (
                <div className="empty-state flex flex-col items-center justify-center min-h-[200px]">
                  <div className="flex flex-col items-center space-y-6 w-full px-3">
                    <div className="flex justify-center w-full">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Image
                          src="/mpiq_pin2.png"
                          alt="IQbuilder"
                          width={20}
                          height={20}
                          className="object-contain"
                        />
                        <h2 className="text-lg font-semibold">
                          <span>
                            <span className='font-bold text-[#33a852]'>IQ</span>
                            <span className="theme-text-primary">builder</span>
                          </span>
                        </h2>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`theme-message-container ${
                        message.role === 'user'
                          ? 'theme-message-user'
                          : message.role === 'system' && message.metadata?.error
                          ? 'theme-bg-destructive-subtle theme-text-destructive'
                          : 'cursor-pointer'
                      }`}
                      onClick={(e: React.MouseEvent) => {
                        if (
                          message.role === 'assistant' &&
                          !(e.target as HTMLElement).closest('button') &&
                          !(e.target as HTMLElement).closest('a') &&
                          !(e.target as HTMLElement).closest('[role="button"]')
                        ) {
                          onMessageClick(message);
                        }
                      }}
                    >
                      {/* Message Content */}
                      <div className="mb-3">
                        {message.role === 'assistant' ? (
                          // Show typing indicator when content is just ellipsis
                          message.content.trim() === '…' || message.content.trim() === '...' ? (
                            <TypingIndicator />
                          ) : message.metadata?.isStreaming ? (
                            <div className="space-y-1">
                              {formatAssistantContent(message.content)}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {formatAssistantContent(message.content)}
                            </div>
                          )
                        ) : (
                          <div className="text-xs leading-relaxed font-normal">
                            {message.content}
                          </div>
                        )}
                      </div>

                      {/* Tool Icons Row - Only for assistant messages */}
                      {message.role === 'assistant' && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    onCopyText(message.content);
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="theme-tooltip">
                                <p>Copy to clipboard</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Export analysis data to CSV */}
                          {message.metadata?.analysisResult?.data && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      onExportData(message.id);
                                    }}
                                  >
                                    <FileSpreadsheet className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="theme-tooltip">
                                  <p>Export data to CSV</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          {/* SHAP Feature Importance Chart - Only for ML-based analyses */}
                          {shouldShowSHAPChart(message) && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      onSHAPChart(message.id);
                                    }}
                                  >
                                    <BarChart className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="theme-tooltip">
                                  <p>Why these scores? (Feature importance)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          {/* Gear icon to open custom visualization panel */}
                          {false && message.metadata?.analysisResult?.data && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      onCustomizeVisualization(message.id);
                                    }}
                                    title="Customize visualization"
                                  >
                                    <Cog className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="theme-tooltip">
                                  <p>Customize visualization</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex items-center justify-center pt-0 pb-2">
                      <div className="theme-loading-container space-y-2 w-full max-w-2xl">
                        {processingSteps.map((step) => (
                          <ProcessingIndicator key={step.id} step={step} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
      </div>
    </div>
  );
};

export default MessageList; 