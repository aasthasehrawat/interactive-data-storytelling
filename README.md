# Interactive Data Storytelling Hub

A full-stack portfolio app where users **sign up / log in**, browse **chaptered data stories**, and understand the narrative through **interactive charts** that change with each chapter.

## Product flow

1. **Auth** — create an account or log in  
2. **Library** — explore featured stories, search/filter by tags, bookmark favorites  
3. **Reader** — move chapter by chapter; the chart syncs (trend lines or year ranking bars)  
4. **Composer** — write your own guided story with per-chapter chart controls  

## Dataset

**The Global Digital Divide** — illustrative internet-access rates (% of population) for India, USA, China, Brazil, Nigeria, and Japan from 2015–2022. Built for storytelling demos (not an official statistical release).

## Tech stack

- **Frontend:** React (Create React App), D3.js  
- **Backend:** Flask REST API, Flask-Sock WebSockets  
- **Auth:** signup/login sessions with hashed passwords  
- **Persistence:** JSON files for users, sessions, stories, bookmarks  

## Quickstart

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
python app.py
```

API runs on [http://localhost:5000](http://localhost:5000)

### Frontend

```bash
cd frontend
npm install
npm start
```

App runs on [http://localhost:3000](http://localhost:3000)

## Highlights for reviewers

- Auth-gated storytelling experience  
- Chapter → chart synchronization (line + bar modes)  
- Dataset insights banner (fastest climb, highest access, gap)  
- Live story updates over WebSocket  
- Bookmarking, search, and tag filters  
- Story composer with per-chapter visualization controls  
