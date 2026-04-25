# Zero-Based Budgeting App — PRD

## Overview
Single-user mobile budgeting dashboard (Expo + FastAPI + MongoDB) implementing zero-based budgeting with 4 bank account buckets and 3 credit cards. Currency: CAD.

## Core Concept
Every dollar of income is allocated into one of 4 bank account buckets:
- **Fixed Expenses** — non-negotiable monthly bills
- **Variable** — variable monthly essentials
- **General** — discretionary (coffee, restaurants, etc.)
- **Savings**

When a credit-card expense is logged, the user assigns which bank bucket will pay it off at month-end. The dashboard shows projected balance per account = balance − owed_to_cards, flagging any account that goes zero/negative.

## Features Implemented
- **Dashboard tab** — net position card, 4 bank accounts (with target progress bar), 3 credit-card summaries, negative-balance alert.
- **Activity tab** — chronological list of all income & expenses with filter pills (all/income/expense), long-press to delete.
- **Cards tab** — per-card outstanding amount + breakdown by payoff bank account, "Pay Off" button.
- **Settings tab** — set monthly target & current balance per account, reset all data.
- **Add Income modal** — distribute paycheck via amount or percentage mode, real-time "remaining" indicator.
- **Add Expense modal** — choose Credit (card + payoff account) or Bank Direct (source account).
- **Pay Off Card** — debits each bank account by its breakdown total and zeroes the card.

## Tech Stack
- **Frontend**: Expo Router, React Native, expo-google-fonts (Outfit + Manrope), @expo/vector-icons
- **Backend**: FastAPI, Motor (async MongoDB), Pydantic v2
- **Storage**: MongoDB (collections: accounts, cards, incomes, expenses)

## Design
Earthy/organic palette per `/app/design_guidelines.json` — sand backgrounds (#F7F5F0), forest green accents (#5C8065), terracotta warnings (#C26D5C), distinct card colors (Amex slate #4A7485, MC burnt orange #C86A4C, Visa deep navy #2B3A4A).

## Smart Enhancement
Real-time **projected net position** with negative-balance early warning so the user sees impact of CC charges before month-end (the "key insight" of zero-budgeting).
