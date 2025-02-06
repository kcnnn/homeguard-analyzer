import { PolicyDetails } from './types.ts';

const createPrompt = (type: 'coverages' | 'deductibles'): string => {
  if (type === 'coverages') {
    return `Extract coverage amounts and dates from insurance policy declaration pages.
Return ONLY a JSON object with this structure:
{
  "coverageA": "$XXX,XXX",
  "coverageB": "$XX,XXX",
  "coverageC": "$XX,XXX",
  "coverageD": "$XX,XXX",
  "effectiveDate": "MM/DD/YYYY",
  "expirationDate": "MM/DD/YYYY",
  "location": "Full property address"
}`;
  }
  
  return `Look for these specific deductibles:
1. The "All Other Perils" (AOP) deductible
2. The "Wind/Hail" or "Named Storm" deductible (fixed amount or percentage)

Return ONLY a JSON object with this structure:
{
  "deductible": "$X,XXX",
  "windstormDeductible": "$X,XXX or X%"
}`;
};

const cleanJsonResponse = (content: string): any => {
  const cleanContent = content.trim().replace(/```json\n|\n```|```/g, '');
  const jsonStart = cleanContent.indexOf('{');
  const jsonEnd = cleanContent.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No valid JSON object found in response');
  }
  
  const jsonStr = cleanContent.slice(jsonStart, jsonEnd + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    throw new Error('Invalid JSON structure in response');
  }
};

export const analyzeImageWithGPT = async (
  imageUrl: string,
  type: 'coverages' | 'deductibles',
  openAIApiKey: string
): Promise<any> => {
  console.log(`Analyzing image for ${type}...`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: createPrompt(type) },
          { 
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: imageUrl } }]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return cleanJsonResponse(data.choices[0].message.content);
  } catch (error) {
    console.error('Error in analyzeImageWithGPT:', error);
    throw error;
  }
};