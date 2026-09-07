# ReMedistribution — Team Setup & Run Guide

> "No life-saving medicine should become waste."

## ⚡ Quick Start (5 Minutes)

Everything is pre-installed in this ZIP. Just follow these steps:

### 1. Extract the ZIP
Extract `ReMedistribution.zip` anywhere on your PC, for example:
```
C:\ReMedistribution\
```

### 2. Open Two Terminals

**Terminal 1 — Start the Backend:**
```bash
cd C:\ReMedistribution\server
node src/index.js
```
Wait until you see:
```
╔══════════════════════════════════════════════════╗
║   ReMedistribution API Server                    ║
║   Running on http://localhost:5000               ║
╚══════════════════════════════════════════════════╝
```

**Terminal 2 — Start the Frontend:**
```bash
cd C:\ReMedistribution\client
npx vite
```
Wait until you see:
```
VITE v5.x  ready
➜  Local:   http://localhost:5173/
```

### 3. Open Your Browser
Go to: **http://localhost:5173**

---

## 🔑 Login Accounts

Use these to test different parts of the app:

| Role | Email | Password | What to Test |
|------|-------|----------|--------------|
| **Donor** | ahmed.donor@example.com | password123 | Donate medicine, scan labels, view history |
| **Pharmacist** | fatima.pharmacist@example.com | password123 | Verify donations, see AI risk scores, manage inventory |
| **Patient** | ali.patient@example.com | password123 | Request medicine, AI chatbot (Urdu/English) |
| **Patient 2** | ayesha.patient@example.com | password123 | Same (Karachi location) |
| **Admin** | admin@remedistribution.com | **admin123** | Full dashboard, charts, forecasts |

---

## 🧪 What to Test (Demo Walkthrough)

### As Donor:
1. Login → Click **"Donate Medicine"**
2. Click **"Scan Medicine Label"** (simulates camera OCR)
3. Confirm the auto-filled medicine details
4. Answer safety questions (seal intact? stored correctly?)
5. Select a drop-off center → Submit
6. Go to **"My Donations"** to see your submission

### As Pharmacist:
1. Login → See the **Verification Queue** with pending donations
2. Notice the **colored AI Risk badge** on each donation:
   - 🟢 Green = Low Risk (safe to approve)
   - 🟡 Yellow = Medium Risk (check carefully)
   - 🔴 Red = High Risk (likely reject)
3. Click **"Verify"** on any pending donation
4. Review the full AI analysis panel (risk score, confidence %, notes)
5. Click **Approve** or **Reject**
6. Go to **"Inventory"** tab to see approved medicines + **Expiry Risk Triage**

### As Patient:
1. Login → Click **"Request Medicine"**
2. Try **Form mode**: Enter "Insulin", set urgency to "High", city = "Lahore"
3. Try **AI Chat mode**: Type in Urdu:
   > "Mujhe insulin ki zaroorat hai, meri ammi ko diabetes hai. Lahore"
4. The AI will parse the medicine name, urgency, and city automatically
5. Go to **"My Requests"** to see matching results

### As Admin:
1. Login → See the full analytics dashboard:
   - **Key metrics**: Total donations, inventory, fulfillment rate
   - **Pie chart**: Medicines by category
   - **Expiry Risk**: Critical/Warning/Safe breakdown
   - **Bar chart**: 6-month demand forecast by city
   - **City breakdown**: Collection centers per city

---

## 📁 Project Structure

```
ReMedistribution/
├── server/                        ← Backend (Node.js + Express)
│   ├── prisma/
│   │   ├── schema.prisma          ← Database structure
│   │   ├── seed.js                ← Sample data script
│   │   └── dev.db                 ← SQLite database (already created)
│   ├── src/
│   │   ├── routes/                ← API endpoints (9 files)
│   │   ├── controllers/           ← Logic handlers (9 files)
│   │   ├── middleware/            ← Auth, upload, error handling
│   │   ├── services/              ← AI risk scoring engine
│   │   └── index.js               ← Entry point
│   ├── node_modules/              ← Pre-installed (DO NOT DELETE)
│   └── package.json
│
├── client/                        ← Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── donor/             ← Donor dashboard + donation flow
│   │   │   ├── pharmacist/        ← Verification + inventory
│   │   │   ├── patient/           ← Request medicine + chatbot
│   │   │   └── admin/             ← Analytics dashboard
│   │   ├── components/            ← Navbar
│   │   ├── context/               ← Login state management
│   │   └── services/              ← API client
│   ├── node_modules/              ← Pre-installed (DO NOT DELETE)
│   └── package.json
│
├── ai-service/                    ← Python AI (OPTIONAL)
│   ├── app.py                     ← OCR + Vision + Chatbot + Forecast
│   └── requirements.txt
│
└── SETUP_GUIDE.md                 ← This file
```

---

## 🤖 Optional: AI Service (Python)

The app works WITHOUT this. But if you want real AI features (actual OCR from photos, real computer vision):

### Requirements:
- Python 3.9+ installed (https://python.org)
- For Python 3.14+, the pinned versions in older `requirements.txt` files may fail to build; `requirements.txt` now uses minimum versions that support Python 3.14+

### Setup:
```bash
cd C:\ReMedistribution\ai-service
pip install -r requirements.txt
```

### Run (open a 3rd terminal):
```bash
cd C:\ReMedistribution\ai-service
uvicorn app:app --reload
```

Or use the provided helper script (bypasses PowerShell execution policy):
```powershell
powershell -ExecutionPolicy Bypass -File ..\start-ai.ps1
```
This starts the AI service on port 8000. The backend will automatically connect to it.

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| **"Cannot find module..."** | Run `npm install` in the `server/` or `client/` folder |
| **Port 5000 in use** | Edit `server/.env` → change `PORT=5000` to another number |
| **Port 5173 in use** | Vite will auto-pick another port, check the terminal output |
| **Blank white page** | Make sure backend (Terminal 1) is running first |
| **"Prisma Client not generated"** | Run `npx prisma generate` inside `server/` folder |
| **Database errors** | Run `npx prisma migrate dev` then `node prisma/seed.js` in `server/` |
| **Python not found** | AI service is optional — the app works fine without it |
| **"AI service is not running" toast when scanning** | Make sure the AI service is started on http://localhost:8000. Run `powershell -ExecutionPolicy Bypass -File start-ai.ps1` from the project root, or start it manually in `ai-service/` with `python -m uvicorn app:app --host 0.0.0.0 --port 8000` |
| **"No module named uvicorn" or Pillow build errors** | Run `pip install -r ai-service/requirements.txt` again. On Python 3.14+ the older pinned Pillow 10.1.0 cannot build from source; use the updated `requirements.txt` |

---

## 📡 API Endpoints (For Developers)

The backend runs on `http://localhost:5000`. All endpoints start with `/api/`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login, returns JWT token |
| POST | /api/auth/register | Create new account |
| GET | /api/auth/profile | Get current user profile |
| GET | /api/medicines | List all medicines |
| GET | /api/medicines/search?q=... | Search medicines |
| GET | /api/centers | List collection centers |
| GET | /api/centers/nearby?lat=...&lng=... | Nearby centers |
| POST | /api/donations | Create a donation |
| GET | /api/donations | List all donations |
| GET | /api/donations/my-donations | Current donor's donations |
| PATCH | /api/donations/:id/verify | Approve or reject |
| GET | /api/inventory | Available inventory |
| GET | /api/inventory/expiry-risk | Expiry risk triage |
| POST | /api/patients | Create medicine request |
| POST | /api/patients/chat | AI chatbot request |
| GET | /api/patients/my-requests | My requests |
| POST | /api/matching/run | Run matching algorithm |
| GET | /api/dashboard | Stats dashboard |
| GET | /api/dashboard/overview | Admin overview |
| POST | /api/ai/ocr | OCR scan (image upload) |
| POST | /api/ai/vision | Vision check (image upload) |
| GET | /api/ai/forecast | Demand forecast |

---

## 🎯 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, React Router, Recharts
- **Backend**: Node.js, Express.js, Prisma ORM, JWT Auth
- **Database**: SQLite (file-based, zero-config)
- **AI Service**: Python FastAPI, Tesseract OCR, Pillow, NumPy
- **Real-time**: Socket.io (for live matching notifications)

---

## 💡 Tips for the Team

1. **Always start backend first**, then frontend
2. **Keep both terminals open** while testing
3. The SQLite database (`server/prisma/dev.db`) is pre-seeded with sample data
4. If database gets corrupted, delete `dev.db` and re-run: `npx prisma migrate dev` + `node prisma/seed.js`
5. The `node_modules/` folders are included — don't delete them unless you plan to `npm install` again

---

**Good luck with the hackathon! 🚀**
