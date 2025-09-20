# prediction_model.py
import sys
import json
import pandas as pd
import numpy as np
import joblib
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import mean_squared_error, r2_score
import os

# --- Configuration ---
MODEL_PATH = 'traffic_congestion_model.joblib'
PREPROCESSOR_PATH = 'preprocessor.joblib'
# Placeholder for your historical data CSV
# We'll create a dummy one for demonstration
HISTORICAL_DATA_PATH = 'historical_traffic_data.csv'

# --- 1. Load Historical Data ---
def load_historical_data(filepath):
    """
    Loads historical traffic data from a CSV file.
    In a real scenario, this would load PEMS, Geotab, etc.
    """
    if not os.path.exists(filepath):
        print(f"Error: Historical data file not found at {filepath}", file=sys.stderr)
        return None
    try:
        df = pd.read_csv(filepath)
        print(f"Loaded {len(df)} rows of historical data.")
        return df
    except Exception as e:
        print(f"Error loading historical data: {e}", file=sys.stderr)
        return None

# --- 2. Preprocess Data ---
def preprocess_data(df, is_training=True, preprocessor=None):
    """
    Preprocesses the raw DataFrame for model training/prediction.
    Handles feature engineering and one-hot encoding.
    """
    if df is None:
        return None, None

    # Ensure 'timestamp' column exists and is datetime
    if 'timestamp' not in df.columns:
        print("Error: 'timestamp' column not found in historical data.", file=sys.stderr)
        return None, None
    df['timestamp'] = pd.to_datetime(df['timestamp'])

    # Feature Engineering (consistent with prediction features)
    df['hour_of_day'] = df['timestamp'].dt.hour
    df['day_of_week'] = df['timestamp'].dt.dayofweek # Monday=0, Sunday=6
    df['month'] = df['timestamp'].dt.month
    df['is_weekday'] = df['day_of_week'].apply(lambda x: 1 if x < 5 else 0)

    # One-Hot Encode Categorical Weather
    # For training, create a new encoder. For prediction, use the saved one.
    categorical_features = ['weather_condition'] # Example: 'Rain', 'Clear', 'Clouds'
    numerical_features = ['lat', 'lng', 'hour_of_day', 'day_of_week', 'month', 'is_weekday', 'temperature', 'humidity']
    
    if is_training:
        # Create a preprocessor tuple: (encoder, list_of_features)
        preprocessor = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
        encoded_features = preprocessor.fit_transform(df[categorical_features])
        encoded_df = pd.DataFrame(encoded_features, columns=preprocessor.get_feature_names_out(categorical_features))
        
        # Reset index to avoid alignment issues if original df had non-unique index
        df = df.reset_index(drop=True)
        processed_df = pd.concat([df[numerical_features], encoded_df], axis=1)
        
        # Store feature names for consistency in prediction
        feature_names = processed_df.columns.tolist()
        preprocessor_output = {'encoder': preprocessor, 'feature_names': feature_names}
        return processed_df, preprocessor_output
    else:
        if preprocessor is None:
            print("Error: Preprocessor not provided for prediction mode.", file=sys.stderr)
            return None, None

        encoder = preprocessor['encoder']
        training_feature_names = preprocessor['feature_names']

        # Ensure prediction input has all required numerical features
        for feature in numerical_features:
            if feature not in df.columns:
                df[feature] = 0 # Or handle missing values appropriately

        # Apply the *trained* encoder to the new data
        encoded_features = encoder.transform(df[categorical_features])
        encoded_df = pd.DataFrame(encoded_features, columns=encoder.get_feature_names_out(categorical_features))
        
        # Ensure column order matches training data
        processed_df = pd.concat([df[numerical_features].reset_index(drop=True), encoded_df], axis=1)
        
        # Reindex to match training feature order, filling missing with 0 (for one-hot features not seen)
        # This is crucial for consistent input to the model
        processed_df = processed_df.reindex(columns=training_feature_names, fill_value=0)
        
        return processed_df, None # No new preprocessor output in prediction mode


# --- 3. Train Model ---
def train_model(processed_df):
    """
    Trains an XGBoost model and saves it.
    """
    if processed_df is None or 'congestion_level' not in processed_df.columns:
        print("Error: Processed DataFrame or 'congestion_level' target not found for training.", file=sys.stderr)
        return None

    X = processed_df.drop('congestion_level', axis=1)
    y = processed_df['congestion_level']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=100, learning_rate=0.1, random_state=42)
    model.fit(X_train, y_train)

    # Evaluate the model
    y_pred = model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    print(f"Model trained. RMSE: {rmse:.2f}, R2 Score: {r2:.2f}")

    # Save the model
    joblib.dump(model, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")
    return model

# --- 4. Predict Congestion ---
def predict_congestion(input_features, preprocessor):
    """
    Loads the trained model and makes a prediction based on real-time features.
    """
    if not os.path.exists(MODEL_PATH):
        print(f"Error: Trained model not found at {MODEL_PATH}. Train the model first.", file=sys.stderr)
        return None

    try:
        model = joblib.load(MODEL_PATH)
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        return None

    # Convert input features to DataFrame for preprocessing
    # Ensure correct column names
    feature_df = pd.DataFrame([input_features])
    
    # Preprocess the input features using the loaded preprocessor
    processed_input, _ = preprocess_data(feature_df, is_training=False, preprocessor=preprocessor)

    if processed_input is None:
        print("Error during input feature preprocessing.", file=sys.stderr)
        return None

    # Make prediction
    prediction = model.predict(processed_input)[0] # Get the single prediction value
    return prediction


# --- Main execution logic for when the script is run ---
if __name__ == '__main__':
    # Determine if we are in 'train' or 'predict' mode
    if len(sys.argv) > 1 and sys.argv[1] == 'train':
        print("Running in training mode...")
        df = load_historical_data(HISTORICAL_DATA_PATH)
        if df is not None:
            processed_df, preprocessor_output = preprocess_data(df, is_training=True)
            if processed_df is not None:
                train_model(processed_df)
                joblib.dump(preprocessor_output, PREPROCESSOR_PATH)
                print(f"Preprocessor saved to {PREPROCESSOR_PATH}")
        print("Training complete.")

    elif len(sys.argv) > 1: # Assumes it's a JSON string for prediction
        print("Running in prediction mode...")
        try:
            input_data = json.loads(sys.argv[1])
            
            # Load the preprocessor
            if not os.path.exists(PREPROCESSOR_PATH):
                print(f"Error: Preprocessor not found at {PREPROCESSOR_PATH}. Train the model first.", file=sys.stderr)
                sys.exit(1)
            preprocessor = joblib.load(PREPROCESSOR_PATH)

            prediction_result = predict_congestion(input_data, preprocessor)
            if prediction_result is not None:
                # Output prediction as JSON to stdout for Node.js to capture
                # You might want to map this to "Low", "Medium", "High"
                congestion_category = "Low"
                if prediction_result >= 0.7:
                    congestion_category = "High"
                elif prediction_result >= 0.4:
                    congestion_category = "Medium"

                json_output = {
                    "raw_prediction": float(prediction_result), # Ensure it's JSON serializable
                    "congestion_level": congestion_category
                }
                print(json.dumps(json_output))
            else:
                print(json.dumps({"error": "Prediction failed."}), file=sys.stderr)
                sys.exit(1)

        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON input for prediction: {e}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"An unexpected error occurred during prediction: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Usage: python prediction_model.py train  OR  python prediction_model.py '{\"lat\":...,\"lng\":...}'", file=sys.stderr)