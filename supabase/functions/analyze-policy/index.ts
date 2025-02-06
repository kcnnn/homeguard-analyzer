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

    // Ensure the base64 string is properly formatted for OpenAI
    const formattedBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageUrl = `data:image/jpeg;base64,${formattedBase64}`;

    console.log('Preparing request to OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: 'system',
            content: 'You are an expert insurance policy analyzer. Extract coverage information from the image and return it in JSON format with coverageA, coverageB, coverageC, coverageD, deductible, effectiveDate, and expirationDate fields. Use "Not found" if a value cannot be determined.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this insurance policy declaration page and extract the coverage information.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    console.log('OpenAI API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData.error || errorData)}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');

    if (!data.choices?.[0]?.message?.content) {
      console.error('Invalid OpenAI response structure:', data);
      throw new Error('Invalid response structure from OpenAI');
    }

    let content = data.choices[0].message.content.trim();
    console.log('Raw content from OpenAI:', content);

    // Parse the JSON response
    let policyDetails;
    try {
      // If the content is wrapped in code blocks, extract just the JSON
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

      policyDetails = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      throw new Error('Failed to parse policy details from OpenAI response');
    }

    // Ensure all required fields exist with proper formatting
    const requiredFields = ['coverageA', 'coverageB', 'coverageC', 'coverageD', 'deductible', 'effectiveDate', 'expirationDate'];
    const currencyFields = ['coverageA', 'coverageB', 'coverageC', 'coverageD', 'deductible'];
    
    // Initialize default values for all fields
    const formattedDetails = requiredFields.reduce((acc, field) => {
      acc[field] = 'Not found';
      return acc;
    }, {} as Record<string, string>);

    // Update with actual values where available
    for (const field of requiredFields) {
      if (policyDetails[field] && typeof policyDetails[field] === 'string') {
        let value = policyDetails[field];
        
        // Handle currency formatting for specific fields
        if (currencyFields.includes(field) && value !== 'Not found') {
          // Remove any existing currency symbols and formatting
          value = value.replace(/[^0-9.]/g, '');
          // Add dollar sign if it's a valid number
          if (!isNaN(parseFloat(value))) {
            value = `$${value}`;
          }
        }
        
        formattedDetails[field] = value;
      }
    }

    console.log('Sending response:', formattedDetails);

    return new Response(JSON.stringify(formattedDetails), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-policy function:', error);
    
    // Create a user-friendly error response
    const errorResponse = {
      error: error.message || 'An unexpected error occurred',
      coverageA: 'Error processing request',
      coverageB: 'Error processing request',
      coverageC: 'Error processing request',
      coverageD: 'Error processing request',
      deductible: 'Error processing request',
      effectiveDate: 'Error processing request',
      expirationDate: 'Error processing request'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});