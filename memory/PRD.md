# Zero-Based Budgeting App — PRD

## Overview
Single-user mobile budgeting app (Expo + FastAPI + MongoDB) implementing zero-based budgeting with 4 bank buckets, 3 credit cards, and per-line-item category tracking. Currency: CAD.

## Core Concept
Every dollar is allocated into one of 4 bank account buckets:
- **Fixed Expenses** — non-negotiable monthly bills
- **Variable** — variable monthly essentials
- **Spending** — discretionary (coffee, restaurants…)
- **Savings**

Each bucket contains user-defined **Categories** (e.g. Phone, Rent, Groceries) with `monthly_target` and optional `auto_create` flag. Account targets auto-recompute as sum of category targets.

When a credit-card expense is logged, the user assigns which bucket will pay it off at month-end. Dashboard shows projected balance per account = `balance − owed_to_cards`, flagging zero/negative.

## Features Implemented
**Core (Iter 1)**
- 5 tabs: Dashboard, Budget, Activity, Cards, Settings
- Income modal (amount or % split with live "remaining")
- Expense modal — Bank Direct (cash) OR Credit Card (with required payoff bucket)
- Pay-Off Card — debits bank accounts by breakdown, marks expenses paid
- Negative-balance alert, projected net position card

**Iter 2 (sub-category tracking)**
- **Categories** model (name, parent_account, monthly_target, auto_create, day_of_month)
- **Budget tab** — categories grouped by parent with progress bars; "Log Now" for fixed/recurring items; add/edit/delete
- **Add Expense** picks a Category which auto-fills bucket
- **/api/seed-budget** loads user's preset (14 fixed + 7 variable items, $5,445.96 total)
- **Historical CC ledger** — pay-off marks `paid=true` (preserves history); Activity has show/hide toggle and PAID badge
- **Multi-period Analytics** — `/api/analytics?months=6` returns income/expense/net, by_account, by_category; rendered as bar chart in Settings
- **Monthly Rollover** — `/api/rollover` sweeps positive Fixed/Variable/Spending balances into Savings; "Sweep to Savings" button in Settings

## User's Seeded Budget
Fixed Expenses ($3,645.96): Rent $2442, Car Payments $542, Car Insurance $187.23, Phone $182.27, Cat Insurance $67.28, Internet $62.15, Donations $45, Home Insurance $34.56, School $25.30, Spotify $20.33, Amex (Membership) $12.99, Amazon $11.29, Oura $9.05, Apple $4.51

Variable ($1,800.00): Groceries $850, Gas (Car) $300, Utilities $250, Cats $150, Gas (Heating) $100, Hydro $100, Water $50

> Note: User's stated total was $1,550 for variable but line items sum to $1,800 — likely a typo in the totals. Categories are editable in the Budget tab.

## Tech Stack
- Frontend: Expo Router, React Native, expo-google-fonts (Outfit + Manrope), @expo/vector-icons
- Backend: FastAPI, Motor, Pydantic v2
- Storage: MongoDB (accounts, cards, incomes, expenses, categories, recurring)

## Test Coverage
33/33 backend pytest cases passing (16 iter-1 + 14 iter-2 + 3 iter-3-fix). Frontend flows verified end-to-end via Playwright by testing agent.
