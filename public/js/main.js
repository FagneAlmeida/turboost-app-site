document.addEventListener('DOMContentLoaded', function() {
    // As variáveis 'auth' e 'db' são carregadas a partir de 'firebase-init.js'

    // --- ELEMENTOS DO DOM ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const marcaSelect = document.getElementById('marca-select');
    const modeloSelect = document.getElementById('modelo-select');
    const anoSelect = document.getElementById('ano-select');
    const buscarBtn = document.getElementById('buscar-produtos-btn');
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
    const btnSomOriginal = document.getElementById('btn-som-original');
    const btnSomLenta = document.getElementById('btn-som-lenta');
    const btnSomAcelerando = document.getElementById('btn-som-acelerando');
    const soundButtons = [btnSomOriginal, btnSomLenta, btnSomAcelerando];
    const detailsModalOverlay = document.getElementById('details-modal-overlay');
    const detailsModal = document.getElementById('details-modal');
    const closeDetailsModalBtn = document.getElementById('close-details-modal-btn');
    const modalMainImage = document.getElementById('modal-main-image');
    const modalVideoContainer = document.getElementById('modal-video-container');
    const modalThumbnails = document.getElementById('modal-thumbnails');
    const modalProductTitle = document.getElementById('modal-product-title');
    const modalProductDescription = document.getElementById('modal-product-description');
    const modalProductPrice = document.getElementById('modal-product-price');
    const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModalBtn = document.getElementById('close-auth-modal-btn');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userArea = document.getElementById('user-area');
    const userInfo = document.getElementById('user-info');
    const userGreeting = document.getElementById('user-greeting');
    const customerLoginForm = document.getElementById('customer-login-form');
    const customerRegisterForm = document.getElementById('customer-register-form');
    const loginFormError = document.getElementById('login-form-error');
    const registerFormError = document.getElementById('register-form-error');
    const showRegisterViewBtn = document.getElementById('show-register-view-btn');
    const showLoginViewBtn = document.getElementById('show-login-view-btn');
    const customerLoginView = document.getElementById('customer-login-view');
    const customerRegisterView = document.getElementById('customer-register-view');
    const aboutModal = document.getElementById('about-modal');
    const aboutModalOverlay = document.getElementById('about-modal-overlay');
    const closeAboutModalBtn = document.getElementById('close-about-modal-btn');
    const aboutModalTitle = document.getElementById('about-modal-title');
    const aboutModalContent = document.getElementById('about-modal-content');
    const favicon = document.getElementById('favicon');
    const headerLogo = document.getElementById('header-logo');
    const footerLogo = document.getElementById('footer-logo');
    const socialLinksContainer = document.getElementById('social-links-container');

    // --- VARIÁVEIS DE ESTADO ---
    let allProducts = [];
    let cart = JSON.parse(localStorage.getItem('turboostCart')) || [];
    let siteSettings = {};
    const currentAudio = new Audio();

    // --- LÓGICA DO MODAL "SOBRE NÓS" ---
    const aboutContentData = {
        mission: {
            title: "Nossa Missão",
            text: "Desenvolver e oferecer ponteiras desportivas de alta tecnologia, voltadas para motociclistas apaixonados por velocidade, que buscam alta performance, estilo exclusivo e diversificação de modelos, rompendo com os padrões convencionais do mercado."
        },
        vision: {
            title: "Nossa Visão",
            text: "O nosso objetivo é ser a referência no Brasil como os maiores produtores e fornecedores de ponteiras desportivas, oferecendo a maior diversificação de modelos e garantindo estilo e alta performance para os motociclistas."
        },
        values: {
            title: "Nossos Valores",
            text: `
                <ul class="list-disc list-inside space-y-2">
                    <li><strong>Qualidade Superior:</strong> Comprometemo-nos a produzir ponteiras desportivas de alta qualidade, garantindo durabilidade e desempenho excecionais.</li>
                    <li><strong>Diversidade e Inclusão:</strong> Valorizamos a diversidade na nossa linha de produtos, oferecendo uma ampla gama de modelos e estilos.</li>
                    <li><strong>Inovação Contínua:</strong> Procuramos sempre melhorar e inovar os nossos produtos, integrando as mais recentes tecnologias e designs.</li>
                    <li><strong>Paixão pelo Motociclismo:</strong> Somos apaixonados por motociclismo e isso reflete-se em tudo o que fazemos.</li>
                    <li><strong>Responsabilidade Social:</strong> Comprometemo-nos com a ética e a sustentabilidade nas nossas práticas empresariais.</li>
                </ul>
            `
        }
    };

    function openAboutModal(type) {
        const content = aboutContentData[type];
        if (content) {
            aboutModalTitle.textContent = content.title;
            aboutModalContent.innerHTML = content.text;
            aboutModalOverlay.classList.add('open');
            aboutModal.classList.add('open');
        }
    }

    function closeAboutModal() {
        if(aboutModalOverlay) aboutModalOverlay.classList.remove('open');
        if(aboutModal) aboutModal.classList.remove('open');
    }
    
    // --- LÓGICA DE CARREGAMENTO DE DADOS ---
    async function loadSiteSettings() {
        try {
            const docRef = db.collection('settings').doc('storeConfig');
            const docSnap = await docRef.get();
            if (docSnap.exists) { 
                siteSettings = docSnap.data();
                applySiteSettings();
            }
        } catch (error) {
            console.error("Erro ao carregar configurações do site:", error);
        }
    }

    function applySiteSettings() {
        if (siteSettings.faviconUrl && favicon) {
            favicon.href = siteSettings.faviconUrl;
        }
        if (siteSettings.logoUrl && headerLogo && footerLogo) {
            headerLogo.src = siteSettings.logoUrl;
            footerLogo.src = siteSettings.logoUrl;
        }
        
        if (socialLinksContainer) {
            socialLinksContainer.innerHTML = '';
            if (siteSettings.socialFacebook) {
                socialLinksContainer.innerHTML += `<a href="${siteSettings.socialFacebook}" target="_blank" class="text-gray-400 hover:text-accent transition-colors"><svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33V22C18.343 21.128 22 16.991 22 12z" clip-rule="evenodd" /></svg></a>`;
            }
            if (siteSettings.socialInstagram) {
                socialLinksContainer.innerHTML += `<a href="${siteSettings.socialInstagram}" target="_blank" class="text-gray-400 hover:text-accent transition-colors"><svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.024.06 1.378.06 3.808s-.012 2.784-.06 3.808c-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.024.048-1.378.06-3.808.06s-2.784-.013-3.808-.06c-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.048-1.024-.06-1.378-.06-3.808s.012-2.784.06-3.808c.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 016.08 2.525c.636-.247 1.363.416 2.427.465C9.53 2.013 9.884 2 12.315 2zM12 0C9.58 0 9.22.01 8.207.058c-1.07.05-1.874.227-2.547.487a6.987 6.987 0 00-2.927 1.83c-1.148 1.148-1.64 2.34-1.83 2.927-.26.673-.437 1.477-.487 2.547C.01 9.22 0 9.58 0 12s.01 2.78.058 3.793c.05 1.07.227 1.874.487 2.547a6.987 6.987 0 001.83 2.927c1.148 1.148 2.34 1.64 2.927 1.83.673.26 1.477.437 2.547.487C9.22 23.99 9.58 24 12 24s2.78-.01 3.793-.058c1.07-.05 1.874-.227 2.547-.487a6.987 6.987 0 002.927-1.83c1.148 1.148 1.64-2.34 1.83-2.927.26-.673-.437-1.477-.487-2.547C23.99 14.78 24 14.42 24 12s-.01-2.78-.058-3.793c-.05-1.07-.227-1.874-.487-2.547a6.987 6.987 0 00-1.83-2.927c-1.148-1.148-2.34-1.64-2.927-1.83-.673-.26-1.477-.437-2.547-.487C14.78.01 14.42 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z" clip-rule="evenodd" /></svg></a>`;
            }
            if (siteSettings.socialYoutube) {
                socialLinksContainer.innerHTML += `<a href="${siteSettings.socialYoutube}" target="_blank" class="text-gray-400 hover:text-accent transition-colors"><svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M19.812 5.412a2.413 2.413 0 00-1.707-1.707C16.545 3.25 12 3.25 12 3.25s-4.545 0-6.105.455a2.413 2.413 0 00-1.707 1.707C3.75 7.012 3.75 12 3.75 12s0 4.988.44 6.588a2.413 2.413 0 001.707 1.707C7.455 20.75 12 20.75 12 20.75s4.545 0 6.105-.455a2.413 2.413 0 001.707-1.707c.44-1.6.44-6.588.44-6.588s0-4.988-.44-6.588zM9.75 15.375V8.625l5.625 3.375-5.625 3.375z" clip-rule="evenodd" /></svg></a>`;
            }
        }
    }

    async function carregarProdutos() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            allProducts = await response.json();
            popularFiltros();
            const featuredProducts = allProducts.filter(p => p.isFeatured);
            vitrineTitulo.innerHTML = `Os nossos <span class="text-accent">Destaques</span>`;
            popularVitrine(featuredProducts.length > 0 ? featuredProducts : allProducts.slice(0, 8));
        } catch (error) {
            console.error("Falha ao carregar produtos:", error);
            if(productGrid) productGrid.innerHTML = "<p class='text-center text-red-500 col-span-full'>Não foi possível carregar os produtos. Tente novamente mais tarde.</p>";
        }
    }

    // (O resto do seu código main.js continua aqui, como a lógica de autenticação, carrinho, filtros, etc.)
    // ...
    function popularVitrine(products) {
        if(!productGrid) return;
        productGrid.innerHTML = '';
        if (products.length === 0) {
            productGrid.innerHTML = "<p class='text-center text-gray-400 col-span-full'>Nenhum produto encontrado.</p>";
            return;
        }
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <img src="${product.imagemURL1 || 'https://placehold.co/600x400/1a1a1a/FFC700?text=Imagem+Indisponível'}" alt="${product.nomeProduto}" class="w-full h-56 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x400/1a1a1a/FFC700?text=Imagem+Indisponível';">
                <div class="p-6 flex-grow flex flex-col">
                    <h3 class="font-anton text-2xl text-white">${product.nomeProduto}</h3>
                    <p class="text-gray-400 my-3 flex-grow">${product.descricao.substring(0, 100)}...</p>
                    <span class="text-3xl font-bold text-accent my-3">R$ ${product.preco.toFixed(2).replace('.', ',')}</span>
                    <div class="mt-auto pt-4 border-t border-gray-700 flex gap-4">
                        <button class="btn btn-outline w-full view-details-btn" data-id="${product.id}">Ver Detalhes</button>
                        <button class="btn btn-accent w-full add-to-cart-btn" data-id="${product.id}">Adicionar</button>
                    </div>
                </div>
            `;
            productGrid.appendChild(card);
        });

        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', handleAddToCart);
        });
        document.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                const product = allProducts.find(p => p.id === productId);
                if (product) openDetailsModal(product);
            });
        });
    }
    
    // --- LÓGICA DE AUTENTICAÇÃO DO CLIENTE ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            const userProfileRef = db.collection('clientProfiles').doc(user.uid);
            const doc = await userProfileRef.get();
            const userName = doc.exists ? doc.data().name.split(' ')[0] : 'Utilizador';
            
            userGreeting.textContent = `Olá, ${userName}`;
            userArea.classList.add('hidden');
            userInfo.classList.remove('hidden');
            userInfo.classList.add('flex');
            closeAuthModal();
        } else {
            userArea.classList.remove('hidden');
            userInfo.classList.add('hidden');
            userInfo.classList.remove('flex');
        }
    });

    function openAuthModal() {
        authModalOverlay.classList.add('open');
        authModal.classList.add('open');
    }

    function closeAuthModal() {
        authModalOverlay.classList.remove('open');
        authModal.classList.remove('open');
    }

    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    function setupEventListeners() {
        // ... (outros event listeners)
        document.querySelectorAll('.read-more-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.about;
                openAboutModal(type);
            });
        });
        if(closeAboutModalBtn) closeAboutModalBtn.addEventListener('click', closeAboutModal);
        if(aboutModalOverlay) aboutModalOverlay.addEventListener('click', closeAboutModal);
        
        // (O resto dos seus event listeners)
        // ...
    }

    function init() {
        // ... (resto da sua função init)
        setupEventListeners();
        carregarProdutos();
        loadSiteSettings();
        // ...
    }

    init();
});
