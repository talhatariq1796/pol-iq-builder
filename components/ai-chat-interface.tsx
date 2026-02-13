import React, { useState, useRef, useEffect } from 'react';
import { useChatContext, ChatMessage } from './chat-context-provider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertCircle, Send, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AIChatInterfaceProps {
  title?: string;
  initialMessage?: string;
  placeholder?: string;
  onError?: (error: Error) => void;
  modelId?: string;
  systemPrompt?: string;
  className?: string;
}

const AIChatInterface: React.FC<AIChatInterfaceProps> = (props: AIChatInterfaceProps) => {
  const {
    title = 'AI Assistant',
    initialMessage = 'How can I help you today?',
    placeholder = 'Type your message here...',
    onError,
    modelId = 'gpt-3.5-turbo',
    systemPrompt = 'You are a helpful assistant.',
    className = ''
  } = props;
  const { messages, addMessage, clearMessages, contextSummary, refreshContextSummary } = useChatContext();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContextTooltip, setShowContextTooltip] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Add initial assistant message if no messages exist
  useEffect(() => {
    if (messages.length === 0 && initialMessage) {
      addMessage({
        role: 'assistant',
        content: initialMessage
      });
    }
  }, [messages.length, initialMessage, addMessage]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input field when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    // Clear input and any previous errors
    const userMessage = inputValue.trim();
    setInputValue('');
    setError(null);
    
    // Add user message to chat
    addMessage({
      role: 'user',
      content: userMessage
    });
    
    setIsLoading(true);
    
    try {
      // Prepare the message history for the API
      const messageHistory = messages.map((msg: ChatMessage) => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add the new user message
      messageHistory.push({
        role: 'user',
        content: userMessage
      });
      
      // Add system message at the beginning
      const completeHistory = [
        { role: 'system', content: systemPrompt },
        ...messageHistory
      ];
      
      // Make API request to your backend endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: completeHistory,
          model: modelId,
          contextSummary: contextSummary
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add AI response to chat
      addMessage({
        role: 'assistant',
        content: data.message
      });
      
      // Refresh context summary after getting a response
      await refreshContextSummary();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      if (onError && err instanceof Error) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle pressing Enter to submit (but Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        void handleSubmit(e);
      }
    }
  };
  
  const renderMessageContent = (content: string) => {
    // This could be enhanced with markdown rendering if needed
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      <CardHeader className="px-4 py-2 border-b">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{title}</span>
          {contextSummary && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="ml-2 cursor-help"
                    onMouseEnter={() => setShowContextTooltip(true)}
                    onMouseLeave={() => setShowContextTooltip(false)}
                  >
                    Context Aware
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">
                    {contextSummary}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-grow p-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message: ChatMessage) => (
            <div 
              key={message.id} 
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}
              >
                {renderMessageContent(message.content)}
              </div>
            </div>
          ))}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      
      <CardFooter className="p-4 border-t">
        <form onSubmit={handleSubmit} className="w-full flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={clearMessages}
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-grow min-h-10 resize-none"
            rows={1}
          />
          
          <Button 
            type="submit" 
            disabled={isLoading || !inputValue.trim()} 
            className="h-10 w-10 p-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default AIChatInterface; 