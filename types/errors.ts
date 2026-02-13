// src/types/errors.ts

export class AIError extends Error {
    constructor(message: string, public cause?: Error) {
      super(message);
      this.name = 'AIError';
    }
  }
  
  export class ModelError extends AIError {
    constructor(message: string) {
      super(message);
      this.name = 'ModelError';
    }
  }
  
  export class RateLimitError extends AIError {
    constructor(message: string) {
      super(message);
      this.name = 'RateLimitError';
    }
  }
  
  export class TokenLimitError extends AIError {
    constructor(message: string) {
      super(message);
      this.name = 'TokenLimitError';
    }
  }
  
  export class ValidationError extends AIError {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  
  export class TransformationError extends AIError {
    constructor(message: string) {
      super(message);
      this.name = 'TransformationError';
    }
  }