import json
import os
import hashlib
import secrets
import psycopg2

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(password, stored):
    salt, hashed = stored.split(':')
    return hash_password(password, salt) == stored

def handler(event, context):
    """Регистрация и авторизация пользователей мессенджера"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    method = event.get('httpMethod', 'GET')
    path = event.get('queryStringParameters', {}) or {}
    action = path.get('action', '')

    if method != 'POST':
        return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'})}

    body = json.loads(event.get('body', '{}'))

    if action == 'register':
        username = body.get('username', '').strip().lower()
        password = body.get('password', '')
        display_name = body.get('display_name', '').strip()

        if not username or not password or not display_name:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Заполните все поля'})}

        if len(username) < 3:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Имя пользователя минимум 3 символа'})}

        if len(password) < 6:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = '%s'" % username.replace("'", "''"))
        if cur.fetchone():
            cur.close()
            conn.close()
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Пользователь уже существует'})}

        password_hash = hash_password(password)
        token = secrets.token_hex(32)

        cur.execute(
            "INSERT INTO users (username, password_hash, display_name) VALUES ('%s', '%s', '%s') RETURNING id" %
            (username.replace("'", "''"), password_hash.replace("'", "''"), display_name.replace("'", "''"))
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({
            'user_id': user_id,
            'username': username,
            'display_name': display_name,
            'token': token
        })}

    elif action == 'login':
        username = body.get('username', '').strip().lower()
        password = body.get('password', '')

        if not username or not password:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Заполните все поля'})}

        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, username, password_hash, display_name, avatar_url FROM users WHERE username = '%s'" %
            username.replace("'", "''")
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Неверный логин или пароль'})}

        if not verify_password(password, row[2]):
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Неверный логин или пароль'})}

        token = secrets.token_hex(32)

        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({
            'user_id': row[0],
            'username': row[1],
            'display_name': row[3],
            'avatar_url': row[4],
            'token': token
        })}

    elif action == 'users':
        search = body.get('search', '').strip()
        current_user_id = body.get('user_id')

        if not search:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Введите поисковый запрос'})}

        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, username, display_name, avatar_url FROM users WHERE (username ILIKE '%%%s%%' OR display_name ILIKE '%%%s%%') AND id != %s LIMIT 20" %
            (search.replace("'", "''"), search.replace("'", "''"), int(current_user_id))
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        users = [{'id': r[0], 'username': r[1], 'display_name': r[2], 'avatar_url': r[3]} for r in rows]
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'users': users})}

    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Unknown action'})}
