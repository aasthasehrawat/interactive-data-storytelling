from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sock import Sock
import json, os

app = Flask(__name__, static_folder='../frontend/build', static_url_path='/')
CORS(app)
sock = Sock(app)

data = [
    {"country":"India","year":2018,"metric":"internet_users","value":34},
    {"country":"India","year":2019,"metric":"internet_users","value":36},
    {"country":"India","year":2020,"metric":"internet_users","value":40},
    {"country":"USA","year":2018,"metric":"internet_users","value":88},
    {"country":"USA","year":2019,"metric":"internet_users","value":89},
    {"country":"USA","year":2020,"metric":"internet_users","value":90},
    {"country":"China","year":2018,"metric":"internet_users","value":55},
    {"country":"China","year":2019,"metric":"internet_users","value":60},
    {"country":"China","year":2020,"metric":"internet_users","value":65},
]

stories = []

@app.route("/api/data")
def get_data():
    return jsonify(data)

@app.route("/api/stories", methods=["GET","POST"])
def story_list():
    global stories
    if request.method == "GET":
        return jsonify(stories)
    else:
        payload = request.json
        payload["id"] = len(stories)+1
        stories.append(payload)
        return jsonify(payload)

@sock.route('/ws')
def echo(sock):
    while True:
        msg = sock.receive()
        if msg is None:
            break
        sock.send(f"Echo: {msg}")

@app.route("/")
def index():
    return app.send_static_file("index.html")

if __name__ == "__main__":
    app.run(port=5000)
