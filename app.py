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

# Rota explícita para servir ficheiros da pasta 'js'
@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(app.static_folder, 'js'), filename)

# Rota explícita para servir ficheiros da pasta 'css'
@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(app.static_folder, 'css'), filename)

@app.route('/favicon.ico')
def serve_favicon():
    return send_from_directory(app.static_folder, 'favicon.ico', mimetype='image/vnd.microsoft.icon')

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
@app.route('/api/check-admin', methods=['GET'])
def check_admin():
    try:
        admins_ref = db.collection('admins')
        admin_docs = admins_ref.limit(1).stream()
        return jsonify({'adminExists': any(admin_docs)})
    except Exception as e:
        print(f"--- ERRO AO VERIFICAR ADMIN ---\n{e}")
        return jsonify({'message': f'Erro ao verificar admin: {e}'}), 500

@app.route('/api/register', methods=['POST'])
def register_admin():
    try:
        admins_ref = db.collection('admins')
        if any(admins_ref.limit(1).stream()):
            return jsonify({'message': 'Um administrador já existe.'}), 409
        data = request.get_json()
        username, password = data.get('username'), data.get('password')
        if not username or not password:
            return jsonify({'message': 'Utilizador e senha são obrigatórios.'}), 400
        hashed_password = generate_password_hash(password)
        admins_ref.add({'username': username, 'password_hash': hashed_password})
        return jsonify({'message': 'Administrador registado com sucesso.'}), 201
    except Exception as e:
        print(f"--- ERRO AO REGISTAR ADMIN ---\n{e}")
        return jsonify({'message': f'Erro ao registar admin: {e}'}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username, password = data.get('username'), data.get('password')
        admin_docs = list(db.collection('admins').where('username', '==', username).limit(1).stream())
        if not admin_docs:
            return jsonify({'message': 'Utilizador ou senha inválidos.'}), 401
        admin_data = admin_docs[0].to_dict()
        if check_password_hash(admin_data['password_hash'], password):
            session['admin_logged_in'] = True
            return jsonify({'message': 'Login bem-sucedido.'}), 200
        return jsonify({'message': 'Utilizador ou senha inválidos.'}), 401
    except Exception as e:
        print(f"--- ERRO NO LOGIN ---\n{e}")
        return jsonify({'message': f'Erro no processo de login: {e}'}), 500

@app.route('/logout', methods=['POST'])
def logout():
    session.pop('admin_logged_in', None)
    return jsonify({'message': 'Logout bem-sucedido.'}), 200

# --- ROTAS DE API DE PRODUTOS ---
@app.route('/api/products', methods=['GET'])
def get_products():
    try:
        products_ref = db.collection('products')
        products = []
        for doc in products_ref.stream():
            product_data = doc.to_dict()
            product_data['id'] = doc.id
            products.append(product_data)
        return jsonify(products), 200
    except Exception as e:
        print(f"--- ERRO DETALHADO AO BUSCAR PRODUTOS ---\n{e}\n-----------------------------------------")
        return jsonify({'message': f'Erro interno ao buscar produtos.'}), 500

def process_product_data(form_data):
    data = dict(form_data)
    if 'ano' in data and data['ano']:
        data['ano'] = [int(a.strip()) for a in data['ano'].split(',') if a.strip().isdigit()]
    else:
        data['ano'] = []
    for key in ['preco', 'peso', 'comprimento', 'altura', 'largura']:
        if key in data and data[key]:
            try:
                data[key] = float(data[key])
            except (ValueError, TypeError):
                data[key] = 0.0
    data['isFeatured'] = data.get('isFeatured') == 'on'
    return data

@app.route('/api/products', methods=['POST'])
@login_required
def add_product():
    try:
        data = process_product_data(request.form)
        for i in range(1, 4):
            file_key = f'imagemURL{i}'
            if file_key in request.files:
                url = upload_file_to_storage(request.files[file_key], 'products')
                if url: data[file_key] = url
        for sound_key in ['somOriginal', 'somLenta', 'somAcelerando']:
            if sound_key in request.files:
                url = upload_file_to_storage(request.files[sound_key], 'sounds')
                if url: data[sound_key] = url
        _, doc_ref = db.collection('products').add(data)
        return jsonify({'message': 'Produto adicionado com sucesso', 'id': doc_ref.id}), 201
    except Exception as e:
        print(f"--- ERRO DETALHADO AO ADICIONAR PRODUTO ---\n{e}\n-----------------------------------------")
        return jsonify({'message': f'Erro ao adicionar produto: {e}'}), 500

@app.route('/api/products/<product_id>', methods=['PUT'])
@login_required
def update_product(product_id):
    try:
        data = process_product_data(request.form)
        for i in range(1, 4):
            file_key = f'imagemURL{i}'
            if file_key in request.files and request.files[file_key].filename != '':
                url = upload_file_to_storage(request.files[file_key], 'products')
                if url: data[file_key] = url
        for sound_key in ['somOriginal', 'somLenta', 'somAcelerando']:
            if sound_key in request.files and request.files[sound_key].filename != '':
                url = upload_file_to_storage(request.files[sound_key], 'sounds')
                if url: data[sound_key] = url
        db.collection('products').document(product_id).update(data)
        return jsonify({'message': 'Produto atualizado com sucesso.'}), 200
    except Exception as e:
        print(f"--- ERRO DETALHADO AO ATUALIZAR PRODUTO ---\n{e}\n-----------------------------------------")
        return jsonify({'message': f'Erro ao atualizar produto: {e}'}), 500

@app.route('/api/products/<product_id>', methods=['DELETE'])
@login_required
def delete_product(product_id):
    try:
        db.collection('products').document(product_id).delete()
        return jsonify({'message': 'Produto eliminado com sucesso.'}), 200
    except Exception as e:
        print(f"--- ERRO DETALHADO AO ELIMINAR PRODUTO ---\n{e}\n-----------------------------------------")
        return jsonify({'message': f'Erro ao eliminar produto: {e}'}), 500

# --- ROTAS DE API DE CONFIGURAÇÕES ---
@app.route('/api/settings', methods=['GET'])
def get_settings():
    try:
        settings_doc = db.collection('settings').document('storeConfig').get()
        if settings_doc.exists:
            return jsonify(settings_doc.to_dict()), 200
        return jsonify({}), 200
    except Exception as e:
        print(f"--- ERRO DETALHADO AO BUSCAR CONFIGURAÇÕES ---\n{e}\n-----------------------------------------")
        return jsonify({'message': f'Erro ao buscar configurações: {e}'}), 500

@app.route('/api/settings', methods=['POST'])
@login_required
def save_settings():
    try:
        settings_data = request.form.to_dict()
        if 'logoFile' in request.files:
            url = upload_file_to_storage(request.files['logoFile'], 'branding')
            if url: settings_data['logoUrl'] = url
        if 'faviconFile' in request.files:
            url = upload_file_to_storage(request.files['faviconFile'], 'branding')
            if url: settings_data['faviconUrl'] = url
        db.collection('settings').document('storeConfig').set(settings_data, merge=True)
        return jsonify({'message': 'Configurações guardadas com sucesso.'}), 200
    except Exception as e:
        print(f"--- ERRO DETALHADO AO GUARDAR CONFIGURAÇÕES ---\n{e}\n-----------------------------------------")
        return jsonify({'message': f'Erro ao guardar configurações: {e}'}), 500

# --- ROTAS DE API DE FRETE E PAGAMENTO ---
@app.route('/api/shipping', methods=['POST'])
def calculate_shipping():
    # Placeholder - Substituir com a lógica real de cálculo de frete
    return jsonify([
        {"Codigo": "04510", "Valor": "25,50", "PrazoEntrega": "5"},
        {"Codigo": "04014", "Valor": "45,80", "PrazoEntrega": "2"}
    ])

@app.route('/api/create-payment', methods=['POST'])
def create_payment():
    if not sdk:
        return jsonify({"message": "O serviço de pagamento não está configurado."}), 503
    try:
        data = request.get_json()
        cart_items = data.get('cartItems')
        shipping_cost = data.get('shippingCost')
        customer_info = data.get('customerInfo')
        items_list = []
        for item in cart_items:
            items_list.append({
                "title": item.get('nomeProduto'),
                "quantity": int(item.get('quantity')),
                "unit_price": float(item.get('preco')),
                "currency_id": "BRL"
            })
        items_list.append({
            "title": "Frete",
            "quantity": 1,
            "unit_price": float(shipping_cost),
            "currency_id": "BRL"
        })
        preference_data = {
            "items": items_list,
            "payer": {
                "name": customer_info.get('name'),
                "email": customer_info.get('email')
            },
            "back_urls": {
                "success": f"{request.host_url}payment-success.html",
                "failure": f"{request.host_url}payment-failure.html",
                "pending": f"{request.host_url}payment-pending.html"
            },
            "auto_return": "approved"
        }
        preference_response = sdk.preference().create(preference_data)
        preference = preference_response["response"]
        return jsonify(preference)
    except Exception as e:
        print(f"--- ERRO AO CRIAR PAGAMENTO NO MERCADO PAGO ---\n{e}\n-----------------------------------------")
        return jsonify({"message": str(e)}), 500

# --- Bloco de Execução ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
