import os
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestRegressor

# Configurable Model Version for Blue/Green verification
MODEL_VERSION = os.getenv("MODEL_VERSION", "v1-blue")

# Feature names mapped to alternative and traditional data sources
FEATURE_NAMES = [
    "bureau_score",
    "public_services_score",
    "ecommerce_score",
    "wallet_score"
]

# Generate static dummy training dataset to initialize a real Scikit-Learn model at startup.
# This guarantees that we can use real SHAP TreeExplainer calculation rather than mocking.
X_train = np.array([
    [750.0, 95.0, 90.0, 95.0],  # Excellent profile
    [300.0, 20.0, 10.0, 15.0],  # Poor profile
    [600.0, 70.0, 60.0, 80.0],  # Good profile
    [450.0, 50.0, 45.0, 50.0],  # Average profile
    [680.0, 85.0, 80.0, 75.0],  # Very Good profile
    [350.0, 30.0, 25.0, 40.0],  # Fairly Poor profile
    [520.0, 60.0, 55.0, 65.0],  # Fair profile
    [800.0, 90.0, 95.0, 90.0]   # Outstanding profile
])

# Credit score targets (0 to 1000 scale)
y_train = np.array([920, 280, 710, 490, 810, 360, 580, 960])

# Initialize and fit RandomForestRegressor
# We use a small tree depth to keep explainability clear and fast.
_model = RandomForestRegressor(n_estimators=10, max_depth=3, random_state=42)
_model.fit(X_train, y_train)

# Initialize the SHAP TreeExplainer
_explainer = shap.TreeExplainer(_model)

def get_model_version() -> str:
    """Returns the current model version loaded by this instance."""
    return MODEL_VERSION

def predict_and_explain(
    bureau_score: float,
    public_services_score: float,
    ecommerce_score: float,
    wallet_score: float
) -> tuple[int, dict, float]:
    """
    Executes ML inference using the fitted model and computes SHAP explanations.
    
    Returns:
        - final_score: Integer credit score scaled to [0, 1000]
        - shap_values: Dictionary mapping each feature to its SHAP impact value
        - base_value: The reference base value (expected value) of the model
    """
    # Build 2D array / DataFrame matching exact features
    input_data = pd.DataFrame(
        [[bureau_score, public_services_score, ecommerce_score, wallet_score]],
        columns=FEATURE_NAMES
    )

    # Incur prediction
    raw_prediction = _model.predict(input_data)[0]
    final_score = int(np.clip(raw_prediction, 0, 1000))

    # Compute SHAP values using the TreeExplainer
    shap_vals = _explainer.shap_values(input_data)

    # Convert shap values to float for JSON compatibility
    explanations = {
        FEATURE_NAMES[i]: float(shap_vals[0][i])
        for i in range(len(FEATURE_NAMES))
    }

    base_value = float(_explainer.expected_value)

    return final_score, explanations, base_value
