let dataAtual = new Date();
let listaDespesas = JSON.parse(localStorage.getItem('minhas_despesas')) || [];
let economias = parseFloat(localStorage.getItem('economias')) || 0;
let filtroAtual = 'todos';
let editandoId = null;

document.addEventListener('DOMContentLoaded', () => {
    gerarRecorrentesAutomatico();
    atualizarLista();
});

function atualizarLabelMes() {
    const opcoes = { month: 'long', year: 'numeric' };
    mesAtualLabel.innerText =
        dataAtual.toLocaleDateString('pt-BR', opcoes);
}

function mudarMes(valor) {
    dataAtual.setMonth(dataAtual.getMonth() + valor);
    gerarRecorrentesAutomatico();
    atualizarLista();
}

function abrirModalDespesa() {
    modalDespesa.classList.add('active');
}

function fecharModalDespesa() {
    modalDespesa.classList.remove('active');
    nomeDespesa.value = '';
    valorDespesa.value = '';
    dataVencimento.value = '';
    statusDespesa.value = 'pendente';
    recorrenteDespesa.checked = false;
    editandoId = null;
}

function salvarDespesa() {

    const nome = nomeDespesa.value.trim();
    const valor = parseFloat(valorDespesa.value);
    const data = dataVencimento.value;
    const status = statusDespesa.value;
    const recorrente = recorrenteDespesa.checked;

    if (!nome || !valor || !data) {
        alert("Preencha todos os campos");
        return;
    }

    if (editandoId) {
        const index = listaDespesas.findIndex(d => d.id === editandoId);
        listaDespesas[index] = { ...listaDespesas[index], nome, valor, data, status, recorrente };
    } else {
        listaDespesas.push({
            id: Date.now(),
            nome,
            valor,
            data,
            status,
            recorrente
        });
    }

    salvarStorage();
    fecharModalDespesa();
    atualizarLista();
}

function gerarRecorrentesAutomatico() {

    const mes = dataAtual.getMonth();
    const ano = dataAtual.getFullYear();

    listaDespesas.forEach(d => {

        if (!d.recorrente) return;

        const jaExiste = listaDespesas.some(item => {
            const dataItem = new Date(item.data);
            return item.nome === d.nome &&
                dataItem.getMonth() === mes &&
                dataItem.getFullYear() === ano;
        });

        if (!jaExiste) {
            const diaOriginal = new Date(d.data).getDate();
            const novaData = new Date(ano, mes, diaOriginal);

            listaDespesas.push({
                id: Date.now() + Math.random(),
                nome: d.nome,
                valor: d.valor,
                data: novaData.toISOString().split('T')[0],
                status: 'pendente',
                recorrente: true
            });
        }
    });

    salvarStorage();
}

function atualizarLista() {

    atualizarLabelMes();

    let totalPagar = 0;
    let totalPago = 0;

    listaDespesas.sort((a,b) => new Date(a.data) - new Date(b.data));

    listaDespesas.forEach(item => {

        const dataItem = new Date(item.data);
        const hoje = new Date();

        if (
            dataItem.getMonth() !== dataAtual.getMonth() ||
            dataItem.getFullYear() !== dataAtual.getFullYear()
        ) return;

        if (item.status !== 'pago' && dataItem < hoje)
            item.status = 'atrasado';

        if (item.status === 'pago') totalPago += item.valor;
        else totalPagar += item.valor;
    });

    totalPagarEl.innerText = totalPagar.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    totalPagoEl.innerText = totalPago.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    totalGeral.innerText = (totalPago + totalPagar).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

    renderLista();
}

function renderLista() {

    listaDespesasEl.innerHTML = '';

    listaDespesas.forEach(item => {

        const dataItem = new Date(item.data);

        if (
            dataItem.getMonth() !== dataAtual.getMonth() ||
            dataItem.getFullYear() !== dataAtual.getFullYear()
        ) return;

        if (filtroAtual !== 'todos' && item.status !== filtroAtual)
            return;

        const li = document.createElement('li');
        li.className = `lista-item ${item.status}`;

        li.innerHTML = `
            <div class="lista-info">
                <strong>${item.nome}</strong>
                <span>${formatarData(item.data)}</span>
                <span>${item.valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
            </div>

            <div class="lista-acoes">
                <button onclick="editarDespesa(${item.id})">
                    <i class="fa-solid fa-pen"></i>
                </button>

                <button onclick="marcarComoPago(${item.id})">
                    <i class="fa-solid ${item.status === 'pago' ? 'fa-undo' : 'fa-check'}"></i>
                </button>

                <button onclick="excluirDespesa(${item.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        listaDespesasEl.appendChild(li);
    });
}

function editarDespesa(id) {
    const item = listaDespesas.find(d => d.id === id);
    editandoId = id;

    nomeDespesa.value = item.nome;
    valorDespesa.value = item.valor;
    dataVencimento.value = item.data;
    statusDespesa.value = item.status;
    recorrenteDespesa.checked = item.recorrente;

    abrirModalDespesa();
}

function marcarComoPago(id) {

    const index = listaDespesas.findIndex(d => d.id === id);
    const item = listaDespesas[index];

    if (item.status !== 'pago') {
        item.status = 'pago';
        economias -= item.valor;
    } else {
        item.status = 'pendente';
        economias += item.valor;
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
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLista();
}

function formatarData(data) {
    return data.split('-').reverse().join('/');
}

function salvarStorage() {
    localStorage.setItem('minhas_despesas', JSON.stringify(listaDespesas));
    localStorage.setItem('economias', economias);
}