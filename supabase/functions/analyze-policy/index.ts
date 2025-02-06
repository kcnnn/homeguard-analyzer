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

const createPrompt = (type: 'coverages' | 'deductibles'): string => {
  if (type === 'coverages') {
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
  }
  
  return `You are an expert insurance policy analyzer. Look for the following specific deductibles:
1. The "All Other Perils" (AOP) deductible - this is the standard deductible for most covered losses
2. The "Wind/Hail" or "Named Storm" deductible - this may be expressed as either a fixed amount or a percentage of Coverage A

Return ONLY a JSON object with the following structure, no additional text or formatting:
{
  "deductible": "$X,XXX",
  "windstormDeductible": "$X,XXX or X%"
}`;
}
};

const cleanJsonResponse = (content: string): any => {
  console.log('Raw content from OpenAI:', content);
  const cleanContent = content.trim().replace(/```json\n|\n```|```/g, '');
  const jsonStart = cleanContent.indexOf('{');
  const jsonEnd = cleanContent.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No valid JSON object found in response');
  }
  
  const jsonStr = cleanContent.slice(jsonStart, jsonEnd + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    throw new Error('Invalid JSON structure in response');
  }
};

const analyzeImageWithGPT = async (imageUrl: string, type: 'coverages' | 'deductibles'): Promise<any> => {
  console.log(`Analyzing image for ${type}...`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          { role: 'system', content: createPrompt(type) },
          { 
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: imageUrl } }]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure from OpenAI');
    }

    return cleanJsonResponse(data.choices[0].message.content);
  } catch (error) {
    console.error('Error in analyzeImageWithGPT:', error);
    throw error;
  }
};

const processImages = async (base64Images: string[]): Promise<PolicyDetails> => {
  try {
    console.log('Processing images, count:', base64Images.length);
    
    // Process first image for coverages
    const firstImageUrl = `data:image/jpeg;base64,${base64Images[0].replace(/^data:image\/[a-z]+;base64,/, '')}`;
    const coverageData = await analyzeImageWithGPT(firstImageUrl, 'coverages');
    
    // Process second image for deductibles if available
    let deductibleData;
    if (base64Images.length > 1) {
      const secondImageUrl = `data:image/jpeg;base64,${base64Images[1].replace(/^data:image\/[a-z]+;base64,/, '')}`;
      deductibleData = await analyzeImageWithGPT(secondImageUrl, 'deductibles');
    } else {
      // Fallback to first image for deductibles
      deductibleData = await analyzeImageWithGPT(firstImageUrl, 'deductibles');
    }

    return {
      ...coverageData,
      deductible: deductibleData?.deductible || 'Not found',
      windstormDeductible: deductibleData?.windstormDeductible || 'Not found',
      weatherEvents: []
    };
  } catch (error) {
    console.error('Error in processImages:', error);
    throw error;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders 
    });
  }

  try {
    const { base64Images } = await req.json();
    
    if (!base64Images?.length) {
      console.error('No image data provided');
      return new Response(
        JSON.stringify({ error: 'No image data provided' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Starting policy analysis...');
    const policyDetails = await processImages(base64Images);
    console.log('Policy analysis completed successfully');

    return new Response(
      JSON.stringify(policyDetails), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in analyze-policy function:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'An unexpected error occurred',
        coverageA: 'Error processing request',
        coverageB: 'Error processing request',
        coverageC: 'Error processing request',
        coverageD: 'Error processing request',
        deductible: 'Error processing request',
        windstormDeductible: 'Error processing request',
        effectiveDate: 'Error processing request',
        expirationDate: 'Error processing request',
        location: 'Error processing request',
        weatherEvents: []
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
