import React, { useEffect, useRef } from 'react';
import { LoadingSpinner, ErrorMessage, LoadingVisualization } from './loading-states';

interface AnimatedMessageProps {
  message: {
    id: string;
    type: 'user' | 'ai' | 'error' | 'system';
    content: string;
    visualizations?: React.ReactNode[];
    features?: any[];
    error?: boolean;
  };
  isLatest: boolean;
}

const AnimatedMessage = ({ message, isLatest }: AnimatedMessageProps) => {
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.style.opacity = '0';
      messageRef.current.style.transform = 'translateY(20px)';
      
      // Trigger animation after a small delay
      setTimeout(() => {
        if (messageRef.current) {
          messageRef.current.style.opacity = '1';
          messageRef.current.style.transform = 'translateY(0)';
        }
      }, 100);
    }
  }, []);

  return (
    <div
      ref={messageRef}
      className={`
        message 
        message-${message.type} 
        ${message.error ? 'message-error' : ''}
        transition-all duration-500 ease-out
        ${isLatest ? 'animate-slideIn' : ''}
      `}
    >
      {message.error ? (
        <ErrorMessage message={message.content} />
      ) : (
        <>
          <div 
            className="message-content prose max-w-none"
            dangerouslySetInnerHTML={{ __html: message.content }}
          />
          
          {message.visualizations && (
            <div className="message-visualizations space-y-4 mt-4">
              {message.visualizations.map((viz, index) => (
                <div 
                  key={`viz-${index}`}
                  className="visualization-container animate-fadeIn"
                >
                  {viz}
                </div>
              ))}
            </div>
          )}
          
          {message.features && (
            <div className="message-features mt-2 text-sm text-gray-600">
              Features found: {message.features.length}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnimatedMessage;