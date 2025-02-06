import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { PolicyDetails } from '@/components/PolicyDetails';
import { WeatherEvents } from '@/components/WeatherEvents';
import { toast } from '@/components/ui/use-toast';
import { supabase } from "@/integrations/supabase/client";
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
  const [weatherEvents, setWeatherEvents] = useState([]);

  const handleFileUpload = async (files: File[]) => {
    setIsAnalyzing(true);
    const results = [];

    try {
      for (const file of files) {
        // Validate file type
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
          toast({
            title: "Invalid File Type",
            description: `File "${file.name}" skipped. Please upload only JPEG or PNG images.`,
            variant: "destructive",
          });
          continue;
        }

        // Convert the file to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64Image = await base64Promise;

        // Call the Supabase Edge Function to analyze the policy
        const { data, error } = await supabase.functions.invoke('analyze-policy', {
          body: { base64Image },
        });

        if (error) {
          toast({
            title: "Analysis Error",
            description: `Failed to analyze "${file.name}". ${error.message}`,
            variant: "destructive",
          });
          continue;
        }

        results.push(data);
      }

      setPolicyDetails(results);
      
      // For demo purposes, keeping the weather events mock data
      setWeatherEvents([
        {
          date: "2023-03-15",
          type: "hail",
          details: "Hail event with 1-inch hail reported"
        },
        {
          date: "2023-07-22",
          type: "wind",
          details: "High winds recorded at 45mph"
        }
      ]);

      toast({
        title: "Analysis Complete",
        description: `Successfully analyzed ${results.length} policy document(s).`,
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
          <WeatherEvents isLoading={isAnalyzing} events={weatherEvents} />
        </div>
      </div>
    </div>
  );
};

export default Index;