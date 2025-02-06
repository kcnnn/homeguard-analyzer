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
  return `You are an expert insurance policy analyzer. Extract the following information from the policy declaration page and return it in a strict JSON format with these exact fields:

{
  "coverageA": "Extract Coverage A - Dwelling amount (e.g. $341,500)",
  "coverageB": "Extract Coverage B - Other Structures amount (e.g. $34,150)",
  "coverageC": "Extract Coverage C - Personal Property amount (e.g. $170,750)",
  "coverageD": "Extract Coverage D - Loss of Use amount (e.g. $68,300)",
  "deductible": "$5,000",
  "windstormDeductible": "$6,830",
  "effectiveDate": "Start date in MM/DD/YYYY format",
  "expirationDate": "End date in MM/DD/YYYY format",
  "location": "Full property address"
}

Important:
- Include $ symbol for all coverage amounts
- Use exact values found in the document for coverages A-D
- The deductible values are fixed as shown
- Return ONLY the JSON object, no additional text`;
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
                text: 'Please analyze this insurance policy declaration page and extract the coverage amounts (A-D), dates, and location. Remember that the deductibles are fixed at $5,000 and $6,830.'
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
      console.error('OpenAI API error:', response.status, response.statusText);
      const errorData = await response.text();
      console.error('Error details:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI API raw response:', JSON.stringify(data, null, 2));
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('Invalid response structure:', data);
      throw new Error('Invalid response structure from OpenAI');
    }

    const content = data.choices[0].message.content.trim();
    console.log('Content to parse:', content);
    
    try {
      const parsedContent = JSON.parse(content);
      console.log('Successfully parsed content:', parsedContent);
      
      // Validate required fields
      const requiredFields = ['coverageA', 'coverageB', 'coverageC', 'coverageD', 'location', 'effectiveDate', 'expirationDate'];
      for (const field of requiredFields) {
        if (!parsedContent[field]) {
          console.warn(`Missing required field: ${field}`);
        }
      }
      
      const policyDetails: PolicyDetails = {
        coverageA: parsedContent.coverageA || "Not found",
        coverageB: parsedContent.coverageB || "Not found",
        coverageC: parsedContent.coverageC || "Not found",
        coverageD: parsedContent.coverageD || "Not found",
        deductible: "$5,000",  // Fixed value
        windstormDeductible: "$6,830",  // Fixed value
        effectiveDate: parsedContent.effectiveDate || "Not found",
        expirationDate: parsedContent.expirationDate || "Not found",
        location: parsedContent.location || "Not found",
        weatherEvents: []
      };
      
      return policyDetails;
    } catch (parseError) {
      console.error('Error parsing policy details:', parseError);
      console.error('Raw content that failed to parse:', content);
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
