import { WeatherEvent } from './types.ts';

export async function searchOpenAIEvents(
  location: string,
  startDate: string,
  endDate: string
): Promise<WeatherEvent[]> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  try {
    console.log('Searching OpenAI for weather events at location:', location);
    console.log('Time period:', { startDate, endDate });
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a weather research assistant specializing in finding historical hail and windstorm events. 
            Your task is to search for and report any hail or severe wind events that occurred at or near the specified location during the given time period.
            You should be thorough and include any events that could have affected the specified property.
            When reporting events:
            - Include specific dates
            - Mention hail sizes when available
            - Include wind speeds for wind events
            - Reference any reported damage
            - Be specific about locations
            Format your response as a JSON object with an 'events' array.`
          },
          {
            role: 'user',
            content: `Tell me about any hail or severe wind events that occurred at or near ${location} between ${startDate} and ${endDate}.
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
            }`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI API raw response:', JSON.stringify(data, null, 2));

    if (!data.choices?.[0]?.message?.content) {
      console.log('No content in OpenAI response');
      return [];
    }

    const content = data.choices[0].message.content;
    console.log('Parsing OpenAI content:', content);

    try {
      const parsed = JSON.parse(content);
      if (!parsed.events || !Array.isArray(parsed.events)) {
        console.log('Invalid events array in OpenAI response');
        return [];
      }

      // Validate and transform events
      const validEvents = parsed.events
        .filter(event => event.date && (event.type === 'hail' || event.type === 'wind') && event.details)
        .map(event => ({
          date: event.date,
          type: event.type as 'hail' | 'wind',
          details: event.details,
          source: event.source || 'Weather History Database',
          sourceUrl: event.sourceUrl || undefined
        }));

      console.log('Processed OpenAI events:', validEvents);
      return validEvents;
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      return [];
    }
  } catch (error) {
    console.error('Error in OpenAI search:', error);
    return [];
  }
}