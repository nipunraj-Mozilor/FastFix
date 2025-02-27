# FastFix

FastFix is an intelligent code analysis and automated fix suggestion tool that combines AI capabilities with performance analysis to help developers improve their codebase.

## Features

- AI-Powered Code Analysis
- Performance Metrics Analysis
- Lighthouse Integration
- Automated Fix Suggestions
- GitHub Integration

## Environment Configuration

### Frontend (.env)

```env
VITE_OPENAI_API_KEY=your_openai_api_key
# API URL
VITE_API_URL=http://localhost:3000 
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

# Note: To get your Supabase credentials:
# 1. Create a project at https://supabase.com
# 2. Go to Project Settings > API
# 3. Copy the Project URL as VITE_SUPABASE_URL
# 4. Copy the anon/public key as VITE_SUPABASE_ANON_KEY
### Backend (backend/.env)

```env
OPENAI_API_KEY=your_openai_api_key
FRONTEND_URL=http://localhost:5173
```

## Setup

1. Install dependencies:

```bash
npm install
cd backend && npm install
```

2. Configure environment variables in `.env` files

3. Start the application:

```bash
# Frontend
npm run dev

# Backend
cd backend && npm start
```

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- AI Integration
- GitHub API Integration
- Supabase Integration
- Lighthouse Integration
- Puppeteer Integration

