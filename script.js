/**
 * V-Weather Forecast
 * Vanilla JS Application using Open-Meteo API
 */

// --- STATE MANAGEMENT ---
const state = {
    isCelsius: true,
    theme: 'dark',
    currentLocation: {
        city: 'New York',
        country: 'US',
        lat: 40.7143,
        lon: -74.006
    },
    weatherData: null
};

// --- DOM ELEMENTS ---
const elements = {
    // Forms & Controls
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    locationBtn: document.getElementById('location-btn'),
    unitCBtn: document.getElementById('unit-c'),
    unitFBtn: document.getElementById('unit-f'),
    themeToggle: document.getElementById('theme-toggle'),
    retryBtn: document.getElementById('retry-btn'),
    
    // Containers
    dashboard: document.getElementById('dashboard'),
    loader: document.getElementById('loader'),
    errorContainer: document.getElementById('error-container'),
    errorMsg: document.getElementById('error-msg'),
    
    // Current Weather
    cityName: document.getElementById('city-name'),
    countryName: document.getElementById('country-name'),
    currentDate: document.getElementById('current-date'),
    currentTemp: document.getElementById('current-temp'),
    weatherDesc: document.getElementById('weather-desc'),
    currentIcon: document.getElementById('current-icon'),
    
    // Details
    feelsLike: document.getElementById('feels-like'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
    visibility: document.getElementById('visibility'),
    
    // Forecasts
    hourlyContainer: document.getElementById('hourly-forecast'),
    dailyContainer: document.getElementById('daily-forecast')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    fetchWeatherByCoords(state.currentLocation.lat, state.currentLocation.lon, true);
});

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Search Submit
    elements.searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = elements.searchInput.value.trim();
        if (query) {
            elements.searchInput.blur();
            await fetchCityCoordinates(query);
            elements.searchInput.value = '';
        }
    });

    // Get User Location
    elements.locationBtn.addEventListener('click', getUserLocation);

    // Unit Toggle
    elements.unitCBtn.addEventListener('click', () => setUnit(true));
    elements.unitFBtn.addEventListener('click', () => setUnit(false));

    // Theme Toggle
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Retry Button on Error
    elements.retryBtn.addEventListener('click', () => {
        fetchWeatherByCoords(state.currentLocation.lat, state.currentLocation.lon);
    });
}

// --- CORE API LOGIC ---

/**
 * 1. Fetch Coordinates from City Name using Open-Meteo Geocoding
 */
async function fetchCityCoordinates(city) {
    showLoader();
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            throw new Error(`Could not find city: "${city}". Please try a valid city name.`);
        }

        const result = data.results[0];
        state.currentLocation = {
            city: result.name,
            country: result.country_code || '',
            lat: result.latitude,
            lon: result.longitude
        };

        await fetchWeatherData();

    } catch (error) {
        showError(error.message);
    }
}

/**
 * 2. Fetch City Name from Coordinates (Reverse Geocoding)
 * Using BigDataCloud free API (no key required for basic reverse geocoding)
 */
async function fetchCityNameFromCoords(lat, lon) {
    try {
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
        const response = await fetch(url);
        const data = await response.json();
        
        state.currentLocation.city = data.city || data.locality || "Unknown Location";
        state.currentLocation.country = data.countryCode || "";
    } catch (error) {
        console.warn("Reverse geocoding failed", error);
        state.currentLocation.city = "Current Location";
        state.currentLocation.country = "";
    }
}

/**
 * 3. Fetch Weather Data from Open-Meteo
 */
async function fetchWeatherByCoords(lat, lon, fetchName = false) {
    showLoader();
    try {
        if (fetchName) {
            await fetchCityNameFromCoords(lat, lon);
        }
        
        state.currentLocation.lat = lat;
        state.currentLocation.lon = lon;
        
        await fetchWeatherData();
    } catch (error) {
        showError("Failed to fetch weather data. Please check your connection.");
    }
}

/**
 * Common Weather Fetching Logic
 */
async function fetchWeatherData() {
    try {
        const { lat, lon } = state.currentLocation;
        // Request comprehensive data. Wind speed in km/h by default from API.
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,visibility&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Weather API request failed.");
        
        state.weatherData = await response.json();
        
        updateUI();
    } catch (error) {
        showError(error.message);
    }
}

// --- HTML5 GEOLOCATION ---
function getUserLocation() {
    if (navigator.geolocation) {
        showLoader();
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchWeatherByCoords(position.coords.latitude, position.coords.longitude, true);
            },
            (error) => {
                let msg = "Location access denied.";
                if (error.code === 2) msg = "Location unavailable.";
                if (error.code === 3) msg = "Location request timed out.";
                showError(`${msg} Please search manually.`);
            },
            { timeout: 10000 }
        );
    } else {
        showError("Geolocation is not supported by your browser.");
    }
}

// --- UI RENDERING ---
function updateUI() {
    if (!state.weatherData) return;

    renderHeader();
    renderCurrentWeather();
    renderHourlyForecast();
    renderDailyForecast();

    // Hide loader, show dashboard
    elements.loader.classList.add('hidden');
    elements.errorContainer.classList.add('hidden');
    elements.dashboard.classList.remove('hidden');
}

function renderHeader() {
    elements.cityName.textContent = state.currentLocation.city;
    elements.countryName.textContent = state.currentLocation.country;

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    elements.currentDate.textContent = new Date().toLocaleDateString('en-US', dateOptions);
}

function renderCurrentWeather() {
    const current = state.weatherData.current;
    
    // Details Map
    const weatherInfo = getWeatherMetadata(current.weather_code, current.is_day);

    // Main Card
    elements.currentTemp.textContent = formatTemp(current.temperature_2m);
    elements.weatherDesc.textContent = weatherInfo.description;
    elements.currentIcon.src = weatherInfo.icon;

    // Grid Cards
    elements.feelsLike.textContent = formatTemp(current.apparent_temperature);
    elements.humidity.textContent = `${current.relative_humidity_2m}%`;
    elements.windSpeed.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    
    // Visibility comes in meters from Open-Meteo
    const visibilityKm = (current.visibility / 1000).toFixed(1);
    elements.visibility.textContent = `${visibilityKm} km`;
}

function renderHourlyForecast() {
    elements.hourlyContainer.innerHTML = '';
    const hourly = state.weatherData.hourly;
    
    // Find current hour index based on API time
    const currentApiTimeStr = state.weatherData.current.time.slice(0, 14) + "00";
    let startIndex = hourly.time.findIndex(t => t === currentApiTimeStr);
    if (startIndex === -1) startIndex = 0;

    // Show next 24 hours
    for (let i = startIndex; i < startIndex + 24; i++) {
        if (!hourly.time[i]) break; // Safety check

        const dateObj = new Date(hourly.time[i]);
        // Avoid "0:00 AM", format nicely
        let timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        if (i === startIndex) timeStr = "Now";

        const temp = formatTemp(hourly.temperature_2m[i], false);
        const code = hourly.weather_code[i];
        
        // Simple day/night check for hourly icons: 6 AM to 6 PM is day
        const hour = dateObj.getHours();
        const isDay = (hour >= 6 && hour < 18) ? 1 : 0;
        
        const iconSrc = getWeatherMetadata(code, isDay).icon;

        const html = `
            <div class="hourly-item">
                <span class="hourly-time">${timeStr}</span>
                <img src="${iconSrc}" alt="icon" class="hourly-icon">
                <span class="hourly-temp">${temp}</span>
            </div>
        `;
        elements.hourlyContainer.insertAdjacentHTML('beforeend', html);
    }
}

function renderDailyForecast() {
    elements.dailyContainer.innerHTML = '';
    const daily = state.weatherData.daily;

    // 7 Day Forecast (Open-Meteo returns up to 7 days by default)
    const limit = Math.min(daily.time.length, 7);

    for (let i = 0; i < limit; i++) {
        const dateObj = new Date(daily.time[i]);
        let dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        if (i === 0) dayName = "Today";

        const max = formatTemp(daily.temperature_2m_max[i], false);
        const min = formatTemp(daily.temperature_2m_min[i], false);
        const code = daily.weather_code[i];
        
        // Daily icons usually use day variants
        const iconSrc = getWeatherMetadata(code, 1).icon;

        const html = `
            <div class="daily-item">
                <span class="daily-day">${dayName}</span>
                <img src="${iconSrc}" alt="icon" class="daily-icon">
                <div class="daily-temps">
                    <span class="daily-max">${max}</span>
                    <span class="daily-min">${min}</span>
                </div>
            </div>
        `;
        elements.dailyContainer.insertAdjacentHTML('beforeend', html);
    }
}

// --- UTILITIES & HELPERS ---

function formatTemp(tempC, includeSymbol = true) {
    let finalTemp = state.isCelsius ? tempC : (tempC * 9/5) + 32;
    finalTemp = Math.round(finalTemp);
    return includeSymbol ? `${finalTemp}°` : `${finalTemp}°`;
}

function setUnit(toCelsius) {
    if (state.isCelsius === toCelsius) return;
    
    state.isCelsius = toCelsius;
    
    // Toggle active classes
    if (toCelsius) {
        elements.unitCBtn.classList.add('active');
        elements.unitFBtn.classList.remove('active');
    } else {
        elements.unitFBtn.classList.add('active');
        elements.unitCBtn.classList.remove('active');
    }

    // Only update UI, no need to refetch data
    if (state.weatherData) {
        updateUI();
    }
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    
    const icon = elements.themeToggle.querySelector('i');
    if (state.theme === 'light') {
        icon.className = 'fa-solid fa-sun';
    } else {
        icon.className = 'fa-solid fa-moon';
    }
}

function initTheme() {
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        state.theme = 'light';
        document.documentElement.setAttribute('data-theme', 'light');
        elements.themeToggle.querySelector('i').className = 'fa-solid fa-sun';
    }
}

function showLoader() {
    elements.dashboard.classList.add('hidden');
    elements.errorContainer.classList.add('hidden');
    elements.loader.classList.remove('hidden');
}

function showError(message) {
    elements.dashboard.classList.add('hidden');
    elements.loader.classList.add('hidden');
    elements.errorMsg.textContent = message;
    elements.errorContainer.classList.remove('hidden');
}

/**
 * Maps Open-Meteo WMO Codes to Descriptions and OpenWeather High-Res Icons
 * This gives us a professional look without needing local assets.
 */
function getWeatherMetadata(wmoCode, isDay = 1) {
    const d = isDay ? 'd' : 'n';
    
    const map = {
        0:  { desc: 'Clear sky', icon: `01${d}` },
        1:  { desc: 'Mainly clear', icon: `02${d}` },
        2:  { desc: 'Partly cloudy', icon: `03${d}` },
        3:  { desc: 'Overcast', icon: `04${d}` },
        45: { desc: 'Fog', icon: `50${d}` },
        48: { desc: 'Depositing rime fog', icon: `50${d}` },
        51: { desc: 'Light drizzle', icon: `09${d}` },
        53: { desc: 'Moderate drizzle', icon: `09${d}` },
        55: { desc: 'Dense drizzle', icon: `09${d}` },
        56: { desc: 'Light freezing drizzle', icon: `09${d}` },
        57: { desc: 'Dense freezing drizzle', icon: `09${d}` },
        61: { desc: 'Slight rain', icon: `10${d}` },
        63: { desc: 'Moderate rain', icon: `10${d}` },
        65: { desc: 'Heavy rain', icon: `10${d}` },
        66: { desc: 'Light freezing rain', icon: `13${d}` },
        67: { desc: 'Heavy freezing rain', icon: `13${d}` },
        71: { desc: 'Slight snow', icon: `13${d}` },
        73: { desc: 'Moderate snow', icon: `13${d}` },
        75: { desc: 'Heavy snow', icon: `13${d}` },
        77: { desc: 'Snow grains', icon: `13${d}` },
        80: { desc: 'Slight rain showers', icon: `09${d}` },
        81: { desc: 'Moderate rain showers', icon: `09${d}` },
        82: { desc: 'Violent rain showers', icon: `09${d}` },
        85: { desc: 'Slight snow showers', icon: `13${d}` },
        86: { desc: 'Heavy snow showers', icon: `13${d}` },
        95: { desc: 'Thunderstorm', icon: `11${d}` },
        96: { desc: 'Thunderstorm with slight hail', icon: `11${d}` },
        99: { desc: 'Thunderstorm with heavy hail', icon: `11${d}` },
    };

    const result = map[wmoCode] || { desc: 'Unknown', icon: `03${d}` };
    
    return {
        description: result.desc,
        // Fetch high resolution icons directly from OpenWeather CDN for aesthetics
        icon: `https://openweathermap.org/img/wn/${result.icon}@4x.png`
    };
}
