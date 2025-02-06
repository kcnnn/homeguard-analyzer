import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { searchNOAAEvents } from './noaaApi.ts';
import { searchOpenAIEvents } from './openAiApi.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, effectiveDate, expirationDate } = await req.json();
    console.log('Searching for weather events:', { location, effectiveDate, expirationDate });

    if (!location || !effectiveDate || !expirationDate) {
      throw new Error('Missing required parameters');
    }

    const [openAIEvents, noaaEvents] = await Promise.all([
      searchOpenAIEvents(location, effectiveDate, expirationDate),
      searchNOAAEvents(location, effectiveDate, expirationDate)
    ]);

    console.log('Events found:', { 
      openAIEvents: openAIEvents.length, 
      noaaEvents: noaaEvents.length 
    });

    const allEvents = [...noaaEvents, ...openAIEvents];
    
    // Deduplicate events based on date and type
    const uniqueEvents = allEvents.reduce((acc, event) => {
      const isDuplicate = acc.some(e => 
        e.date === event.date && 
        e.type === event.type
      );
      if (!isDuplicate) {
        acc.push(event);
      }
      return acc;
    }, []);

    // Sort events by date (newest first)
    uniqueEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    console.log('Returning unique events:', uniqueEvents.length);

    return new Response(
      JSON.stringify({
        success: true,
        events: uniqueEvents
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    console.error('Error in search-weather-events function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        events: []
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200 // Keep 200 to ensure the error message reaches the client
      }
    );
  }
});