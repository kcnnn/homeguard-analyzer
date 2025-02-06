import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { searchNOAAEvents } from './noaaApi.ts';
import { searchOpenAIEvents } from './openAiApi.ts';
import type { WeatherEvent } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, effectiveDate, expirationDate } = await req.json();
    console.log('Searching for weather events:', { location, effectiveDate, expirationDate });

    const [openAIEvents, noaaEvents] = await Promise.all([
      searchOpenAIEvents(location, effectiveDate, expirationDate),
      searchNOAAEvents(location, effectiveDate, expirationDate)
    ]);

    const allEvents = [...noaaEvents, ...openAIEvents];
    console.log('Combined events before deduplication:', allEvents);
    
    const uniqueEvents = allEvents.reduce((acc: WeatherEvent[], event: WeatherEvent) => {
      const isDuplicate = acc.some(e => 
        e.date === event.date && 
        e.type === event.type
      );
      if (!isDuplicate) {
        acc.push(event);
      }
      return acc;
    }, []);

    uniqueEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    console.log('Final events being returned:', uniqueEvents);

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
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});