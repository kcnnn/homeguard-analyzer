import { Card } from '@/components/ui/card';

interface WeatherEvent {
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
  if (isLoading) {
    return (
      <Card className="w-full p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
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
      {events.length === 0 ? (
        <p className="text-gray-500">No weather events found for the policy period at this location.</p>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
            <div
              key={index}
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
    </Card>
  );
};