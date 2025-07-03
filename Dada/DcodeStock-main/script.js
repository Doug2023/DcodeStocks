document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const mesAtualEl = document.getElementById('mesAtual');
    const btnMesAnterior = document.getElementById('btnMesAnterior');
    const btnProximoMes = document.getElementById('btnProximoMes');
    const nomeEstoqueInput = document.getElementById('nomeEstoqueInput');
    const btnNovoEstoque = document.getElementById('btnNovoEstoque');
    const btnVoltarEstoque = document.getElementById('btnVoltarEstoque');
    const entradaTotalEl = document.getElementById('entradaTotal');
    const saidaTotalEl = document.getElementById('saidaTotal');
    const saldoTotalEl = document.getElementById('saldoTotal');
    const valorFinalEl = document.getElementById('valorFinal');
    const tabelaBody = document.querySelector('table.estoque-table tbody');
    const listaOperacoes = document.getElementById('listaOperacoes');
    const btnLimparHistorico = document.getElementById('btnLimparHistorico');

    // --- Month Navigation ---
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    let displayedDate = new Date();

    function updateMonthDisplay() {
        mesAtualEl.textContent = `${meses[displayedDate.getMonth()]} de ${displayedDate.getFullYear()}`;
    }

    btnMesAnterior.addEventListener('click', () => {
        const dateBeforeChange = new Date(displayedDate);
        displayedDate.setMonth(displayedDate.getMonth() - 1);
        updateMonthDisplay();
        loadStock(currentStockIndex, dateBeforeChange);
    });

    btnProximoMes.addEventListener('click', () => {
        const dateBeforeChange = new Date(displayedDate);
        displayedDate.setMonth(displayedDate.getMonth() + 1);
        updateMonthDisplay();
        loadStock(currentStockIndex, dateBeforeChange);
    });

    // --- Chart Setup ---
    const ctxPizza = document.getElementById('graficoPizza').getContext('2d');
    const ctxBarras = document.getElementById('graficoBarras').getContext('2d');
    const ctxSaidas = document.getElementById('graficoSaidas').getContext('2d');

    const chartPizza = new Chart(ctxPizza, {
        type: 'pie',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
        options: { plugins: { legend: { position: 'bottom' } } }
    });

    const chartBarras = new Chart(ctxBarras, {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
        options: { scales: { y: { beginAtZero: true } } }
    });

    const chartSaidas = new Chart(ctxSaidas, {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
        options: { indexAxis: 'y', scales: { x: { beginAtZero: true } } }
    });

    // --- Color Generation & Storage ---
    const coresMap = JSON.parse(localStorage.getItem('coresMap') || '{}');
    function gerarCor(nome) {
        if (!coresMap[nome]) {
            const r = Math.floor(Math.random() * 156 + 100);
            const g = Math.floor(Math.random() * 156 + 100);
            const b = Math.floor(Math.random() * 156 + 100);
            coresMap[nome] = `rgb(${r},${g},${b})`;
            localStorage.setItem('coresMap', JSON.stringify(coresMap));
        }
        return coresMap[nome];
    }

    // --- Stock Management Variables ---
    const MAX_STOCKS = 10;
    let allStocksMeta = [];
    try {
        const storedMeta = JSON.parse(localStorage.getItem('allStocksMeta'));
        if (Array.isArray(storedMeta)) {
            allStocksMeta = storedMeta;
        }
    } catch (e) {
        console.error("Erro ao parsear allStocksMeta do localStorage. Inicializando como array vazio.", e);
    }
    for (let i = 0; i < MAX_STOCKS; i++) {
        if (!allStocksMeta[i] || typeof allStocksMeta[i] !== 'object' || allStocksMeta[i] === null) {
            allStocksMeta[i] = { namesByMonth: {} };
        } else {
            if (!allStocksMeta[i].namesByMonth) {
                allStocksMeta[i].namesByMonth = {};
            }
        }
    }
    if (allStocksMeta.length > MAX_STOCKS) {
        allStocksMeta = allStocksMeta.slice(0, MAX_STOCKS);
    }

    let currentStockIndex = parseInt(localStorage.getItem('currentStockIndex') || '0');
    if (currentStockIndex < 0 || currentStockIndex >= MAX_STOCKS) {
        currentStockIndex = 0;
    }

    // --- Função para obter a chave do localStorage para o estoque e mês específicos ---
    function getStorageKey(index, date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `estoque_${year}-${month}_${index}`;
    }

    // --- Helper para obter a chave do nome do mês/ano ---
    function getMonthYearKey(date) {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    // --- Table & Data Manipulation Functions ---

    // Helper to check if a row is completely empty
    function isRowEmpty(row) {
        const inputs = row.querySelectorAll('input');
        return [...inputs].every(input =>
            input.value.trim() === '' ||
            (input.type === 'number' && (isNaN(parseFloat(input.value)) || parseFloat(input.value) === 0))
        );
    }

    // Adds a new empty row to the table
    function adicionarLinha(data = {}) {
        const linha = document.createElement('tr');
        linha.innerHTML = `
            <td><input type="text" class="item" value="${data.item || ''}" autocomplete="off" /></td>
            <td><input type="number" class="entrada" min="0" step="any" value="${data.entrada || ''}" autocomplete="off"/></td>
            <td><input type="number" class="saida" min="0" step="any" value="${data.saida || ''}" autocomplete="off"/></td>
            <td><input type="number" class="valor" min="0" step="0.01" value="${data.valor || ''}" autocomplete="off"/></td>
        `;
        tabelaBody.appendChild(linha);
        adicionarEventosLinha(linha);
    }

    // Attaches event listeners to inputs within a table row
    function adicionarEventosLinha(linha) {
        const inputs = linha.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                atualizarResumo();
                atualizarGraficos();
                salvarDadosDoMesAtual(currentStockIndex, displayedDate);
                verificarLinhaFinal();
                removerLinhasVazias();
            });
        });

        linha.querySelector('.entrada').addEventListener('change', () => {
            const item = linha.querySelector('.item').value.trim();
            const valor = parseFloat(linha.querySelector('.entrada').value) || 0;
            if (item && valor > 0) registrarOperacao('entrada', item, valor);
        });
        linha.querySelector('.saida').addEventListener('change', () => {
            const item = linha.querySelector('.item').value.trim();
            const valor = parseFloat(linha.querySelector('.saida').value) || 0;
            if (item && valor > 0) registrarOperacao('saida', item, valor);
        });
    }

    // Ensures there's always an empty line at the end for user input
    function verificarLinhaFinal() {
        const linhas = tabelaBody.querySelectorAll('tr');
        if (linhas.length === 0 || !isRowEmpty(linhas[linhas.length - 1])) {
            adicionarLinha();
        }
    }

    // Removes empty rows, but keeps the last one for input
    function removerLinhasVazias() {
        const linhas = tabelaBody.querySelectorAll('tr');
        for (let i = linhas.length - 2; i >= 0; i--) {
            if (isRowEmpty(linhas[i])) {
                linhas[i].remove();
            }
        }
    }

    // Calculates and updates summary totals
    function atualizarResumo() {
        let entrada = 0, saida = 0, saldo = 0, valorTotal = 0;
        const linhas = tabelaBody.querySelectorAll('tr');
        linhas.forEach(linha => {
            const ent = parseFloat(linha.querySelector('.entrada').value) || 0;
            const sai = parseFloat(linha.querySelector('.saida').value) || 0;
            const val = parseFloat(linha.querySelector('.valor').value) || 0;
            entrada += ent;
            saida += sai;
            saldo += (ent - sai);
            valorTotal += val;
        });
        entradaTotalEl.textContent = entrada;
        saidaTotalEl.textContent = saida;
        saldoTotalEl.textContent = saldo;
        valorFinalEl.textContent = valorTotal.toFixed(2);
    }

    // Updates chart data based on table content
    function atualizarGraficos() {
        const labels = [], entradas = [], valores = [], cores = [];
        const dataSaida = {}, corSaidaPorItem = {};
        const linhas = tabelaBody.querySelectorAll('tr');

        linhas.forEach(linha => {
            const nome = linha.querySelector('.item').value.trim();
            const ent = parseFloat(linha.querySelector('.entrada').value) || 0;
            const sai = parseFloat(linha.querySelector('.saida').value) || 0;
            const val = parseFloat(linha.querySelector('.valor').value) || 0;

            if (nome) {
                const cor = gerarCor(nome);
                if (ent > 0) {
                    const existingIndex = labels.indexOf(nome);
                    if (existingIndex > -1) {
                        entradas[existingIndex] += ent;
                        valores[existingIndex] += val;
                    } else {
                        labels.push(nome);
                        entradas.push(ent);
                        valores.push(val);
                        cores.push(cor);
                    }
                }
                if (sai > 0) {
                    dataSaida[nome] = (dataSaida[nome] || 0) + sai;
                    corSaidaPorItem[nome] = cor;
                }
            }
        });

        // Update Pie Chart
        chartPizza.data.labels = labels;
        chartPizza.data.datasets[0].data = entradas;
        chartPizza.data.datasets[0].backgroundColor = cores;
        chartPizza.update();

        // Update Bar Chart (Valores)
        chartBarras.data.labels = labels;
        chartBarras.data.datasets[0].data = valores;
        chartBarras.data.datasets[0].backgroundColor = cores;
        chartBarras.update();

        // Update Saídas Chart
        const saidaLabels = Object.keys(dataSaida);
        chartSaidas.data.labels = saidaLabels;
        chartSaidas.data.datasets[0].data = saidaLabels.map(l => dataSaida[l]);
        chartSaidas.data.datasets[0].backgroundColor = saidaLabels.map(l => corSaidaPorItem[l]);
        chartSaidas.update();
    }

    // Saves current table and stock name data to localStorage for the specific month
    function salvarDadosDoMesAtual(index, dateToSave) {
        const linhasVisiveis = [...tabelaBody.querySelectorAll('tr')].filter(row => !isRowEmpty(row));
        const dadosParaSalvar = linhasVisiveis.map(linha => ({
            item: linha.querySelector('.item').value,
            entrada: linha.querySelector('.entrada').value,
            saida: linha.querySelector('.saida').value,
            valor: linha.querySelector('.valor').value
        }));

        const monthYearKey = getMonthYearKey(dateToSave);
        const currentName = nomeEstoqueInput.value.trim();

        allStocksMeta[index].namesByMonth[monthYearKey] = currentName || `Estoque ${index + 1}`;
        localStorage.setItem('allStocksMeta', JSON.stringify(allStocksMeta));

        const stockDataForMonth = {
            tableData: dadosParaSalvar,
            history: [...listaOperacoes.children].map(li => li.textContent)
        };

        localStorage.setItem(getStorageKey(index, dateToSave), JSON.stringify(stockDataForMonth));
        localStorage.setItem('currentStockIndex', currentStockIndex);
    }

    // Registers an operation in the history list and saves it
    function registrarOperacao(tipo, item, quantidade) {
        const data = new Date();
        const dataFormatada = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth()+1).toString().padStart(2, '0')}/${data.getFullYear()}`;
        const displayedMonthYear = `${meses[displayedDate.getMonth()]} ${displayedDate.getFullYear()}`;
        // Novo formato: [DATA - MÊS] ITEM: NOME - ENTRADA/SAÍDA: QTD
        const texto = `[${dataFormatada} - ${displayedMonthYear}] ITEM: ${item} - ${tipo.toUpperCase()}: ${quantidade}`;

        const li = document.createElement('li');
        li.textContent = texto;
        listaOperacoes.prepend(li);

        salvarDadosDoMesAtual(currentStockIndex, displayedDate);
    }

    // Loads a specific stock by its index and the current displayed month
    function loadStock(indexToLoad, previousDateForSave = null) {
        if (currentStockIndex !== null && currentStockIndex < MAX_STOCKS && allStocksMeta[currentStockIndex]) {
            const dateToSave = previousDateForSave || displayedDate;
            salvarDadosDoMesAtual(currentStockIndex, dateToSave);
        }

        currentStockIndex = (indexToLoad + MAX_STOCKS) % MAX_STOCKS;
        localStorage.setItem('currentStockIndex', currentStockIndex);

        const monthYearKey = getMonthYearKey(displayedDate);
        const defaultName = `Estoque ${currentStockIndex + 1}`;
        nomeEstoqueInput.value = allStocksMeta[currentStockIndex].namesByMonth[monthYearKey] || defaultName;

        const storageKey = getStorageKey(currentStockIndex, displayedDate);
        let stockDataForMonth = {};
        try {
            stockDataForMonth = JSON.parse(localStorage.getItem(storageKey)) || { tableData: [], history: [] };
        } catch (e) {
            console.error("Erro ao carregar dados do mês para a chave:", storageKey, e);
            stockDataForMonth = { tableData: [], history: [] };
        }

        tabelaBody.innerHTML = '';

        (stockDataForMonth.tableData || []).forEach(data => {
            adicionarLinha(data);
        });
        adicionarLinha();

        listaOperacoes.innerHTML = '';
        (stockDataForMonth.history || []).slice().reverse().forEach(txt => {
            const li = document.createElement('li');
            li.textContent = txt;
            listaOperacoes.appendChild(li);
        });

        updateMonthDisplay();
        atualizarResumo();
        atualizarGraficos();

        // Esta é a linha mais importante para evitar o "pulo"
        nomeEstoqueInput.blur();
    }

    // --- Initial Setup and Event Listeners ---

    // Initial load of the current stock when the page loads
    loadStock(currentStockIndex);

    // Event Listener for stock name input (on blur/change)
    nomeEstoqueInput.addEventListener('change', () => {
        salvarDadosDoMesAtual(currentStockIndex, displayedDate);
    });

    // '+' button to navigate to next stock (0-9)
    btnNovoEstoque.addEventListener('click', () => {
        loadStock(currentStockIndex + 1);
    });

    // '-' button to navigate to previous stock (0-9)
    btnVoltarEstoque.addEventListener('click', () => {
        loadStock(currentStockIndex - 1);
    });

    // Button to clear history for current stock (for the current month)
    btnLimparHistorico.addEventListener('click', () => {
        const stockName = allStocksMeta[currentStockIndex].namesByMonth[getMonthYearKey(displayedDate)] || `Estoque ${currentStockIndex + 1}`;
        if (confirm(`Tem certeza que deseja apagar todo o histórico de operações para o estoque "${stockName}" no mês de ${meses[displayedDate.getMonth()]} ${displayedDate.getFullYear()}? Esta ação é irreversível.`)) {
            listaOperacoes.innerHTML = '';
            salvarDadosDoMesAtual(currentStockIndex, displayedDate);
            alert('Histórico de operações apagado com sucesso!');
        }
    });

    // Make table rows sortable
    new Sortable(tabelaBody, {
        animation: 150,
        ghostClass: 'arrastando',
        onEnd: () => {
            salvarDadosDoMesAtual(currentStockIndex, displayedDate);
            atualizarResumo();
            atualizarGraficos();
            verificarLinhaFinal();
            removerLinhasVazias();
        }
    });

    // Service Worker Registration for PWA capabilities
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(() => console.log('Service Worker registrado com sucesso!'))
            .catch(err => console.error('Erro ao registrar Service Worker:', err));
    }

    // Save current stock data when the page is closed or reloaded
    window.addEventListener('beforeunload', () => {
        salvarDadosDoMesAtual(currentStockIndex, displayedDate);
    });
});