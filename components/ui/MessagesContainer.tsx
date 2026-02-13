import React, { useEffect, useRef, useState } from 'react';
import { cn } from "@/lib/utils";
import { LocalChatMessage } from '@/types/index';
import { Loader2 } from 'lucide-react';

interface ProcessingStep {
  icon: React.ReactNode;
  message: string;
  children?: React.ReactNode;
}

interface MessagesContainerProps {
  messages: LocalChatMessage[];
  isProcessing?: boolean;
  processingSteps?: ProcessingStep[];
  children?: React.ReactNode;
}

const MessagesContainer: React.FC<MessagesContainerProps> = ({ 
  messages, 
  isProcessing,
  processingSteps = [],
  children 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      ref={containerRef}
      className="h-full flex flex-col"
    >
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto"
      >
        {children}
      </div>
      {/* Processing Steps */}
      {isProcessing && processingSteps && processingSteps.length > 0 && (
        <div className="flex-none bg-white border-t shadow-sm mt-0">
          <div className="max-w-3xl mx-auto px-4 py-1">
            <div className="space-y-1 pt-1">
              {processingSteps.map((step, index) => (
                <div key={index} className="flex items-center space-x-3">
                  {step.icon || <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />}
                  <span className="text-sm text-gray-600">{step.message}</span>
                  {step.children}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesContainer;