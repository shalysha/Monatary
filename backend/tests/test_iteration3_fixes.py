"""Iteration 3 retest — verifies the two specific fixes from iter2:
1) POST /api/reset now clears categories AND recomputes account.target → all targets 0.
2) Frontend add-expense.tsx selectCategory sets both sourceAccount and payoffAccount.
   Backend simulation: emulate the resulting POST /api/expenses payload (cash + variable source)
   when user selects a Groceries category and switches to cash.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://budget-zero-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# Fix #1 — /api/reset clears categories AND zeros account.targets
class TestResetClearsCategories:
    def test_seed_then_reset_clears_categories_and_targets(self, client):
        # Ensure data exists pre-reset
        client.post(f"{API}/seed-budget", timeout=15)
        cats = client.get(f"{API}/categories").json()
        assert len(cats) == 21, f"expected 21 seeded categories, got {len(cats)}"
        accts_pre = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert round(accts_pre["fixed_expenses"]["target"], 2) == 3645.96
        assert round(accts_pre["variable"]["target"], 2) == 1550.00  # iter4: leaves only

        # Reset
        r = client.post(f"{API}/reset", timeout=15)
        assert r.status_code == 200, r.text

        # Categories must be empty now
        cats_post = client.get(f"{API}/categories").json()
        assert cats_post == [], f"categories not cleared: {len(cats_post)} remain"

        # All account.target must be 0
        accts_post = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        for key in ("fixed_expenses", "variable", "general", "savings"):
            assert key in accts_post, f"account {key} missing post-reset"
            assert accts_post[key]["target"] == 0.0, (
                f"account {key} target not zeroed post-reset: {accts_post[key]['target']}"
            )


# Fix #2 — Frontend selectCategory now sets both source and payoff to parent_account.
# We re-seed and then simulate the two flows the user follows.
class TestCategoryBucketAutofillBackendBehavior:
    @pytest.fixture(scope="class", autouse=True)
    def reseed(self, client):
        client.post(f"{API}/reset", timeout=15)
        client.post(f"{API}/seed-budget", timeout=15)
        # Add income to fund variable bucket
        client.post(f"{API}/incomes", json={
            "source": "TEST_seed_income_iter3",
            "allocation": {"fixed_expenses": 0, "variable": 500, "general": 0, "savings": 0},
        }, timeout=10)
        yield
        # Cleanup income created
        incs = client.get(f"{API}/incomes").json()
        for i in incs:
            if i.get("source") == "TEST_seed_income_iter3":
                client.delete(f"{API}/incomes/{i['id']}")

    def _groceries(self, client):
        cats = client.get(f"{API}/categories").json()
        return next(c for c in cats if c["name"] == "Groceries")

    def test_cash_path_selectcategory_then_switch_to_cash(self, client):
        """Simulates: tap Groceries pill (sets source=variable & payoff=variable),
        switch method to cash, save → expense debits Variable bucket."""
        groceries = self._groceries(client)
        assert groceries["parent_account"] == "variable"

        bal_before = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["balance"]

        # This is exactly what the FE will POST after the fix:
        r = client.post(f"{API}/expenses", json={
            "description": "TEST_iter3_cash_groceries",
            "amount": 75.0,
            "category_id": groceries["id"],
            "payment_method": "cash",
            "source_account": "variable",   # <-- now correctly set by selectCategory
        }, timeout=10)
        assert r.status_code == 200, r.text
        eid = r.json()["id"]

        # Variable balance decreased by 75
        bal_after = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["balance"]
        assert round(bal_before - bal_after, 2) == 75.0, (
            f"expected variable bucket debit of 75; got {bal_before - bal_after}"
        )

        # Dashboard categories.spent_this_month for Groceries reflects amount
        d = client.get(f"{API}/dashboard").json()
        cat_in_dash = next(c for c in d["categories"] if c["id"] == groceries["id"])
        assert cat_in_dash["spent_this_month"] >= 75.0

        # Cleanup (cash expense → reverses balance)
        client.delete(f"{API}/expenses/{eid}")

    def test_credit_path_selectcategory_then_save(self, client):
        """Simulates: tap Groceries (sets payoff=variable), method stays credit, save →
        owed_to_cards on Variable bucket increases."""
        groceries = self._groceries(client)

        d_before = client.get(f"{API}/dashboard").json()
        var_before = next(a for a in d_before["accounts"] if a["key"] == "variable")
        owed_before = var_before.get("owed_to_cards", 0.0)

        r = client.post(f"{API}/expenses", json={
            "description": "TEST_iter3_credit_groceries",
            "amount": 60.0,
            "category_id": groceries["id"],
            "payment_method": "credit",
            "card": "amex",
            "payoff_account": "variable",   # set by selectCategory
        }, timeout=10)
        assert r.status_code == 200, r.text
        eid = r.json()["id"]

        d_after = client.get(f"{API}/dashboard").json()
        var_after = next(a for a in d_after["accounts"] if a["key"] == "variable")
        owed_after = var_after.get("owed_to_cards", 0.0)
        assert round(owed_after - owed_before, 2) == 60.0, (
            f"expected variable owed_to_cards +60; got {owed_after - owed_before}"
        )

        # Cleanup
        client.delete(f"{API}/expenses/{eid}")
