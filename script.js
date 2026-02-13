/* =========================================
   Configuracoes e estado
   ========================================= */
const STORAGE_CLIENTES = 'cobrancas_2026';
const STORAGE_SALDO = 'cofrinho_saldo';
const STORAGE_HISTORICO = 'cofrinho_historico';
const STORAGE_POUPANCA = 'poupanca_saldo';
const STORAGE_HIST_POUPANCA = 'poupanca_historico';
const STORAGE_SIDEBAR_RETORNO_FECHADA = 'sidebar_retorno_fechada';
const STORAGE_PULAR_SPLASH_ENTRADA = 'pular_splash_entrada_once';

const DURACAO_TRANSICAO_TEMA = 420;
const DURACAO_SPLASH_TOTAL = 4600;
const DURACAO_SPLASH_FADE = 1100;
const DURACAO_SPLASH_TELA_WORDMARK = 1450;

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
    baixarJson,
    iniciarAnimacaoEntradaPagina
} = Common;

let cobrancas = JSON.parse(localStorage.getItem(STORAGE_CLIENTES)) || [];
let saldoCarteira = Number(localStorage.getItem(STORAGE_SALDO)) || 0;
let historicoCarteira = JSON.parse(localStorage.getItem(STORAGE_HISTORICO)) || [];
let saldoPoupanca = Number(localStorage.getItem(STORAGE_POUPANCA)) || 0;
let historicoPoupanca = JSON.parse(localStorage.getItem(STORAGE_HIST_POUPANCA)) || [];

function obterMesInicial() {
    return new Date().getMonth();
}

let abaAtiva = 'todos';
let mesAtivo = obterMesInicial();
let temaTransicaoTimer = null;
let buscaDebounceTimer = null;
let notificacaoSinoJaClicado = false;

const isPaginaEconomias = () => Boolean(getEl('lista-extrato') || getEl('extrato-poupanca'));

function extrairReferenciaHistorico(item) {
    if (!item) return null;

    const timestamp = Number(item.timestamp);
    if (Number.isFinite(timestamp)) {
        const data = new Date(timestamp);
        const mes = data.getMonth();
        const ano = data.getFullYear();
        if (!Number.isInteger(mes)) return null;
        return { mes, ano };
    }

    const textoData = String(item.data ?? '');
    const match = textoData.match(/(\d{2})\/(\d{2})(?:\/(\d{4}))?/);
    if (!match) return null;

    const mes = Number(match[2]) - 1;
    if (!Number.isInteger(mes) || mes < 0 || mes > 11) return null;

    const ano = match[3] ? Number(match[3]) : new Date().getFullYear();
    if (!Number.isInteger(ano)) return null;

    return { mes, ano };
}

function calcularSaldoHistoricoDoMes(listaDados) {
    const anoAtual = new Date().getFullYear();
    return (listaDados || []).reduce((total, item) => {
        const referencia = extrairReferenciaHistorico(item);
        if (!referencia) return total;
        if (referencia.ano !== anoAtual || referencia.mes !== mesAtivo) return total;

        const valor = Number(item.valor) || 0;
        const isEntrada = item.tipo === 'depositar' || item.tipo === 'entrada';
        return total + (isEntrada ? valor : -valor);
    }, 0);
}

function obterDataReferenciaMesSelecionado() {
    const agora = new Date();
    if (!isPaginaEconomias()) return agora;

    const ano = agora.getFullYear();
    const ultimoDiaMes = new Date(ano, mesAtivo + 1, 0).getDate();
    const dia = Math.min(agora.getDate(), ultimoDiaMes);

    return new Date(
        ano,
        mesAtivo,
        dia,
        agora.getHours(),
        agora.getMinutes(),
        agora.getSeconds(),
        agora.getMilliseconds()
    );
}

function filtrarHistoricoPorMes(listaDados) {
    const anoAtual = new Date().getFullYear();
    return (listaDados || []).filter(item => {
        const referencia = extrairReferenciaHistorico(item);
        if (!referencia) return true;
        return referencia.ano === anoAtual && referencia.mes === mesAtivo;
    });
}

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
    const appWrapper = getEl('app-wrapper');
    if (appWrapper) appWrapper.classList.add('sidebar-closed');
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

function iniciarAutoOcultarSubtituloEconomias() {
    const subtitulo = document.querySelector('.subtitulo-economias');
    if (!subtitulo) return;

    setTimeout(() => {
        subtitulo.classList.add('oculto');
    }, 8000);
}

function iniciarParticulasSplash() {
    const canvas = document.getElementById('intro-splash-canvas');
    if (!canvas) return;

    const reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduzirMovimento) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    const start = performance.now();

    const particles = [];
    const maxParticulas = Math.min(90, Math.max(35, Math.floor((window.innerWidth * window.innerHeight) / 26000)));

    const resize = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        w = canvas.clientWidth = window.innerWidth;
        h = canvas.clientHeight = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const rand = (min, max) => min + Math.random() * (max - min);

    const spawn = () => {
        particles.length = 0;
        for (let i = 0; i < maxParticulas; i += 1) {
            particles.push({
                x: rand(0, w),
                y: rand(0, h),
                r: rand(0.8, 2.6),
                vx: rand(-0.10, 0.10),
                vy: rand(-0.06, 0.14),
                a: rand(0.10, 0.42),
                tw: rand(0.004, 0.012),
                ph: rand(0, Math.PI * 2)
            });
        }
    };

    const draw = t => {
        const time = t - start;

        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, 0, w, h);

        for (const p of particles) {
            p.x += p.vx * (1 + Math.sin(time * 0.001));
            p.y += p.vy * (1 + Math.cos(time * 0.001));

            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;
            if (p.y < -10) p.y = h + 10;
            if (p.y > h + 10) p.y = -10;

            const twinkle = 0.55 + 0.45 * Math.sin(time * p.tw + p.ph);
            const alpha = p.a * twinkle;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < particles.length; i += 1) {
            const a = particles[i];
            for (let j = i + 1; j < particles.length; j += 1) {
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < 120 * 120) {
                    const d = Math.sqrt(d2);
                    const alpha = (1 - d / 120) * 0.08;
                    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
        resize();
        spawn();
    };

    window.addEventListener('resize', onResize, { passive: true });
    resize();
    spawn();
    raf = requestAnimationFrame(draw);

    const splash = document.getElementById('intro-splash');
    const stop = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
    };

    const obs = new MutationObserver(() => {
        if (!splash || !splash.isConnected) {
            stop();
            obs.disconnect();
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
}

function prepararSomSplash() {
    const btn = document.getElementById('intro-splash-sound');
    if (!btn) return;

    const reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduzirMovimento) {
        btn.style.display = 'none';
        return;
    }

    let ctx = null;

    const tocar = async () => {
        try {
            ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
            await ctx.resume();

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.30);

            btn.textContent = 'som ligado';
            btn.disabled = true;
            btn.style.opacity = '0.55';
        } catch (_) {
            btn.style.display = 'none';
        }
    };

    btn.addEventListener('click', tocar, { once: true });
}

function ativarParallaxLogo() {
    const logo = document.querySelector('.logo-svg-pro');
    if (!logo) return;

    document.addEventListener('mousemove', e => {
        const x = (e.clientX / window.innerWidth - 0.5) * 10;
        const y = (e.clientY / window.innerHeight - 0.5) * 10;
        logo.style.transform = `scale(1) rotateX(${y}deg) rotateY(${x}deg)`;
    });
}

function iniciarSplashAbertura() {
    const splash = getEl('intro-splash');
    if (!splash) {
        iniciarAnimacaoEntradaPagina();
        return;
    }

    if (localStorage.getItem(STORAGE_PULAR_SPLASH_ENTRADA) === '1') {
        localStorage.removeItem(STORAGE_PULAR_SPLASH_ENTRADA);
        splash.remove();
        iniciarAnimacaoEntradaPagina();
        return;
    }

    iniciarParticulasSplash();
    ativarParallaxLogo();
    prepararSomSplash();

    const barraProgresso = splash.querySelector('.intro-splash-progress-fill');

    const atrasoWordmark = Math.max(0, DURACAO_SPLASH_TOTAL - DURACAO_SPLASH_FADE);
    const duracaoProgresso = Math.max(1, atrasoWordmark);
    const inicio = performance.now();

    const atualizarBarra = agora => {
        if (!barraProgresso || !splash.isConnected) return;
        const progresso = Math.min(1, (agora - inicio) / duracaoProgresso);
        barraProgresso.style.transform = `scaleX(${progresso})`;
        if (progresso < 1) requestAnimationFrame(atualizarBarra);
    };

    if (barraProgresso) requestAnimationFrame(atualizarBarra);

    setTimeout(() => {
        splash.classList.add('splash-show-wordmark');
    }, atrasoWordmark);

    setTimeout(() => {
        iniciarAnimacaoEntradaPagina();
        splash.classList.add('splash-fade');
    }, atrasoWordmark + DURACAO_SPLASH_TELA_WORDMARK);

    setTimeout(() => {
        splash.classList.add('splash-hidden');
        splash.remove();
    }, atrasoWordmark + DURACAO_SPLASH_TELA_WORDMARK + DURACAO_SPLASH_FADE + 40);
}

function parseValorEdicao(valor) {
    const texto = String(valor ?? '').trim();
    if (!texto) return NaN;

    // Aceita formatos com virgula/ponto e remove separador de milhar quando necessario.
    const normalizado = texto.includes(',')
        ? texto.replace(/\./g, '').replace(',', '.')
        : texto;

    return Number.parseFloat(normalizado);
}

function formatarValorEdicao(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '';
    return numero.toFixed(2).replace('.', ',');
}

function normalizarCampoValorEdicao(input) {
    if (!input) return;
    const valor = parseValorEdicao(input.value);
    input.value = Number.isFinite(valor) ? formatarValorEdicao(valor) : '';
}

function prepararLimpezaCampoValor(input) {
    if (!input) return;

    input.addEventListener('focus', () => {
        if (input.dataset.autoClearArmed === '1') {
            input.dataset.autoClearOriginal = input.value;
            input.dataset.autoClearPending = '1';
            input.dataset.autoClearDigitou = '0';
            input.value = '';
            input.dataset.autoClearArmed = '0';
            return;
        }

        input.select();
    });

    input.addEventListener('input', () => {
        if (input.dataset.autoClearPending === '1') {
            input.dataset.autoClearDigitou = '1';
        }
    });

    input.addEventListener('blur', () => {
        const aguardandoAutoRestore = input.dataset.autoClearPending === '1';
        const digitouAlgo = input.dataset.autoClearDigitou === '1';
        const valorVazio = input.value.trim() === '';

        if (aguardandoAutoRestore && !digitouAlgo && valorVazio) {
            input.value = input.dataset.autoClearOriginal || '';
        } else {
            normalizarCampoValorEdicao(input);
        }

        input.dataset.autoClearPending = '0';
        input.dataset.autoClearDigitou = '0';
        input.dataset.autoClearOriginal = '';
    });
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

function registrarTransacaoCarteira(tipo, valor, descricao, dataReferencia = new Date()) {
    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return;
    const dataHistorico = dataReferencia instanceof Date ? new Date(dataReferencia.getTime()) : new Date();
    if (Number.isNaN(dataHistorico.getTime())) return;

    if (tipo === 'entrada') saldoCarteira += valorNumerico;
    else saldoCarteira -= valorNumerico;

    historicoCarteira.unshift({
        tipo: tipo === 'entrada' ? 'depositar' : 'sacar',
        valor: valorNumerico,
        descricao,
        timestamp: dataHistorico.getTime(),
        data: dataHistorico.toLocaleString('pt-BR', {
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
                    <button class="btn-proximo" onclick="copiarProximo(${cliente.id})" aria-label="Copiar para o proximo mes"><i class="fa-solid fa-forward" aria-hidden="true"></i></button>
                    <button onclick="abrirMenuWhats(${cliente.id})" class="btn-whatsapp"><i class="fab fa-whatsapp" aria-hidden="true"></i></button>
                    <button class="btn-editar" onclick="abrirEdicao(${cliente.id})" aria-label="Editar"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
                    <button class="btn-pagar" onclick="togglePago(${cliente.id})" aria-label="${cliente.pago ? 'Desmarcar como pago' : 'Marcar como pago'}"><i class="fa-solid ${cliente.pago ? 'fa-rotate-left' : 'fa-check'}" aria-hidden="true"></i></button>
                    <button class="btn-excluir" onclick="excluir(${cliente.id})" aria-label="Excluir"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
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

function atualizarContadorBusca(totalClientes, termoBusca) {
    const contador = getEl('contador-busca');
    if (!contador) return;

    if (!termoBusca) {
        contador.hidden = true;
        contador.textContent = '';
        return;
    }

    const plural = totalClientes === 1 ? 'cliente' : 'clientes';
    contador.textContent = `${totalClientes} ${plural}`;
    contador.hidden = false;
}

function alternarPainelNotificacoes(forcarAberto = null) {
    const container = getEl('notificacoes-hoje');
    const botao = getEl('btn-notificacoes-hoje');
    const painel = getEl('notificacoes-hoje-painel');
    if (!container || !botao || !painel) return;

    const abrir = typeof forcarAberto === 'boolean' ? forcarAberto : painel.hidden;
    painel.hidden = !abrir;
    container.classList.toggle('aberto', abrir);
    botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
}

function configurarPainelNotificacoes() {
    const container = getEl('notificacoes-hoje');
    const botao = getEl('btn-notificacoes-hoje');
    const painel = getEl('notificacoes-hoje-painel');
    if (!container || !botao || !painel) return;

    botao.addEventListener('click', event => {
        event.stopPropagation();
        notificacaoSinoJaClicado = true;
        botao.classList.remove('balancando');
        alternarPainelNotificacoes();
    });

    painel.addEventListener('click', event => {
        event.stopPropagation();
    });

    document.addEventListener('click', event => {
        if (!container.contains(event.target)) alternarPainelNotificacoes(false);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') alternarPainelNotificacoes(false);
    });
}

function getNotificacoesPagamentoHoje() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const grupos = new Map();

    for (const cliente of cobrancas) {
        if (cliente.pago) continue;

        const dataVencimento = getVencimentoDate(cliente.data);
        dataVencimento.setHours(0, 0, 0, 0);
        if (dataVencimento.getTime() !== hoje.getTime()) continue;

        const valorTotal = Number(cliente.valor) || 0;
        const valorPago = Number(cliente.pagoParcial) || 0;
        const valorRestante = Math.max(0, valorTotal - valorPago);
        if (valorRestante <= 0) continue;

        const nomeBase = String(cliente.nome || '').split(' (')[0];
        if (!grupos.has(nomeBase)) {
            grupos.set(nomeBase, {
                nome: nomeBase,
                data: cliente.data,
                valorRestante: 0,
                quantidade: 0
            });
        }

        const acumulado = grupos.get(nomeBase);
        acumulado.valorRestante += valorRestante;
        acumulado.quantidade += 1;
    }

    const notificacoes = Array.from(grupos.values());
    notificacoes.sort((a, b) => {
        const ordemNome = a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
        if (ordemNome !== 0) return ordemNome;
        return a.valorRestante - b.valorRestante;
    });

    return notificacoes;
}

function normalizarTextoBusca(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escaparRegex(texto) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clienteEhParcelado(cliente) {
    return String(cliente?.nome || '').includes('(');
}

function clienteCorrespondeSituacao(cliente, dataVencimento, hoje, situacao) {
    if (situacao === 'atrasados') return !cliente.pago && dataVencimento < hoje;
    if (situacao === 'pendentes') return !cliente.pago && dataVencimento >= hoje;
    if (situacao === 'pagos') return !!cliente.pago;
    if (situacao === 'parcelados') return clienteEhParcelado(cliente);
    return true;
}

function extrairFiltroBusca(texto) {
    const termoNormalizado = normalizarTextoBusca(texto);
    const semPontuacao = termoNormalizado.replace(/[.,;:!?]+/g, ' ').replace(/\s+/g, ' ').trim();

    if (!semPontuacao) {
        return {
            ativa: false,
            listarTudo: false,
            situacao: null,
            nome: '',
            termoOriginal: ''
        };
    }

    if (semPontuacao === 'a' || semPontuacao === 'all') {
        return {
            ativa: true,
            listarTudo: true,
            situacao: null,
            nome: '',
            termoOriginal: semPontuacao
        };
    }

    const aliasesSituacao = [
        { situacao: 'atrasados', termos: ['devendo', 'devedor', 'devedores', 'atrasado', 'atrasados', 'vencido', 'vencidos'] },
        { situacao: 'pendentes', termos: ['a pagar', 'apagar', 'pendente', 'pendentes', 'restante', 'restantes'] },
        { situacao: 'pagos', termos: ['pago', 'pagos', 'recebido', 'recebidos', 'quitado', 'quitados'] },
        { situacao: 'parcelados', termos: ['parcelado', 'parcelados', 'parcela', 'parcelas'] }
    ];

    let situacaoDetectada = null;
    let nomeRestante = semPontuacao;

    for (const grupo of aliasesSituacao) {
        for (const alias of grupo.termos) {
            const regexAlias = new RegExp(`\\b${escaparRegex(alias)}\\b`, 'g');
            if (regexAlias.test(nomeRestante)) {
                if (!situacaoDetectada) situacaoDetectada = grupo.situacao;
                nomeRestante = nomeRestante.replace(regexAlias, ' ').replace(/\s+/g, ' ').trim();
            }
        }
    }

    nomeRestante = nomeRestante
        .replace(/\b(todos|todo|tudo)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        ativa: true,
        listarTudo: false,
        situacao: situacaoDetectada,
        nome: nomeRestante,
        termoOriginal: semPontuacao
    };
}

function atualizarNotificacoesPagamentoHoje() {
    const container = getEl('notificacoes-hoje');
    const botao = getEl('btn-notificacoes-hoje');
    const painel = getEl('notificacoes-hoje-painel');
    const lista = getEl('notificacoes-hoje-lista');
    const badge = getEl('notificacoes-hoje-badge');
    if (!container || !botao || !painel || !lista || !badge) return;

    const notificacoes = getNotificacoesPagamentoHoje();
    badge.textContent = String(notificacoes.length);
    botao.setAttribute('aria-label', `Notificacoes de pagamentos: ${notificacoes.length}`);

    if (!notificacoes.length) {
        alternarPainelNotificacoes(false);
        notificacaoSinoJaClicado = false;
        botao.classList.remove('balancando');
        container.hidden = true;
        lista.innerHTML = '';
        return;
    }

    container.hidden = false;
    if (!notificacaoSinoJaClicado) botao.classList.add('balancando');

    const fragment = document.createDocumentFragment();

    for (const item of notificacoes) {
        const li = document.createElement('li');
        li.className = 'notificacoes-item';
        const complementoQuantidade = item.quantidade > 1 ? ` - ${item.quantidade} lancamentos` : '';
        li.innerHTML = `
            <div class="notificacoes-item-info">
                <span class="notificacoes-item-nome">${escapeHtml(item.nome)}</span>
                <span class="notificacoes-item-data">Vence hoje (${escapeHtml(formatarDataBr(item.data))})${escapeHtml(complementoQuantidade)}</span>
            </div>
            <span class="notificacoes-item-valor">${formatarMoeda(item.valorRestante)}</span>
        `;
        fragment.appendChild(li);
    }

    lista.innerHTML = '';
    lista.appendChild(fragment);
}

function renderizarLista() {
    const lista = getEl('listaPrincipal');
    if (!lista) return;

    const buscaEl = getEl('buscaNome');
    const filtroBusca = extrairFiltroBusca(buscaEl?.value || '');
    const buscaAtiva = filtroBusca.ativa;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const filtrados = cobrancas.filter(cliente => {
        const dataVencimento = getVencimentoDate(cliente.data);
        let passouFiltroPrincipal = false;

        if (buscaAtiva) {
            if (filtroBusca.listarTudo) {
                passouFiltroPrincipal = true;
            } else {
                passouFiltroPrincipal = true;
                if (filtroBusca.situacao && !clienteCorrespondeSituacao(cliente, dataVencimento, hoje, filtroBusca.situacao)) {
                    passouFiltroPrincipal = false;
                }
                if (passouFiltroPrincipal && filtroBusca.nome) {
                    passouFiltroPrincipal = normalizarTextoBusca(cliente.nome).includes(filtroBusca.nome);
                }
            }
        } else {
            passouFiltroPrincipal = dataVencimento.getMonth() === mesAtivo
                && clienteCorrespondeSituacao(cliente, dataVencimento, hoje, abaAtiva);
        }

        return passouFiltroPrincipal;
    });

    const filtradosOrdenados = buscaAtiva
        ? [...filtrados].sort((a, b) => {
            const nomeBaseA = a.nome.split(' (')[0];
            const nomeBaseB = b.nome.split(' (')[0];
            const ordemNome = nomeBaseA.localeCompare(nomeBaseB, 'pt-BR', { sensitivity: 'base' });
            if (ordemNome !== 0) return ordemNome;

            const ordemData = getVencimentoDate(a.data).getTime() - getVencimentoDate(b.data).getTime();
            if (ordemData !== 0) return ordemData;

            return (a.id || 0) - (b.id || 0);
        })
        : (abaAtiva === 'todos'
            ? [...filtrados].sort((a, b) => {
                const prioridadeA = a.pago ? 2 : (getVencimentoDate(a.data) < hoje ? 0 : 1);
                const prioridadeB = b.pago ? 2 : (getVencimentoDate(b.data) < hoje ? 0 : 1);
                if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;

                const ordemData = getVencimentoDate(a.data).getTime() - getVencimentoDate(b.data).getTime();
                if (ordemData !== 0) return ordemData;

                const nomeBaseA = a.nome.split(' (')[0];
                const nomeBaseB = b.nome.split(' (')[0];
                return nomeBaseA.localeCompare(nomeBaseB, 'pt-BR', { sensitivity: 'base' });
            })
            : filtrados);

    const grupos = new Map();
    for (const cliente of filtradosOrdenados) {
        const nomeBase = cliente.nome.split(' (')[0];
        if (!grupos.has(nomeBase)) grupos.set(nomeBase, []);
        grupos.get(nomeBase).push(cliente);
    }

    atualizarContadorBusca(grupos.size, buscaAtiva ? filtroBusca.termoOriginal : '');

    lista.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const [nome, itens] of grupos.entries()) {
        const li = document.createElement('li');

        if (itens.length > 1 || abaAtiva === 'parcelados' || buscaAtiva) {
            li.className = 'item-agrupado';
            const faltaTotal = itens.reduce((acumulado, item) => acumulado + ((Number(item.valor) || 0) - (Number(item.pagoParcial) || 0)), 0);
            li.innerHTML = `
                <div class="pasta-header-parcela" onclick="this.parentElement.classList.toggle('aberto')">
                    <span><i class="fa-solid fa-folder" aria-hidden="true"></i> ${escapeHtml(nome)} (${itens.length})</span>
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
    const editTelefone = getEl('edit-telefone');
    const editValor = getEl('edit-valor');
    const editPagoParcial = getEl('edit-pago-parcial');
    const editData = getEl('edit-data');
    const modal = getEl('modalEdicao');

    if (!editId || !editNome || !editValor || !editPagoParcial || !editData || !modal) return;

    editId.value = cliente.id;
    editNome.value = cliente.nome;
    if (editTelefone) editTelefone.value = cliente.telefone || '';
    editValor.value = formatarValorEdicao(cliente.valor);
    editPagoParcial.value = formatarValorEdicao(cliente.pagoParcial);
    editValor.dataset.autoClearArmed = '1';
    editPagoParcial.dataset.autoClearArmed = '1';
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
    const editTelefone = getEl('edit-telefone');
    const editValor = getEl('edit-valor');
    const editPagoParcial = getEl('edit-pago-parcial');
    const editData = getEl('edit-data');

    if (!editId || !editNome || !editValor || !editPagoParcial || !editData) return;

    const id = Number(editId.value);
    const index = cobrancas.findIndex(c => c.id === id);
    if (index === -1) return;

    const original = cobrancas[index];
    const novoNome = editNome.value.trim();
    const novoTelefone = editTelefone ? editTelefone.value.trim() : (original.telefone || '');
    const novoValor = parseValorEdicao(editValor.value);
    const novoPago = parseValorEdicao(editPagoParcial.value);
    const novaData = editData.value;

    if (!novoNome || !Number.isFinite(novoValor) || novoValor <= 0 || !Number.isFinite(novoPago) || novoPago < 0 || !novaData) {
        return;
    }

    const antigoPago = Number(original.pagoParcial) || 0;
    const diferenca = novoPago - antigoPago;
    if (diferenca > 0) registrarTransacaoCarteira('entrada', diferenca, `Ajuste manual: ${novoNome}`);
    else if (diferenca < 0) registrarTransacaoCarteira('saida', Math.abs(diferenca), `Correcao manual: ${novoNome}`);

    cobrancas[index] = {
        ...original,
        nome: novoNome,
        telefone: novoTelefone,
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

function toggleMenuAno() {
    const menu = getEl('menu-meses');
    if (!menu) return;

    const colapsadoAtual = menu.dataset.colapsado === '1';
    menu.dataset.colapsado = colapsadoAtual ? '0' : '1';
    gerarMenuMeses();
}

function abrirResumoAno(ano = new Date().getFullYear()) {
    window.location.href = `resumo-ano.html?ano=${encodeURIComponent(String(ano))}`;
}

function selecionarMesAtivo(indice) {
    if (!Number.isInteger(indice) || indice < 0 || indice > 11) return;
    mesAtivo = indice;

    const menu = getEl('menu-meses');
    if (menu) menu.dataset.colapsado = '1';

    atualizarTudo();
    fecharSidebarMobile();
}

function gerarMenuMeses() {
    const menu = getEl('menu-meses');
    if (!menu) return;

    if (menu.dataset.colapsado !== '0' && menu.dataset.colapsado !== '1') {
        menu.dataset.colapsado = '1';
    }

    const colapsado = menu.dataset.colapsado === '1';
    const anoAtual = new Date().getFullYear();
    const mesSelecionadoCompleto = nomesMeses[mesAtivo] || '';
    const mesSelecionadoInicial = mesSelecionadoCompleto.slice(0, 3);
    const exibirLinkAno = !isPaginaEconomias();
    const headerClass = exibirLinkAno ? 'menu-ano-header' : 'menu-ano-header menu-ano-header--single';
    const botaoAnoHtml = exibirLinkAno
        ? `
            <button type="button" class="menu-ano-link" onclick="abrirResumoAno(${anoAtual})" aria-label="Abrir resumo anual de ${anoAtual}">
                <span>${anoAtual}</span>
                <i class="fa-solid fa-chart-column" aria-hidden="true"></i>
            </button>
        `
        : '';

    menu.innerHTML = `
        <div class="${headerClass}">
            ${botaoAnoHtml}
            <button type="button" class="menu-ano-toggle ${colapsado ? 'collapsed' : 'expanded'}" onclick="toggleMenuAno()" aria-label="${colapsado ? 'Expandir meses' : 'Recolher meses'} - Mes atual: ${escapeHtml(mesSelecionadoCompleto)}">
                <span class="menu-ano-toggle-label">${escapeHtml(mesSelecionadoInicial)}</span>
                <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
        </div>
        <div class="menu-meses-lista ${colapsado ? 'is-collapsed' : ''}">
            ${nomesMeses.map((mes, indice) => `
                <button class="${indice === mesAtivo ? 'active' : ''}" onclick="selecionarMesAtivo(${indice})">
                    ${mes}
                </button>
            `).join('')}
        </div>
    `;

    const titulo = getEl('titulo-pagina');
    if (titulo) titulo.textContent = nomesMeses[mesAtivo];
}

function atualizarTudo() {
    salvarCobrancas();

    const totalAtrasadosEl = getEl('totalAtrasados');
    if (!totalAtrasadosEl) {
        if (isPaginaEconomias()) gerarMenuMeses();
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
    atualizarNotificacoesPagamentoHoje();
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
   Economias: carteira e poupanca
   ========================================= */
function renderizarListaGenerica(elementId, listaDados, corEntrada, corSaida) {
    const container = getEl(elementId);
    if (!container) return;

    container.innerHTML = '';
    if (!listaDados.length) {
        container.innerHTML = `<p style="opacity:0.5; text-align:center; padding:20px;">Nenhuma movimentacao em ${escapeHtml(nomesMeses[mesAtivo])}.</p>`;
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
                    <i class="fa-solid ${isEntrada ? 'fa-arrow-down' : 'fa-arrow-up'}" aria-hidden="true"></i>
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
    renderizarListaGenerica('lista-extrato', filtrarHistoricoPorMes(historicoCarteira), 'var(--success)', 'var(--danger)');
}

function renderizarExtratoPoupanca() {
    renderizarListaGenerica('extrato-poupanca', filtrarHistoricoPorMes(historicoPoupanca), 'var(--poupanca-primary)', 'var(--poupanca-secondary)');
}

function atualizarInterfaceEconomias() {
    const emEconomias = isPaginaEconomias();
    const saldoCarteiraVisivel = emEconomias ? calcularSaldoHistoricoDoMes(historicoCarteira) : saldoCarteira;
    const saldoPoupancaVisivel = emEconomias ? calcularSaldoHistoricoDoMes(historicoPoupanca) : saldoPoupanca;
    const saldoCarteiraFormatado = formatarMoeda(saldoCarteiraVisivel);
    const saldoPoupancaFormatado = formatarMoeda(saldoPoupancaVisivel);

    const saldoTelaCheia = getEl('saldo-tela-cheia');
    if (saldoTelaCheia) saldoTelaCheia.textContent = saldoCarteiraFormatado;

    const saldoPoupancaEl = getEl('saldo-poupanca');
    if (saldoPoupancaEl) saldoPoupancaEl.textContent = saldoPoupancaFormatado;

    const labelSaldoCarteira = document.querySelector('#aba-carteira .saldo-grande small');
    if (labelSaldoCarteira) {
        labelSaldoCarteira.textContent = emEconomias
            ? `Saldo do mes (${nomesMeses[mesAtivo]})`
            : 'Saldo disponivel (carteira)';
    }

    const labelSaldoPoupanca = document.querySelector('#aba-poupanca .saldo-grande small');
    if (labelSaldoPoupanca) {
        labelSaldoPoupanca.textContent = emEconomias
            ? `Poupanca do mes (${nomesMeses[mesAtivo]})`
            : 'Total investido (poupanca)';
    }

    if (getEl('lista-extrato')) renderizarExtratoCarteira();
    if (getEl('extrato-poupanca')) renderizarExtratoPoupanca();
}

function realizarOperacao(tipo) {
    const inputValor = getEl('valor-operacao');
    const inputDesc = getEl('desc-operacao');
    if (!inputValor) return;

    const valor = parseValorInput(inputValor.value);
    if (!Number.isFinite(valor) || valor <= 0) return alert('Valor invalido.');
    const saldoReferencia = isPaginaEconomias() ? calcularSaldoHistoricoDoMes(historicoCarteira) : saldoCarteira;
    if (tipo === 'sacar' && valor > saldoReferencia) return alert('Saldo insuficiente no mes selecionado.');
    const dataReferencia = obterDataReferenciaMesSelecionado();

    registrarTransacaoCarteira(
        tipo === 'depositar' ? 'entrada' : 'saida',
        valor,
        inputDesc?.value?.trim() || (tipo === 'depositar' ? 'Deposito manual' : 'Saida manual'),
        dataReferencia
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
    const saldoReferencia = isPaginaEconomias() ? calcularSaldoHistoricoDoMes(historicoPoupanca) : saldoPoupanca;
    if (tipo === 'sacar' && valor > saldoReferencia) return alert('Saldo insuficiente no mes selecionado.');
    const dataReferencia = obterDataReferenciaMesSelecionado();

    if (tipo === 'depositar') saldoPoupanca += valor;
    else saldoPoupanca -= valor;

    historicoPoupanca.unshift({
        tipo,
        valor,
        descricao: inputDesc?.value?.trim() || (tipo === 'depositar' ? 'Investimento' : 'Resgate'),
        timestamp: dataReferencia.getTime(),
        data: dataReferencia.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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
   Transferencias carteira/poupanca
   ========================================= */
function abrirModalTransferencia() {
    const valor = prompt('Quanto deseja transferir da Carteira para a Poupan\u00e7a?');
    if (!valor) return;

    const numValor = parseValorInput(valor);
    if (!Number.isFinite(numValor) || numValor <= 0) return alert('Valor invalido.');
    const saldoCarteiraMes = isPaginaEconomias() ? calcularSaldoHistoricoDoMes(historicoCarteira) : saldoCarteira;
    if (numValor > saldoCarteiraMes) return alert('Saldo insuficiente na Carteira para o mes selecionado.');
    const dataReferencia = obterDataReferenciaMesSelecionado();

    registrarTransacaoCarteira('saida', numValor, 'Transferencia para Poupan\u00e7a', dataReferencia);

    saldoPoupanca += numValor;
    historicoPoupanca.unshift({
        tipo: 'depositar',
        valor: numValor,
        descricao: 'Vindo da Carteira',
        timestamp: dataReferencia.getTime(),
        data: dataReferencia.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    limitarHistorico(historicoPoupanca);
    salvarPoupanca();

    alert(`Transferencia realizada: ${formatarMoeda(numValor)}.`);
    atualizarInterfaceEconomias();
}

function abrirModalResgate() {
    const valor = prompt('Quanto deseja tirar da Poupan\u00e7a e enviar para a Carteira?');
    if (!valor) return;

    const numValor = parseValorInput(valor);
    if (!Number.isFinite(numValor) || numValor <= 0) return alert('Valor invalido.');
    const saldoPoupancaMes = isPaginaEconomias() ? calcularSaldoHistoricoDoMes(historicoPoupanca) : saldoPoupanca;
    if (numValor > saldoPoupancaMes) return alert('Saldo insuficiente na Poupan\u00e7a para o mes selecionado.');
    const dataReferencia = obterDataReferenciaMesSelecionado();

    saldoPoupanca -= numValor;
    historicoPoupanca.unshift({
        tipo: 'sacar',
        valor: numValor,
        descricao: 'Enviado para Carteira',
        timestamp: dataReferencia.getTime(),
        data: dataReferencia.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    limitarHistorico(historicoPoupanca);
    salvarPoupanca();

    registrarTransacaoCarteira('entrada', numValor, 'Resgate da Poupan\u00e7a', dataReferencia);
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
    iniciarSplashAbertura();
    aplicarEstadoInicialSidebar();
    configurarGestosSidebarMobile();
    configurarPainelNotificacoes();
    iniciarAutoOcultarSubtituloEconomias();
    atualizarTudo();
    atualizarInterfaceEconomias();

    const editValor = getEl('edit-valor');
    const editPagoParcial = getEl('edit-pago-parcial');
    prepararLimpezaCampoValor(editValor);
    prepararLimpezaCampoValor(editPagoParcial);

    const busca = getEl('buscaNome');
    if (busca) {
        busca.addEventListener('input', () => {
            clearTimeout(buscaDebounceTimer);
            buscaDebounceTimer = setTimeout(renderizarLista, 120);
        });
    }
});

