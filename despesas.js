let dataAtual = new Date();

const STORAGE_DESPESAS = 'minhas_despesas';
const STORAGE_CARTEIRA = 'cofrinho_saldo';
const STORAGE_HISTORICO = 'cofrinho_historico';
const STORAGE_CLIENTES = 'cobrancas_2026';
const STORAGE_POUPANCA = 'poupanca_saldo';
const STORAGE_HIST_POUPANCA = 'poupanca_historico';
const STORAGE_SIDEBAR_RETORNO_FECHADA = 'sidebar_retorno_fechada';
const STORAGE_PULAR_SPLASH_ENTRADA = 'pular_splash_entrada_once';
const DURACAO_TRANSICAO_TEMA = 420;

const Common = window.FinCommon;
if (!Common) {
    throw new Error('common.js nao foi carregado antes de despesas.js');
}

const {
    NOMES_MESES: nomesMeses,
    getEl,
    formatarMoeda,
    formatarDataBr,
    getDataLocal,
    getHojeLocal,
    escapeHtml,
    limitarHistorico,
    baixarJson,
    iniciarAnimacaoEntradaPagina
} = Common;

let listaDespesas = JSON.parse(localStorage.getItem(STORAGE_DESPESAS)) || [];
const saldoCarteiraSalvo = localStorage.getItem(STORAGE_CARTEIRA);
const saldoCarteiraLegado = localStorage.getItem('economias');
let saldoCarteira = Number(saldoCarteiraSalvo ?? saldoCarteiraLegado ?? 0) || 0;
let historicoCarteira = JSON.parse(localStorage.getItem(STORAGE_HISTORICO)) || [];

let filtroAtual = 'todos';
let editandoId = null;
let registrosMesCache = [];
let sequenciaIdDespesa = 0;
let notificacaoDespesaSinoJaClicado = false;

let temaTransicaoTimer = null;

const getSerieRecorrenteId = despesa => despesa.baseRecorrenteId ?? despesa.id;
const isMesmoMesAno = (data, mes, ano) => data.getMonth() === mes && data.getFullYear() === ano;
const getTimestampDespesa = despesa => getDataLocal(despesa.data).getTime();
const gerarIdDespesa = () => {
    sequenciaIdDespesa = (sequenciaIdDespesa + 1) % 1000;
    return (Date.now() * 1000) + sequenciaIdDespesa;
};
const getStatusEfetivoDespesa = (item, dataItem, hoje) => {
    if (item.status === 'pago') return 'pago';
    return dataItem < hoje ? 'atrasado' : 'pendente';
};

document.addEventListener('DOMContentLoaded', () => {
    carregarTema();
    iniciarAnimacaoEntradaPagina();
    aplicarEstadoInicialSidebar();
    configurarGestosSidebarMobile();
    configurarPainelNotificacoesDespesas();
    iniciarAutoOcultarSubtitulo();
    gerarRecorrentesAutomatico();
    atualizarLista();
});

function toggleSidebar() {
    const appWrapper = getEl('app-wrapper');
    if (appWrapper) appWrapper.classList.toggle('sidebar-closed');
}

function fecharSidebarMobile() {
    const appWrapper = getEl('app-wrapper');
    if (appWrapper) appWrapper.classList.add('sidebar-closed');
}

function toggleMenuAno() {
    const menu = getEl('menu-meses');
    if (!menu) return;

    const colapsadoAtual = menu.dataset.colapsado === '1';
    menu.dataset.colapsado = colapsadoAtual ? '0' : '1';
    gerarMenuMeses();
}

function abrirResumoAno(ano = dataAtual.getFullYear()) {
    window.location.href = `resumo-ano.html?ano=${encodeURIComponent(String(ano))}`;
}

function selecionarMesDespesa(mes) {
    if (!Number.isInteger(mes) || mes < 0 || mes > 11) return;
    dataAtual = new Date(dataAtual.getFullYear(), mes, 1);

    const menu = getEl('menu-meses');
    if (menu) menu.dataset.colapsado = '1';

    gerarRecorrentesAutomatico();
    atualizarLista();
    fecharSidebarMobile();
}

function gerarMenuMeses() {
    const menu = getEl('menu-meses');
    if (!menu) return;

    if (menu.dataset.colapsado !== '0' && menu.dataset.colapsado !== '1') {
        menu.dataset.colapsado = '1';
    }

    const colapsado = menu.dataset.colapsado === '1';
    const mesAtual = dataAtual.getMonth();
    const mesSelecionadoCompleto = nomesMeses[mesAtual] || '';
    const mesSelecionadoInicial = mesSelecionadoCompleto.slice(0, 3);

    menu.innerHTML = `
        <div class="menu-ano-header menu-ano-header--single">
            <button type="button" class="menu-ano-toggle ${colapsado ? 'collapsed' : 'expanded'}" onclick="toggleMenuAno()" aria-label="${colapsado ? 'Expandir meses' : 'Recolher meses'} - Mes atual: ${escapeHtml(mesSelecionadoCompleto)}">
                <span class="menu-ano-toggle-label">${escapeHtml(mesSelecionadoInicial)}</span>
                <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
        </div>
        <div class="menu-meses-lista ${colapsado ? 'is-collapsed' : ''}">
            ${nomesMeses.map((mesNome, indice) => `
                <button class="${indice === mesAtual ? 'active' : ''}" onclick="selecionarMesDespesa(${indice})">
                    ${mesNome}
                </button>
            `).join('')}
        </div>
    `;
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
    localStorage.setItem(STORAGE_PULAR_SPLASH_ENTRADA, '1');
    window.location.href = destino;
}

function iniciarAutoOcultarSubtitulo() {
    const subtitulo = document.querySelector('.subtitulo-despesas');
    if (!subtitulo) return;

    setTimeout(() => {
        subtitulo.classList.add('oculto');
    }, 8000);
}

function alternarPainelNotificacoesDespesas(forcarAberto = null) {
    const container = getEl('notificacoes-despesas');
    const botao = getEl('btn-notificacoes-despesas');
    const painel = getEl('notificacoes-despesas-painel');
    if (!container || !botao || !painel) return;

    const abrir = typeof forcarAberto === 'boolean' ? forcarAberto : painel.hidden;
    painel.hidden = !abrir;
    container.classList.toggle('aberto', abrir);
    botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
}

function configurarPainelNotificacoesDespesas() {
    const container = getEl('notificacoes-despesas');
    const botao = getEl('btn-notificacoes-despesas');
    const painel = getEl('notificacoes-despesas-painel');
    if (!container || !botao || !painel) return;

    botao.addEventListener('click', event => {
        event.stopPropagation();
        notificacaoDespesaSinoJaClicado = true;
        botao.classList.remove('balancando');
        alternarPainelNotificacoesDespesas();
    });

    painel.addEventListener('click', event => {
        event.stopPropagation();
    });

    document.addEventListener('click', event => {
        if (!container.contains(event.target)) alternarPainelNotificacoesDespesas(false);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') alternarPainelNotificacoesDespesas(false);
    });
}

function obterNotificacoesDespesas() {
    const hoje = getHojeLocal();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const mesAtual = dataAtual.getMonth();
    const anoAtual = dataAtual.getFullYear();

    const notificacoes = {
        atrasadas: [],
        hoje: [],
        amanha: []
    };

    for (const item of listaDespesas) {
        if (item.status === 'pago') continue;

        const dataItem = getDataLocal(item.data);
        dataItem.setHours(0, 0, 0, 0);
        if (!isMesmoMesAno(dataItem, mesAtual, anoAtual)) continue;

        const registro = { item, dataItem };
        if (dataItem < hoje) notificacoes.atrasadas.push(registro);
        else if (dataItem.getTime() === hoje.getTime()) notificacoes.hoje.push(registro);
        else if (dataItem.getTime() === amanha.getTime()) notificacoes.amanha.push(registro);
    }

    const ordenar = (a, b) => {
        const ordemData = a.dataItem - b.dataItem;
        if (ordemData !== 0) return ordemData;
        return String(a.item.nome || '').localeCompare(String(b.item.nome || ''), 'pt-BR', { sensitivity: 'base' });
    };

    notificacoes.atrasadas.sort(ordenar);
    notificacoes.hoje.sort(ordenar);
    notificacoes.amanha.sort(ordenar);

    notificacoes.total = notificacoes.atrasadas.length + notificacoes.hoje.length + notificacoes.amanha.length;
    return notificacoes;
}

function atualizarNotificacoesDespesas() {
    const container = getEl('notificacoes-despesas');
    const botao = getEl('btn-notificacoes-despesas');
    const painel = getEl('notificacoes-despesas-painel');
    const lista = getEl('notificacoes-despesas-lista');
    const badge = getEl('notificacoes-despesas-badge');
    if (!container || !botao || !painel || !lista || !badge) return;

    const notificacoes = obterNotificacoesDespesas();
    badge.textContent = String(notificacoes.total);
    botao.setAttribute('aria-label', `Alertas de despesas: ${notificacoes.total}`);

    if (!notificacoes.total) {
        alternarPainelNotificacoesDespesas(false);
        notificacaoDespesaSinoJaClicado = false;
        botao.classList.remove('balancando');
        container.hidden = true;
        lista.innerHTML = '';
        return;
    }

    container.hidden = false;
    if (!notificacaoDespesaSinoJaClicado) botao.classList.add('balancando');

    const fragment = document.createDocumentFragment();
    const adicionarSecao = (titulo, itens, classeTipo, textoData) => {
        if (!itens.length) return;

        const cabecalho = document.createElement('li');
        cabecalho.className = `notificacoes-secao ${classeTipo}`;
        cabecalho.innerHTML = `<span class="notificacoes-secao-titulo">${escapeHtml(titulo)}</span>`;
        fragment.appendChild(cabecalho);

        for (const registro of itens) {
            const { item } = registro;
            const li = document.createElement('li');
            li.className = `notificacoes-item ${classeTipo}`;
            li.innerHTML = `
                <div class="notificacoes-item-info">
                    <span class="notificacoes-item-nome">${escapeHtml(item.nome)}</span>
                    <span class="notificacoes-item-data">${escapeHtml(textoData)} (${escapeHtml(formatarDataBr(item.data))})</span>
                </div>
                <span class="notificacoes-item-valor">${formatarMoeda(item.valor)}</span>
            `;
            fragment.appendChild(li);
        }
    };

    adicionarSecao(`Vencidas (${notificacoes.atrasadas.length})`, notificacoes.atrasadas, 'notificacao-atrasada', 'Venceu em');
    adicionarSecao(`Vencem hoje (${notificacoes.hoje.length})`, notificacoes.hoje, 'notificacao-hoje', 'Vence hoje');
    adicionarSecao(`Vencem amanha (${notificacoes.amanha.length})`, notificacoes.amanha, 'notificacao-amanha', 'Vence amanha');

    lista.innerHTML = '';
    lista.appendChild(fragment);
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
            saldo: localStorage.getItem(STORAGE_CARTEIRA),
            hist: localStorage.getItem(STORAGE_HISTORICO),
            saldoP: localStorage.getItem(STORAGE_POUPANCA),
            histP: localStorage.getItem(STORAGE_HIST_POUPANCA),
            despesas: localStorage.getItem(STORAGE_DESPESAS)
        },
        `backup_financas_${new Date().toISOString().split('T')[0]}.json`
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
            if (dados.saldo != null) localStorage.setItem(STORAGE_CARTEIRA, dados.saldo);
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

function registrarTransacaoCarteira(tipo, valor, descricao) {
    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return;

    if (tipo === 'entrada') saldoCarteira += valorNumerico;
    else saldoCarteira -= valorNumerico;

    historicoCarteira.unshift({
        tipo: tipo === 'entrada' ? 'depositar' : 'sacar',
        valor: valorNumerico,
        descricao,
        timestamp: Date.now(),
        data: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    limitarHistorico(historicoCarteira);
}

function registrarAjusteCarteira(delta, descricaoEntrada, descricaoSaida) {
    if (!Number.isFinite(delta) || delta === 0) return;
    if (delta > 0) registrarTransacaoCarteira('entrada', delta, descricaoEntrada);
    else registrarTransacaoCarteira('saida', Math.abs(delta), descricaoSaida);
}

function obterReferenciaRecorrente(itensSerie, mes, ano) {
    const inicioMesAlvo = new Date(ano, mes, 1).getTime();
    let referenciaAnteriorMaisRecente = null;
    let timestampAnteriorMaisRecente = -Infinity;
    let referenciaMaisAntiga = null;
    let timestampMaisAntigo = Infinity;

    for (const item of itensSerie) {
        const timestamp = getTimestampDespesa(item);

        if (timestamp <= inicioMesAlvo && timestamp > timestampAnteriorMaisRecente) {
            timestampAnteriorMaisRecente = timestamp;
            referenciaAnteriorMaisRecente = item;
        }

        if (timestamp < timestampMaisAntigo) {
            timestampMaisAntigo = timestamp;
            referenciaMaisAntiga = item;
        }
    }

    return referenciaAnteriorMaisRecente ?? referenciaMaisAntiga;
}

function propagarEdicaoRecorrente(despesaAtual, novoNome, novoValor) {
    if (!despesaAtual.recorrente) return 0;

    const serieId = getSerieRecorrenteId(despesaAtual);
    const dataBaseEdicao = getDataLocal(despesaAtual.data);
    let deltaCarteira = 0;

    listaDespesas = listaDespesas.map(item => {
        if (item.id === despesaAtual.id) return item;
        if (!item.recorrente || getSerieRecorrenteId(item) !== serieId) return item;

        const dataItem = getDataLocal(item.data);
        if (dataItem <= dataBaseEdicao) return item;

        const valorAnteriorItem = Number(item.valor) || 0;
        if (item.status === 'pago') {
            deltaCarteira += valorAnteriorItem - novoValor;
        }

        return {
            ...item,
            nome: novoNome,
            valor: novoValor
        };
    });

    return deltaCarteira;
}

function toggleFormDespesa() {
    const modalDespesaEl = getEl('modalDespesa');
    if (!modalDespesaEl) return;
    if (modalDespesaEl.classList.contains('active')) {
        fecharModalDespesa();
        return;
    }
    modalDespesaEl.classList.add('active');
}

function fecharModalDespesa() {
    const modalDespesaEl = getEl('modalDespesa');
    const nomeDespesaEl = getEl('nomeDespesa');
    const valorDespesaEl = getEl('valorDespesa');
    const dataVencimentoEl = getEl('dataVencimento');
    const statusDespesaEl = getEl('statusDespesa');
    const recorrenteDespesaEl = getEl('recorrenteDespesa');
    const tituloModalEl = getEl('tituloModal');

    if (modalDespesaEl) modalDespesaEl.classList.remove('active');
    if (nomeDespesaEl) nomeDespesaEl.value = '';
    if (valorDespesaEl) valorDespesaEl.value = '';
    if (dataVencimentoEl) dataVencimentoEl.value = '';
    if (statusDespesaEl) statusDespesaEl.value = 'pendente';
    if (recorrenteDespesaEl) recorrenteDespesaEl.checked = false;
    if (tituloModalEl) tituloModalEl.textContent = 'Cadastrar Conta';
    editandoId = null;
}

function salvarDespesa() {
    const nomeDespesaEl = getEl('nomeDespesa');
    const valorDespesaEl = getEl('valorDespesa');
    const dataVencimentoEl = getEl('dataVencimento');
    const statusDespesaEl = getEl('statusDespesa');
    const recorrenteDespesaEl = getEl('recorrenteDespesa');

    if (!nomeDespesaEl || !valorDespesaEl || !dataVencimentoEl || !statusDespesaEl || !recorrenteDespesaEl) return;

    const nome = nomeDespesaEl.value.trim();
    const valor = Number(valorDespesaEl.value);
    const data = dataVencimentoEl.value;
    const status = statusDespesaEl.value;
    const recorrente = recorrenteDespesaEl.checked;

    if (!nome || !Number.isFinite(valor) || valor <= 0 || !data) {
        alert('Preencha todos os campos');
        return;
    }

    if (editandoId !== null) {
        const index = listaDespesas.findIndex(d => d.id === editandoId);
        if (index === -1) {
            alert('Despesa nao encontrada');
            return;
        }

        const despesaAtual = listaDespesas[index];
        const valorAnterior = Number(despesaAtual.valor) || 0;
        const impactoAnterior = despesaAtual.status === 'pago' ? -valorAnterior : 0;
        const impactoNovo = status === 'pago' ? -valor : 0;

        registrarAjusteCarteira(
            impactoNovo - impactoAnterior,
            `Estorno de ajuste de despesa: ${nome}`,
            `Ajuste de despesa paga: ${nome}`
        );

        let deltaRecorrencia = 0;
        if (despesaAtual.recorrente && recorrente) {
            deltaRecorrencia = propagarEdicaoRecorrente(despesaAtual, nome, valor);
        }

        registrarAjusteCarteira(
            deltaRecorrencia,
            `Estorno de ajuste de recorrencia: ${nome}`,
            `Ajuste de recorrencia paga: ${nome}`
        );

        listaDespesas[index] = {
            ...despesaAtual,
            nome,
            valor,
            data,
            status,
            recorrente,
            baseRecorrenteId: recorrente ? getSerieRecorrenteId(despesaAtual) : null
        };
    } else {
        const id = gerarIdDespesa();
        if (status === 'pago') {
            registrarTransacaoCarteira('saida', valor, `Despesa cadastrada como paga: ${nome}`);
        }

        listaDespesas.push({
            id,
            nome,
            valor,
            data,
            status,
            recorrente,
            baseRecorrenteId: recorrente ? id : null
        });
    }

    salvarStorage();
    fecharModalDespesa();
    atualizarLista();
}

function gerarRecorrentesAutomatico() {
    const mes = dataAtual.getMonth();
    const ano = dataAtual.getFullYear();
    const seriesRecorrentes = new Map();
    let houveInclusao = false;

    for (const despesa of listaDespesas) {
        if (!despesa.recorrente) continue;

        const serieRecorrenteId = getSerieRecorrenteId(despesa);
        if (!seriesRecorrentes.has(serieRecorrenteId)) {
            seriesRecorrentes.set(serieRecorrenteId, []);
        }
        seriesRecorrentes.get(serieRecorrenteId).push(despesa);
    }

    seriesRecorrentes.forEach((itensSerie, serieRecorrenteId) => {
        const jaExisteNoMes = itensSerie.some(item => isMesmoMesAno(getDataLocal(item.data), mes, ano));
        if (jaExisteNoMes) return;

        const referencia = obterReferenciaRecorrente(itensSerie, mes, ano);
        if (!referencia) return;

        const diaOriginal = getDataLocal(referencia.data).getDate();
        const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
        const diaAjustado = Math.min(diaOriginal, ultimoDiaDoMes);
        const novaData = new Date(ano, mes, diaAjustado);

        listaDespesas.push({
            id: gerarIdDespesa(),
            nome: referencia.nome,
            valor: referencia.valor,
            data: novaData.toISOString().split('T')[0],
            status: 'pendente',
            recorrente: true,
            baseRecorrenteId: serieRecorrenteId
        });
        houveInclusao = true;
    });

    if (houveInclusao) salvarStorage();
}

function obterRegistrosMesAtual(hoje) {
    const mesAtual = dataAtual.getMonth();
    const anoAtual = dataAtual.getFullYear();
    const registros = [];

    for (const item of listaDespesas) {
        const dataItem = getDataLocal(item.data);
        if (!isMesmoMesAno(dataItem, mesAtual, anoAtual)) continue;

        registros.push({
            item,
            dataItem,
            statusEfetivo: getStatusEfetivoDespesa(item, dataItem, hoje)
        });
    }

    registros.sort((a, b) => a.dataItem - b.dataItem);
    return registros;
}

function atualizarLista() {
    const hoje = getHojeLocal();
    const registrosMes = obterRegistrosMesAtual(hoje);
    registrosMesCache = registrosMes;

    let totalPagar = 0;
    let totalPago = 0;

    for (const registro of registrosMes) {
        if (registro.statusEfetivo === 'pago') totalPago += Number(registro.item.valor) || 0;
        else totalPagar += Number(registro.item.valor) || 0;
    }

    const totalPagarEl = getEl('totalPagar');
    const totalPagoEl = getEl('totalPago');
    const totalGeralEl = getEl('totalGeral');

    if (totalPagarEl) totalPagarEl.innerText = formatarMoeda(totalPagar);
    if (totalPagoEl) totalPagoEl.innerText = formatarMoeda(totalPago);
    if (totalGeralEl) totalGeralEl.innerText = formatarMoeda(totalPago + totalPagar);

    renderLista(registrosMes);
    atualizarNotificacoesDespesas();
    gerarMenuMeses();
}

function renderLista(registrosMes = registrosMesCache) {
    const listaDespesasEl = getEl('listaDespesas');
    if (!listaDespesasEl) return;
    listaDespesasEl.innerHTML = '';

    const fragment = document.createDocumentFragment();

    for (const registro of registrosMes) {
        if (filtroAtual !== 'todos' && registro.statusEfetivo !== filtroAtual) continue;

        const item = registro.item;
        const li = document.createElement('li');
        li.className = `lista-item ${registro.statusEfetivo}`;

        li.innerHTML = `
            <div class="lista-info">
                <div class="lista-texto">
                    <strong class="despesa-nome">${escapeHtml(item.nome)}</strong>
                    <span class="despesa-data">${escapeHtml(formatarDataBr(item.data))}</span>
                </div>
                <span class="despesa-valor">${formatarMoeda(item.valor)}</span>
            </div>

            <div class="lista-acoes">
                <button class="btn-editar" onclick="editarDespesa(${item.id})">
                    <i class="fa-solid fa-pen"></i>
                </button>

                <button class="btn-check ${registro.statusEfetivo === 'pago' ? 'pago' : ''}" onclick="marcarComoPago(${item.id})">
                    <i class="fa-solid ${registro.statusEfetivo === 'pago' ? 'fa-undo' : 'fa-check'}"></i>
                </button>

                <button class="btn-excluir" onclick="excluirDespesa(${item.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        fragment.appendChild(li);
    }

    listaDespesasEl.appendChild(fragment);
}

function editarDespesa(id) {
    const item = listaDespesas.find(d => d.id === id);
    if (!item) return;

    const nomeDespesaEl = getEl('nomeDespesa');
    const valorDespesaEl = getEl('valorDespesa');
    const dataVencimentoEl = getEl('dataVencimento');
    const statusDespesaEl = getEl('statusDespesa');
    const recorrenteDespesaEl = getEl('recorrenteDespesa');
    const tituloModalEl = getEl('tituloModal');

    if (!nomeDespesaEl || !valorDespesaEl || !dataVencimentoEl || !statusDespesaEl || !recorrenteDespesaEl) return;

    editandoId = id;
    nomeDespesaEl.value = item.nome;
    valorDespesaEl.value = item.valor;
    dataVencimentoEl.value = item.data;
    statusDespesaEl.value = item.status === 'pago' ? 'pago' : 'pendente';
    recorrenteDespesaEl.checked = item.recorrente;
    if (tituloModalEl) tituloModalEl.textContent = 'Editar Conta';

    const modalDespesaEl = getEl('modalDespesa');
    if (modalDespesaEl) modalDespesaEl.classList.add('active');
}

function marcarComoPago(id) {
    const index = listaDespesas.findIndex(d => d.id === id);
    if (index === -1) return;

    const item = listaDespesas[index];
    const valor = Number(item.valor) || 0;
    const statusAtual = item.status === 'pago' ? 'pago' : 'pendente';

    if (statusAtual !== 'pago') {
        item.status = 'pago';
        registrarTransacaoCarteira('saida', valor, `Pagamento de despesa: ${item.nome}`);
    } else {
        item.status = 'pendente';
        registrarTransacaoCarteira('entrada', valor, `Estorno de despesa: ${item.nome}`);
    }

    salvarStorage();
    atualizarLista();
}

function excluirDespesa(id) {
    listaDespesas = listaDespesas.filter(d => d.id !== id);
    salvarStorage();
    atualizarLista();
}

function filtrarDespesas(tipo, btn) {
    filtroAtual = tipo;
    document.querySelectorAll('.tab-btn').forEach(botao => botao.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderLista();
}

function salvarStorage() {
    localStorage.setItem(STORAGE_DESPESAS, JSON.stringify(listaDespesas));
    localStorage.setItem(STORAGE_CARTEIRA, String(saldoCarteira));
    localStorage.setItem(STORAGE_HISTORICO, JSON.stringify(historicoCarteira));
}
