
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

  // First, try to extract state code
  const stateMatch = location.match(/\b([A-Z]{2})\b/);
  if (stateMatch) {
    state = stateMatch[1];
  }

  // Split the location string by commas
  const parts = location.split(',').map(part => part.trim());
  
  if (parts.length >= 2) {
    // Last part might contain the state
    const lastPart = parts[parts.length - 1];
    if (!state) {
      const stateInLast = lastPart.match(/\b([A-Z]{2})\b/);
      if (stateInLast) {
        state = stateInLast[1];
      }
    }

    // Second to last part is usually the city
    city = parts[parts.length - 2].trim();
    
    // First part is usually the street
    street = parts[0].trim();
  }

  console.log('Parsed location:', { street, city, state });
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

    // First try the Storm Events Database
    const stormEventsUrl = new URL('https://www.ncdc.noaa.gov/stormevents/listevents.jsp');
    stormEventsUrl.searchParams.append('beginDate', formattedStartDate.replace(/-/g, ''));
    stormEventsUrl.searchParams.append('endDate', formattedEndDate.replace(/-/g, ''));
    stormEventsUrl.searchParams.append('state', state);
    stormEventsUrl.searchParams.append('eventType', 'ALL'); // Include all severe weather events
    stormEventsUrl.searchParams.append('county', city);
    
    console.log('Trying Storm Events Database:', stormEventsUrl.toString());
    
    const stormResponse = await fetch(stormEventsUrl.toString(), {
      headers: {
        'token': Deno.env.get('NOAA_API_KEY') || ''
      }
    });

    // If Storm Events fails, try the CDO Web API
    if (!stormResponse.ok) {
      console.log('Storm Events API failed, trying CDO Web API');
      
      const cdoUrl = new URL('https://www.ncdc.noaa.gov/cdo-web/api/v2/data');
      cdoUrl.searchParams.append('datasetid', 'GHCND');
      cdoUrl.searchParams.append('locationid', `CITY:US${state}`);
      cdoUrl.searchParams.append('startdate', formattedStartDate);
      cdoUrl.searchParams.append('enddate', formattedEndDate);
      cdoUrl.searchParams.append('datatypeid', 'AWND,PRCP,WT03,WT04'); // Wind, Precipitation, Thunder, Hail
      cdoUrl.searchParams.append('limit', '1000');
      
      console.log('NOAA CDO API URL:', cdoUrl.toString());
      console.log('NOAA API Key present:', !!Deno.env.get('NOAA_API_KEY'));

      const cdoResponse = await fetch(cdoUrl.toString(), {
        headers: {
          'token': Deno.env.get('NOAA_API_KEY') || ''
        }
      });

      if (!cdoResponse.ok) {
        console.error('CDO API Error:', cdoResponse.status);
        return [];
      }

      const data = await cdoResponse.json();
      console.log('CDO API Response:', JSON.stringify(data, null, 2));

      const events = data.results
        ?.filter((event: any) => event.datatype && event.date)
        .map((event: any) => {
          const isHail = event.datatype === 'WT04' || (event.datatype === 'PRCP' && event.value > 0.5);
          const isWind = event.datatype === 'AWND' && event.value > 20;
          
          if (!isHail && !isWind) return null;
          
          return {
            date: event.date.split('T')[0],
            type: isHail ? 'hail' : 'wind',
            details: `${isHail ? 'Hail' : 'High winds'} recorded at ${city}, ${state}. ${
              isHail ? `Precipitation: ${event.value} inches` : `Wind speed: ${event.value} mph`
            }`,
            source: 'NOAA National Weather Service',
            sourceUrl: 'https://www.ncdc.noaa.gov/cdo-web/'
          };
        })
        .filter((event): event is WeatherEvent => event !== null);

      return events || [];
    }

    // Parse Storm Events response
    const stormData = await stormResponse.text();
    console.log('Storm Events raw data:', stormData);
    
    const events = stormData
      .split('\n')
      .slice(1) // Skip header row
      .filter(line => line.trim() && (line.includes('HAIL') || line.includes('WIND')))
      .map(line => {
        const [date, eventType, magnitude, ...details] = line.split(',');
        return {
          date: new Date(date).toISOString().split('T')[0],
          type: eventType.toUpperCase().includes('HAIL') ? 'hail' : 'wind',
          details: `${eventType} event in ${city}, ${state}. ${
            magnitude ? `Magnitude: ${magnitude}. ` : ''
          }${details.join(' ')}`.trim(),
          source: 'NOAA Storm Events Database',
          sourceUrl: 'https://www.ncdc.noaa.gov/stormevents/'
        };
      });

    console.log('Processed Storm Events:', events);
    return events;
  } catch (error) {
    console.error('Error fetching NOAA data:', error);
    return [];
  }
}
