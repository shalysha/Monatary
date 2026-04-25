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
    category: Optional[str] = None
    date: Optional[str] = None
    payment_method: Literal["cash", "credit"]
    # If cash: source_account is required (debits balance from this bank account)
    source_account: Optional[str] = None  # AccountKey
    # If credit: card and payoff_account are required
    card: Optional[str] = None  # CardKey
    payoff_account: Optional[str] = None  # AccountKey - which bank should pay the card off


class Expense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    amount: float
    category: Optional[str] = None
    date: str
    payment_method: str
    source_account: Optional[str] = None
    card: Optional[str] = None
    payoff_account: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AccountUpdate(BaseModel):
    target: Optional[float] = None
    balance: Optional[float] = None
    name: Optional[str] = None


# ---------- Defaults ----------
DEFAULT_ACCOUNTS = [
    {"key": "fixed_expenses", "name": "Fixed Expenses", "color": "#8D9489", "target": 0.0, "balance": 0.0},
    {"key": "variable", "name": "Variable", "color": "#D69F4C", "target": 0.0, "balance": 0.0},
    {"key": "general", "name": "General", "color": "#9A8C73", "target": 0.0, "balance": 0.0},
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
    order = {"fixed_expenses": 0, "variable": 1, "general": 2, "savings": 3}
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
    if doc["payment_method"] == "cash" and doc.get("source_account"):
        await db.accounts.update_one({"key": doc["source_account"]}, {"$inc": {"balance": doc["amount"]}})
    elif doc["payment_method"] == "credit" and doc.get("card"):
        await db.cards.update_one({"key": doc["card"]}, {"$inc": {"balance": -doc["amount"]}})
    await db.expenses.delete_one({"id": expense_id})
    return {"status": "deleted"}


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

    # Determine allocation from outstanding credit expenses on this card
    pipeline = [
        {"$match": {"payment_method": "credit", "card": payload.card}},
        {"$group": {"_id": "$payoff_account", "total": {"$sum": "$amount"}}},
    ]
    agg = await db.expenses.aggregate(pipeline).to_list(100)
    transfers = {row["_id"]: row["total"] for row in agg if row["_id"]}

    for acct_key, amt in transfers.items():
        await db.accounts.update_one({"key": acct_key}, {"$inc": {"balance": -amt}})
    await db.cards.update_one({"key": payload.card}, {"$set": {"balance": 0.0}})
    # Mark expenses as paid by removing them from outstanding (delete them so balances are clean)
    await db.expenses.delete_many({"payment_method": "credit", "card": payload.card})
    return {"status": "ok", "transfers": transfers}


# Dashboard aggregated data
@api_router.get("/dashboard")
async def get_dashboard():
    await ensure_seed()
    accounts = await db.accounts.find({}, {"_id": 0}).to_list(100)
    cards = await db.cards.find({}, {"_id": 0}).to_list(100)

    # Aggregate credit expense allocations per card x payoff_account
    pipeline = [
        {"$match": {"payment_method": "credit"}},
        {"$group": {
            "_id": {"card": "$card", "payoff_account": "$payoff_account"},
            "total": {"$sum": "$amount"},
        }},
    ]
    agg = await db.expenses.aggregate(pipeline).to_list(500)

    # transfers_by_card[card_key] = { account_key: amount }
    transfers_by_card = {}
    # owed_by_account[account_key] = total to transfer out across all cards
    owed_by_account = {"fixed_expenses": 0.0, "variable": 0.0, "general": 0.0, "savings": 0.0}
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
    order = {"fixed_expenses": 0, "variable": 1, "general": 2, "savings": 3}
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

    return {
        "accounts": account_summary,
        "cards": card_summary,
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
    await ensure_seed()
    return {"status": "reset"}


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
