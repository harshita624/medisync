# HealthBridge

HealthBridge is a healthcare platform with a Next.js frontend, an Express/MongoDB backend, and a FastAPI ML service.

Production request flow:

```text
Browser -> Next.js frontend /api proxy -> Express backend -> FastAPI ML service -> Express backend -> Browser
```

The browser should not call the ML service directly in production.

## Docker Local Test

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

## Render Deployment

This repo includes `render.yaml`, Dockerfiles for all services, and `.dockerignore` files.

### 1. Push to GitHub

```bash
git add .
git commit -m "Dockerize HealthBridge for Render"
git push origin main
```

### 2. Create Render Blueprint

1. Open https://dashboard.render.com/blueprints
2. Click **New Blueprint Instance**
3. Connect the GitHub repo.
4. Select this repo.
5. Render detects `render.yaml`.
6. Create:
   - `healthbridge-ml`
   - `healthbridge-backend`
   - `healthbridge-frontend`

### 3. Environment Variables

ML service:

```env
ENABLE_LLM_SYMPTOM=false
FRONTEND_URL=https://YOUR-FRONTEND.onrender.com
BACKEND_URL=https://YOUR-BACKEND.onrender.com
GROQ_API_KEY=optional-if-you-enable-LLM
GROQ_MODEL=llama-3.1-8b-instant
```

Backend service:

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

Frontend service:

```env
PORT=3003
BACKEND_URL=https://YOUR-BACKEND.onrender.com
NEXT_PUBLIC_APP_URL=https://YOUR-FRONTEND.onrender.com
```

Do not set `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_ML_URL` in production. The frontend uses same-origin `/api` and proxies through Next.js.

### 4. Deploy Order

1. Deploy `healthbridge-ml`
2. Deploy `healthbridge-backend`
3. Deploy `healthbridge-frontend`

### 5. Test Render

```bash
curl https://YOUR-ML.onrender.com/health
curl https://YOUR-BACKEND.onrender.com/api/health
curl https://YOUR-FRONTEND.onrender.com
```

Full flow test:

1. Open `https://YOUR-FRONTEND.onrender.com/register`.
2. Create a patient account.
3. Open Patient -> Symptoms.
4. Enter `fever and headache for two days`.
5. Confirm urgency, possible conditions, specialist, and home care appear.
6. In DevTools Network, confirm the request goes to:

```text
https://YOUR-FRONTEND.onrender.com/api/symptoms/check
```

It should not call `localhost:8000` or the ML URL from the browser.

## Local Development Without Docker

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

ML:

```bash
cd ml-service
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Production Fixes Made

- Added Dockerfiles for frontend, backend, and ML.
- Added `docker-compose.yml` for full local Docker testing.
- Added `render.yaml` for Render Blueprint deployment.
- Added runtime Next.js proxy routes for `/api/*` and `/uploads/*`.
- Removed direct browser-to-ML calls from symptom checker.
- Routed symptom detection through backend -> ML service.
- Fixed ML model file paths for Docker containers.
- Fixed fever/general-medicine and breathing red-flag symptom detection.
- Fixed mutable Pydantic default for symptom history.
- Fixed ML smoke check signature.
- Removed unused TensorFlow/Keras production dependencies.
- Tightened backend CORS to configured frontend origins.
- Required `JWT_SECRET` in production.
- Made demo doctor seeding opt-in in production.
- Fixed insurance dashboard API import.
