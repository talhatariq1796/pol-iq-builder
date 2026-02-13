import React from 'react';
import { motion } from 'framer-motion';
import { 
  GitBranch, 
  Clock, 
  MessageSquare, 
  Sparkles,
  RefreshCw 
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type SessionTrigger = 'new-analysis' | 'manual-clear' | 'timeout';

export interface SessionBoundaryProps {
  sessionId: string;
  startTime: number;
  classification: 'new-analysis' | 'follow-up';
  trigger?: SessionTrigger;
  messageCount?: number;
  analysisType?: string;
  isFirstSession?: boolean;
}

const SessionBoundary: React.FC<SessionBoundaryProps> = ({
  sessionId,
  startTime,
  classification,
  trigger,
  messageCount = 0,
  analysisType,
  isFirstSession = false
}) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getTriggerIcon = () => {
    switch (trigger) {
      case 'new-analysis':
        return <Sparkles className="h-3 w-3" />;
      case 'manual-clear':
        return <RefreshCw className="h-3 w-3" />;
      case 'timeout':
        return <Clock className="h-3 w-3" />;
      default:
        return <GitBranch className="h-3 w-3" />;
    }
  };

  const getTriggerLabel = () => {
    switch (trigger) {
      case 'new-analysis':
        return 'New Analysis Started';
      case 'manual-clear':
        return 'Session Cleared';
      case 'timeout':
        return 'Session Timeout';
      default:
        return 'New Session';
    }
  };

  const getBorderColor = () => {
    if (isFirstSession) return 'border-blue-200';
    switch (trigger) {
      case 'new-analysis':
        return 'border-green-200';
      case 'manual-clear':
        return 'border-purple-200';
      case 'timeout':
        return 'border-orange-200';
      default:
        return 'border-gray-200';
    }
  };

  const getBackgroundColor = () => {
    if (isFirstSession) return 'bg-blue-50';
    switch (trigger) {
      case 'new-analysis':
        return 'bg-green-50';
      case 'manual-clear':
        return 'bg-purple-50';
      case 'timeout':
        return 'bg-orange-50';
      default:
        return 'bg-gray-50';
    }
  };

  const getTextColor = () => {
    if (isFirstSession) return 'text-blue-600';
    switch (trigger) {
      case 'new-analysis':
        return 'text-green-600';
      case 'manual-clear':
        return 'text-purple-600';
      case 'timeout':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  // Don't show boundary for first session unless explicitly marked
  if (isFirstSession && !trigger) {
    return null;
  }

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`my-4 mx-2 p-3 rounded-lg border ${getBorderColor()} ${getBackgroundColor()}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full bg-white border ${getBorderColor()}`}>
              {getTriggerIcon()}
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-medium ${getTextColor()}`}>
                {getTriggerLabel()}
              </span>
              {analysisType && (
                <span className="text-xs text-gray-500 capitalize">
                  {analysisType} analysis
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(startTime)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Session started: {new Date(startTime).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
            
            {messageCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>{messageCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{messageCount} messages in this session</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  <span className="font-mono text-xs">
                    {sessionId.split('_').slice(-1)[0].substring(0, 6)}...
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-semibold">Session Details</p>
                  <p className="text-xs">ID: {sessionId}</p>
                  <p className="text-xs">Classification: {classification}</p>
                  <p className="text-xs">Started: {new Date(startTime).toLocaleString()}</p>
                  {messageCount > 0 && (
                    <p className="text-xs">Messages: {messageCount}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
};

export default SessionBoundary; 