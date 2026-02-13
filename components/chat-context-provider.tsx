import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the shape of a chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// Define the shape of the context
export interface ChatContextType {
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  contextSummary: string | null;
  refreshContextSummary: () => Promise<void>;

  /**
   * Load ("bridge") a previous chat session's messages into the current
   * in-memory history, allowing follow-up questions to piggy-back on that
   * context.
   */
  bridgeSession: (sessionId: string) => Promise<void>;

  /** Currently active session ID – null when no session established */
  currentSessionId: string | null;
}

// Create context with default values
const ChatContext = createContext<ChatContextType>({
  messages: [],
  addMessage: () => {},
  clearMessages: () => {},
  contextSummary: null,
  refreshContextSummary: async () => {},
  bridgeSession: async () => {},
  currentSessionId: null,
});

// Define props for the provider component
interface ChatContextProviderProps {
  children: ReactNode;
  maxMessages?: number;
}

export const ChatContextProvider = ({ 
  children, 
  maxMessages = 10 
}: ChatContextProviderProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contextSummary, setContextSummary] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Load messages from localStorage on initial render
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error('Failed to parse saved chat messages:', e);
      }
    }
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
  }, [messages]);

  // Add a new message to the chat history
  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };

    setMessages((prevMessages: ChatMessage[]) => {
      // Keep only the most recent messages up to maxMessages
      const updatedMessages = [...prevMessages, newMessage];
      if (updatedMessages.length > maxMessages) {
        return updatedMessages.slice(updatedMessages.length - maxMessages);
      }
      return updatedMessages;
    });
  };

  // Clear all messages
  const clearMessages = () => {
    setMessages([]);
    setContextSummary(null);
  };

  // Generate a summary of the conversation context using an API
  const refreshContextSummary = async () => {
    if (messages.length === 0) {
      setContextSummary(null);
      return;
    }

    try {
      // Convert messages to the format expected by the API
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch('/api/summarize-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: conversationHistory }),
      });

      if (!response.ok) {
        throw new Error('Failed to summarize context');
      }

      const data = await response.json();
      setContextSummary(data.summary);
    } catch (error) {
      console.error('Error generating context summary:', error);
      // If there's an error, don't update the context summary
    }
  };

  /**
   * Replace the in-memory message list with the most recent N messages from a
   * previous session so that the assistant can reference that context.
   * Currently this relies on the backend `/api/sessions` DELETE/POST helpers
   * to persist sessions.  For now we just fetch the full session record and
   * splice its messages into local state (client-only fallback).
   */
  const bridgeSession = async (sessionId: string) => {
    try {
      // Attempt to fetch session payload via internal API – will return the
      // stored `data` object from SessionStorage (server side).
      const res = await fetch(`/api/session-data?sessionId=${encodeURIComponent(sessionId)}`);
      if (res.ok) {
        const json = await res.json();
        const restoredMessages: ChatMessage[] = json?.messages ?? [];
        setMessages(restoredMessages);
        setCurrentSessionId(sessionId);
      } else {
        console.warn('[ChatContext] bridgeSession failed, status', res.status);
      }
    } catch (err) {
      console.error('[ChatContext] bridgeSession error', err);
    }
  };

  // The value that will be provided to consumers of this context
  const contextValue: ChatContextType = {
    messages,
    addMessage,
    clearMessages,
    contextSummary,
    refreshContextSummary,
    bridgeSession,
    currentSessionId,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook to use the chat context
export const useChatContext = () => useContext(ChatContext); 