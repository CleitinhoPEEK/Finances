(function attachFinCommon(global) {
    const LIMITE_HISTORICO_PADRAO = 400;
    const DURACAO_ENTRADA_PAGINA_PADRAO = 860;
    const CLASSE_ENTRADA_PAGINA = 'page-open-enter';
    const CLASSE_ENTRADA_PAGINA_ATIVA = 'page-open-enter-active';
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

    const iniciarAnimacaoEntradaPagina = (duracaoMs = DURACAO_ENTRADA_PAGINA_PADRAO) => {
        const body = global.document?.body;
        if (!body) return;
        if (body.dataset.pageOpenAnimated === '1') return;

        const reduzirMovimento = global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduzirMovimento) {
            body.dataset.pageOpenAnimated = '1';
            return;
        }

        body.dataset.pageOpenAnimated = '1';
        body.classList.add(CLASSE_ENTRADA_PAGINA);

        global.requestAnimationFrame(() => {
            global.requestAnimationFrame(() => {
                body.classList.add(CLASSE_ENTRADA_PAGINA_ATIVA);
            });
        });

        const limpezaMs = Math.max(420, Number(duracaoMs) || DURACAO_ENTRADA_PAGINA_PADRAO);
        global.setTimeout(() => {
            body.classList.remove(CLASSE_ENTRADA_PAGINA);
            body.classList.remove(CLASSE_ENTRADA_PAGINA_ATIVA);
        }, limpezaMs + 140);
    };

    global.FinCommon = Object.freeze({
        LIMITE_HISTORICO_PADRAO,
        DURACAO_ENTRADA_PAGINA_PADRAO,
        NOMES_MESES,
        getEl,
        formatarMoeda,
        parseValorInput,
        formatarDataBr,
        getDataLocal,
        getHojeLocal,
        escapeHtml,
        limitarHistorico,
        baixarJson,
        iniciarAnimacaoEntradaPagina
    });
})(window);
