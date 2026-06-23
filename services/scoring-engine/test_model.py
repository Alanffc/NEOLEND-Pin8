from app.model import predict_and_explain

def test_local_inference():
    print("Testing ML Inference & SHAP Explanations locally...")
    
    # Run test cases
    test_cases = [
        {"bureau": 780.0, "services": 90.0, "ecommerce": 85.0, "wallet": 95.0, "label": "Excellent Profile"},
        {"bureau": 320.0, "services": 30.0, "ecommerce": 15.0, "wallet": 20.0, "label": "Poor Profile"},
        {"bureau": 550.0, "services": 60.0, "ecommerce": 50.0, "wallet": 70.0, "label": "Average Profile"}
    ]

    for tc in test_cases:
        score, shap_vals, base_val = predict_and_explain(
            bureau_score=tc["bureau"],
            public_services_score=tc["services"],
            ecommerce_score=tc["ecommerce"],
            wallet_score=tc["wallet"]
        )
        
        print(f"\nProfile: {tc['label']}")
        print(f"  Inputs -> Bureau: {tc['bureau']}, Services: {tc['services']}, E-commerce: {tc['ecommerce']}, Wallet: {tc['wallet']}")
        print(f"  Calculated Credit Score: {score} / 1000")
        print(f"  Base Value (Expected): {base_val:.2f}")
        print("  SHAP Explanations:")
        for feat, val in shap_vals.items():
            direction = "positive (+)" if val >= 0 else "negative (-)"
            print(f"    - {feat}: {val:+.4f} ({direction})")

if __name__ == "__main__":
    test_local_inference()
