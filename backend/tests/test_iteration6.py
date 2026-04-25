"""Iteration 6 — His/Hers as first-class bank accounts + dynamic grouping.

Covers:
- GET /api/accounts returns 6 accounts in order fixed_expenses, variable, general, his, hers, savings
- Seed-budget: his.target=200, hers.target=200, general.target=0
- POST /api/incomes with his/hers allocation increases those balances
- POST /api/categories with parent_account='his' creates a sub under His; target propagates to his.target
- POST /api/categories with parent_id pointing to any existing category (leaf becomes group);
  account target only counts new leaves (not the converted group)
- DELETE /api/categories cascades and recomputes account.target
- POST /api/rollover sweeps all non-savings into savings (including his/hers)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://budget-zero-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EXPECTED_ORDER = ["fixed_expenses", "variable", "general", "his", "hers", "savings"]


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
    # Leave a clean seeded state for subsequent runs
    client.post(f"{API}/reset", timeout=15)
    client.post(f"{API}/seed-budget", timeout=15)


def _by_key(items, key):
    return next((x for x in items if x["key"] == key), None)


# ---------- Accounts schema + ordering ----------
class TestAccountsSchema:
    def test_six_accounts_in_order(self, client):
        r = client.get(f"{API}/accounts", timeout=10)
        assert r.status_code == 200
        accts = r.json()
        assert len(accts) == 6, f"expected 6 accounts, got {len(accts)}"
        keys = [a["key"] for a in accts]
        assert keys == EXPECTED_ORDER, f"order wrong, got {keys}"

    def test_his_and_hers_have_names_and_colors(self, client):
        accts = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert accts["his"]["name"] == "His Spending"
        assert accts["hers"]["name"] == "Hers Spending"
        # Colors must be present (non-empty strings)
        assert isinstance(accts["his"].get("color"), str) and accts["his"]["color"]
        assert isinstance(accts["hers"].get("color"), str) and accts["hers"]["color"]


# ---------- Seed-budget: targets correct for iter6 ----------
class TestSeedBudgetTargets:
    def test_seed_budget_targets(self, client):
        r = client.post(f"{API}/seed-budget", timeout=15)
        assert r.status_code == 200
        accts = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert round(accts["fixed_expenses"]["target"], 2) == 3645.96
        assert round(accts["variable"]["target"], 2) == 1550.00
        assert round(accts["general"]["target"], 2) == 0.00  # Personal moved out
        assert round(accts["his"]["target"], 2) == 200.00
        assert round(accts["hers"]["target"], 2) == 200.00
        assert round(accts["savings"]["target"], 2) == 0.00

    def test_personal_cat_lives_under_his_and_hers(self, client):
        cats = client.get(f"{API}/categories").json()
        his_personal = [c for c in cats if c["name"] == "Personal" and c["parent_account"] == "his"]
        hers_personal = [c for c in cats if c["name"] == "Personal" and c["parent_account"] == "hers"]
        assert len(his_personal) == 1
        assert len(hers_personal) == 1
        assert his_personal[0]["monthly_target"] == 200.0
        assert hers_personal[0]["monthly_target"] == 200.0


# ---------- Incomes: his/hers allocation ----------
class TestIncomeAllocationHisHers:
    def test_allocation_increases_his_and_hers_balances(self, client):
        # baseline balances
        before = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}

        payload = {
            "source": "TEST_iter6_paycheck",
            "allocation": {
                "fixed_expenses": 0.0,
                "variable": 0.0,
                "general": 0.0,
                "his": 100.0,
                "hers": 100.0,
                "savings": 0.0,
            },
        }
        r = client.post(f"{API}/incomes", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        inc = r.json()
        assert inc["allocation"]["his"] == 100.0
        assert inc["allocation"]["hers"] == 100.0

        # Verify balances actually moved
        after = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        assert round(after["his"] - before["his"], 2) == 100.00
        assert round(after["hers"] - before["hers"], 2) == 100.00

        # Cleanup: delete income, balances should revert
        client.delete(f"{API}/incomes/{inc['id']}")
        rev = {a["key"]: a["balance"] for a in client.get(f"{API}/accounts").json()}
        assert round(rev["his"], 2) == round(before["his"], 2)
        assert round(rev["hers"], 2) == round(before["hers"], 2)


# ---------- Categories under his account propagate target ----------
class TestCategoryUnderHis:
    def test_create_cat_under_his_propagates_target(self, client):
        # current his.target is 200 (from seed Personal)
        before = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        before_target = before["his"]["target"]

        payload = {"name": "TEST_Hobby", "parent_account": "his", "monthly_target": 50.0}
        r = client.post(f"{API}/categories", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        cat_id = r.json()["id"]

        after = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert round(after["his"]["target"] - before_target, 2) == 50.00

        # cleanup
        client.delete(f"{API}/categories/{cat_id}")
        final = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert round(final["his"]["target"], 2) == round(before_target, 2)


# ---------- Leaf becomes group when child added ----------
class TestLeafBecomesGroup:
    def test_adding_child_converts_leaf_to_group(self, client):
        # Find Groceries leaf under variable (target 850)
        cats = client.get(f"{API}/categories").json()
        groceries = next(c for c in cats if c["name"] == "Groceries" and c["parent_account"] == "variable")
        accts_before = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        var_target_before = accts_before["variable"]["target"]  # 1550

        # Add a sub to Groceries (leaf -> group)
        sub_payload = {
            "name": "TEST_Produce",
            "parent_account": "variable",
            "parent_id": groceries["id"],
            "monthly_target": 300.0,
        }
        r = client.post(f"{API}/categories", json=sub_payload, timeout=10)
        assert r.status_code == 200, r.text
        sub_id = r.json()["id"]

        # variable.target should now EXCLUDE Groceries (now a group) and INCLUDE TEST_Produce
        # Before: 850 (Groceries) + 300 (Gas) + 150 (Cats) + 250 (Utilities kids 50+100+100) = 1550
        # After: -850 (Groceries removed as it's now a group) + 300 (Produce) = 1000
        accts_after = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        expected_after = var_target_before - groceries["monthly_target"] + 300.0
        assert round(accts_after["variable"]["target"], 2) == round(expected_after, 2), (
            f"variable.target expected {expected_after}, got {accts_after['variable']['target']}"
        )

        # Dashboard should mark Groceries as is_group=true with rolled-up target
        d = client.get(f"{API}/dashboard").json()
        g_dash = next(c for c in d["categories"] if c["id"] == groceries["id"])
        assert g_dash["is_group"] is True
        assert round(g_dash["effective_target"], 2) == 300.0  # rolls up from sub

        # Cleanup: delete sub -> Groceries should become leaf again, target restored
        client.delete(f"{API}/categories/{sub_id}")
        accts_restore = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert round(accts_restore["variable"]["target"], 2) == round(var_target_before, 2)


# ---------- DELETE cascades children and recomputes target ----------
class TestDeleteCascade:
    def test_delete_group_cascades_children(self, client):
        cats = client.get(f"{API}/categories").json()
        utilities = next(c for c in cats if c["name"] == "Utilities" and c["parent_account"] == "variable")
        children = [c for c in cats if c.get("parent_id") == utilities["id"]]
        assert len(children) == 3, "expected 3 utilities children (Water/Hydro/Heating Gas)"

        accts_before = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        var_before = accts_before["variable"]["target"]  # 1550
        util_kids_total = sum(c["monthly_target"] for c in children)  # 250

        r = client.delete(f"{API}/categories/{utilities['id']}", timeout=10)
        assert r.status_code == 200

        # All children should be deleted too
        cats_after = client.get(f"{API}/categories").json()
        assert not any(c["id"] == utilities["id"] for c in cats_after)
        for ch in children:
            assert not any(c["id"] == ch["id"] for c in cats_after)

        # variable.target should drop by the sum of the children targets
        accts_after = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert round(accts_after["variable"]["target"], 2) == round(var_before - util_kids_total, 2)

        # Reseed for subsequent tests
        client.post(f"{API}/seed-budget", timeout=15)


# ---------- Rollover sweep covers his/hers ----------
class TestRolloverSweepsHisHers:
    def test_rollover_sweeps_his_hers_into_savings(self, client):
        # Reset to zero balances, then seed fresh
        client.post(f"{API}/reset", timeout=15)
        client.post(f"{API}/seed-budget", timeout=15)

        # Fund his=50, hers=75, variable=25 via income
        payload = {
            "source": "TEST_sweep_paycheck",
            "allocation": {
                "fixed_expenses": 0.0,
                "variable": 25.0,
                "general": 0.0,
                "his": 50.0,
                "hers": 75.0,
                "savings": 0.0,
            },
        }
        client.post(f"{API}/incomes", json=payload, timeout=10)

        before = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert round(before["his"]["balance"], 2) == 50.00
        assert round(before["hers"]["balance"], 2) == 75.00
        assert round(before["variable"]["balance"], 2) == 25.00
        savings_before = before["savings"]["balance"]

        r = client.post(f"{API}/rollover", json={"sweep_to_savings": True}, timeout=15)
        assert r.status_code == 200, r.text
        swept = r.json()["swept"]
        assert round(swept.get("his", 0), 2) == 50.00, f"his not swept: {swept}"
        assert round(swept.get("hers", 0), 2) == 75.00, f"hers not swept: {swept}"
        assert round(swept.get("variable", 0), 2) == 25.00
        assert "savings" not in swept  # savings itself must be skipped

        after = {a["key"]: a for a in client.get(f"{API}/accounts").json()}
        assert round(after["his"]["balance"], 2) == 0.00
        assert round(after["hers"]["balance"], 2) == 0.00
        assert round(after["variable"]["balance"], 2) == 0.00
        assert round(after["savings"]["balance"] - savings_before, 2) == 150.00  # 50+75+25
