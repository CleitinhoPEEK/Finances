/* =========================================
   1. CONFIGURAÇÕES E DADOS GERAIS
   ========================================= */
const STORAGE_CLIENTES = 'cobrancas_2026';
const STORAGE_SALDO = 'cofrinho_saldo';
const STORAGE_HISTORICO = 'cofrinho_historico';
const STORAGE_POUPANCA = 'poupanca_saldo';
const STORAGE_HIST_POUPANCA = 'poupanca_historico';

// Carrega tudo da memória
let cobrancas = JSON.parse(localStorage.getItem(STORAGE_CLIENTES)) || [];
let saldoCarteira = Number(localStorage.getItem(STORAGE_SALDO)) || 0;
let historicoCarteira = JSON.parse(localStorage.getItem(STORAGE_HISTORICO)) || [];
let saldoPoupanca = Number(localStorage.getItem(STORAGE_POUPANCA)) || 0;
let historicoPoupanca = JSON.parse(localStorage.getItem(STORAGE_HIST_POUPANCA)) || [];

let abaAtiva = 'atrasados';
let mesAtivo = new Date().getMonth();
const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const formatarMoeda = v => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const getVencimentoDate = str => new Date(str + 'T00:00:00');

/* =========================================
   2. FUNÇÕES DO DASHBOARD (CLIENTES)
   ========================================= */

function toggleSidebar() { document.getElementById('app-wrapper').classList.toggle('sidebar-closed'); }
function toggleFormCadastro() { 
    const m = document.getElementById('container-cadastro');
    if(m) m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
}

function adicionarCobranca() {
    const nome = document.getElementById('nome').value;
    const val = Number(document.getElementById('valor').value);
    const data = document.getElementById('data').value;
    const rep = parseInt(document.getElementById('repetir').value);
    
    if (!nome || !val || !data) return alert("Preencha tudo!");
    
    for (let i = 0; i < rep; i++) {
        const d = getVencimentoDate(data); d.setDate(d.getDate() + (i * 7));
        cobrancas.push({ 
            id: Date.now() + i, 
            nome: rep > 1 ? `${nome} (${i+1}/${rep})` : nome, 
            telefone: document.getElementById('telefone').value, 
            valor: val.toFixed(2), 
            pagoParcial: "0.00", 
            data: d.toISOString().split('T')[0], 
            pago: false 
        });
    }
    toggleFormCadastro(); atualizarTudo();
}

function togglePago(id) { 
    const index = cobrancas.findIndex(c => c.id === id);
    if (index === -1) return;
    
    const cliente = cobrancas[index];
    const valorTotal = Number(cliente.valor);
    const valorJaPago = Number(cliente.pagoParcial);

    if (!cliente.pago) {
        // PAGANDO: Soma apenas o que falta
        const valorAReceber = valorTotal - valorJaPago;
        if (valorAReceber > 0) {
            cliente.pago = true;
            cliente.pagoParcial = cliente.valor; 
            registrarTransacaoCarteira('entrada', valorAReceber, `Recebido: ${cliente.nome}`);
        }
    } else {
        // ESTORNO: Retira apenas o que de fato estava como pago
        if (valorJaPago > 0) {
            registrarTransacaoCarteira('saida', valorJaPago, `Estorno: ${cliente.nome}`);
            alert(`Estorno realizado: R$ ${valorJaPago.toFixed(2)} removido da carteira.`);
        }
        cliente.pago = false;
        cliente.pagoParcial = "0.00"; 
    }

    cobrancas[index] = cliente;
    atualizarTudo(); 
}

function registrarTransacaoCarteira(tipo, valor, descricao) {
    // Garante que estamos lidando com números
    valor = Number(valor);
    
    if (tipo === 'entrada') saldoCarteira += valor;
    else saldoCarteira -= valor;

    historicoCarteira.unshift({
        tipo: tipo === 'entrada' ? 'depositar' : 'sacar',
        valor: valor,
        descricao: descricao,
        data: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' })
    });

    localStorage.setItem(STORAGE_SALDO, saldoCarteira);
    localStorage.setItem(STORAGE_HISTORICO, JSON.stringify(historicoCarteira));
    
    atualizarInterfaceEconomias();
}

function renderizarLista() {
    const lista = document.getElementById('listaPrincipal');
    if (!lista) return; 

    const busca = document.getElementById('buscaNome').value.toLowerCase();
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    
    const filtrados = cobrancas.filter(c => {
        if (busca !== "") return c.nome.toLowerCase().includes(busca);
        const dv = getVencimentoDate(c.data);
        if (dv.getMonth() !== mesAtivo) return false;
        if (abaAtiva === 'atrasados') return !c.pago && dv < hoje;
        if (abaAtiva === 'pendentes') return !c.pago && dv >= hoje;
        if (abaAtiva === 'pagos') return c.pago;
        if (abaAtiva === 'parcelados') return c.nome.includes('(');
        return false;
    });

    const grupos = {};
    filtrados.forEach(c => {
        const base = c.nome.split(' (')[0];
        if (!grupos[base]) grupos[base] = [];
        grupos[base].push(c);
    });

    lista.innerHTML = '';
    Object.entries(grupos).forEach(([nome, itens]) => {
        const li = document.createElement('li');
        if (itens.length > 1 || abaAtiva === 'parcelados' || busca !== "") {
            li.className = 'item-agrupado';
            const faltaTotal = itens.reduce((acc, i) => acc + (Number(i.valor) - Number(i.pagoParcial)), 0);
            li.innerHTML = `
                <div class="pasta-header-parcela" onclick="this.parentElement.classList.toggle('aberto')">
                    <span>📁 ${nome} (${itens.length})</span>
                    <span style="background:var(--badge-bg); color:var(--badge-text); padding:4px 10px; border-radius:15px; font-size:0.8rem">${formatarMoeda(faltaTotal)}</span>
                </div>
                <div class="sub-lista">${itens.map(i => criarItemHTML(i, hoje)).join('')}</div>`;
        } else {
            li.innerHTML = criarItemHTML(itens[0], hoje);
        }
        lista.appendChild(li);
    });
}

function criarItemHTML(c, hoje) {
    const v = Number(c.valor), p = Number(c.pagoParcial), falta = v - p, dv = getVencimentoDate(c.data);
    const classe = c.pago ? 'pago-row' : (dv < hoje ? 'atrasado-row' : 'pendente-row');
    return `
        <div class="${classe}" style="padding:15px; border-bottom:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><strong>${c.nome}</strong><br><small>${c.data.split('-').reverse().join('/')}</small></div>
                <div class="acoes">
                    <button class="btn-proximo" onclick="copiarProximo(${c.id})">⏭️</button>
                    <button onclick="abrirMenuWhats(${c.id})" class="btn-whatsapp">
    <i class="fab fa-whatsapp">📲</i>
</button>
                    <button class="btn-editar" onclick="abrirEdicao(${c.id})">✏️</button>
                    <button class="btn-pagar" onclick="togglePago(${c.id})">${c.pago?'↩️':'✅'}</button>
                    <button class="btn-excluir" onclick="excluir(${c.id})">🗑️</button>
                </div>
            </div>
            <div class="progress-container"><div class="progress-bar" style="width:${(p/v)*100}%"></div></div>
            <div class="info-valores">
                <span style="color:var(--success)">Pago: ${formatarMoeda(p)}</span>
                <span style="color:var(--danger)">Falta: ${formatarMoeda(falta)}</span>
                <span style="color:var(--text-muted)">Total: ${formatarMoeda(v)}</span>
            </div>
        </div>`;
}

function abrirEdicao(id) {
    const c = cobrancas.find(x => x.id === id);
    if(c) {
        document.getElementById('edit-id').value = c.id;
        document.getElementById('edit-nome').value = c.nome;
        document.getElementById('edit-valor').value = c.valor;
        document.getElementById('edit-pago-parcial').value = c.pagoParcial;
        document.getElementById('edit-data').value = c.data;
        document.getElementById('modalEdicao').style.display = 'flex';
    }
}
function fecharModal() { document.getElementById('modalEdicao').style.display = 'none'; }

// --- FUNÇÃO DE SALVAR EDIÇÃO COM ATUALIZAÇÃO DO EXTRATO ---
function salvarEdicao() {
    const id = Number(document.getElementById('edit-id').value);
    
    // Novos valores
    const novoNome = document.getElementById('edit-nome').value;
    const novoValor = Number(document.getElementById('edit-valor').value);
    const novoPago = Number(document.getElementById('edit-pago-parcial').value);
    const novaData = document.getElementById('edit-data').value;

    // Busca o original
    const index = cobrancas.findIndex(c => c.id === id);
    if (index === -1) return;
    const original = cobrancas[index];
    const antigoPago = Number(original.pagoParcial);

    // Calcula diferença e atualiza carteira
    const diferenca = novoPago - antigoPago;
    
    if (diferenca !== 0) {
        if (diferenca > 0) {
            registrarTransacaoCarteira('entrada', diferenca, `Ajuste Manual: ${novoNome}`);
        } else {
            registrarTransacaoCarteira('saida', Math.abs(diferenca), `Correção Manual: ${novoNome}`);
        }
    }

    // Atualiza objeto
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
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[data-aba="${aba}"]`);
    if(btn) btn.classList.add('active');
    renderizarLista();
}

function atualizarTudo() {
    localStorage.setItem(STORAGE_CLIENTES, JSON.stringify(cobrancas));
    
    const elTotal = document.getElementById('totalAtrasados');
    if (!elTotal) return; 

    let atr=0, pen=0, rec=0; const hoje = new Date();
    cobrancas.forEach(c => {
        const dv = getVencimentoDate(c.data);
        if(dv.getMonth() === mesAtivo) {
            const v = Number(c.valor), p = Number(c.pagoParcial);
            rec += (c.pago ? v : p);
            if(!c.pago) { if(dv < hoje) atr += (v-p); else pen += (v-p); }
        }
    });
    
    document.getElementById('totalAtrasados').textContent = formatarMoeda(atr);
    document.getElementById('totalPendentes').textContent = formatarMoeda(pen);
    document.getElementById('totalRecebido').textContent = formatarMoeda(rec);
    gerarMenuMeses(); renderizarLista();
    atualizarInterfaceEconomias();
}

function gerarMenuMeses() {
    const menu = document.getElementById('menu-meses');
    if(menu) {
        menu.innerHTML = nomesMeses.map((m, i) => `
            <button class="${i === mesAtivo ? 'active' : ''}" 
                    onclick="mesAtivo=${i}; atualizarTudo(); fecharSidebarMobile();">
                ${m}
            </button>`).join('');
        const titulo = document.getElementById('titulo-pagina');
        if(titulo) titulo.textContent = nomesMeses[mesAtivo];
    }
}

// Nova função auxiliar
function fecharSidebarMobile() {
    if (window.innerWidth <= 768) {
        document.getElementById('app-wrapper').classList.add('sidebar-closed');
    }
}

function excluir(id) { if(confirm("Excluir?")) { cobrancas = cobrancas.filter(c => c.id !== id); atualizarTudo(); } }
function copiarProximo(id) {
    const c = cobrancas.find(x => x.id === id);
    const d = getVencimentoDate(c.data); d.setMonth(d.getMonth() + 1);
    cobrancas.push({...c, id: Date.now(), data: d.toISOString().split('T')[0], pago: false, pagoParcial: "0.00"});
    atualizarTudo();
}

/* =========================================
   3. GERENCIADOR DE ECONOMIAS (Carteira & Poupança)
   ========================================= */

function atualizarInterfaceEconomias() {
    const formatadoCarteira = saldoCarteira.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatadoPoupanca = saldoPoupanca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // 1. Atualiza SALDOS (elementos de texto)
    const telaCheiaSaldo = document.getElementById('saldo-tela-cheia');
    if (telaCheiaSaldo) telaCheiaSaldo.textContent = formatadoCarteira;
        
    const elSaldoPoupanca = document.getElementById('saldo-poupanca');
    if (elSaldoPoupanca) elSaldoPoupanca.textContent = formatadoPoupanca;
    
    const sidebarSaldo = document.getElementById('saldo-sidebar');
    if (sidebarSaldo) sidebarSaldo.textContent = formatadoCarteira;

    // 2. Atualiza EXTRATOS (Verifica se a div específica existe na tela)
    if (document.getElementById('lista-extrato')) {
        renderizarExtratoCarteira();
    }
    if (document.getElementById('extrato-poupanca')) {
        renderizarExtratoPoupanca();
    }
}

// --- Operações Manuais ---
function realizarOperacao(tipo) {
    const inputValor = document.getElementById('valor-operacao');
    const inputDesc = document.getElementById('desc-operacao');
    if(!inputValor) return;
    const valor = parseFloat(inputValor.value.replace(',', '.'));

    if (!valor || valor <= 0) return alert("⚠️ Valor inválido!");
    if (tipo === 'sacar' && valor > saldoCarteira) return alert("🚫 Saldo insuficiente!");

    registrarTransacaoCarteira(tipo === 'depositar' ? 'entrada' : 'saida', valor, inputDesc.value || (tipo === 'depositar' ? 'Depósito Manual' : 'Saída Manual'));
    inputValor.value = ''; inputDesc.value = '';
}

function operarPoupanca(tipo) {
    const inputValor = document.getElementById('valor-poupanca');
    const inputDesc = document.getElementById('desc-poupanca');
    if(!inputValor) return;
    const valor = parseFloat(inputValor.value.replace(',', '.'));

    if (!valor || valor <= 0) return alert("⚠️ Valor inválido!");
    if (tipo === 'sacar' && valor > saldoPoupanca) return alert("🚫 Saldo insuficiente!");

    if (tipo === 'depositar') saldoPoupanca += valor;
    else saldoPoupanca -= valor;

    historicoPoupanca.unshift({
        tipo: tipo,
        valor: valor,
        descricao: inputDesc.value || (tipo === 'depositar' ? 'Investimento' : 'Resgate'),
        data: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' })
    });

    localStorage.setItem(STORAGE_POUPANCA, saldoPoupanca);
    localStorage.setItem(STORAGE_HIST_POUPANCA, JSON.stringify(historicoPoupanca));
    
    inputValor.value = ''; inputDesc.value = '';
    atualizarInterfaceEconomias();
}

// --- Renderização dos Extratos ---
function renderizarExtratoCarteira() {
    renderizarListaGenerica('lista-extrato', historicoCarteira, 'var(--success)', 'var(--danger)');
}

function renderizarExtratoPoupanca() {
    renderizarListaGenerica('extrato-poupanca', historicoPoupanca, '#3498db', '#95a5a6', true);
}

function renderizarListaGenerica(elementId, listaDados, corEntrada, corSaida, isPoupanca = false) {
    const container = document.getElementById(elementId);
    if (!container) return; 
    
    container.innerHTML = '';
    if (listaDados.length === 0) {
        container.innerHTML = '<p style="opacity:0.5; text-align:center; padding:20px;">Nenhuma movimentação.</p>';
        return;
    }

    listaDados.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-extrato';
        const isEntrada = item.tipo === 'depositar' || item.tipo === 'entrada'; // Normalização de tipos
        const cor = isEntrada ? corEntrada : corSaida;
        
        // Garante que o valor é um Number para o toLocaleString não falhar
        const valorFormatado = Number(item.valor).toLocaleString('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
        });

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="background:var(--bg-body); padding:10px; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
                    ${isEntrada ? '⬇️' : '⬆️'}
                </div>
                <div>
                    <div style="font-weight:bold; color:var(--text-main);">${item.descricao}</div>
                    <div class="data-extrato">${item.data}</div>
                </div>
            </div>
            <div style="font-weight:bold; color:${cor}">${isEntrada ? '+' : '-'} ${valorFormatado}</div>
        `;
        container.appendChild(div);
    });
}

/* =========================================
   4. INICIALIZAÇÃO E TEMA
   ========================================= */
function carregarTema() {
    const temaSalvo = localStorage.getItem('tema_sistema');
    if (temaSalvo === 'light') document.body.classList.add('light-mode');
}
function alternarTema() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('tema_sistema', document.body.classList.contains('light-mode') ? 'light' : 'dark');
}

// Funções de Backup
function exportarDados() {
    const dados = {
        clientes: localStorage.getItem(STORAGE_CLIENTES),
        saldo: localStorage.getItem(STORAGE_SALDO),
        hist: localStorage.getItem(STORAGE_HISTORICO),
        saldoP: localStorage.getItem(STORAGE_POUPANCA),
        histP: localStorage.getItem(STORAGE_HIST_POUPANCA)
    };
    const blob = new Blob([JSON.stringify(dados)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `backup_sistema_2026_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importarDados(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            if(dados.clientes) localStorage.setItem(STORAGE_CLIENTES, dados.clientes);
            if(dados.saldo) localStorage.setItem(STORAGE_SALDO, dados.saldo);
            if(dados.hist) localStorage.setItem(STORAGE_HISTORICO, dados.hist);
            if(dados.saldoP) localStorage.setItem(STORAGE_POUPANCA, dados.saldoP);
            if(dados.histP) localStorage.setItem(STORAGE_HIST_POUPANCA, dados.histP);
            alert("Backup restaurado com sucesso!");
            location.reload();
        } catch(err) { alert("Erro ao ler arquivo de backup."); }
    };
    reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded', () => {
    carregarTema();
    atualizarTudo(); 
    atualizarInterfaceEconomias(); 
    
    const busca = document.getElementById('buscaNome');
    if(busca) busca.addEventListener('input', renderizarLista);
});

// --- FUNÇÃO DE TROCA DE ABAS (Cole no final do script.js) ---
function mudarAbaEconomia(aba) {
    // 1. Pega os elementos da tela
    const abaCarteira = document.getElementById('aba-carteira');
    const abaPoupanca = document.getElementById('aba-poupanca');
    const botoes = document.querySelectorAll('.tab-eco');

    // 2. Proteção: Se não achar os elementos, para aqui para não dar erro
    if (!abaCarteira || !abaPoupanca) {
        console.error("Erro: As divs 'aba-carteira' ou 'aba-poupanca' não foram encontradas no HTML.");
        return;
    }

    // 3. Esconde tudo primeiro
    abaCarteira.style.display = 'none';
    abaPoupanca.style.display = 'none';
    
    // 4. Remove a cor 'active' de todos os botões
    botoes.forEach(btn => btn.classList.remove('active'));

    // 5. Mostra a aba certa e pinta o botão certo
    if (aba === 'carteira') {
        abaCarteira.style.display = 'block';
        if(botoes[0]) botoes[0].classList.add('active'); // Pinta o 1º botão
    } else {
        abaPoupanca.style.display = 'block';
        if(botoes[1]) botoes[1].classList.add('active'); // Pinta o 2º botão
    }

    // 6. Atualiza os saldos na tela
    atualizarInterfaceEconomias();
}

/* =========================================
   FUNÇÃO DE RESET TOTAL (4 ETAPAS)
   ========================================= */
function resetarSistema() {
    // ETAPA 1: Pergunta simples
    if (!confirm("⚠️ ATENÇÃO: Você solicitou o reset total do sistema.\n\nDeseja continuar?")) return;

    // ETAPA 2: Aviso de consequência
    if (!confirm("⛔ PERIGO: Essa ação apagará PERMANENTEMENTE:\n\n- Todos os clientes e cobranças\n- Todo o saldo da Carteira e Poupança\n- Todo o histórico de transações\n\nNADA poderá ser recuperado.")) return;

    // ETAPA 3: Última chance
    if (!confirm("Tem certeza absoluta? Se você clicar em 'OK', não haverá como voltar atrás.")) return;

    // ETAPA 4: Trava de Segurança (Digitação)
    const prova = prompt("🔒 TRAVA DE SEGURANÇA:\n\nPara confirmar a exclusão total, digite a palavra: ZERAR");

    if (prova && prova.toUpperCase() === "ZERAR") {
        // O comando nuclear:
        localStorage.clear();
        
        alert("♻️ Sistema formatado com sucesso.\nO aplicativo será reiniciado como novo.");
        window.location.href = "index.html"; // Recarrega a página do zero
    } else {
        alert("❌ Ação cancelada.\nA palavra de segurança estava incorreta ou você desistiu.");
    }
}

function abrirModalTransferencia() {
    const valor = prompt("Quanto deseja transferir da Carteira para a Poupança?");
    if (!valor) return;
    
    const numValor = parseFloat(valor.replace(',', '.'));
    
    if (isNaN(numValor) || numValor <= 0) {
        return alert("⚠️ Valor inválido.");
    }
    
    if (numValor > saldoCarteira) {
        return alert("🚫 Saldo insuficiente na Carteira.");
    }

    // 1. Tira da Carteira
    registrarTransacaoCarteira('saida', numValor, "Transferência para Poupança");
    
    // 2. Coloca na Poupança
    saldoPoupanca += numValor;
    historicoPoupanca.unshift({
        tipo: 'depositar',
        valor: numValor,
        descricao: "Vindo da Carteira",
        data: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' })
    });

    // 3. Salva e Atualiza
    localStorage.setItem(STORAGE_POUPANCA, saldoPoupanca);
    localStorage.setItem(STORAGE_HIST_POUPANCA, JSON.stringify(historicoPoupanca));
    
    alert(`✅ R$ ${numValor.toFixed(2)} transferidos com sucesso!`);
    atualizarInterfaceEconomias();
}

function abrirModalResgate() {
    const valor = prompt("Quanto deseja tirar da Poupança e enviar para a Carteira?");
    if (!valor) return;
    
    const numValor = parseFloat(valor.replace(',', '.'));
    
    if (isNaN(numValor) || numValor <= 0) {
        return alert("⚠️ Valor inválido.");
    }
    
    if (numValor > saldoPoupanca) {
        return alert("🚫 Saldo insuficiente na Poupança.");
    }

    // 1. Tira da Poupança
    saldoPoupanca -= numValor;
    historicoPoupanca.unshift({
        tipo: 'sacar',
        valor: numValor,
        descricao: "Enviado para Carteira",
        data: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' })
    });

    // 2. Coloca na Carteira
    registrarTransacaoCarteira('entrada', numValor, "Resgate da Poupança");

    // 3. Salva e Atualiza
    localStorage.setItem(STORAGE_POUPANCA, saldoPoupanca);
    localStorage.setItem(STORAGE_HIST_POUPANCA, JSON.stringify(historicoPoupanca));
    
    alert(`✅ R$ ${numValor.toFixed(2)} voltaram para sua Carteira!`);
    atualizarInterfaceEconomias();
}

function abrirMenuWhats(id) {
    const c = cobrancas.find(x => x.id === id);
    if (!c) return;

    const modal = document.getElementById('modalWhatsapp');
    const lista = document.getElementById('lista-mensagens');
    const titulo = document.getElementById('whats-titulo');
    
    // Dados Dinâmicos
    const primeiroNome = c.nome.split(' ')[0];
    const valorTotal = Number(c.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const valorPago = Number(c.pagoParcial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const saldoDevedor = (Number(c.valor) - Number(c.pagoParcial)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    titulo.innerText = `Mensagem para ${primeiroNome}`;
    lista.innerHTML = ''; 

    // Mensagens Padrão (Suas sugestões)
    let opcoes = [
        { 
            titulo: "💳 Dia do Vencimento", 
            texto: `Bom dia ${primeiroNome} 😊\n\nHoje é o dia da mensalidade no valor de ${valorTotal} 💳\n\nFico no aguardo da confirmação 👍` 
        },
        { 
            titulo: "⚠️ Lembrete em Aberto", 
            texto: `Bom dia 😊\n\nPercebemos que a mensalidade está em aberto 💳\n\nSabemos que imprevistos acontecem, então se precisar conversar é só me chamar 👍\n\nFico à disposição 🙏` 
        },
        { 
            titulo: "🤝 Negociação", 
            texto: `Bom dia 😊\n\nSobre a mensalidade em aberto 💳\n\nCaso precise negociar o pagamento, podemos conversar 👍\n\nFico à disposição 🙏` 
        },
        { 
            titulo: "🔄 Novo Vencimento", 
            texto: `Boa tarde 🙂\n\nConforme combinado, atualizamos o vencimento da mensalidade 📅\n\nQualquer dúvida é só me chamar 👍` 
        }
    ];

    // --- LÓGICA DE STATUS ESPECÍFICOS ---

    // Caso 1: Pagamento Parcial (Pagou algo, mas não tudo)
    if (Number(c.pagoParcial) > 0 && !c.pago) {
        opcoes.unshift({
            titulo: "🌗 Saldo Restante",
            texto: `Oi ${primeiroNome}! Recebi o valor parcial de ${valorPago}. ✅\n\nPassando apenas para lembrar que o saldo restante é de ${saldoDevedor}. Qualquer dúvida me avise! 👍`
        });
    }

    // Caso 2: Totalmente Pago
    if (c.pago) {
        opcoes = [
            {
                titulo: "✅ Agradecer Pagamento",
                texto: `Oi ${primeiroNome}! Recebi seu pagamento de ${valorTotal}. Muito obrigado, já dei baixa aqui! 👍`
            },
            {
                titulo: "🔄 Novo Vencimento",
                texto: `Boa tarde 🙂\n\nConforme combinado, atualizamos o vencimento da mensalidade para o próximo mês. 📅\n\nQualquer dúvida é só me chamar 👍`
            }
        ];
    }

    // Renderização dos Botões
    opcoes.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn-acao-principal'; 
        btn.style.textAlign = 'left';
        btn.style.padding = '15px';
        btn.style.marginBottom = '5px';
        
        btn.innerHTML = `<strong>${opt.titulo}</strong><br><small style="display:block; margin-top:5px; opacity:0.7; line-height:1.2">${opt.texto.substring(0, 60)}...</small>`;
        
        btn.onclick = () => {
            const link = `https://wa.me/55${c.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(opt.texto)}`;
            window.open(link, '_blank');
            fecharModalWhats();
        };
        lista.appendChild(btn);
    });

    modal.style.display = 'flex';
}










let despesas = JSON.parse(localStorage.getItem("despesas")) || [];

function salvarLocal() {
  localStorage.setItem("despesas", JSON.stringify(despesas));
}

function formatar(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function abrirModalNovaDespesa() {
  document.getElementById("modalNova").classList.add("active");
}

function fecharModalNova() {
  document.getElementById("modalNova").classList.remove("active");
}

function adicionarDespesa() {
  const nome = document.getElementById("nomeDespesa").value;
  const valor = parseFloat(document.getElementById("valorDespesa").value);
  const data = document.getElementById("dataDespesa").value;

  if (!nome || !valor || !data) return;

  despesas.push({
  id: 123,
  nome: "Internet",
  valor: 120,
  data: "2026-02-20",
  status: "pendente",
  recorrente: true
});

  salvarLocal();
  fecharModalNova();
  renderizarDespesas();
}

function abrirModalEdicao(id) {
  const despesa = despesas.find(d => d.id === id);
  if (!despesa) return;

  document.getElementById("edit-id").value = despesa.id;
  document.getElementById("edit-nome").value = despesa.nome;
  document.getElementById("edit-valor").value = despesa.valor;
  document.getElementById("edit-data").value = despesa.data;
  document.getElementById("edit-status").value = despesa.status;

  document.getElementById("modalEdicaoDespesa").classList.add("active");
}

function fecharModalEdicao() {
  document.getElementById("modalEdicaoDespesa").classList.remove("active");
}

function salvarEdicaoDespesa() {
  const id = Number(document.getElementById("edit-id").value);
  const despesa = despesas.find(d => d.id === id);

  despesa.nome = document.getElementById("edit-nome").value;
  despesa.valor = parseFloat(document.getElementById("edit-valor").value);
  despesa.data = document.getElementById("edit-data").value;
  despesa.status = document.getElementById("edit-status").value;

  salvarLocal();
  fecharModalEdicao();
  renderizarDespesas();
}

function excluirDespesa(id) {
  despesas = despesas.filter(d => d.id !== id);
  salvarLocal();
  renderizarDespesas();
}

function renderizarDespesas() {
  const lista = document.getElementById("listaDespesas");
  lista.innerHTML = "";

  let totalPago = 0;
  let totalPendente = 0;
  let totalAtrasado = 0;

  const hoje = new Date();

  despesasFiltradas.forEach(d => {
    const dataVenc = new Date(d.data);
    let classe = "pendente";

    if (d.status === "pago") {
      totalPago += d.valor;
      classe = "pago";
    } else if (dataVenc < hoje) {
      totalAtrasado += d.valor;
      classe = "atrasado";
    } else {
      totalPendente += d.valor;
    }

    const li = document.createElement("li");
    li.className = `item ${classe}`;
    li.innerHTML = `
      <div>
        <strong>${d.nome}</strong>
        <div>${formatar(d.valor)} - ${d.data}</div>
      </div>
      <div>
        <button onclick="abrirModalEdicao(${d.id})">✏️</button>
        <button onclick="excluirDespesa(${d.id})">🗑️</button>
      </div>
    `;

    lista.appendChild(li);
  });

  document.getElementById("totalPago").innerText = formatar(totalPago);
  document.getElementById("totalPendente").innerText = formatar(totalPendente);
  document.getElementById("totalAtrasado").innerText = formatar(totalAtrasado);
}

function mesAtual() {
  const hoje = new Date();
  return hoje.getMonth();
}

function anoAtual() {
  const hoje = new Date();
  return hoje.getFullYear();
}
const mes = mesAtual();
const ano = anoAtual();

const despesasFiltradas = despesas.filter(d => {
  const data = new Date(d.data);
  return data.getMonth() === mes && data.getFullYear() === ano;
});

renderizarDespesas();