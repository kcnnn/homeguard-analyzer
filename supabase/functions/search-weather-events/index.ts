import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const noaaApiKey = Deno.env.get('NOAA_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function searchNOAAEvents(location: string, startDate: string, endDate: string) {
  console.log('Searching NOAA events for:', { location, startDate, endDate });
  
  try {
    // Format dates for NOAA API (YYYY-MM-DD)
    const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
    const formattedEndDate = new Date(endDate).toISOString().split('T')[0];

    // Extract city and state from location string
    const locationParts = location.split(',');
    const city = locationParts[0].trim();
    const state = locationParts[1]?.trim().split(' ')[0];

    console.log('Formatted NOAA search params:', { city, state, formattedStartDate, formattedEndDate });

    const url = `https://www.ncdc.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&locationid=FIPS:48&startdate=${formattedStartDate}&enddate=${formattedEndDate}&limit=1000`;
    
    console.log('NOAA API URL:', url);

    const response = await fetch(url, {
      headers: {
        'token': noaaApiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NOAA API Error:', errorText);
      return [];
    }

    const data = await response.json();
    console.log('NOAA API Response:', data);

    // Transform NOAA events into our format
    return data.results?.map((event: any) => ({
      date: event.date.split('T')[0],
      type: event.datatype.includes('WIND') ? 'wind' : 'hail',
      details: `${event.datatype}: ${event.value} ${event.unit || ''}`,
      source: 'NOAA National Weather Service',
      sourceUrl: 'https://www.ncdc.noaa.gov/stormevents/',
    })) || [];

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
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a weather researcher with internet access. Your task is to search the internet for recent weather events, especially from 2024, and verify the information before including it.'
            },
            {
              role: 'user',
              content: `Search for significant hail and windstorm events that occurred at or near ${location} between ${effectiveDate} and ${expirationDate}. Return the response in this JSON format: { "events": [{ "date": "YYYY-MM-DD", "type": "hail"|"wind", "details": "string", "source": "string", "sourceUrl": "string" }] }`
            }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      }).then(res => res.json()),
      
      // Get events from NOAA
      searchNOAAEvents(location, effectiveDate, expirationDate)
    ]);

    console.log('OpenAI Response:', openAIResponse);

    // Parse OpenAI events
    const openAIEvents = openAIResponse.choices?.[0]?.message?.content
      ? JSON.parse(openAIResponse.choices[0].message.content).events
      : [];

    console.log('Parsed OpenAI events:', openAIEvents);
    console.log('NOAA events:', noaaEvents);

    const allEvents = [...openAIEvents, ...noaaEvents];

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});