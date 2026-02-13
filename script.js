/* =========================================
   Configuracoes e estado
   ========================================= */
const STORAGE_CLIENTES = 'cobrancas_2026';
const STORAGE_SALDO = 'cofrinho_saldo';
const STORAGE_HISTORICO = 'cofrinho_historico';
const STORAGE_POUPANCA = 'poupanca_saldo';
const STORAGE_HIST_POUPANCA = 'poupanca_historico';
const STORAGE_SIDEBAR_RETORNO_FECHADA = 'sidebar_retorno_fechada';

const DURACAO_TRANSICAO_TEMA = 420;

const Common = window.FinCommon;
if (!Common) {
    throw new Error('common.js nao foi carregado antes de script.js');
}

const {
    NOMES_MESES: nomesMeses,
    getEl,
    formatarMoeda,
    parseValorInput,
    formatarDataBr,
    getDataLocal: getVencimentoDate,
    escapeHtml,
    limitarHistorico,
    baixarJson
} = Common;

let cobrancas = JSON.parse(localStorage.getItem(STORAGE_CLIENTES)) || [];
let saldoCarteira = Number(localStorage.getItem(STORAGE_SALDO)) || 0;
let historicoCarteira = JSON.parse(localStorage.getItem(STORAGE_HISTORICO)) || [];
let saldoPoupanca = Number(localStorage.getItem(STORAGE_POUPANCA)) || 0;
let historicoPoupanca = JSON.parse(localStorage.getItem(STORAGE_HIST_POUPANCA)) || [];

let abaAtiva = 'atrasados';
let mesAtivo = new Date().getMonth();
let temaTransicaoTimer = null;
let buscaDebounceTimer = null;

limitarHistorico(historicoCarteira);
limitarHistorico(historicoPoupanca);

/* =========================================
   Persistencia
   ========================================= */
function salvarCobrancas() {
    localStorage.setItem(STORAGE_CLIENTES, JSON.stringify(cobrancas));
}

function salvarCarteira() {
    localStorage.setItem(STORAGE_SALDO, String(saldoCarteira));
    localStorage.setItem(STORAGE_HISTORICO, JSON.stringify(historicoCarteira));
}

function salvarPoupanca() {
    localStorage.setItem(STORAGE_POUPANCA, String(saldoPoupanca));
    localStorage.setItem(STORAGE_HIST_POUPANCA, JSON.stringify(historicoPoupanca));
}

/* =========================================
   Navegacao UI
   ========================================= */
function toggleSidebar() {
    const appWrapper = getEl('app-wrapper');
    if (appWrapper) appWrapper.classList.toggle('sidebar-closed');
}

function fecharSidebarMobile() {
    if (window.innerWidth <= 768) {
        const appWrapper = getEl('app-wrapper');
        if (appWrapper) appWrapper.classList.add('sidebar-closed');
    }
}

function aplicarEstadoInicialSidebar() {
    const appWrapper = getEl('app-wrapper');
    if (!appWrapper) return;

    if (localStorage.getItem(STORAGE_SIDEBAR_RETORNO_FECHADA) === '1') {
        appWrapper.classList.add('sidebar-closed');
        localStorage.removeItem(STORAGE_SIDEBAR_RETORNO_FECHADA);
    }
}

function voltarComSidebarFechada(destino = 'index.html') {
    localStorage.setItem(STORAGE_SIDEBAR_RETORNO_FECHADA, '1');
    window.location.href = destino;
}

function configurarGestosSidebarMobile() {
    const appWrapper = getEl('app-wrapper');
    const sidebar = getEl('sidebar');
    if (!appWrapper || !sidebar) return;

    const LIMIAR_BORDA = 28;
    const LIMIAR_SWIPE = 64;
    const RAZAO_HORIZONTAL = 1.15;

    let inicioX = 0;
    let inicioY = 0;
    let rastreando = false;
    let origemBorda = false;
    let origemSidebar = false;

    const resetarGestos = () => {
        rastreando = false;
        origemBorda = false;
        origemSidebar = false;
    };

    const aoToqueIniciar = event => {
        if (window.innerWidth > 768) return;
        const toque = event.touches?.[0];
        if (!toque) return;

        inicioX = toque.clientX;
        inicioY = toque.clientY;
        rastreando = true;

        const sidebarFechada = appWrapper.classList.contains('sidebar-closed');
        origemBorda = sidebarFechada && inicioX <= LIMIAR_BORDA;

        const alvo = event.target;
        const limiteSidebar = sidebar.getBoundingClientRect().right + 8;
        origemSidebar = !sidebarFechada && (sidebar.contains(alvo) || inicioX <= limiteSidebar);
    };

    const aoToqueFinalizar = event => {
        if (!rastreando || window.innerWidth > 768) {
            resetarGestos();
            return;
        }

        const toque = event.changedTouches?.[0];
        if (!toque) {
            resetarGestos();
            return;
        }

        const deltaX = toque.clientX - inicioX;
        const deltaY = toque.clientY - inicioY;
        const gestoHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * RAZAO_HORIZONTAL;

        if (gestoHorizontal) {
            if (origemBorda && deltaX >= LIMIAR_SWIPE && appWrapper.classList.contains('sidebar-closed')) {
                appWrapper.classList.remove('sidebar-closed');
            } else if (origemSidebar && deltaX <= -LIMIAR_SWIPE && !appWrapper.classList.contains('sidebar-closed')) {
                appWrapper.classList.add('sidebar-closed');
            }
        }

        resetarGestos();
    };

    document.addEventListener('touchstart', aoToqueIniciar, { passive: true });
    document.addEventListener('touchend', aoToqueFinalizar, { passive: true });
    document.addEventListener('touchcancel', resetarGestos, { passive: true });
}

function toggleFormCadastro() {
    const modal = getEl('container-cadastro');
    if (!modal) return;
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

/* =========================================
   Dashboard de cobrancas
   ========================================= */
function adicionarCobranca() {
    const nomeEl = getEl('nome');
    const valorEl = getEl('valor');
    const dataEl = getEl('data');
    const repetirEl = getEl('repetir');
    const telefoneEl = getEl('telefone');

    if (!nomeEl || !valorEl || !dataEl || !repetirEl || !telefoneEl) return;

    const nome = nomeEl.value.trim();
    const valor = Number(valorEl.value);
    const data = dataEl.value;
    const repetir = Math.max(1, parseInt(repetirEl.value, 10) || 1);
    const telefone = telefoneEl.value.trim();

    if (!nome || !Number.isFinite(valor) || valor <= 0 || !data) {
        alert('Preencha todos os campos.');
        return;
    }

    const idBase = Date.now() * 1000;
    for (let i = 0; i < repetir; i++) {
        const vencimento = getVencimentoDate(data);
        vencimento.setDate(vencimento.getDate() + (i * 7));

        cobrancas.push({
            id: idBase + i,
            nome: repetir > 1 ? `${nome} (${i + 1}/${repetir})` : nome,
            telefone,
            valor: valor.toFixed(2),
            pagoParcial: '0.00',
            data: vencimento.toISOString().split('T')[0],
            pago: false
        });
    }

    toggleFormCadastro();
    atualizarTudo();
}

function togglePago(id) {
    const index = cobrancas.findIndex(c => c.id === id);
    if (index === -1) return;

    const cliente = cobrancas[index];
    const valorTotal = Number(cliente.valor) || 0;
    const valorJaPago = Number(cliente.pagoParcial) || 0;

    if (!cliente.pago) {
        const valorAReceber = valorTotal - valorJaPago;
        if (valorAReceber > 0) {
            cliente.pago = true;
            cliente.pagoParcial = cliente.valor;
            registrarTransacaoCarteira('entrada', valorAReceber, `Recebido: ${cliente.nome}`);
        }
    } else {
        if (valorJaPago > 0) {
            registrarTransacaoCarteira('saida', valorJaPago, `Estorno: ${cliente.nome}`);
            alert(`Estorno realizado: ${formatarMoeda(valorJaPago)} removido da carteira.`);
        }
        cliente.pago = false;
        cliente.pagoParcial = '0.00';
    }

    cobrancas[index] = cliente;
    atualizarTudo();
}

function registrarTransacaoCarteira(tipo, valor, descricao) {
    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return;

    if (tipo === 'entrada') saldoCarteira += valorNumerico;
    else saldoCarteira -= valorNumerico;

    historicoCarteira.unshift({
        tipo: tipo === 'entrada' ? 'depositar' : 'sacar',
        valor: valorNumerico,
        descricao,
        data: new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    });

    limitarHistorico(historicoCarteira);
    salvarCarteira();
    atualizarInterfaceEconomias();
}

function criarItemHTML(cliente, hoje) {
    const valorTotal = Number(cliente.valor) || 0;
    const valorPago = Number(cliente.pagoParcial) || 0;
    const valorFaltante = Math.max(0, valorTotal - valorPago);
    const dataVencimento = getVencimentoDate(cliente.data);
    const progresso = valorTotal > 0 ? Math.min(100, (valorPago / valorTotal) * 100) : 0;
    const classe = cliente.pago ? 'pago-row' : (dataVencimento < hoje ? 'atrasado-row' : 'pendente-row');

    return `
        <div class="${classe}" style="padding:15px; border-bottom:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${escapeHtml(cliente.nome)}</strong>
                    <br>
                    <small>${escapeHtml(formatarDataBr(cliente.data))}</small>
                </div>
                <div class="acoes">
                    <button class="btn-proximo" onclick="copiarProximo(${cliente.id})">⏭️</button>
                    <button onclick="abrirMenuWhats(${cliente.id})" class="btn-whatsapp"><i class="fab fa-whatsapp">📲</i></button>
                    <button class="btn-editar" onclick="abrirEdicao(${cliente.id})">✏️</button>
                    <button class="btn-pagar" onclick="togglePago(${cliente.id})">${cliente.pago ? '↩️' : '✅'}</button>
                    <button class="btn-excluir" onclick="excluir(${cliente.id})">🗑️</button>
                </div>
            </div>
            <div class="progress-container"><div class="progress-bar" style="width:${progresso}%"></div></div>
            <div class="info-valores">
                <span style="color:var(--success)">Pago: ${formatarMoeda(valorPago)}</span>
                <span style="color:var(--danger)">Falta: ${formatarMoeda(valorFaltante)}</span>
                <span style="color:var(--text-muted)">Total: ${formatarMoeda(valorTotal)}</span>
            </div>
        </div>
    `;
}

function renderizarLista() {
    const lista = getEl('listaPrincipal');
    if (!lista) return;

    const buscaEl = getEl('buscaNome');
    const termoBusca = (buscaEl?.value || '').toLowerCase().trim();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const filtrados = cobrancas.filter(cliente => {
        if (termoBusca) return cliente.nome.toLowerCase().includes(termoBusca);

        const dataVencimento = getVencimentoDate(cliente.data);
        if (dataVencimento.getMonth() !== mesAtivo) return false;

        if (abaAtiva === 'atrasados') return !cliente.pago && dataVencimento < hoje;
        if (abaAtiva === 'pendentes') return !cliente.pago && dataVencimento >= hoje;
        if (abaAtiva === 'pagos') return cliente.pago;
        if (abaAtiva === 'parcelados') return cliente.nome.includes('(');
        return false;
    });

    const grupos = new Map();
    for (const cliente of filtrados) {
        const nomeBase = cliente.nome.split(' (')[0];
        if (!grupos.has(nomeBase)) grupos.set(nomeBase, []);
        grupos.get(nomeBase).push(cliente);
    }

    lista.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const [nome, itens] of grupos.entries()) {
        const li = document.createElement('li');

        if (itens.length > 1 || abaAtiva === 'parcelados' || termoBusca) {
            li.className = 'item-agrupado';
            const faltaTotal = itens.reduce((acumulado, item) => acumulado + ((Number(item.valor) || 0) - (Number(item.pagoParcial) || 0)), 0);
            li.innerHTML = `
                <div class="pasta-header-parcela" onclick="this.parentElement.classList.toggle('aberto')">
                    <span>📁 ${escapeHtml(nome)} (${itens.length})</span>
                    <span style="background:var(--badge-bg); color:var(--badge-text); padding:4px 10px; border-radius:15px; font-size:0.8rem">${formatarMoeda(faltaTotal)}</span>
                </div>
                <div class="sub-lista">${itens.map(item => criarItemHTML(item, hoje)).join('')}</div>
            `;
        } else {
            li.innerHTML = criarItemHTML(itens[0], hoje);
        }

        fragment.appendChild(li);
    }

    lista.appendChild(fragment);
}

function abrirEdicao(id) {
    const cliente = cobrancas.find(item => item.id === id);
    if (!cliente) return;

    const editId = getEl('edit-id');
    const editNome = getEl('edit-nome');
    const editValor = getEl('edit-valor');
    const editPagoParcial = getEl('edit-pago-parcial');
    const editData = getEl('edit-data');
    const modal = getEl('modalEdicao');

    if (!editId || !editNome || !editValor || !editPagoParcial || !editData || !modal) return;

    editId.value = cliente.id;
    editNome.value = cliente.nome;
    editValor.value = cliente.valor;
    editPagoParcial.value = cliente.pagoParcial;
    editData.value = cliente.data;
    modal.style.display = 'flex';
}

function fecharModal() {
    const modal = getEl('modalEdicao');
    if (modal) modal.style.display = 'none';
}

function salvarEdicao() {
    const editId = getEl('edit-id');
    const editNome = getEl('edit-nome');
    const editValor = getEl('edit-valor');
    const editPagoParcial = getEl('edit-pago-parcial');
    const editData = getEl('edit-data');

    if (!editId || !editNome || !editValor || !editPagoParcial || !editData) return;

    const id = Number(editId.value);
    const index = cobrancas.findIndex(c => c.id === id);
    if (index === -1) return;

    const original = cobrancas[index];
    const novoNome = editNome.value.trim();
    const novoValor = Number(editValor.value);
    const novoPago = Number(editPagoParcial.value);
    const novaData = editData.value;

    if (!novoNome || !Number.isFinite(novoValor) || novoValor <= 0 || !Number.isFinite(novoPago) || novoPago < 0 || !novaData) {
        alert('Preencha os dados corretamente.');
        return;
    }

    const antigoPago = Number(original.pagoParcial) || 0;
    const diferenca = novoPago - antigoPago;
    if (diferenca > 0) registrarTransacaoCarteira('entrada', diferenca, `Ajuste manual: ${novoNome}`);
    else if (diferenca < 0) registrarTransacaoCarteira('saida', Math.abs(diferenca), `Correcao manual: ${novoNome}`);

    cobrancas[index] = {
        ...original,
        nome: novoNome,
        valor: novoValor.toFixed(2),
        pagoParcial: novoPago.toFixed(2),
        data: novaData,
        pago: novoPago >= novoValor
    };

    fecharModal();
    atualizarTudo();
}

function mudarAba(aba) {
    abaAtiva = aba;
    document.querySelectorAll('.tab-btn').forEach(botao => botao.classList.remove('active'));
    const botao = document.querySelector(`[data-aba="${aba}"]`);
    if (botao) botao.classList.add('active');
    renderizarLista();
}

function gerarMenuMeses() {
    const menu = getEl('menu-meses');
    if (!menu) return;

    menu.innerHTML = nomesMeses.map((mes, indice) => `
        <button class="${indice === mesAtivo ? 'active' : ''}" onclick="mesAtivo=${indice}; atualizarTudo(); fecharSidebarMobile();">
            ${mes}
        </button>
    `).join('');

    const titulo = getEl('titulo-pagina');
    if (titulo) titulo.textContent = nomesMeses[mesAtivo];
}

function atualizarTudo() {
    salvarCobrancas();

    const totalAtrasadosEl = getEl('totalAtrasados');
    if (!totalAtrasadosEl) {
        atualizarInterfaceEconomias();
        return;
    }

    let atrasados = 0;
    let pendentes = 0;
    let recebido = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (const cliente of cobrancas) {
        const dataVencimento = getVencimentoDate(cliente.data);
        if (dataVencimento.getMonth() !== mesAtivo) continue;

        const valorTotal = Number(cliente.valor) || 0;
        const valorPago = Number(cliente.pagoParcial) || 0;
        recebido += cliente.pago ? valorTotal : valorPago;

        if (!cliente.pago) {
            if (dataVencimento < hoje) atrasados += (valorTotal - valorPago);
            else pendentes += (valorTotal - valorPago);
        }
    }

    totalAtrasadosEl.textContent = formatarMoeda(atrasados);
    const totalPendentesEl = getEl('totalPendentes');
    const totalRecebidoEl = getEl('totalRecebido');
    if (totalPendentesEl) totalPendentesEl.textContent = formatarMoeda(pendentes);
    if (totalRecebidoEl) totalRecebidoEl.textContent = formatarMoeda(recebido);

    gerarMenuMeses();
    renderizarLista();
    atualizarInterfaceEconomias();
}

function excluir(id) {
    if (!confirm('Excluir este lancamento?')) return;
    cobrancas = cobrancas.filter(cliente => cliente.id !== id);
    atualizarTudo();
}

function copiarProximo(id) {
    const cliente = cobrancas.find(item => item.id === id);
    if (!cliente) return;

    const novaData = getVencimentoDate(cliente.data);
    novaData.setMonth(novaData.getMonth() + 1);

    cobrancas.push({
        ...cliente,
        id: (Date.now() * 1000) + Math.floor(Math.random() * 1000),
        data: novaData.toISOString().split('T')[0],
        pago: false,
        pagoParcial: '0.00'
    });

    atualizarTudo();
}

/* =========================================
   Economias: carteira e poupança
   ========================================= */
function renderizarListaGenerica(elementId, listaDados, corEntrada, corSaida) {
    const container = getEl(elementId);
    if (!container) return;

    container.innerHTML = '';
    if (!listaDados.length) {
        container.innerHTML = '<p style="opacity:0.5; text-align:center; padding:20px;">Nenhuma movimentacao.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const item of listaDados) {
        const isEntrada = item.tipo === 'depositar' || item.tipo === 'entrada';
        const cor = isEntrada ? corEntrada : corSaida;

        const div = document.createElement('div');
        div.className = 'item-extrato';
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="background:var(--bg-body); padding:10px; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
                    ${isEntrada ? '⬇️' : '⬆️'}
                </div>
                <div>
                    <div style="font-weight:bold; color:var(--text-main);">${escapeHtml(item.descricao)}</div>
                    <div class="data-extrato">${escapeHtml(item.data)}</div>
                </div>
            </div>
            <div style="font-weight:bold; color:${cor}">${isEntrada ? '+' : '-'} ${formatarMoeda(item.valor)}</div>
        `;
        fragment.appendChild(div);
    }

    container.appendChild(fragment);
}

function renderizarExtratoCarteira() {
    renderizarListaGenerica('lista-extrato', historicoCarteira, 'var(--success)', 'var(--danger)');
}

function renderizarExtratoPoupanca() {
    renderizarListaGenerica('extrato-poupanca', historicoPoupanca, 'var(--poupanca-primary)', 'var(--poupanca-secondary)');
}

function atualizarInterfaceEconomias() {
    const saldoCarteiraFormatado = formatarMoeda(saldoCarteira);
    const saldoPoupancaFormatado = formatarMoeda(saldoPoupanca);

    const saldoTelaCheia = getEl('saldo-tela-cheia');
    if (saldoTelaCheia) saldoTelaCheia.textContent = saldoCarteiraFormatado;

    const saldoPoupancaEl = getEl('saldo-poupanca');
    if (saldoPoupancaEl) saldoPoupancaEl.textContent = saldoPoupancaFormatado;

    if (getEl('lista-extrato')) renderizarExtratoCarteira();
    if (getEl('extrato-poupanca')) renderizarExtratoPoupanca();
}

function realizarOperacao(tipo) {
    const inputValor = getEl('valor-operacao');
    const inputDesc = getEl('desc-operacao');
    if (!inputValor) return;

    const valor = parseValorInput(inputValor.value);
    if (!Number.isFinite(valor) || valor <= 0) return alert('Valor invalido.');
    if (tipo === 'sacar' && valor > saldoCarteira) return alert('Saldo insuficiente.');

    registrarTransacaoCarteira(
        tipo === 'depositar' ? 'entrada' : 'saida',
        valor,
        inputDesc?.value?.trim() || (tipo === 'depositar' ? 'Deposito manual' : 'Saida manual')
    );

    inputValor.value = '';
    if (inputDesc) inputDesc.value = '';
}

function operarPoupanca(tipo) {
    const inputValor = getEl('valor-poupanca');
    const inputDesc = getEl('desc-poupanca');
    if (!inputValor) return;

    const valor = parseValorInput(inputValor.value);
    if (!Number.isFinite(valor) || valor <= 0) return alert('Valor invalido.');
    if (tipo === 'sacar' && valor > saldoPoupanca) return alert('Saldo insuficiente.');

    if (tipo === 'depositar') saldoPoupanca += valor;
    else saldoPoupanca -= valor;

    historicoPoupanca.unshift({
        tipo,
        valor,
        descricao: inputDesc?.value?.trim() || (tipo === 'depositar' ? 'Investimento' : 'Resgate'),
        data: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    });

    limitarHistorico(historicoPoupanca);
    salvarPoupanca();

    inputValor.value = '';
    if (inputDesc) inputDesc.value = '';
    atualizarInterfaceEconomias();
}

function mudarAbaEconomia(aba) {
    const abaCarteira = getEl('aba-carteira');
    const abaPoupanca = getEl('aba-poupanca');
    if (!abaCarteira || !abaPoupanca) return;

    abaCarteira.style.display = 'none';
    abaPoupanca.style.display = 'none';
    document.querySelectorAll('.tab-eco').forEach(btn => btn.classList.remove('active'));

    if (aba === 'carteira') {
        abaCarteira.style.display = 'block';
        const botao = document.querySelectorAll('.tab-eco')[0];
        if (botao) botao.classList.add('active');
    } else {
        abaPoupanca.style.display = 'block';
        const botao = document.querySelectorAll('.tab-eco')[1];
        if (botao) botao.classList.add('active');
    }

    atualizarInterfaceEconomias();
}

/* =========================================
   Tema e backup
   ========================================= */
function carregarTema() {
    const temaSalvo = localStorage.getItem('tema_sistema');
    if (temaSalvo === 'light') document.body.classList.add('light-mode');
}

function alternarTema() {
    const botaoTema = getEl('btn-tema');
    if (botaoTema) {
        const rect = botaoTema.getBoundingClientRect();
        document.body.style.setProperty('--theme-origin-x', `${Math.round(rect.left + rect.width / 2)}px`);
        document.body.style.setProperty('--theme-origin-y', `${Math.round(rect.top + rect.height / 2)}px`);
    } else {
        document.body.style.setProperty('--theme-origin-x', '50vw');
        document.body.style.setProperty('--theme-origin-y', '50vh');
    }

    document.body.classList.add('theme-switching');
    void document.body.offsetWidth;
    document.body.classList.toggle('light-mode');
    localStorage.setItem('tema_sistema', document.body.classList.contains('light-mode') ? 'light' : 'dark');

    clearTimeout(temaTransicaoTimer);
    temaTransicaoTimer = setTimeout(() => {
        document.body.classList.remove('theme-switching');
    }, DURACAO_TRANSICAO_TEMA + 40);
}

function exportarDados() {
    baixarJson(
        {
            clientes: localStorage.getItem(STORAGE_CLIENTES),
            saldo: localStorage.getItem(STORAGE_SALDO),
            hist: localStorage.getItem(STORAGE_HISTORICO),
            saldoP: localStorage.getItem(STORAGE_POUPANCA),
            histP: localStorage.getItem(STORAGE_HIST_POUPANCA)
        },
        `backup_sistema_2026_${new Date().toISOString().split('T')[0]}.json`
    );
}

function importarDados(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const dados = JSON.parse(e.target.result);
            if (dados.clientes != null) localStorage.setItem(STORAGE_CLIENTES, dados.clientes);
            if (dados.saldo != null) localStorage.setItem(STORAGE_SALDO, dados.saldo);
            if (dados.hist != null) localStorage.setItem(STORAGE_HISTORICO, dados.hist);
            if (dados.saldoP != null) localStorage.setItem(STORAGE_POUPANCA, dados.saldoP);
            if (dados.histP != null) localStorage.setItem(STORAGE_HIST_POUPANCA, dados.histP);
            alert('Backup restaurado com sucesso!');
            location.reload();
        } catch (_) {
            alert('Erro ao ler arquivo de backup.');
        }
    };
    reader.readAsText(file);
}

function resetarSistema() {
    if (!confirm('Atencao: voce solicitou o reset total do sistema. Deseja continuar?')) return;
    if (!confirm('Esta acao apagara permanentemente os dados. Confirmar?')) return;

    const prova = prompt('Digite ZERAR para confirmar:');
    if (prova && prova.toUpperCase() === 'ZERAR') {
        localStorage.clear();
        alert('Sistema formatado com sucesso.');
        window.location.href = 'index.html';
    } else {
        alert('Acao cancelada.');
    }
}

/* =========================================
   Transferencias carteira/poupança
   ========================================= */
function abrirModalTransferencia() {
    const valor = prompt('Quanto deseja transferir da Carteira para a Poupança?');
    if (!valor) return;

    const numValor = parseValorInput(valor);
    if (!Number.isFinite(numValor) || numValor <= 0) return alert('Valor invalido.');
    if (numValor > saldoCarteira) return alert('Saldo insuficiente na Carteira.');

    registrarTransacaoCarteira('saida', numValor, 'Transferencia para Poupança');

    saldoPoupanca += numValor;
    historicoPoupanca.unshift({
        tipo: 'depositar',
        valor: numValor,
        descricao: 'Vindo da Carteira',
        data: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    limitarHistorico(historicoPoupanca);
    salvarPoupanca();

    alert(`Transferencia realizada: ${formatarMoeda(numValor)}.`);
    atualizarInterfaceEconomias();
}

function abrirModalResgate() {
    const valor = prompt('Quanto deseja tirar da Poupança e enviar para a Carteira?');
    if (!valor) return;

    const numValor = parseValorInput(valor);
    if (!Number.isFinite(numValor) || numValor <= 0) return alert('Valor invalido.');
    if (numValor > saldoPoupanca) return alert('Saldo insuficiente na Poupança.');

    saldoPoupanca -= numValor;
    historicoPoupanca.unshift({
        tipo: 'sacar',
        valor: numValor,
        descricao: 'Enviado para Carteira',
        data: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    limitarHistorico(historicoPoupanca);
    salvarPoupanca();

    registrarTransacaoCarteira('entrada', numValor, 'Resgate da Poupança');
    alert(`Resgate realizado: ${formatarMoeda(numValor)} para a Carteira.`);
    atualizarInterfaceEconomias();
}

/* =========================================
   Whatsapp
   ========================================= */
function abrirMenuWhats(id) {
    const cliente = cobrancas.find(item => item.id === id);
    if (!cliente) return;

    const modal = getEl('modalWhatsapp');
    const lista = getEl('lista-mensagens');
    const titulo = getEl('whats-titulo');
    if (!modal || !lista || !titulo) return;

    const primeiroNome = String(cliente.nome || '').split(' ')[0] || 'Cliente';
    const telefone = String(cliente.telefone || '').replace(/\D/g, '');
    const valorTotal = formatarMoeda(cliente.valor);
    const valorPago = formatarMoeda(cliente.pagoParcial);
    const saldoDevedor = formatarMoeda((Number(cliente.valor) || 0) - (Number(cliente.pagoParcial) || 0));

    titulo.innerText = `Mensagem para ${primeiroNome}`;
    lista.innerHTML = '';

    let opcoes = [
        {
            titulo: 'Dia do vencimento',
            texto: `Bom dia ${primeiroNome}. Hoje e o dia da mensalidade no valor de ${valorTotal}.`
        },
        {
            titulo: 'Lembrete em aberto',
            texto: `Bom dia. Percebemos que a mensalidade esta em aberto. Se precisar conversar, estou a disposicao.`
        },
        {
            titulo: 'Negociacao',
            texto: `Bom dia. Sobre a mensalidade em aberto, podemos negociar a melhor forma de pagamento.`
        },
        {
            titulo: 'Novo vencimento',
            texto: 'Boa tarde. Conforme combinado, atualizamos o vencimento da mensalidade.'
        }
    ];

    if ((Number(cliente.pagoParcial) || 0) > 0 && !cliente.pago) {
        opcoes.unshift({
            titulo: 'Saldo restante',
            texto: `Recebi o valor parcial de ${valorPago}. O saldo restante e ${saldoDevedor}.`
        });
    }

    if (cliente.pago) {
        opcoes = [
            {
                titulo: 'Agradecer pagamento',
                texto: `Recebi seu pagamento de ${valorTotal}. Obrigado.`
            },
            {
                titulo: 'Novo vencimento',
                texto: 'Conforme combinado, atualizamos o vencimento para o proximo mes.'
            }
        ];
    }

    const fragment = document.createDocumentFragment();

    for (const opcao of opcoes) {
        const btn = document.createElement('button');
        btn.className = 'btn-acao-principal';
        btn.style.textAlign = 'left';
        btn.style.padding = '15px';
        btn.style.marginBottom = '5px';
        btn.innerHTML = `<strong>${escapeHtml(opcao.titulo)}</strong><br><small style="display:block; margin-top:5px; opacity:0.7; line-height:1.2">${escapeHtml(opcao.texto.substring(0, 60))}...</small>`;

        btn.onclick = () => {
            if (!telefone) {
                alert('Cliente sem telefone cadastrado.');
                return;
            }

            const link = `https://wa.me/55${telefone}?text=${encodeURIComponent(opcao.texto)}`;
            window.open(link, '_blank');
            fecharModalWhats();
        };

        fragment.appendChild(btn);
    }

    lista.appendChild(fragment);
    modal.style.display = 'flex';
}

function fecharModalWhats() {
    const modal = getEl('modalWhatsapp');
    if (modal) modal.style.display = 'none';
}

/* =========================================
   Boot
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    carregarTema();
    aplicarEstadoInicialSidebar();
    configurarGestosSidebarMobile();
    atualizarTudo();
    atualizarInterfaceEconomias();

    const busca = getEl('buscaNome');
    if (busca) {
        busca.addEventListener('input', () => {
            clearTimeout(buscaDebounceTimer);
            buscaDebounceTimer = setTimeout(renderizarLista, 120);
        });
    }
});
