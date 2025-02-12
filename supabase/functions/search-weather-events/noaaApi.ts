
import { WeatherEvent } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedLocation {
  street: string;
  city: string;
  state: string;
}

export function parseLocation(location: string): ParsedLocation {
  let street = '';
  let city = '';
  let state = '';

  if (location.includes(',')) {
    const parts = location.split(',').map(part => part.trim());
    
    street = parts[0];

    if (parts.length > 1) {
      city = parts[1].trim();
    }

    if (parts.length > 2) {
      const lastPart = parts[parts.length - 1];
      const stateMatch = lastPart.match(/([A-Z]{2})/);
      if (stateMatch) {
        state = stateMatch[1];
      }
    }

    console.log('Parsed address components:', { street, city, state });
  }

  return { street, city, state };
}

export async function searchNOAAEvents(
  location: string,
  startDate: string,
  endDate: string
): Promise<WeatherEvent[]> {
  try {
    const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
    const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
    const { city, state } = parseLocation(location);

    if (!city || !state) {
      console.warn('Could not parse city and state from location:', location);
      return [];
    }

    // Use the Storm Events Database instead of GHCND
    const baseUrl = 'https://www.ncdc.noaa.gov/cdo-web/api/v2/data';
    const url = new URL(baseUrl);
    url.searchParams.append('datasetid', 'GHCND');
    url.searchParams.append('locationid', `CITY:US${state}${city.toUpperCase()}`);
    url.searchParams.append('startdate', formattedStartDate);
    url.searchParams.append('enddate', formattedEndDate);
    url.searchParams.append('datatypeid', 'AWND,PRCP'); // Average daily wind speed and precipitation
    url.searchParams.append('limit', '1000');
    
    console.log('NOAA API URL:', url.toString());
    console.log('Using NOAA API Key:', Deno.env.get('NOAA_API_KEY') ? 'Key is present' : 'No key found');

    const response = await fetch(url.toString(), {
      headers: {
        'token': Deno.env.get('NOAA_API_KEY') || ''
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NOAA API Error:', response.status, errorText);
      
      // Try the Storm Events Database as a fallback
      const stormEventsUrl = new URL('https://www.ncdc.noaa.gov/stormevents/csv');
      stormEventsUrl.searchParams.append('beginDate', formattedStartDate.replace(/-/g, ''));
      stormEventsUrl.searchParams.append('endDate', formattedEndDate.replace(/-/g, ''));
      stormEventsUrl.searchParams.append('state', state);
      
      console.log('Trying Storm Events Database:', stormEventsUrl.toString());
      
      const stormResponse = await fetch(stormEventsUrl.toString(), {
        headers: {
          'token': Deno.env.get('NOAA_API_KEY') || ''
        }
      });

      if (!stormResponse.ok) {
        console.error('Storm Events API Error:', stormResponse.status);
        return [];
      }

      const stormData = await stormResponse.text();
      console.log('Storm Events Data:', stormData);

      // Parse CSV data and convert to WeatherEvent format
      const events = stormData
        .split('\n')
        .slice(1) // Skip header row
        .filter(line => line.includes('HAIL') || line.includes('WIND'))
        .map(line => {
          const [date, eventType, ...details] = line.split(',');
          return {
            date: new Date(date).toISOString().split('T')[0],
            type: eventType.includes('HAIL') ? 'hail' : 'wind',
            details: details.join(' '),
            source: 'NOAA Storm Events Database',
            sourceUrl: 'https://www.ncdc.noaa.gov/stormevents/'
          };
        });

      console.log('Processed Storm Events:', events);
      return events;
    }

    const data = await response.json();
    console.log('NOAA API Response:', JSON.stringify(data, null, 2));

    if (!data.results || !Array.isArray(data.results)) {
      console.log('No results found in NOAA response');
      return [];
    }

    const events = data.results
      .filter((event: any) => event.datatype && event.date)
      .map((event: any) => {
        const isHail = event.value > 0 && event.datatype === 'PRCP';
        const isWind = event.datatype === 'AWND' && event.value > 20; // Wind speed > 20 mph
        
        if (!isHail && !isWind) return null;
        
        const details = isHail 
          ? `Precipitation recorded: ${event.value} ${event.unit || 'inches'}`
          : `Wind speed recorded: ${event.value} ${event.unit || 'mph'}`;
        
        return {
          date: event.date.split('T')[0],
          type: isHail ? 'hail' : 'wind',
          details,
          source: 'NOAA National Weather Service',
          sourceUrl: 'https://www.ncdc.noaa.gov/cdo-web/',
        };
      })
      .filter((event): event is WeatherEvent => event !== null);

    console.log('Processed NOAA events:', events);
    return events;
  } catch (error) {
    console.error('Error fetching NOAA data:', error);
    return [];
  }
}
