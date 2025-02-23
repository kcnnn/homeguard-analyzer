
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { searchNOAAEvents } from "./noaaApi.ts";
import { searchOpenAIEvents } from "./openAiApi.ts";

console.log("Search weather events function started");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { location, effectiveDate, expirationDate } = await req.json();
    
    console.log('Received request with params:', {
      location,
      effectiveDate,
      expirationDate
    });

    // Validate input
    if (!location || !effectiveDate || !expirationDate) {
      console.error('Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if NOAA API key is configured
    const noaaApiKey = Deno.env.get('NOAA_API_KEY');
    console.log('NOAA API Key configured:', !!noaaApiKey);

    const [noaaEvents, openaiEvents] = await Promise.allSettled([
      searchNOAAEvents(location, effectiveDate, expirationDate),
      searchOpenAIEvents(location, effectiveDate, expirationDate)
    ]);

    console.log('NOAA Events result:', 
      noaaEvents.status === 'fulfilled' ? 
        `Success (${noaaEvents.value.length} events)` : 
        `Error: ${noaaEvents.reason}`
    );
    
    console.log('OpenAI Events result:', 
      openaiEvents.status === 'fulfilled' ? 
        `Success (${openaiEvents.value.length} events)` : 
        `Error: ${openaiEvents.reason}`
    );

    const events = [
      ...(noaaEvents.status === 'fulfilled' ? noaaEvents.value : []),
      ...(openaiEvents.status === 'fulfilled' ? openaiEvents.value : [])
    ];

    console.log(`Returning ${events.length} total events`);

    return new Response(
      JSON.stringify({ events }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-weather-events function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
