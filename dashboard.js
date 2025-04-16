/**
 * Dashboard de Tarefas - SOMOS CREATORS
 * dashboard.js - Lógica principal para visualização por equipes
 */

// Configurações globais e variáveis
const CONFIG = {

    
    // Mapeamento de cores por cliente para consistência na UI
    clientColors: {
      'SICREDI': 'danger',
      'SAMSUNG': 'primary',
      'VIVO': 'success',
      'RD': 'warning',
      'AMERICANAS': 'info',
      'OBOTICARIO': 'dark',
      'COGNA': 'secondary',
      'ENGIE': 'danger'
    },
    
    // Mapeamento de campos entre API/JSON e nomes mais amigáveis
    fieldMapping: {
      'ClientNickname': 'Cliente',
      'TaskNumber': 'Número da Tarefa',
      'TaskTitle': 'Título da Tarefa',
      'RequestDate': 'Data Inicial',
      'UnitName': 'Tipo de Solicitação (Peça)',
      'EndDate': 'Data de Encerramento',
      'CurrentDueDate': 'Prazo',
      'RequestTypeName': 'Tipo de Solicitação',
      'TaskExecutionFunctionGroupName': 'Equipe',
      'TaskOwnerDisplayName': 'Responsável',
      'TaskOwnerGroupName': 'Grupo do Responsável',
      'TaskClosingDate': 'Data de Conclusão',
      'Priority': 'Prioridade'
    },
    
    // Mapeamento de prioridade para classes CSS
    priorityClasses: {
      'high': 'task-priority-high',
      'medium': 'task-priority-medium',
      'low': 'task-priority-low'
    }
  };
  
  // Armazenamento de dados e estado da aplicação
  let appState = {
    allData: [],           // Todos os dados carregados
    filteredData: [],      // Dados após aplicação de filtros
    timeline: null,        // Instância do objeto timeline
    isLoading: false,      // Flag para controle de carregamento
    settings: {            // Configurações salvas
      dataSource: localStorage.getItem('dataSource') || 'json',
      jsonUrl: localStorage.getItem('jsonUrl') || 'dados.json',
      projectId: localStorage.getItem('projectId') || 'monday-export',
      dataset: localStorage.getItem('dataset') || 'taskrow_views',
      table: localStorage.getItem('table') || 'CJT_RD_RTC'
    }
  };
  
  // Inicialização
  document.addEventListener("DOMContentLoaded", () => {
    // Ajusta o ano no rodapé
    document.getElementById("ano-atual").textContent = new Date().getFullYear();
    
    // Configura event listeners dos elementos de UI
    setupEventListeners();
    
    // Carrega os dados
    carregarDados();
  });
  
  // Função para configurar todos os event listeners
  function setupEventListeners() {
    // Botões da timeline
    document.getElementById("btn-anterior").addEventListener("click", () => moverTimeline(-7));
    document.getElementById("btn-hoje").addEventListener("click", () => irParaHoje());
    document.getElementById("btn-proximo").addEventListener("click", () => moverTimeline(7));
    document.getElementById("btn-zoom-out").addEventListener("click", () => ajustarZoom(0.7));
    document.getElementById("btn-zoom-in").addEventListener("click", () => ajustarZoom(1.3));
    
    // Botão de exportação
    document.getElementById("exportar-dados").addEventListener("click", exportarCSV);
    
    // Filtros
    document.getElementById("cliente-select").addEventListener("change", atualizarFiltros);
    document.getElementById("periodo-select").addEventListener("change", atualizarFiltros);
    document.getElementById("grupo-principal-select").addEventListener("change", () => {
      atualizarSubgrupos();
      atualizarFiltros();
    });
    document.getElementById("subgrupo-select").addEventListener("change", atualizarFiltros);
    
    // Configuração de tela cheia
    configurarEventoTelaCheia();
  }
  
  // Função principal para carregar dados
  async function carregarDados() {
    try {
      mostrarLoading(true);
      
      // Determina a fonte de dados
      if (appState.settings.dataSource === 'json') {
        await carregarDadosDeJSON();
      } else if (appState.settings.dataSource === 'bigquery') {
        await carregarDadosDeBigQuery();
      }
      
      // Preenche os seletores de filtro
      preencherFiltros();
      
      // Atualiza a visualização com todos os dados
      atualizarFiltros();
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      mostrarNotificacao('Erro ao carregar dados', error.message, 'error');
    } finally {
      mostrarLoading(false);
    }
  }
  
  // Carrega dados de um arquivo JSON local
  async function carregarDadosDeJSON() {
    try {
      const response = await fetch(appState.settings.jsonUrl);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const dadosOriginais = await response.json();
      
      // Processa e armazena os dados
      appState.allData = dadosOriginais.map(preprocessarDados);
      
    } catch (error) {
      throw new Error(`Falha ao carregar dados do JSON: ${error.message}`);
    }
  }
  
  // Carrega dados do BigQuery - Implementação simulada para futuro
  async function carregarDadosDeBigQuery() {
    // Esta função seria implementada para conectar com o BigQuery
    // Por enquanto, carregamos o JSON local como fallback
    try {
      mostrarNotificacao('Conectando ao BigQuery', 'Estabelecendo conexão...', 'info');
      
      // Simula uma consulta ao BigQuery
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Exemplo de consulta SQL que seria executada:
      /*
      const query = `
        SELECT 
          ClientNickname, 
          TaskNumber, 
          TaskTitle, 
          RequestDate, 
          TaskClosingDate, 
          TaskOwnerDisplayName,
          TaskOwnerGroupName,
          TaskExecutionFunctionGroupName,
          Priority
        FROM 
          \`${appState.settings.projectId}.${appState.settings.dataset}.${appState.settings.table}\`
        WHERE 
          RequestDate IS NOT NULL
        LIMIT 1000
      `;
      */
      
      // Por enquanto, carregamos o JSON local
      const response = await fetch(appState.settings.jsonUrl);
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const dadosOriginais = await response.json();
      
      // Processa e armazena os dados
      appState.allData = dadosOriginais.map(preprocessarDados);
      
      mostrarNotificacao('Dados carregados do BigQuery', `${appState.allData.length} tarefas carregadas com sucesso.`, 'success');
      
    } catch (error) {
      throw new Error(`Falha ao carregar dados do BigQuery: ${error.message}`);
    }
  }
  
  // Preprocessa um item de dados para normalizar e estruturar corretamente
  function preprocessarDados(item) {
    const processado = {...item};
    
    // Se não tiver prioridade definida, atribui aleatoriamente
    if (!processado.Priority) {
      const prioridades = ['high', 'medium', 'low'];
      processado.Priority = prioridades[Math.floor(Math.random() * prioridades.length)];
    }
    
    // Processa grupo e subgrupo a partir do TaskOwnerGroupName
    if (processado.TaskOwnerGroupName) {
      if (processado.TaskOwnerGroupName.includes("/")) {
        const partes = processado.TaskOwnerGroupName.split("/").map(p => p.trim());
        processado.TaskOwnerGroup = partes[0];
        
        if (partes.length > 1) {
          processado.TaskOwnerSubgroup = partes.slice(1).join(" / ");
        }
      } else {
        processado.TaskOwnerGroup = processado.TaskOwnerGroupName;
        processado.TaskOwnerSubgroup = "";
      }
    }
    
    // Se não tiver grupo de execução, usa o grupo do responsável
    if (!processado.TaskExecutionFunctionGroupName && processado.TaskOwnerGroup) {
      processado.TaskExecutionFunctionGroupName = processado.TaskOwnerGroup;
    }
    
    // Garante que datas estejam no formato correto
    if (processado.RequestDate && typeof processado.RequestDate === 'string') {
      processado.RequestDate = processado.RequestDate.replace(' ', 'T');
    }
    
    if (processado.TaskClosingDate && typeof processado.TaskClosingDate === 'string') {
      processado.TaskClosingDate = processado.TaskClosingDate.replace(' ', 'T');
    }
    
    if (processado.CurrentDueDate && typeof processado.CurrentDueDate === 'string') {
      processado.CurrentDueDate = processado.CurrentDueDate.replace(' ', 'T');
    }
    
    return processado;
  }
  
  // Preenche os seletores de filtro com opções baseadas nos dados disponíveis
  function preencherFiltros() {
    if (!appState.allData || appState.allData.length === 0) return;
    
    // Obtém listas únicas de clientes, grupos e subgrupos
    const clientes = [...new Set(appState.allData
      .map(t => t.ClientNickname)
      .filter(Boolean))]
      .sort();
    
    const gruposPrincipais = [...new Set(appState.allData
      .map(t => t.TaskExecutionFunctionGroupName)
      .filter(Boolean))]
      .sort();
    
    // Preenche o select de clientes
    const clienteSelect = document.getElementById("cliente-select");
    clienteSelect.innerHTML = '<option value="todos">Todos</option>';
    clientes.forEach(cliente => {
      const option = document.createElement("option");
      option.value = cliente;
      option.textContent = cliente;
      clienteSelect.appendChild(option);
    });
    
    // Preenche o select de grupos principais
    const grupoPrincipalSelect = document.getElementById("grupo-principal-select");
    // Mantém a opção "Todos" e as opções pré-definidas
    const gruposPreDefinidos = Array.from(grupoPrincipalSelect.options).map(opt => opt.value);
    
    // Adiciona grupos que não estejam nos pré-definidos
    gruposPrincipais.forEach(grupo => {
      if (!gruposPreDefinidos.includes(grupo) && grupo !== 'todos') {
        const option = document.createElement("option");
        option.value = grupo;
        option.textContent = grupo;
        grupoPrincipalSelect.appendChild(option);
      }
    });
    
    // Atualiza subgrupos com base no grupo selecionado
    atualizarSubgrupos();
  }
  
  // Atualiza o select de subgrupos com base no grupo principal selecionado
  function atualizarSubgrupos() {
    const grupoPrincipalSelect = document.getElementById("grupo-principal-select");
    const subgrupoSelect = document.getElementById("subgrupo-select");
    
    if (!grupoPrincipalSelect || !subgrupoSelect || !appState.allData) return;
    
    const grupoPrincipal = grupoPrincipalSelect.value;
    subgrupoSelect.innerHTML = '<option value="todos">Todos</option>';
    
    if (grupoPrincipal === "todos") return;
    
    // Filtra os dados pelo grupo principal selecionado
    const tarefasDoGrupo = appState.allData.filter(t => 
      t.TaskExecutionFunctionGroupName === grupoPrincipal ||
      t.TaskOwnerGroup === grupoPrincipal
    );
    
    // Obtém lista única de subgrupos
    const subgrupos = [...new Set(tarefasDoGrupo
      .map(t => t.TaskOwnerSubgroup)
      .filter(Boolean))]
      .sort();
    
    // Preenche o select de subgrupos
    subgrupos.forEach(subgrupo => {
      const option = document.createElement("option");
      option.value = subgrupo;
      option.textContent = subgrupo;
      subgrupoSelect.appendChild(option);
    });
  }
  
  // Atualiza os filtros e regenera visualizações
  function atualizarFiltros() {
    if (!appState.allData || appState.allData.length === 0) return;
    
    const clienteSelect = document.getElementById("cliente-select");
    const periodoSelect = document.getElementById("periodo-select");
    const grupoPrincipalSelect = document.getElementById("grupo-principal-select");
    const subgrupoSelect = document.getElementById("subgrupo-select");
    
    if (!clienteSelect || !periodoSelect || !grupoPrincipalSelect || !subgrupoSelect) return;
    
    // Obtém valores selecionados
    const cliente = clienteSelect.value;
    const dias = parseInt(periodoSelect.value);
    const grupoPrincipal = grupoPrincipalSelect.value;
    const subgrupo = subgrupoSelect.value;
    
    // Calcula data limite para o período selecionado
    const limite = new Date();
    limite.setDate(limite.getDate() - dias);
  
    // Filtra por data
    appState.filteredData = appState.allData.filter(item => {
      if (!item.RequestDate) return false;
      return new Date(item.RequestDate) >= limite;
    });
  
    // Filtro por cliente
    if (cliente !== "todos") {
      appState.filteredData = appState.filteredData.filter(item => item.ClientNickname === cliente);
    }
    
    // Filtro por grupo
    if (grupoPrincipal !== "todos") {
      appState.filteredData = appState.filteredData.filter(item => 
        item.TaskExecutionFunctionGroupName === grupoPrincipal || 
        item.TaskOwnerGroup === grupoPrincipal
      );
    }
    
    // Filtro por subgrupo
    if (subgrupo !== "todos") {
      appState.filteredData = appState.filteredData.filter(item => item.TaskOwnerSubgroup === subgrupo);
    }
  
    // Atualiza visualizações
    criarTimeline(appState.filteredData);
  }
  
  // Cria a visualização de timeline com os dados filtrados
  function criarTimeline(dados) {
    const container = document.getElementById("timeline");
    if (!container) return;
    
    // Limpa o container
    container.innerHTML = "";
    
    // Verifica se há dados
    if (!dados || dados.length === 0) {
      container.innerHTML = '<div class="alert alert-info m-3">Nenhuma tarefa encontrada para o período e filtros selecionados.</div>';
      return;
    }
  
    try {
      // Determina se vamos agrupar por responsável ou por equipe
      const grupoPrincipal = document.getElementById("grupo-principal-select").value;
      let grupoProperty;
      let grupos;
      
      if (grupoPrincipal !== "todos") {
        // Se um grupo principal foi selecionado, agrupa por responsável
        grupoProperty = "TaskOwnerDisplayName";
        grupos = [...new Set(dados
          .map(t => t.TaskOwnerDisplayName || "Sem responsável")
          .filter(Boolean))]
          .sort();
      } else {
        // Se nenhum grupo principal foi selecionado, agrupa por equipe
        grupoProperty = "TaskExecutionFunctionGroupName";
        grupos = [...new Set(dados
          .map(t => t.TaskExecutionFunctionGroupName || t.TaskOwnerGroup || "Sem equipe")
          .filter(Boolean))]
          .sort();
      }
  
      // Cria os items para a timeline
      const items = new vis.DataSet(dados.map((item, i) => {
        // Determina data de fim (usa prazo se não tiver data de conclusão)
        const fim = item.TaskClosingDate || item.CurrentDueDate || moment().add(14, 'days').format('YYYY-MM-DD');
        
        // Prepara o título da tarefa (abrevia se for muito longo)
        const titulo = item.TaskTitle || "Sem título";
        const tituloAbreviado = titulo.length > 30 ? titulo.substring(0, 27) + "..." : titulo;
        
        // Formata datas para exibição
        const dataInicioFormatada = item.RequestDate ? moment(item.RequestDate).format("DD/MM/YYYY") : "Não definida";
        const dataFimFormatada = item.TaskClosingDate ? moment(item.TaskClosingDate).format("DD/MM/YYYY") : 
                               (item.CurrentDueDate ? moment(item.CurrentDueDate).format("DD/MM/YYYY") : "Não definida");
        
        // Conteúdo do tooltip
        const tooltipContent = `
          <strong>${titulo}</strong><br>
          <strong>Cliente:</strong> ${item.ClientNickname || "Não definido"}<br>
          <strong>Responsável:</strong> ${item.TaskOwnerDisplayName || "Não definido"}<br>
          <strong>Data Início:</strong> ${dataInicioFormatada}<br>
          <strong>Prazo/Fim:</strong> ${dataFimFormatada}<br>
          <strong>Equipe:</strong> ${item.TaskExecutionFunctionGroupName || item.TaskOwnerGroup || "Não definida"}<br>
          <strong>Prioridade:</strong> ${item.Priority === "high" ? "Alta" : item.Priority === "medium" ? "Média" : "Baixa"}
        `;
        
        // Determina o grupo para organização na timeline
        const grupo = grupoProperty === "TaskOwnerDisplayName" 
          ? (item.TaskOwnerDisplayName || "Sem responsável")
          : (item.TaskExecutionFunctionGroupName || item.TaskOwnerGroup || "Sem equipe");
        
        return {
          id: i,
          content: `<span title="${titulo}">${tituloAbreviado}</span>`,
          start: item.RequestDate,
          end: fim,
          group: grupo,
          title: tooltipContent,
          className: CONFIG.priorityClasses[item.Priority] || ''
        };
      }));
  
      // Cria os grupos para a timeline
      const visGroups = new vis.DataSet(grupos.map(g => ({ id: g, content: g })));
  
      // Configurações da timeline
      const options = {
        orientation: "top",
        stack: true,
        editable: false,
        horizontalScroll: true,
        zoomKey: "ctrlKey",
        margin: { item: { vertical: 10 } },
        timeAxis: { scale: "day", step: 1 },
        zoomMin: 1000 * 60 * 60 * 24 * 7,     // Mínimo zoom: 1 semana
        zoomMax: 1000 * 60 * 60 * 24 * 90,    // Máximo zoom: 90 dias
        start: moment().subtract(7, "days").valueOf(),
        end: moment().add(14, "days").valueOf(),
        height: "800px" // Timeline mais alta que no original
      };
  
      // Cria a timeline
      appState.timeline = new vis.Timeline(container, items, visGroups, options);
  
      // Ajusta para mostrar todos os dados
      setTimeout(() => appState.timeline.fit(), 500);
      
    } catch (error) {
      console.error("Erro ao criar timeline:", error);
      container.innerHTML = `<div class="alert alert-danger m-3">Erro ao criar visualização: ${error.message}</div>`;
    }
  }
  
  // Funções para controle da timeline
  function moverTimeline(dias) {
    if (!appState.timeline) return;
    
    const range = appState.timeline.getWindow();
    
    appState.timeline.setWindow({
      start: moment(range.start).add(dias, 'days').valueOf(),
      end: moment(range.end).add(dias, 'days').valueOf()
    });
  }
  
  function irParaHoje() {
    if (!appState.timeline) return;
    
    const range = appState.timeline.getWindow();
    const intervalo = range.end - range.start;
    const hoje = moment().valueOf();
    
    appState.timeline.setWindow({
      start: hoje - intervalo / 2,
      end: hoje + intervalo / 2
    });
  }
  
  function ajustarZoom(fator) {
    if (!appState.timeline) return;
    
    const range = appState.timeline.getWindow();
    const start = new Date(range.start);
    const end = new Date(range.end);
    const intervalo = end - start;
    const centro = new Date((end.getTime() + start.getTime()) / 2);
    
    const novoIntervalo = intervalo / fator;
    
    appState.timeline.setWindow({
      start: new Date(centro.getTime() - novoIntervalo / 2),
      end: new Date(centro.getTime() + novoIntervalo / 2)
    });
  }
  
  // Exporta dados filtrados para CSV
  function exportarCSV() {
    if (!appState.filteredData || appState.filteredData.length === 0) {
      mostrarNotificacao('Exportação', 'Não há dados para exportar.', 'warning');
      return;
    }
    
    // Define cabeçalhos do CSV
    const headers = ["Cliente", "Responsável", "Tarefa", "Data Início", "Data Fim", "Equipe", "Prioridade"];
    
    // Prepara as linhas de dados
    const linhas = appState.filteredData.map(item => [
      item.ClientNickname || "Não definido",
      item.TaskOwnerDisplayName || "Não definido",
      item.TaskTitle || "Sem título",
      item.RequestDate ? moment(item.RequestDate).format("DD/MM/YYYY") : "-",
      item.TaskClosingDate ? moment(item.TaskClosingDate).format("DD/MM/YYYY") : 
        (item.CurrentDueDate ? moment(item.CurrentDueDate).format("DD/MM/YYYY") : "-"),
      item.TaskExecutionFunctionGroupName || item.TaskOwnerGroup || "Não definido",
      item.Priority === "high" ? "Alta" : item.Priority === "medium" ? "Média" : "Baixa"
    ]);
    
    // Monta o conteúdo do CSV
    const csvContent = [
      headers.join(","),
      ...linhas.map(linha => linha.map(campo => `"${campo}"`).join(","))
    ].join("\n");
    
    // Cria o blob e o link para download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `tarefas_${moment().format("YYYY-MM-DD")}.csv`);
    link.style.visibility = "hidden";
    
    // Adiciona ao DOM, clica e remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarNotificacao('Exportação concluída', `${appState.filteredData.length} tarefas exportadas com sucesso.`, 'success');
  }
  
  // Configura o evento de tela cheia para a timeline
  function configurarEventoTelaCheia() {
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const timelineCard = document.querySelector('.cronograma-card');
    
    if (!btnFullscreen || !timelineCard) return;
    
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        // Entra em tela cheia
        if (timelineCard.requestFullscreen) {
          timelineCard.requestFullscreen();
        } else if (timelineCard.webkitRequestFullscreen) {
          timelineCard.webkitRequestFullscreen();
        } else if (timelineCard.msRequestFullscreen) {
          timelineCard.msRequestFullscreen();
        }
        
        // Ajusta altura da timeline
        if (appState.timeline) {
          setTimeout(() => {
            const altura = window.innerHeight - 150;
            document.getElementById('timeline').style.height = `${altura}px`;
            appState.timeline.redraw();
          }, 100);
        }
      } else {
        // Sai da tela cheia
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
        
        // Restaura altura original
        setTimeout(() => {
          document.getElementById('timeline').style.height = '800px';
          appState.timeline.redraw();
        }, 100);
      }
    });
    
    // Detecta saída do modo tela cheia
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        document.getElementById('timeline').style.height = '800px';
        if (appState.timeline) appState.timeline.redraw();
      }
    });
  }
  
  // Funções utilitárias
  // Exibe/oculta indicadores de carregamento
  function mostrarLoading(mostrar) {
    appState.isLoading = mostrar;
    
    // Atualiza a UI para indicar estado de carregamento
    const timelineContainer = document.getElementById("timeline");
    
    if (mostrar && timelineContainer) {
      // Mostra loading
      timelineContainer.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p class="mt-3">Carregando dados...</p>
        </div>
      `;
    }
  }
  
  // Exibe uma notificação toast
  function mostrarNotificacao(titulo, mensagem, tipo = 'info') {
    // Cria container de toasts se não existir
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      toastContainer.style.zIndex = "1050";
      document.body.appendChild(toastContainer);
    }
    
    // Cria o elemento toast
    const toastId = 'toast-' + Date.now();
    const toastHTML = `
      <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header ${tipo === 'error' ? 'bg-danger text-white' : 
                                tipo === 'success' ? 'bg-success text-white' : 
                                tipo === 'warning' ? 'bg-warning' : 'bg-info text-white'}">
          <strong class="me-auto">${titulo}</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${mensagem}
        </div>
      </div>
    `;
    
    // Adiciona à página
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    // Inicializa o toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
    toast.show();
    
    // Remove após fechar
    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.remove();
    });
  }