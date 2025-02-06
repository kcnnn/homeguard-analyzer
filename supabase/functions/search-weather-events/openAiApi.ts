import { WeatherEvent } from './types.ts';

const TIMEOUT_DURATION = 30000; // 30 seconds
const MAX_TOKENS = 1000; // Increased token limit for more detailed responses

const createSystemPrompt = () => `You are a weather research assistant specializing in finding historical hail and windstorm events. 
Your task is to search for and report any hail or severe wind events that occurred at or near the specified location during the given time period.
You must return events in the exact format specified.
For each event found:
- Include the specific date in YYYY-MM-DD format
- For hail events, include hail sizes when available
- For wind events, include wind speeds when available
- Include any reported damage
- Be specific about locations
- Type must be either 'hail' or 'wind'
You must respond with properly formatted JSON only.`;

const createUserPrompt = (location: string, startDate: string, endDate: string) => 
  `Search for any hail or severe wind events that occurred at or near ${location} between ${startDate} and ${endDate}.
  You must return the results in this exact JSON format:
  {
    "events": [
      {
        "date": "YYYY-MM-DD",
        "type": "hail",
        "details": "Detailed description including sizes and damage",
        "source": "Local Weather Report",
        "sourceUrl": "https://example.com/event"
      }
    ]
  }
  The type field must be either "hail" or "wind". The date must be in YYYY-MM-DD format.
  If no events are found, return an empty events array.`;

const createFetchOptions = (openAIApiKey: string, location: string, startDate: string, endDate: string, signal: AbortSignal) => ({
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openAIApiKey}`,
    'Content-Type': 'application/json',
  },
  signal,
  body: JSON.stringify({
    model: 'gpt-4o',
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

  // Ensure date is in YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(event.date)) {
    console.warn('Invalid date format:', event.date);
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
    console.log('Parsing OpenAI response:', content);
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

    const events = parseOpenAIResponse(data.choices[0].message.content);
    console.log('Parsed events:', events);
    return events;
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