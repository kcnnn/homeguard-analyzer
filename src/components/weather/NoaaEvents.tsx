import { Card } from '@/components/ui/card';
import type { WeatherEvent } from '../WeatherEvents';

interface NoaaEventsProps {
  events: WeatherEvent[];
}

export const NoaaEvents = ({ events }: NoaaEventsProps) => {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">NOAA Weather Service Events</h3>
      {events.length === 0 ? (
        <p className="text-gray-500">No official weather events found for the policy period at this location.</p>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
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
  );
};