(function attachFinCommon(global) {
    const LIMITE_HISTORICO_PADRAO = 400;
    const NOMES_MESES = Object.freeze([
        'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]);

    const getEl = id => document.getElementById(id);
    const formatarMoeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const parseValorInput = value => parseFloat(String(value ?? '').replace(',', '.'));
    const formatarDataBr = str => String(str ?? '').split('-').reverse().join('/');
    const getDataLocal = valor => new Date(`${valor}T00:00:00`);
    const getHojeLocal = () => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return hoje;
    };
    const escapeHtml = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const limitarHistorico = (historico, limite = LIMITE_HISTORICO_PADRAO) => {
        if (!Array.isArray(historico)) return;
        if (historico.length > limite) historico.length = limite;
    };

    const baixarJson = (dados, nomeArquivo) => {
        const blob = new Blob([JSON.stringify(dados)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    };

    global.FinCommon = Object.freeze({
        LIMITE_HISTORICO_PADRAO,
        NOMES_MESES,
        getEl,
        formatarMoeda,
        parseValorInput,
        formatarDataBr,
        getDataLocal,
        getHojeLocal,
        escapeHtml,
        limitarHistorico,
        baixarJson
    });
})(window);
