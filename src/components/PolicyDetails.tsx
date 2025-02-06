import { Card } from '@/components/ui/card';

interface PolicyDetailsProps {
  isLoading: boolean;
  policyDetails: {
    coverageA?: string;
    coverageB?: string;
    coverageC?: string;
    coverageD?: string;
    deductible?: string;
    windstormDeductible?: string;
    effectiveDate?: string;
    expirationDate?: string;
  } | null;
}

export const PolicyDetails = ({ isLoading, policyDetails }: PolicyDetailsProps) => {
  if (isLoading) {
    return (
      <Card className="w-full p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (!policyDetails) {
    return null;
  }

  return (
    <Card className="w-full p-6">
      <h2 className="text-2xl font-semibold mb-4">Policy Coverage Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-medium text-gray-600">Coverage A - Dwelling</h3>
          <p className="text-lg">{policyDetails.coverageA || 'Not found'}</p>
        </div>
        <div>
          <h3 className="font-medium text-gray-600">Coverage B - Other Structures</h3>
          <p className="text-lg">{policyDetails.coverageB || 'Not found'}</p>
        </div>
        <div>
          <h3 className="font-medium text-gray-600">Coverage C - Personal Property</h3>
          <p className="text-lg">{policyDetails.coverageC || 'Not found'}</p>
        </div>
        <div>
          <h3 className="font-medium text-gray-600">Coverage D - Loss of Use</h3>
          <p className="text-lg">{policyDetails.coverageD || 'Not found'}</p>
        </div>
        <div>
          <h3 className="font-medium text-gray-600">Property Coverage Deductible (All Other Perils)</h3>
          <p className="text-lg">{policyDetails.deductible || 'Not found'}</p>
        </div>
        <div>
          <h3 className="font-medium text-gray-600">Windstorm or Hail Deductible</h3>
          <p className="text-lg">{policyDetails.windstormDeductible || 'Not found'}</p>
        </div>
        <div>
          <h3 className="font-medium text-gray-600">Policy Period</h3>
          <p className="text-lg">
            {policyDetails.effectiveDate && policyDetails.expirationDate
              ? `${policyDetails.effectiveDate} to ${policyDetails.expirationDate}`
              : 'Not found'}
          </p>
        </div>
      </div>
    </Card>
  );
};