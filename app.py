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

# Carrega as variáveis de ambiente do ficheiro .env
load_dotenv()

# Inicializa a app Flask, informando onde os ficheiros estáticos (CSS, JS, HTML) estão.
app = Flask(__name__, static_folder='public', static_url_path='')
app.secret_key = os.getenv('SESSION_SECRET', os.urandom(24))

# --- Bloco de Inicialização do Firebase (Método Robusto) ---
db = None
try:
    # Prioridade 1: Desenvolvimento local com ficheiro
    if os.path.exists('serviceAccountKey.json'):
        cred = credentials.Certificate('serviceAccountKey.json')
        print("Firebase inicializado com serviceAccountKey.json.")
    # Prioridade 2: Produção (Vercel) com variáveis de ambiente individuais
    elif os.getenv('FIREBASE_PROJECT_ID'):
        print("A tentar inicializar a partir de variáveis de ambiente individuais...")
        firebase_creds_dict = {
            "type": "service_account",
            "project_id": os.getenv('FIREBASE_PROJECT_ID'),
            "private_key_id": os.getenv('FIREBASE_PRIVATE_KEY_ID'),
            # Substitui o marcador de nova linha para garantir a formatação correta
            "private_key": os.getenv('FIREBASE_PRIVATE_KEY', '').replace('\\n', '\n'),
            "client_email": os.getenv('FIREBASE_CLIENT_EMAIL'),
            "client_id": os.getenv('FIREBASE_CLIENT_ID'),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": os.getenv('FIREBASE_CLIENT_X509_CERT_URL'),
            "universe_domain": "googleapis.com"
        }
        cred = credentials.Certificate(firebase_creds_dict)
        print("SUCESSO: Firebase inicializado com variáveis de ambiente individuais.")
    else:
        print("AVISO CRÍTICO: Nenhuma configuração do Firebase Admin SDK encontrada (nem ficheiro, nem variáveis de ambiente).")
        raise ValueError("Configuração do Firebase não encontrada.")

    initialize_app(cred, {
        'storageBucket': 'turboost-site-oficial.appspot.com'
    })
    db = firestore.client()
    print("Cliente Firestore criado com sucesso.")

except Exception as e:
    # Este log é crucial para a depuração no Vercel
    print(f"ERRO CRÍTICO NA INICIALIZAÇÃO DO FIREBASE: {e}")

# --- Configuração do SDK do Mercado Pago ---
MERCADOPAGO_ACCESS_TOKEN = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
if MERCADOPAGO_ACCESS_TOKEN:
    sdk = mercadopago.SDK(MERCADOPAGO_ACCESS_TOKEN)
    print("SDK do Mercado Pago configurado com sucesso.")
else:
    print("AVISO: MERCADOPAGO_ACCESS_TOKEN não encontrado no ficheiro .env. O checkout não irá funcionar.")
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

# --- ROTAS PARA SERVIR OS FICHEIROS HTML ---
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/checkout.html')
def serve_checkout():
    return send_from_directory(app.static_folder, 'checkout.html')

@app.route('/admin.html')
def serve_admin():
    return send_from_directory(app.static_folder, 'admin.html')

# --- DECORATOR DE AUTENTICAÇÃO E ROTAS DE ADMIN ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_logged_in' not in session:
            return jsonify({'message': 'Acesso não autorizado.'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/check-admin', methods=['GET'])
def check_admin():
    try:
        admins_ref = db.collection('admins')
        admin_docs = admins_ref.limit(1).stream()
        admin_exists = any(admin_docs)
        return jsonify({'adminExists': admin_exists})
    except Exception as e:
        return jsonify({'message': f'Erro ao verificar admin: {e}'}), 500

@app.route('/api/register', methods=['POST'])
def register_admin():
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

@app.route('/login', methods=['POST'])
def login():
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
        return jsonify({'message': f'Erro ao guardar configurações: {e}'}), 500

# --- ROTAS DE API DE FRETE E PAGAMENTO ---
@app.route('/api/shipping', methods=['POST'])
def calculate_shipping():
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
