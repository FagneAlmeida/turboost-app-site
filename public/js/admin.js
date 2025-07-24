document.addEventListener('DOMContentLoaded', function() {
    // Adiciona referências para os novos elementos de modal e toast
    const confirmModal = document.getElementById('confirm-modal');
    const confirmModalTitle = document.getElementById('confirm-modal-title');
    const confirmModalText = document.getElementById('confirm-modal-text');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // --- ELEMENTOS DO DOM (existentes) ---
    const authOverlay = document.getElementById('auth-overlay');
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const adminArea = document.getElementById('admin-area');
    const logoutBtn = document.getElementById('logout-btn');
    const productList = document.getElementById('product-list');
    const addProductBtn = document.getElementById('add-product-btn');
    const productModal = document.getElementById('product-modal');
    const modalTitle = document.getElementById('modal-title');
    const productForm = document.getElementById('product-form');
    const cancelBtn = document.getElementById('cancel-btn');
    const tabProducts = document.getElementById('tab-products');
    const tabSettings = document.getElementById('tab-settings');
    const productsView = document.getElementById('products-view');
    const settingsView = document.getElementById('settings-view');
    const settingsForm = document.getElementById('settings-form');
    
    // Elementos de configuração
    const logoFileInput = document.getElementById('logoFile');
    const faviconFileInput = document.getElementById('faviconFile');
    const previewLogo = document.getElementById('preview-logo');
    const previewFavicon = document.getElementById('preview-favicon');
    const originCepInput = document.getElementById('originCep');
    const companyStreetInput = document.getElementById('companyStreet');
    const companyNumberInput = document.getElementById('companyNumber');
    const companyComplementInput = document.getElementById('companyComplement');
    const companyNeighborhoodInput = document.getElementById('companyNeighborhood');
    const companyCityStateInput = document.getElementById('companyCityState');
    const socialFacebookInput = document.getElementById('socialFacebook');
    const socialInstagramInput = document.getElementById('socialInstagram');
    const socialYoutubeInput = document.getElementById('socialYoutube');

    let productsData = [];

    // --- LÓGICA DE NOTIFICAÇÃO (NOVO) ---
    function showToast(message, isError = false) {
        toastMessage.textContent = message;
        toast.style.backgroundColor = isError ? '#E53935' : '#1a1a1a'; // Vermelho para erro, preto para sucesso
        toast.classList.remove('translate-x-[150%]');
        setTimeout(() => {
            toast.classList.add('translate-x-[150%]');
        }, 3000); // O toast desaparece após 3 segundos
    }

    // --- LÓGICA DO MODAL DE CONFIRMAÇÃO (NOVO) ---
    function showConfirmModal(title, text, onConfirm) {
        confirmModalTitle.textContent = title;
        confirmModalText.textContent = text;
        
        confirmModal.classList.remove('hidden');
        setTimeout(() => confirmModal.classList.remove('opacity-0'), 10);

        // Limpa ouvintes de eventos antigos para evitar múltiplas execuções
        const newConfirmOkBtn = confirmOkBtn.cloneNode(true);
        confirmOkBtn.parentNode.replaceChild(newConfirmOkBtn, confirmOkBtn);
        
        newConfirmOkBtn.addEventListener('click', () => {
            onConfirm();
            hideConfirmModal();
        });

        confirmCancelBtn.onclick = hideConfirmModal;
    }

    function hideConfirmModal() {
        confirmModal.classList.add('opacity-0');
        setTimeout(() => confirmModal.classList.add('hidden'), 300);
    }


    // --- LÓGICA DAS ABAS ---
    function switchView(viewToShow) {
        productsView.classList.add('hidden');
        settingsView.classList.add('hidden');
        tabProducts.classList.remove('active');
        tabSettings.classList.remove('active');

        if (viewToShow === 'products') {
            productsView.classList.remove('hidden');
            tabProducts.classList.add('active');
        } else {
            settingsView.classList.remove('hidden');
            tabSettings.classList.add('active');
        }
    }

    tabProducts.addEventListener('click', () => switchView('products'));
    tabSettings.addEventListener('click', () => switchView('settings'));

    // --- LÓGICA DAS CONFIGURAÇÕES ---
    async function loadSettings() {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                const settings = await response.json();
                
                if (settings.logoUrl) {
                    previewLogo.src = settings.logoUrl;
                    previewLogo.classList.remove('hidden');
                }
                if (settings.faviconUrl) {
                    previewFavicon.src = settings.faviconUrl;
                    previewFavicon.classList.remove('hidden');
                }

                originCepInput.value = settings.originCep || '';
                companyStreetInput.value = settings.companyStreet || '';
                companyNumberInput.value = settings.companyNumber || '';
                companyComplementInput.value = settings.companyComplement || '';
                companyNeighborhoodInput.value = settings.companyNeighborhood || '';
                companyCityStateInput.value = settings.companyCityState || '';
                socialFacebookInput.value = settings.socialFacebook || '';
                socialInstagramInput.value = settings.socialInstagram || '';
                socialYoutubeInput.value = settings.socialYoutube || '';
            } else if (response.status !== 404) {
                throw new Error('Falha ao carregar configurações.');
            }
        } catch (error) {
            console.error("Erro ao carregar configurações:", error);
            showToast("Erro ao carregar configurações: " + error.message, true);
        }
    }

    let cepTimeout = null;
    originCepInput.addEventListener('input', () => {
        clearTimeout(cepTimeout);
        const cep = originCepInput.value.replace(/\D/g, '');
        if (cep.length === 8) {
            cepTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await response.json();
                    if (data.erro) {
                        companyCityStateInput.value = 'CEP não encontrado.';
                    } else {
                        companyStreetInput.value = data.logradouro || '';
                        companyNeighborhoodInput.value = data.bairro || '';
                        companyCityStateInput.value = `${data.localidade} / ${data.uf}` || '';
                    }
                } catch (error) {
                    console.error("Erro ao buscar CEP:", error);
                }
            }, 500);
        }
    });

    settingsForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                showToast('Configurações salvas com sucesso!');
                await loadSettings();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao salvar configurações.');
            }
        } catch (error) {
            showToast(error.message, true);
        }
    });

    // --- LÓGICA DE AUTENTICAÇÃO ---
    async function initializeAuthForm() {
        try {
            const response = await fetch('/api/check-admin');
            const data = await response.json();
            const containerToShow = data.adminExists ? loginContainer : registerContainer;
            
            containerToShow.classList.remove('hidden');
            setTimeout(() => {
                 containerToShow.classList.remove('opacity-0', '-translate-y-5');
            }, 10);

        } catch (error) {
            loginContainer.classList.remove('hidden', 'opacity-0', '-translate-y-5');
            loginError.textContent = 'Erro ao conectar ao servidor.';
        }
    }
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        loginError.textContent = '';
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();
            if (response.ok) {
                authOverlay.classList.add('hidden');
                adminArea.classList.remove('hidden');
                await initializeAdminPanel();
            } else {
                loginError.textContent = result.message;
            }
        } catch (err) {
            loginError.textContent = 'Erro de conexão com o servidor.';
        }
    });

    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        registerError.textContent = '';
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();
            if (response.ok) {
                showToast('Administrador registado com sucesso! Faça o login.');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                registerError.textContent = result.message;
            }
        } catch (err) {
            registerError.textContent = 'Erro de conexão com o servidor.';
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await fetch('/logout', { method: 'POST' });
        window.location.reload();
    });
    
    // --- LÓGICA DE PRODUTOS ---
    function renderProductList() {
        productList.innerHTML = '';
        if (productsData.length === 0) {
            productList.innerHTML = `<p class="text-center text-gray-500 p-4">Nenhum produto registado ainda.</p>`;
            return;
        }
        productsData.forEach(product => {
            const price = typeof product.preco === 'number' ? product.preco.toFixed(2) : 'N/A';
            const productElement = document.createElement('div');
            productElement.className = 'flex items-center justify-between p-3 border-b hover:bg-gray-50';
            productElement.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="${product.imagemURL1 || 'https://placehold.co/100x100/ccc/333?text=Img'}" alt="${product.nomeProduto}" class="w-16 h-16 object-cover rounded-md" onerror="this.onerror=null;this.src='https://placehold.co/100x100/ccc/333?text=Img';">
                    <div>
                        <p class="font-semibold">${product.nomeProduto} ${product.isFeatured ? '<span class="text-xs bg-yellow-400 text-yellow-800 font-bold px-2 py-1 rounded-full">Destaque</span>' : ''}</p>
                        <p class="text-sm text-gray-600">${product.marca} ${product.modelo} - R$ ${price}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="edit-btn text-sm bg-blue-500 text-white py-1 px-3 rounded-md hover:bg-blue-600" data-id="${product.id}">Editar</button>
                    <button class="delete-btn text-sm bg-red-500 text-white py-1 px-3 rounded-md hover:bg-red-600" data-id="${product.id}">Eliminar</button>
                </div>
            `;
            productList.appendChild(productElement);
        });
        document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEdit));
        document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
    }

    async function loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao buscar produtos.');
            }
            productsData = await response.json();
            renderProductList();
        } catch (error) {
            console.error('Erro:', error);
            productList.innerHTML = `<p class="text-red-500 text-center">${error.message}</p>`;
        }
    }

    function openModal(product = null) {
        productForm.reset();
        document.getElementById('product-id').value = '';
        if (product) {
            modalTitle.textContent = 'Editar Produto';
            document.getElementById('product-id').value = product.id;
            document.getElementById('marca').value = product.marca || '';
            document.getElementById('modelo').value = product.modelo || '';
            document.getElementById('ano').value = Array.isArray(product.ano) ? product.ano.join(', ') : '';
            document.getElementById('nomeProduto').value = product.nomeProduto || '';
            document.getElementById('descricao').value = product.descricao || '';
            document.getElementById('preco').value = product.preco || '';
            document.getElementById('videoURL').value = product.videoURL || '';
            document.getElementById('peso').value = product.peso || '';
            document.getElementById('comprimento').value = product.comprimento || '';
            document.getElementById('altura').value = product.altura || '';
            document.getElementById('largura').value = product.largura || '';
            document.getElementById('isFeatured').checked = product.isFeatured || false;
        } else {
            modalTitle.textContent = 'Adicionar Novo Produto';
        }
        productModal.classList.remove('hidden');
        setTimeout(() => {
            productModal.classList.remove('opacity-0');
            productModal.querySelector('.modal-content').classList.remove('-translate-y-10');
        }, 10);
    }

    function closeModal() {
        productModal.classList.add('opacity-0');
        productModal.querySelector('.modal-content').classList.add('-translate-y-10');
        setTimeout(() => productModal.classList.add('hidden'), 300);
    }

    function handleEdit(e) {
        const id = e.target.dataset.id;
        const product = productsData.find(p => p.id === id);
        openModal(product);
    }

    async function handleDelete(e) {
        const id = e.target.dataset.id;
        showConfirmModal(
            'Eliminar Produto', 
            'Tem a certeza de que deseja eliminar este produto? Esta ação não pode ser desfeita.',
            async () => {
                try {
                    const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                    if (!response.ok) {
                         const err = await response.json();
                         throw new Error(err.message || 'Falha ao eliminar.');
                    }
                    showToast('Produto eliminado com sucesso.');
                    await loadProducts();
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        );
    }

    addProductBtn.addEventListener('click', () => openModal());
    cancelBtn.addEventListener('click', closeModal);

    productForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const id = document.getElementById('product-id').value;
        const formData = new FormData(this);
        
        if (!formData.has('isFeatured')) {
            formData.append('isFeatured', 'off');
        }

        const url = id ? `/api/products/${id}` : '/api/products';
        const method = id ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                body: formData,
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Ocorreu um erro no servidor.');
            }
            
            showToast('Produto salvo com sucesso.');
            closeModal();
            await loadProducts();

        } catch (error) {
            showToast(`Erro ao salvar: ${error.message}`, true);
        }
    });

    // --- INICIALIZAÇÃO ---
    async function initializeAdminPanel() {
        await loadProducts();
        await loadSettings();
    }
    
    initializeAuthForm();
});