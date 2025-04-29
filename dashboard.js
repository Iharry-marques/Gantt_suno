/**
 * Dashboard de Tarefas - SOMOS CREATORS
 * dashboard.js - Lógica principal para visualização por equipes
 */

// Configurações globais e variáveis
const CONFIG = {
  // Mapeamento de cores por cliente para consistência na UI
  clientColors: {
    SICREDI: "danger",
    SAMSUNG: "primary",
    VIVO: "success",
    RD: "warning",
    AMERICANAS: "info",
    OBOTICARIO: "dark",
    COGNA: "secondary",
    ENGIE: "danger",
  },

  // Mapeamento de campos entre API/JSON e nomes mais amigáveis
  fieldMapping: {
    client: "Cliente",
    name: "Título da Tarefa",
    start: "Data Inicial",
    end: "Data Final",
    responsible: "Responsável",
    group_subgroup: "Grupo/Subgrupo",
    project: "Projeto",
    tipo: "Tipo de Tarefa",
    PipelineStepTitle: "Status",
  },

  // Mapeamento de prioridade para classes CSS
  priorityClasses: {
    high: "task-priority-high",
    medium: "task-priority-medium",
    low: "task-priority-low",
  },
};

// Armazenamento de dados e estado da aplicação
let appState = {
  allData: [], // Todos os dados carregados
  filteredData: [], // Dados após aplicação de filtros
  timeline: null, // Instância do objeto timeline
  isLoading: false, // Flag para controle de carregamento
  settings: {
    // Configurações salvas
    dataSource: localStorage.getItem("dataSource") || "json",
    jsonUrl: localStorage.getItem("jsonUrl") || "dados.json",
    projectId: localStorage.getItem("projectId") || "monday-export",
    dataset: localStorage.getItem("dataset") || "taskrow_views",
    table: localStorage.getItem("table") || "CJT_RD_RTC",
  },
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
  document
    .getElementById("btn-anterior")
    .addEventListener("click", () => moverTimeline(-7));
  document
    .getElementById("btn-hoje")
    .addEventListener("click", () => irParaHoje());
  document
    .getElementById("btn-proximo")
    .addEventListener("click", () => moverTimeline(7));
  document
    .getElementById("btn-zoom-out")
    .addEventListener("click", () => ajustarZoom(0.7));
  document
    .getElementById("btn-zoom-in")
    .addEventListener("click", () => ajustarZoom(1.3));

  // Botão de exportação
  document
    .getElementById("exportar-dados")
    .addEventListener("click", exportarCSV);

  // Filtros
  document
    .getElementById("cliente-select")
    .addEventListener("change", atualizarFiltros);
  document
    .getElementById("periodo-select")
    .addEventListener("change", atualizarFiltros);
  document
    .getElementById("grupo-principal-select")
    .addEventListener("change", () => {
      atualizarSubgrupos();
      atualizarFiltros();
    });
  document
    .getElementById("subgrupo-select")
    .addEventListener("change", atualizarFiltros);

  // Configuração de tela cheia
  configurarEventoTelaCheia();
}

// Função principal para carregar dados
async function carregarDados() {
  try {
    mostrarLoading(true);

    // Determina a fonte de dados
    if (appState.settings.dataSource === "json") {
      await carregarDadosDeJSON();
    } else if (appState.settings.dataSource === "bigquery") {
      await carregarDadosDeBigQuery();
    }

    // Preenche os seletores de filtro
    preencherFiltros();

    // Atualiza a visualização com todos os dados
    atualizarFiltros();
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    mostrarNotificacao("Erro ao carregar dados", error.message, "error");
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
    mostrarNotificacao(
      "Conectando ao BigQuery",
      "Estabelecendo conexão...",
      "info"
    );

    // Simula uma consulta ao BigQuery
    await new Promise((resolve) => setTimeout(resolve, 1500));

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

    mostrarNotificacao(
      "Dados carregados do BigQuery",
      `${appState.allData.length} tarefas carregadas com sucesso.`,
      "success"
    );
  } catch (error) {
    throw new Error(`Falha ao carregar dados do BigQuery: ${error.message}`);
  }
}

function preprocessarDados(item) {
  const processado = { ...item };

  // Mapeamento de prioridade
  if (processado.PipelineStepTitle) {
    const statusPriority = {
      "Não iniciada": "low",
      Backlog: "medium",
      "Em Produção": "high",
    };
    processado.Priority = statusPriority[processado.PipelineStepTitle] || "medium";
  }

  // Processamento hierárquico dos grupos
  if (processado.group_subgroup) {
    const partes = processado.group_subgroup
      .split(/\/|>>/) // Permite diferentes separadores
      .map(p => p.trim())
      .filter(p => p !== "");

    // Mapeamento de grupos principais
    const gruposPrincipais = ["Criação", "BI", "Operações", "Produção", "Mídia"];
    
    // Encontrar o grupo principal
    let grupoIndex = -1;
    const grupoPrincipal = partes.find((p, index) => {
      grupoIndex = index;
      return gruposPrincipais.includes(p);
    }) || "Outros";

    processado.TaskOwnerGroup = grupoPrincipal;
    processado.TaskOwnerSubgroup = partes.slice(grupoIndex + 1).join(" / ");

    // Caso especial para Produção
    if (grupoPrincipal === "Produção" && partes.length === 1) {
      processado.TaskOwnerSubgroup = partes[0];
    }
  }

  // Normalização de datas
  processado.RequestDate = processado.start ? processado.start : new Date().toISOString();
  processado.TaskClosingDate = processado.end ? processado.end : moment(processado.RequestDate).add(3, 'days').toISOString();
  processado.CurrentDueDate = processado.TaskClosingDate;

  return processado;
}

// Preenche os seletores de filtro com opções baseadas nos dados disponíveis
function preencherFiltros() {
  if (!appState.allData || appState.allData.length === 0) return;

  // Lista fixa de grupos principais
  const gruposPrincipais = ["Criação", "BI", "Operações", "Produção", "Mídia"];

  // Preencher select de grupos principais
  const grupoPrincipalSelect = document.getElementById("grupo-principal-select");
  grupoPrincipalSelect.innerHTML = '<option value="todos">Todos</option>';
  
  gruposPrincipais.forEach(grupo => {
    const option = document.createElement("option");
    option.value = grupo;
    option.textContent = grupo;
    grupoPrincipalSelect.appendChild(option);
  });

  // Preencher select de clientes
  const clientes = [...new Set(appState.allData
    .map(t => t.client)
    .filter(Boolean)
  )].sort();
  

  const clienteSelect = document.getElementById("cliente-select");
  clienteSelect.innerHTML = '<option value="todos">Todos</option>';
  clientes.forEach(cliente => {
    const option = document.createElement("option");
    option.value = cliente;
    option.textContent = cliente;
    clienteSelect.appendChild(option);
  });

  atualizarSubgrupos();
}

function atualizarSubgrupos() {
  const grupoPrincipalSelect = document.getElementById("grupo-principal-select");
  const subgrupoSelect = document.getElementById("subgrupo-select");
  if (!grupoPrincipalSelect || !subgrupoSelect || !appState.allData) return;

  const grupoPrincipal = grupoPrincipalSelect.value;
  subgrupoSelect.innerHTML = '<option value="todos">Todos</option>';
  if (grupoPrincipal === "todos") return;

  // Coletar hierarquia completa
  const subgruposHierarquia = appState.allData
    .filter(item => item.TaskOwnerGroup === grupoPrincipal)
    .map(item => ({
      path: item.TaskOwnerSubgroup ? 
        `${item.TaskOwnerGroup} / ${item.TaskOwnerSubgroup}` : 
        item.TaskOwnerGroup,
      parts: item.TaskOwnerSubgroup ? 
        [`${item.TaskOwnerGroup}`, ...item.TaskOwnerSubgroup.split(" / ")] : 
        [item.TaskOwnerGroup]
    }));

  // Construir estrutura de árvore
  const tree = {};
  subgruposHierarquia.forEach(({ path, parts }) => {
    let currentLevel = tree;
    parts.forEach((part, index) => {
      if (!currentLevel[part]) {
        currentLevel[part] = {
          name: part,
          children: {},
          fullPath: parts.slice(0, index + 1).join(" / ")
        };
      }
      currentLevel = currentLevel[part].children;
    });
  });

  // Função recursiva para criar opções
  const createOptions = (node, depth = 0) => {
    const option = document.createElement("option");
    option.value = node.fullPath;
    option.textContent = `${' '.repeat(depth)}↳ ${node.name}`;
    
    // Desabilitar nós não folha
    if (Object.keys(node.children).length > 0) {
      option.disabled = true;
      option.style.fontWeight = "600";
      option.style.backgroundColor = "#f8f9fa";
    }
    
    subgrupoSelect.appendChild(option);
    
    // Processar filhos
    Object.values(node.children).forEach(child => {
      createOptions(child, depth + 1);
    });
  };

  // Adicionar opções baseadas na árvore
  Object.values(tree).forEach(rootNode => {
    createOptions(rootNode);
  });
}

// Atualiza os filtros e regenera visualizações
function atualizarFiltros() {
  if (!appState.allData || appState.allData.length === 0) return;

  const clienteSelect = document.getElementById("cliente-select");
  const periodoSelect = document.getElementById("periodo-select");
  const grupoPrincipalSelect = document.getElementById("grupo-principal-select");
  const subgrupoSelect = document.getElementById("subgrupo-select");

  const cliente = clienteSelect.value;
  const dias = parseInt(periodoSelect.value);
  const grupoPrincipal = grupoPrincipalSelect.value;
  const subgrupo = subgrupoSelect.value;

  // Filtragem por data
  const limite = moment().subtract(dias, 'days');
  appState.filteredData = appState.allData.filter(item => {
    return moment(item.start).isSameOrAfter(limite);
  });

  // Aplicar filtros adicionais
  if (cliente !== "todos") {
    appState.filteredData = appState.filteredData.filter(
      item => item.client === cliente
    );
  }

  if (grupoPrincipal !== "todos") {
    appState.filteredData = appState.filteredData.filter(
      item => item.TaskOwnerGroup === grupoPrincipal
    );
  }

  if (subgrupo !== "todos") {
    appState.filteredData = appState.filteredData.filter(item => {
      const fullPath = item.TaskOwnerSubgroup 
        ? `${item.TaskOwnerGroup} / ${item.TaskOwnerSubgroup}`
        : item.TaskOwnerGroup;
      
      return fullPath === subgrupo;
    });
  }

  criarTimeline(appState.filteredData);
}

function criarTimeline(dados) {
  const container = document.getElementById("timeline");
  if (!container) return;
  container.innerHTML = "";

  if (!dados || dados.length === 0) {
    container.innerHTML = '<div class="alert alert-info m-3">Nenhuma tarefa encontrada</div>';
    return;
  }

  try {
    // Construir grupos hierárquicos
    const grupos = dados.reduce((acc, item) => {
      const grupoPath = item.TaskOwnerSubgroup ?
        `${item.TaskOwnerGroup} / ${item.TaskOwnerSubgroup}` :
        item.TaskOwnerGroup;
      
      if (!acc.includes(grupoPath)) {
        acc.push(grupoPath);
      }
      return acc;
    }, []).sort((a, b) => {
      // Ordenar por grupos principais definidos
      const gruposOrdenacao = ["Criação", "BI", "Operações", "Produção", "Mídia"];
      const grupoA = a.split(" / ")[0];
      const grupoB = b.split(" / ")[0];
      return gruposOrdenacao.indexOf(grupoA) - gruposOrdenacao.indexOf(grupoB);
    });

    // Criar items da timeline
    const items = new vis.DataSet(dados.map((item, i) => {
      const startDate = moment(item.start).isValid() ? 
        moment(item.start) : 
        moment().add(1, 'days');
      
      const endDate = moment(item.end).isValid() ?
        moment(item.end) :
        startDate.clone().add(3, 'days');

      return {
        id: i,
        content: `<div class="timeline-item-content" title="${item.name}">
                    <span class="priority-dot ${item.Priority}"></span>
                    ${item.name.substring(0, 20)}${item.name.length > 20 ? '...' : ''}
                  </div>`,
        start: startDate.toDate(),
        end: endDate.toDate(),
        group: item.TaskOwnerSubgroup ? 
          `${item.TaskOwnerGroup} / ${item.TaskOwnerSubgroup}` : 
          item.TaskOwnerGroup,
        title: `
          <div class="timeline-tooltip">
            <h5>${item.name}</h5>
            <p><strong>Cliente:</strong> ${item.client || 'N/A'}</p>
            <p><strong>Responsável:</strong> ${item.responsible || 'N/A'}</p>
            <p><strong>Período:</strong> ${startDate.format('DD/MM/YYYY')} - ${endDate.format('DD/MM/YYYY')}</p>
            <p><strong>Status:</strong> ${item.PipelineStepTitle}</p>
            <p><strong>Grupo:</strong> ${item.TaskOwnerGroup} ${item.TaskOwnerSubgroup ? '/ ' + item.TaskOwnerSubgroup : ''}</p>
          </div>
        `,
        className: `timeline-item ${CONFIG.priorityClasses[item.Priority]}`
      };
    }));

    // Configurar grupos
    const visGroups = new vis.DataSet(grupos.map(grupo => ({
      id: grupo,
      content: `
        <div class="group-header">
          <span class="group-icon">${grupo.split(' / ')[0].charAt(0)}</span>
          ${grupo}
        </div>
      `,
      className: `group-${grupo.toLowerCase().replace(/ /g, '-').replace(/[^a-z-]/g, '')}`
    })));

    // Configurações da timeline
    const options = {
      orientation: 'top',
      stack: true,
      margin: { item: 10 },
      zoomMin: 1000 * 60 * 60 * 24 * 7, // 1 semana
      zoomMax: 1000 * 60 * 60 * 24 * 180, // 6 meses
      start: moment().subtract(1, 'weeks'),
      end: moment().add(2, 'weeks'),
      groupOrder: (a, b) => a.content.localeCompare(b.content),
      horizontalScroll: true,
      verticalScroll: true,
      height: '800px'
    };

    appState.timeline = new vis.Timeline(container, items, visGroups, options);
    appState.timeline.fit();

  } catch (error) {
    console.error("Erro ao criar timeline:", error);
    container.innerHTML = `<div class="alert alert-danger">Erro: ${error.message}</div>`;
  }
}
// Funções para controle da timeline
function moverTimeline(dias) {
  if (!appState.timeline) return;

  const range = appState.timeline.getWindow();

  appState.timeline.setWindow({
    start: moment(range.start).add(dias, "days").valueOf(),
    end: moment(range.end).add(dias, "days").valueOf(),
  });
}

function irParaHoje() {
  if (!appState.timeline) return;

  const range = appState.timeline.getWindow();
  const intervalo = range.end - range.start;
  const hoje = moment().valueOf();

  appState.timeline.setWindow({
    start: hoje - intervalo / 2,
    end: hoje + intervalo / 2,
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
    end: new Date(centro.getTime() + novoIntervalo / 2),
  });
}

// Exporta dados filtrados para CSV
function exportarCSV() {
  if (!appState.filteredData || appState.filteredData.length === 0) {
    mostrarNotificacao("Exportação", "Não há dados para exportar.", "warning");
    return;
  }

  const headers = [
    "Cliente", "Projeto", "Tarefa", 
    "Data Início", "Data Fim", "Responsável",
    "Grupo", "Subgrupo", "Prioridade"
  ];

  const linhas = appState.filteredData.map(item => [
    item.client || "Não definido",
    item.project || "Não definido",
    item.name || "Sem título",
    item.start ? moment(item.start).format("DD/MM/YYYY") : "-",
    item.end ? moment(item.end).format("DD/MM/YYYY") : "-",
    item.responsible || "Não definido",
    item.TaskOwnerGroup || "Não definido",
    item.TaskOwnerSubgroup || "Não definido",
    item.Priority === "high" ? "Alta" : 
    item.Priority === "medium" ? "Média" : "Baixa"
  ]);

  const csvContent = [
    headers.join(","),
    ...linhas.map(linha => linha.map(campo => `"${campo}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `tarefas_${moment().format("YYYY-MM-DD")}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  mostrarNotificacao(
    "Exportação concluída",
    `${appState.filteredData.length} tarefas exportadas com sucesso.`,
    "success"
  );
}

// Configura o evento de tela cheia para a timeline
function configurarEventoTelaCheia() {
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const timelineCard = document.querySelector(".cronograma-card");

  if (!btnFullscreen || !timelineCard) return;

  btnFullscreen.addEventListener("click", () => {
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
          document.getElementById("timeline").style.height = `${altura}px`;
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
        document.getElementById("timeline").style.height = "800px";
        appState.timeline.redraw();
      }, 100);
    }
  });

  // Detecta saída do modo tela cheia
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      document.getElementById("timeline").style.height = "800px";
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
function mostrarNotificacao(titulo, mensagem, tipo = "info") {
  // Cria container de toasts se não existir
  let toastContainer = document.querySelector(".toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className =
      "toast-container position-fixed bottom-0 end-0 p-3";
    toastContainer.style.zIndex = "1050";
    document.body.appendChild(toastContainer);
  }

  // Cria o elemento toast
  const toastId = "toast-" + Date.now();
  const toastHTML = `
      <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header ${
          tipo === "error"
            ? "bg-danger text-white"
            : tipo === "success"
            ? "bg-success text-white"
            : tipo === "warning"
            ? "bg-warning"
            : "bg-info text-white"
        }">
          <strong class="me-auto">${titulo}</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${mensagem}
        </div>
      </div>
    `;

  // Adiciona à página
  toastContainer.insertAdjacentHTML("beforeend", toastHTML);

  // Inicializa o toast
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
  toast.show();

  // Remove após fechar
  toastElement.addEventListener("hidden.bs.toast", () => {
    toastElement.remove();
  });
}
