import { PolicyDetails } from './types.ts';
import { analyzeImageWithGPT } from './openAiService.ts';

export const analyzePolicyImages = async (
  base64Images: string[],
  openAIApiKey: string
): Promise<PolicyDetails> => {
  try {
    console.log('Processing images, count:', base64Images.length);
    
    // Process first image for coverages
    const firstImageUrl = `data:image/jpeg;base64,${base64Images[0].replace(/^data:image\/[a-z]+;base64,/, '')}`;
    const coverageData = await analyzeImageWithGPT(firstImageUrl, 'coverages', openAIApiKey);
    
    // Process second image for deductibles if available
    let deductibleData;
    if (base64Images.length > 1) {
      const secondImageUrl = `data:image/jpeg;base64,${base64Images[1].replace(/^data:image\/[a-z]+;base64,/, '')}`;
      deductibleData = await analyzeImageWithGPT(secondImageUrl, 'deductibles', openAIApiKey);
    } else {
      deductibleData = await analyzeImageWithGPT(firstImageUrl, 'deductibles', openAIApiKey);
    }

    return {
      ...coverageData,
      deductible: deductibleData?.deductible || 'Not found',
      windstormDeductible: deductibleData?.windstormDeductible || 'Not found',
    };
  } catch (error) {
    console.error('Error in analyzePolicyImages:', error);
    throw error;
  }
};