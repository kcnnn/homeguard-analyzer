import { FileUpload } from '@/components/FileUpload';
import { WeatherEvents } from '@/components/WeatherEvents';
import { PolicyAnalysis } from '@/components/PolicyAnalysis';
import { useFileAnalysis } from '@/hooks/useFileAnalysis';
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';

const Index = () => {
  const {
    isAnalyzing,
    policyDetails,
    location,
    effectiveDate,
    expirationDate,
    analyzeFiles
  } = useFileAnalysis();

  const { data: weatherEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['weather-events', location, effectiveDate, expirationDate],
    queryFn: async () => {
      if (!location || !effectiveDate || !expirationDate) return [];

      console.log('Searching for weather events with params:', { location, effectiveDate, expirationDate });

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

        console.log('Successfully searched for weather events:', response.data);
        
        if (response.data?.events) {
          return response.data.events.map((event: any) => ({
            date: event.date,
            type: event.type as 'hail' | 'wind',
            details: event.details,
            source: event.source || undefined,
            sourceUrl: event.sourceUrl || undefined,
          }));
        }

        return [];
      } catch (error) {
        console.error('Error calling search-weather-events function:', error);
        return [];
      }
    },
    enabled: !!(location && effectiveDate && expirationDate),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep data in cache for 30 minutes (renamed from cacheTime)
    retry: 1, // Only retry once on failure
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          Insurance Policy Analyzer
        </h1>
        <div className="max-w-4xl mx-auto space-y-8">
          <FileUpload onFileUpload={analyzeFiles} />
          <PolicyAnalysis 
            isAnalyzing={isAnalyzing}
            policyDetails={policyDetails}
          />
          <WeatherEvents 
            isLoading={isLoadingEvents} 
            events={weatherEvents}
            location={location} 
          />
        </div>
      </div>
    </div>
  );
};

export default Index;