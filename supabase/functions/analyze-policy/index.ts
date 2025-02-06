import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
        model: 'gpt-4o-mini',
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
                image_url: {
                  url: base64Image
                }
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