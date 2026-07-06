# FoodLens / Foodie

An AI-powered food recognition app with recipe generation, meal chat assistant, shopping list management, and video tutorial lookup.

## Project Overview

- **Backend:** Django REST API with JWT authentication, food image detection, recipe generation, chat assistant, shopping list management, detection history, and YouTube video search caching.
- **Frontend:** Expo React Native mobile app with Expo Router, camera/image picker, secure token storage, AI chat interface, recipe view, shopping list, settings, and embedded video tutorials.
- **AI / ML:** Uses a local `aspis/swin-finetuned-food101` food classification model with a Gemini generative AI fallback for recipe generation and chat responses. Video search uses RapidAPI hosts and Google YouTube Data API with caching.

## Key Features

- User registration and JWT login
- Food detection from camera or gallery image upload
- AI-generated recipe ingredients, steps, and nutrition facts
- Voice-enabled chat assistant for food/cooking questions
- Shopping list creation, update, and local guest persistence
- Saved detection history with uploaded images
- Video tutorial search for detected dishes
- Theme and profile settings inside the app

## Repository Structure

- `backend/` - Django application
  - `api/` - REST API app
    - `views.py` - API endpoints
    - `ml_service.py` - food detection + AI orchestration
    - `models.py` - shopping items, detection history, video cache
    - `serializers.py` - DRF serializers
    - `urls.py` - API routes
  - `backend/` - Django project settings and URL config
  - `requirements.txt` - Python dependencies
  - `Dockerfile` - backend container definition
  - `entrypoint.sh` - migration and runserver startup
- `frontend/` - Expo React Native app
  - `app/` - Expo Router screens and layout
  - `config.js` - API base URL config
  - `package.json` - JS dependencies
  - `Dockerfile` - frontend container definition
  - `app.json` - Expo app config

## Environment Variables

The backend expects several environment variables for AI and API access. Add them to `backend/.env` or your environment:

- `GEMINI_API_KEY`
- `GEMINI_API_KEY_1`
- `GEMINI_API_KEY_2`
- `RAPIDAPI_KEY`
- `RAPIDAPI_KEY_1`
- `RAPIDAPI_KEY_2`
- `YOUTUBE_API_KEY`
- `HF_TOKEN` (optional)

> The current `frontend/config.js` uses a hardcoded backend host IP: `http://192.168.91.77:8000/api`. Update this if your machine IP changes or you run the backend elsewhere.

## Docker Setup

The repo includes `docker-compose.yml` to run both backend and frontend together.

### Start with Docker Compose

```bash
cd c:\Users\SALIM\Desktop\projects\Ahmed
docker compose up --build
```

This starts:
- Backend on `http://localhost:8000`
- Frontend on `http://localhost:8081`

If you use a mobile device or emulator, update `frontend/config.js` with the machine IP address reachable from that device.

## Backend Local Setup

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file or export the required variables, then run:

```bash
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

## Frontend Local Setup

```bash
cd frontend
npm install
npx expo start
```

For Android:

```bash
npx expo start --android
```

For iOS:

```bash
npx expo start --ios
```

### Important

- Ensure `api/config.js` points to the running backend API host.
- If using an emulator, you may need to use the host gateway address depending on your setup.

## API Endpoints

- `POST /api/register/` - Register new user
- `POST /api/login/` - Obtain JWT access and refresh tokens
- `POST /api/token/refresh/` - Refresh JWT token
- `POST /api/detect/` - Upload image and detect dish
- `GET /api/history/` - Get user detection history
- `DELETE /api/delete-history/<pk>/` - Remove a detection history item
- `POST /api/chat/` - Ask the AI chat assistant about food
- `PATCH /api/profile/update/` - Update user profile or password
- `GET /api/videos/search/?q=<query>` - Search YouTube videos
- `GET /api/shopping/` - Get authenticated user shopping list
- `POST /api/shopping/` - Add shopping item
- `DELETE /api/shopping/?id=<id>` - Delete shopping item
- `POST /api/shopping/bulk/` - Add multiple ingredients to shopping list
- `PATCH /api/shopping/<int:pk>/` - Update shopping item

## Notes

- The backend stores images under `backend/media/detections/`.
- The app currently uses SQLite (`backend/db.sqlite3`) for persistence.
- `backend/settings.py` currently runs in `DEBUG=True`, so do not use this configuration as-is for production.
- The local image detector is used first; if confidence is low, the system falls back to Gemini vision.

## Recommended Improvements

- Replace the hardcoded backend URL in `frontend/config.js` with a runtime environment variable
- Move `SECRET_KEY` into environment variables
- Add proper authentication refresh handling on the frontend
- Add frontend and backend tests for critical flows

## Contact

If you want to extend this project, start by updating the environment variables and verifying the backend API works before launching the Expo frontend.
