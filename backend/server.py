from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
AccountKey = Literal["fixed_expenses", "variable", "general", "savings"]
CardKey = Literal["amex", "mc", "visa"]


class BankAccount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    key: str  # fixed_expenses | variable | general | savings
    name: str
    balance: float = 0.0
    target: float = 0.0  # monthly spending target / allocation
    color: str = "#5C8065"


class CreditCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    key: str  # amex | mc | visa
    name: str
    balance: float = 0.0  # outstanding balance to be paid
    color: str = "#4A7485"


class IncomeAllocation(BaseModel):
    fixed_expenses: float = 0.0
    variable: float = 0.0
    general: float = 0.0
    his: float = 0.0
    hers: float = 0.0
    savings: float = 0.0


class IncomeCreate(BaseModel):
    source: str
    date: Optional[str] = None
    allocation: IncomeAllocation


class Income(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: str
    date: str
    allocation: IncomeAllocation
    total: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ExpenseCreate(BaseModel):
    description: str
    amount: float
    category: Optional[str] = None  # legacy free-text
    category_id: Optional[str] = None
    date: Optional[str] = None
    payment_method: Literal["cash", "credit"]
    source_account: Optional[str] = None  # AccountKey
    card: Optional[str] = None  # CardKey
    payoff_account: Optional[str] = None  # AccountKey


class Expense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    amount: float
    category: Optional[str] = None
    category_id: Optional[str] = None
    date: str
    payment_method: str
    source_account: Optional[str] = None
    card: Optional[str] = None
    payoff_account: Optional[str] = None
    paid: bool = False
    paid_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RecurringExpense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    amount: float
    category: Optional[str] = None
    payment_method: Literal["cash", "credit"]
    source_account: Optional[str] = None
    card: Optional[str] = None
    payoff_account: Optional[str] = None
    day_of_month: int = 1
    last_run_month: Optional[str] = None  # YYYY-MM
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RecurringCreate(BaseModel):
    description: str
    amount: float
    category: Optional[str] = None
    payment_method: Literal["cash", "credit"]
    source_account: Optional[str] = None
    card: Optional[str] = None
    payoff_account: Optional[str] = None
    day_of_month: int = 1


class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    parent_account: str  # AccountKey: fixed_expenses | variable | general | savings
    parent_id: Optional[str] = None  # if set, this is a sub-category nested under another category
    monthly_target: float = 0.0
    auto_create: bool = False  # if true, becomes a recurring monthly expense
    day_of_month: int = 1
    last_run_month: Optional[str] = None
    skipped_months: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class UpcomingExpense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    amount: float
    due_date: str  # YYYY-MM-DD
    parent_account: Optional[str] = None  # which bucket should fund it
    notes: Optional[str] = None
    realized: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class UpcomingCreate(BaseModel):
    name: str
    amount: float
    due_date: str
    parent_account: Optional[str] = None
    notes: Optional[str] = None


class UpcomingUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[str] = None
    parent_account: Optional[str] = None
    notes: Optional[str] = None
    realized: Optional[bool] = None


class SkipRequest(BaseModel):
    month: str  # YYYY-MM


class CategoryCreate(BaseModel):
    name: str
    parent_account: str
    parent_id: Optional[str] = None
    monthly_target: float = 0.0
    auto_create: bool = False
    day_of_month: int = 1


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    parent_account: Optional[str] = None
    parent_id: Optional[str] = None
    monthly_target: Optional[float] = None
    auto_create: Optional[bool] = None
    day_of_month: Optional[int] = None


class AccountUpdate(BaseModel):
    target: Optional[float] = None
    balance: Optional[float] = None
    name: Optional[str] = None


# ---------- Defaults ----------
DEFAULT_ACCOUNTS = [
    {"key": "fixed_expenses", "name": "Fixed Expenses", "color": "#8D9489", "target": 0.0, "balance": 0.0},
    {"key": "variable", "name": "Variable", "color": "#D69F4C", "target": 0.0, "balance": 0.0},
    {"key": "general", "name": "Spending", "color": "#9A8C73", "target": 0.0, "balance": 0.0},
    {"key": "his", "name": "His Spending", "color": "#4A7485", "target": 0.0, "balance": 0.0},
    {"key": "hers", "name": "Hers Spending", "color": "#A86B7E", "target": 0.0, "balance": 0.0},
    {"key": "savings", "name": "Savings", "color": "#5C8065", "target": 0.0, "balance": 0.0},
]
DEFAULT_CARDS = [
    {"key": "amex", "name": "Amex", "color": "#4A7485", "balance": 0.0},
    {"key": "mc", "name": "Mastercard", "color": "#C86A4C", "balance": 0.0},
    {"key": "visa", "name": "Visa", "color": "#2B3A4A", "balance": 0.0},
]


async def ensure_seed():
    count_a = await db.accounts.count_documents({})
    if count_a == 0:
        for a in DEFAULT_ACCOUNTS:
            acc = BankAccount(**a)
            await db.accounts.insert_one(acc.model_dump())
    else:
        # Migration: add any missing default accounts (e.g., his/hers added later)
        existing_keys = set()
        async for d in db.accounts.find({}, {"_id": 0, "key": 1}):
            existing_keys.add(d.get("key"))
        for a in DEFAULT_ACCOUNTS:
            if a["key"] not in existing_keys:
                acc = BankAccount(**a)
                await db.accounts.insert_one(acc.model_dump())
    count_c = await db.cards.count_documents({})
    if count_c == 0:
        for c in DEFAULT_CARDS:
            card = CreditCard(**c)
            await db.cards.insert_one(card.model_dump())


def strip_id(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Zero-Based Budgeting API"}


@api_router.post("/init")
async def init_data():
    await ensure_seed()
    return {"status": "ok"}


@api_router.get("/accounts", response_model=List[BankAccount])
async def get_accounts():
    await ensure_seed()
    docs = await db.accounts.find({}, {"_id": 0}).to_list(100)
    order = {a["key"]: i for i, a in enumerate(DEFAULT_ACCOUNTS)}
    docs.sort(key=lambda d: order.get(d.get("key", ""), 99))
    return [BankAccount(**d) for d in docs]


@api_router.put("/accounts/{key}", response_model=BankAccount)
async def update_account(key: str, update: AccountUpdate):
    fields = {k: v for k, v in update.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "No fields to update")
    await db.accounts.update_one({"key": key}, {"$set": fields})
    doc = await db.accounts.find_one({"key": key}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Account not found")
    return BankAccount(**doc)


@api_router.get("/cards", response_model=List[CreditCard])
async def get_cards():
    await ensure_seed()
    docs = await db.cards.find({}, {"_id": 0}).to_list(100)
    order = {"amex": 0, "mc": 1, "visa": 2}
    docs.sort(key=lambda d: order.get(d.get("key", ""), 99))
    return [CreditCard(**d) for d in docs]


# Income
@api_router.post("/incomes", response_model=Income)
async def create_income(payload: IncomeCreate):
    await ensure_seed()
    alloc = payload.allocation
    total = alloc.fixed_expenses + alloc.variable + alloc.general + alloc.savings
    income = Income(
        source=payload.source,
        date=payload.date or datetime.now(timezone.utc).date().isoformat(),
        allocation=alloc,
        total=total,
    )
    await db.incomes.insert_one(income.model_dump())
    # Update account balances
    for key, val in alloc.model_dump().items():
        if val:
            await db.accounts.update_one({"key": key}, {"$inc": {"balance": val}})
    return income


@api_router.get("/incomes", response_model=List[Income])
async def get_incomes():
    docs = await db.incomes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Income(**d) for d in docs]


@api_router.delete("/incomes/{income_id}")
async def delete_income(income_id: str):
    doc = await db.incomes.find_one({"id": income_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Income not found")
    # reverse allocation
    alloc = doc.get("allocation", {})
    for key, val in alloc.items():
        if val:
            await db.accounts.update_one({"key": key}, {"$inc": {"balance": -val}})
    await db.incomes.delete_one({"id": income_id})
    return {"status": "deleted"}


# Expenses
@api_router.post("/expenses", response_model=Expense)
async def create_expense(payload: ExpenseCreate):
    await ensure_seed()
    if payload.payment_method == "cash":
        if not payload.source_account:
            raise HTTPException(400, "source_account is required for cash payments")
    elif payload.payment_method == "credit":
        if not payload.card or not payload.payoff_account:
            raise HTTPException(400, "card and payoff_account are required for credit payments")
    else:
        raise HTTPException(400, "Invalid payment_method")

    expense = Expense(
        description=payload.description,
        amount=payload.amount,
        category=payload.category,
        category_id=payload.category_id,
        date=payload.date or datetime.now(timezone.utc).date().isoformat(),
        payment_method=payload.payment_method,
        source_account=payload.source_account,
        card=payload.card,
        payoff_account=payload.payoff_account,
    )
    await db.expenses.insert_one(expense.model_dump())

    if payload.payment_method == "cash":
        await db.accounts.update_one({"key": payload.source_account}, {"$inc": {"balance": -payload.amount}})
    else:
        # Increase credit card balance owed
        await db.cards.update_one({"key": payload.card}, {"$inc": {"balance": payload.amount}})
    return expense


@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(month: Optional[str] = None):
    q = {}
    if month:
        # month in YYYY-MM format
        q = {"date": {"$regex": f"^{month}"}}
    docs = await db.expenses.find(q, {"_id": 0}).sort("date", -1).to_list(2000)
    return [Expense(**d) for d in docs]


@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str):
    doc = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Expense not found")
    # Skip balance reversal if already paid (settled history)
    if not doc.get("paid"):
        if doc["payment_method"] == "cash" and doc.get("source_account"):
            await db.accounts.update_one({"key": doc["source_account"]}, {"$inc": {"balance": doc["amount"]}})
        elif doc["payment_method"] == "credit" and doc.get("card"):
            await db.cards.update_one({"key": doc["card"]}, {"$inc": {"balance": -doc["amount"]}})
    await db.expenses.delete_one({"id": expense_id})
    return {"status": "deleted"}


# ---------- Recurring expenses ----------
@api_router.get("/recurring", response_model=List[RecurringExpense])
async def list_recurring():
    docs = await db.recurring.find({}, {"_id": 0}).to_list(500)
    return [RecurringExpense(**d) for d in docs]


@api_router.post("/recurring", response_model=RecurringExpense)
async def create_recurring(payload: RecurringCreate):
    if payload.payment_method == "cash" and not payload.source_account:
        raise HTTPException(400, "source_account required")
    if payload.payment_method == "credit" and (not payload.card or not payload.payoff_account):
        raise HTTPException(400, "card and payoff_account required")
    rec = RecurringExpense(**payload.model_dump())
    await db.recurring.insert_one(rec.model_dump())
    return rec


@api_router.delete("/recurring/{rec_id}")
async def delete_recurring(rec_id: str):
    await db.recurring.delete_one({"id": rec_id})
    return {"status": "deleted"}


@api_router.post("/recurring/{rec_id}/run")
async def run_recurring(rec_id: str):
    """Manually run a recurring template — creates an expense for current month."""
    rec = await db.recurring.find_one({"id": rec_id}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Not found")
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    payload = ExpenseCreate(
        description=rec["description"],
        amount=rec["amount"],
        category=rec.get("category"),
        payment_method=rec["payment_method"],
        source_account=rec.get("source_account"),
        card=rec.get("card"),
        payoff_account=rec.get("payoff_account"),
    )
    expense = await create_expense(payload)
    await db.recurring.update_one({"id": rec_id}, {"$set": {"last_run_month": month}})
    return {"status": "ok", "expense_id": expense.id}


# ---------- Analytics ----------
@api_router.get("/analytics")
async def analytics(months: int = 6, period: Optional[str] = None):
    """Returns per-month totals for income, expenses, and per-account spend.
    period overrides months: '3m', '6m', '12m', 'ytd'."""
    today = datetime.now(timezone.utc)
    if period == "ytd":
        months = today.month  # Jan..current month
    elif period == "3m":
        months = 3
    elif period == "6m":
        months = 6
    elif period == "12m":
        months = 12
    months = max(1, min(months, 24))

    results = []
    for i in range(months):
        # compute month YYYY-MM going back i months
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        month_str = f"{y:04d}-{m:02d}"

        # Income
        inc_pipe = [
            {"$match": {"date": {"$regex": f"^{month_str}"}}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}},
        ]
        inc_agg = await db.incomes.aggregate(inc_pipe).to_list(1)
        income_total = inc_agg[0]["total"] if inc_agg else 0.0

        # Expenses by account
        exp_pipe = [
            {"$match": {"date": {"$regex": f"^{month_str}"}}},
            {"$project": {
                "amount": 1,
                "account": {"$ifNull": ["$source_account", "$payoff_account"]},
            }},
            {"$group": {"_id": "$account", "total": {"$sum": "$amount"}}},
        ]
        exp_agg = await db.expenses.aggregate(exp_pipe).to_list(100)
        by_account = {row["_id"]: row["total"] for row in exp_agg if row["_id"]}
        expense_total = sum(by_account.values())

        # Expenses by category
        cat_pipe = [
            {"$match": {"date": {"$regex": f"^{month_str}"}, "category_id": {"$ne": None}}},
            {"$group": {"_id": "$category_id", "total": {"$sum": "$amount"}}},
        ]
        cat_agg = await db.expenses.aggregate(cat_pipe).to_list(500)
        by_category = {row["_id"]: row["total"] for row in cat_agg if row["_id"]}

        results.append({
            "month": month_str,
            "income": income_total,
            "expense": expense_total,
            "net": income_total - expense_total,
            "by_account": by_account,
            "by_category": by_category,
        })
    return {"months": list(reversed(results))}


# ---------- Monthly rollover ----------
class RolloverRequest(BaseModel):
    sweep_to_savings: bool = True


@api_router.post("/rollover")
async def rollover(payload: RolloverRequest):
    """Sweep leftover positive balance from all non-savings buckets into Savings."""
    swept = {}
    if payload.sweep_to_savings:
        async for doc in db.accounts.find({}, {"_id": 0}):
            key = doc.get("key")
            if key == "savings":
                continue
            bal = doc.get("balance", 0.0)
            if bal > 0:
                swept[key] = bal
                await db.accounts.update_one({"key": key}, {"$set": {"balance": 0.0}})
                await db.accounts.update_one({"key": "savings"}, {"$inc": {"balance": bal}})
    return {"status": "ok", "swept": swept}


# Pay off a credit card (transfers from bank accounts to clear card balance)
class PayoffRequest(BaseModel):
    card: str  # CardKey


@api_router.post("/cards/payoff")
async def payoff_card(payload: PayoffRequest):
    """Settle a credit card by deducting the projected payoff amounts from each bank account
    and zeroing the card balance. Allocation is determined by sum of credit expenses on this card
    grouped by payoff_account."""
    card_doc = await db.cards.find_one({"key": payload.card}, {"_id": 0})
    if not card_doc:
        raise HTTPException(404, "Card not found")

    # Determine allocation from outstanding (unpaid) credit expenses on this card
    pipeline = [
        {"$match": {"payment_method": "credit", "card": payload.card, "paid": {"$ne": True}}},
        {"$group": {"_id": "$payoff_account", "total": {"$sum": "$amount"}}},
    ]
    agg = await db.expenses.aggregate(pipeline).to_list(100)
    transfers = {row["_id"]: row["total"] for row in agg if row["_id"]}

    for acct_key, amt in transfers.items():
        await db.accounts.update_one({"key": acct_key}, {"$inc": {"balance": -amt}})
    await db.cards.update_one({"key": payload.card}, {"$set": {"balance": 0.0}})
    # Mark expenses as paid (preserve history)
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.expenses.update_many(
        {"payment_method": "credit", "card": payload.card, "paid": {"$ne": True}},
        {"$set": {"paid": True, "paid_at": now_iso}},
    )
    return {"status": "ok", "transfers": transfers}


# Dashboard aggregated data
@api_router.get("/dashboard")
async def get_dashboard():
    await ensure_seed()
    accounts = await db.accounts.find({}, {"_id": 0}).to_list(100)
    cards = await db.cards.find({}, {"_id": 0}).to_list(100)

    # Aggregate credit expense allocations per card x payoff_account (unpaid only)
    pipeline = [
        {"$match": {"payment_method": "credit", "paid": {"$ne": True}}},
        {"$group": {
            "_id": {"card": "$card", "payoff_account": "$payoff_account"},
            "total": {"$sum": "$amount"},
        }},
    ]
    agg = await db.expenses.aggregate(pipeline).to_list(500)

    # transfers_by_card[card_key] = { account_key: amount }
    transfers_by_card = {}
    # owed_by_account[account_key] = total to transfer out across all cards (init from accounts list)
    owed_by_account: dict = {}
    async for a in db.accounts.find({}, {"_id": 0, "key": 1}):
        owed_by_account[a["key"]] = 0.0
    for row in agg:
        card_k = row["_id"].get("card")
        acct_k = row["_id"].get("payoff_account")
        amt = row["total"]
        if not card_k or not acct_k:
            continue
        transfers_by_card.setdefault(card_k, {})[acct_k] = amt
        owed_by_account[acct_k] = owed_by_account.get(acct_k, 0.0) + amt

    # Monthly spend per account (cash + credit assigned to that payoff)
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    spend_pipeline = [
        {"$match": {"date": {"$regex": f"^{month}"}}},
        {"$project": {
            "amount": 1,
            "account": {"$ifNull": ["$source_account", "$payoff_account"]},
        }},
        {"$group": {"_id": "$account", "total": {"$sum": "$amount"}}},
    ]
    spend_agg = await db.expenses.aggregate(spend_pipeline).to_list(100)
    spend_by_account = {row["_id"]: row["total"] for row in spend_agg if row["_id"]}

    # Build account summary with projected balance after CC transfer
    account_summary = []
    order = {a["key"]: i for i, a in enumerate(DEFAULT_ACCOUNTS)}
    accounts.sort(key=lambda d: order.get(d.get("key", ""), 99))
    for a in accounts:
        owed = owed_by_account.get(a["key"], 0.0)
        projected = a["balance"] - owed
        account_summary.append({
            **a,
            "owed_to_cards": owed,
            "projected_balance": projected,
            "spent_this_month": spend_by_account.get(a["key"], 0.0),
            "is_negative_projected": projected < 0,
            "is_zero_projected": abs(projected) < 0.005,
        })

    # Card summary with breakdown
    card_summary = []
    card_order = {"amex": 0, "mc": 1, "visa": 2}
    cards.sort(key=lambda d: card_order.get(d.get("key", ""), 99))
    for c in cards:
        breakdown = transfers_by_card.get(c["key"], {})
        card_summary.append({**c, "breakdown": breakdown})

    # Totals
    total_balance = sum(a["balance"] for a in accounts)
    total_owed = sum(c["balance"] for c in cards)
    total_projected = total_balance - total_owed

    # Per-category spent_this_month
    cat_spend_pipeline = [
        {"$match": {"date": {"$regex": f"^{month}"}, "category_id": {"$ne": None}}},
        {"$group": {"_id": "$category_id", "total": {"$sum": "$amount"}}},
    ]
    cat_spend_agg = await db.expenses.aggregate(cat_spend_pipeline).to_list(500)
    cat_spend = {row["_id"]: row["total"] for row in cat_spend_agg if row["_id"]}

    # Categories with progress (groups roll up children)
    cat_docs = await db.categories.find({}, {"_id": 0}).to_list(500)
    parent_id_set = {c["parent_id"] for c in cat_docs if c.get("parent_id")}

    # Build child map: parent_id -> [child_docs]
    child_map: dict = {}
    for c in cat_docs:
        pid = c.get("parent_id")
        if pid:
            child_map.setdefault(pid, []).append(c)

    categories_out = []
    for c in cat_docs:
        is_group = c["id"] in parent_id_set
        if is_group:
            children = child_map.get(c["id"], [])
            spent = sum(cat_spend.get(ch["id"], 0.0) for ch in children)
            target = sum(ch.get("monthly_target", 0.0) for ch in children)
        else:
            spent = cat_spend.get(c["id"], 0.0)
            target = c.get("monthly_target", 0.0)
        categories_out.append({
            **c,
            "is_group": is_group,
            "spent_this_month": spent,
            "effective_target": target,
            "remaining": max(0.0, target - spent),
            "over_budget": spent > target if target > 0 else False,
        })

    return {
        "accounts": account_summary,
        "cards": card_summary,
        "categories": categories_out,
        "totals": {
            "total_balance": total_balance,
            "total_owed": total_owed,
            "total_projected": total_projected,
        },
        "month": month,
    }


# Reset all data (clear everything; reseed)
@api_router.post("/reset")
async def reset_all():
    await db.accounts.delete_many({})
    await db.cards.delete_many({})
    await db.incomes.delete_many({})
    await db.expenses.delete_many({})
    await db.categories.delete_many({})
    await db.recurring.delete_many({})
    await ensure_seed()
    await _recompute_account_targets()
    return {"status": "reset"}


# ---------- Categories ----------
@api_router.get("/categories", response_model=List[Category])
async def list_categories():
    docs = await db.categories.find({}, {"_id": 0}).to_list(500)
    order = {a["key"]: i for i, a in enumerate(DEFAULT_ACCOUNTS)}
    docs.sort(key=lambda d: (order.get(d.get("parent_account", ""), 99), d.get("name", "")))
    return [Category(**d) for d in docs]


@api_router.post("/categories", response_model=Category)
async def create_category(payload: CategoryCreate):
    cat = Category(**payload.model_dump())
    await db.categories.insert_one(cat.model_dump())
    await _recompute_account_targets()
    return cat


@api_router.put("/categories/{cat_id}", response_model=Category)
async def update_category(cat_id: str, payload: CategoryUpdate):
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "No fields")
    await db.categories.update_one({"id": cat_id}, {"$set": fields})
    doc = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    await _recompute_account_targets()
    return Category(**doc)


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    # cascade delete children
    await db.categories.delete_many({"parent_id": cat_id})
    await db.categories.delete_one({"id": cat_id})
    await _recompute_account_targets()
    return {"status": "deleted"}


async def _recompute_account_targets():
    """Sum each account's LEAF category targets and store as account.target.
    Leaf categories = those without children. Group categories' own monthly_target is ignored
    so we don't double-count when children exist."""
    all_cats = await db.categories.find({}, {"_id": 0}).to_list(2000)
    parent_ids = {c["parent_id"] for c in all_cats if c.get("parent_id")}
    sums: dict = {}
    for c in all_cats:
        if c["id"] in parent_ids:
            continue  # this is a group; skip its own target
        k = c["parent_account"]
        sums[k] = sums.get(k, 0.0) + (c.get("monthly_target") or 0.0)
    # Update target for every existing account
    async for acc in db.accounts.find({}, {"_id": 0, "key": 1}):
        key = acc["key"]
        await db.accounts.update_one({"key": key}, {"$set": {"target": sums.get(key, 0.0)}})


# ---------- Run a recurring category ----------
@api_router.post("/categories/{cat_id}/run")
async def run_category(cat_id: str):
    """Create an expense from a category template (cash payment from its parent_account)."""
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Not found")
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    skipped = cat.get("skipped_months") or []
    if month in skipped:
        raise HTTPException(400, "This category is skipped for the current month")
    parent = cat["parent_account"]
    payload = ExpenseCreate(
        description=cat["name"],
        amount=cat["monthly_target"],
        category=cat["name"],
        category_id=cat["id"],
        payment_method="cash",
        source_account=parent,
    )
    expense = await create_expense(payload)
    await db.categories.update_one({"id": cat_id}, {"$set": {"last_run_month": month}})
    return {"status": "ok", "expense_id": expense.id}


@api_router.post("/categories/{cat_id}/skip")
async def skip_category(cat_id: str, payload: SkipRequest):
    """Mark a category as skipped for a given month (won't auto-run, hidden from 'pending' list)."""
    await db.categories.update_one({"id": cat_id}, {"$addToSet": {"skipped_months": payload.month}})
    return {"status": "ok"}


@api_router.post("/categories/{cat_id}/unskip")
async def unskip_category(cat_id: str, payload: SkipRequest):
    await db.categories.update_one({"id": cat_id}, {"$pull": {"skipped_months": payload.month}})
    return {"status": "ok"}


# ---------- Upcoming irregular expenses ----------
@api_router.get("/upcoming", response_model=List[UpcomingExpense])
async def list_upcoming():
    docs = await db.upcoming.find({}, {"_id": 0}).sort("due_date", 1).to_list(500)
    return [UpcomingExpense(**d) for d in docs]


@api_router.post("/upcoming", response_model=UpcomingExpense)
async def create_upcoming(payload: UpcomingCreate):
    item = UpcomingExpense(**payload.model_dump())
    await db.upcoming.insert_one(item.model_dump())
    return item


@api_router.put("/upcoming/{up_id}", response_model=UpcomingExpense)
async def update_upcoming(up_id: str, payload: UpcomingUpdate):
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "No fields")
    await db.upcoming.update_one({"id": up_id}, {"$set": fields})
    doc = await db.upcoming.find_one({"id": up_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return UpcomingExpense(**doc)


@api_router.delete("/upcoming/{up_id}")
async def delete_upcoming(up_id: str):
    await db.upcoming.delete_one({"id": up_id})
    return {"status": "deleted"}


@api_router.post("/upcoming/{up_id}/realize")
async def realize_upcoming(up_id: str):
    """Convert an upcoming expense into an actual cash expense from its parent_account."""
    doc = await db.upcoming.find_one({"id": up_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if doc.get("realized"):
        raise HTTPException(400, "Already realized")
    if not doc.get("parent_account"):
        raise HTTPException(400, "parent_account required to realize upcoming expense")
    payload = ExpenseCreate(
        description=doc["name"],
        amount=doc["amount"],
        date=doc.get("due_date"),
        payment_method="cash",
        source_account=doc["parent_account"],
    )
    exp = await create_expense(payload)
    await db.upcoming.update_one({"id": up_id}, {"$set": {"realized": True}})
    return {"status": "ok", "expense_id": exp.id}


# ---------- User Budget Seeding (idempotent: replaces existing categories) ----------
@api_router.post("/seed-budget")
async def seed_user_budget():
    await ensure_seed()
    await db.categories.delete_many({})
    fixed_items = [
        ("Rent", 2442.00),
        ("Car Payments", 542.00),
        ("Car Insurance", 187.23),
        ("Phone", 182.27),
        ("Cat Insurance", 67.28),
        ("Internet", 62.15),
        ("Donations", 45.00),
        ("Home Insurance", 34.56),
        ("School", 25.30),
        ("Spotify", 20.33),
        ("Amex (Membership)", 12.99),
        ("Amazon", 11.29),
        ("Oura", 9.05),
        ("Apple", 4.51),
    ]
    variable_items = [
        ("Groceries", 850.00),
        ("Gas (Car)", 300.00),
        ("Cats", 150.00),
    ]
    for name, target in fixed_items:
        cat = Category(name=name, parent_account="fixed_expenses", monthly_target=target, auto_create=True, day_of_month=1)
        await db.categories.insert_one(cat.model_dump())
    for name, target in variable_items:
        cat = Category(name=name, parent_account="variable", monthly_target=target, auto_create=False, day_of_month=1)
        await db.categories.insert_one(cat.model_dump())

    # Utilities group with nested children (Water/Hydro/Heating Gas)
    utilities = Category(name="Utilities", parent_account="variable", monthly_target=0.0, auto_create=False)
    await db.categories.insert_one(utilities.model_dump())
    sub_items = [("Water", 50.00), ("Hydro", 100.00), ("Heating Gas", 100.00)]
    for name, target in sub_items:
        sub = Category(
            name=name,
            parent_account="variable",
            parent_id=utilities.id,
            monthly_target=target,
            auto_create=False,
        )
        await db.categories.insert_one(sub.model_dump())

    # Personal Spending sub-buckets are now their own bank accounts (his / hers)
    his_cat = Category(name="Personal", parent_account="his", monthly_target=200.00, auto_create=False)
    await db.categories.insert_one(his_cat.model_dump())
    hers_cat = Category(name="Personal", parent_account="hers", monthly_target=200.00, auto_create=False)
    await db.categories.insert_one(hers_cat.model_dump())

    await _recompute_account_targets()
    return {"status": "ok", "fixed_count": len(fixed_items), "variable_count": len(variable_items) + 1 + len(sub_items), "his_count": 1, "hers_count": 1}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    await ensure_seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
