# COD Recovery Center

Production-ready internal tool for recovering problematic Sendit COD orders in Morocco.

The app does not replace Sendit. Sendit remains the delivery/tracking source. COD Recovery Center focuses on employee follow-up, customer messaging, status history, recovery commissions, and webhook-driven updates.

## Stack

- Frontend: React + Vite + JavaScript
- Backend: Node.js + Express
- Database: Supabase PostgreSQL
- Auth: Supabase Auth
- Webhook/API: Express backend
- Deployment: Vercel for frontend, Railway/Render for backend

## Project Structure

```txt
frontend/   React + Vite app
backend/    Express API and Sendit webhook processor
database/   Supabase SQL schema and seed data
README.md   Setup and operations guide
```

## Supabase Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `database/schema.sql`.
4. Run `database/seed.sql`.
5. Go to Project Settings > API and copy:
   - Project URL
   - anon public key
   - service role key

Important: the service role key belongs only in the backend `.env`. Never expose it in the frontend.

## Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Edit `backend/.env`:

```env
PORT=8787
HOST=127.0.0.1
FRONTEND_ORIGIN=http://127.0.0.1:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SENDIT_API_KEY=your-sendit-api-key
SENDIT_WEBHOOK_SECRET=change-this-secret
DEFAULT_COMMISSION_AMOUNT=15
REQUIRE_AUTH=false
```

Health check:

```bash
curl http://127.0.0.1:8787/api/health
```

## Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8787
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Open:

```txt
http://127.0.0.1:5173
```

## Sendit Webhook

Webhook endpoint:

```txt
https://your-domain.com/api/webhooks/sendit
```

Local webhook testing with ngrok:

```bash
cd backend
npm run dev
ngrok http 8787
```

Use the ngrok URL in Sendit:

```txt
https://your-ngrok-subdomain.ngrok-free.app/api/webhooks/sendit
```

Test manually:

```bash
curl -X POST http://127.0.0.1:8787/api/webhooks/sendit \
  -H "Content-Type: application/json" \
  -H "x-sendit-webhook-secret: change-this-secret" \
  -d '{
    "id": "SND-999",
    "reference": "COD-999",
    "status": "Injoignable",
    "customer": {
      "name": "Test Client",
      "phone": "212600000000",
      "city": "Casablanca",
      "address": "Maarif"
    },
    "product": { "name": "Test Product" },
    "amount": 299
  }'
```

## Webhook Logic

The backend:

1. Receives Sendit payload.
2. Saves raw payload in `webhook_events`.
3. Maps Sendit payload with `mapSenditPayload(payload)`.
4. Upserts into `orders`.
5. Saves status changes in `order_status_history`.
6. Detects problematic statuses.
7. If status becomes `Livré` after employee follow-up:
   - marks order as recovered
   - creates one 15 MAD commission
   - avoids duplicate commission using a unique database index

Adjust Sendit field mapping in:

```txt
backend/src/senditMapper.js
```

## API Overview

Health:

- `GET /api/health`

Orders:

- `GET /api/orders`
- `GET /api/orders/problematic`
- `GET /api/orders/:id`
- `POST /api/orders/:id/assign`
- `POST /api/orders/:id/followup`
- `POST /api/orders/:id/mark-recovered`

Employees:

- `GET /api/employees`
- `POST /api/employees`

Commissions:

- `GET /api/commissions`
- `GET /api/commissions/summary`
- `POST /api/commissions/:id/approve`

Message templates:

- `GET /api/message-templates`
- `POST /api/message-templates`

Webhook:

- `POST /api/webhooks/sendit`

## Deployment

Recommended deployment:

- Backend: Render or Railway
- Frontend: Vercel

### Backend on Render

Option A: use `render.yaml` from the repo root.

Option B: create a Render Web Service manually:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node
- Health check path: `/api/health`
- Env vars:
  - `NODE_ENV=production`
  - `HOST=0.0.0.0`
  - `FRONTEND_ORIGIN=https://your-frontend-domain.vercel.app`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SENDIT_API_KEY`
  - `SENDIT_WEBHOOK_SECRET`
  - `DEFAULT_COMMISSION_AMOUNT=15`
  - `REQUIRE_AUTH=false`

After backend deploy, your webhook URL will be:

```txt
https://your-backend-domain.onrender.com/api/webhooks/sendit
```

If Sendit does not support custom webhook headers, use:

```txt
https://your-backend-domain.onrender.com/api/webhooks/sendit?secret=YOUR_SECRET
```

### Frontend on Vercel

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Env vars:
  - `VITE_API_URL=https://your-backend-domain.onrender.com`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## Security Notes

- Never put `SUPABASE_SERVICE_ROLE_KEY` or `SENDIT_API_KEY` in the frontend.
- Webhook secret validation is implemented with `x-sendit-webhook-secret`.
- CORS is restricted with `FRONTEND_ORIGIN`.
- Supabase RLS is enabled. The Express backend uses the service role key and acts as the trusted API boundary.

## Phase 2 Ideas

- Replace manual assignment with employee login mapping.
- Add role-based admin screens.
- Add Sendit API import job for historical orders.
- Add webhook signature validation if Sendit provides signed payloads.
- Add notification queue for high-priority orders.
