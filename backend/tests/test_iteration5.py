"""Iteration 5 — Period selector, skip/unskip, upcoming CRUD+realize, Personal sub-categories.

Covers:
- GET /api/analytics?period=3m|6m|12m|ytd
- POST /api/categories/{id}/skip + unskip (idempotent)
- POST /api/categories/{id}/run blocked when month in skipped_months
- POST/GET/PUT/DELETE /api/upcoming + /realize
- Seed creates Personal group + His/Hers Spending under 'general' (target=$400)
"""
import os
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://budget-zero-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def reseed(client):
    client.post(f"{API}/reset", timeout=15)
    client.post(f"{API}/seed-budget", timeout=15)
    yield
    client.post(f"{API}/reset", timeout=15)
    client.post(f"{API}/seed-budget", timeout=15)


def _by_name(items, name):
    return next((x for x in items if x["name"] == name), None)


# ---------- Test 1: Personal categories seeded under 'his' and 'hers' accounts (iter6) ----------
class TestPersonalSeed:
    def test_personal_his_and_hers_exist(self, client):
        cats = client.get(f"{API}/categories").json()
        his_personals = [c for c in cats if c["name"] == "Personal" and c["parent_account"] == "his"]
        hers_personals = [c for c in cats if c["name"] == "Personal" and c["parent_account"] == "hers"]
        assert len(his_personals) == 1, "Personal@his not seeded"
        assert len(hers_personals) == 1, "Personal@hers not seeded"
        assert his_personals[0]["monthly_target"] == 200.0
        assert hers_personals[0]["monthly_target"] == 200.0
        # No longer nested under a 'Personal' group in general
        assert his_personals[0].get("parent_id") in (None, "")
        assert hers_personals[0].get("parent_id") in (None, "")

    def test_account_targets_iter6(self, client):
        accts = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        # iter6: Personal moved out of general into his/hers
        assert round(accts["general"]["target"], 2) == 0.00
        assert round(accts["his"]["target"], 2) == 200.00
        assert round(accts["hers"]["target"], 2) == 200.00
        # Other targets unchanged
        assert round(accts["fixed_expenses"]["target"], 2) == 3645.96
        assert round(accts["variable"]["target"], 2) == 1550.00

    def test_seed_response_counts(self, client):
        r = client.post(f"{API}/seed-budget", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["fixed_count"] == 14
        assert body["variable_count"] == 7
        # iter6: keys changed from spending_count to his_count/hers_count
        assert body.get("his_count") == 1
        assert body.get("hers_count") == 1

    def test_dashboard_personal_is_leaf(self, client):
        d = client.get(f"{API}/dashboard").json()
        his_personal = next((c for c in d["categories"] if c["name"] == "Personal" and c["parent_account"] == "his"), None)
        assert his_personal is not None
        assert his_personal["is_group"] is False
        assert round(his_personal["effective_target"], 2) == 200.00


# ---------- Test 2: Analytics period selector ----------
class TestAnalyticsPeriod:
    def test_period_3m(self, client):
        r = client.get(f"{API}/analytics?period=3m", timeout=10)
        assert r.status_code == 200
        assert len(r.json()["months"]) == 3

    def test_period_6m(self, client):
        r = client.get(f"{API}/analytics?period=6m", timeout=10)
        assert r.status_code == 200
        assert len(r.json()["months"]) == 6

    def test_period_12m(self, client):
        r = client.get(f"{API}/analytics?period=12m", timeout=10)
        assert r.status_code == 200
        assert len(r.json()["months"]) == 12

    def test_period_ytd(self, client):
        r = client.get(f"{API}/analytics?period=ytd", timeout=10)
        assert r.status_code == 200
        months = r.json()["months"]
        expected = datetime.now(timezone.utc).month
        assert len(months) == expected, f"ytd expected {expected} months, got {len(months)}"
        # First month should be Jan of current year, last should be current month
        year = datetime.now(timezone.utc).year
        assert months[0]["month"] == f"{year:04d}-01"
        assert months[-1]["month"] == f"{year:04d}-{expected:02d}"

    def test_period_falls_back_to_months_param(self, client):
        # No period → uses months query param
        r = client.get(f"{API}/analytics?months=4", timeout=10)
        assert r.status_code == 200
        assert len(r.json()["months"]) == 4


# ---------- Test 3: Skip / Unskip recurring categories ----------
class TestSkipUnskip:
    def test_skip_and_idempotent(self, client):
        cats = client.get(f"{API}/categories").json()
        rent = _by_name(cats, "Rent")
        assert rent
        month = "2026-03"

        r1 = client.post(f"{API}/categories/{rent['id']}/skip", json={"month": month}, timeout=10)
        assert r1.status_code == 200

        # Second call → must remain a single entry
        r2 = client.post(f"{API}/categories/{rent['id']}/skip", json={"month": month}, timeout=10)
        assert r2.status_code == 200

        cats_after = client.get(f"{API}/categories").json()
        rent_after = _by_name(cats_after, "Rent")
        assert rent_after["skipped_months"].count(month) == 1, (
            f"expected 1 entry for {month}, got {rent_after['skipped_months']}"
        )

    def test_unskip_removes(self, client):
        cats = client.get(f"{API}/categories").json()
        rent = _by_name(cats, "Rent")
        month = "2026-03"

        r = client.post(f"{API}/categories/{rent['id']}/unskip", json={"month": month}, timeout=10)
        assert r.status_code == 200

        cats_after = client.get(f"{API}/categories").json()
        rent_after = _by_name(cats_after, "Rent")
        assert month not in rent_after["skipped_months"]

    def test_run_blocked_when_current_month_skipped(self, client):
        cats = client.get(f"{API}/categories").json()
        cats_new = _by_name(cats, "Cats")  # variable, target=150
        assert cats_new
        current = datetime.now(timezone.utc).strftime("%Y-%m")

        # Fund the variable account so /run wouldn't fail for missing balance
        client.post(f"{API}/incomes", json={
            "source": "TEST_iter5_fund",
            "allocation": {"fixed_expenses": 0, "variable": 500, "general": 0, "savings": 0},
        }, timeout=10)

        # Skip current month
        client.post(f"{API}/categories/{cats_new['id']}/skip", json={"month": current}, timeout=10)
        r = client.post(f"{API}/categories/{cats_new['id']}/run", timeout=10)
        assert r.status_code == 400, f"expected 400 when month skipped, got {r.status_code}: {r.text}"

        # Unskip and try again — should succeed
        client.post(f"{API}/categories/{cats_new['id']}/unskip", json={"month": current}, timeout=10)
        r2 = client.post(f"{API}/categories/{cats_new['id']}/run", timeout=10)
        assert r2.status_code == 200

        # Cleanup created expense
        eid = r2.json()["expense_id"]
        client.delete(f"{API}/expenses/{eid}")


# ---------- Test 4: Upcoming CRUD ----------
class TestUpcomingCRUD:
    def test_create_and_list_sorted(self, client):
        # Clear pre-existing
        for u in client.get(f"{API}/upcoming").json():
            client.delete(f"{API}/upcoming/{u['id']}")

        a = client.post(f"{API}/upcoming", json={
            "name": "TEST_LaterBill", "amount": 100.0,
            "due_date": "2026-05-15", "parent_account": "variable",
            "notes": "later",
        }, timeout=10)
        assert a.status_code == 200, a.text
        b = client.post(f"{API}/upcoming", json={
            "name": "TEST_EarlyBill", "amount": 50.0,
            "due_date": "2026-02-01", "parent_account": "variable",
        }, timeout=10)
        assert b.status_code == 200

        items = client.get(f"{API}/upcoming").json()
        names = [i["name"] for i in items if i["name"].startswith("TEST_")]
        # Earliest first
        assert names[0] == "TEST_EarlyBill"
        assert names[1] == "TEST_LaterBill"
        assert items[0]["realized"] is False

    def test_update_upcoming(self, client):
        items = client.get(f"{API}/upcoming").json()
        early = _by_name(items, "TEST_EarlyBill")
        r = client.put(f"{API}/upcoming/{early['id']}", json={"amount": 75.0, "notes": "updated"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["amount"] == 75.0
        assert r.json()["notes"] == "updated"
        # Persistence check
        items2 = client.get(f"{API}/upcoming").json()
        early2 = _by_name(items2, "TEST_EarlyBill")
        assert early2["amount"] == 75.0

    def test_delete_upcoming(self, client):
        items = client.get(f"{API}/upcoming").json()
        early = _by_name(items, "TEST_EarlyBill")
        r = client.delete(f"{API}/upcoming/{early['id']}", timeout=10)
        assert r.status_code == 200
        items2 = client.get(f"{API}/upcoming").json()
        assert _by_name(items2, "TEST_EarlyBill") is None


# ---------- Test 5: Upcoming realize ----------
class TestUpcomingRealize:
    def test_realize_creates_cash_expense_and_debits(self, client):
        # Fund variable
        inc = client.post(f"{API}/incomes", json={
            "source": "TEST_iter5_realize_fund",
            "allocation": {"fixed_expenses": 0, "variable": 300, "general": 0, "savings": 0},
        }, timeout=10).json()

        u = client.post(f"{API}/upcoming", json={
            "name": "TEST_Realize_Bill", "amount": 80.0,
            "due_date": "2026-04-10", "parent_account": "variable",
        }, timeout=10).json()

        bal_before = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["balance"]

        r = client.post(f"{API}/upcoming/{u['id']}/realize", timeout=10)
        assert r.status_code == 200
        eid = r.json()["expense_id"]

        bal_after = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["balance"]
        assert round(bal_before - bal_after, 2) == 80.00

        # realized=true persisted
        items = client.get(f"{API}/upcoming").json()
        u_after = next(x for x in items if x["id"] == u["id"])
        assert u_after["realized"] is True

        # Verify expense created and is cash from variable
        exps = client.get(f"{API}/expenses").json()
        exp = next((e for e in exps if e["id"] == eid), None)
        assert exp is not None
        assert exp["payment_method"] == "cash"
        assert exp["source_account"] == "variable"
        assert exp["amount"] == 80.0

        # Cleanup
        client.delete(f"{API}/expenses/{eid}")
        client.delete(f"{API}/upcoming/{u['id']}")
        client.delete(f"{API}/incomes/{inc['id']}")

    def test_realize_400_when_no_parent_account(self, client):
        u = client.post(f"{API}/upcoming", json={
            "name": "TEST_NoParent", "amount": 10.0,
            "due_date": "2026-06-01",
            # no parent_account
        }, timeout=10).json()

        r = client.post(f"{API}/upcoming/{u['id']}/realize", timeout=10)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

        # Cleanup
        client.delete(f"{API}/upcoming/{u['id']}")
