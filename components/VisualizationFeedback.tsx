import React, { useState } from 'react';

interface FeedbackProps {
  visualizationType: string;
  onFeedback: (feedback: {
    visualizationType: string;
    score: number;
    comments: string;
    context: {
      query: string;
      layerCount: number;
      timestamp: number;
    }
  }) => void;
  query: string;
  layerCount: number;
}

export const VisualizationFeedback: React.FC<FeedbackProps> = ({
  visualizationType,
  onFeedback,
  query,
  layerCount
}) => {
  const [score, setScore] = useState<number>(0);
  const [comments, setComments] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const handleSubmit = () => {
    onFeedback({
      visualizationType,
      score,
      comments,
      context: {
        query,
        layerCount,
        timestamp: Date.now()
      }
    });
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="visualization-feedback">
      <h3>How well did this visualization work?</h3>
      <div className="rating-container">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            className={`rating-button ${score === value ? 'selected' : ''}`}
            onClick={() => setScore(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <textarea
        placeholder="Additional comments (optional)"
        value={comments}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComments(e.target.value)}
      />
      <div className="button-container">
        <button onClick={handleSubmit}>Submit</button>
        <button onClick={() => setIsOpen(false)}>Skip</button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .visualization-feedback {
          position: fixed;
          bottom: 16px;
          right: 16px;
          background: white;
          padding: 12px;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          width: 240px;
          z-index: 1000;
        }

        h3 {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 13px;
          font-weight: 500;
        }

        .rating-container {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .rating-button {
          width: 28px;
          height: 28px;
          border-radius: 14px;
          border: 1.5px solid #ddd;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 11px;
        }

        .rating-button.selected {
          background: #33a852;
          color: white;
          border-color: #33a852;
        }

        textarea {
          width: 100%;
          height: 60px;
          margin-bottom: 10px;
          padding: 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
          resize: none;
          font-size: 11px;
        }

        .button-container {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        button {
          flex: 1;
          padding: 6px 12px;
          border-radius: 4px;
          border: none;
          background: #33a852;
          color: white;
          cursor: pointer;
          font-size: 11px;
        }

        button:last-child {
          background: #ddd;
        }

        button:hover {
          opacity: 0.9;
        }
      ` }} />
    </div>
  );
}; 