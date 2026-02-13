/**
 * useKeyboardShortcuts Hook
 *
 * Provides keyboard shortcut handling for the AI-native interface.
 * Supports command key combinations, prevents conflicts, and provides
 * a help overlay for discoverability.
 *
 * Features:
 * - Global and scoped shortcuts
 * - Modifier key support (Cmd/Ctrl, Shift, Alt)
 * - Conflict prevention with input fields
 * - Help overlay generation
 */

import { useEffect, useCallback, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface KeyboardShortcut {
  key: string;
  modifiers?: {
    cmd?: boolean;    // Cmd on Mac, Ctrl on Windows
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
  };
  description: string;
  action: () => void;
  scope?: string;
  preventDefault?: boolean;
  allowInInput?: boolean;
}

export interface ShortcutGroup {
  name: string;
  shortcuts: KeyboardShortcut[];
}

export interface UseKeyboardShortcutsConfig {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  scope?: string;
}

export interface UseKeyboardShortcutsReturn {
  isHelpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  toggleHelp: () => void;
  getShortcutLabel: (shortcut: KeyboardShortcut) => string;
  shortcutGroups: ShortcutGroup[];
}

// ============================================================================
// Constants
// ============================================================================

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const MODIFIER_SYMBOLS = {
  cmd: isMac ? '⌘' : 'Ctrl',
  ctrl: isMac ? '⌃' : 'Ctrl',
  shift: '⇧',
  alt: isMac ? '⌥' : 'Alt',
};

const KEY_SYMBOLS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: '↵',
  Escape: 'Esc',
  Backspace: '⌫',
  Delete: '⌦',
  Tab: '⇥',
  ' ': 'Space',
};

// ============================================================================
// Default Shortcuts for Political Analysis
// ============================================================================

export const DEFAULT_POLITICAL_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  {
    key: '/',
    description: 'Focus search/input',
    action: () => {},
    scope: 'navigation',
    allowInInput: false,
  },
  {
    key: 'Escape',
    description: 'Close panel / Clear selection',
    action: () => {},
    scope: 'navigation',
    allowInInput: true,
  },
  {
    key: '?',
    modifiers: { shift: true },
    description: 'Show keyboard shortcuts',
    action: () => {},
    scope: 'navigation',
  },

  // Analysis actions
  {
    key: 'f',
    modifiers: { cmd: true },
    description: 'Find target precincts',
    action: () => {},
    scope: 'analysis',
    preventDefault: true,
  },
  {
    key: 'c',
    modifiers: { cmd: true, shift: true },
    description: 'Compare selected areas',
    action: () => {},
    scope: 'analysis',
    preventDefault: true,
  },
  {
    key: 's',
    modifiers: { cmd: true },
    description: 'Save current segment',
    action: () => {},
    scope: 'analysis',
    preventDefault: true,
  },
  {
    key: 'e',
    modifiers: { cmd: true },
    description: 'Export data',
    action: () => {},
    scope: 'analysis',
    preventDefault: true,
  },

  // Map controls
  {
    key: '+',
    description: 'Zoom in',
    action: () => {},
    scope: 'map',
  },
  {
    key: '-',
    description: 'Zoom out',
    action: () => {},
    scope: 'map',
  },
  {
    key: '0',
    modifiers: { cmd: true },
    description: 'Reset map view',
    action: () => {},
    scope: 'map',
    preventDefault: true,
  },
  {
    key: 'h',
    description: 'Toggle heatmap',
    action: () => {},
    scope: 'map',
  },

  // Session
  {
    key: 'n',
    modifiers: { cmd: true },
    description: 'New session',
    action: () => {},
    scope: 'session',
    preventDefault: true,
  },
  {
    key: 'r',
    modifiers: { cmd: true },
    description: 'Generate report',
    action: () => {},
    scope: 'session',
    preventDefault: true,
  },
];

// ============================================================================
// Hook Implementation
// ============================================================================

export function useKeyboardShortcuts(
  config: UseKeyboardShortcutsConfig
): UseKeyboardShortcutsReturn {
  const { shortcuts, enabled = true, scope } = config;
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  // Generate shortcut label
  const getShortcutLabel = useCallback((shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];

    if (shortcut.modifiers) {
      if (shortcut.modifiers.ctrl) parts.push(MODIFIER_SYMBOLS.ctrl);
      if (shortcut.modifiers.cmd) parts.push(MODIFIER_SYMBOLS.cmd);
      if (shortcut.modifiers.alt) parts.push(MODIFIER_SYMBOLS.alt);
      if (shortcut.modifiers.shift) parts.push(MODIFIER_SYMBOLS.shift);
    }

    const keyDisplay = KEY_SYMBOLS[shortcut.key] || shortcut.key.toUpperCase();
    parts.push(keyDisplay);

    return parts.join(isMac ? '' : '+');
  }, []);

  // Group shortcuts by scope
  const shortcutGroups = useCallback((): ShortcutGroup[] => {
    const groups = new Map<string, KeyboardShortcut[]>();

    shortcutsRef.current.forEach(shortcut => {
      const groupName = shortcut.scope || 'general';
      const existing = groups.get(groupName) || [];
      groups.set(groupName, [...existing, shortcut]);
    });

    return Array.from(groups.entries()).map(([name, shortcuts]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      shortcuts,
    }));
  }, [])();

  // Check if event matches shortcut
  const matchesShortcut = useCallback(
    (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
      // Check key
      if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
        return false;
      }

      // Check modifiers
      const mods = shortcut.modifiers || {};

      // Cmd/Ctrl handling
      const cmdPressed = isMac ? event.metaKey : event.ctrlKey;
      if (mods.cmd && !cmdPressed) return false;
      if (!mods.cmd && cmdPressed && !mods.ctrl) return false;

      // Other modifiers
      if (mods.ctrl && !event.ctrlKey) return false;
      if (mods.shift && !event.shiftKey) return false;
      if (mods.alt && !event.altKey) return false;

      // Check inverse (modifier pressed but not expected)
      if (!mods.shift && event.shiftKey && shortcut.key.length === 1) return false;
      if (!mods.alt && event.altKey) return false;

      return true;
    },
    []
  );

  // Check if focus is in input field
  const isInputFocused = useCallback((): boolean => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return true;
    }

    if (activeElement.getAttribute('contenteditable') === 'true') {
      return true;
    }

    return false;
  }, []);

  // Handle keydown
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Find matching shortcut
      for (const shortcut of shortcutsRef.current) {
        // Check scope
        if (scope && shortcut.scope && shortcut.scope !== scope) {
          continue;
        }

        // Check if matches
        if (!matchesShortcut(event, shortcut)) {
          continue;
        }

        // Check if we should skip due to input focus
        if (isInputFocused() && !shortcut.allowInInput) {
          continue;
        }

        // Execute action
        if (shortcut.preventDefault) {
          event.preventDefault();
        }

        shortcut.action();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, scope, matchesShortcut, isInputFocused]);

  // Help modal controls
  const openHelp = useCallback(() => setIsHelpOpen(true), []);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);
  const toggleHelp = useCallback(() => setIsHelpOpen((prev: boolean) => !prev), []);

  return {
    isHelpOpen,
    openHelp,
    closeHelp,
    toggleHelp,
    getShortcutLabel,
    shortcutGroups,
  };
}

// ============================================================================
// Keyboard Shortcuts Help Modal Component
// ============================================================================

export interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ShortcutGroup[];
  getLabel: (shortcut: KeyboardShortcut) => string;
}

// This can be used to render a help modal
export function renderShortcutGroups(
  groups: ShortcutGroup[],
  getLabel: (shortcut: KeyboardShortcut) => string
): React.ReactNode {
  // This is just a helper - actual component should be in a .tsx file
  return null;
}

export default useKeyboardShortcuts;
