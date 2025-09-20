// tempserver/index.js
var express = require("express");
var myParser = require("body-parser");
var app = express();
app.use(myParser.urlencoded({extended : true}));
app.use(myParser.json());
var cors = require('cors');
app.use(cors());

// For HTML text if needed, but likely not for API endpoints
app.use(myParser.text({ type: 'text/html' }));
let arr = []; // Keep your existing array if used elsewhere

const axios = require('axios'); // Add this line
const { OPENWEATHER_API_KEY } = require('../backend_utils/backend_constants'); // Add this line

// tempserver/index.js (after imports, before app.get('/'))

// Function to fetch real-time weather data
async function getWeatherData(latitude, longitude) {
    if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === "YOUR_OPENWEATHER_API_KEY") {
        console.error("OpenWeatherMap API Key is not set in backend_utils/backend_constants.js");
        return null;
    }
    try {
        // Using Current Weather Data API. 'units=metric' for Celsius, 'units=imperial' for Fahrenheit.
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric`);
        const weather = response.data;

        return {
            timestamp: new Date().toISOString(),
            temperature: weather.main.temp,
            humidity: weather.main.humidity,
            weatherCondition: weather.weather[0].main, // e.g., "Rain", "Clear", "Clouds"
            weatherDescription: weather.weather[0].description // e.g., "light rain"
        };
    } catch (error) {
        console.error(`Error fetching weather data for lat ${latitude}, lon ${longitude}:`, error.message);
        if (error.response) {
            console.error("OpenWeather API Response Error:", error.response.status, error.response.data);
        }
        return null;
    }
}

app.get("/",function(req,res) {
	res.send("yaay");
});

app.post("/lol",function(req,res) {
	console.log("POST to /lol:", req.body);
	arr.push(req.body);
	res.send("l");
});

app.get("/lol",function(req,res) {
	var x = {data:arr};	
	res.json(x);
});

// tempserver/index.js (inside your app.post("/predict-route", ...))

app.post("/predict-route", async (req, res) => {
    const { from, to } = req.body; // Expects { from: { lat, lng }, to: { lat, lng } }

    if (!from || !to) {
        return res.status(400).json({ error: "Missing 'from' or 'to' coordinates" });
    }

    console.log("Received prediction request from frontend:");
    console.log("Origin:", from);
    console.log("Destination:", to);

    try {
        // 1. Get real-time weather data for the origin
        const weatherAtOrigin = await getWeatherData(from.lat, from.lng);
        console.log("Weather at origin:", weatherAtOrigin); // Log the weather data

        // --- Placeholder for future logic ---
        // 2. Call Google Directions API to get routes and segments (next steps)
        // 3. For each route/segment, get prediction from Python model (next steps)

        const currentTimestamp = new Date();
        const timeOfDay = currentTimestamp.getHours();
        const dayOfWeek = currentTimestamp.getDay(); // 0-6, Sunday-Saturday

        // Simplified features for Python (will expand later)
        const featuresForPython = {
            time_of_day: timeOfDay,
            day_of_week: dayOfWeek,
            lat: from.lat,
            lng: from.lng,
            temperature: weatherAtOrigin ? weatherAtOrigin.temperature : null,
            humidity: weatherAtOrigin ? weatherAtOrigin.humidity : null,
            weather_condition: weatherAtOrigin ? weatherAtOrigin.weatherCondition : null
        };
        console.log("Features for Python:", featuresForPython);


        // 4. Return results to frontend (dummy for now, will include weather)
        res.json({
            message: "Prediction request received, weather fetched!",
            receivedOrigin: from,
            receivedDestination: to,
            weatherData: weatherAtOrigin, // Include weather data in the response
            // predictedCongestion: congestionPrediction, // Will be from Python model
            // predictedTravelTime: "35 mins",
            // alternativeRoute: { /* ... */ }
        });

    } catch (error) {
        console.error("Error processing route prediction in backend:", error);
        res.status(500).json({ error: "Failed to get route prediction" });
    }
});

app.listen(3002, () => {
    console.log("Express server listening on port 3002");
});
const { spawn } = require('child_process');

async function getPredictionFromPython(features) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['path/to/prediction_model.py', JSON.stringify(features)]);

        let rawData = '';
        pythonProcess.stdout.on('data', (data) => {
            rawData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python Error: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Python script exited with code ${code}`));
            }
            try {
                const result = JSON.parse(rawData);
                resolve(result);
            } catch (e) {
                reject(new Error(`Failed to parse Python output: ${e.message}, Raw: ${rawData}`));
            }
        });
    });
}