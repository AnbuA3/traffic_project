import React, { useState, useEffect } from "react";
import { GOOGLE_MAPS_API_KEY, TOMTOM_API_KEY, OPENWEATHER_API_KEY } from "./constant";

// Map congestion to color
const congestionColors = {
  Low: "green",
  Medium: "yellow",
  High: "red",
  Unknown: "gray",
};

function Map() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [mapInstance, setMapInstance] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState([]);

  // Load Google Maps
  useEffect(() => {
    if (!window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      initMap();
    }
  }, []);

  const initMap = () => {
    const map = new window.google.maps.Map(document.getElementById("map"), {
      center: { lat: 12.9716, lng: 77.5946 },
      zoom: 12,
    });
    setMapInstance(map);
  };

  // Autocomplete
  useEffect(() => {
    if (window.google && mapInstance) {
      const originInput = document.getElementById("origin-input");
      const destinationInput = document.getElementById("destination-input");

      const originAuto = new window.google.maps.places.Autocomplete(originInput);
      const destAuto = new window.google.maps.places.Autocomplete(destinationInput);

      originAuto.addListener("place_changed", () => {
        const place = originAuto.getPlace();
        if (place.geometry) {
          setOriginCoords(place.geometry.location.toJSON());
          setOrigin(place.formatted_address);
        }
      });

      destAuto.addListener("place_changed", () => {
        const place = destAuto.getPlace();
        if (place.geometry) {
          setDestinationCoords(place.geometry.location.toJSON());
          setDestination(place.formatted_address);
        }
      });
    }
  }, [mapInstance]);

  const handlePredict = async () => {
    if (!origin || !destination) return;

    // Clear previous routes
    directionsRenderer.forEach((dr) => dr.setMap(null));
    setDirectionsRenderer([]);

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin,
        destination,
        travelMode: "DRIVING",
        provideRouteAlternatives: true,
        drivingOptions: { departureTime: new Date() },
      },
      async (result, status) => {
        if (status === "OK") {
          const updatedRoutes = await Promise.all(
            result.routes.map(async (r) => {
              // Sample multiple points along route
              const samples = r.overview_path.filter((_, i) => i % Math.floor(r.overview_path.length / 5) === 0);
              let totalCurrentSpeed = 0;
              let totalFreeFlow = 0;
              let validPoints = 0;

              for (const p of samples) {
                try {
                  const flowResp = await fetch(
                    `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${p.lat()},${p.lng()}&key=${TOMTOM_API_KEY}`
                  );
                  const flowData = await flowResp.json();
                  if (flowData.flowSegmentData) {
                    totalCurrentSpeed += flowData.flowSegmentData.currentSpeed;
                    totalFreeFlow += flowData.flowSegmentData.freeFlowSpeed;
                    validPoints++;
                  }
                } catch (e) {
                  console.error("Flow fetch error:", e);
                }
              }

              let currentSpeed = validPoints ? (totalCurrentSpeed / validPoints).toFixed(1) : "N/A";
              let freeFlowSpeed = validPoints ? (totalFreeFlow / validPoints).toFixed(1) : "N/A";

              let congestion = "Unknown";
              if (currentSpeed !== "N/A" && freeFlowSpeed !== 0) {
                const ratio = currentSpeed / freeFlowSpeed;
                if (ratio > 0.8) congestion = "Low";
                else if (ratio > 0.5) congestion = "Medium";
                else congestion = "High";
              }

              // Weather for midpoint
              const midpoint = r.overview_path[Math.floor(r.overview_path.length / 2)];
              let weather = "N/A";
              try {
                const weatherResp = await fetch(
                  `https://api.openweathermap.org/data/2.5/weather?lat=${midpoint.lat()}&lon=${midpoint.lng()}&appid=${OPENWEATHER_API_KEY}&units=metric`
                );
                const weatherData = await weatherResp.json();
                if (weatherData.weather && weatherData.weather.length > 0) {
                  weather = `${weatherData.weather[0].description}, ${weatherData.main.temp}°C`;
                }
              } catch (e) {
                console.error("Weather fetch error:", e);
              }

              return {
                summary: r.summary,
                distance: r.legs[0].distance.text,
                duration: r.legs[0].duration.text,
                currentSpeed,
                freeFlowSpeed,
                congestion,
                weather,
                polyline: r.overview_polyline,
              };
            })
          );

          setRoutes(updatedRoutes);

          // Render colored routes
          const newRenderers = result.routes.map((r, idx) => {
            const routeData = updatedRoutes[idx];
            const renderer = new window.google.maps.DirectionsRenderer({
              map: mapInstance,
              directions: { routes: [r], request: {} },
              suppressMarkers: false,
              preserveViewport: true,
              polylineOptions: {
                strokeColor: congestionColors[routeData.congestion] || "#888",
                strokeOpacity: 0.7,
                strokeWeight: 5,
              },
            });
            return renderer;
          });

          setDirectionsRenderer(newRenderers);
        }
      }
    );

    // Fetch incidents
    try {
      const incidentResp = await fetch(
        `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${TOMTOM_API_KEY}&bbox=77.4,12.8,77.8,13.1&fields={incidents{type,description,severity,delay}}`
      );
      const incidentData = await incidentResp.json();
      setIncidents(incidentData.incidents || []);
    } catch (e) {
      console.error("Incidents fetch error:", e);
    }
  };

  return (
    <>
      <div className="app-header">
        <h2>Smart Traffic Monitoring and Alternative Route Suggestion using Live Data</h2>
      </div>

      <div className="input-row">
        <input id="origin-input" type="text" placeholder="Enter Origin" />
        <input id="destination-input" type="text" placeholder="Enter Destination" />
        <button onClick={handlePredict}>Predict</button>
      </div>

      <div id="map" style={{ height: "500px", width: "100%" }}></div>

      <div className="prediction-results">
        {routes.map((r, idx) => (
          <div key={idx} className="result-card">
            <h4>Route: {r.summary}</h4>
            <div className="result-item">
              <span className="result-label">Distance:</span>
              <span className="result-value">{r.distance}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Duration:</span>
              <span className="result-value">{r.duration}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Current Speed:</span>
              <span className="result-value">{r.currentSpeed} km/h</span>
            </div>
            <div className="result-item">
              <span className="result-label">Free Flow Speed:</span>
              <span className="result-value">{r.freeFlowSpeed} km/h</span>
            </div>
            <div className="result-item">
              <span className="result-label">Congestion:</span>
              <span
                className="result-value"
                style={{ color: congestionColors[r.congestion], fontWeight: "700" }}
              >
                {r.congestion}
              </span>
            </div>
            <div className="result-item">
              <span className="result-label">Weather:</span>
              <span className="result-value">{r.weather}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default Map;
