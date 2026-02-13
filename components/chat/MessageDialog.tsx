import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatMessage } from '@/lib/analytics/types';
import { renderPerformanceMetrics } from '@/lib/utils/performanceMetrics';

type LocalChatMessage = ChatMessage & {
  role: 'user' | 'assistant' | 'system';
  metadata?: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysisResult?: any;
    context?: string;
    totalFeatures?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visualizationResult?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debugInfo?: any;
    error?: string;
  };
};

interface MessageDialogProps {
  message: LocalChatMessage | null;
  onClose: () => void;
}

const MessageDialog: React.FC<MessageDialogProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <Dialog open={!!message} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Details</DialogTitle>
          <p className="text-xs text-gray-600"></p>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold">Content:</h4>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          {message.metadata?.analysisResult && (
            <div>
              {/* Dynamic Model Performance Information */}
              {renderPerformanceMetrics(
                message.metadata.analysisResult,
                "flex flex-wrap gap-4 mt-2 text-xs text-gray-700"
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MessageDialog; 