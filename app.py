import os
from flask import Flask, request, jsonify, session, send_from_directory
from firebase_admin import credentials, initialize_app, firestore, storage
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import requests
import json
from dotenv import load_dotenv
import uuid # Usado para gerar nomes de ficheiro únicos
import mercadopago # Importa a biblioteca do Mercado Pago

# Carrega as variáveis de ambiente do ficheiro .env para desenvolvimento local
load_dotenv()

# Inicializa a app Flask, informando onde os ficheiros estáticos (CSS, JS, HTML) estão.
app = Flask(__name__, static_folder='public', static_url_path='')
app.secret_key = os.getenv('SESSION_SECRET', os.urandom(24))

# --- Bloco de Inicialização do Firebase Admin (Backend) ---
db = None
try:
    # Tenta inicializar a partir da variável de ambiente (ideal para produção/Vercel)
    firebase_creds_json = os.getenv('FIREBASE_CREDENTIALS_JSON')
    if firebase_creds_json:
        creds_dict = json.loads(firebase_creds_json)
        cred = credentials.Certificate(creds_dict)
        print("SUCESSO: Firebase Admin inicializado com variável de ambiente.")
    # Fallback para ficheiro local (ideal para desenvolvimento)
    elif os.path.exists('serviceAccountKey.json'):
        cred = credentials.Certificate('serviceAccountKey.json')
        print("Firebase Admin inicializado com serviceAccountKey.json local.")
    else:
        raise ValueError("Configuração do Firebase Admin não encontrada (nem variável de ambiente, nem ficheiro).")

    initialize_app(cred, {
        'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET', 'turboost-site-oficial.appspot.com')
    })
    db = firestore.client()
    print("Cliente Firestore criado com sucesso.")
except Exception as e:
    print(f"ERRO CRÍTICO NA INICIALIZAÇÃO DO FIREBASE ADMIN: {e}")

# --- Configuração do SDK do Mercado Pago ---
MERCADOPAGO_ACCESS_TOKEN = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
if MERCADOPAGO_ACCESS_TOKEN:
    sdk = mercadopago.SDK(MERCADOPAGO_ACCESS_TOKEN)
    print("SDK do Mercado Pago configurado com sucesso.")
else:
    print("AVISO: MERCADOPAGO_ACCESS_TOKEN não encontrado.")
    sdk = None

# --- FUNÇÃO AUXILIAR PARA UPLOAD DE FICHEIROS ---
def upload_file_to_storage(file, folder):
    if not file or file.filename == '':
        return None
    filename = f"{folder}/{uuid.uuid4()}-{file.filename}"
    bucket = storage.bucket()
    blob = bucket.blob(filename)
    blob.upload_from_file(file, content_type=file.content_type)
    blob.make_public()
    return blob.public_url

# --- ROTAS PARA SERVIR PÁGINAS E FICHEIROS ESTÁTICOS ---
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/checkout.html')
def serve_checkout():
    return send_from_directory(app.static_folder, 'checkout.html')

@app.route('/admin.html')
def serve_admin():
    return send_from_directory(app.static_folder, 'admin.html')

@app.route('/favicon.ico')
def serve_favicon():
    return send_from_directory(app.static_folder, 'favicon.ico', mimetype='image/vnd.microsoft.icon')

# Rota explícita para servir ficheiros da pasta 'js'
@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(app.static_folder, 'js'), filename)

# Rota explícita para servir ficheiros da pasta 'css'
@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(app.static_folder, 'css'), filename)

# --- ENDPOINT SEGURO PARA CONFIGURAÇÃO DO FIREBASE NO CLIENTE ---
@app.route('/api/firebase-config')
def get_firebase_config():
    config = {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID")
    }
    if not all(config.values()):
        print("AVISO: Uma ou mais variáveis de ambiente da configuração do Firebase para o cliente não foram encontradas.")
        return jsonify({"error": "Configuração do servidor incompleta."}), 500
        
    return jsonify(config)

# --- DECORATOR DE AUTENTICAÇÃO ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_logged_in' not in session:
            return jsonify({'message': 'Acesso não autorizado.'}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- ROTAS DE API DE ADMIN ---
# (As suas rotas de API de admin, produtos e configurações continuam aqui)
# ...

# --- Bloco de Execução ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
