import React from 'react';
import { useChatContext } from './chat-context-provider';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Brain } from 'lucide-react';

interface ContextDisplayProps {
  className?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  showIcon?: boolean;
}

const ContextDisplay: React.FC<ContextDisplayProps> = ({ 
  className = '',
  badgeVariant = 'outline',
  showIcon = true
}) => {
  const { contextSummary } = useChatContext();
  
  if (!contextSummary) return null;
  
  return (
    <div className={`context-awareness-display ${className}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={badgeVariant} className="cursor-help">
              {showIcon && <Brain className="h-3 w-3 mr-1" />}
              Context-Aware
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-md">
            <p className="text-sm">{contextSummary}</p>
            <p className="text-xs text-muted-foreground mt-2">
              AI responses are aware of your conversation history
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default ContextDisplay; 