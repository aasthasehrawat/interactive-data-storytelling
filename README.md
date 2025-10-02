# Interactive Data Storytelling Hub (React + Flask + WebSocket)

Tech stack:
- React.js frontend (create-react-app)
- D3.js for data visualization
- Flask backend (REST APIs)
- Flask-Sock for WebSocket support
- Full-stack development with story persistence and live data channel

## Quickstart

Backend:
```bash
cd backend
python -m venv venv
. venv/bin/activate
pip install -r requirements.txt
python app.py
```

Frontend:
```bash
cd frontend
npm install
npm start
```

Then open http://localhost:3000 for React frontend. Flask backend runs on port 5000.