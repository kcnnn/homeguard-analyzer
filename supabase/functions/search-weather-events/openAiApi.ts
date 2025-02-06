import { WeatherEvent } from './types.ts';

export async function searchOpenAIEvents(
  location: string,
  startDate: string,
  endDate: string
): Promise<WeatherEvent[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a weather researcher with access to internet search. Search for verified hail and severe wind events that occurred at or near the specified location. Include:
            - Exact dates
            - Specific hail sizes and wind speeds
            - Verified reports from news stations and weather services
            - Events within a 10-mile radius
            - Source URLs for verification
            Only return events that you can find through internet search with specific, verifiable details.`
          },
          {
            role: 'user',
            content: `Search for verified hail and severe wind events that occurred at or near ${location} between ${startDate} and ${endDate}. Return the response in this exact JSON format:
            {
              "events": [
                {
                  "date": "YYYY-MM-DD",
                  "type": "hail"|"wind",
                  "details": "Detailed description including measurements and specific locations",
                  "source": "Name of the source (e.g. KVUE News, Weather Service)",
                  "sourceUrl": "URL to the source"
                }
              ]
            }`
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    console.log('Raw OpenAI Response:', JSON.stringify(data, null, 2));

    if (data.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content;
      console.log('OpenAI content:', content);
      
      const parsed = JSON.parse(content);
      console.log('Parsed OpenAI response:', parsed);
      
      if (parsed.events && Array.isArray(parsed.events)) {
        return parsed.events;
      }
    }

    console.log('No events found in OpenAI response');
    return [];
  } catch (error) {
    console.error('Error in OpenAI search:', error);
    return [];
  }
}