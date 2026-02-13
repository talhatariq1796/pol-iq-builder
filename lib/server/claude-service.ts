import { LayerConfig } from '@/types/layers';
import Anthropic from '@anthropic-ai/sdk';

interface AnalysisRequest {
  prompt: string;
  context: any;
}

interface AnalysisResponse {
  analysis: {
    summary: string;
    confidence: number;
    reasoning?: string;
  };
}

export class ClaudeAIAnalysisService {
  private client: Anthropic;
  private maxRetries: number = 3;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('API key is required for ClaudeAIAnalysisService');
    }
    this.client = new Anthropic({
      apiKey
    });
  }

  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const message = await this.client.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Analyze the following request and provide a JSON response:
            ${request.prompt}
            
            Context:
            ${JSON.stringify(request.context, null, 2)}
            
            Ensure the response is valid JSON and includes 'summary' and 'confidence' fields.`
          }]
        });

        const content = message.content[0].type === 'text' 
          ? message.content[0].text 
          : '';
        
        if (!content) {
          throw new Error('No text content in response');
        }

        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON found in response');
          }
          
          const analysis = JSON.parse(jsonMatch[0]);
          
          return {
            analysis: {
              summary: analysis.summary || '',
              confidence: analysis.confidence || 0,
              reasoning: analysis.reasoning
            }
          };
        } catch (parseError) {
          console.error('Failed to parse Claude response:', parseError);
          throw new Error('Invalid response format from Claude');
        }
      } catch (error) {
        console.error(`Analysis attempt ${attempt + 1} failed:`, error);
        lastError = error as Error;
        
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Analysis failed after all retries');
  }

  setMaxRetries(retries: number): void {
    this.maxRetries = retries;
  }
} 