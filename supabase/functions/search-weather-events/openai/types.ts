export interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content: string;
    };
  }>;
}

export interface OpenAIRequestOptions {
  location: string;
  startDate: string;
  endDate: string;
  signal: AbortSignal;
}