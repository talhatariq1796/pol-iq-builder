'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { segmentTextWithEntities, getEntityCoordinates, type EntityReference } from '@/lib/ai/entityParser';
import { ThinkingIndicator, type QueryContext } from './ThinkingIndicator';

/**
 * Represents a single message in the conversation
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: SuggestedAction[];
  citations?: string[];
}

/**
 * Suggested action that can be taken from an assistant message
 */
export interface SuggestedAction {
  id: string;
  label: string;
  action: string;
}

/**
 * Props for the AIPoliticalConversation component
 */
export interface AIPoliticalConversationProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onActionClick: (action: SuggestedAction) => void;
  isLoading?: boolean;
  placeholder?: string;
  /** Callback when an entity is clicked */
  onEntityClick?: (entity: EntityReference) => void;
  /** Query context for contextual loading messages */
  loadingContext?: QueryContext;
}

/**
 * Renders formatted message content with markdown-like formatting
 * Supports: **bold**, bullet lists, [CITATIONS], and clickable entity names
 */
const FormattedMessageContent: React.FC<{
  content: string;
  onEntityClick?: (entity: EntityReference) => void;
}> = ({ content, onEntityClick }) => {
  // Split content into paragraphs
  const paragraphs = content.split('\n\n');

  return (
    <div className="space-y-2">
      {paragraphs.map((paragraph, idx) => {
        // Check if paragraph is a list
        if (paragraph.trim().startsWith('-') || paragraph.trim().startsWith('•')) {
          const listItems = paragraph
            .split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
            .map(line => line.replace(/^[-•]\s*/, '').trim());

          return (
            <ul key={idx} className="list-disc list-inside space-y-1 ml-2">
              {listItems.map((item, itemIdx) => (
                <li key={itemIdx}>
                  <FormattedTextWithEntities text={item} onEntityClick={onEntityClick} />
                </li>
              ))}
            </ul>
          );
        }

        // Regular paragraph
        return (
          <p key={idx} className="leading-relaxed">
            <FormattedTextWithEntities text={paragraph} onEntityClick={onEntityClick} />
          </p>
        );
      })}
    </div>
  );
};

/**
 * Renders text with clickable entity references
 */
const FormattedTextWithEntities: React.FC<{
  text: string;
  onEntityClick?: (entity: EntityReference) => void;
}> = ({ text, onEntityClick }) => {
  const segments = segmentTextWithEntities(text);

  return (
    <>
      {segments.map((segment, idx) => {
        if (segment.type === 'entity' && segment.entity && onEntityClick) {
          return (
            <button
              key={idx}
              onClick={() => onEntityClick(segment.entity!)}
              className="text-primary hover:underline font-medium cursor-pointer mx-0.5"
              title={`Click to view ${segment.entity.type}: ${segment.content}`}
            >
              {segment.content}
            </button>
          );
        } else {
          // Apply inline formatting (bold, citations)
          return (
            <span
              key={idx}
              dangerouslySetInnerHTML={{ __html: formatInlineText(segment.content) }}
            />
          );
        }
      })}
    </>
  );
};

/**
 * Formats inline text for bold and removes internal citation tags
 */
const formatInlineText = (text: string): string => {
  // Remove citation tags like [DEMOGRAPHICS], [TARGETING], [ELECTIONS], etc.
  let formatted = text.replace(/\s*\[([A-Z_]+)\]\s*/g, ' ');

  // Clean up any double spaces left behind
  formatted = formatted.replace(/\s{2,}/g, ' ');

  // Handle **bold** text
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');

  return formatted;
};

/**
 * Individual message bubble component
 */
const MessageBubble: React.FC<{
  message: Message;
  onActionClick: (action: SuggestedAction) => void;
  onEntityClick?: (entity: EntityReference) => void;
}> = ({ message, onActionClick, onEntityClick }) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3 mb-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-[#33a852]' : 'bg-gray-700'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex flex-col gap-2 max-w-[75%]', isUser ? 'items-end' : 'items-start')}>
        {/* Message bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm',
            isUser
              ? 'bg-[#33a852] text-white'
              : 'bg-white border border-gray-200 text-gray-900'
          )}
        >
          {isUser ? (
            <p className="leading-relaxed">{message.content}</p>
          ) : (
            <FormattedMessageContent content={message.content} onEntityClick={onEntityClick} />
          )}
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {message.citations.map((citation, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded border border-gray-300"
              >
                {citation}
              </span>
            ))}
          </div>
        )}

        {/* Suggested actions */}
        {!isUser && message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {message.actions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                onClick={() => onActionClick(action)}
                className="text-xs h-8 bg-white hover:bg-gray-50 border-gray-300"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-gray-500 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

/**
 * AI Political Conversation Component
 *
 * Displays a chat interface for political analysis with AI assistant.
 * Supports markdown formatting, citations, and suggested actions.
 */
export const AIPoliticalConversation: React.FC<AIPoliticalConversationProps> = ({
  messages,
  onSendMessage,
  onActionClick,
  isLoading = false,
  placeholder = 'Ask about voting patterns, demographics, or swing precincts...',
  onEntityClick,
  loadingContext = 'general',
}) => {
  const [inputValue, setInputValue] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = () => {
    const trimmedMessage = inputValue.trim();
    if (trimmedMessage && !isLoading) {
      onSendMessage(trimmedMessage);
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Bot className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Political Analysis Assistant
              </h3>
              <p className="text-sm text-gray-500 max-w-md">
                Query voting patterns, demographic trends, swing precincts, or canvassing strategies.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onActionClick={onActionClick}
                  onEntityClick={onEntityClick}
                />
              ))}

              {/* Loading indicator with contextual rotating messages */}
              {isLoading && (
                <ThinkingIndicator context={loadingContext} />
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Input
                value={inputValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                disabled={isLoading}
                className="pr-10 resize-none"
              />
            </div>

            {/* Send button */}
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="flex-shrink-0 bg-[#33a852] hover:bg-[#2d9944]"
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Character count or helpful hint */}
          <div className="mt-2 text-xs text-gray-500 flex justify-between items-center">
            <span>Press Enter to send</span>
            <span>{inputValue.length} characters</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Default export
export default AIPoliticalConversation;
