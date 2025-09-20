import React from "react";

const congestionColors = {
  Low: "green",
  Moderate: "orange",
  High: "red",
  Unknown: "gray",
};

function PredictionResults({ routes, onPredict }) {
  return (
    <div className="container">
      <div className="input-row">
        <button
          onClick={onPredict}
          style={{
            flex: 1,
            padding: "1rem",
            borderRadius: "2rem",
            border: "none",
            background: "#f59e42",
            color: "#fff",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          Predict
        </button>
      </div>

      <div className="prediction-results">
        {routes.map((route, index) => (
          <div className="result-card" key={index}>
            <h4>Route {index + 1}: {route.summary}</h4>

            <div className="result-item">
              <span className="result-label">Distance:</span>
              <span className="result-value">{route.distance}</span>
            </div>

            <div className="result-item">
              <span className="result-label">Duration:</span>
              <span className="result-value">{route.duration}</span>
            </div>

            <div className="result-item">
              <span className="result-label">Congestion (Calculated):</span>
              <span
                style={{
                  color: congestionColors[route.congestionCalculated],
                  fontWeight: "700",
                }}
              >
                {route.congestionCalculated}
              </span>
            </div>

            <div className="result-item">
              <span className="result-label">Congestion (API):</span>
              <span
                style={{
                  color: congestionColors[route.congestionAPI],
                  fontWeight: "700",
                }}
              >
                {route.congestionAPI}
              </span>
            </div>

            <div className="result-item">
              <span className="result-label">Current Speed:</span>
              <span>{route.currentSpeed} km/h</span>
            </div>

            <div className="result-item">
              <span className="result-label">Free Flow Speed:</span>
              <span>{route.freeFlowSpeed} km/h</span>
            </div>

            <div className="result-item">
              <span className="result-label">Weather:</span>
              <span>{route.weather}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PredictionResults;
