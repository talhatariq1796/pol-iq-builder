// types/agent.ts
export interface AgentResponse {
    response: string;
    data?: __esri.Graphic[];
    statistics?: Record<string, number>;
    error?: string;
  }