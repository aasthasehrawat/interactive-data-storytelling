# Interactive Data Storytelling Hub 
A full-stack interactive data storytelling platform built with React.js, Flask, WebSocket, and D3.js. Users can create, view, and update stories with live interactive visualizations.

Tech stack:
Frontend: React.js (Create React App)
Data Visualization: D3.js
Backend: Flask (REST APIs)
Real-time Communication: Flask-Sock (WebSocket support)
Full-stack features: Story persistence, live data channel updates

Features
- Interactive story creation and visualization
- Live updates via WebSocket
- Clean, responsive React frontend
- Persistent backend using Flask REST APIs

## Quickstart

Backend:
1. Navigate to the backend folder:
   cd backend

2. Create a virtual environment:
   python -m venv venv


3. Activate the virtual environment:
   Windows:
   venv\Scripts\activate
 
   Mac/Linux:
   source venv/bin/activate

4. Install dependencies:
   pip install -r requirements.txt

5. Run the backend server:
   python app.py

Backend runs on port 5000

Frontend:
1. Navigate to the frontend folder:
   cd frontend
   
2.Install dependencies:
  npm install

3. Start the React development server:
   npm start

Frontend runs on port 3000

## Access the App
- Make sure backend is running on port 5000 for API calls and WebSocket
- Open frontend on port 3000 to interact with the app.
