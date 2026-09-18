# app.py
# Flask backend for the Student Task Manager
# Uses a JSON file as lightweight storage (no external DB setup needed)

import json
import os
import time
from datetime import datetime, timezone

from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DB_FILE = os.path.join(DATA_DIR, 'tasks.json')


# ---------- Storage helpers ----------
def ensure_db_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, 'w') as f:
            json.dump([], f)


def read_tasks():
    ensure_db_file()
    with open(DB_FILE, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def write_tasks(tasks):
    ensure_db_file()
    with open(DB_FILE, 'w') as f:
        json.dump(tasks, f, indent=2)


# ---------- Frontend route ----------
@app.route('/')
def index():
    return render_template('index.html')


# ---------- API routes (Backend "modules") ----------
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    return jsonify(read_tasks())


@app.route('/api/tasks', methods=['POST'])
def create_task():
    body = request.get_json(silent=True) or {}
    title = (body.get('title') or '').strip()

    if not title:
        return jsonify({'error': 'Task title is required.'}), 400

    tasks = read_tasks()
    new_task = {
        'id': str(int(time.time() * 1000)),
        'title': title,
        'category': body.get('category') or 'General',
        'priority': body.get('priority') or 'Medium',
        'completed': False,
        'createdAt': datetime.now(timezone.utc).isoformat(),
    }
    tasks.append(new_task)
    write_tasks(tasks)
    return jsonify(new_task), 201


@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    tasks = read_tasks()
    index = next((i for i, t in enumerate(tasks) if t['id'] == task_id), None)

    if index is None:
        return jsonify({'error': 'Task not found.'}), 404

    updates = request.get_json(silent=True) or {}
    tasks[index].update(updates)
    write_tasks(tasks)
    return jsonify(tasks[index])


@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    tasks = read_tasks()
    if not any(t['id'] == task_id for t in tasks):
        return jsonify({'error': 'Task not found.'}), 404

    tasks = [t for t in tasks if t['id'] != task_id]
    write_tasks(tasks)
    return jsonify({'message': 'Task deleted successfully.'})


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'time': datetime.now(timezone.utc).isoformat()})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=True)
