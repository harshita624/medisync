# MediSync AI
*(formerly HealthBridge — infrastructure/service names below still reflect the original project name)*

A production hospital management platform built for **Dana Shivam Heart & Super Speciality Hospital**, serving 10 doctors, 10 health packages, and 16 insurance partners across three independently deployed services.

**Stack:** Next.js 15 · Node.js/Express · MongoDB · FastAPI (Python) · Groq AI (Llama 3.1)

---

## What MediSync AI Does

MediSync AI is a full hospital platform with separate patient and doctor experiences, backed by a dedicated ML microservice for clinical intelligence.

### Patient Portal (6 modules)
- Appointment booking
- Vitals tracking
- QR-based emergency health cards
- Medicine reminders
- Insurance claims
- AI-assisted actions (e.g. booking) via structured action-block parsing — the assistant doesn't just chat, it executes real MongoDB writes through a constrained, parseable action format

### Doctor Portal (4-in-1)
- Browser-native QR patient scanning (no external scanner app)
- Clinical AI generating SOAP notes and ICD-10 differential diagnoses
- Drug-interaction analysis against a patient's current prescriptions
- Jitsi Meet video consultations, integrated directly into the workflow

### ML Microservice (FastAPI)
A dedicated service covering four capabilities:
- Symptom analysis
- Vitals anomaly detection
- Drug-interaction checks
- Medical OCR (for scanned reports/prescriptions)

Includes automatic **Ollama → Groq production failover** — if the local/self-hosted model path is unavailable, the service falls over to Groq with no router-level code changes required.

## Architecture

Production request flow — the browser never talks to the ML service directly:

```text
Browser → Next.js frontend /api proxy → Express backend → FastAPI ML service → Express backend → Browser
```

Deployed as three independent services:
- **Frontend** — Next.js, on Vercel
- **Backend** — Express/MongoDB, on Railway
- **ML service** — FastAPI, on Render

## Tech Stack

**Frontend:** Next.js 15 (JavaScript)
**Backend:** Node.js, Express.js, MongoDB
**ML Service:** FastAPI, Python
**AI:** Groq (Llama 3.1), with local Ollama fallback path
**Auth:** JWT, Google OAuth
**Media:** Jitsi Meet (video consultations), Cloudinary (image uploads)

---

## Local Development (Docker)

From the project root:

```bash
docker compose build
docker compose up
```

Open:
- Frontend: http://localhost:3003
- Backend health: http://localhost:5000/api/health
- ML health: http://localhost:8000/health

Stop:
```bash
docker compose down
```

Reset local Docker data:
```bash
docker compose down -v
```

## Local Development (without Docker)

**Backend:**
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

**ML service:**
```bash
cd ml-service
cp .env.example .env
pip install -r requirements.txt --break-system-packages
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Render Deployment

This repo includes `render.yaml`, Dockerfiles for all services, and `.dockerignore` files.

### 1. Push to GitHub
```bash
git add .
git commit -m "Dockerize MediSync AI for Render"
git push origin main
```

### 2. Create Render Blueprint
1. Open https://dashboard.render.com/blueprints
2. Click **New Blueprint Instance**
3. Connect the GitHub repo and select it.
4. Render detects `render.yaml` and creates:
   - `healthbridge-ml`
   - `healthbridge-backend`
   - `healthbridge-frontend`

### 3. Environment Variables

**ML service:**
```env
ENABLE_LLM_SYMPTOM=false
FRONTEND_URL=https://YOUR-FRONTEND.onrender.com
BACKEND_URL=https://YOUR-BACKEND.onrender.com
GROQ_API_KEY=optional-if-you-enable-LLM
GROQ_MODEL=llama-3.1-8b-instant
```

**Backend service:**
```env
NODE_ENV=production
MONGO_URI=mongodb+srv://USER:PASSWORD@CLUSTER/healthbridge
JWT_SECRET=long-random-secret
JWT_EXPIRES=30d
FRONTEND_URL=https://YOUR-FRONTEND.onrender.com
FRONTEND_URLS=https://YOUR-FRONTEND.onrender.com
ML_SERVICE_URL=https://YOUR-ML.onrender.com/api
SEED_DEMO_DOCTORS=false
GROQ_API_KEY=optional-for-chat
GROQ_MODEL=llama-3.1-8b-instant
CLOUDINARY_CLOUD_NAME=optional-for-image-upload
CLOUDINARY_API_KEY=optional-for-image-upload
CLOUDINARY_API_SECRET=optional-for-image-upload
GOOGLE_CLIENT_ID=optional-for-google-login
GOOGLE_CLIENT_SECRET=optional-for-google-login
GOOGLE_CALLBACK_URL=https://YOUR-BACKEND.onrender.com/api/auth/google/callback
```

**Frontend service:**
```env
PORT=3003
BACKEND_URL=https://YOUR-BACKEND.onrender.com
NEXT_PUBLIC_APP_URL=https://YOUR-FRONTEND.onrender.com
```

> Do not set `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_ML_URL` in production — the frontend uses same-origin `/api` and proxies through Next.js.

### 4. Deploy Order
1. Deploy `healthbridge-ml`
2. Deploy `healthbridge-backend`
3. Deploy `healthbridge-frontend`

### 5. Verify
```bash
curl https://YOUR-ML.onrender.com/health
curl https://YOUR-BACKEND.onrender.com/api/health
curl https://YOUR-FRONTEND.onrender.com
```

Full flow test:
1. Open `https://YOUR-FRONTEND.onrender.com/register`.
2. Create a patient account.
3. Go to Patient → Symptoms, enter `fever and headache for two days`.
4. Confirm urgency, possible conditions, specialist, and home-care guidance appear.
5. In DevTools Network, confirm the request goes to `https://YOUR-FRONTEND.onrender.com/api/symptoms/check` — it should never call `localhost:8000` or the ML URL directly from the browser.

## Engineering Notes — Production Hardening

A running log of real fixes made while taking this from local prototype to production:

- Added Dockerfiles for frontend, backend, and ML service
- Added `docker-compose.yml` for full local Docker testing
- Added `render.yaml` for Render Blueprint deployment
- Added runtime Next.js proxy routes for `/api/*` and `/uploads/*`
- Removed direct browser-to-ML calls from the symptom checker; routed through backend → ML service instead
- Fixed ML model file paths for Docker containers
- Fixed fever/general-medicine and breathing red-flag symptom detection
- Fixed a mutable Pydantic default for symptom history
- Fixed the ML smoke-check signature
- Removed unused TensorFlow/Keras production dependencies
- Tightened backend CORS to configured frontend origins only
- Required `JWT_SECRET` in production (no silent fallback)
- Made demo-doctor seeding opt-in in production
- Fixed the insurance dashboard API import

## Author

**Harshita Sharma**
B.Tech — Computer Science & Engineering, KIIT University

- GitHub: https://github.com/harshita624
- LinkedIn: https://www.linkedin.com/in/harshita-sharma-b782942a7/
