// trafficUtils.js

// Congestion colors for route visualization
export const congestionColors = {
  0: "green",      // Low
  1: "yellow",     // Moderate
  2: "red",        // Heavy
  3: "darkred",    // Severe
  unknown: "gray", // Unknown
};

// Map TomTom congestion levels to readable labels
export const congestionLabels = {
  0: "Low",
  1: "Moderate",
  2: "Heavy",
  3: "Severe",
  unknown: "Unknown",
};

// Get max congestion from array of routes (optional helper)
export const getMaxCongestion = (routes) =>
  Math.max(...routes.map((r) => r.congestion || 0));
