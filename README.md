# 🏥 HealthBridge

> A modern healthcare platform connecting Patients, Doctors, Insurance Companies and Admins — with ML-powered health insights and an Ollama-based AI health assistant.

## 🗺️ Build Roadmap

| Step | What | Status |
|------|------|--------|
| 1 | Project setup + folder structure | ✅ Done |
| 2 | Database models (MongoDB) | ⬜ Next |
| 3 | Authentication (JWT + roles) | ⬜ |
| 4 | Landing page (inspired design) | ⬜ |
| 5 | Patient dashboard | ⬜ |
| 6 | Doctor dashboard | ⬜ |
| 7 | Insurance dashboard | ⬜ |
| 8 | Admin dashboard | ⬜ |
| 9 | QR code system | ⬜ |
| 10 | ML health score + risk prediction | ⬜ |
| 11 | Ollama AI chatbot | ⬜ |
| 12 | CI/CD + deployment | ⬜ |

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express.js, MongoDB, Mongoose |
| Auth | JWT, Role-based (patient/doctor/insurance/admin) |
| ML | FastAPI, scikit-learn, Python |
| AI Chatbot | Ollama (llama3 local LLM) |
| Storage | Cloudinary |
| QR | qrcode + html5-qrcode |
| CI/CD | GitHub Actions → Vercel + Render |

## 📁 Project Structure

```
healthbridge/
├── frontend/          # Next.js 14 App Router
│   └── src/
│       ├── app/       # Pages (auth, patient, doctor, insurance, admin)
│       ├── components/ # UI components per portal
│       ├── lib/       # API client, auth helpers
│       ├── hooks/     # Custom React hooks
│       ├── store/     # Zustand state management
│       └── types/     # TypeScript interfaces
│
├── backend/           # Node.js + Express
│   └── src/
│       ├── models/    # MongoDB schemas
│       ├── controllers/
│       ├── routes/
│       ├── middleware/
│       ├── services/  # QR, email, cloudinary
│       └── ml/        # ML service client
│
├── ml-service/        # FastAPI + scikit-learn
│   ├── routers/       # /predict, /chat endpoints
│   ├── models/        # Trained ML models
│   └── utils/         # Preprocessing helpers
│
└── .github/workflows/ # CI/CD pipelines
```

## 🚀 Quick Start

```bash
# Backend
cd backend && cp .env.example .env
npm install && npm run dev

# Frontend
cd frontend && cp .env.local.example .env.local
npm install && npm run dev

# ML Service
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Ollama (install from ollama.com)
ollama pull llama3
ollama serve
```
