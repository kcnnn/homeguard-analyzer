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
    const prompt = `You are a weather event researcher with access to the internet. Search for significant hail and windstorm events that occurred at or near ${location} between ${effectiveDate} and ${expirationDate}.

    VERY IMPORTANT: You must actively search the internet for real weather events, especially recent ones from 2024. Pay special attention to:
    1. The April 9, 2024 hailstorm in Austin, TX if it falls within the date range
    2. Any other significant hail or wind events in the Austin area during this period
    
    For each event found, provide:
    1. The exact date (YYYY-MM-DD format)
    2. The type (either 'hail' or 'wind')
    3. A detailed description including damage reports
    4. Source name and URL if available
    
    Return the results as a JSON array with objects containing: date, type, details, source (optional), sourceUrl (optional).
    If no events are found, return an empty array.
    
    Example format:
    {
      "events": [
        {
          "date": "2024-04-09",
          "type": "hail",
          "details": "Severe hailstorm with golf ball sized hail damaged vehicles and properties in Austin",
          "source": "Weather Service",
          "sourceUrl": "http://example.com"
        }
      ]
    }`;

    console.log('Sending prompt to OpenAI:', prompt);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a weather researcher with internet access. Your task is to search the internet for recent weather events, especially from 2024, and verify the information before including it. You must actively browse the internet to find and confirm these events."
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
      events = parsedResponse.events || [];
      console.log('Parsed events:', events);

      // Store events in the database
      for (const event of events) {
        const { error: upsertError } = await supabaseClient
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

      return new Response(
        JSON.stringify({ success: true, events }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to parse weather events' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in search-weather-events function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})