import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const noaaApiKey = Deno.env.get('NOAA_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function searchNOAAEvents(location: string, startDate: string, endDate: string) {
  console.log('Starting NOAA search with params:', { location, startDate, endDate });
  
  try {
    // Format dates for NOAA API (YYYY-MM-DD)
    const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
    const formattedEndDate = new Date(endDate).toISOString().split('T')[0];

    // Extract city and state from location string
    const locationParts = location.split(',');
    let city = '';
    let state = '';

    // Handle different location formats
    if (location.includes(',')) {
      // Format: "City, State"
      city = locationParts[0].trim();
      state = locationParts[1]?.trim().split(' ')[0];
    } else if (location.includes(' TX ')) {
      // Format: "Street, CITY, TX ZIP"
      const parts = location.split(' TX ');
      const addressParts = parts[0].split(',');
      city = addressParts[addressParts.length - 1].trim();
      state = 'TX';
    }

    console.log('Parsed location:', { city, state, originalLocation: location });

    // Request specifically for hail (GH) and wind (WS) data
    const url = `https://www.ncdc.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&datatypeid=GH,WS&startdate=${formattedStartDate}&enddate=${formattedEndDate}&limit=1000`;
    
    console.log('NOAA API URL:', url);
    console.log('Using NOAA API Key:', noaaApiKey ? 'Key is present' : 'No key found');

    const response = await fetch(url, {
      headers: {
        'token': noaaApiKey || ''
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NOAA API Error:', response.status, errorText);
      return [];
    }

    const data = await response.json();
    console.log('NOAA API Response:', JSON.stringify(data, null, 2));

    if (!data.results || !Array.isArray(data.results)) {
      console.log('No results found in NOAA response');
      return [];
    }

    // Transform NOAA events into our format with better type detection
    const events = data.results
      .filter((event: any) => event.datatype && event.date)
      .map((event: any) => {
        // Determine event type based on NOAA data type codes
        const isHail = event.datatype === 'GH' || event.datatype.includes('HAIL');
        const isWind = event.datatype === 'WS' || event.datatype.includes('WIND');
        
        const details = `${isHail ? 'Hail' : 'Wind'} Event - ${event.datatype}: ${event.value} ${event.unit || ''}`;
        console.log('Processing event:', { date: event.date, type: isHail ? 'hail' : 'wind', details });
        
        return {
          date: event.date.split('T')[0],
          type: isHail ? 'hail' : 'wind',
          details,
          source: 'NOAA National Weather Service',
          sourceUrl: 'https://www.ncdc.noaa.gov/stormevents/',
        };
      });

    console.log('Processed NOAA events:', events);
    return events;

  } catch (error) {
    console.error('Error fetching NOAA data:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, effectiveDate, expirationDate } = await req.json();
    console.log('Searching for weather events:', { location, effectiveDate, expirationDate });

    // Get events from both sources in parallel
    const [openAIResponse, noaaEvents] = await Promise.all([
      // Get events from OpenAI
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',  // Using the more reliable model
          messages: [
            {
              role: 'system',
              content: 'You are a weather researcher. Your task is to search for and report significant hail and windstorm events. Format your response as a JSON array of events with dates, types (hail/wind), and details.'
            },
            {
              role: 'user',
              content: `Search for significant hail and windstorm events that occurred at or near ${location} between ${effectiveDate} and ${expirationDate}. Return the response in this JSON format: { "events": [{ "date": "YYYY-MM-DD", "type": "hail"|"wind", "details": "string", "source": "Local Weather Report", "sourceUrl": "string" }] }`
            }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      }).then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          console.error('OpenAI API Error:', errorText);
          throw new Error(`OpenAI API error: ${errorText}`);
        }
        return res.json();
      }),
      
      // Get events from NOAA
      searchNOAAEvents(location, effectiveDate, expirationDate)
    ]);

    console.log('OpenAI Response:', JSON.stringify(openAIResponse, null, 2));

    // Parse OpenAI events with better error handling
    let openAIEvents = [];
    try {
      if (openAIResponse.choices?.[0]?.message?.content) {
        const parsed = JSON.parse(openAIResponse.choices[0].message.content);
        if (!parsed.events || !Array.isArray(parsed.events)) {
          console.error('Invalid OpenAI response format:', parsed);
          throw new Error('Invalid response format from OpenAI');
        }
        openAIEvents = parsed.events.map(event => ({
          ...event,
          source: event.source || 'AI Weather Report',
          sourceUrl: event.sourceUrl || '#',
        }));
      }
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      throw new Error('Failed to parse OpenAI response');
    }

    console.log('Parsed OpenAI events:', openAIEvents);
    console.log('NOAA events:', noaaEvents);

    const allEvents = [...noaaEvents, ...openAIEvents];

    // Remove duplicates based on date and type
    const uniqueEvents = allEvents.reduce((acc: any[], event: any) => {
      const isDuplicate = acc.some(e => 
        e.date === event.date && 
        e.type === event.type
      );
      if (!isDuplicate) {
        acc.push(event);
      }
      return acc;
    }, []);

    // Sort events by date (most recent first)
    uniqueEvents.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log('Final combined events:', uniqueEvents);

    return new Response(JSON.stringify({ success: true, events: uniqueEvents }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in search-weather-events function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      events: [] 
    }), {
      status: 200, // Still return 200 to handle the error gracefully in the frontend
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});