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
            Focus on events that would be relevant for insurance claims, such as:
            - Hail of any size
            - Wind damage or severe winds (typically over 50mph)
            - Storms that caused property damage
            You should be thorough in your search and include any events that could have affected the specified property.
            Format your response as a JSON object with an 'events' array containing detailed event information.`
          },
          {
            role: 'user',
            content: `Search for hail and severe wind events that occurred at or near ${location} between ${startDate} and ${endDate}. 
            Include specific details about damage, hail size, or wind speeds if available.
            Be thorough and include any events that could have affected this specific property.
            Return the results in this JSON format:
            {
              "events": [
                {
                  "date": "YYYY-MM-DD",
                  "type": "hail" or "wind",
                  "details": "Detailed description of the event",
                  "source": "AI Weather Research"
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
          source: 'AI Weather Research',
          sourceUrl: undefined
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