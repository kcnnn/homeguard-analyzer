import { PolicyDetails } from '@/components/PolicyDetails';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface PolicyAnalysisProps {
  isAnalyzing: boolean;
  policyDetails: any[];
}

export const PolicyAnalysis = ({ isAnalyzing, policyDetails }: PolicyAnalysisProps) => {
  if (policyDetails.length === 0) {
    return null;
  }

  return (
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
  );
};