
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import type { WeatherEvent } from '@/components/WeatherEvents';

export const useWeatherEvents = (
  location: string,
  effectiveDate: string,
  expirationDate: string
) => {
  return useQuery({
    queryKey: ['weather-events', location, effectiveDate, expirationDate],
    queryFn: async () => {
      if (!location || !effectiveDate || !expirationDate) {
        console.log('Missing required parameters:', { location, effectiveDate, expirationDate });
        return [];
      }

      console.log('Searching for weather events with params:', { 
        location, 
        effectiveDate, 
        expirationDate 
      });

      try {
        const response = await supabase.functions.invoke('search-weather-events', {
          body: { 
            location,
            effectiveDate,
            expirationDate
          },
        });

        if (response.error) {
          console.error('Error searching for weather events:', response.error);
          return [];
        }

        console.log('Weather events API response:', response.data);
        
        if (response.data?.events) {
          const events = response.data.events.map((event: any) => ({
            date: event.date,
            type: event.type as 'hail' | 'wind',
            details: event.details,
            source: event.source || undefined,
            sourceUrl: event.sourceUrl || undefined,
          }));
          console.log('Processed weather events:', events);
          return events;
        }

        console.log('No events found in response');
        return [];
      } catch (error) {
        console.error('Error calling search-weather-events function:', error);
        return [];
      }
    },
    enabled: !!(location && effectiveDate && expirationDate),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep data in cache for 30 minutes
    retry: 1, // Only retry once on failure
  });
};
