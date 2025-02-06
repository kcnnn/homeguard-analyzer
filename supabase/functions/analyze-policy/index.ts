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
    const { imageUrl } = await req.json();

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
            content: 'You are an expert insurance policy analyzer. Extract key information from insurance policy documents, including coverage amounts, deductibles, and policy dates. Return the information in a structured format.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image_url: imageUrl
              },
              {
                type: 'text',
                text: 'Please analyze this insurance policy document and extract the following information: Coverage A (Dwelling), Coverage B (Other Structures), Coverage C (Personal Property), Coverage D (Loss of Use), Deductible, Effective Date, and Expiration Date. Return the data in a JSON format.'
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
      // Parse the response to extract structured data
      const content = data.choices[0].message.content;
      policyDetails = JSON.parse(content);
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      policyDetails = {
        error: 'Failed to parse policy details from the document'
      };
    }

    return new Response(JSON.stringify(policyDetails), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-policy function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});