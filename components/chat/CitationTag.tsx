/**
 * CitationTag Component
 *
 * Renders inline citation tags with tooltips showing source information.
 * Used in AI chat responses to indicate data sources.
 */

import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CITATION_DEFINITIONS } from '@/lib/utils/citation-parser';

interface CitationTagProps {
  citationKey: string;
  className?: string;
}

// Color schemes for different citation types
const CITATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Data source citations
  '[ELECTIONS]': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  '[SCORES]': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  '[TARGETING]': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  '[DEMOGRAPHICS]': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  '[METHODOLOGY]': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  // Current intelligence citations
  '[POLL]': { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' },
  '[NEWS]': { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
  '[ANALYSIS]': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  '[OFFICIAL]': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  '[UPCOMING]': { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300' },
};

const DEFAULT_COLOR = { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };

export function CitationTag({ citationKey, className }: CitationTagProps) {
  const colors = CITATION_COLORS[citationKey] || DEFAULT_COLOR;
  const definition = CITATION_DEFINITIONS[citationKey];
  const label = citationKey.replace(/[\[\]]/g, '');

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded',
              'text-[10px] font-medium border',
              'cursor-help select-none transition-colors',
              'hover:opacity-80',
              colors.bg,
              colors.text,
              colors.border,
              className
            )}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[280px] p-3 text-xs"
          sideOffset={4}
        >
          <div className="space-y-1">
            <div className="font-semibold text-foreground">{label}</div>
            {definition && (
              <>
                <div className="text-muted-foreground">{definition.description}</div>
                <div className="text-[10px] text-muted-foreground/70 pt-1 border-t">
                  Source: {definition.source}
                </div>
              </>
            )}
            {!definition && (
              <div className="text-muted-foreground">Data source reference</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Parse text and render with CitationTags inline
 */
interface CitationTextProps {
  text: string;
  className?: string;
}

export function CitationText({ text, className }: CitationTextProps) {
  // Pattern to match citation tags
  const parts = text.split(/(\[[A-Z_]+\])/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check if this part is a citation tag
        if (/^\[[A-Z_]+\]$/.test(part)) {
          return <CitationTag key={index} citationKey={part} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

export default CitationTag;
