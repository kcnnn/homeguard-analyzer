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
            content: `You are an expert insurance policy analyzer. Your task is to extract specific coverage information and return it in a strict JSON format. The response must be a valid JSON object with these exact fields: coverageA, coverageB, coverageC, coverageD, deductible, effectiveDate, and expirationDate. All values must be strings. Currency values must include the dollar sign and commas (e.g., "$250,000"). Dates must be in MM/DD/YYYY format.`
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
                text: 'Extract the coverage information and return it as a JSON object. Include ONLY these fields: coverageA, coverageB, coverageC, coverageD, deductible, effectiveDate, and expirationDate. Do not include any explanatory text or markdown formatting.'
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
      
      // Clean up the content to ensure we get valid JSON
      let jsonContent = content.trim();
      
      // Remove any markdown formatting
      if (jsonContent.includes('```json')) {
        jsonContent = jsonContent.split('```json')[1].split('```')[0].trim();
      } else if (jsonContent.includes('```')) {
        jsonContent = jsonContent.split('```')[1].split('```')[0].trim();
      }
      
      // If there's still text before or after the JSON object, extract just the JSON
      if (jsonContent.includes('{')) {
        const startIndex = jsonContent.indexOf('{');
        const endIndex = jsonContent.lastIndexOf('}') + 1;
        jsonContent = jsonContent.substring(startIndex, endIndex);
      }
      
      console.log('Cleaned content before parsing:', jsonContent);
      
      try {
        policyDetails = JSON.parse(jsonContent);
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
      
      console.log('Successfully parsed and validated policy details:', policyDetails);
    } catch (error) {
      console.error('Error processing OpenAI response:', error);
      throw new Error(`Failed to process OpenAI response: ${error.message}`);
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
      effectiveDate: 'Error processing request',
      expirationDate: 'Error processing request'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});