# app.py
# Flask backend for the Student Task Manager
# Adds: user accounts (register/login/logout) so each user has their own
# private task list, and due dates with overdue highlighting.
# Storage: SQLite (single file database, no external DB service needed)

import os
import sqlite3
from datetime import datetime, timezone, date
from functools import wraps

from flask import (
    Flask, jsonify, request, render_template,
    redirect, url_for, session, g
)
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
# IMPORTANT: set a real SECRET_KEY environment variable in production
# (e.g. in Render's dashboard) so login sessions can't be forged.
app.secret_key = os.environ.get('SECRET_KEY', 'dev-only-change-this-secret-key')

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DB_FILE = os.path.join(DATA_DIR, 'app.db')


# ---------- Database helpers ----------
def get_db():
    if 'db' not in g:
        os.makedirs(DATA_DIR, exist_ok=True)
        g.db = sqlite3.connect(DB_FILE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            priority TEXT NOT NULL,
            due_date TEXT,
            completed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.commit()
    conn.close()


init_db()


# ---------- Auth helpers ----------
def login_required_page(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrapped


def login_required_api(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated.'}), 401
        return f(*args, **kwargs)
    return wrapped


def task_to_dict(row):
    due = row['due_date']
    overdue = False
    if due and not row['completed']:
        try:
            overdue = date.fromisoformat(due) < date.today()
        except ValueError:
            overdue = False
    return {
        'id': row['id'],
        'title': row['title'],
        'category': row['category'],
        'priority': row['priority'],
        'dueDate': due,
        'completed': bool(row['completed']),
        'overdue': overdue,
        'createdAt': row['created_at'],
    }


# ---------- Auth routes (pages) ----------
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template('register.html')

    username = (request.form.get('username') or '').strip()
    password = request.form.get('password') or ''
    confirm = request.form.get('confirm') or ''

    if not username or not password:
        return render_template('register.html', error='Username and password are required.')
    if password != confirm:
        return render_template('register.html', error='Passwords do not match.')

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if existing:
        return render_template('register.html', error='That username is already taken.')

    db.execute(
        'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
        (username, generate_password_hash(password), datetime.now(timezone.utc).isoformat()),
    )
    db.commit()

    user = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    session['user_id'] = user['id']
    session['username'] = username
    return redirect(url_for('index'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    username = (request.form.get('username') or '').strip()
    password = request.form.get('password') or ''

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()

    if user is None or not check_password_hash(user['password_hash'], password):
        return render_template('login.html', error='Incorrect username or password.')

    session['user_id'] = user['id']
    session['username'] = user['username']
    return redirect(url_for('index'))


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ---------- Frontend route ----------
@app.route('/')
@login_required_page
def index():
    return render_template('index.html', username=session.get('username'))


# ---------- API routes ----------
@app.route('/api/tasks', methods=['GET'])
@login_required_api
def get_tasks():
    db = get_db()
    rows = db.execute(
        'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
        (session['user_id'],),
    ).fetchall()
    return jsonify([task_to_dict(r) for r in rows])


@app.route('/api/tasks', methods=['POST'])
@login_required_api
def create_task():
    body = request.get_json(silent=True) or {}
    title = (body.get('title') or '').strip()

    if not title:
        return jsonify({'error': 'Task title is required.'}), 400

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    cursor = db.execute(
        '''INSERT INTO tasks (user_id, title, category, priority, due_date, completed, created_at)
           VALUES (?, ?, ?, ?, ?, 0, ?)''',
        (
            session['user_id'],
            title,
            body.get('category') or 'General',
            body.get('priority') or 'Medium',
            body.get('dueDate') or None,
            now,
        ),
    )
    db.commit()
    row = db.execute('SELECT * FROM tasks WHERE id = ?', (cursor.lastrowid,)).fetchone()
    return jsonify(task_to_dict(row)), 201


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@login_required_api
def update_task(task_id):
    db = get_db()
    row = db.execute(
        'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
        (task_id, session['user_id']),
    ).fetchone()

    if row is None:
        return jsonify({'error': 'Task not found.'}), 404

    updates = request.get_json(silent=True) or {}
    title = updates.get('title', row['title'])
    category = updates.get('category', row['category'])
    priority = updates.get('priority', row['priority'])
    due_date = updates.get('dueDate', row['due_date'])
    completed = updates.get('completed', bool(row['completed']))

    db.execute(
        '''UPDATE tasks SET title = ?, category = ?, priority = ?, due_date = ?, completed = ?
           WHERE id = ? AND user_id = ?''',
        (title, category, priority, due_date, 1 if completed else 0, task_id, session['user_id']),
    )
    db.commit()
    row = db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
    return jsonify(task_to_dict(row))


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@login_required_api
def delete_task(task_id):
    db = get_db()
    row = db.execute(
        'SELECT id FROM tasks WHERE id = ? AND user_id = ?',
        (task_id, session['user_id']),
    ).fetchone()

    if row is None:
        return jsonify({'error': 'Task not found.'}), 404

    db.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', (task_id, session['user_id']))
    db.commit()
    return jsonify({'message': 'Task deleted successfully.'})


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'time': datetime.now(timezone.utc).isoformat()})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=True)