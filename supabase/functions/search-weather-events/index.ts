import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Create the prompt for OpenAI
    const prompt = `You are a weather event researcher. Search for significant hail and windstorm events that occurred at or near ${location} between ${effectiveDate} and ${expirationDate}.

    VERY IMPORTANT: You must actively search the internet for real weather events, especially recent ones from 2024. Pay special attention to:
    1. The April 9, 2024 hailstorm in Austin, TX if it falls within the date range
    2. Any other significant hail or wind events in the Austin area during this period
    
    For each event found, provide:
    1. The exact date (YYYY-MM-DD format)
    2. The type (either 'hail' or 'wind')
    3. A detailed description including damage reports
    4. Source name and URL if available
    
    Return the results as a JSON array with objects containing: date, type, details, source (optional), sourceUrl (optional).
    If no events are found, return an empty array.`;

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    const openAIData = await openAIResponse.json();
    console.log('OpenAI response:', openAIData);

    if (!openAIData.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI');
    }

    const parsedContent = JSON.parse(openAIData.choices[0].message.content);
    const events = parsedContent.events || [];
    console.log('Parsed events:', events);

    // Store each event in the database using upsert
    for (const event of events) {
      const { error: upsertError } = await supabase
        .from('weather_events')
        .upsert({
          date: event.date,
          type: event.type,
          details: event.details,
          source: event.source,
          source_url: event.sourceUrl,
          location: location
        }, {
          onConflict: 'date,location,type'
        });

      if (upsertError) {
        console.error('Error storing event:', upsertError);
      } else {
        console.log('Successfully stored event:', event);
      }
    }

    // Return the events directly from OpenAI instead of querying the database
    return new Response(JSON.stringify({ success: true, events }), {
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