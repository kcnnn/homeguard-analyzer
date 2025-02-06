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
  return `You are an expert insurance policy analyzer. Extract coverage amounts and dates from insurance policy declaration pages.
Please analyze this insurance policy declaration page and extract the following information in JSON format:

Required format:
{
  "coverageA": "$XXX,XXX" (Dwelling coverage),
  "coverageB": "$XX,XXX" (Other Structures),
  "coverageC": "$XX,XXX" (Personal Property),
  "coverageD": "$XX,XXX" (Loss of Use),
  "deductible": "$X,XXX" (All Other Perils),
  "windstormDeductible": "$X,XXX",
  "effectiveDate": "MM/DD/YYYY",
  "expirationDate": "MM/DD/YYYY",
  "location": "Full property address"
}

Important rules:
1. ALL monetary values MUST include the $ symbol and commas for thousands
2. ALL dates MUST be in MM/DD/YYYY format
3. Return ONLY the JSON object, no additional text
4. If you cannot find a value, use "Not found" as the value
5. The location MUST be the complete property address
6. Format all monetary values with proper commas and dollar signs, e.g. $100,000 not $100000`;
};

const validatePolicyDetails = (parsedContent: any): PolicyDetails => {
  console.log('Validating policy details:', parsedContent);
  
  const requiredFields = [
    'coverageA', 'coverageB', 'coverageC', 'coverageD',
    'deductible', 'windstormDeductible', 'effectiveDate',
    'expirationDate', 'location'
  ];

  // Ensure all required fields exist
  for (const field of requiredFields) {
    if (!parsedContent[field]) {
      parsedContent[field] = 'Not found';
    }
  }

  // Ensure monetary values have $ symbol
  const monetaryFields = [
    'coverageA', 'coverageB', 'coverageC', 'coverageD',
    'deductible', 'windstormDeductible'
  ];
  
  for (const field of monetaryFields) {
    if (parsedContent[field] !== 'Not found' && !parsedContent[field].startsWith('$')) {
      parsedContent[field] = `$${parsedContent[field]}`;
    }
  }

  return {
    ...parsedContent,
    weatherEvents: []
  };
};

const analyzePolicyImage = async (imageUrl: string): Promise<PolicyDetails> => {
  console.log('Starting policy image analysis...');
  
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
                text: 'Please analyze this insurance policy declaration page and extract the required information.'
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
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI API response:', JSON.stringify(data, null, 2));
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure from OpenAI');
    }

    const content = data.choices[0].message.content.trim();
    console.log('Raw content to parse:', content);
    
    try {
      const parsedContent = JSON.parse(content);
      console.log('Parsed content:', parsedContent);
      return validatePolicyDetails(parsedContent);
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