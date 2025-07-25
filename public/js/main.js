document.addEventListener('DOMContentLoaded', function() {
    // As variáveis 'auth' e 'db' serão inicializadas após a configuração ser carregada.
    let auth, db;

    // --- ELEMENTOS DO DOM ---
    const headerLogo = document.getElementById('header-logo');
    const footerLogo = document.getElementById('footer-logo');
    const favicon = document.getElementById('favicon');
    // ... e todos os outros elementos que você precisa

    // --- FUNÇÕES DE API ---
    const api = {
        get: (endpoint) => fetch(endpoint).then(res => {
            if (!res.ok) throw new Error(`Erro na API: ${res.statusText}`);
            return res.json();
        })
    };

    // --- LÓGICA DE CARREGAMENTO DE DADOS ---
    async function loadSiteSettings() {
        try {
            const settings = await api.get('/api/settings');
            // ... (sua lógica para aplicar as configurações)
            if (settings.logoUrl && headerLogo) headerLogo.src = settings.logoUrl;
        } catch (error) {
            console.error("Erro ao carregar configurações do site:", error);
        }
    }

    async function carregarProdutos() {
        try {
            const products = await api.get('/api/products');
            // ... (sua lógica para renderizar os produtos)
        } catch (error) {
            console.error("Falha ao carregar produtos:", error);
        }
    }

    // --- LÓGICA DE AUTENTICAÇÃO DO CLIENTE ---
    function setupAuthObserver() {
        if (!auth) {
            console.warn("Firebase Auth não inicializado.");
            return;
        }
        auth.onAuthStateChanged(async user => {
            // ... (sua lógica de login/logout do cliente)
        });
    }

    // --- INICIALIZAÇÃO PRINCIPAL E SEGURA ---
    async function init() {
        try {
            const firebaseConfig = await api.get('/api/firebase-config');
            if (firebaseConfig.error) {
                throw new Error(firebaseConfig.error);
            }
            
            // Inicializa o Firebase com a configuração segura
            const app = firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            console.log("Firebase inicializado de forma segura no cliente.");

            // Agora que o Firebase está pronto, podemos carregar o resto da aplicação
            setupAuthObserver();
            loadSiteSettings();
            carregarProdutos();
            // (Chame outras funções de inicialização aqui)

        } catch (error) {
            console.error("FALHA CRÍTICA: Não foi possível inicializar a aplicação.", error);
            document.body.innerHTML = '<p style="color: red; text-align: center; margin-top: 50px;">Erro ao carregar o site. A configuração do servidor pode estar incompleta. Tente novamente mais tarde.</p>';
        }
    }

    init();
});
