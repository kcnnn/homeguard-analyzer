import { WeatherEvent } from './types.ts';

const TIMEOUT_DURATION = 30000; // 30 seconds
const MAX_TOKENS = 500;

const createSystemPrompt = () => `You are a weather research assistant specializing in finding historical hail and windstorm events. 
Your task is to search for and report any hail or severe wind events that occurred at or near the specified location during the given time period.
You should be thorough but respond quickly.
When reporting events:
- Include specific dates
- Mention hail sizes when available
- Include wind speeds for wind events
- Reference any reported damage
- Be specific about locations
Format your response as a JSON object with an 'events' array.`;

const createUserPrompt = (location: string, startDate: string, endDate: string) => 
  `Tell me about any hail or severe wind events that occurred at or near ${location} between ${startDate} and ${endDate}.
  Return the results in this JSON format:
  {
    "events": [
      {
        "date": "YYYY-MM-DD",
        "type": "hail" or "wind",
        "details": "Detailed description including sizes, speeds, and damage",
        "source": "STORMERSITE.COM",
        "sourceUrl": "https://stormersite.com/event/123"
      }
    ]
  }`;

const createFetchOptions = (openAIApiKey: string, location: string, startDate: string, endDate: string, signal: AbortSignal) => ({
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openAIApiKey}`,
    'Content-Type': 'application/json',
  },
  signal,
  body: JSON.stringify({
    model: 'gpt-4o-mini', // Fixed: Changed from 'gpt-4o-mini' to the correct model name
    messages: [
      { role: 'system', content: createSystemPrompt() },
      { role: 'user', content: createUserPrompt(location, startDate, endDate) }
    ],
    temperature: 0.7,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" }
  }),
});

const validateAndParseEvent = (event: any): WeatherEvent | null => {
  if (!event.date || !event.type || !event.details) {
    console.warn('Invalid event structure:', event);
    return null;
  }

  if (event.type !== 'hail' && event.type !== 'wind') {
    console.warn('Invalid event type:', event.type);
    return null;
  }

  return {
    date: event.date,
    type: event.type as 'hail' | 'wind',
    details: event.details,
    source: event.source || undefined,
    sourceUrl: event.sourceUrl || undefined
  };
};

const parseOpenAIResponse = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    if (!parsed.events || !Array.isArray(parsed.events)) {
      console.warn('Invalid response structure:', parsed);
      return [];
    }

    return parsed.events
      .map(validateAndParseEvent)
      .filter((event): event is WeatherEvent => event !== null);
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    return [];
  }
};

export async function searchOpenAIEvents(
  location: string,
  startDate: string,
  endDate: string
): Promise<WeatherEvent[]> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    console.error('OpenAI API key not configured');
    return [];
  }

  console.log('Starting OpenAI search for weather events');
  console.log('Location:', location);
  console.log('Time period:', { startDate, endDate });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_DURATION);

  try {
    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      createFetchOptions(openAIApiKey, location, startDate, endDate, controller.signal)
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      console.error('Response:', await response.text());
      return [];
    }

    const data = await response.json();
    console.log('OpenAI API raw response:', JSON.stringify(data, null, 2));

    if (!data.choices?.[0]?.message?.content) {
      console.log('No content in OpenAI response');
      return [];
    }

    return parseOpenAIResponse(data.choices[0].message.content);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('OpenAI request timed out after 30 seconds');
    } else {
      console.error('Error in OpenAI search:', error);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}