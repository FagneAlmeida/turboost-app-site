document.addEventListener('DOMContentLoaded', function() {
    // --- ELEMENTOS DO DOM ---
    const customerInfoDisplay = document.getElementById('customer-info-display');
    const customerNameEl = document.getElementById('customer-name');
    const customerEmailEl = document.getElementById('customer-email');
    
    const cepInput = document.getElementById('cep');
    const ruaInput = document.getElementById('rua');
    const numeroInput = document.getElementById('numero');
    const complementoInput = document.getElementById('complemento');
    const bairroInput = document.getElementById('bairro');
    const cidadeInput = document.getElementById('cidade');

    const shippingOptionsContainer = document.getElementById('shipping-options');
    const shippingLoader = document.getElementById('shipping-loader');
    const shippingError = document.getElementById('shipping-error');

    const orderSummaryItems = document.getElementById('order-summary-items');
    const summarySubtotal = document.getElementById('summary-subtotal');
    const summaryShipping = document.getElementById('summary-shipping');
    const summaryTotal = document.getElementById('summary-total');
    
    const paymentBtn = document.getElementById('payment-btn');

    // --- ESTADO DA APLICAÇÃO ---
    let cart = JSON.parse(localStorage.getItem('turboostCart')) || [];
    let selectedShipping = null;

    // --- FUNÇÕES ---

    /**
     * Renderiza os itens do carrinho no resumo do pedido.
     */
    function renderOrderSummary() {
        if (cart.length === 0) {
            orderSummaryItems.innerHTML = '<p class="text-gray-500">O seu carrinho está vazio.</p>';
            return;
        }
        
        orderSummaryItems.innerHTML = '';
        cart.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'flex justify-between items-center text-sm';
            itemEl.innerHTML = `
                <div>
                    <p class="font-semibold text-gray-800">${item.nomeProduto} (x${item.quantity})</p>
                    <p class="text-gray-500">${item.marca} ${item.modelo}</p>
                </div>
                <span class="font-medium text-gray-900">R$ ${(item.preco * item.quantity).toFixed(2).replace('.', ',')}</span>
            `;
            orderSummaryItems.appendChild(itemEl);
        });
        updateTotals();
    }

    /**
     * Atualiza os totais (subtotal, frete e total).
     */
    function updateTotals() {
        const subtotal = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
        const shippingCost = selectedShipping ? parseFloat(selectedShipping.Valor.replace(',', '.')) : 0;
        const total = subtotal + shippingCost;

        summarySubtotal.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        summaryShipping.textContent = selectedShipping ? `R$ ${shippingCost.toFixed(2).replace('.', ',')}` : '--';
        summaryTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        
        // Habilita o botão de pagamento apenas se um frete for selecionado
        paymentBtn.disabled = !selectedShipping;
    }
    
    /**
     * Busca as opções de frete com base no CEP.
     */
    async function fetchShippingOptions(cep) {
        shippingOptionsContainer.innerHTML = '';
        shippingLoader.classList.remove('hidden');
        shippingError.classList.add('hidden');
        selectedShipping = null;
        updateTotals();
        
        try {
            // Nota: Esta é uma chamada de API simulada. Substitua pela sua chamada real.
            const response = await fetch('/api/shipping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cep: cep, items: cart })
            });
            if (!response.ok) {
                throw new Error('Não foi possível calcular o frete.');
            }
            const shippingRates = await response.json();

            shippingLoader.classList.add('hidden');
            
            if (shippingRates.length === 0) {
                 shippingOptionsContainer.innerHTML = '<p class="text-gray-500">Nenhuma opção de frete encontrada para este CEP.</p>';
                 return;
            }

            shippingRates.forEach(rate => {
                const rateEl = document.createElement('div');
                rateEl.className = 'border rounded-md p-4 flex items-center justify-between cursor-pointer hover:border-yellow-500';
                rateEl.innerHTML = `
                    <div>
                        <p class="font-bold text-gray-800">${rate.Codigo === '04510' ? 'PAC' : 'SEDEX'}</p>
                        <p class="text-sm text-gray-500">Prazo de entrega: ${rate.PrazoEntrega} dias</p>
                    </div>
                    <span class="font-bold text-lg text-gray-900">R$ ${rate.Valor}</span>
                `;
                rateEl.addEventListener('click', () => {
                    // Remove a seleção de outros elementos
                    document.querySelectorAll('#shipping-options > div').forEach(el => el.classList.remove('ring-2', 'ring-yellow-500'));
                    // Adiciona a seleção ao elemento clicado
                    rateEl.classList.add('ring-2', 'ring-yellow-500');
                    selectedShipping = rate;
                    updateTotals();
                });
                shippingOptionsContainer.appendChild(rateEl);
            });
        } catch (error) {
            shippingLoader.classList.add('hidden');
            shippingError.textContent = error.message;
            shippingError.classList.remove('hidden');
        }
    }

    /**
     * Busca o endereço através da API ViaCEP.
     */
    async function fetchAddressFromCep(cep) {
        if (cep.length !== 8) return;
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            if (data.erro) {
                cidadeInput.value = 'CEP não encontrado.';
            } else {
                ruaInput.value = data.logradouro || '';
                bairroInput.value = data.bairro || '';
                cidadeInput.value = `${data.localidade} / ${data.uf}` || '';
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
        }
    }
    
    /**
     * Cria a preferência de pagamento no Mercado Pago.
     */
    async function createPaymentPreference() {
        if (!selectedShipping) {
            alert("Por favor, selecione uma opção de frete.");
            return;
        }

        const customerInfo = {
            name: customerNameEl.textContent,
            email: customerEmailEl.textContent
        };

        try {
            const response = await fetch('/api/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cartItems: cart,
                    shippingCost: parseFloat(selectedShipping.Valor.replace(',', '.')),
                    customerInfo: customerInfo
                })
            });

            if (!response.ok) {
                throw new Error("Falha ao criar preferência de pagamento.");
            }
            const preference = await response.json();
            
            // Redireciona para o checkout do Mercado Pago
            window.location.href = preference.init_point;

        } catch (error) {
            console.error("Erro no pagamento:", error);
            alert(error.message);
        }
    }

    // --- EVENT LISTENERS ---
    
    // Dispara a busca de frete e endereço quando o CEP é preenchido
    let cepTimeout = null;
    cepInput.addEventListener('input', () => {
        clearTimeout(cepTimeout);
        const cep = cepInput.value.replace(/\D/g, '');
        if (cep.length === 8) {
            fetchAddressFromCep(cep);
            cepTimeout = setTimeout(() => fetchShippingOptions(cep), 500);
        }
    });
    
    paymentBtn.addEventListener('click', createPaymentPreference);

    // --- INICIALIZAÇÃO ---

    // Verifica se o utilizador está logado
    auth.onAuthStateChanged(user => {
        if (user) {
            // Utilizador está logado
            customerInfoDisplay.classList.remove('hidden');
            customerNameEl.textContent = user.displayName || 'Nome não definido';
            customerEmailEl.textContent = user.email;
        } else {
            // Utilizador não está logado, redireciona para a página principal para fazer login
            alert("Você precisa de fazer login para finalizar a compra.");
            window.location.href = '/'; 
        }
    });

    renderOrderSummary();
});