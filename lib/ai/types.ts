/**
 * AI Tool Action Types
 *
 * Defines action response interfaces for two-way sync between AI and tool pages.
 * AI can trigger UI actions when responding to queries.
 */

/**
 * Supported action types for tool pages
 */
export type AIActionType =
  | 'setComparison'        // Set comparison pane entities
  | 'applyFilter'           // Apply filters (segments, donor, etc.)
  | 'showOnMap'             // Show results on map
  | 'createSegment'         // Create new segment
  | 'navigateTo'            // Navigate to a page
  | 'exportData'            // Export data
  | 'highlightEntity';      // Highlight entity on page

/**
 * AI action payload - passed to page handlers
 */
export interface AIAction {
  type: AIActionType;
  payload: Record<string, unknown>;
}

/**
 * AI response with optional actions
 */
export interface AIActionResponse {
  message: string;
  actions?: AIAction[];
}

/**
 * Parse AI response for embedded action directives
 * Format: [ACTION:type:payload_json]
 */
export function parseActionFromResponse(response: string): AIActionResponse {
  const actionRegex = /\[ACTION:(\w+):(\{[^}]+\})\]/g;
  const actions: AIAction[] = [];
  let cleanMessage = response;

  let match;
  while ((match = actionRegex.exec(response)) !== null) {
    const [fullMatch, type, payloadJson] = match;
    try {
      const payload = JSON.parse(payloadJson);
      actions.push({
        type: type as AIActionType,
        payload,
      });
      // Remove action directive from message
      cleanMessage = cleanMessage.replace(fullMatch, '');
    } catch (error) {
      console.error('[AI Action Parser] Failed to parse action:', error);
    }
  }

  return {
    message: cleanMessage.trim(),
    actions: actions.length > 0 ? actions : undefined,
  };
}
