import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PolicyDetails {
  coverageA: string;
  coverageB: string;
  coverageC: string;
  coverageD: string;
  deductible: string;
  windstormDeductible: string;
  effectiveDate: string;
  expirationDate: string;
}

const formatBase64Image = (base64Image: string): string => {
  return base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
};

const createOpenAIRequest = (imageUrl: string) => {
  return {
    model: "gpt-4o",
    messages: [
      {
        role: 'system',
        content: `You are an expert insurance policy analyzer. Your primary task is to accurately extract coverage and deductible information from insurance declaration pages.

CRITICAL - DEDUCTIBLES EXTRACTION:
You must carefully locate and extract TWO distinct deductibles that appear on the declarations page:

1. Property Coverage Deductible (All Other Perils):
   - This is a straightforward dollar amount (e.g., $1,000, $2,500, $5,000)
   - It's typically labeled as "Deductible" or "All Other Perils Deductible"
   - Return the exact dollar amount you find

2. Windstorm or Hail Deductible:
   - This appears as a percentage of Coverage A (e.g., 2% of Coverage A)
   - The declarations page will show BOTH:
     a) The percentage (like 2%)
     b) The actual calculated dollar amount
   - You must return the actual calculated dollar amount shown on the page
   - Do NOT calculate this yourself - use the exact dollar amount listed

Return ONLY a JSON object with these fields:
- coverageA (include dollar sign)
- coverageB (include dollar sign)
- coverageC (include dollar sign)
- coverageD (include dollar sign)
- deductible (the All Other Perils deductible amount)
- windstormDeductible (the actual calculated dollar amount for Wind/Hail)
- effectiveDate
- expirationDate

Use "Not found" if you cannot locate a specific value. For both deductibles, you must return the exact dollar amounts as they appear on the declarations page.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please analyze this insurance declaration page. Focus specifically on finding both deductibles. For the Property Coverage Deductible, find the fixed dollar amount. For the Windstorm/Hail Deductible, locate and return the actual calculated dollar amount shown on the page (not the percentage). Return all information in JSON format.'
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
  };
};

const callOpenAI = async (requestBody: any) => {
  console.log('Calling OpenAI API...');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('OpenAI API error:', errorData);
    throw new Error(`OpenAI API error: ${JSON.stringify(errorData.error || errorData)}`);
  }

  return response.json();
};

const parseOpenAIResponse = (content: string): string => {
  console.log('Raw OpenAI response:', content);
  
  try {
    // Try to parse the content directly first
    JSON.parse(content);
    return content;
  } catch (e) {
    // If direct parsing fails, try to extract JSON
    try {
      if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim();
      }

      // Find the first { and last }
      const startIndex = content.indexOf('{');
      const endIndex = content.lastIndexOf('}') + 1;
      
      if (startIndex === -1 || endIndex === 0) {
        throw new Error('No valid JSON object found in response');
      }
      
      content = content.substring(startIndex, endIndex);
      
      // Validate that we can parse this JSON
      JSON.parse(content);
      return content;
    } catch (e) {
      console.error('Error parsing OpenAI response:', e);
      throw new Error('Failed to parse OpenAI response into valid JSON');
    }
  }
};

const formatPolicyDetails = (rawDetails: any): PolicyDetails => {
  console.log('Formatting policy details:', rawDetails);
  
  const defaultDetails: PolicyDetails = {
    coverageA: 'Not found',
    coverageB: 'Not found',
    coverageC: 'Not found',
    coverageD: 'Not found',
    deductible: 'Not found',
    windstormDeductible: 'Not found',
    effectiveDate: 'Not found',
    expirationDate: 'Not found'
  };

  const currencyFields = ['coverageA', 'coverageB', 'coverageC', 'coverageD', 'deductible', 'windstormDeductible'];
  
  Object.keys(defaultDetails).forEach(field => {
    if (rawDetails[field] && typeof rawDetails[field] === 'string') {
      let value = rawDetails[field];
      
      if (currencyFields.includes(field) && value !== 'Not found') {
        // Remove any existing currency symbols and formatting
        value = value.replace(/[^0-9.]/g, '');
        if (!isNaN(parseFloat(value))) {
          value = `$${value}`;
        }
      }
      
      defaultDetails[field as keyof PolicyDetails] = value;
    }
  });

  return defaultDetails;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting policy analysis...');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    const { base64Image } = await req.json();
    if (!base64Image) {
      console.error('No image data provided');
      throw new Error('No image data provided');
    }

    const formattedBase64 = formatBase64Image(base64Image);
    const imageUrl = `data:image/jpeg;base64,${formattedBase64}`;
    
    console.log('Preparing request to OpenAI...');
    const requestBody = createOpenAIRequest(imageUrl);
    
    const data = await callOpenAI(requestBody);
    console.log('OpenAI response received');

    if (!data.choices?.[0]?.message?.content) {
      console.error('Invalid OpenAI response structure:', data);
      throw new Error('Invalid response structure from OpenAI');
    }

    const content = parseOpenAIResponse(data.choices[0].message.content.trim());
    console.log('Parsed content:', content);

    const parsedDetails = JSON.parse(content);
    const formattedDetails = formatPolicyDetails(parsedDetails);

    console.log('Sending formatted response:', formattedDetails);
    return new Response(JSON.stringify(formattedDetails), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-policy function:', error);
    
    const errorResponse = {
      error: error.message || 'An unexpected error occurred',
      coverageA: 'Error processing request',
      coverageB: 'Error processing request',
      coverageC: 'Error processing request',
      coverageD: 'Error processing request',
      deductible: 'Error processing request',
      windstormDeductible: 'Error processing request',
      effectiveDate: 'Error processing request',
      expirationDate: 'Error processing request'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});