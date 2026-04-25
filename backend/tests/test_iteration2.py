"""Backend API tests for Iteration 2 — categories, paid CC ledger, analytics, rollover, seed-budget."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://budget-zero-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Clean slate (note: /api/reset does not currently delete categories — we drop manually via API)
    s.post(f"{API}/reset", timeout=15)
    # Wipe any existing categories by listing + deleting
    cats = s.get(f"{API}/categories").json()
    for c in cats:
        s.delete(f"{API}/categories/{c['id']}")
    yield s


# ---------- Seed Budget ----------
class TestSeedBudget:
    def test_seed_budget_idempotent_and_counts(self, client):
        r1 = client.post(f"{API}/seed-budget", timeout=15)
        assert r1.status_code == 200
        body = r1.json()
        assert body["fixed_count"] == 14
        assert body["variable_count"] == 7
        # Run again — must replace, not duplicate
        r2 = client.post(f"{API}/seed-budget", timeout=15)
        assert r2.status_code == 200
        cats = client.get(f"{API}/categories", timeout=10).json()
        assert len(cats) == 21

    def test_seed_budget_targets(self, client):
        cats = client.get(f"{API}/categories", timeout=10).json()
        fixed = [c for c in cats if c["parent_account"] == "fixed_expenses"]
        variable = [c for c in cats if c["parent_account"] == "variable"]
        assert len(fixed) == 14
        assert len(variable) == 7
        assert round(sum(c["monthly_target"] for c in fixed), 2) == 3645.96
        assert round(sum(c["monthly_target"] for c in variable), 2) == 1800.00
        # auto_create flag
        assert all(c["auto_create"] is True for c in fixed)
        assert all(c["auto_create"] is False for c in variable)

    def test_account_targets_recomputed(self, client):
        accts = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert round(accts["fixed_expenses"]["target"], 2) == 3645.96
        assert round(accts["variable"]["target"], 2) == 1800.00
        assert accts["general"]["target"] == 0.0
        assert accts["savings"]["target"] == 0.0


# ---------- Categories CRUD ----------
class TestCategoriesCRUD:
    def test_list_grouped(self, client):
        cats = client.get(f"{API}/categories").json()
        # Already verified count above; confirm grouped order (fixed first then variable)
        parents_seen = []
        for c in cats:
            if not parents_seen or parents_seen[-1] != c["parent_account"]:
                parents_seen.append(c["parent_account"])
        # Order should respect: fixed_expenses, variable, general, savings
        order_idx = {"fixed_expenses": 0, "variable": 1, "general": 2, "savings": 3}
        sorted_seen = sorted(parents_seen, key=lambda k: order_idx[k])
        assert parents_seen == sorted_seen

    def test_create_recomputes_target(self, client):
        before = {a["key"]: a["target"] for a in client.get(f"{API}/accounts").json()}
        r = client.post(f"{API}/categories", json={
            "name": "TEST_NewCat", "parent_account": "general",
            "monthly_target": 123.45, "auto_create": False,
        }, timeout=10)
        assert r.status_code == 200
        cat_id = r.json()["id"]
        after = {a["key"]: a["target"] for a in client.get(f"{API}/accounts").json()}
        assert round(after["general"] - before["general"], 2) == 123.45
        # Cleanup
        client.delete(f"{API}/categories/{cat_id}")

    def test_update_changes_target(self, client):
        r = client.post(f"{API}/categories", json={
            "name": "TEST_Upd", "parent_account": "savings", "monthly_target": 50.0,
        }).json()
        cat_id = r["id"]
        before = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "savings")["target"]
        u = client.put(f"{API}/categories/{cat_id}", json={"monthly_target": 75.0}, timeout=10)
        assert u.status_code == 200
        assert u.json()["monthly_target"] == 75.0
        after = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "savings")["target"]
        assert round(after - before, 2) == 25.0
        client.delete(f"{API}/categories/{cat_id}")

    def test_delete_recomputes_target(self, client):
        r = client.post(f"{API}/categories", json={
            "name": "TEST_Del", "parent_account": "general", "monthly_target": 200.0,
        }).json()
        cat_id = r["id"]
        before = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "general")["target"]
        d = client.delete(f"{API}/categories/{cat_id}", timeout=10)
        assert d.status_code == 200
        after = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "general")["target"]
        assert round(before - after, 2) == 200.0


# ---------- Run category ----------
class TestRunCategory:
    def test_run_creates_cash_expense_from_parent(self, client):
        # Give variable account some balance
        client.post(f"{API}/incomes", json={
            "source": "TEST_seed_inc",
            "allocation": {"fixed_expenses": 0, "variable": 1000, "general": 0, "savings": 0},
        })
        cats = client.get(f"{API}/categories").json()
        gas = next(c for c in cats if c["name"] == "Gas (Car)")  # variable, target=300
        bal_before = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["balance"]
        r = client.post(f"{API}/categories/{gas['id']}/run", timeout=10)
        assert r.status_code == 200
        eid = r.json()["expense_id"]
        bal_after = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["balance"]
        assert round(bal_before - bal_after, 2) == 300.0
        # Verify last_run_month set
        cat_now = next(c for c in client.get(f"{API}/categories").json() if c["id"] == gas["id"])
        assert cat_now["last_run_month"] is not None
        # Verify expense exists with category_id link
        exps = client.get(f"{API}/expenses").json()
        match = next((e for e in exps if e["id"] == eid), None)
        assert match is not None
        assert match["category_id"] == gas["id"]
        client.delete(f"{API}/expenses/{eid}")


# ---------- Expenses with category & dashboard categories ----------
class TestExpenseCategoryLink:
    def test_expense_with_category_id_and_dashboard(self, client):
        cats = client.get(f"{API}/categories").json()
        groceries = next(c for c in cats if c["name"] == "Groceries")  # variable, target=850
        # Spend below target
        r = client.post(f"{API}/expenses", json={
            "description": "TEST_g1", "amount": 100, "category_id": groceries["id"],
            "payment_method": "cash", "source_account": "variable",
        })
        assert r.status_code == 200
        eid = r.json()["id"]
        d = client.get(f"{API}/dashboard").json()
        assert "categories" in d
        cat_in_dash = next(c for c in d["categories"] if c["id"] == groceries["id"])
        assert cat_in_dash["spent_this_month"] >= 100
        assert cat_in_dash["over_budget"] is False
        client.delete(f"{API}/expenses/{eid}")

    def test_dashboard_over_budget_flag(self, client):
        cats = client.get(f"{API}/categories").json()
        water = next(c for c in cats if c["name"] == "Water")  # target=50
        r = client.post(f"{API}/expenses", json={
            "description": "TEST_water_over", "amount": 200, "category_id": water["id"],
            "payment_method": "cash", "source_account": "variable",
        })
        eid = r.json()["id"]
        d = client.get(f"{API}/dashboard").json()
        cat_in_dash = next(c for c in d["categories"] if c["id"] == water["id"])
        assert cat_in_dash["over_budget"] is True
        client.delete(f"{API}/expenses/{eid}")


# ---------- Paid CC ledger (history preservation) ----------
class TestPaidCardLedger:
    def test_payoff_marks_paid_and_preserves_history(self, client):
        # Create two credit charges on amex
        e1 = client.post(f"{API}/expenses", json={
            "description": "TEST_cc1", "amount": 60,
            "payment_method": "credit", "card": "amex", "payoff_account": "general",
        }).json()
        e2 = client.post(f"{API}/expenses", json={
            "description": "TEST_cc2", "amount": 40,
            "payment_method": "credit", "card": "amex", "payoff_account": "fixed_expenses",
        }).json()
        # Pay off
        r = client.post(f"{API}/cards/payoff", json={"card": "amex"}, timeout=10)
        assert r.status_code == 200
        # Card balance is zero
        cards = {c["key"]: c["balance"] for c in client.get(f"{API}/cards").json()}
        assert round(cards["amex"], 2) == 0.0
        # Expenses still exist (history) with paid=True
        exps = client.get(f"{API}/expenses").json()
        e1_now = next((e for e in exps if e["id"] == e1["id"]), None)
        e2_now = next((e for e in exps if e["id"] == e2["id"]), None)
        assert e1_now is not None and e1_now["paid"] is True
        assert e1_now["paid_at"] is not None
        assert e2_now is not None and e2_now["paid"] is True
        # Dashboard owed_to_cards excludes paid (so amex breakdown should not include these)
        d = client.get(f"{API}/dashboard").json()
        amex = next(c for c in d["cards"] if c["key"] == "amex")
        assert amex["breakdown"] == {} or all(v == 0 for v in amex["breakdown"].values())
        gen = next(a for a in d["accounts"] if a["key"] == "general")
        # Owed shouldn't reflect the now-paid 60
        # (other unpaid charges may exist from earlier tests; verify not larger than expected)
        # Cleanup paid expenses (no balance reversal since paid)
        bal_before = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        cards_before = {c["key"]: c["balance"] for c in client.get(f"{API}/cards").json()}
        client.delete(f"{API}/expenses/{e1['id']}")
        client.delete(f"{API}/expenses/{e2['id']}")
        bal_after = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        cards_after = {c["key"]: c["balance"] for c in client.get(f"{API}/cards").json()}
        # No reversal — balances unchanged
        for k in bal_before:
            assert round(bal_before[k] - bal_after[k], 2) == 0.0
        for k in cards_before:
            assert round(cards_before[k] - cards_after[k], 2) == 0.0


# ---------- Analytics ----------
class TestAnalytics:
    def test_analytics_shape(self, client):
        r = client.get(f"{API}/analytics?months=6", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "months" in data
        months = data["months"]
        assert len(months) == 6
        for m in months:
            assert {"month", "income", "expense", "net", "by_account", "by_category"} <= set(m.keys())
            assert isinstance(m["by_account"], dict)
            assert isinstance(m["by_category"], dict)
        # Months should be ascending (oldest first)
        ms = [m["month"] for m in months]
        assert ms == sorted(ms)


# ---------- Rollover ----------
class TestRollover:
    def test_rollover_sweeps_positive_to_savings(self, client):
        # Set known balances
        client.put(f"{API}/accounts/fixed_expenses", json={"balance": 100.0})
        client.put(f"{API}/accounts/variable", json={"balance": 200.0})
        client.put(f"{API}/accounts/general", json={"balance": 50.0})
        client.put(f"{API}/accounts/savings", json={"balance": 0.0})
        r = client.post(f"{API}/rollover", json={"sweep_to_savings": True}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        swept = body["swept"]
        assert round(swept.get("fixed_expenses", 0), 2) == 100.0
        assert round(swept.get("variable", 0), 2) == 200.0
        assert round(swept.get("general", 0), 2) == 50.0
        accs = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        assert accs["fixed_expenses"] == 0.0
        assert accs["variable"] == 0.0
        assert accs["general"] == 0.0
        assert round(accs["savings"], 2) == 350.0


# ---------- Account name update ----------
class TestAccountName:
    def test_update_name(self, client):
        r = client.put(f"{API}/accounts/general", json={"name": "Spending"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["name"] == "Spending"
        # Persist
        accts = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert accts["general"]["name"] == "Spending"
