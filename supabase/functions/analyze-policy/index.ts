import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { analyzePolicyImages } from './policyAnalyzer.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
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

    console.log('Starting policy analysis...');
    const policyDetails = await analyzePolicyImages(base64Images, openAIApiKey);
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
        location: 'Error processing request'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});