import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  MessageSquare,
  GitBranch,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
  Database,
  Zap
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface SessionContextDisplayProps {
  isVisible: boolean;
  sessionId: string | null;
  classification: 'new-analysis' | 'follow-up' | null;
  hasContext: boolean;
  messageCount: number;
  sessionStartTime: number | null;
  isSessionActive: boolean;
  contextSummary?: string | null;
  analysisType?: string;
  onToggleDetails?: () => void;
}

const SessionContextDisplay: React.FC<SessionContextDisplayProps> = ({
  isVisible,
  sessionId,
  classification,
  hasContext,
  messageCount,
  sessionStartTime,
  isSessionActive,
  contextSummary,
  analysisType,
  onToggleDetails
}) => {
  const getClassificationIcon = () => {
    switch (classification) {
      case 'new-analysis':
        return <Sparkles className="h-3 w-3 text-green-600" />;
      case 'follow-up':
        return <ArrowRight className="h-3 w-3 text-blue-600" />;
      default:
        return <Brain className="h-3 w-3 text-gray-500" />;
    }
  };

  const getClassificationLabel = () => {
    switch (classification) {
      case 'new-analysis':
        return 'New Analysis';
      case 'follow-up':
        return 'Follow-up';
      default:
        return 'Ready';
    }
  };

  const getClassificationColor = () => {
    switch (classification) {
      case 'new-analysis':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'follow-up':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatSessionDuration = () => {
    if (!sessionStartTime) return '';
    const duration = Date.now() - sessionStartTime;
    const minutes = Math.floor(duration / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  if (!isVisible) return null;

  return (
    <TooltipProvider>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="mb-4 mx-2"
        >
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
            <div className="flex items-center justify-between">
              {/* Session Status */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-2 py-1 rounded-md border text-xs font-medium ${getClassificationColor()}`}>
                  {getClassificationIcon()}
                  <span>{getClassificationLabel()}</span>
                </div>

                {/* Context Indicator */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                      hasContext 
                        ? 'text-[#33a852] bg-green-50 border border-green-200' 
                        : 'text-gray-500 bg-gray-50 border border-gray-200'
                    }`}>
                      <Database className="h-3 w-3" />
                      <span>{hasContext ? 'Context-Aware' : 'Fresh Start'}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-semibold">
                        {hasContext ? 'Context Available' : 'No Previous Context'}
                      </p>
                      {hasContext && contextSummary && (
                        <p className="text-xs max-w-xs">
                          {contextSummary.length > 100 
                            ? `${contextSummary.substring(0, 100)}...` 
                            : contextSummary}
                        </p>
                      )}
                      {!hasContext && (
                        <p className="text-xs">
                          Starting fresh analysis with no previous conversation context
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Analysis Type */}
                {analysisType && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-purple-600 bg-purple-50 border border-purple-200">
                    <Zap className="h-3 w-3" />
                    <span className="capitalize">{analysisType}</span>
                  </div>
                )}
              </div>

              {/* Session Metadata */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {sessionId && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        <span className="font-mono">
                          {sessionId.split('_').slice(-1)[0].substring(0, 6)}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-semibold">Session ID</p>
                        <p className="text-xs font-mono">{sessionId}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}

                {messageCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{messageCount}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{messageCount} messages in current session</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {sessionStartTime && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatSessionDuration()}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Session duration: {formatSessionDuration()}</p>
                      <p className="text-xs">Started: {new Date(sessionStartTime).toLocaleString()}</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Session Status Indicator */}
                <div className={`w-2 h-2 rounded-full ${
                  isSessionActive ? 'bg-green-400' : 'bg-gray-300'
                }`} />
              </div>
            </div>

            {/* Expandable Context Summary */}
            {hasContext && contextSummary && onToggleDetails && (
              <motion.div
                initial={false}
                className="mt-2 pt-2 border-t border-gray-100"
              >
                <button
                  onClick={onToggleDetails}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <Info className="h-3 w-3" />
                  <span>View conversation context</span>
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </TooltipProvider>
  );
};

export default SessionContextDisplay; 