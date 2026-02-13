// Jest manual mock for @anthropic-ai/sdk
// Provides a stub Anthropic client that captures the latest call arguments so tests can inspect them

export interface MessageCreateArgs {
  system?: string;
  messages?: Array<{ role: string; content: string }>;
  [key: string]: any;
}

let lastArgs: MessageCreateArgs | null = null;

export function __getLastCreateArgs(): MessageCreateArgs | null {
  return lastArgs;
}

export class Anthropic {
  constructor(_config: any) {}

  public messages = {
    create: async (args: MessageCreateArgs) => {
      lastArgs = args;
      return {
        content: [
          { type: 'text', text: 'AI STUB RESPONSE' },
        ],
      };
    },
  };
} 