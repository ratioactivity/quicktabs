window.addEventListener("DOMContentLoaded", () => {
  const bar = document.getElementById("quicktabsBar");
  const clockButton = document.getElementById("clockButton");
  const clockTime = document.getElementById("clockTime");
  const clockDate = document.getElementById("clockDate");
  const weatherTemp = document.getElementById("weatherTemp");
  const weatherSummary = document.getElementById("weatherSummary");
  const saveTabsBtn = document.getElementById("saveTabsBtn");
  const openTabsBtn = document.getElementById("openTabsBtn");
  const workTabsBtn = document.getElementById("workTabsBtn");

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

  async function fetchWeather(latitude, longitude) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const temp = Math.round(payload.current.temperature_2m);
    const description = weatherCodes[payload.current.weather_code] || "current conditions";

    weatherTemp.textContent = `${temp} °F`;
    weatherSummary.textContent = description;
  }

  async function loadWeather() {
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            await fetchWeather(position.coords.latitude, position.coords.longitude);
          },
          async () => {
            await fetchWeather(37.20896, -93.2923);
          },
          { timeout: 4000 }
        );
      } else {
        await fetchWeather(37.20896, -93.2923);
      }
    } catch (error) {
      weatherSummary.textContent = "Unable to load weather";
      console.error(error);
    }
  }

  function saveTabs() {
    if (window.chrome && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs) => {
        const urls = tabs.map((tab) => tab.url).filter(Boolean);
        localStorage.setItem("quicktabs.savedTabs", JSON.stringify(urls));
        weatherSummary.textContent = `Saved ${urls.length} tab(s)`;
      });
      return;
    }

    const fallback = [window.location.href];
    localStorage.setItem("quicktabs.savedTabs", JSON.stringify(fallback));
    weatherSummary.textContent = "Saved current tab only (web mode)";
  }

  function openSavedTabs() {
    const saved = localStorage.getItem("quicktabs.savedTabs");
    if (!saved) {
      weatherSummary.textContent = "No saved tabs yet";
      return;
    }

    const urls = JSON.parse(saved);

    if (window.chrome && chrome.tabs && chrome.tabs.create) {
      urls.forEach((url) => {
        chrome.tabs.create({ url });
      });
      return;
    }

    urls.forEach((url) => {
      window.open(url, "_blank", "noopener");
    });
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

  clockButton.addEventListener("click", rotateTheme);
  saveTabsBtn.addEventListener("click", saveTabs);
  openTabsBtn.addEventListener("click", openSavedTabs);
  workTabsBtn.addEventListener("click", openWorkTabs);

  setClock();
  loadWeather();
  setInterval(setClock, 1000);

  console.log("✅ script validated");
});
