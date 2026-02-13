const STORAGE_CLIENTES = 'cobrancas_2026';
const STORAGE_DESPESAS = 'minhas_despesas';
const STORAGE_SALDO = 'cofrinho_saldo';
const STORAGE_HISTORICO = 'cofrinho_historico';
const STORAGE_POUPANCA = 'poupanca_saldo';
const STORAGE_HIST_POUPANCA = 'poupanca_historico';
const STORAGE_SIDEBAR_RETORNO_FECHADA = 'sidebar_retorno_fechada';
const STORAGE_PULAR_SPLASH_ENTRADA = 'pular_splash_entrada_once';
const DURACAO_TRANSICAO_TEMA = 420;

const Common = window.FinCommon;
if (!Common) {
    throw new Error('common.js nao foi carregado antes de resumo-economias.js');
}

const {
    NOMES_MESES: nomesMeses,
    getEl,
    formatarMoeda,
    getDataLocal,
    baixarJson,
    iniciarAnimacaoEntradaPagina
} = Common;

let temaTransicaoTimer = null;

function obterAnoSelecionado() {
    const params = new URLSearchParams(window.location.search);
    const anoParam = Number(params.get('ano'));
    if (Number.isInteger(anoParam) && anoParam >= 2000 && anoParam <= 2100) return anoParam;
    return new Date().getFullYear();
}

function carregarTema() {
    const temaSalvo = localStorage.getItem('tema_sistema');
    if (temaSalvo === 'light') document.body.classList.add('light-mode');
}

function toggleSidebar() {
    const appWrapper = getEl('app-wrapper');
    if (appWrapper) appWrapper.classList.toggle('sidebar-closed');
}

function aplicarEstadoInicialSidebar() {
    const appWrapper = getEl('app-wrapper');
    if (!appWrapper) return;

    if (localStorage.getItem(STORAGE_SIDEBAR_RETORNO_FECHADA) === '1') {
        appWrapper.classList.add('sidebar-closed');
        localStorage.removeItem(STORAGE_SIDEBAR_RETORNO_FECHADA);
    }
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

        if (Math.abs(deltaX) > Math.abs(deltaY) * RAZAO_HORIZONTAL) {
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

function irParaInicio() {
    localStorage.setItem(STORAGE_SIDEBAR_RETORNO_FECHADA, '1');
    localStorage.setItem(STORAGE_PULAR_SPLASH_ENTRADA, '1');
    window.location.href = 'index.html';
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
            histP: localStorage.getItem(STORAGE_HIST_POUPANCA),
            despesas: localStorage.getItem(STORAGE_DESPESAS)
        },
        `backup_financas_${new Date().toISOString().split('T')[0]}.json`
    );
}

function importarDados(event) {
    const file = event.target.files?.[0];
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
            if (dados.despesas != null) localStorage.setItem(STORAGE_DESPESAS, dados.despesas);
            alert('Backup restaurado com sucesso.');
            location.reload();
        } catch (_) {
            alert('Erro ao ler arquivo de backup.');
        }
    };

    reader.readAsText(file);
}

function resetarSistema() {
    if (!confirm('Atencao: isso vai apagar todos os dados. Deseja continuar?')) return;
    if (!confirm('Confirmacao final: essa acao nao pode ser desfeita.')) return;

    const prova = prompt('Digite ZERAR para confirmar:');
    if (prova && prova.toUpperCase() === 'ZERAR') {
        localStorage.clear();
        alert('Sistema zerado com sucesso.');
        window.location.href = 'index.html';
    } else {
        alert('Acao cancelada.');
    }
}

function extrairMesAnoHistorico(item, anoPadrao) {
    if (!item) return null;

    const timestamp = Number(item.timestamp);
    if (Number.isFinite(timestamp)) {
        const data = new Date(timestamp);
        const mes = data.getMonth();
        const ano = data.getFullYear();
        if (Number.isInteger(mes) && mes >= 0 && mes <= 11) return { mes, ano };
    }

    const textoData = String(item.data ?? '');
    const match = textoData.match(/(\d{2})\/(\d{2})(?:\/(\d{4}))?/);
    if (!match) return null;

    const mes = Number(match[2]) - 1;
    const ano = match[3] ? Number(match[3]) : anoPadrao;
    if (!Number.isInteger(mes) || mes < 0 || mes > 11) return null;
    if (!Number.isInteger(ano)) return null;
    return { mes, ano };
}

function calcularResumoEconomiasAnual(anoSelecionado) {
    const historicoCarteira = JSON.parse(localStorage.getItem(STORAGE_HISTORICO)) || [];
    const historicoPoupanca = JSON.parse(localStorage.getItem(STORAGE_HIST_POUPANCA)) || [];
    const despesas = JSON.parse(localStorage.getItem(STORAGE_DESPESAS)) || [];

    const carteiraMes = Array.from({ length: 12 }, () => 0);
    const poupancaMes = Array.from({ length: 12 }, () => 0);
    const recebidoMes = Array.from({ length: 12 }, () => 0);
    const despesasMes = Array.from({ length: 12 }, () => 0);

    for (const item of historicoCarteira) {
        const referencia = extrairMesAnoHistorico(item, anoSelecionado);
        if (!referencia || referencia.ano !== anoSelecionado) continue;

        const valor = Number(item.valor) || 0;
        if (item.tipo === 'depositar' || item.tipo === 'entrada') {
            carteiraMes[referencia.mes] += valor;
            recebidoMes[referencia.mes] += valor;
        } else {
            carteiraMes[referencia.mes] -= valor;
        }
    }

    for (const item of historicoPoupanca) {
        const referencia = extrairMesAnoHistorico(item, anoSelecionado);
        if (!referencia || referencia.ano !== anoSelecionado) continue;

        const valor = Number(item.valor) || 0;
        if (item.tipo === 'depositar' || item.tipo === 'entrada') poupancaMes[referencia.mes] += valor;
        else poupancaMes[referencia.mes] -= valor;
    }

    for (const despesa of despesas) {
        if (!despesa || despesa.status !== 'pago') continue;
        const data = getDataLocal(despesa.data);
        if (data.getFullYear() !== anoSelecionado) continue;

        const mes = data.getMonth();
        const valor = Number(despesa.valor) || 0;
        despesasMes[mes] += valor;
    }

    const acumuladoPoupancaMes = [];
    let acumulado = 0;

    for (let mes = 0; mes < 12; mes += 1) {
        acumulado += poupancaMes[mes];
        acumuladoPoupancaMes.push(acumulado);
    }

    return { carteiraMes, poupancaMes, acumuladoPoupancaMes, recebidoMes, despesasMes };
}

function renderizarCardsResumo(resumo) {
    const totalRecebido = resumo.recebidoMes.reduce((acc, valor) => acc + valor, 0);
    const totalDespesas = resumo.despesasMes.reduce((acc, valor) => acc + valor, 0);

    const saldoCarteira = Number(localStorage.getItem(STORAGE_SALDO)) || Number(localStorage.getItem('economias')) || 0;
    const saldoPoupanca = Number(localStorage.getItem(STORAGE_POUPANCA)) || 0;

    const totalRecebidoEl = getEl('resumo-eco-total-recebido');
    const totalDespesasEl = getEl('resumo-eco-total-despesas');
    const saldoCarteiraEl = getEl('resumo-eco-saldo-carteira');
    const saldoPoupancaEl = getEl('resumo-eco-saldo-poupanca');

    if (totalRecebidoEl) totalRecebidoEl.textContent = formatarMoeda(totalRecebido);
    if (totalDespesasEl) totalDespesasEl.textContent = formatarMoeda(totalDespesas);
    if (saldoCarteiraEl) saldoCarteiraEl.textContent = formatarMoeda(saldoCarteira);
    if (saldoPoupancaEl) saldoPoupancaEl.textContent = formatarMoeda(saldoPoupanca);
}

function renderizarGraficoResumo(resumo) {
    const graficoEl = getEl('resumo-economias-grafico');
    if (!graficoEl) return;

    const valoresAbsolutos = [
        ...resumo.carteiraMes.map(valor => Math.abs(valor)),
        ...resumo.poupancaMes.map(valor => Math.abs(valor))
    ];
    const maxValor = Math.max(1, ...valoresAbsolutos);

    const fragment = document.createDocumentFragment();

    for (let mes = 0; mes < 12; mes += 1) {
        const valorCarteira = resumo.carteiraMes[mes];
        const valorPoupanca = resumo.poupancaMes[mes];

        const alturaCarteira = Math.round((Math.abs(valorCarteira) / maxValor) * 100);
        const alturaPoupanca = Math.round((Math.abs(valorPoupanca) / maxValor) * 100);

        const coluna = document.createElement('article');
        coluna.className = 'resumo-eco-coluna';
        coluna.innerHTML = `
            <div class="resumo-eco-coluna-barras">
                <div class="resumo-eco-bar ${valorCarteira >= 0 ? 'positivo' : 'negativo'}" style="height:${alturaCarteira}%;" title="Disponivel: ${formatarMoeda(valorCarteira)}"></div>
                <div class="resumo-eco-bar poupanca ${valorPoupanca >= 0 ? 'positivo' : 'negativo'}" style="height:${alturaPoupanca}%;" title="Poupanca: ${formatarMoeda(valorPoupanca)}"></div>
            </div>
            <div class="resumo-eco-coluna-mes">${nomesMeses[mes].slice(0, 3)}</div>
        `;

        fragment.appendChild(coluna);
    }

    graficoEl.innerHTML = '';
    graficoEl.appendChild(fragment);
}

function renderizarTabelaResumo(resumo) {
    const corpo = getEl('resumo-economias-corpo');
    if (!corpo) return;

    const fragment = document.createDocumentFragment();

    for (let mes = 0; mes < 12; mes += 1) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${nomesMeses[mes]}</td>
            <td>${formatarMoeda(resumo.carteiraMes[mes])}</td>
            <td>${formatarMoeda(resumo.poupancaMes[mes])}</td>
            <td>${formatarMoeda(resumo.acumuladoPoupancaMes[mes])}</td>
        `;
        fragment.appendChild(tr);
    }

    corpo.innerHTML = '';
    corpo.appendChild(fragment);
}

function inicializarResumoEconomias() {
    const anoSelecionado = obterAnoSelecionado();
    document.title = `Resumo Economias ${anoSelecionado}`;

    const titulo = getEl('titulo-resumo-economias');
    if (titulo) titulo.textContent = `Resumo de economias ${anoSelecionado}`;

    const resumo = calcularResumoEconomiasAnual(anoSelecionado);
    renderizarCardsResumo(resumo);
    renderizarGraficoResumo(resumo);
    renderizarTabelaResumo(resumo);
}

document.addEventListener('DOMContentLoaded', () => {
    carregarTema();
    aplicarEstadoInicialSidebar();
    configurarGestosSidebarMobile();
    iniciarAnimacaoEntradaPagina();
    inicializarResumoEconomias();
});
