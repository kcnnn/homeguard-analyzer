import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from '@/components/ui/use-toast';

export interface PolicyDetails {
  coverageA?: string;
  coverageB?: string;
  coverageC?: string;
  coverageD?: string;
  deductible?: string;
  windstormDeductible?: string;
  effectiveDate?: string;
  expirationDate?: string;
  location?: string;
}

export const useFileAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [policyDetails, setPolicyDetails] = useState<PolicyDetails[]>([]);
  const [location, setLocation] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [expirationDate, setExpirationDate] = useState<string>('');

  const analyzeFiles = async (files: File[]) => {
    setIsAnalyzing(true);
    setPolicyDetails([]); // Clear existing policy details
    
    try {
      const base64Images = await Promise.all(files.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
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

  return {
    isAnalyzing,
    policyDetails,
    location,
    effectiveDate,
    expirationDate,
    analyzeFiles
  };
};