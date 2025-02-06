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
  source?: string;
  sourceUrl?: string;
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
  return `You are an expert insurance policy analyzer. Extract coverage amounts, deductibles, dates, and location accurately. Return ONLY raw JSON without any explanations, markdown formatting, or code blocks.

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

DEDUCTIBLES EXTRACTION (CRITICAL):
You must find and extract TWO specific deductibles:

1. Property Coverage Deductible (All Other Perils):
   - Look for terms like "All Other Perils", "AOP Deductible", or "Property Coverage Deductible"
   - Return the exact dollar amount with $ sign (e.g. "$5,000")
   - This is usually a fixed dollar amount
   - If not found, return "Not found"

2. Windstorm or Hail Deductible:
   - Look for terms like "Wind/Hail", "Named Storm", or "Hurricane Deductible"
   - Return the exact dollar amount with $ sign (e.g. "$6,830")
   - If shown as percentage, calculate and return the dollar amount
   - If not found, return "Not found"

LOCATION AND DATES (CRITICAL):
Extract:
- Property address: Look for the insured property address, including street, city, state, and zip code
- Policy effective date (in MM/DD/YYYY format)
- Policy expiration date (in MM/DD/YYYY format)

Return ONLY the following JSON object without any additional text or formatting:
{
  "coverageA": "(with $ sign)",
  "coverageB": "(with $ sign)",
  "coverageC": "(with $ sign)",
  "coverageD": "(with $ sign)",
  "deductible": "(exact All Other Perils amount with $ sign)",
  "windstormDeductible": "(exact calculated amount with $ sign)",
  "effectiveDate": "(date)",
  "expirationDate": "(date)",
  "location": "(full property address)"
}`;
};

const searchWeatherEvents = async (location: string, startDate: string, endDate: string): Promise<WeatherEvent[]> => {
  const prompt = `Search for weather events (hail and high winds over 50mph) at this location: ${location} between ${startDate} and ${endDate}.
  Return ONLY a raw JSON array without any explanations, markdown formatting, or code blocks.
  Format each event exactly as:
  [
    {
      "date": "YYYY-MM-DD",
      "type": "hail" or "wind",
      "details": "brief description",
      "source": "website name",
      "sourceUrl": "direct link to event report if available, or main source URL"
    }
  ]
  If no events found, return exactly: []`;

  try {
    console.log('Searching weather events for:', { location, startDate, endDate });
    
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
            content: "You are a weather research assistant. Return ONLY raw JSON without any explanations or formatting."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Weather search raw response:', data);
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure from OpenAI');
    }
    
    const content = data.choices[0].message.content.trim();
    console.log('Weather events content:', content);
    
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('Error parsing weather events:', parseError);
      console.log('Raw content that failed to parse:', content);
      return [];
    }
  } catch (error) {
    console.error('Error searching weather events:', error);
    return [];
  }
};

const analyzePolicyImage = async (imageUrl: string): Promise<PolicyDetails> => {
  console.log('Analyzing policy image...');
  
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
            role: 'system',
            content: createSystemPrompt()
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract ALL policy details from this declaration page, especially deductibles and location. Return ONLY raw JSON.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Policy analysis raw response:', data);
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure from OpenAI');
    }

    const content = data.choices[0].message.content.trim();
    console.log('Policy details raw content:', content);
    
    try {
      const parsedContent = JSON.parse(content);
      console.log('Parsed policy details:', parsedContent);
      
      // Ensure all required fields are present with default values if missing
      const defaultValue = "Not found";
      const policyDetails: PolicyDetails = {
        coverageA: parsedContent.coverageA || defaultValue,
        coverageB: parsedContent.coverageB || defaultValue,
        coverageC: parsedContent.coverageC || defaultValue,
        coverageD: parsedContent.coverageD || defaultValue,
        deductible: parsedContent.deductible || defaultValue,
        windstormDeductible: parsedContent.windstormDeductible || defaultValue,
        effectiveDate: parsedContent.effectiveDate || defaultValue,
        expirationDate: parsedContent.expirationDate || defaultValue,
        location: parsedContent.location || defaultValue,
        weatherEvents: []
      };
      
      return policyDetails;
    } catch (parseError) {
      console.error('Error parsing policy details:', parseError);
      console.log('Raw content that failed to parse:', content);
      throw new Error('Failed to parse policy details from OpenAI response');
    }
  } catch (error) {
    console.error('Error in analyzePolicyImage:', error);
    throw error;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting policy analysis...');
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const { base64Image } = await req.json();
    if (!base64Image) {
      throw new Error('No image data provided');
    }

    const formattedBase64 = formatBase64Image(base64Image);
    const imageUrl = `data:image/jpeg;base64,${formattedBase64}`;
    
    console.log('Analyzing policy declaration page...');
    const policyDetails = await analyzePolicyImage(imageUrl);
    
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
      error: error.message,
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
