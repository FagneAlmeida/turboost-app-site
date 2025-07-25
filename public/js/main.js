document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logout-btn');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const contentSections = document.querySelectorAll('.content-section');
    const totalProductsEl = document.getElementById('total-products');
    const productListEl = document.getElementById('product-list');
    const settingsForm = document.getElementById('settings-form');
    const addProductBtn = document.getElementById('add-product-btn');
    const productModalOverlay = document.getElementById('product-modal-overlay');
    const productForm = document.getElementById('product-form');
    const cancelProductBtn = document.getElementById('cancel-product-btn');
    const modalTitle = document.getElementById('modal-title');
    const adminLogo = document.getElementById('admin-logo');

    let allProducts = [];

    // --- FUNÇÕES DE API (Wrapper para Fetch) ---
    const api = {
        get: (endpoint) => fetch(endpoint).then(res => res.json()),
        post: (endpoint, body, isJson = true) => fetch(endpoint, {
            method: 'POST',
            headers: isJson ? { 'Content-Type': 'application/json' } : {},
            body: isJson ? JSON.stringify(body) : body,
        }).then(res => res.json()),
        put: (endpoint, body) => fetch(endpoint, {
            method: 'PUT',
            body: body, // FormData é enviado sem header 'Content-Type'
        }).then(res => res.json()),
        delete: (endpoint) => fetch(endpoint, { method: 'DELETE' }).then(res => res.json()),
    };

    // --- LÓGICA DE AUTENTICAÇÃO ---
    async function checkAdminExists() {
        try {
            const data = await api.get('/api/check-admin');
            if (data.adminExists) {
                loginView.classList.remove('hidden');
                registerView.classList.add('hidden');
            } else {
                loginView.classList.add('hidden');
                registerView.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Erro ao verificar admin:", error);
            loginError.textContent = "Erro de conexão com o servidor. Tente novamente.";
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const username = loginForm.username.value;
        const password = loginForm.password.value;
        const data = await api.post('/login', { username, password });

        if (data.message === 'Login bem-sucedido.') {
            authModalOverlay.classList.add('hidden'); // Esconde o modal de login
            mainContent.classList.remove('hidden'); // Mostra o painel principal
            loadInitialData(); // Carrega os dados do painel
        } else {
            loginError.textContent = data.message || 'Erro desconhecido ao tentar fazer login.';
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';
        const username = registerForm['reg-username'].value;
        const password = registerForm['reg-password'].value;
        const data = await api.post('/api/register', { username, password });

        if (data.message === 'Administrador registado com sucesso.') {
            alert('Administrador registado! Faça login para continuar.');
            checkAdminExists(); // Volta para a tela de login
        } else {
            registerError.textContent = data.message || 'Erro desconhecido ao tentar registar.';
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await api.post('/logout', {});
        window.location.reload(); // Recarrega a página para voltar ao estado de login
    });

    // --- NAVEGAÇÃO DA BARRA LATERAL ---
    sidebarLinks.forEach(link => {
        // Ignora o botão de logout que tem a sua própria lógica
        if (link.id !== 'logout-btn') {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.dataset.section;

                // Atualiza o estado visual dos links
                sidebarLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Mostra apenas a secção de conteúdo correspondente
                contentSections.forEach(s => s.classList.add('hidden'));
                document.getElementById(sectionId).classList.remove('hidden');
            });
        }
    });
    
    // --- CARREGAMENTO DE DADOS INICIAIS ---
    async function loadInitialData() {
        loadProducts();
        loadSettings();
    }

    async function loadProducts() {
        try {
            allProducts = await api.get('/api/products');
            if(totalProductsEl) totalProductsEl.textContent = allProducts.length;
            renderProducts();
        } catch (error) {
            console.error("Erro ao carregar produtos:", error);
            if(productListEl) productListEl.innerHTML = `<p class="text-red-500 col-span-full">Não foi possível carregar os produtos.</p>`;
        }
    }

    async function loadSettings() {
        try {
            const settings = await api.get('/api/settings');
            // Preenche os campos do formulário com os dados guardados
            Object.keys(settings).forEach(key => {
                const input = settingsForm.elements[key];
                if (input) {
                    input.value = settings[key];
                }
            });
            // Mostra as pré-visualizações das imagens
            if (settings.logoUrl) {
                document.getElementById('logo-preview').src = settings.logoUrl;
                document.getElementById('logo-preview').classList.remove('hidden');
                if(adminLogo) adminLogo.src = settings.logoUrl;
            }
            if (settings.faviconUrl) {
                document.getElementById('favicon-preview').src = settings.faviconUrl;
                document.getElementById('favicon-preview').classList.remove('hidden');
            }
        } catch (error) {
            console.error("Erro ao carregar configurações:", error);
        }
    }

    // --- RENDERIZAÇÃO DOS PRODUTOS ---
    function renderProducts() {
        if(!productListEl) return;
        productListEl.innerHTML = '';
        allProducts.forEach(product => {
            const card = document.createElement('div');
            card.className = 'p-4 space-y-3 bg-gray-800 rounded-lg flex flex-col';
            card.innerHTML = `
                <img src="${product.imagemURL1 || 'https://placehold.co/600x400/1a1a1a/FFC700?text=IMG'}" class="object-cover w-full h-40 rounded-md">
                <div class="flex-grow">
                    <h3 class="text-xl font-bold">${product.nomeProduto}</h3>
                    <p class="text-sm text-gray-400">Marca: ${product.marca || 'N/A'}</p>
                    <p class="text-lg font-semibold text-accent">R$ ${product.preco ? Number(product.preco).toFixed(2).replace('.', ',') : '0,00'}</p>
                </div>
                <div class="flex justify-end gap-2 pt-2 mt-auto border-t border-gray-700">
                    <button data-id="${product.id}" class="edit-btn btn btn-outline">Editar</button>
                    <button data-id="${product.id}" class="delete-btn btn btn-danger">Eliminar</button>
                </div>
            `;
            productListEl.appendChild(card);
        });
    }

    // --- MANIPULAÇÃO DE FORMULÁRIOS ---
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        const data = await api.post('/api/settings', formData, false);
        alert(data.message);
        loadSettings(); // Recarrega as configurações para mostrar as novas imagens
    });

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(productForm);
        const productId = formData.get('productId');
        
        try {
            let response;
            if (productId) {
                // Se existe um ID, atualiza o produto existente
                response = await api.put(`/api/products/${productId}`, formData);
            } else {
                // Caso contrário, cria um novo produto
                response = await api.post('/api/products', formData, false);
            }
            alert(response.message);
            if (!response.error) {
                closeProductModal();
                loadProducts(); // Recarrega a lista de produtos
            }
        } catch (error) {
            console.error("Erro ao salvar produto:", error);
            alert("Ocorreu um erro ao salvar o produto.");
        }
    });

    // --- LÓGICA DO MODAL DE PRODUTOS ---
    function openProductModal(product = null) {
        productForm.reset();
        if (product) {
            // Modo de Edição: preenche o formulário com os dados do produto
            modalTitle.textContent = 'Editar Produto';
            Object.keys(product).forEach(key => {
                const input = productForm.elements[key];
                if (input) {
                    if(input.type === 'checkbox') {
                        input.checked = product[key];
                    } else {
                        // Converte o array de anos de volta para uma string
                        input.value = Array.isArray(product[key]) ? product[key].join(', ') : product[key];
                    }
                }
            });
            productForm.elements.productId.value = product.id;
        } else {
            // Modo de Criação: formulário limpo
            modalTitle.textContent = 'Adicionar Novo Produto';
            productForm.elements.productId.value = '';
        }
        productModalOverlay.classList.add('open');
    }

    function closeProductModal() {
        productModalOverlay.classList.remove('open');
    }

    addProductBtn.addEventListener('click', () => openProductModal());
    cancelProductBtn.addEventListener('click', closeProductModal);
    productModalOverlay.addEventListener('click', (e) => {
        // Fecha o modal se o clique for no fundo escuro
        if (e.target === productModalOverlay) closeProductModal();
    });
    
    // --- EVENT LISTENERS PARA AÇÕES (EDITAR/ELIMINAR) ---
    productListEl.addEventListener('click', (e) => {
        const target = e.target.closest('button'); // Garante que apanhamos o botão, mesmo que o clique seja num ícone dentro dele
        if (!target) return;

        const productId = target.dataset.id;

        if (target.classList.contains('edit-btn')) {
            const product = allProducts.find(p => p.id === productId);
            if (product) openProductModal(product);
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('Tem a certeza que quer eliminar este produto? Esta ação é irreversível.')) {
                api.delete(`/api/products/${productId}`).then(data => {
                    alert(data.message);
                    loadProducts();
                });
            }
        }
    });

    // --- INICIALIZAÇÃO ---
    // Verifica se um admin precisa de ser registado ou se o login deve ser mostrado
    checkAdminExists();
});
