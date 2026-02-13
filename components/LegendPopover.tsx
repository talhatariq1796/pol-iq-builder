import React, { useEffect, useState } from 'react';
import { StandardizedLegendData } from '@/types/legend';
import { createPortal } from 'react-dom';

interface LegendPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorEl: HTMLElement | null;
  legendData: StandardizedLegendData | null;
}

const LegendPopover: React.FC<LegendPopoverProps> = ({
  open,
  onOpenChange,
  anchorEl,
  legendData,
}) => {
  console.log('[LegendPopover] Render with props:', { 
    open, 
    hasAnchorEl: !!anchorEl, 
    hasLegendData: !!legendData,
    itemsCount: legendData?.items?.length,
    legendTitle: legendData?.title 
  });

  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (open && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Calculate position - try to show to the right of the button
      let left = rect.right + 8;
      let top = rect.top;
      
      // If there's not enough space on the right, show on the left
      if (left + 250 > viewportWidth) {
        left = rect.left - 258; // 250 + 8 spacing
      }
      
      // Ensure it doesn't go off the bottom of the screen
      if (top + 200 > viewportHeight) {
        top = viewportHeight - 200 - 8;
      }
      
      // Ensure it doesn't go off the top of the screen
      if (top < 8) {
        top = 8;
      }

      setPosition({ top, left });
    }
  }, [open, anchorEl]);

  useEffect(() => {
    if (open) {
      const handleClickOutside = (event: MouseEvent) => {
        if (anchorEl && !anchorEl.contains(event.target as Node)) {
          onOpenChange(false);
        }
      };
      
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onOpenChange(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [open, anchorEl, onOpenChange]);

  if (!open || !legendData || !anchorEl) {
    return null;
  }

  const content = (
    <div
      className="fixed z-50 w-64 min-w-[200px] p-3 bg-white shadow-lg rounded-md border border-gray-200 animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="space-y-2">
        <h4 className="text-sm font-medium mb-2 border-b pb-1 text-gray-900">
          {legendData.title || 'Legend'}
        </h4>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {legendData.items?.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="flex-shrink-0 rounded-sm"
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: item.color,
                  border: `1px solid ${item.outlineColor || item.color}`,
                  borderRadius: item.shape === 'circle' ? '50%' : '2px'
                }}
              />
              <span className="text-xs text-gray-700 flex-1 truncate" title={item.label}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default LegendPopover;
