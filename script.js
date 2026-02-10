window.addEventListener("DOMContentLoaded", () => {
  const bar = document.getElementById("quicktabsBar");
  const clockButton = document.getElementById("clockButton");
  const clockTime = document.getElementById("clockTime");
  const clockDate = document.getElementById("clockDate");
  const weatherLabel = document.getElementById("weatherLabel");
  const weatherTemp = document.getElementById("weatherTemp");
  const weatherSummary = document.getElementById("weatherSummary");
  const weatherMeta = document.getElementById("weatherMeta");
  const saveTabsBtn = document.getElementById("saveTabsBtn");
  const openTabsBtn = document.getElementById("openTabsBtn");
  const workTabsBtn = document.getElementById("workTabsBtn");

  const WEATHER_CACHE_KEY = "quicktabs.weatherCache";
  const WEATHER_REFRESH_MS = 10 * 60 * 1000;
  const FALLBACK_LOCATION = {
    latitude: 37.20896,
    longitude: -93.2923,
    source: "Springfield fallback"
  };

  const workUrls = [
    "https://admin.ggleap.com/dashboard-layout",
    "https://www5.whentowork.com/cgi-bin/w2wEE.dll/home?SID=2732792964390",
    "https://outlook.office.com/mail/0/?deeplink=mail%2F0%2F",
    "https://www.notion.so/2f5cbae9d9e1806c848ff4640b741544?v=2f5cbae9d9e180569b96000c8a51e91e",
    "https://www.missouristate.edu"
  ];

  const weatherCodes = {
    0: "clear sky",
    1: "mostly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "rime fog",
    51: "light drizzle",
    53: "drizzle",
    55: "dense drizzle",
    61: "light rain",
    63: "rain",
    65: "heavy rain",
    71: "light snow",
    73: "snow",
    75: "heavy snow",
    80: "rain showers",
    81: "showers",
    82: "violent showers",
    95: "thunderstorm"
  };

  let currentTheme = 0;

  function setClock() {
    const now = new Date();
    clockTime.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    clockDate.textContent = now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }

  function rotateTheme() {
    bar.classList.remove(`theme-${currentTheme}`);
    currentTheme = (currentTheme + 1) % 4;
    bar.classList.add(`theme-${currentTheme}`);
  }

  function formatUpdatedTime(isoString) {
    return new Date(isoString).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function saveWeatherCache(payload) {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload));
  }

  function getWeatherCache() {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) {
      return null;
    }

    try {
      const payload = JSON.parse(cached);
      if (!payload || typeof payload.temperature !== "number" || typeof payload.weatherCode !== "number") {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  function renderWeather(payload) {
    weatherLabel.textContent = payload.locationMode === "current" ? "Local Weather" : "Springfield Weather";
    weatherTemp.textContent = `${Math.round(payload.temperature)} °F`;

    const description = weatherCodes[payload.weatherCode] || "current conditions";
    const feelsLike = Math.round(payload.apparentTemperature);
    weatherSummary.textContent = `${description} • feels like ${feelsLike} °F`;

    weatherMeta.textContent = `Updated ${formatUpdatedTime(payload.updatedAt)} • ${payload.locationSource}`;
  }

  function geolocationAvailable() {
    return navigator.geolocation && window.isSecureContext;
  }

  function getCurrentLocation() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000
      });
    });
  }

  async function resolveWeatherLocation() {
    if (geolocationAvailable()) {
      try {
        const position = await getCurrentLocation();
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "Current location",
          mode: "current"
        };
      } catch (error) {
        return {
          ...FALLBACK_LOCATION,
          mode: "fallback"
        };
      }
    }

    return {
      ...FALLBACK_LOCATION,
      mode: "fallback"
    };
  }

  async function fetchWeather(latitude, longitude) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code&temperature_unit=fahrenheit`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Weather request failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (!payload.current || typeof payload.current.temperature_2m !== "number") {
      throw new Error("Weather payload missing current conditions");
    }

    return {
      temperature: payload.current.temperature_2m,
      apparentTemperature: payload.current.apparent_temperature,
      weatherCode: payload.current.weather_code
    };
  }

  async function loadWeather() {
    weatherSummary.textContent = "Refreshing weather…";

    try {
      const location = await resolveWeatherLocation();
      const current = await fetchWeather(location.latitude, location.longitude);
      const weatherPayload = {
        ...current,
        locationSource: location.source,
        locationMode: location.mode,
        updatedAt: new Date().toISOString()
      };

      renderWeather(weatherPayload);
      saveWeatherCache(weatherPayload);
    } catch (error) {
      weatherSummary.textContent = "Unable to load live weather";
      weatherMeta.textContent = "Showing last available data if possible";
      const cached = getWeatherCache();
      if (cached) {
        renderWeather(cached);
      }
      console.error(error);
    }
  }

  function hasExtensionTabsAccess() {
    return Boolean(window.chrome && chrome.windows && chrome.windows.getAll && chrome.tabs && chrome.tabs.create);
  }

  function normalizeTabUrl(url) {
    if (typeof url !== "string") {
      return null;
    }

    const cleaned = url.trim();
    if (!cleaned.startsWith("http")) {
      return null;
    }

    if (cleaned === window.location.href) {
      return null;
    }

    return cleaned;
  }

  function saveTabs() {
    if (hasExtensionTabsAccess()) {
      chrome.windows.getAll({ populate: true }, (windows) => {
        const urls = windows
          .flatMap((win) => Array.isArray(win.tabs) ? win.tabs : [])
          .map((tab) => normalizeTabUrl(tab.url || tab.pendingUrl))
          .filter(Boolean);

        const uniqueUrls = [...new Set(urls)];

        if (uniqueUrls.length > 0) {
          localStorage.setItem("quicktabs.savedTabs", JSON.stringify(uniqueUrls));
          weatherSummary.textContent = `Saved ${uniqueUrls.length} tab(s)`;
        } else {
          localStorage.removeItem("quicktabs.savedTabs");
          weatherSummary.textContent = "No browsable tabs found to save";
        }
      });
      return;
    }

    weatherSummary.textContent = "Embed mode cannot access all browser tabs; use extension page";
  }

  function openSavedTabs() {
    const saved = localStorage.getItem("quicktabs.savedTabs");
    if (!saved) {
      weatherSummary.textContent = "No saved tabs yet";
      return;
    }

    const urls = JSON.parse(saved)
      .map((url) => normalizeTabUrl(url))
      .filter(Boolean);

    if (urls.length === 0) {
      weatherSummary.textContent = "Saved tabs list is empty";
      return;
    }

    if (hasExtensionTabsAccess()) {
      urls.forEach((url) => {
        chrome.tabs.create({ url });
      });
      weatherSummary.textContent = `Opened ${urls.length} saved tab(s)`;
      return;
    }

    urls.forEach((url, index) => {
      setTimeout(() => {
        window.open(url, "_blank", "noopener");
      }, index * 25);
    });
    weatherSummary.textContent = "Attempted to open saved tabs (browser popup rules may limit embeds)";
  }

  function openWorkTabs() {
    if (window.chrome && chrome.tabs && chrome.tabs.create) {
      workUrls.forEach((url) => {
        chrome.tabs.create({ url });
      });
      return;
    }

    workUrls.forEach((url) => {
      window.open(url, "_blank", "noopener");
    });
  }

  const cached = getWeatherCache();
  if (cached) {
    renderWeather(cached);
  }

  clockButton.addEventListener("click", rotateTheme);
  saveTabsBtn.addEventListener("click", saveTabs);
  openTabsBtn.addEventListener("click", openSavedTabs);
  workTabsBtn.addEventListener("click", openWorkTabs);

  setClock();
  loadWeather();
  setInterval(setClock, 1000);
  setInterval(loadWeather, WEATHER_REFRESH_MS);

  console.log("✅ script validated");
});
