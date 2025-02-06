import { Card } from '@/components/ui/card';
import { Loader } from 'lucide-react';

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

  if (isLoading) {
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
      <h2 className="text-2xl font-semibold mb-2">Weather Events</h2>
      {location && (
        <p className="text-gray-600 mb-4">
          Location: {location}
        </p>
      )}

      {/* NOAA Events Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">NOAA Weather Service Events</h3>
        {noaaEvents.length === 0 ? (
          <p className="text-gray-500">No official weather events found for the policy period at this location.</p>
        ) : (
          <div className="space-y-4">
            {noaaEvents.map((event, index) => (
              <div
                key={`noaa-${index}`}
                className="flex items-start space-x-4 p-4 rounded-lg bg-gray-50"
              >
                <div className="text-2xl">
                  {event.type === 'hail' ? '🌨️' : '💨'}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{event.date}</p>
                  <p className="text-gray-600">{event.details}</p>
                  {event.source && event.sourceUrl && (
                    <p className="text-sm mt-2">
                      Source:{' '}
                      <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {event.source}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OpenAI Events Section */}
      {noaaEvents.length === 0 && openaiEvents.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Additional Reported Events</h3>
          <p className="text-sm text-gray-500 mb-4">
            While no official NOAA records were found, our AI search found these potential weather events. Please note that these are not officially verified records.
          </p>
          <div className="space-y-4">
            {openaiEvents.map((event, index) => (
              <div
                key={`openai-${index}`}
                className="flex items-start space-x-4 p-4 rounded-lg bg-yellow-50"
              >
                <div className="text-2xl">
                  {event.type === 'hail' ? '🌨️' : '💨'}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{event.date}</p>
                  <p className="text-gray-600">{event.details}</p>
                  {event.source && event.sourceUrl && (
                    <p className="text-sm mt-2">
                      Source:{' '}
                      <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {event.source}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};