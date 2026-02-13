import React, { useState, useEffect, useRef } from 'react';

interface StreamingTextProps {
  content: string;
  speed?: number; // milliseconds per character
  onComplete?: () => void;
  onStart?: () => void;
  className?: string;
}

const StreamingText: React.FC<StreamingTextProps> = ({ 
  content, 
  speed = 30, 
  onComplete, 
  onStart,
  className = "" 
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset when content changes
    setDisplayedText('');
    setIsComplete(false);
    setHasStarted(false);
    
    if (!content) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    let currentIndex = 0;
    
    const streamNextChar = () => {
      if (currentIndex === 0 && !hasStarted) {
        setHasStarted(true);
        onStart?.();
      }
      
      if (currentIndex < content.length) {
        setDisplayedText(content.slice(0, currentIndex + 1));
        currentIndex++;
        timeoutRef.current = setTimeout(streamNextChar, speed);
      } else {
        setIsComplete(true);
        onComplete?.();
      }
    };

    // Start streaming
    timeoutRef.current = setTimeout(streamNextChar, speed);

    // Cleanup on unmount or content change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, speed, onComplete, onStart, hasStarted]);

  return (
    <div className={className}>
      {displayedText}
      {!isComplete && <span className="animate-pulse">|</span>}
    </div>
  );
};

export default StreamingText; 