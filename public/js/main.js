document.addEventListener('DOMContentLoaded', () => {
    // As variáveis 'auth' e 'db' serão inicializadas após a configuração ser carregada.
    let auth, db;

    // --- ELEMENTOS DO DOM ---
    const headerLogo = document.getElementById('header-logo');
    const footerLogo = document.getElementById('footer-logo');
    const favicon = document.getElementById('favicon');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const marcaSelect = document.getElementById('marca-select');
    const modeloSelect = document.getElementById('modelo-select');
    const anoSelect = document.getElementById('ano-select');
    const buscarProdutosBtn = document.getElementById('buscar-produtos-btn');
    const productGrid = document.getElementById('product-grid');
    const vitrineTitulo = document.getElementById('vitrine-titulo');
    const yearSpan = document.getElementById('year');
    const cartButton = document.getElementById('cart-button');
    const cartPanel = document.getElementById('cart-panel');
    const cartOverlay = document.getElementById('cart-overlay');
    const closeCartBtn = document.getElementById('close-cart-btn');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const detailsModalOverlay = document.getElementById('details-modal-overlay');
    const detailsModal = document.getElementById('details-modal');
    const closeDetailsModalBtn = document.getElementById('close-details-modal-btn');
    const loginBtn = document.getElementById('login-btn');
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModalBtn = document.getElementById('close-auth-modal-btn');
    const customerLoginForm = document.getElementById('customer-login-form');
    const customerRegisterForm = document.getElementById('customer-register-form');
    const showRegisterViewBtn = document.getElementById('show-register-view-btn');
    const showLoginViewBtn = document.getElementById('show-login-view-btn');
    const customerLoginView = document.getElementById('customer-login-view');
    const customerRegisterView = document.getElementById('customer-register-view');
    const mainLogoutBtn = document.getElementById('logout-btn');
    const userArea = document.getElementById('user-area');
    const userInfo = document.getElementById('user-info');
    const userGreeting = document.getElementById('user-greeting');
    const loginFormError = document.getElementById('login-form-error');
    const registerFormError = document.getElementById('register-form-error');

    // --- ESTADO DA APLICAÇÃO ---
    let allProducts = [];
    let cart = JSON.parse(localStorage.getItem('turboostCart')) || [];

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
            if (settings.faviconUrl && favicon) favicon.href = settings.faviconUrl;
            if (settings.logoUrl && headerLogo) headerLogo.src = settings.logoUrl;
            if (settings.logoUrl && footerLogo) footerLogo.src = settings.logoUrl;
        } catch (error) {
            console.error("Erro ao carregar configurações do site:", error);
        }
    }

    async function carregarProdutos() {
        if (!productGrid) return;
        try {
            allProducts = await api.get('/api/products');
            // ... (lógica para popular filtros e exibir produtos)
        } catch (error) {
            console.error("Falha ao carregar produtos:", error);
        }
    }

    // --- LÓGICA DE AUTENTICAÇÃO DO CLIENTE ---
    function setupAuthObserver() {
        if (!auth) return;
        auth.onAuthStateChanged(user => {
            if (user) {
                if(userArea) userArea.classList.add('hidden');
                if(userInfo) userInfo.classList.remove('hidden');
                if(userGreeting) userGreeting.textContent = `Olá, ${user.displayName || user.email.split('@')[0]}`;
            } else {
                if(userArea) userArea.classList.remove('hidden');
                if(userInfo) userInfo.classList.add('hidden');
            }
        });
    }
    
    // --- FUNÇÃO DE INICIALIZAÇÃO SEGURA ---
    async function init() {
        try {
            const firebaseConfig = await api.get('/api/firebase-config');
            if (firebaseConfig.error) throw new Error(firebaseConfig.error);
            
            const app = firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            console.log("Firebase inicializado de forma segura no cliente (main.js).");

            setupAuthObserver();
            loadSiteSettings();
            carregarProdutos();
            setupEventListeners();

        } catch (error) {
            console.error("FALHA CRÍTICA: Não foi possível inicializar a aplicação.", error);
        }
    }

    // --- CONFIGURAÇÃO DOS EVENT LISTENERS (COM VERIFICAÇÕES) ---
    function setupEventListeners() {
        if (yearSpan) {
            yearSpan.textContent = new Date().getFullYear();
        }

        if (mobileMenuButton) {
            mobileMenuButton.addEventListener('click', () => {
                if (mobileMenu) mobileMenu.classList.toggle('open');
            });
        }

        if (productGrid) {
            productGrid.addEventListener('click', e => {
                // ... (lógica de clique nos botões de produtos)
            });
        }

        if (cartButton) cartButton.addEventListener('click', () => openModal(cartOverlay, cartPanel));
        if (closeCartBtn) closeCartBtn.addEventListener('click', () => closeModal(cartOverlay, cartPanel));
        if (cartOverlay) cartOverlay.addEventListener('click', () => closeModal(cartOverlay, cartPanel));
        
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
                if (auth && auth.currentUser) {
                    window.location.href = '/checkout.html';
                } else {
                    alert("Por favor, faça login para continuar.");
                    closeModal(cartOverlay, cartPanel);
                    openModal(authModalOverlay, authModal);
                }
            });
        }

        if (loginBtn) loginBtn.addEventListener('click', () => openModal(authModalOverlay, authModal));
        if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', () => closeModal(authModalOverlay, authModal));
        if (authModalOverlay) authModalOverlay.addEventListener('click', () => closeModal(authModalOverlay, authModal));

        if (showRegisterViewBtn) {
            showRegisterViewBtn.addEventListener('click', () => {
                if(customerLoginView && customerRegisterView) {
                    customerLoginView.classList.add('hidden');
                    customerRegisterView.classList.remove('hidden');
                }
            });
        }

        if (showLoginViewBtn) {
            showLoginViewBtn.addEventListener('click', () => {
                if(customerLoginView && customerRegisterView) {
                    customerRegisterView.classList.add('hidden');
                    customerLoginView.classList.remove('hidden');
                }
            });
        }
        
        if (customerLoginForm) {
            customerLoginForm.addEventListener('submit', e => {
                e.preventDefault();
                const email = e.target.elements['login-email'].value;
                const password = e.target.elements['login-password'].value;
                auth.signInWithEmailAndPassword(email, password)
                    .then(() => closeModal(authModalOverlay, authModal))
                    .catch(error => {
                        if(loginFormError) loginFormError.textContent = "Email ou senha inválidos.";
                    });
            });
        }
        
        if (customerRegisterForm) {
            customerRegisterForm.addEventListener('submit', e => {
                e.preventDefault();
                const name = e.target.elements['register-name'].value;
                const email = e.target.elements['register-email'].value;
                const password = e.target.elements['register-password'].value;
                auth.createUserWithEmailAndPassword(email, password)
                    .then(userCredential => {
                        return userCredential.user.updateProfile({ displayName: name });
                    })
                    .then(() => closeModal(authModalOverlay, authModal))
                    .catch(error => {
                        if(registerFormError) registerFormError.textContent = error.message;
                    });
            });
        }

        if (mainLogoutBtn) {
            mainLogoutBtn.addEventListener('click', () => auth.signOut());
        }
    }

    // --- Funções Auxiliares (Ex: Modais) ---
    function openModal(overlay, modal) {
        if (overlay && modal) {
            overlay.classList.add('open');
            modal.classList.add('open');
        }
    }

    function closeModal(overlay, modal) {
        if (overlay && modal) {
            overlay.classList.remove('open');
            modal.classList.remove('open');
        }
    }

    // Inicia a aplicação
    init();
});
