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
        # Garante que o storageBucket é obtido de uma variável de ambiente, com fallback
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

# Rota explícita para servir ficheiros da pasta 'js' (inclui admin.js se estiver lá)
@app.route('/js/<path:filename>')
def serve_js(filename):
    # Garante que o admin.js seja servido de public/js/
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
    # Verifica se todas as variáveis de ambiente necessárias para o cliente foram encontradas
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
        # Verifica se existe pelo menos um documento na coleção 'admins'
        admin_exists = len(admins_ref.get()) > 0
        return jsonify({'adminExists': admin_exists}), 200
    except Exception as e:
        print(f"Erro ao verificar admin: {e}")
        return jsonify({'message': 'Erro ao verificar admin.'}), 500

@app.route('/api/register', methods=['POST'])
def register_admin():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'message': 'Utilizador e senha são obrigatórios.'}), 400

        admins_ref = db.collection('admins')
        # Permite registrar apenas se não houver admins ou se for o primeiro registro
        if len(admins_ref.get()) > 0:
            return jsonify({'message': 'Um administrador já está registado.'}), 403

        hashed_password = generate_password_hash(password)
        admins_ref.add({'username': username, 'password': hashed_password})
        return jsonify({'message': 'Administrador registado com sucesso.'}), 201
    except Exception as e:
        print(f"Erro ao registar admin: {e}")
        return jsonify({'message': f'Erro ao registar administrador: {e}'}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'message': 'Utilizador e senha são obrigatórios.'}), 400

        admins_ref = db.collection('admins')
        # Busca o admin pelo username
        query = admins_ref.where('username', '==', username).limit(1).get()

        if not query:
            return jsonify({'message': 'Utilizador não encontrado.'}), 401

        admin_doc = query[0] # Pega o primeiro documento da query
        if check_password_hash(admin_doc.to_dict()['password'], password):
            session['admin_logged_in'] = True
            return jsonify({'message': 'Login bem-sucedido.'}), 200
        else:
            return jsonify({'message': 'Senha incorreta.'}), 401
    except Exception as e:
        print(f"Erro no login: {e}")
        return jsonify({'message': f'Erro no login: {e}'}), 500

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    session.pop('admin_logged_in', None)
    return jsonify({'message': 'Logout realizado com sucesso.'}), 200

# --- ROTAS DE API DE PRODUTOS ---
@app.route('/api/products', methods=['GET'])
@login_required
def get_products():
    try:
        products_ref = db.collection('products')
        products = [doc.to_dict() for doc in products_ref.get()]
        return jsonify(products), 200
    except Exception as e:
        print(f"Erro ao obter produtos: {e}")
        return jsonify({'message': 'Erro ao obter produtos.'}), 500

@app.route('/api/products', methods=['POST'])
@login_required
def add_product():
    try:
        # Usamos request.form para campos de texto e request.files para ficheiros
        data = request.form.to_dict()
        files = request.files

        # Processa URLs de imagens e sons
        imagem_urls = []
        for i in range(1, 4): # Imagem 1, 2, 3
            file_key = f'imagemURL{i}'
            if file_key in files and files[file_key].filename != '':
                url = upload_file_to_storage(files[file_key], 'product_images')
                if url:
                    imagem_urls.append(url)
        data['imagemURLs'] = imagem_urls

        sound_urls = {}
        for key in ['somOriginal', 'somLenta', 'somAcelerando']:
            if key in files and files[key].filename != '':
                url = upload_file_to_storage(files[key], 'product_sounds')
                if url:
                    sound_urls[key] = url
        data['soundURLs'] = sound_urls

        # Converte 'preco' para float e 'ano' para lista de inteiros
        if 'preco' in data:
            data['preco'] = float(data['preco'])
        if 'ano' in data:
            data['ano'] = [int(a.strip()) for a in data['ano'].split(',') if a.strip().isdigit()]
        else:
            data['ano'] = [] # Garante que 'ano' é uma lista vazia se não fornecido

        # Adiciona o produto ao Firestore
        new_product_ref = db.collection('products').add(data)
        return jsonify({'message': 'Produto adicionado com sucesso.', 'id': new_product_ref[1].id}), 201
    except Exception as e:
        print(f"Erro ao adicionar produto: {e}")
        return jsonify({'message': f'Erro ao adicionar produto: {e}'}), 500

@app.route('/api/products/<product_id>', methods=['PUT'])
@login_required
def update_product(product_id):
    try:
        data = request.form.to_dict()
        files = request.files

        product_ref = db.collection('products').document(product_id)
        current_product = product_ref.get().to_dict() or {}

        # Lidar com imagens existentes e novas
        # Mantém as URLs existentes se nenhum novo arquivo for enviado para aquela posição
        updated_imagem_urls = current_product.get('imagemURLs', [])[:] # Copia a lista
        for i in range(1, 4):
            file_key = f'imagemURL{i}'
            if file_key in files and files[file_key].filename != '':
                url = upload_file_to_storage(files[file_key], 'product_images')
                if url:
                    if i - 1 < len(updated_imagem_urls):
                        updated_imagem_urls[i-1] = url
                    else:
                        updated_imagem_urls.append(url)
        data['imagemURLs'] = updated_imagem_urls


        # Lidar com sons existentes e novos
        updated_sound_urls = current_product.get('soundURLs', {}).copy()
        for key in ['somOriginal', 'somLenta', 'somAcelerando']:
            if key in files and files[key].filename != '':
                url = upload_file_to_storage(files[key], 'product_sounds')
                if url:
                    updated_sound_urls[key] = url
        data['soundURLs'] = updated_sound_urls

        # Converte 'preco' para float e 'ano' para lista de inteiros
        if 'preco' in data:
            data['preco'] = float(data['preco'])
        if 'ano' in data:
            data['ano'] = [int(a.strip()) for a in data['ano'].split(',') if a.strip().isdigit()]
        else:
            data['ano'] = [] # Garante que 'ano' é uma lista vazia se não fornecido

        product_ref.update(data)
        return jsonify({'message': 'Produto atualizado com sucesso.'}), 200
    except Exception as e:
        print(f"Erro ao atualizar produto: {e}")
        return jsonify({'message': f'Erro ao atualizar produto: {e}'}), 500

@app.route('/api/products/<product_id>', methods=['DELETE'])
@login_required
def delete_product(product_id):
    try:
        db.collection('products').document(product_id).delete()
        return jsonify({'message': 'Produto eliminado com sucesso.'}), 200
    except Exception as e:
        print(f"Erro ao eliminar produto: {e}")
        return jsonify({'message': f'Erro ao eliminar produto: {e}'}), 500

# --- ROTAS DE API DE CONFIGURAÇÕES ---
@app.route('/api/settings', methods=['GET'])
@login_required
def get_settings():
    try:
        settings_doc = db.collection('settings').document('storeConfig').get()
        if settings_doc.exists:
            return jsonify(settings_doc.to_dict()), 200
        return jsonify({}), 200 # Retorna um objeto vazio se não houver configurações
    except Exception as e:
        print(f"Erro ao obter configurações: {e}")
        return jsonify({'message': 'Erro ao obter configurações.'}), 500

@app.route('/api/settings', methods=['POST'])
@login_required
def save_settings():
    try:
        settings_data = request.form.to_dict()
        files = request.files

        # Lida com upload de logo
        if 'logoFile' in files:
            url = upload_file_to_storage(files['logoFile'], 'branding')
            if url: settings_data['logoUrl'] = url
        
        # Lida com upload de favicon
        if 'faviconFile' in files:
            url = upload_file_to_storage(files['faviconFile'], 'branding')
            if url: settings_data['faviconUrl'] = url
        
        db.collection('settings').document('storeConfig').set(settings_data, merge=True)
        return jsonify({'message': 'Configurações guardadas com sucesso.'}), 200
    except Exception as e:
        print(f"--- ERRO DETALHADO AO GUARDAR CONFIGURAÇÕES ---\n{e}\n-----------------------------------------")
        return jsonify({'message': f'Erro ao guardar configurações: {e}'}), 500

# --- ROTAS DE API DE FRETE E PAGAMENTO ---
@app.route('/api/shipping', methods=['POST'])
def calculate_shipping():
    # Esta é uma simulação. Você precisaria integrar com uma API de frete real.
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
        # Exemplo de criação de preferência de pagamento com Mercado Pago
        # Você precisaria ajustar isso para a sua lógica de negócio e dados reais do carrinho
        preference_data = {
            "items": [
                {
                    "title": "Produto do Carrinho",
                    "quantity": 1,
                    "unit_price": 100.00
                }
            ],
            "back_urls": {
                "success": "https://turboost-app-site.vercel.app/success", # Substitua pela sua URL de sucesso
                "failure": "https://turboost-app-site.vercel.app/failure", # Substitua pela sua URL de falha
                "pending": "https://turboost-app-site.vercel.app/pending"  # Substitua pela sua URL de pendente
            },
            "auto_return": "approved"
        }
        preference_response = sdk.preference().create(preference_data)
        preference = preference_response["response"]
        
        if preference and preference.get('id'):
            return jsonify({
                "message": "Pagamento criado com sucesso.",
                "preferenceId": preference["id"],
                "initPoint": preference["init_point"] # URL para redirecionar o usuário
            }), 200
        else:
            return jsonify({"message": "Erro ao criar preferência de pagamento no Mercado Pago."}), 500
    except Exception as e:
        print(f"--- ERRO AO CRIAR PAGAMENTO NO MERCADO PAGO ---\n{e}\n-----------------------------------------")
        return jsonify({'message': f'Erro ao criar pagamento: {e}'}), 500

# --- Bloco de Execução ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
