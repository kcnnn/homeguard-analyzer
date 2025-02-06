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

// Import the WeatherEvent type from the WeatherEvents component
import type { WeatherEvent } from '@/components/WeatherEvents';

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [policyDetails, setPolicyDetails] = useState<any[]>([]);
  const [location, setLocation] = useState<string>('');

  const { data: weatherEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['weather-events', location],
    queryFn: async () => {
      if (!location) return [];
      const { data, error } = await supabase
        .from('weather_events')
        .select('*')
        .eq('location', location)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching weather events:', error);
        toast({
          title: "Error",
          description: "Failed to fetch weather events",
          variant: "destructive",
        });
        return [];
      }

      // Validate and transform the data to match WeatherEvent type
      return (data || []).map(event => {
        // Ensure type is either 'hail' or 'wind'
        if (event.type !== 'hail' && event.type !== 'wind') {
          console.warn(`Invalid weather event type: ${event.type}, defaulting to 'wind'`);
          event.type = 'wind';
        }

        return {
          date: event.date,
          type: event.type as 'hail' | 'wind',
          details: event.details,
          source: event.source || undefined,
          sourceUrl: event.source_url || undefined,
        } satisfies WeatherEvent;
      });
    },
    enabled: !!location,
  });

  const handleFileUpload = async (files: File[]) => {
    setIsAnalyzing(true);
    const results = [];

    try {
      // Convert all files to base64
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

      results.push(data);
      
      // Update location from the response
      if (data.location) {
        setLocation(data.location);
      }

      setPolicyDetails(results);

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