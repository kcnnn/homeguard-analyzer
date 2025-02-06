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

export interface OpenAIResponse {
  coverages: PolicyDetails;
  deductibles: {
    deductible: string;
    windstormDeductible: string;
  };
}