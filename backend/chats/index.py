import json
import os
import psycopg2

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event, context):
    """Управление чатами: список, создание, получение сообщений"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters', {}) or {}
    action = params.get('action', '')

    if method == 'GET' and action == 'list':
        user_id = int(params.get('user_id', 0))
        if not user_id:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'user_id required'})}

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT c.id, c.updated_at,
                   u.id, u.username, u.display_name, u.avatar_url,
                   m.content, m.file_name, m.created_at
            FROM chat_participants cp
            JOIN chats c ON c.id = cp.chat_id
            JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.user_id != %s
            JOIN users u ON u.id = cp2.user_id
            LEFT JOIN LATERAL (
                SELECT content, file_name, created_at FROM messages
                WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1
            ) m ON true
            WHERE cp.user_id = %s
            ORDER BY c.updated_at DESC
        """ % (user_id, user_id))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        chats = []
        for r in rows:
            last_message = r[6] if r[6] else ('📎 ' + r[7] if r[7] else '')
            chats.append({
                'id': r[0],
                'updated_at': r[1].isoformat() if r[1] else None,
                'other_user': {
                    'id': r[2], 'username': r[3], 'display_name': r[4], 'avatar_url': r[5]
                },
                'last_message': last_message,
                'last_message_at': r[8].isoformat() if r[8] else None
            })

        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'chats': chats})}

    elif method == 'POST' and action == 'create':
        body = json.loads(event.get('body', '{}'))
        user_id = int(body.get('user_id', 0))
        other_user_id = int(body.get('other_user_id', 0))

        if not user_id or not other_user_id:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'user_id and other_user_id required'})}

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            SELECT cp1.chat_id FROM chat_participants cp1
            JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
            WHERE cp1.user_id = %s AND cp2.user_id = %s
            LIMIT 1
        """ % (user_id, other_user_id))
        existing = cur.fetchone()

        if existing:
            chat_id = existing[0]
        else:
            cur.execute("INSERT INTO chats DEFAULT VALUES RETURNING id")
            chat_id = cur.fetchone()[0]
            cur.execute("INSERT INTO chat_participants (chat_id, user_id) VALUES (%s, %s)" % (chat_id, user_id))
            cur.execute("INSERT INTO chat_participants (chat_id, user_id) VALUES (%s, %s)" % (chat_id, other_user_id))
            conn.commit()

        cur.close()
        conn.close()

        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'chat_id': chat_id})}

    elif method == 'GET' and action == 'messages':
        chat_id = int(params.get('chat_id', 0))
        user_id = int(params.get('user_id', 0))
        offset = int(params.get('offset', 0))

        if not chat_id or not user_id:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'chat_id and user_id required'})}

        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT id FROM chat_participants WHERE chat_id = %s AND user_id = %s" % (chat_id, user_id))
        if not cur.fetchone():
            cur.close()
            conn.close()
            return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Access denied'})}

        cur.execute("""
            SELECT m.id, m.sender_id, m.content, m.file_url, m.file_name, m.file_type, m.created_at,
                   u.username, u.display_name, u.avatar_url
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.chat_id = %s
            ORDER BY m.created_at ASC
            LIMIT 100 OFFSET %s
        """ % (chat_id, offset))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        messages = [{
            'id': r[0], 'sender_id': r[1], 'content': r[2],
            'file_url': r[3], 'file_name': r[4], 'file_type': r[5],
            'created_at': r[6].isoformat() if r[6] else None,
            'sender_username': r[7], 'sender_display_name': r[8], 'sender_avatar': r[9]
        } for r in rows]

        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'messages': messages})}

    elif method == 'POST' and action == 'send':
        body = json.loads(event.get('body', '{}'))
        chat_id = int(body.get('chat_id', 0))
        sender_id = int(body.get('sender_id', 0))
        content = body.get('content', '').strip()
        file_url = body.get('file_url', '')
        file_name = body.get('file_name', '')
        file_type = body.get('file_type', '')

        if not chat_id or not sender_id:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'chat_id and sender_id required'})}

        if not content and not file_url:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Сообщение не может быть пустым'})}

        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT id FROM chat_participants WHERE chat_id = %s AND user_id = %s" % (chat_id, sender_id))
        if not cur.fetchone():
            cur.close()
            conn.close()
            return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Access denied'})}

        content_sql = "'%s'" % content.replace("'", "''") if content else "NULL"
        file_url_sql = "'%s'" % file_url.replace("'", "''") if file_url else "NULL"
        file_name_sql = "'%s'" % file_name.replace("'", "''") if file_name else "NULL"
        file_type_sql = "'%s'" % file_type.replace("'", "''") if file_type else "NULL"

        cur.execute("""
            INSERT INTO messages (chat_id, sender_id, content, file_url, file_name, file_type)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, created_at
        """ % (chat_id, sender_id, content_sql, file_url_sql, file_name_sql, file_type_sql))
        row = cur.fetchone()
        msg_id = row[0]
        created_at = row[1]

        cur.execute("UPDATE chats SET updated_at = NOW() WHERE id = %s" % chat_id)
        conn.commit()
        cur.close()
        conn.close()

        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({
            'id': msg_id, 'created_at': created_at.isoformat()
        })}

    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Unknown action'})}
