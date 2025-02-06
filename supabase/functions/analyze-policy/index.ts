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
            content: 'You are an expert insurance policy analyzer. Extract key information from insurance policy documents and return it in a strict JSON format with the following fields: coverageA, coverageB, coverageC, coverageD, deductible, effectiveDate, and expirationDate. All values should be strings.'
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
                text: 'Analyze this insurance policy document and return ONLY a JSON object with these exact fields: coverageA, coverageB, coverageC, coverageD, deductible, effectiveDate, and expirationDate. Format all currency values as strings with dollar signs (e.g. "$250,000"). Format all dates as MM/DD/YYYY strings. Do not include any explanatory text, just the JSON object.'
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
      console.log('Raw content from OpenAI:', content);
      
      // Try to clean the content if it contains any markdown or extra text
      let jsonContent = content;
      if (content.includes('```json')) {
        jsonContent = content.split('```json')[1].split('```')[0];
      } else if (content.includes('{')) {
        jsonContent = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
      }
      
      console.log('Cleaned content before parsing:', jsonContent);
      policyDetails = JSON.parse(jsonContent);
      
      // Ensure all required fields are present
      const requiredFields = ['coverageA', 'coverageB', 'coverageC', 'coverageD', 'deductible', 'effectiveDate', 'expirationDate'];
      for (const field of requiredFields) {
        if (!policyDetails[field]) {
          policyDetails[field] = 'Not found';
        }
      }
      
      console.log('Successfully parsed policy details:', policyDetails);
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