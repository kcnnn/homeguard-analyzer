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
    const { location } = await req.json()
    
    if (!location) {
      return new Response(
        JSON.stringify({ error: 'Location is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Use OpenAI to search for weather events
    const prompt = `Search for significant hail and windstorm events in ${location} in the past 3 years. For each event, provide:
    1. The date (YYYY-MM-DD format)
    2. The type (either 'hail' or 'wind')
    3. A brief description of the event
    4. If available, a source name and URL
    
    Format as JSON array with objects containing: date, type, details, source (optional), sourceUrl (optional).
    Example: [{"date": "2023-05-15", "type": "hail", "details": "Golf ball sized hail damaged vehicles", "source": "Weather Service", "sourceUrl": "http://example.com"}]`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that searches for historical weather events and returns them in JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0].message.content);
    const events = response.events || [];

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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})