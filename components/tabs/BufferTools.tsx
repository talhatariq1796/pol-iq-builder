import React, { memo } from 'react';
import { Target, Car, PersonStanding } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BufferTools = memo(({ 
  bufferType, 
  handleBufferTypeChange,
}: { 
  bufferType: string | null; 
  handleBufferTypeChange: (mode: 'radius' | 'drivetime' | 'walktime') => void; 
}) => {
  return (
    <TooltipProvider>
      <div className="w-full bg-muted rounded-lg p-1">
        <div className="grid grid-cols-3 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                type="button"
                className={`h-12 w-full rounded-md flex items-center justify-center transition-colors
                  ${bufferType === 'radius' 
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
                    : 'bg-background hover:bg-muted/50 border border-border'}`}
                onClick={() => handleBufferTypeChange('radius')}
              >
                <Target className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              Radius Buffer
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`h-12 w-full rounded-md flex items-center justify-center transition-colors
                  ${bufferType === 'drivetime' 
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
                    : 'bg-background hover:bg-muted/50 border border-border'}`}
                onClick={() => handleBufferTypeChange('drivetime')}
              >
                <Car className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              Drive Time Buffer
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`h-12 w-full rounded-md flex items-center justify-center transition-colors
                  ${bufferType === 'walktime' 
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
                    : 'bg-background hover:bg-muted/50 border border-border'}`}
                onClick={() => handleBufferTypeChange('walktime')}
              >
                <PersonStanding className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              Walk Time Buffer
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
});



export default BufferTools; 