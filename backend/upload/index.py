import json
import os
import base64
import uuid
import boto3

def handler(event, context):
    """Загрузка файлов и изображений в чат"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'})}

    body = json.loads(event.get('body', '{}'))
    file_data = body.get('file_data', '')
    file_name = body.get('file_name', 'file')
    content_type = body.get('content_type', 'application/octet-stream')

    if not file_data:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'No file data'})}

    file_bytes = base64.b64decode(file_data)

    max_size = 10 * 1024 * 1024
    if len(file_bytes) > max_size:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Файл слишком большой (макс 10 МБ)'})}

    ext = file_name.rsplit('.', 1)[-1] if '.' in file_name else 'bin'
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    key = f"messenger/{unique_name}"

    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )

    s3.put_object(
        Bucket='files',
        Key=key,
        Body=file_bytes,
        ContentType=content_type
    )

    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({
        'url': cdn_url,
        'file_name': file_name,
        'file_type': content_type
    })}
