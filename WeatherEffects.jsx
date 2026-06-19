import { useState, useEffect } from 'react';

const WeatherEffects = ({ lat, lon }) => {
  const [weather, setWeather] = useState('clear'); // Default to clear
  const API_KEY = 'YOUR_OPENWEATHER_API_KEY'; // Replace with your key

  useEffect(() => {
    if (!lat || !lon) return;

    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`
        );
        const data = await res.json();
        const condition = data.weather[0].main.toLowerCase();
        
        if (condition.includes('rain') || condition.includes('drizzle')) setWeather('rain');
        else if (condition.includes('clear')) setWeather('sun');
        else setWeather('cloudy');
      } catch (e) { console.error("Weather fetch failed", e); }
    };

    fetchWeather();
  }, [lat, lon]);

  const [rainDrops, setRainDrops] = useState([]);

  useEffect(() => {
    if (weather === 'rain') {
      const drops = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        duration: 0.5 + Math.random(),
        delay: Math.random() * 2,
      }));
      setTimeout(() => setRainDrops(drops), 0);
    }
  }, [weather]);

  if (weather === 'rain') {
    return (
      <div className="weather-rain-overlay">
        {rainDrops.map((drop) => (
          <div 
            key={drop.id} 
            className="rain-drop" 
            style={{ 
              left: `${drop.left}%`, 
              animationDuration: `${drop.duration}s`,
              animationDelay: `${drop.delay}s` 
            }} 
          />
        ))}
      </div>
    );
  }

  if (weather === 'sun') {
    return <div className="sun-glow-overlay" />;
  }

  return null;
};

export default WeatherEffects;