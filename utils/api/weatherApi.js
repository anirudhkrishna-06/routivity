import axios from 'axios';

const OPENWEATHER_API_KEY = '48d89ccf2d58499a882fdd8d4ec6424c';
const OPENWEATHER_URL = 'https://api.openweathermap.org/data/2.5/forecast';

export const getWeatherData = async (lat, lng) => {
  try {
    const response = await axios.get(OPENWEATHER_URL, {
      params: {
        lat,
        lon: lng,
        appid: OPENWEATHER_API_KEY,
        units: 'metric',
        cnt: 8, // Get 8 forecasts (3-hour intervals for 24 hours)
      },
    });

    const data = response.data;
    
    // Current weather
    const current = data.list[0];
    const weather = {
      temperature: current.main.temp,
      feelsLike: current.main.feels_like,
      tempHigh: data.list.reduce((max, item) => Math.max(max, item.main.temp_max), current.main.temp_max),
      tempLow: data.list.reduce((min, item) => Math.min(min, item.main.temp_min), current.main.temp_min),
      humidity: current.main.humidity,
      windSpeed: current.wind.speed,
      condition: current.weather[0].description,
      icon: current.weather[0].icon,
      forecast: data.list.slice(1, 5).map(item => ({
        time: new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit' }),
        temp: item.main.temp,
        condition: item.weather[0].description,
        icon: item.weather[0].icon,
      })),
    };

    return weather;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    
    // Return mock data for development
    return getMockWeatherData();
  }
};

// Mock data for development
const getMockWeatherData = () => {
  return {
    temperature: 28,
    feelsLike: 30,
    tempHigh: 32,
    tempLow: 26,
    humidity: 65,
    windSpeed: 12,
    condition: 'Partly Cloudy',
    icon: '02d',
    forecast: [
      { time: '15:00', temp: 29, condition: 'Sunny', icon: '01d' },
      { time: '18:00', temp: 27, condition: 'Clear', icon: '01n' },
      { time: '21:00', temp: 26, condition: 'Clear', icon: '01n' },
      { time: '00:00', temp: 25, condition: 'Clear', icon: '01n' },
    ],
  };
};

export default { getWeatherData };