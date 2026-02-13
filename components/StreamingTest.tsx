import React, { useState } from 'react';
import StreamingText from './StreamingText';

const StreamingTest: React.FC = () => {
  const [testContent, setTestContent] = useState('');

  const sampleTexts = [
    "This is a test of the streaming text functionality. It should appear character by character with a typing effect.",
    "Here's another sample text to test the streaming effect. The text will appear gradually, simulating a real-time typing experience.",
    "Short test.",
    "This is a longer text that demonstrates how the streaming effect works with different content lengths. It includes multiple sentences and should provide a good test of the functionality."
  ];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">Streaming Text Test</h2>
      
      <div className="space-y-2">
        <button 
          onClick={() => setTestContent(sampleTexts[0])}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Test 1
        </button>
        <button 
          onClick={() => setTestContent(sampleTexts[1])}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm ml-2"
        >
          Test 2
        </button>
        <button 
          onClick={() => setTestContent(sampleTexts[2])}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm ml-2"
        >
          Test 3
        </button>
        <button 
          onClick={() => setTestContent(sampleTexts[3])}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm ml-2"
        >
          Test 4
        </button>
        <button 
          onClick={() => setTestContent('')}
          className="px-3 py-1 bg-gray-500 text-white rounded text-sm ml-2"
        >
          Clear
        </button>
      </div>

      {testContent && (
        <div className="p-4 border rounded-lg bg-gray-50">
          <h3 className="font-semibold mb-2">Streaming Result:</h3>
          <StreamingText 
            content={testContent}
            speed={30}
            className="text-sm leading-relaxed"
          />
        </div>
      )}
    </div>
  );
};

export default StreamingTest; 