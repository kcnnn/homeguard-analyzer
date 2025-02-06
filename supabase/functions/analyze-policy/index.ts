import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { base64Image } = await req.json();

    if (!base64Image) {
      throw new Error('No image data provided');
    }

    console.log('Received image data, sending to OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: 'You are an expert insurance policy analyzer. Extract key information from insurance policy documents, including coverage amounts, deductibles, and policy dates. Return the information in a structured format.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image_url: base64Image
              },
              {
                type: 'text',
                text: 'Please analyze this insurance policy document and extract the following information: Coverage A (Dwelling), Coverage B (Other Structures), Coverage C (Personal Property), Coverage D (Loss of Use), Deductible, Effective Date, and Expiration Date. Return ONLY a valid JSON object with these fields, nothing else.'
              }
            ]
          }
        ],
      }),
    });

    const data = await response.json();
    console.log('OpenAI API Response:', data);

    let policyDetails;
    try {
      const content = data.choices[0].message.content;
      console.log('Attempting to parse content:', content);
      policyDetails = JSON.parse(content);
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      policyDetails = {
        coverageA: 'Error parsing response',
        coverageB: 'Error parsing response',
        coverageC: 'Error parsing response',
        coverageD: 'Error parsing response',
        deductible: 'Error parsing response',
        effectiveDate: null,
        expirationDate: null
      };
    }

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
      effectiveDate: null,
      expirationDate: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});