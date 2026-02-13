import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Button } from "@/components/ui/button";

interface TooltipButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  isActive?: boolean;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

const TooltipButton = ({ 
  icon, 
  tooltip, 
  onClick, 
  isActive = false,
  className = "w-12 h-12",
}: TooltipButtonProps) => {
  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={200}>
        <Tooltip.Trigger asChild>
          <Button
            size="icon"
            variant={isActive ? "default" : "ghost"}
            className={`relative z-50 ${className}`}
            onClick={onClick}
            aria-label={tooltip}
          >
            {icon}
          </Button>
        </Tooltip.Trigger>
          <Tooltip.Content
            className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-xs animate-in fade-in-0 zoom-in-95"
            side="right"
            sideOffset={5}
          >
            {tooltip}
          </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default TooltipButton;