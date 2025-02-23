
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

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

    console.log('Processing images, count:', base64Images.length);
    
    try {
      // Process first image for coverages
      const firstImageUrl = `data:image/jpeg;base64,${base64Images[0].replace(/^data:image\/[a-z]+;base64,/, '')}`;
      
      console.log('Analyzing first image with OpenAI...');
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
              content: `Extract coverage amounts and dates from insurance policy declaration pages.
Return ONLY a JSON object with this structure:
{
  "coverageA": "$XXX,XXX",
  "coverageB": "$XX,XXX",
  "coverageC": "$XX,XXX",
  "coverageD": "$XX,XXX",
  "effectiveDate": "MM/DD/YYYY",
  "expirationDate": "MM/DD/YYYY",
  "location": "Full property address"
}`
            },
            {
              role: 'user',
              content: [{ type: 'image_url', image_url: { url: firstImageUrl } }]
            }
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API error:', errorData);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('OpenAI API Response:', data);

      const policyDetails = JSON.parse(data.choices[0].message.content);
      console.log('Extracted policy details:', policyDetails);

      return new Response(
        JSON.stringify(policyDetails),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }

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
        location: 'Error processing request'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
