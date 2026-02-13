import { LocalChatMessage } from '@/types/index';
import { GeoProcessingStep } from '@/types/geospatial-chat-component';

export const getAriaLabelForMessage = (message: LocalChatMessage): string => {
  switch (message.type) {
    case 'user':
      return 'Your message';
    case 'error':
      return 'Error message';
    case 'ai':
      return 'AI response';
    default:
      return 'Message';
  }
};

export const getAriaLabelForProcessingStep = (step: GeoProcessingStep): string => {
  return `${step.message}: ${step.status}`;
};

export const getAriaLabelForZoomButton = (): string => {
  return 'Zoom to layer extent';
};

export const getAriaLabelForProcessingStatus = (): string => {
  return 'Processing your request';
};

export const getAriaLabelForProcessingSteps = (): string => {
  return 'Processing steps';
};

export const getAriaLabelForChatMessages = (): string => {
  return 'Chat messages';
};

export const handleKeyboardNavigation = (
  event: React.KeyboardEvent,
  callback: () => void
): void => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
};

export const isInteractiveElement = (target: HTMLElement): boolean => {
  return !!(
    target.closest('button') ||
    target.closest('a') ||
    target.closest('[role="button"]')
  );
}; 