import { WeatherEvent } from './types.ts';
import { OpenAIRequestOptions } from './openai/types.ts';
import { parseOpenAIResponse } from './openai/validation.ts';
import { TIMEOUT_DURATION, createFetchOptions } from './openai/config.ts';

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

  console.log('Starting OpenAI search for weather events with web browsing enabled');
  console.log('Location:', location);
  console.log('Time period:', { startDate, endDate });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_DURATION);

  try {
    const options: OpenAIRequestOptions = {
      location,
      startDate,
      endDate,
      signal: controller.signal
    };

    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: 'You are a weather research assistant. Search the web for hail and windstorm events at the specified location and time period. Be thorough in your search and include all relevant details about damage and severity.' 
            },
            { 
              role: 'user', 
              content: `Find any hail or severe wind events near ${location} between ${startDate} and ${endDate}. Include specific dates, damage details, and source URLs when available.` 
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
          tools: [{ type: "retrieval" }],
          tool_choice: "auto"
        })
      }
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