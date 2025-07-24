document.addEventListener('DOMContentLoaded', function() {
    // --- VARIÁVEIS E ELEMENTOS GLOBAIS ---
    let allProducts = [];
    let cart = JSON.parse(localStorage.getItem('turboostCart')) || [];

    const productGrid = document.getElementById('product-grid');
    const cartCount = document.getElementById('cart-count');
    const searchInput = document.getElementById('search-input');
    const brandFilter = document.getElementById('brand-filter');
    const modelFilter = document.getElementById('model-filter');
    const yearFilter = document.getElementById('year-filter');


    // --- FUNÇÕES PRINCIPAIS ---

    /**
     * Busca os produtos da API do backend.
     */
    async function fetchProducts() {
        // Mostra um estado de carregamento
        if (productGrid) {
            productGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full">A carregar produtos...</p>';
        }

        try {
            const response = await fetch('/api/products');
            if (!response.ok) {
                throw new Error(`Erro na rede: ${response.statusText}`);
            }
            allProducts = await response.json();
            populateFilters();
            renderProducts(allProducts);
        } catch (error) {
            console.error("Falha ao buscar produtos:", error);
            if (productGrid) {
                productGrid.innerHTML = `<p class="text-center text-red-500 col-span-full">Não foi possível carregar os produtos. Tente novamente mais tarde.</p>`;
            }
        }
    }

    /**
     * Renderiza a lista de produtos na tela.
     * @param {Array} products - A lista de produtos a ser exibida.
     */
    function renderProducts(products) {
        if (!productGrid) return; // Sai se o elemento da grelha não existir

        productGrid.innerHTML = ''; // Limpa a grelha

        if (products.length === 0) {
            productGrid.innerHTML = '<p class="text-center text-gray-500 col-span-full">Nenhum produto encontrado com os filtros selecionados.</p>';
            return;
        }

        products.forEach(product => {
            const price = typeof product.preco === 'number' ? `R$ ${product.preco.toFixed(2).replace('.', ',')}` : 'Preço sob consulta';

            const productCard = document.createElement('div');
            productCard.className = 'product-card bg-secondary rounded-lg overflow-hidden shadow-lg transform transition-transform hover:scale-105';
            productCard.innerHTML = `
                <div class="p-4">
                    <img src="${product.imagemURL1 || 'https://placehold.co/400x300/2c2c2c/FFC700?text=Turboost'}" alt="${product.nomeProduto}" class="w-full h-48 object-cover rounded-md mb-4" onerror="this.onerror=null;this.src='https://placehold.co/400x300/2c2c2c/FFC700?text=Turboost';">
                    <h3 class="text-lg font-bold text-accent mb-2 truncate">${product.nomeProduto}</h3>
                    <p class="text-text-light text-sm mb-1">${product.marca} ${product.modelo}</p>
                    <p class="text-text-light text-sm mb-4">Ano: ${Array.isArray(product.ano) ? product.ano.join(', ') : 'N/A'}</p>
                    <p class="text-2xl font-anton text-white mb-4">${price}</p>
                    <button class="add-to-cart-btn bg-accent text-primary font-bold py-2 px-4 rounded-md w-full hover:bg-yellow-400 transition-colors" data-id="${product.id}">Adicionar ao Carrinho</button>
                </div>
            `;
            productGrid.appendChild(productCard);
        });
    }

    /**
     * Preenche os filtros de Marca, Modelo e Ano com base nos produtos carregados.
     */
    function populateFilters() {
        const brands = [...new Set(allProducts.map(p => p.marca))];
        const models = [...new Set(allProducts.map(p => p.modelo))];
        const years = [...new Set(allProducts.flatMap(p => p.ano))].sort((a, b) => b - a);

        // Limpa e preenche o filtro de Marcas
        brandFilter.innerHTML = '<option value="">Todas as Marcas</option>';
        brands.forEach(brand => {
            if(brand) brandFilter.innerHTML += `<option value="${brand}">${brand}</option>`;
        });
        
        // Limpa e preenche o filtro de Modelos
        modelFilter.innerHTML = '<option value="">Todos os Modelos</option>';
        models.forEach(model => {
            if(model) modelFilter.innerHTML += `<option value="${model}">${model}</option>`;
        });

        // Limpa e preenche o filtro de Anos
        yearFilter.innerHTML = '<option value="">Todos os Anos</option>';
        years.forEach(year => {
            if(year) yearFilter.innerHTML += `<option value="${year}">${year}</option>`;
        });
    }

    /**
     * Filtra os produtos com base nos valores selecionados nos filtros e na pesquisa.
     */
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedBrand = brandFilter.value;
        const selectedModel = modelFilter.value;
        const selectedYear = yearFilter.value;

        const filteredProducts = allProducts.filter(product => {
            const matchesSearch = product.nomeProduto.toLowerCase().includes(searchTerm) || product.marca.toLowerCase().includes(searchTerm) || product.modelo.toLowerCase().includes(searchTerm);
            const matchesBrand = !selectedBrand || product.marca === selectedBrand;
            const matchesModel = !selectedModel || product.modelo === selectedModel;
            const matchesYear = !selectedYear || (Array.isArray(product.ano) && product.ano.includes(parseInt(selectedYear)));

            return matchesSearch && matchesBrand && matchesModel && matchesYear;
        });

        renderProducts(filteredProducts);
    }
    
    /**
     * Adiciona um produto ao carrinho e atualiza o armazenamento local.
     */
    function addToCart(productId) {
        const productToAdd = allProducts.find(p => p.id === productId);
        if (!productToAdd) return;

        const existingItem = cart.find(item => item.id === productId);

        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ ...productToAdd, quantity: 1 });
        }
        
        updateCart();
        alert(`${productToAdd.nomeProduto} foi adicionado ao carrinho!`);
    }

    /**
     * Atualiza o contador do carrinho e o localStorage.
     */
    function updateCart() {
        localStorage.setItem('turboostCart', JSON.stringify(cart));
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        if (cartCount) {
             cartCount.textContent = totalItems;
             cartCount.classList.toggle('hidden', totalItems === 0);
        }
    }


    // --- EVENT LISTENERS ---
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (brandFilter) brandFilter.addEventListener('change', applyFilters);
    if (modelFilter) modelFilter.addEventListener('change', applyFilters);
    if (yearFilter) yearFilter.addEventListener('change', applyFilters);

    if (productGrid) {
        productGrid.addEventListener('click', function(e) {
            if (e.target.classList.contains('add-to-cart-btn')) {
                const productId = e.target.dataset.id;
                addToCart(productId);
            }
        });
    }
    
    // --- INICIALIZAÇÃO ---
    fetchProducts();
    updateCart(); // Atualiza o contador do carrinho ao carregar a página
});