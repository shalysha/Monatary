"""Backend API tests for Zero-Based Budgeting app."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://budget-zero-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Reset to clean state at start
    s.post(f"{API}/reset", timeout=15)
    yield s


# ---------- Init / seed ----------
class TestInitAndSeed:
    def test_init_seeds(self, client):
        r = client.post(f"{API}/init", timeout=10)
        assert r.status_code == 200

    def test_accounts_seeded(self, client):
        r = client.get(f"{API}/accounts", timeout=10)
        assert r.status_code == 200
        keys = sorted([a["key"] for a in r.json()])
        assert keys == ["fixed_expenses", "general", "savings", "variable"]

    def test_cards_seeded(self, client):
        r = client.get(f"{API}/cards", timeout=10)
        assert r.status_code == 200
        keys = sorted([c["key"] for c in r.json()])
        assert keys == ["amex", "mc", "visa"]

    def test_init_idempotent(self, client):
        client.post(f"{API}/init", timeout=10)
        r = client.get(f"{API}/accounts", timeout=10)
        assert len(r.json()) == 4


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_shape(self, client):
        r = client.get(f"{API}/dashboard", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "accounts" in d and "cards" in d and "totals" in d
        assert len(d["accounts"]) == 4 and len(d["cards"]) == 3
        for a in d["accounts"]:
            assert "owed_to_cards" in a and "projected_balance" in a and "is_negative_projected" in a
        assert {"total_balance", "total_owed", "total_projected"} <= set(d["totals"].keys())


# ---------- Income ----------
class TestIncome:
    def test_income_updates_balances(self, client):
        # baseline
        b0 = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        payload = {
            "source": "TEST_paycheck",
            "allocation": {"fixed_expenses": 1000, "variable": 500, "general": 300, "savings": 200},
        }
        r = client.post(f"{API}/incomes", json=payload, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 2000
        b1 = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        assert round(b1["fixed_expenses"] - b0["fixed_expenses"], 2) == 1000
        assert round(b1["variable"] - b0["variable"], 2) == 500
        assert round(b1["general"] - b0["general"], 2) == 300
        assert round(b1["savings"] - b0["savings"], 2) == 200


# ---------- Expenses cash & credit ----------
class TestExpenses:
    def test_cash_expense_deducts_account(self, client):
        b0 = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        r = client.post(f"{API}/expenses", json={
            "description": "TEST_groceries", "amount": 50,
            "payment_method": "cash", "source_account": "variable",
        }, timeout=10)
        assert r.status_code == 200
        b1 = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        assert round(b0["variable"] - b1["variable"], 2) == 50

    def test_credit_expense_increases_card_and_owed(self, client):
        c0 = {c["key"]: c["balance"] for c in client.get(f"{API}/cards").json()}
        r = client.post(f"{API}/expenses", json={
            "description": "TEST_amazon", "amount": 100,
            "payment_method": "credit", "card": "amex", "payoff_account": "general",
        }, timeout=10)
        assert r.status_code == 200
        exp_id = r.json()["id"]
        c1 = {c["key"]: c["balance"] for c in client.get(f"{API}/cards").json()}
        assert round(c1["amex"] - c0["amex"], 2) == 100
        d = client.get(f"{API}/dashboard").json()
        gen = next(a for a in d["accounts"] if a["key"] == "general")
        assert gen["owed_to_cards"] >= 100
        assert round(gen["projected_balance"], 2) == round(gen["balance"] - gen["owed_to_cards"], 2)
        # Card breakdown
        amex = next(c for c in d["cards"] if c["key"] == "amex")
        assert amex["breakdown"].get("general", 0) >= 100
        # cleanup
        client.delete(f"{API}/expenses/{exp_id}")

    def test_cash_validation(self, client):
        r = client.post(f"{API}/expenses", json={
            "description": "x", "amount": 10, "payment_method": "cash",
        }, timeout=10)
        assert r.status_code == 400

    def test_credit_validation(self, client):
        r = client.post(f"{API}/expenses", json={
            "description": "x", "amount": 10, "payment_method": "credit", "card": "amex",
        }, timeout=10)
        assert r.status_code == 400

    def test_delete_cash_expense_refunds(self, client):
        b0 = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        r = client.post(f"{API}/expenses", json={
            "description": "TEST_refund", "amount": 25,
            "payment_method": "cash", "source_account": "general",
        }, timeout=10)
        eid = r.json()["id"]
        rd = client.delete(f"{API}/expenses/{eid}", timeout=10)
        assert rd.status_code == 200
        b1 = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        assert round(b1["general"], 2) == round(b0["general"], 2)

    def test_delete_credit_expense_decreases_card(self, client):
        c0 = {c["key"]: c["balance"] for c in client.get(f"{API}/cards").json()}
        r = client.post(f"{API}/expenses", json={
            "description": "TEST_cc_del", "amount": 75,
            "payment_method": "credit", "card": "visa", "payoff_account": "fixed_expenses",
        }, timeout=10)
        eid = r.json()["id"]
        client.delete(f"{API}/expenses/{eid}", timeout=10)
        c1 = {c["key"]: c["balance"] for c in client.get(f"{API}/cards").json()}
        assert round(c1["visa"], 2) == round(c0["visa"], 2)


# ---------- Negative projection ----------
class TestNegativeProjection:
    def test_negative_flag(self, client):
        # general balance is small; add a large credit charge against it
        r = client.post(f"{API}/expenses", json={
            "description": "TEST_big", "amount": 99999,
            "payment_method": "credit", "card": "mc", "payoff_account": "savings",
        }, timeout=10)
        eid = r.json()["id"]
        d = client.get(f"{API}/dashboard").json()
        sav = next(a for a in d["accounts"] if a["key"] == "savings")
        assert sav["is_negative_projected"] is True
        client.delete(f"{API}/expenses/{eid}")


# ---------- Card payoff ----------
class TestCardPayoff:
    def test_payoff_zeros_card_and_debits_accounts(self, client):
        # Create credit expenses and pay off
        client.post(f"{API}/expenses", json={
            "description": "TEST_p1", "amount": 100,
            "payment_method": "credit", "card": "visa", "payoff_account": "fixed_expenses",
        })
        client.post(f"{API}/expenses", json={
            "description": "TEST_p2", "amount": 50,
            "payment_method": "credit", "card": "visa", "payoff_account": "general",
        })
        b0 = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        r = client.post(f"{API}/cards/payoff", json={"card": "visa"}, timeout=10)
        assert r.status_code == 200
        cards = {c["key"]: c["balance"] for c in client.get(f"{API}/cards").json()}
        assert round(cards["visa"], 2) == 0.0
        b1 = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        assert round(b0["fixed_expenses"] - b1["fixed_expenses"], 2) == 100
        assert round(b0["general"] - b1["general"], 2) == 50


# ---------- Update account ----------
class TestAccountUpdate:
    def test_update_target_and_balance(self, client):
        r = client.put(f"{API}/accounts/savings", json={"target": 500, "balance": 1234.56}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["target"] == 500 and body["balance"] == 1234.56
        # Verify persistence
        accs = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert accs["savings"]["target"] == 500


# ---------- Reset ----------
class TestReset:
    def test_reset_clears_data(self, client):
        r = client.post(f"{API}/reset", timeout=15)
        assert r.status_code == 200
        accs = client.get(f"{API}/accounts").json()
        assert len(accs) == 4
        for a in accs:
            assert a["balance"] == 0.0
        cards = client.get(f"{API}/cards").json()
        for c in cards:
            assert c["balance"] == 0.0
        assert client.get(f"{API}/incomes").json() == []
        assert client.get(f"{API}/expenses").json() == []
