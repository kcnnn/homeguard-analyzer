export const createSystemPrompt = () => `You are a weather research assistant specializing in finding historical hail and windstorm events. 
Your task is to search for and report any hail or severe wind events that occurred at or near the specified location during the given time period.
Use your web browsing capabilities to find accurate information from reliable sources.
You must return events in the exact format specified.
For each event found:
- Include the specific date in YYYY-MM-DD format
- For hail events, include hail sizes when available
- For wind events, include wind speeds when available
- Include any reported damage
- Be specific about locations
- Type must be either 'hail' or 'wind'
- Include source URLs when available
You must respond with properly formatted JSON only.`;

export const createUserPrompt = (location: string, startDate: string, endDate: string) => 
  `Search for any hail or severe wind events that occurred at or near ${location} between ${startDate} and ${endDate}.
  Use web browsing to find accurate information from weather reports, news articles, and official sources.
  You must return the results in this exact JSON format:
  {
    "events": [
      {
        "date": "YYYY-MM-DD",
        "type": "hail",
        "details": "Detailed description including sizes and damage",
        "source": "Local Weather Report",
        "sourceUrl": "https://example.com/event"
      }
    ]
  }
  The type field must be either "hail" or "wind". The date must be in YYYY-MM-DD format.
  If no events are found, return an empty events array.`;