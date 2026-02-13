'use client';

import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatBarProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const ChatBar: React.FC<ChatBarProps> = ({ onSend, disabled = false, placeholder = 'Type a message…', className }) => {
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={`flex items-end gap-2 ${className || ''}`}>
      <textarea
        className="flex-1 resize-none theme-input placeholder:text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        rows={1}
        value={text}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <Button type="button" onClick={send} disabled={disabled || !text.trim()} size="icon" variant="default">
        {disabled ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
};

export default ChatBar; 