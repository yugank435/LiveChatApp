# Live Messaging Website

A full-stack chat app built with Next.js, NestJS, JWT authentication, MongoDB, and Socket.IO.

## Structure

- `apps/web` - Next.js frontend
- `apps/api` - NestJS backend

## Requirements

- Node.js 20+

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

The frontend runs on `http://localhost:3000`.
The API runs on `http://localhost:4000`.

