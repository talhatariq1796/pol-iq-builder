'use client';

/**
 * CitationLink - Clickable citation with tooltip
 * Phase 14 Enhanced Implementation
 *
 * Renders inline citation markers as interactive links
 * with rich tooltips showing source metadata.
 */

import React, { useState, useMemo } from 'react';
import type { CitationKey, Citation } from '@/lib/ai/confidence';
import { CITATION_REGISTRY, getCitationService } from '@/lib/ai/confidence';

interface CitationLinkProps {
  citationKey: CitationKey;
  showBrackets?: boolean;
  compact?: boolean;
  className?: string;
  onClick?: (citation: Citation) => void;
}

export function CitationLink({
  citationKey,
  showBrackets = true,
  compact = false,
  className = '',
  onClick,
}: CitationLinkProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const citation = CITATION_REGISTRY[citationKey];

  if (!citation) {
    return <span className="text-red-500">[UNKNOWN]</span>;
  }

  const reliabilityPct = Math.round(citation.reliability * 100);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) {
      onClick(citation);
    } else if (citation.url) {
      window.open(citation.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      {/* Citation link */}
      <button
        onClick={handleClick}
        className={`
          font-mono text-xs font-semibold rounded px-1 py-0.5
          transition-colors cursor-pointer
          ${citation.url ? 'hover:underline' : ''}
          ${compact ? 'text-slate-500 hover:text-slate-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}
        `}
        title={citation.title}
      >
        {showBrackets ? `[${citationKey}]` : citationKey}
      </button>

      {/* Rich tooltip */}
      {isTooltipVisible && !compact && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 z-50">
          <div className="bg-slate-900 text-white text-xs rounded-lg shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-slate-800 px-3 py-2 border-b border-slate-700">
              <div className="font-semibold text-sm">{citation.title}</div>
              <div className="text-slate-400 text-xs">{citation.source}</div>
            </div>

            {/* Content */}
            <div className="px-3 py-2 space-y-2">
              {citation.description && (
                <p className="text-slate-300">{citation.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                {citation.vintage && (
                  <div>
                    <span className="text-slate-500">📅 Vintage:</span>
                    <span className="text-slate-300 ml-1">{citation.vintage}</span>
                  </div>
                )}
                {citation.coverage && (
                  <div>
                    <span className="text-slate-500">🗺️ Coverage:</span>
                    <span className="text-slate-300 ml-1">{citation.coverage}</span>
                  </div>
                )}
              </div>

              {/* Reliability meter */}
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Reliability</span>
                  <span
                    className={`font-medium ${
                      reliabilityPct >= 80
                        ? 'text-green-400'
                        : reliabilityPct >= 60
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  >
                    {reliabilityPct}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      reliabilityPct >= 80
                        ? 'bg-green-500'
                        : reliabilityPct >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${reliabilityPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer links */}
            <div className="px-3 py-2 bg-slate-800/50 border-t border-slate-700 flex gap-3">
              {citation.url && (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-xs"
                >
                  View source ↗
                </a>
              )}
              {citation.methodology && (
                <a
                  href={citation.methodology}
                  className="text-slate-400 hover:text-slate-300 text-xs"
                >
                  Methodology →
                </a>
              )}
            </div>

            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * CitationText - Parses and renders text with inline citations
 */
interface CitationTextProps {
  text: string;
  className?: string;
  compact?: boolean;
  onCitationClick?: (citation: Citation) => void;
}

export function CitationText({
  text,
  className = '',
  compact = false,
  onCitationClick,
}: CitationTextProps) {
  const citationService = useMemo(() => getCitationService(), []);

  // Parse the text to find citations
  const parsedContent = useMemo(() => {
    const parts: (string | { type: 'citation'; key: CitationKey })[] = [];
    let lastIndex = 0;
    const pattern = /\[([A-Z_]+)\]/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const key = match[1];

      // Add text before the citation
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add citation if valid
      if (citationService.isValidCitationKey(key)) {
        parts.push({ type: 'citation', key: key as CitationKey });
      } else {
        // Not a valid citation, keep as text
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }, [text, citationService]);

  return (
    <span className={className}>
      {parsedContent.map((part, index) => {
        if (typeof part === 'string') {
          return <span key={index}>{part}</span>;
        }
        return (
          <CitationLink
            key={index}
            citationKey={part.key}
            compact={compact}
            onClick={onCitationClick}
          />
        );
      })}
    </span>
  );
}

/**
 * SourcesSection - Formatted sources list for AI responses
 */
interface SourcesSectionProps {
  citationKeys: CitationKey[];
  title?: string;
  className?: string;
}

export function SourcesSection({
  citationKeys,
  title = '📚 Sources',
  className = '',
}: SourcesSectionProps) {
  if (citationKeys.length === 0) return null;

  return (
    <div className={`border-t border-slate-200 pt-3 mt-3 ${className}`}>
      <h4 className="text-sm font-semibold text-slate-600 mb-2">{title}</h4>
      <ul className="space-y-1.5">
        {citationKeys.map((key) => {
          const citation = CITATION_REGISTRY[key];
          if (!citation) return null;

          return (
            <li key={key} className="flex items-start gap-2 text-xs">
              <CitationLink citationKey={key} showBrackets={true} />
              <span className="text-slate-600">
                {citation.title}
                {citation.source && (
                  <span className="text-slate-400"> — {citation.source}</span>
                )}
                {citation.vintage && (
                  <span className="text-slate-400"> ({citation.vintage})</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default CitationLink;
