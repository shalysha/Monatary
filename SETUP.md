# Monatary Setup & Integration Guide

## Overview
Monatary is a zero-based budgeting app built with:
- **Frontend**: Expo Router + React Native (TypeScript)
- **Backend**: FastAPI + MongoDB
- **Currency**: CAD

This guide connects everything so your app works end-to-end.

---

## Quick Start

### Prerequisites
- Node.js 18+ (for frontend)
- Python 3.10+ (for backend)
- MongoDB running locally or Atlas connection string
- Expo CLI: `npm install -g expo-cli`

### Terminal 1: Start Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`

### Terminal 2: Start Frontend

```bash
cd frontend
yarn install
yarn start
```

Choose your platform:
- **`i`** → iOS simulator
- **`a`** → Android emulator
- **`w`** → Web browser (for testing)

---

## Environment Configuration

### Frontend `.env.local`
Located: `frontend/.env.local`

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

**Important**: 
- Must start with `EXPO_PUBLIC_` for Expo to recognize it
- Points to your local FastAPI backend
- For production, change to your deployed backend URL

---

## Architecture

### Data Flow

```
Expo App (Frontend)
    ↓
api.ts (TypeScript client)
    ↓
fetch() → http://localhost:8000/api/*
    ↓
FastAPI Backend
    ↓
MongoDB (Data storage)
```

### Key Endpoints

All endpoints are prefixed with `/api`

**Accounts**
- `GET /accounts` — List all bank accounts
- `PUT /accounts/{key}` — Update account

**Cards**
- `GET /cards` — List all credit cards
- `POST /cards/payoff` — Pay off card balance

**Expenses**
- `GET /expenses` — List expenses (optional `?month=2026-04`)
- `POST /expenses` — Create expense
- `DELETE /expenses/{id}` — Delete expense

**Categories**
- `GET /categories` — List all categories
- `POST /categories` — Create category
- `PUT /categories/{id}` — Update category
- `DELETE /categories/{id}` — Delete category

**Dashboard**
- `GET /dashboard` — Full dashboard state (accounts, cards, categories, totals)

**Analytics**
- `GET /analytics?months=6` — Get 6 months of history

---

## Frontend Structure

```
frontend/
├── app/
│   ├── _layout.tsx              # Root layout + font loading
│   ├── +html.tsx                # Web support
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab navigation
│   │   ├── index.tsx            # Dashboard
│   │   ├── budget.tsx           # Categories & targets
│   │   ├── transactions.tsx     # Activity log
│   │   ├── cards.tsx            # Credit card payoff
│   │   └── settings.tsx         # Analytics & rollover
│   ├── add-income.tsx           # Income modal
│   ├── add-expense.tsx          # Expense modal
│   ├── recurring.tsx            # Recurring expenses
│   └── upcoming.tsx             # Future bills
├── api.ts                       # API client + types
├── theme.ts                     # Colors, fonts, spacing
├── components/
│   └── ui/index.tsx             # Reusable components
├── package.json
└── tsconfig.json
```

---

## Key Files

### `frontend/api.ts`
Central API client. All backend calls go through here.

```typescript
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export const api = {
  dashboard: (): Promise<Dashboard> => req("/dashboard"),
  expenses: (month?: string): Promise<Expense[]> => req(`/expenses${month ? `?month=${month}` : ""}`),
  createExpense: (body: any): Promise<Expense> => 
    req("/expenses", { method: "POST", body: JSON.stringify(body) }),
  // ... 30+ more methods
};
```

**Usage in components:**
```typescript
const data = await api.dashboard();
const expenses = await api.expenses("2026-04");
```

### `frontend/theme.ts`
Design tokens (colors, fonts, spacing, shadows).

```typescript
export const COLORS = {
  primary: "#6B4226",
  background: "#F5F5F3",
  // ...
  accounts: {
    fixed_expenses: "#C95D4E",
    variable: "#7B9B8F",
    // ...
  }
};

export const FONTS = {
  heading: "PlayfairDisplay_700Bold",
  body: "SourceSans3_400Regular",
  // ...
};
```

### `frontend/components/ui/index.tsx`
Reusable UI primitives:
- `Card` — Main content container
- `Button` — Primary/secondary buttons
- `Heading` — h1, h2, h3
- `Label` — Small gray text
- `ProgressBar` — Visual budget tracking
- `AlertBanner` — Error/warning messages

---

## Common Tasks

### Adding a New Screen

1. Create `frontend/app/(tabs)/mynewscreen.tsx`
2. Add tab registration in `frontend/app/(tabs)/_layout.tsx`

```typescript
<Tabs.Screen
  name="mynewscreen"
  options={{
    title: "My Screen",
    tabBarIcon: ({ color, size }) => <Feather name="icon-name" color={color} size={size} />,
  }}
/>
```

### Adding a Modal

1. Create `frontend/app/mymodal.tsx`
2. Register in `frontend/app/_layout.tsx`

```typescript
<Stack.Screen name="mymodal" options={{ presentation: "modal" }} />
```

3. Navigate from other screens

```typescript
router.push("/mymodal");  // Open modal
router.back();            // Close modal
```

### Calling an API

```typescript
import { api } from "../api";

// In a component
const [data, setData] = useState<Dashboard | null>(null);

useEffect(() => {
  api.dashboard()
    .then(d => setData(d))
    .catch(e => Alert.alert("Error", e.message));
}, []);
```

---

## Troubleshooting

### "Cannot connect to backend"
- Ensure backend is running: `uvicorn main:app --reload`
- Check `.env.local` has correct `EXPO_PUBLIC_BACKEND_URL`
- On Android emulator, use `10.0.2.2:8000` instead of `localhost:8000`

### "Environment variable not found"
- Variables must start with `EXPO_PUBLIC_`
- Restart Expo CLI after changing `.env.local`

### "Blank white screen on startup"
- Check fonts are loading: Look for `ActivityIndicator` in `_layout.tsx`
- Check API is responding: Open `http://localhost:8000/api/dashboard` in browser

### "Module not found: @/*"
- TypeScript path alias defined in `tsconfig.json`
- Run `yarn install` again if imports still fail

### "Styles not applying"
- Check `COLORS` and `SPACING` are imported from `theme.ts`
- Verify component receives `style` prop

---

## Features

### ✅ Core Features
- **5-Tab Navigation**: Dashboard, Budget, Activity, Cards, Settings
- **Income Tracking**: Allocate paychecks by bucket (amount or %)
- **Expense Tracking**: Log expenses as cash or credit card
- **Credit Card Payoff**: Assign card charges to bank accounts for month-end payment
- **Budget Categories**: Organize spending by category with monthly targets

### ✅ Iteration 2 (Active)
- **Sub-Categories**: Group expenses by parent category
- **Category Progress**: Track spend vs. target per category
- **Recurring Expenses**: Auto-create monthly charges
- **Analytics Dashboard**: 6-month history by account and category
- **Monthly Rollover**: Sweep remaining funds to savings

### 📋 Planned Features
- Push notifications for budget warnings
- Receipt photo attachment
- Multi-user support
- Scheduled recurring expenses with skip/redo

---

## Backend API Contract

All requests send/receive JSON.

### Request Example
```typescript
POST /api/expenses
Content-Type: application/json

{
  "description": "Coffee",
  "amount": 5.50,
  "payment_method": "credit",
  "card": "amex",
  "payoff_account": "variable",
  "category_id": "cat_12345"
}
```

### Response Example
```json
{
  "id": "exp_abc123",
  "description": "Coffee",
  "amount": 5.50,
  "date": "2026-04-30",
  "payment_method": "credit",
  "card": "amex",
  "payoff_account": "variable",
  "created_at": "2026-04-30T10:30:00Z"
}
```

### Error Response
```json
{
  "detail": "Invalid amount"
}
```

Status codes:
- `200` — Success
- `400` — Bad request (validation error)
- `404` — Not found
- `500` — Server error

---

## Testing

### Manual Testing Checklist

**Dashboard**
- [ ] Net position displays correctly
- [ ] All 4 bank accounts shown with balances
- [ ] Credit cards display outstanding balance
- [ ] Quick action buttons (Income/Expense) open modals

**Income Modal**
- [ ] Can enter source and total amount
- [ ] Mode toggle (amount/percent) works
- [ ] Allocation fields update correctly
- [ ] Save button disabled until valid
- [ ] Submission refreshes dashboard

**Expense Modal**
- [ ] Description and amount required
- [ ] Category selection auto-fills bucket
- [ ] Payment method toggle (Credit/Cash) works
- [ ] Card/Account selection updates based on method
- [ ] Save creates expense and closes modal

**Cards Tab**
- [ ] All cards displayed with outstanding balance
- [ ] Breakdown shows which accounts will pay
- [ ] Pay Off button triggers payoff flow
- [ ] Dashboard updates after payoff

**Settings**
- [ ] Analytics chart displays 6-month history
- [ ] Rollover button sweeps funds to savings
- [ ] Reset button clears all data

---

## Deployment

### Frontend (Expo)

**Expo Go** (development):
```bash
yarn start
# Scan QR code with Expo Go app
```

**Standalone APK** (Android):
```bash
eas build --platform android
# Creates installable .apk
```

**Standalone IPA** (iOS):
```bash
eas build --platform ios
# Creates installable .ipa (requires Apple Developer account)
```

### Backend (FastAPI)

**Local**:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Production** (example with Render):
1. Push to GitHub
2. Connect repo to Render
3. Set `MONGODB_URI` environment variable
4. Deploy

Update frontend `.env.local` to point to deployed backend.

---

## Support

**Stuck?**
- Check `console.log` output in Terminal 2 (frontend)
- Check backend error logs in Terminal 1
- Verify `.env.local` exists and is correct
- Make sure both servers are running

**Questions?**
- See `memory/PRD.md` for full feature list
- Review `frontend/app` folder structure
- Check type definitions in `frontend/api.ts`
