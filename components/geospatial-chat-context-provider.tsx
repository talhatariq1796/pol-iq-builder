import React, { ReactNode } from 'react';
import { ChatContextProvider } from './chat-context-provider';

interface GeospatialChatProviderProps {
  children: ReactNode;
  maxMessages?: number;
}

export const GeospatialChatProvider: React.FC<GeospatialChatProviderProps> = ({ 
  children,
  maxMessages = 50 
}) => {
  return (
    <ChatContextProvider maxMessages={maxMessages}>
      {children}
    </ChatContextProvider>
  );
}; 