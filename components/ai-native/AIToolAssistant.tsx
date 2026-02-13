'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import { parseActionFromResponse } from '@/lib/ai/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIToolAssistantProps {
  toolName: string;
  toolDescription?: string;
  initialMessage?: string;
  onAction?: (action: AIAction) => void;
}

interface AIAction {
  type: string;
  payload: Record<string, unknown>;
}

// Tool-specific suggested questions
const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  segmentation: [
    'How do I find persuadable voters?',
    'What makes a good GOTV segment?',
    'How should I target swing precincts?',
  ],
  canvassing: [
    "What's the optimal turf size?",
    'How do I prioritize precincts?',
    'What metrics matter for door-to-door campaigns?',
  ],
  donors: [
    'Where are our top donors located?',
    'How do I find new prospects?',
    'What ZIP codes show donation momentum?',
  ],
  comparison: [
    'How do I compare two jurisdictions?',
    'What metrics matter most for targeting?',
    'Which precincts are most similar?',
  ],
  default: [
    'How does this tool work?',
    'What metrics should I focus on?',
    'Can you explain the data sources?',
  ],
};

// Helper to add small icons to messages and clean up internal tags
function enhanceMessage(content: string): string {
  return content
    // Remove citation tags like [DEMOGRAPHICS], [TARGETING], [ELECTIONS], etc.
    .replace(/\s*\[([A-Z_]+)\]\s*/g, ' ')
    // Clean up any double spaces left behind
    .replace(/\s{2,}/g, ' ')
    // Add trend indicators
    .replace(/\b(increase|up|growth|gain|higher|rose)\b/gi, (match) => `${match} ↑`)
    .replace(/\b(decrease|down|decline|drop|lower|fell)\b/gi, (match) => `${match} ↓`)
    .replace(/\b(hot|trending|popular|momentum)\b/gi, (match) => `${match} 🔥`)
    .replace(/\b(fast|quick|rapid|instant)\b/gi, (match) => `${match} ⚡`);
}

export function AIToolAssistant({
  toolName,
  toolDescription,
  initialMessage,
  onAction
}: AIToolAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: initialMessage || `Hi! I can help you with ${toolName}. What would you like to know?`
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get tool-specific suggestions
  const toolKey = toolName.toLowerCase().replace(/\s+/g, '-');
  const suggestions = SUGGESTED_QUESTIONS[toolKey] || SUGGESTED_QUESTIONS.default;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = async (messageToSend?: string) => {
    const userMessage = (messageToSend || message).trim();
    if (!userMessage || isLoading) return;

    // Hide suggestions after first user message
    setShowSuggestions(false);
    setError(null);
    setMessage('');

    // Add user message
    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: userMessage }
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Build tool context for the system prompt
      const toolContext = toolDescription
        ? `\n\n## Current Tool Context\nThe user is working with the ${toolName} tool. ${toolDescription}`
        : `\n\n## Current Tool Context\nThe user is working with the ${toolName} tool.`;

      // Call the political chat API
      const response = await fetch('/api/political-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          includeData: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();

      // Parse response for action directives
      const parsedResponse = parseActionFromResponse(data.content || '');

      // Execute actions if provided
      if (parsedResponse.actions && onAction) {
        parsedResponse.actions.forEach(action => {
          console.log('[AIToolAssistant] Executing action:', action);
          onAction(action);
        });
      }

      // Add assistant response
      setMessages((prev: Message[]) => [
        ...prev,
        {
          role: 'assistant',
          content: parsedResponse.message || 'I apologize, but I could not generate a response. Please try again.',
        },
      ]);
    } catch (err) {
      console.error('[AIToolAssistant] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to get response: ${errorMessage}`);

      // Add error message to chat
      setMessages((prev: Message[]) => [
        ...prev,
        {
          role: 'assistant',
          content: `I'm sorry, I encountered an error: ${errorMessage}. Please try again or rephrase your question.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    handleSend(question);
  };

  if (!isOpen) {
    return (
      <Button
        className="fixed bottom-4 right-4 rounded-full h-14 w-14 shadow-lg bg-[#33a852] hover:bg-[#2d9248] z-50 transition-all"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Assistant"
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] h-[32rem] max-h-[calc(100vh-2rem)] bg-white rounded-lg shadow-xl border flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-[#33a852] text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <div className="flex flex-col">
            <span className="font-medium text-sm">AI Assistant</span>
            <span className="text-xs opacity-90">{toolName}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="hover:bg-[#2d9248] text-white h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-[#33a852] to-[#2d9944] text-white'
                  : 'bg-gradient-to-br from-indigo-50 via-white to-pink-50 text-gray-900 border border-gray-200'
              }`}
            >
              <div className="text-xs leading-relaxed prose prose-xs max-w-none prose-headings:text-xs prose-p:text-xs prose-li:text-xs prose-strong:font-semibold prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                <ReactMarkdown>{enhanceMessage(msg.content)}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-2xl border border-gray-200">
              <Loader2 className="h-4 w-4 animate-spin text-[#33a852]" />
            </div>
          </div>
        )}

        {/* Suggested questions (only show initially) */}
        {showSuggestions && messages.length === 1 && !isLoading && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-gray-500 font-medium">Suggested questions:</p>
            {suggestions.map((question, i) => (
              <button
                key={i}
                onClick={() => handleSuggestedQuestion(question)}
                className="block w-full text-left text-xs p-2 rounded border border-gray-200 hover:border-[#33a852] hover:bg-[#e6f4ea] transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={message}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
          placeholder="Ask me anything..."
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 text-sm h-12 px-4"
          disabled={isLoading}
        />
        <Button
          onClick={() => handleSend()}
          size="default"
          className="bg-[#33a852] hover:bg-[#2d9248] px-6 h-12"
          disabled={!message.trim() || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
