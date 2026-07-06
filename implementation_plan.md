# Docker Containerization Plan

This plan details how we will containerize your Django backend and Expo frontend so you can easily transfer and run the project on your client's machine without setup errors.

## Proposed Changes

### Backend Containerization

- Create `backend/Dockerfile` using Python 3.11 as the base image.
- Configure it to install the dependencies from your [requirements.txt](file:///c:/Users/SALIM/Desktop/projects/Ahmed/backend/requirements.txt).
- Set the entrypoint to run migrations and start the Django development server on port 8000.

#### [NEW] backend/Dockerfile
#### [NEW] backend/entrypoint.sh (Used to run migrations and then start the server)

---

### Frontend Containerization

- Create `frontend/Dockerfile` using Node 18/20.
- Install dependencies using `npm install`.
- Set the command to run `npm run web` (or `npx expo start --tunnel`/--lan if you prefer mobile testing, but web is easiest for a PC demo). We will expose port 8081.

#### [NEW] frontend/Dockerfile

---

### Docker orchestration

- Create a `docker-compose.yml` in the root folder to spin up both the backend and frontend simultaneously with a single `docker-compose up` command.
- Map port `8000` for the backend and `8081` for the frontend to the host machine.
- Set up a shared volume for the SQLite database so data persists.

#### [NEW] docker-compose.yml

---

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
- We will run `docker-compose up --build` to verify that both containers start successfully without dependency errors.
- We will access `http://localhost:8000` to confirm the backend is up.
- We will access `http://localhost:8081` to confirm the Expo web development UI is running.
- **Note:** In [frontend/config.js](file:///c:/Users/SALIM/Desktop/projects/Ahmed/frontend/config.js), the API URL is set to your machine's IP. If the client runs this on their PC and accesses it from their PC's browser, you might need to change it to `http://localhost:8000/api` or instruct the client to use their IP.
