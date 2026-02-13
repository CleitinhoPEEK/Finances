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
    throw new Error('common.js nao foi carregado antes de resumo-ano.js');
}

const {
    NOMES_MESES: nomesMeses,
    getEl,
    formatarMoeda,
    getDataLocal,
    escapeHtml,
    baixarJson,
    iniciarAnimacaoEntradaPagina
} = Common;

let resumoAnualAtual = [];
let graficoResumoAtivo = false;
let modoGraficoAtual = 'lucro_mes';
let temaTransicaoTimer = null;
const ordenacaoTabelaResumo = {
    metrica: 'recebido',
    ordem: 'desc'
};

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

function carregarDados() {
    const clientes = JSON.parse(localStorage.getItem(STORAGE_CLIENTES)) || [];
    const despesas = JSON.parse(localStorage.getItem(STORAGE_DESPESAS)) || [];
    return { clientes, despesas };
}

function calcularResumoAnual(ano, clientes, despesas) {
    const meses = Array.from({ length: 12 }, (_, mes) => ({
        mes,
        recebido: 0,
        pendente: 0,
        despesasPagas: 0,
        liquido: 0
    }));

    for (const cliente of clientes) {
        const data = getDataLocal(cliente.data);
        if (data.getFullYear() !== ano) continue;

        const mes = data.getMonth();
        const valorTotal = Number(cliente.valor) || 0;
        const valorPago = Number(cliente.pagoParcial) || 0;

        meses[mes].recebido += cliente.pago ? valorTotal : valorPago;
        if (!cliente.pago) {
            meses[mes].pendente += Math.max(0, valorTotal - valorPago);
        }
    }

    for (const despesa of despesas) {
        const data = getDataLocal(despesa.data);
        if (data.getFullYear() !== ano) continue;

        const mes = data.getMonth();
        const valor = Number(despesa.valor) || 0;
        if (despesa.status === 'pago') meses[mes].despesasPagas += valor;
    }

    for (const item of meses) {
        item.liquido = item.recebido - item.despesasPagas;
    }

    return meses;
}

function obterValorMetrica(item, metrica) {
    if (metrica === 'recebido') return item.recebido;
    if (metrica === 'pendente') return item.pendente;
    if (metrica === 'despesasPagas') return item.despesasPagas;
    return item.liquido;
}

function obterConfiguracaoModoGrafico(modo) {
    const configuracoes = {
        lucro_mes: {
            titulo: 'Lucro por mes',
            metrica: 'liquido',
            ordem: 'mes_crescente',
            destaque: 'maior_lucro'
        },
        pior_mes: {
            titulo: 'Pior mes por lucro',
            metrica: 'liquido',
            ordem: 'valor_crescente',
            destaque: 'menor_valor'
        },
        faturamento_decrescente: {
            titulo: 'Faturamento por mes (decrescente)',
            metrica: 'recebido',
            ordem: 'valor_decrescente',
            destaque: 'maior_valor'
        },
        faturamento_crescente: {
            titulo: 'Faturamento por mes (crescente)',
            metrica: 'recebido',
            ordem: 'valor_crescente',
            destaque: 'menor_valor'
        },
        lucro_decrescente: {
            titulo: 'Lucro por mes (decrescente)',
            metrica: 'liquido',
            ordem: 'valor_decrescente',
            destaque: 'maior_valor'
        },
        lucro_crescente: {
            titulo: 'Lucro por mes (crescente)',
            metrica: 'liquido',
            ordem: 'valor_crescente',
            destaque: 'menor_valor'
        },
        maior_lucro: {
            titulo: 'Maior lucro no ano',
            metrica: 'liquido',
            ordem: 'valor_decrescente',
            destaque: 'maior_lucro'
        },
        menor_lucro: {
            titulo: 'Menor lucro no ano',
            metrica: 'liquido',
            ordem: 'valor_crescente',
            destaque: 'menor_lucro'
        },
        despesas_decrescente: {
            titulo: 'Despesas pagas por mes (decrescente)',
            metrica: 'despesasPagas',
            ordem: 'valor_decrescente',
            destaque: 'maior_valor'
        },
        pendente_decrescente: {
            titulo: 'Pendencias por mes (decrescente)',
            metrica: 'pendente',
            ordem: 'valor_decrescente',
            destaque: 'maior_valor'
        }
    };

    return configuracoes[modo] || configuracoes.lucro_mes;
}

function ordenarMesesGrafico(meses, configuracao) {
    const itens = meses.map(item => ({
        ...item,
        valorGrafico: obterValorMetrica(item, configuracao.metrica)
    }));

    const comparadorValor = (a, b) => {
        if (a.valorGrafico !== b.valorGrafico) return a.valorGrafico - b.valorGrafico;
        return a.mes - b.mes;
    };

    if (configuracao.ordem === 'mes_crescente') {
        itens.sort((a, b) => a.mes - b.mes);
    } else if (configuracao.ordem === 'mes_decrescente') {
        itens.sort((a, b) => b.mes - a.mes);
    } else if (configuracao.ordem === 'valor_crescente') {
        itens.sort(comparadorValor);
    } else if (configuracao.ordem === 'valor_decrescente') {
        itens.sort((a, b) => comparadorValor(b, a));
    }

    return itens;
}

function obterMesExtremo(meses, campo, tipo = 'max') {
    if (!Array.isArray(meses) || !meses.length) return null;
    const copia = [...meses];
    copia.sort((a, b) => {
        if (a[campo] !== b[campo]) return tipo === 'max' ? b[campo] - a[campo] : a[campo] - b[campo];
        return a.mes - b.mes;
    });
    return copia[0] || null;
}

function obterTextoResumoGrafico(mesesOrdenados, configuracao) {
    const maiorLucro = obterMesExtremo(mesesOrdenados, 'liquido', 'max');
    const menorLucro = obterMesExtremo(mesesOrdenados, 'liquido', 'min');
    const maiorMetrica = obterMesExtremo(mesesOrdenados, 'valorGrafico', 'max');
    const menorMetrica = obterMesExtremo(mesesOrdenados, 'valorGrafico', 'min');

    const principal = getEl('resumo-ano-melhor-mes');
    const secundario = getEl('resumo-ano-insights');
    if (!principal || !secundario) return;

    if (!maiorMetrica || !menorMetrica || !maiorLucro || !menorLucro) {
        principal.textContent = '-';
        principal.className = 'resumo-ano-melhor-mes destaque-neutro';
        secundario.textContent = '-';
        return;
    }

    let textoPrincipal = '';
    let valorPrincipal = maiorMetrica.valorGrafico;
    if (modoGraficoAtual === 'pior_mes') {
        textoPrincipal = `Pior mes (lucro): ${nomesMeses[menorMetrica.mes]} (${formatarMoeda(menorMetrica.valorGrafico)})`;
        valorPrincipal = menorMetrica.valorGrafico;
    } else if (modoGraficoAtual === 'maior_lucro') {
        textoPrincipal = `Maior lucro: ${nomesMeses[maiorLucro.mes]} (${formatarMoeda(maiorLucro.liquido)})`;
        valorPrincipal = maiorLucro.liquido;
    } else if (modoGraficoAtual === 'menor_lucro') {
        textoPrincipal = `Menor lucro: ${nomesMeses[menorLucro.mes]} (${formatarMoeda(menorLucro.liquido)})`;
        valorPrincipal = menorLucro.liquido;
    } else {
        textoPrincipal = `Maior ${configuracao.titulo.toLowerCase()}: ${nomesMeses[maiorMetrica.mes]} (${formatarMoeda(maiorMetrica.valorGrafico)})`;
        valorPrincipal = maiorMetrica.valorGrafico;
    }

    principal.textContent = textoPrincipal;
    principal.className = `resumo-ano-melhor-mes ${valorPrincipal >= 0 ? 'destaque-positivo' : 'destaque-neutro'}`;
    secundario.textContent = `Maior lucro: ${nomesMeses[maiorLucro.mes]} (${formatarMoeda(maiorLucro.liquido)}) | Menor lucro: ${nomesMeses[menorLucro.mes]} (${formatarMoeda(menorLucro.liquido)})`;
}

function obterMesesDestaque(mesesOrdenados, configuracao) {
    const destaque = new Set();
    if (!mesesOrdenados.length) return destaque;

    if (configuracao.destaque === 'maior_valor') destaque.add(mesesOrdenados[0].mes);
    if (configuracao.destaque === 'menor_valor') destaque.add(mesesOrdenados[0].mes);

    if (configuracao.destaque === 'maior_lucro') {
        const item = obterMesExtremo(mesesOrdenados, 'liquido', 'max');
        if (item) destaque.add(item.mes);
    }

    if (configuracao.destaque === 'menor_lucro') {
        const item = obterMesExtremo(mesesOrdenados, 'liquido', 'min');
        if (item) destaque.add(item.mes);
    }

    return destaque;
}

function renderizarGraficoResumo(meses) {
    const lista = getEl('resumo-ano-grafico-lista');
    const titulo = getEl('resumo-ano-grafico-titulo') || document.querySelector('.resumo-ano-grafico-titulo');
    const graficoWrap = getEl('resumo-ano-grafico-wrap');
    const configuracao = obterConfiguracaoModoGrafico(modoGraficoAtual);
    if (!lista) return;

    if (graficoWrap) {
        graficoWrap.dataset.metrica = configuracao.metrica;
        graficoWrap.dataset.modo = modoGraficoAtual;
    }

    if (!Array.isArray(meses) || meses.length === 0) {
        lista.innerHTML = '<p class="resumo-ano-grafico-vazio">Sem dados para exibir no ano selecionado.</p>';
        const principal = getEl('resumo-ano-melhor-mes');
        const secundario = getEl('resumo-ano-insights');
        if (principal) {
            principal.textContent = '-';
            principal.className = 'resumo-ano-melhor-mes destaque-neutro';
        }
        if (secundario) secundario.textContent = '-';
        return;
    }

    const mesesOrdenados = ordenarMesesGrafico(meses, configuracao);
    const mesesDestaque = obterMesesDestaque(mesesOrdenados, configuracao);

    if (titulo) titulo.textContent = `${configuracao.titulo} (grafico vertical)`;
    obterTextoResumoGrafico(mesesOrdenados, configuracao);

    const valores = mesesOrdenados.map(item => item.valorGrafico);
    const semVariacao = valores.every(valor => Math.abs(valor) < 0.000001);
    const maxPositivo = Math.max(0, ...valores);
    const maxNegativoAbs = Math.max(0, ...valores.map(valor => (valor < 0 ? Math.abs(valor) : 0)));
    const somaEscalas = maxPositivo + maxNegativoAbs || 1;

    let regiaoPositivaPct = maxNegativoAbs === 0 ? 100 : (maxPositivo / somaEscalas) * 100;
    let regiaoNegativaPct = maxPositivo === 0 ? 100 : (maxNegativoAbs / somaEscalas) * 100;

    if (maxPositivo > 0 && maxNegativoAbs > 0) {
        regiaoPositivaPct = Math.max(25, Math.min(75, regiaoPositivaPct));
        regiaoNegativaPct = 100 - regiaoPositivaPct;
    }

    const fragment = document.createDocumentFragment();

    for (const item of mesesOrdenados) {
        const coluna = document.createElement('div');
        const valor = item.valorGrafico;
        const classeValor = semVariacao ? 'neutro' : (valor >= 0 ? 'positivo' : 'negativo');
        const destaqueClasse = mesesDestaque.has(item.mes) ? ' destaque' : '';

        let preenchimentoPositivo = 0;
        let preenchimentoNegativo = 0;

        if (semVariacao) {
            preenchimentoPositivo = 42;
            preenchimentoNegativo = 0;
        } else {
            if (valor >= 0 && maxPositivo > 0) preenchimentoPositivo = (valor / maxPositivo) * 100;
            if (valor < 0 && maxNegativoAbs > 0) preenchimentoNegativo = (Math.abs(valor) / maxNegativoAbs) * 100;
        }

        const zeroLine = regiaoPositivaPct.toFixed(2);
        const classeComNegativo = maxNegativoAbs > 0 && maxPositivo > 0 ? ' tem-negativo' : '';

        coluna.className = `resumo-ano-coluna${destaqueClasse}`;
        coluna.innerHTML = `
            <span class="resumo-ano-coluna-valor ${classeValor}">${formatarMoeda(valor)}</span>
            <div class="resumo-ano-coluna-track${classeComNegativo}" style="--zero-line:${zeroLine}%;">
                <div class="resumo-ano-coluna-regiao positivo" style="height:${regiaoPositivaPct.toFixed(2)}%">
                    <span class="resumo-ano-coluna-bar ${classeValor === 'negativo' ? 'positivo' : classeValor}" style="height:${preenchimentoPositivo.toFixed(2)}%"></span>
                </div>
                <div class="resumo-ano-coluna-regiao negativo" style="height:${regiaoNegativaPct.toFixed(2)}%">
                    <span class="resumo-ano-coluna-bar negativo" style="height:${preenchimentoNegativo.toFixed(2)}%"></span>
                </div>
            </div>
            <span class="resumo-ano-coluna-mes">${escapeHtml(nomesMeses[item.mes].slice(0, 3))}</span>
        `;

        fragment.appendChild(coluna);
    }

    lista.innerHTML = '';
    lista.appendChild(fragment);
}

function aplicarVisualizacaoResumo() {
    const tabelaWrap = getEl('resumo-ano-tabela-wrap');
    const graficoWrap = getEl('resumo-ano-grafico-wrap');
    const botao = getEl('btn-alternar-grafico');
    const controlesTabela = document.querySelector('.resumo-ano-tabela-controles');
    if (!tabelaWrap || !graficoWrap || !botao) return;

    const mostrarGrafico = graficoResumoAtivo;
    tabelaWrap.classList.remove('resumo-ano-oculto');
    graficoWrap.classList.remove('resumo-ano-oculto');
    tabelaWrap.classList.toggle('resumo-ano-painel-oculto', mostrarGrafico);
    graficoWrap.classList.toggle('resumo-ano-painel-oculto', !mostrarGrafico);
    tabelaWrap.setAttribute('aria-hidden', mostrarGrafico ? 'true' : 'false');
    graficoWrap.setAttribute('aria-hidden', mostrarGrafico ? 'false' : 'true');
    if (controlesTabela) controlesTabela.classList.toggle('oculto-grafico', mostrarGrafico);

    if (mostrarGrafico) {
        botao.innerHTML = '<i class="fa-solid fa-table-list"></i><span>Ver tabela</span>';
    } else {
        botao.innerHTML = '<i class="fa-solid fa-chart-column"></i><span>Ver grafico</span>';
    }
}

function alternarGraficoResumo() {
    graficoResumoAtivo = !graficoResumoAtivo;
    aplicarVisualizacaoResumo();
}

function obterValorOrdenacaoTabela(item, metrica) {
    if (metrica === 'mes') return item.mes;
    if (metrica === 'recebido') return item.recebido;
    if (metrica === 'pendente') return item.pendente;
    if (metrica === 'despesasPagas') return item.despesasPagas;
    return item.liquido;
}

function obterMesesOrdenadosTabela(meses) {
    const itens = [...meses];
    const { metrica, ordem } = ordenacaoTabelaResumo;

    itens.sort((a, b) => {
        const valorA = obterValorOrdenacaoTabela(a, metrica);
        const valorB = obterValorOrdenacaoTabela(b, metrica);

        if (valorA !== valorB) {
            return ordem === 'asc' ? valorA - valorB : valorB - valorA;
        }

        return a.mes - b.mes;
    });

    return itens;
}

function atualizarBotaoOrdenacaoTabelaResumo() {
    const botao = getEl('btn-ordenar-tabela-resumo');
    if (!botao) return;

    if (ordenacaoTabelaResumo.ordem === 'asc') {
        botao.innerHTML = '<i class="fa-solid fa-arrow-up-wide-short"></i><span>Crescente</span>';
    } else {
        botao.innerHTML = '<i class="fa-solid fa-arrow-down-wide-short"></i><span>Decrescente</span>';
    }
}

function alternarOrdemTabelaResumo() {
    ordenacaoTabelaResumo.ordem = ordenacaoTabelaResumo.ordem === 'asc' ? 'desc' : 'asc';
    atualizarBotaoOrdenacaoTabelaResumo();
    renderizarResumo(obterAnoSelecionado(), resumoAnualAtual);
}

function configurarControlesTabelaResumo() {
    const seletorMetrica = getEl('resumo-tabela-metrica');
    if (!seletorMetrica) return;

    seletorMetrica.value = ordenacaoTabelaResumo.metrica;
    seletorMetrica.addEventListener('change', () => {
        ordenacaoTabelaResumo.metrica = seletorMetrica.value;
        renderizarResumo(obterAnoSelecionado(), resumoAnualAtual);
    });

    atualizarBotaoOrdenacaoTabelaResumo();
}

function configurarControlesGraficoResumo() {
    const seletorModo = getEl('resumo-grafico-modo');
    if (!seletorModo) return;

    seletorModo.value = modoGraficoAtual;
    seletorModo.addEventListener('change', () => {
        modoGraficoAtual = seletorModo.value;
        renderizarGraficoResumo(resumoAnualAtual);
    });
}

function renderizarResumo(ano, meses) {
    const titulo = getEl('titulo-resumo-ano');
    if (titulo) titulo.textContent = `Resumo anual ${ano}`;

    const totalRecebido = meses.reduce((acc, mes) => acc + mes.recebido, 0);
    const totalPendente = meses.reduce((acc, mes) => acc + mes.pendente, 0);
    const totalDespesas = meses.reduce((acc, mes) => acc + mes.despesasPagas, 0);
    const totalLiquido = meses.reduce((acc, mes) => acc + mes.liquido, 0);

    const recebidoEl = getEl('resumo-total-recebido');
    const pendenteEl = getEl('resumo-total-pendente');
    const lucroEl = getEl('resumo-total-lucro');
    const despesasEl = getEl('resumo-total-despesas');

    if (recebidoEl) recebidoEl.textContent = formatarMoeda(totalRecebido);
    if (pendenteEl) pendenteEl.textContent = formatarMoeda(totalPendente);
    if (lucroEl) lucroEl.textContent = formatarMoeda(totalLiquido);
    if (despesasEl) despesasEl.textContent = formatarMoeda(totalDespesas);
    if (lucroEl) lucroEl.style.color = totalLiquido >= 0 ? 'var(--success)' : 'var(--danger)';

    const corpo = getEl('resumo-ano-corpo');
    if (!corpo) return;
    const tabela = getEl('tabela-resumo-ano');
    if (tabela) {
        tabela.dataset.metricaOrdenacao = ordenacaoTabelaResumo.metrica;
        tabela.dataset.ordemOrdenacao = ordenacaoTabelaResumo.ordem;
    }

    const fragment = document.createDocumentFragment();

    const mesesOrdenadosTabela = obterMesesOrdenadosTabela(meses);

    for (let indice = 0; indice < mesesOrdenadosTabela.length; indice += 1) {
        const item = mesesOrdenadosTabela[indice];
        const tr = document.createElement('tr');
        if (indice === 0) tr.className = 'resumo-tabela-linha-topo';
        tr.innerHTML = `
            <td><strong>${escapeHtml(nomesMeses[item.mes])}</strong></td>
            <td>${formatarMoeda(item.recebido)}</td>
            <td>${formatarMoeda(item.pendente)}</td>
            <td class="${item.liquido >= 0 ? 'resumo-liquido-positivo' : 'resumo-liquido-negativo'}">${formatarMoeda(item.liquido)}</td>
            <td>${formatarMoeda(item.despesasPagas)}</td>
            <td>
                <div class="resumo-acoes-mes">
                    <button class="btn-mini" onclick="abrirMesNoIndex(${item.mes})">Index</button>
                    <button class="btn-mini btn-mini-alt" onclick="abrirMesEmDespesas()">Despesas</button>
                    <button class="btn-mini btn-mini-eco" onclick="abrirEconomias()">Economias</button>
                </div>
            </td>
        `;
        fragment.appendChild(tr);
    }

    corpo.innerHTML = '';
    corpo.appendChild(fragment);

    resumoAnualAtual = meses;
    atualizarBotaoOrdenacaoTabelaResumo();
    renderizarGraficoResumo(resumoAnualAtual);
    aplicarVisualizacaoResumo();
}

function abrirMesNoIndex() {
    window.location.href = 'index.html';
}

function abrirMesEmDespesas() {
    window.location.href = 'despesas.html';
}

function abrirEconomias() {
    window.location.href = 'economias.html';
}

function irParaInicio() {
    localStorage.setItem(STORAGE_SIDEBAR_RETORNO_FECHADA, '1');
    localStorage.setItem(STORAGE_PULAR_SPLASH_ENTRADA, '1');
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    carregarTema();
    iniciarAnimacaoEntradaPagina();
    aplicarEstadoInicialSidebar();
    configurarGestosSidebarMobile();
    configurarControlesTabelaResumo();
    configurarControlesGraficoResumo();
    const ano = obterAnoSelecionado();
    const { clientes, despesas } = carregarDados();
    const resumo = calcularResumoAnual(ano, clientes, despesas);
    renderizarResumo(ano, resumo);
});
