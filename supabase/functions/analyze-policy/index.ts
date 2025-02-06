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
Please analyze this insurance policy declaration page and extract ONLY the following information in a strict JSON format.

Required format:
{
  "coverageA": "$XXX,XXX",
  "coverageB": "$XX,XXX",
  "coverageC": "$XX,XXX",
  "coverageD": "$XX,XXX",
  "effectiveDate": "MM/DD/YYYY",
  "expirationDate": "MM/DD/YYYY",
  "location": "Full property address"
}

Important rules:
1. ALL monetary values MUST include the $ symbol and commas for thousands
2. ALL dates MUST be in MM/DD/YYYY format
3. Return ONLY the JSON object, no additional text, no markdown formatting, no explanations
4. If you cannot find a value, use "Not found" as the value
5. The location MUST be the complete property address`;
};

const createSystemPromptForDeductibles = (): string => {
  return `You are an expert insurance policy analyzer. Extract ONLY the deductible information from insurance policy declaration pages.
Please analyze this insurance policy declaration page and extract ONLY the following information in a strict JSON format.

Required format:
{
  "deductible": "$X,XXX",
  "windstormDeductible": "$X,XXX or X%"
}

Important rules:
1. The "deductible" field MUST be the All Other Perils (AOP) deductible amount with $ symbol
2. The "windstormDeductible" field MUST be either a fixed amount with $ (e.g. "$2,500") or a percentage with % (e.g. "2%")
3. Return ONLY the JSON object, no additional text, no markdown formatting, no explanations
4. If you cannot find a value, use "Not found" as the value`;
};

const cleanJsonResponse = (content: string): string => {
  console.log('Raw content from OpenAI:', content);
  
  // Remove any markdown code block indicators
  content = content.replace(/```json\n|\n```/g, '');
  
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
    JSON.parse(extractedJson);
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
        model: 'gpt-4o',
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
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response:', JSON.stringify(data, null, 2));
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure from OpenAI');
    }

    const cleanedContent = cleanJsonResponse(data.choices[0].message.content);
    const parsedContent = JSON.parse(cleanedContent);
    console.log('Successfully parsed content:', parsedContent);
    
    return parsedContent;
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