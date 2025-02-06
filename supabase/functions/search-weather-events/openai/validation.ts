
import { WeatherEvent } from '../types.ts';

export const validateAndParseEvent = (event: any): WeatherEvent | null => {
  if (!event.date || !event.type || !event.details) {
    console.warn('Invalid event structure:', event);
    return null;
  }

  if (event.type !== 'hail' && event.type !== 'wind') {
    console.warn('Invalid event type:', event.type);
    return null;
  }

  // Ensure date is in YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(event.date)) {
    console.warn('Invalid date format:', event.date);
    return null;
  }

  return {
    date: event.date,
    type: event.type as 'hail' | 'wind',
    details: event.details,
    source: event.source || undefined,
    sourceUrl: event.sourceUrl || undefined
  };
};

export const parseOpenAIResponse = (content: string) => {
  try {
    console.log('Raw OpenAI response:', content);
    
    // Remove any markdown code block syntax if present
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    console.log('Cleaned content:', cleanedContent);
    
    const parsed = JSON.parse(cleanedContent);
    if (!parsed.events || !Array.isArray(parsed.events)) {
      console.warn('Invalid response structure:', parsed);
      return [];
    }

    return parsed.events
      .map(validateAndParseEvent)
      .filter((event): event is WeatherEvent => event !== null);
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    return [];
  }
};
