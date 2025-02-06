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
    if (!openAIApiKey) {
      console.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    const { base64Image } = await req.json();

    if (!base64Image) {
      console.error('No image data provided');
      throw new Error('No image data provided');
    }

    console.log('Sending request to OpenAI...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert insurance policy analyzer. Extract coverage information and return it in this EXACT JSON format:
            {
              "coverageA": "$XXX,XXX",
              "coverageB": "$XXX,XXX",
              "coverageC": "$XXX,XXX",
              "coverageD": "$XXX,XXX",
              "deductible": "$X,XXX",
              "effectiveDate": "MM/DD/YYYY",
              "expirationDate": "MM/DD/YYYY"
            }
            Use "Not found" if a value cannot be determined. Do not include any additional text or explanation.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image_url: base64Image
              }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await openAIResponse.json();
    console.log('OpenAI response received:', JSON.stringify(data));

    if (!data.choices?.[0]?.message?.content) {
      console.error('Invalid OpenAI response structure:', data);
      throw new Error('Invalid response structure from OpenAI');
    }

    let content = data.choices[0].message.content.trim();
    console.log('Raw content from OpenAI:', content);

    // Clean up the content to ensure we get valid JSON
    if (content.includes('```json')) {
      content = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      content = content.split('```')[1].split('```')[0].trim();
    }

    // If there's still text before or after the JSON object, extract just the JSON
    if (content.includes('{')) {
      const startIndex = content.indexOf('{');
      const endIndex = content.lastIndexOf('}') + 1;
      content = content.substring(startIndex, endIndex);
    }

    console.log('Cleaned content before parsing:', content);

    let policyDetails;
    try {
      policyDetails = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse JSON response');
    }

    // Validate and ensure all required fields exist
    const requiredFields = ['coverageA', 'coverageB', 'coverageC', 'coverageD', 'deductible', 'effectiveDate', 'expirationDate'];
    for (const field of requiredFields) {
      if (!policyDetails[field]) {
        policyDetails[field] = 'Not found';
      }
      // Ensure currency fields have proper formatting
      if (['coverageA', 'coverageB', 'coverageC', 'coverageD', 'deductible'].includes(field)) {
        if (policyDetails[field] !== 'Not found' && !policyDetails[field].startsWith('$')) {
          policyDetails[field] = `$${policyDetails[field].replace(/^\$/, '')}`;
        }
      }
    }

    console.log('Final policy details:', JSON.stringify(policyDetails));

    return new Response(JSON.stringify(policyDetails), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-policy function:', error);
    return new Response(JSON.stringify({
      error: `Failed to process OpenAI response: ${error.message}`,
      coverageA: 'Error processing request',
      coverageB: 'Error processing request',
      coverageC: 'Error processing request',
      coverageD: 'Error processing request',
      deductible: 'Error processing request',
      effectiveDate: 'Error processing request',
      expirationDate: 'Error processing request'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});