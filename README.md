# AI-Based Inventory & Parts Management System

A premium dark-theme inventory and parts management platform built with React, Vite, Express, MongoDB, and JWT authentication.

## Highlights
- Premium SaaS-inspired dashboard with real data-backed metrics
- Inventory management with add, edit, view, and delete flows
- Category and supplier management modules
- AI Forecasting placeholder page for the future ML integration
- Existing authentication preserved and extended with a polished login experience

## Frontend
- Install dependencies: `npm install`
- Create frontend env file: `cp .env.example .env`
- Start frontend: `npm run dev`

## Backend
- Install backend dependencies: `cd server && npm install`
- Create backend env file: `cp .env.example .env`
- Start MongoDB locally and ensure it is running on `mongodb://127.0.0.1:27017/ai_inventory_system`
- Seed development data: `cd server && npm run seed`
- Start backend: `cd server && npm run dev`

## Environment variables
- Frontend: `VITE_API_URL`
- Backend: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`

## Development credentials
- superadmin@inventory.com / Password123!
- admin@inventory.com / Password123!
- manager@inventory.com / Password123!
- storekeeper@inventory.com / Password123!

## Future AI module
The AI Forecasting page is intentionally a polished placeholder. The final machine-learning integration will be connected later without redesigning the layout.

These credentials are for development only.
