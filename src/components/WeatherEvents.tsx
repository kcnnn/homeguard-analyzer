import { Card } from '@/components/ui/card';
import { Loader } from 'lucide-react';
import { NoaaEvents } from './weather/NoaaEvents';
import { OpenAiEvents } from './weather/OpenAiEvents';

export interface WeatherEvent {
  date: string;
  type: 'hail' | 'wind';
  details: string;
  source?: string;
  sourceUrl?: string;
}

interface WeatherEventsProps {
  isLoading: boolean;
  events: WeatherEvent[];
  location?: string;
}

export const WeatherEvents = ({ isLoading, events, location }: WeatherEventsProps) => {
  // Separate NOAA and OpenAI events
  const noaaEvents = events.filter(event => event.source?.includes('NOAA'));
  const openaiEvents = events.filter(event => !event.source?.includes('NOAA'));

  // Show loading state for initial load
  if (isLoading && events.length === 0) {
    return (
      <Card className="w-full p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Searching for weather events...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-semibold">Weather Events</h2>
        {isLoading && (
          <Loader className="h-5 w-5 animate-spin text-primary" />
        )}
      </div>
      
      {location && (
        <p className="text-gray-600 mb-4">
          Location: {location}
        </p>
      )}
      
      <NoaaEvents events={noaaEvents} />
      <OpenAiEvents isLoading={isLoading} events={openaiEvents} />
    </Card>
  );
};