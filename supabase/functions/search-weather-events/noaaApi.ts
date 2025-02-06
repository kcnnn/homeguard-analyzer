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

    const url = `https://www.ncdc.noaa.gov/cdo-web/api/v2/data?datasetid=GHCND&datatypeid=GH,WS&startdate=${formattedStartDate}&enddate=${formattedEndDate}&limit=1000`;
    
    console.log('NOAA API URL:', url);
    console.log('Using NOAA API Key:', Deno.env.get('NOAA_API_KEY') ? 'Key is present' : 'No key found');
    console.log('Searching for events in:', { city, state });

    const response = await fetch(url, {
      headers: {
        'token': Deno.env.get('NOAA_API_KEY') || ''
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NOAA API Error:', response.status, errorText);
      return [];
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
        const isHail = event.datatype === 'GH' || event.datatype.includes('HAIL');
        const isWind = event.datatype === 'WS' || event.datatype.includes('WIND');
        
        const details = `${isHail ? 'Hail' : 'Wind'} Event - ${event.datatype}: ${event.value} ${event.unit || ''}`;
        
        return {
          date: event.date.split('T')[0],
          type: isHail ? 'hail' : 'wind',
          details,
          source: 'NOAA National Weather Service',
          sourceUrl: 'https://www.ncdc.noaa.gov/stormevents/',
        };
      });

    console.log('Processed NOAA events:', events);
    return events;
  } catch (error) {
    console.error('Error fetching NOAA data:', error);
    return [];
  }
}