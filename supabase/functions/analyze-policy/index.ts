import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeatherEvent {
  date: string;
  type: 'hail' | 'wind';
  details: string;
  source: string;
  sourceUrl: string;
}

interface PolicyDetails {
  coverageA: string;
  coverageB: string;
  coverageC: string;
  coverageD: string;
  deductible: string;
  windstormDeductible: string;
  effectiveDate: string;
  expirationDate: string;
  location: string;
  weatherEvents: WeatherEvent[];
}

const formatBase64Image = (base64Image: string): string => {
  return base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
};

const createSystemPrompt = (): string => {
  return `You are an expert insurance policy analyzer. Extract coverage amounts, deductibles, dates, and location accurately.

COVERAGE AMOUNTS EXTRACTION:
You must find and extract the exact dollar amounts for:
1. Coverage A - Dwelling
2. Coverage B - Other Structures
3. Coverage C - Personal Property
4. Coverage D - Loss of Use

For each coverage:
- Look for clearly stated dollar amounts
- Include the dollar sign ($) in all values
- Common formats: "$300,000", "$150,000", etc.
- Return "Not found" only if you cannot locate the amount

DEDUCTIBLES EXTRACTION:
You must find and extract TWO specific deductibles:

1. Property Coverage Deductible (All Other Perils):
   - Look for "Property Coverage Deductible (All Other Perils)"
   - Return the exact dollar amount shown (e.g. "$5,000")
   - This is usually a fixed dollar amount

2. Windstorm or Hail Deductible:
   - Look for "Windstorm or Hail Deductible"
   - Return the exact dollar amount shown (e.g. "$6,830")
   - This might be shown as both a percentage and a dollar amount
   - Return ONLY the dollar amount, not the percentage

LOCATION AND DATES:
Extract:
- Property address (full address including city, state, zip)
- Policy effective date
- Policy expiration date

Return a JSON object with these fields:
- coverageA (with $ sign)
- coverageB (with $ sign)
- coverageC (with $ sign)
- coverageD (with $ sign)
- deductible (exact All Other Perils amount with $ sign)
- windstormDeductible (exact calculated amount with $ sign)
- effectiveDate
- expirationDate
- location (full property address)`;
};

const createOpenAIRequest = (imageUrl: string) => {
  return {
    model: "gpt-4o",
    messages: [
      {
        role: 'system',
        content: createSystemPrompt()
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please analyze this declaration page carefully. Extract ALL coverage amounts (A, B, C, D) with dollar signs, both deductibles as exact dollar amounts, and the property location and policy dates.'
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ],
    max_tokens: 1000,
  };
};

const searchWeatherEvents = async (location: string, startDate: string, endDate: string): Promise<WeatherEvent[]> => {
  const prompt = `Search for weather events (hail and high winds over 50mph) at this location: ${location} between ${startDate} and ${endDate}.
  Use sources like NOAA Storm Events Database (https://www.ncdc.noaa.gov/stormevents/) or Weather Underground.
  Format each event as:
  - Date: [date]
  - Type: [hail or wind]
  - Details: [brief description]
  - Source: [website name]
  - URL: [direct link to event report if available, or main source URL]
  
  Return as JSON array of events. If no events found, return empty array.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a weather research assistant. Search historical weather databases and return verified weather events in JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    console.log('Weather search response:', data);
    
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error searching weather events:', error);
    return [];
  }
};

const analyzePolicyImage = async (imageUrl: string): Promise<PolicyDetails> => {
  console.log('Analyzing policy image...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createOpenAIRequest(imageUrl)),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('OpenAI API error:', errorData);
    throw new Error(`OpenAI API error: ${JSON.stringify(errorData.error || errorData)}`);
  }

  const data = await response.json();
  console.log('Policy analysis response:', data);
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response structure from OpenAI');
  }

  return JSON.parse(data.choices[0].message.content.trim());
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting policy analysis...');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    const { base64Image } = await req.json();
    if (!base64Image) {
      console.error('No image data provided');
      throw new Error('No image data provided');
    }

    const formattedBase64 = formatBase64Image(base64Image);
    const imageUrl = `data:image/jpeg;base64,${formattedBase64}`;
    
    console.log('Analyzing policy declaration page...');
    const policyDetails = await analyzePolicyImage(imageUrl);
    
    // Search for weather events if location and dates are available
    if (policyDetails.location && policyDetails.effectiveDate && policyDetails.expirationDate) {
      console.log('Searching for weather events...');
      const weatherEvents = await searchWeatherEvents(
        policyDetails.location,
        policyDetails.effectiveDate,
        policyDetails.expirationDate
      );
      policyDetails.weatherEvents = weatherEvents;
    } else {
      policyDetails.weatherEvents = [];
    }

    console.log('Sending response:', policyDetails);
    return new Response(JSON.stringify(policyDetails), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-policy function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred',
      coverageA: 'Error processing request',
      coverageB: 'Error processing request',
      coverageC: 'Error processing request',
      coverageD: 'Error processing request',
      deductible: 'Error processing request',
      windstormDeductible: 'Error processing request',
      effectiveDate: 'Error processing request',
      expirationDate: 'Error processing request',
      weatherEvents: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});