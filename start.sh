#!/bin/bash

echo "Starting Serverless Runner..."

# Start backend
cd ~/Downloads/serverless-runner/backend
npm run dev &
BACKEND_PID=$!

# Start frontend
cd ~/Downloads/serverless-runner/frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend running on http://localhost:4000"
echo "Frontend running on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait and handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
