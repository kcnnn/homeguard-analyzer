import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { OpenAI } from 'https://esm.sh/openai@4.20.1'
import { corsHeaders } from '../_shared/cors.ts'

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { location, effectiveDate, expirationDate } = await req.json()
    
    if (!location || !effectiveDate || !expirationDate) {
      return new Response(
        JSON.stringify({ error: 'Location and policy dates are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Searching for weather events in ${location} between ${effectiveDate} and ${expirationDate}`);

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Use OpenAI to search for weather events
    const prompt = `Search for significant hail and windstorm events in ${location} that occurred between ${effectiveDate} and ${expirationDate}. 
    This is VERY important: make sure to include the April 9, 2024 hail event if it falls within these dates.
    
    Only return events that occurred within these exact dates.
    
    For each event, provide:
    1. The exact date (YYYY-MM-DD format)
    2. The type (either 'hail' or 'wind')
    3. A detailed description of the event including any damage reports
    4. If available, a source name and URL
    
    Return the results as a JSON array with objects containing: date, type, details, source (optional), sourceUrl (optional).
    If no events are found, return an empty array.
    
    Example response format:
    [
      {
        "date": "2024-04-09",
        "type": "hail",
        "details": "Golf ball sized hail damaged vehicles and properties",
        "source": "Weather Service",
        "sourceUrl": "http://example.com"
      }
    ]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",  // Using the more capable model
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that searches for historical weather events and returns them in JSON format. Only return events within the specified date range. Make sure to include recent events from 2024 if they occurred within the date range."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0].message.content;
    console.log('OpenAI response:', responseContent);

    let events = [];
    try {
      const parsedResponse = JSON.parse(responseContent);
      // The response might be in the format { events: [...] } or just an array
      events = Array.isArray(parsedResponse) ? parsedResponse : (parsedResponse.events || []);
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      events = [];
    }

    console.log('Parsed events:', events);

    // Store events in the database
    for (const event of events) {
      const { data, error } = await supabaseClient
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

      if (error) {
        console.error('Error storing event:', error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, events }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in search-weather-events function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})