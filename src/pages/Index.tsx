import { FileUpload } from '@/components/FileUpload';
import { WeatherEvents } from '@/components/WeatherEvents';
import { PolicyAnalysis } from '@/components/PolicyAnalysis';
import { useFileAnalysis } from '@/hooks/useFileAnalysis';
import { useWeatherEvents } from '@/hooks/useWeatherEvents';

const Index = () => {
  const {
    isAnalyzing,
    policyDetails,
    location,
    effectiveDate,
    expirationDate,
    analyzeFiles
  } = useFileAnalysis();

  const { data: weatherEvents = [], isLoading: isLoadingEvents } = useWeatherEvents(
    location,
    effectiveDate,
    expirationDate
  );

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