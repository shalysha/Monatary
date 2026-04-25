"""Iteration 4 — Nested sub-categories.
Verifies that categories support a parent_id field and that:
- Seed creates a Utilities group with Water/Hydro/Heating Gas children.
- account.target sums LEAF categories only (no double-counting groups).
- POST/PUT /api/categories with parent_id correctly recomputes account.target.
- GET /api/dashboard rolls up children spent + target into the group via
  is_group / spent_this_month / effective_target.
- Spending against a child rolls up to the group.
- DELETE on a group cascades to children and recomputes account.target.
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


@pytest.fixture(scope="module", autouse=True)
def reseed(client):
    # Clean state at the start of the module
    client.post(f"{API}/reset", timeout=15)
    client.post(f"{API}/seed-budget", timeout=15)
    yield
    # Final cleanup — leave a clean reseeded state for the next agent
    client.post(f"{API}/reset", timeout=15)
    client.post(f"{API}/seed-budget", timeout=15)


def _by_name(cats, name):
    return next((c for c in cats if c["name"] == name), None)


# ---------- Test 1: Seed produces Utilities group + 3 children + correct totals ----------
class TestSeedNestedStructure:
    def test_seed_creates_utilities_group_and_children(self, client):
        cats = client.get(f"{API}/categories").json()
        # 14 fixed + 3 standalone variable + 1 group + 3 children + 1 Personal group + 2 personal children = 24
        assert len(cats) == 24, f"expected 24 categories, got {len(cats)}"

        utilities = _by_name(cats, "Utilities")
        assert utilities is not None, "Utilities group not seeded"
        assert utilities["parent_account"] == "variable"
        assert utilities.get("parent_id") in (None, ""), f"Utilities should have null parent_id, got {utilities.get('parent_id')}"
        assert utilities["monthly_target"] == 0.0

        for name, expected_target in [("Water", 50.00), ("Hydro", 100.00), ("Heating Gas", 100.00)]:
            child = _by_name(cats, name)
            assert child is not None, f"{name} child not seeded"
            assert child["parent_id"] == utilities["id"], (
                f"{name}.parent_id should equal Utilities.id"
            )
            assert child["parent_account"] == "variable"
            assert child["monthly_target"] == expected_target

    def test_variable_account_target_excludes_group_self_target(self, client):
        accts = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        # Leaves under variable: Groceries 850 + Gas 300 + Cats 150 + Water 50 + Hydro 100 + Heating Gas 100 = 1550
        assert round(accts["variable"]["target"], 2) == 1550.00, (
            f"variable.target expected 1550.00 (sum of leaves only), got {accts['variable']['target']}"
        )
        # Also fixed totals should match seed (sanity, no nesting there)
        assert round(accts["fixed_expenses"]["target"], 2) == 3645.96


# ---------- Test 2: POST /categories with parent_id increases account.target ----------
class TestCreateChildRecomputes:
    def test_create_child_increases_variable_target(self, client):
        cats = client.get(f"{API}/categories").json()
        utilities = _by_name(cats, "Utilities")
        assert utilities

        before = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["target"]

        r = client.post(f"{API}/categories", json={
            "name": "TEST_Internet_Util",
            "parent_account": "variable",
            "parent_id": utilities["id"],
            "monthly_target": 75.00,
        }, timeout=10)
        assert r.status_code == 200, r.text
        new_id = r.json()["id"]

        after = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["target"]
        assert round(after - before, 2) == 75.00, f"expected variable.target +75, got Δ={after - before}"

        # Cleanup
        client.delete(f"{API}/categories/{new_id}")
        restored = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["target"]
        assert round(restored, 2) == round(before, 2)


# ---------- Test 3: PUT child monthly_target updates account.target ----------
class TestUpdateChildRecomputes:
    def test_put_child_target_recomputes(self, client):
        cats = client.get(f"{API}/categories").json()
        water = _by_name(cats, "Water")
        assert water and water["monthly_target"] == 50.0

        before = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["target"]

        r = client.put(f"{API}/categories/{water['id']}", json={"monthly_target": 80.00}, timeout=10)
        assert r.status_code == 200, r.text

        after = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["target"]
        assert round(after - before, 2) == 30.00, f"expected variable.target +30 (50→80), got Δ={after - before}"

        # Restore
        client.put(f"{API}/categories/{water['id']}", json={"monthly_target": 50.00}, timeout=10)
        restored = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["target"]
        assert round(restored, 2) == round(before, 2)


# ---------- Test 4: Dashboard returns is_group + effective_target for groups ----------
class TestDashboardGroupRollup:
    def test_dashboard_marks_utilities_as_group(self, client):
        d = client.get(f"{API}/dashboard").json()
        cats = d["categories"]
        utilities = _by_name(cats, "Utilities")
        water = _by_name(cats, "Water")
        groceries = _by_name(cats, "Groceries")

        assert utilities and utilities.get("is_group") is True
        # effective_target = sum of children = 250
        assert round(utilities["effective_target"], 2) == 250.00, (
            f"Utilities.effective_target expected 250 (50+100+100), got {utilities['effective_target']}"
        )
        # No spending yet
        assert utilities["spent_this_month"] == 0.0

        assert water and water.get("is_group") is False
        assert round(water["effective_target"], 2) == 50.00

        # Sanity: Groceries (non-group, non-child) is not a group
        assert groceries and groceries.get("is_group") is False


# ---------- Test 5: Spending against a child rolls up into the parent group ----------
class TestChildSpendRollsUp:
    def test_child_expense_rolls_up_to_group(self, client):
        cats = client.get(f"{API}/categories").json()
        water = _by_name(cats, "Water")
        utilities = _by_name(cats, "Utilities")
        assert water and utilities

        # Need balance in Variable to debit cash; add income
        inc = client.post(f"{API}/incomes", json={
            "source": "TEST_iter4_income",
            "allocation": {"fixed_expenses": 0, "variable": 200, "general": 0, "savings": 0},
        }, timeout=10).json()

        r = client.post(f"{API}/expenses", json={
            "description": "TEST_iter4_water_bill",
            "amount": 20.0,
            "category_id": water["id"],
            "payment_method": "cash",
            "source_account": "variable",
        }, timeout=10)
        assert r.status_code == 200, r.text
        eid = r.json()["id"]

        d = client.get(f"{API}/dashboard").json()
        water_d = _by_name(d["categories"], "Water")
        util_d = _by_name(d["categories"], "Utilities")
        assert round(water_d["spent_this_month"], 2) == 20.00, water_d
        assert round(util_d["spent_this_month"], 2) == 20.00, (
            f"Utilities.spent_this_month should roll up child=20, got {util_d['spent_this_month']}"
        )
        # remaining = 250 - 20 = 230
        assert round(util_d["remaining"], 2) == 230.00

        # Cleanup
        client.delete(f"{API}/expenses/{eid}")
        client.delete(f"{API}/incomes/{inc['id']}")


# ---------- Test 6: DELETE on group cascades to children + recomputes account.target ----------
class TestDeleteGroupCascades:
    def test_delete_utilities_removes_children_and_recomputes(self, client):
        cats = client.get(f"{API}/categories").json()
        utilities = _by_name(cats, "Utilities")
        assert utilities

        before = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["target"]
        # Variable target before = 1550; Water+Hydro+Heating = 250 → after delete should be 1300

        r = client.delete(f"{API}/categories/{utilities['id']}", timeout=10)
        assert r.status_code == 200, r.text

        # Children must be gone
        cats_post = client.get(f"{API}/categories").json()
        for n in ("Utilities", "Water", "Hydro", "Heating Gas"):
            assert _by_name(cats_post, n) is None, f"{n} should be cascaded deleted"

        # variable.target = 850 + 300 + 150 = 1300
        after = next(a for a in client.get(f"{API}/accounts").json() if a["key"] == "variable")["target"]
        assert round(after, 2) == 1300.00, f"expected variable.target=1300 after cascade, got {after}"
        assert round(before - after, 2) == 250.00

        # Reseed for next module-level cleanup symmetry
        client.post(f"{API}/reset", timeout=15)
        client.post(f"{API}/seed-budget", timeout=15)
