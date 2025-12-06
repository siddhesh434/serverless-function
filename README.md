# Serverless Function Runner

Run Python functions on Kubernetes with real-time build and execution logs.

## Architecture
```
Frontend (Next.js :3000) → Backend (Express :4000) → DockerHub → GKE/Argo
```

## Features

- Write Python functions in browser
- Configure dependencies via pixi.toml
- Real-time Docker build logs
- Real-time Kubernetes execution logs
- Auto-cleanup of local images

## Prerequisites

- Node.js 18+
- Docker (logged into DockerHub)
- kubectl configured for GKE
- Argo Workflows installed in cluster

## Quick Start

### Backend
```bash
cd backend
npm install
npx ts-node src/index.ts
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Usage

1. Write a `handler(...)` function
2. Add dependencies to pixi.toml
3. Enter comma-separated arguments
4. Click "Deploy & Run"

## Example
```python
def handler(a, b):
    return a + b
```
Arguments: `5, 3` → Result: `8`
