import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { PolicyDetails } from '@/components/PolicyDetails';
import { WeatherEvents } from '@/components/WeatherEvents';
import { toast } from '@/components/ui/use-toast';
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [policyDetails, setPolicyDetails] = useState<any[]>([]);
  const [location, setLocation] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [expirationDate, setExpirationDate] = useState<string>('');

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
          toast({
            title: "Error",
            description: "Failed to search for weather events",
            variant: "destructive",
          });
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
        toast({
          title: "Error",
          description: "Failed to search for weather events",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: !!(location && effectiveDate && expirationDate),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep data in cache for 30 minutes (renamed from cacheTime)
    retry: 1, // Only retry once on failure
  });

  const handleFileUpload = async (files: File[]) => {
    setIsAnalyzing(true);
    setPolicyDetails([]); // Clear existing policy details
    
    try {
      const base64Images = await Promise.all(files.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }));

      const { data, error } = await supabase.functions.invoke('analyze-policy', {
        body: { base64Images },
      });

      if (error) {
        toast({
          title: "Analysis Error",
          description: `Failed to analyze policy documents. ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Update state in a single batch to prevent multiple re-renders
      const updates = {
        location: data.location || '',
        effectiveDate: data.effectiveDate || '',
        expirationDate: data.expirationDate || '',
        policyDetails: [data]
      };

      setLocation(updates.location);
      setEffectiveDate(updates.effectiveDate);
      setExpirationDate(updates.expirationDate);
      setPolicyDetails(updates.policyDetails);

      toast({
        title: "Analysis Complete",
        description: `Successfully analyzed ${files.length} policy document(s).`,
      });
    } catch (error) {
      console.error('Error analyzing policies:', error);
      toast({
        title: "Error",
        description: "Failed to analyze the policies. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          Insurance Policy Analyzer
        </h1>
        <div className="max-w-4xl mx-auto space-y-8">
          <FileUpload onFileUpload={handleFileUpload} />
          {policyDetails.length > 0 && (
            <Carousel className="w-full">
              <CarouselContent>
                {policyDetails.map((details, index) => (
                  <CarouselItem key={index}>
                    <PolicyDetails isLoading={isAnalyzing} policyDetails={details} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}
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