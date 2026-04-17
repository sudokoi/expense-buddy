from sms_ml.baselines.taxonomy_first import predict_sms


def test_taxonomy_first_uses_seed_mapping_for_categories() -> None:
    assert predict_sms("Rs. 100 spent at Zomato").category == "Food"
    assert predict_sms("Rs. 100 spent at BigBasket").category == "Groceries"
    assert predict_sms("Rs. 100 spent at Uber").category == "Transport"
    assert predict_sms("Rs. 100 spent at Netflix").category == "Entertainment"


def test_taxonomy_first_collapses_fuel_and_travel_into_transport() -> None:
    assert predict_sms("Rs. 100 spent at Shell").category == "Transport"
    assert predict_sms("Rs. 100 paid to MakeMyTrip").category == "Transport"
