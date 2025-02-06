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

const createSystemPromptForCoverages = (): string => {
  return `You are an expert insurance policy analyzer. Extract coverage amounts and dates from insurance policy declaration pages.
Return ONLY a JSON object with the following structure, no additional text or formatting:
{
  "coverageA": "$XXX,XXX",
  "coverageB": "$XX,XXX",
  "coverageC": "$XX,XXX",
  "coverageD": "$XX,XXX",
  "effectiveDate": "MM/DD/YYYY",
  "expirationDate": "MM/DD/YYYY",
  "location": "Full property address"
}`;
};

const createSystemPromptForDeductibles = (): string => {
  return `You are an expert insurance policy analyzer. Look for the following specific deductibles:
1. The "All Other Perils" (AOP) deductible - this is the standard deductible for most covered losses
2. The "Wind/Hail" or "Named Storm" deductible - this may be expressed as either a fixed amount or a percentage of Coverage A

Return ONLY a JSON object with the following structure, no additional text or formatting:
{
  "deductible": "$X,XXX",
  "windstormDeductible": "$X,XXX or X%"
}

Note: Include the $ symbol and commas for dollar amounts. For percentage-based windstorm deductibles, use the % symbol.`;
};

const cleanJsonResponse = (content: string): string => {
  console.log('Raw content from OpenAI:', content);
  
  // Remove any markdown code block indicators and whitespace
  content = content.trim().replace(/```json\n|\n```|```/g, '');
  
  // Find the first { and last }
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    console.error('No JSON object delimiters found in content');
    throw new Error('No valid JSON object found in response');
  }
  
  const extractedJson = content.slice(jsonStart, jsonEnd + 1);
  console.log('Extracted JSON:', extractedJson);
  
  // Validate that it's actually valid JSON
  try {
    const parsed = JSON.parse(extractedJson);
    console.log('Successfully parsed JSON:', parsed);
    return extractedJson;
  } catch (error) {
    console.error('Failed to parse extracted JSON:', error);
    throw new Error('Invalid JSON structure in response');
  }
};

const analyzeImage = async (imageUrl: string, isDeductibles: boolean): Promise<any> => {
  console.log(`Analyzing image for ${isDeductibles ? 'deductibles' : 'coverages'}...`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: isDeductibles ? createSystemPromptForDeductibles() : createSystemPromptForCoverages()
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI API response:', JSON.stringify(data, null, 2));
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure from OpenAI');
    }

    const cleanedContent = cleanJsonResponse(data.choices[0].message.content);
    return JSON.parse(cleanedContent);
  } catch (error) {
    console.error(`Error analyzing image for ${isDeductibles ? 'deductibles' : 'coverages'}:`, error);
    throw error;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { base64Image } = await req.json();
    if (!base64Image) {
      throw new Error('No image data provided');
    }

    const formattedBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageUrl = `data:image/jpeg;base64,${formattedBase64}`;

    // First analyze for coverages
    const coverageData = await analyzeImage(imageUrl, false);
    console.log('Coverage analysis result:', coverageData);

    // Then analyze for deductibles
    const deductibleData = await analyzeImage(imageUrl, true);
    console.log('Deductible analysis result:', deductibleData);

    // Combine the results
    const policyDetails: PolicyDetails = {
      ...coverageData,
      deductible: deductibleData.deductible || 'Not found',
      windstormDeductible: deductibleData.windstormDeductible || 'Not found',
      weatherEvents: []
    };

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