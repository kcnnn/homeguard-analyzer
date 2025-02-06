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
        content: `You are an expert insurance policy analyzer. Your task is to extract exact coverage and deductible information from insurance declaration pages.

CRITICAL - DEDUCTIBLES EXTRACTION:
You must find and extract TWO specific deductibles that are clearly stated on the declarations page:

1. Property Coverage Deductible (All Other Perils):
   - Look for a standard deductible amount shown as a dollar figure
   - Common labels include: "All Other Perils Deductible", "Standard Deductible", or simply "Deductible"
   - Example formats: "$1,000", "$2,500", "$5,000"
   - Return the EXACT dollar amount as shown

2. Windstorm/Hurricane Deductible:
   - This will be shown in TWO parts on the declarations page:
     a) A percentage (like "2% of Coverage A")
     b) The actual dollar amount this calculates to
   - IMPORTANT: Look for the pre-calculated dollar amount that's written on the page
   - This might appear as "2% ($8,000)" or similar format
   - Return ONLY the dollar amount portion, not the percentage

IMPORTANT NOTES:
- Do NOT perform any calculations yourself
- Only return dollar amounts that are explicitly shown on the page
- Include the dollar sign ($) in all monetary values
- If you can't find an exact amount, return "Not found"

Return a JSON object with these fields:
- coverageA (with $ sign)
- coverageB (with $ sign)
- coverageC (with $ sign)
- coverageD (with $ sign)
- deductible (exact All Other Perils amount with $ sign)
- windstormDeductible (exact calculated amount with $ sign)
- effectiveDate
- expirationDate`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please analyze this declaration page carefully. For both deductibles, return ONLY the exact dollar amounts shown on the page. For the Windstorm deductible, make sure to find and return the pre-calculated dollar amount, not the percentage.'
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