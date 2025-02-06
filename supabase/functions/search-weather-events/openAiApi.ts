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

  console.log('Starting OpenAI search for weather events');
  console.log('Location:', location);
  console.log('Time period:', { startDate, endDate });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_DURATION);

  try {
    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a weather research assistant. Search for and report hail or severe wind events near ${location} between ${startDate} and ${endDate}. Include dates, sizes for hail, speeds for wind, and any damage reports. Return only JSON in this format: {"events": [{"date": "YYYY-MM-DD", "type": "hail|wind", "details": "description", "source": "optional source", "sourceUrl": "optional url"}]}`
            }
          ],
          temperature: 0.7,
          tools: [{ "type": "retrieval" }],
          tool_choice: "auto"
        })
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      const errorText = await response.text();
      console.error('Response:', errorText);
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