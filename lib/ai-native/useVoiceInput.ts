/**
 * useVoiceInput Hook
 *
 * Provides speech-to-text functionality using Web Speech API.
 * Supports continuous listening, interim results, and error handling.
 *
 * Features:
 * - Start/stop voice recognition
 * - Real-time transcription updates
 * - Language configuration
 * - Error handling with user-friendly messages
 * - Automatic stop after silence
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface VoiceInputState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  confidence: number;
}

export interface VoiceInputConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface UseVoiceInputReturn extends VoiceInputState {
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearTranscript: () => void;
  resetError: () => void;
}

// ============================================================================
// Speech Recognition Types (for TypeScript)
// ============================================================================

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<VoiceInputConfig> = {
  language: 'en-US',
  continuous: false,
  interimResults: true,
  maxAlternatives: 1,
  onResult: () => {},
  onError: () => {},
  onStart: () => {},
  onEnd: () => {},
};

const ERROR_MESSAGES: Record<string, string> = {
  'no-speech': 'No speech detected. Please try again.',
  'audio-capture': 'No microphone found. Please check your device.',
  'not-allowed': 'Microphone access denied. Please enable microphone permissions.',
  'network': 'Network error. Please check your connection.',
  'aborted': 'Voice input was cancelled.',
  'language-not-supported': 'Language not supported.',
  'service-not-allowed': 'Speech recognition service not allowed.',
  'bad-grammar': 'Grammar error in speech recognition.',
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useVoiceInput(config: VoiceInputConfig = {}): UseVoiceInputReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    confidence: 0,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isInitializedRef = useRef(false);

  // Check browser support
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isSupported = !!SpeechRecognition;

    setState((prev: VoiceInputState) => ({ ...prev, isSupported }));

    if (isSupported && !isInitializedRef.current) {
      const recognition = new SpeechRecognition();

      recognition.continuous = mergedConfig.continuous;
      recognition.interimResults = mergedConfig.interimResults;
      recognition.lang = mergedConfig.language;
      recognition.maxAlternatives = mergedConfig.maxAlternatives;

      recognition.onstart = () => {
        setState((prev: VoiceInputState) => ({ ...prev, isListening: true, error: null }));
        mergedConfig.onStart();
      };

      recognition.onend = () => {
        setState((prev: VoiceInputState) => ({ ...prev, isListening: false }));
        mergedConfig.onEnd();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        let confidence = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;

          if (result.isFinal) {
            finalTranscript += text;
            confidence = result[0].confidence;
          } else {
            interimTranscript += text;
          }
        }

        setState((prev: VoiceInputState) => ({
          ...prev,
          transcript: prev.transcript + finalTranscript,
          interimTranscript,
          confidence,
        }));

        if (finalTranscript) {
          mergedConfig.onResult(finalTranscript, true);
        } else if (interimTranscript) {
          mergedConfig.onResult(interimTranscript, false);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const errorMessage = ERROR_MESSAGES[event.error] || `Voice input error: ${event.error}`;
        setState((prev: VoiceInputState) => ({ ...prev, error: errorMessage, isListening: false }));
        mergedConfig.onError(errorMessage);
      };

      recognitionRef.current = recognition;
      isInitializedRef.current = true;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Update config when it changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = mergedConfig.language;
      recognitionRef.current.continuous = mergedConfig.continuous;
      recognitionRef.current.interimResults = mergedConfig.interimResults;
    }
  }, [mergedConfig.language, mergedConfig.continuous, mergedConfig.interimResults]);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setState((prev: VoiceInputState) => ({
        ...prev,
        error: 'Speech recognition not supported in this browser.',
      }));
      return;
    }

    try {
      // Clear previous transcript when starting new session
      setState((prev: VoiceInputState) => ({
        ...prev,
        transcript: '',
        interimTranscript: '',
        error: null,
      }));

      recognitionRef.current.start();
    } catch (error) {
      // Handle "recognition already started" error
      if (error instanceof Error && error.message.includes('already started')) {
        recognitionRef.current.stop();
        setTimeout(() => {
          recognitionRef.current?.start();
        }, 100);
      } else {
        setState((prev: VoiceInputState) => ({
          ...prev,
          error: 'Failed to start voice recognition.',
        }));
      }
    }
  }, []);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setState((prev: VoiceInputState) => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
    }));
  }, []);

  // Reset error
  const resetError = useCallback(() => {
    setState((prev: VoiceInputState) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    resetError,
  };
}

// ============================================================================
// Voice Input Button Component
// ============================================================================

export interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// This is a utility function to create a ready-to-use voice button
export function createVoiceInputProps(config: VoiceInputConfig = {}) {
  return {
    hook: () => useVoiceInput(config),
  };
}

export default useVoiceInput;
