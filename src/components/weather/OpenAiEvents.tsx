import { Loader } from 'lucide-react';
import type { WeatherEvent } from '../WeatherEvents';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OpenAiEventsProps {
  isLoading: boolean;
  events: WeatherEvent[];
}

export const OpenAiEvents = ({ isLoading, events }: OpenAiEventsProps) => {
  return (
    <div className="mt-8 pt-8 border-t border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Additional Reported Events</h3>
      
      {/* Always show events if they exist */}
      {events.length > 0 && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            While no official NOAA records were found, our AI search found these potential weather events. Please note that these are not officially verified records.
          </p>
          <div className="space-y-4">
            {events.map((event, index) => (
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
        </>
      )}

      {/* Show loading state */}
      {isLoading && (
        <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-500">
          <Loader className="h-4 w-4 animate-spin" />
          <span>Searching additional sources...</span>
        </div>
      )}

      {/* Show no events message only when not loading and no events exist */}
      {!isLoading && events.length === 0 && (
        <Alert>
          <AlertDescription>
            No additional weather events were found for this location and time period.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};