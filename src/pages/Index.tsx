import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { PolicyDetails } from '@/components/PolicyDetails';
import { WeatherEvents } from '@/components/WeatherEvents';
import { toast } from '@/components/ui/use-toast';

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [policyDetails, setPolicyDetails] = useState(null);
  const [weatherEvents, setWeatherEvents] = useState([]);

  const handleFileUpload = async (file: File) => {
    setIsAnalyzing(true);
    try {
      // Simulate API call for demo purposes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock data for demonstration
      setPolicyDetails({
        coverageA: "$500,000",
        coverageB: "$50,000",
        coverageC: "$250,000",
        coverageD: "$100,000",
        deductible: "$2,500",
        effectiveDate: "2023-01-01",
        expirationDate: "2024-01-01"
      });

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
        description: "Your policy has been successfully analyzed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to analyze the policy. Please try again.",
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
          <PolicyDetails isLoading={isAnalyzing} policyDetails={policyDetails} />
          <WeatherEvents isLoading={isAnalyzing} events={weatherEvents} />
        </div>
      </div>
    </div>
  );
};

export default Index;