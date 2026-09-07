# ReMedistribution

> "No life-saving medicine should become waste."

A trusted, verified platform for medicine redistribution — connecting donors with patients through licensed pharmacists and verified collection centers.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express.js + Prisma ORM |
| Database | PostgreSQL |
| AI/ML | Tesseract.js (OCR), TensorFlow.js (Vision), LLM API (Chatbot) |
| Maps | Google Maps / Mapbox |

## Project Structure

```
├── client/          # React.js frontend (Vite)
├── server/          # Express.js backend
├── ai-service/      # Python FastAPI microservice for AI/ML
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+

### Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd ReMedistribution
   ```

2. **Backend setup**
   ```bash
   cd server
   npm install
   npx prisma migrate dev
   npm run seed
   npm run dev
   ```

3. **Frontend setup**
   ```bash
   cd client
   npm install
   npm run dev
   ```

4. **AI Service setup**
   ```bash
   cd ai-service
   pip install -r requirements.txt
   uvicorn app:app --reload
   ```

## Features

- **OCR Medicine Scanning** — Auto-read medicine labels with phone camera
- **AI Seal & Damage Detection** — Pre-screen donations for tampering
- **Counterfeit Risk Scoring** — Green/Yellow/Red risk assessment
- **Smart Matching** — Auto-match patients to nearest available medicine
- **Demand Prediction** — Forecast medicine needs by city
- **AI Chatbot** — Describe needs in plain Urdu/English

## SDGs Covered
- SDG 1 — No Poverty
- SDG 3 — Good Health and Well-being
- SDG 12 — Responsible Consumption and Production

## License
MIT
