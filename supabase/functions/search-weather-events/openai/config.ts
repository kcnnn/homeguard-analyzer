import { OpenAIRequestOptions } from './types.ts';
import { createSystemPrompt, createUserPrompt } from './prompts.ts';

const TIMEOUT_DURATION = 30000; // 30 seconds
const MAX_TOKENS = 1000;

export const createFetchOptions = (openAIApiKey: string, options: OpenAIRequestOptions) => ({
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openAIApiKey}`,
    'Content-Type': 'application/json',
  },
  signal: options.signal,
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: createSystemPrompt() },
      { role: 'user', content: createUserPrompt(options.location, options.startDate, options.endDate) }
    ],
    temperature: 0.7,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" },
    tools: [{ type: "retrieval" }],
    tool_choice: "auto"
  }),
});

export { TIMEOUT_DURATION };