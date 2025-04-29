
const CONFIG = {
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
  priorityClasses: {
    high: "task-priority-high",
    medium: "task-priority-medium",
    low: "task-priority-low",
  },
};

let appState = {
  allData: [],
  filteredData: [],
  timeline: null,
  isLoading: false,
  settings: {
    dataSource: localStorage.getItem("dataSource") || "json",
    jsonUrl: localStorage.getItem("jsonUrl") || "dados.json",
    projectId: localStorage.getItem("projectId") || "monday-export",
    dataset: localStorage.getItem("dataset") || "taskrow_views",
    table: localStorage.getItem("table") || "CJT_RD_RTC",
  },
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("ano-atual").textContent = new Date().getFullYear();
  setupEventListeners();
  carregarDados();
});

function setupEventListeners() {
  document.getElementById("btn-anterior")?.addEventListener("click", () => moverTimeline(-7));
  document.getElementById("btn-hoje")?.addEventListener("click", () => irParaHoje());
  document.getElementById("btn-proximo")?.addEventListener("click", () => moverTimeline(7));
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => ajustarZoom(0.7));
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => ajustarZoom(1.3));
  document.getElementById("exportar-dados")?.addEventListener("click", exportarCSV);

  document.getElementById("cliente-select")?.addEventListener("change", atualizarFiltros);
  document.getElementById("periodo-select")?.addEventListener("change", atualizarFiltros);
  document.getElementById("grupo-principal-select")?.addEventListener("change", () => {
    atualizarSubgrupos();
    atualizarFiltros();
  });
  document.getElementById("subgrupo-select")?.addEventListener("change", atualizarFiltros);

  configurarEventoTelaCheia();
}

async function carregarDados() {
  try {
    mostrarLoading(true);
    if (appState.settings.dataSource === "json") {
      await carregarDadosDeJSON();
    } else {
      await carregarDadosDeBigQuery();
    }

    preencherFiltros();
    atualizarFiltros();
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    mostrarNotificacao("Erro ao carregar dados", error.message, "error");
  } finally {
    mostrarLoading(false);
  }
}

async function carregarDadosDeJSON() {
  try {
    const response = await fetch(appState.settings.jsonUrl);
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const dadosOriginais = await response.json();
    appState.allData = dadosOriginais.map(preprocessarDados);
  } catch (error) {
    throw new Error(`Falha ao carregar dados do JSON: ${error.message}`);
  }
}

async function carregarDadosDeBigQuery() {
  try {
    mostrarNotificacao("Conectando ao BigQuery", "Estabelecendo conexão...", "info");
    await new Promise(resolve => setTimeout(resolve, 1500));

    const response = await fetch(appState.settings.jsonUrl);
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const dadosOriginais = await response.json();
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

  // Mapear prioridade com base no status
  const statusPriority = {
    "Não iniciada": "low",
    Backlog: "medium",
    "Em Produção": "high",
  };
  processado.Priority = statusPriority[processado.PipelineStepTitle] || "medium";

  // Separar grupo, subgrupo e membro com base no campo group_subgroup
  let grupo = undefined;
  let subgrupo = undefined;
  let membro = undefined;

  if (item.group_subgroup) {
    const partes = item.group_subgroup.split("/").map(p => p.trim()).filter(Boolean);

    if (partes.length > 0) {
      grupo = partes[0];
      if (partes.length === 2) {
        membro = partes[1];
      } else if (partes.length === 3) {
        subgrupo = partes[1];
        membro = partes[2];
      } else if (partes.length > 3) {
        subgrupo = partes[1];
        membro = partes.slice(2).join(" / ");
      }
    }

    // Corrigir o nome do grupo Produção
    if (grupo === "Ana Luisa Andre") {
      grupo = "Produção";
      subgrupo = null;
      membro = "Ana Luisa Andre";
    }
  }

  processado.TaskOwnerGroup = grupo;
  processado.TaskOwnerSubgroup = subgrupo;
  processado.TaskOwnerMember = membro;

  // Normalizar datas
  processado.RequestDate = processado.start || new Date().toISOString();
  processado.TaskClosingDate = processado.end || moment(processado.RequestDate).add(3, 'days').toISOString();
  processado.CurrentDueDate = processado.TaskClosingDate;

  return processado;
}
// Preenche os selects de Grupo Principal e Cliente
function preencherFiltros() {
  if (!appState.allData || appState.allData.length === 0) return;

  const grupoPrincipalSelect = document.getElementById("grupo-principal-select");
  const clienteSelect = document.getElementById("cliente-select");

  grupoPrincipalSelect.innerHTML = '<option value="todos">Todos</option>';
  clienteSelect.innerHTML = '<option value="todos">Todos</option>';

  // Preencher grupos principais com base nos existentes nos dados
  const gruposUnicos = [...new Set(appState.allData.map(t => t.TaskOwnerGroup).filter(Boolean))].sort();
  gruposUnicos.forEach(grupo => {
    grupoPrincipalSelect.add(new Option(grupo, grupo));
  });

  // Preencher clientes únicos
  const clientes = [...new Set(appState.allData.map(t => t.client).filter(Boolean))].sort();
  clientes.forEach(cliente => {
    clienteSelect.add(new Option(cliente, cliente));
  });

  atualizarSubgrupos();
}

// Preenche o select de Subgrupo com base no Grupo selecionado
function atualizarSubgrupos() {
  const grupoSelecionado = document.getElementById("grupo-principal-select").value;
  const subgrupoSelect = document.getElementById("subgrupo-select");

  subgrupoSelect.innerHTML = '<option value="todos">Todos</option>';

  const filtrado = grupoSelecionado === "todos"
    ? appState.allData
    : appState.allData.filter(t => t.TaskOwnerGroup === grupoSelecionado);

  const subgruposUnicos = [...new Set(filtrado.map(t => t.TaskOwnerSubgroup).filter(Boolean))].sort();

  subgruposUnicos.forEach(sub => {
    subgrupoSelect.add(new Option(sub, sub));
  });
}

// Início de atualizarFiltros() — (continua na Parte 3)
function atualizarFiltros() {
  if (!appState.allData || appState.allData.length === 0) return;

  const cliente = document.getElementById("cliente-select").value;
  const dias = parseInt(document.getElementById("periodo-select").value);
  const grupo = document.getElementById("grupo-principal-select").value;
  const subgrupo = document.getElementById("subgrupo-select").value;

  const limite = moment().subtract(dias, "days");

  // Filtro base: por período
  appState.filteredData = appState.allData.filter(item => {
    return moment(item.start).isSameOrAfter(limite);
  });

  // Filtro por cliente
  if (cliente !== "todos") {
    appState.filteredData = appState.filteredData.filter(item => item.client === cliente);
  }

  // Filtro por grupo
  if (grupo !== "todos") {
    appState.filteredData = appState.filteredData.filter(item => item.TaskOwnerGroup === grupo);
  }

  // Filtro por subgrupo
  if (subgrupo !== "todos") {
    appState.filteredData = appState.filteredData.filter(item =>
      item.TaskOwnerSubgroup === subgrupo
    );
  }
  // Agrupar por membro e criar a timeline
  criarTimeline(appState.filteredData);
}

function criarTimeline(dados) {
  const container = document.getElementById("timeline");
  if (!container || !dados) return;

  container.innerHTML = "";

  if (dados.length === 0) {
    container.innerHTML = '<div class="alert alert-info m-3">Nenhuma tarefa encontrada</div>';
    return;
  }

  try {
    const gruposMembros = [...new Set(dados.map(t => t.TaskOwnerMember).filter(Boolean))].sort();

    const items = new vis.DataSet(dados.map((item, idx) => {
      const startDate = moment(item.start);
      const endDate = item.end ? moment(item.end) : startDate.clone().add(3, "days");

      return {
        id: idx,
        content: `<div class="timeline-item-content" title="${item.name}">
                    <span class="priority-dot ${CONFIG.priorityClasses[item.Priority]}"></span>
                    ${item.name.substring(0, 25)}${item.name.length > 25 ? "..." : ""}
                  </div>`,
        start: startDate.toDate(),
        end: endDate.toDate(),
        group: item.TaskOwnerMember,
        title: `
          <div class="timeline-tooltip">
            <h5>${item.name}</h5>
            <p><strong>Cliente:</strong> ${item.client || "N/A"}</p>
            <p><strong>Responsável:</strong> ${item.responsible || "N/A"}</p>
            <p><strong>Período:</strong> ${startDate.format("DD/MM/YYYY")} - ${endDate.format("DD/MM/YYYY")}</p>
            <p><strong>Status:</strong> ${item.PipelineStepTitle || "N/A"}</p>
            <p><strong>Grupo:</strong> ${item.TaskOwnerGroup || ""}${item.TaskOwnerSubgroup ? " / " + item.TaskOwnerSubgroup : ""}</p>
          </div>`
      };
    }));

    const visGroups = new vis.DataSet(gruposMembros.map(membro => ({
      id: membro,
      content: membro,
    })));

    const options = {
      orientation: "top",
      stack: true,
      margin: { item: 10 },
      zoomMin: 1000 * 60 * 60 * 24 * 7,
      zoomMax: 1000 * 60 * 60 * 24 * 180,
      start: moment().subtract(1, "weeks"),
      end: moment().add(2, "weeks"),
      groupOrder: (a, b) => a.content.localeCompare(b.content),
      horizontalScroll: true,
      verticalScroll: true,
      height: "800px"
    };

    appState.timeline = new vis.Timeline(container, items, visGroups, options);
    appState.timeline.fit();
  } catch (error) {
    console.error("Erro ao criar timeline:", error);
    container.innerHTML = `<div class="alert alert-danger">Erro: ${error.message}</div>`;
  }
}
// Navegar para frente/atrás na timeline
function moverTimeline(dias) {
  if (!appState.timeline) return;

  const range = appState.timeline.getWindow();
  appState.timeline.setWindow({
    start: moment(range.start).add(dias, "days").valueOf(),
    end: moment(range.end).add(dias, "days").valueOf(),
  });
}

// Ir para a data atual
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

// Ajustar zoom da timeline
function ajustarZoom(fator) {
  if (!appState.timeline) return;

  const range = appState.timeline.getWindow();
  const centro = new Date((range.end.getTime() + range.start.getTime()) / 2);
  const novoIntervalo = (range.end - range.start) / fator;

  appState.timeline.setWindow({
    start: new Date(centro.getTime() - novoIntervalo / 2),
    end: new Date(centro.getTime() + novoIntervalo / 2),
  });
}

// Exportar os dados para CSV
function exportarCSV() {
  if (!appState.filteredData || appState.filteredData.length === 0) {
    mostrarNotificacao("Exportação", "Não há dados para exportar.", "warning");
    return;
  }

  const headers = [
    "Cliente", "Projeto", "Tarefa",
    "Data Início", "Data Fim", "Responsável",
    "Grupo", "Subgrupo", "Membro", "Prioridade"
  ];

  const linhas = appState.filteredData.map(item => [
    item.client || "N/A",
    item.project || "N/A",
    item.name || "Sem título",
    item.start ? moment(item.start).format("DD/MM/YYYY") : "-",
    item.end ? moment(item.end).format("DD/MM/YYYY") : "-",
    item.responsible || "N/A",
    item.TaskOwnerGroup || "N/A",
    item.TaskOwnerSubgroup || "N/A",
    item.TaskOwnerMember || "N/A",
    item.Priority === "high" ? "Alta" : item.Priority === "medium" ? "Média" : "Baixa"
  ]);

  const csvContent = [
    headers.join(","),
    ...linhas.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `tarefas_${moment().format("YYYY-MM-DD")}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  mostrarNotificacao("Exportação", "Arquivo CSV gerado com sucesso!", "success");
}

// Tela cheia
function configurarEventoTelaCheia() {
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const timelineCard = document.querySelector(".cronograma-card");

  if (!btnFullscreen || !timelineCard) return;

  btnFullscreen.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      (timelineCard.requestFullscreen || timelineCard.webkitRequestFullscreen || timelineCard.msRequestFullscreen).call(timelineCard);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
    }

    setTimeout(() => {
      document.getElementById("timeline").style.height = document.fullscreenElement ? `${window.innerHeight - 150}px` : "800px";
      appState.timeline.redraw();
    }, 100);
  });

  document.addEventListener("fullscreenchange", () => {
    document.getElementById("timeline").style.height = document.fullscreenElement ? `${window.innerHeight - 150}px` : "800px";
    appState.timeline.redraw();
  });
}

// Toast de notificação
function mostrarNotificacao(titulo, mensagem, tipo = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container position-fixed bottom-0 end-0 p-3";
    container.style.zIndex = "1050";
    document.body.appendChild(container);
  }

  const toastId = `toast-${Date.now()}`;
  const html = `
    <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header ${tipo === "error" ? "bg-danger text-white" :
        tipo === "success" ? "bg-success text-white" :
        tipo === "warning" ? "bg-warning" :
        "bg-info text-white"}">
        <strong class="me-auto">${titulo}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body">${mensagem}</div>
    </div>
  `;

  container.insertAdjacentHTML("beforeend", html);
  const toastElement = document.getElementById(toastId);
  new bootstrap.Toast(toastElement, { delay: 5000 }).show();

  toastElement.addEventListener("hidden.bs.toast", () => {
    toastElement.remove();
  });
}

function mostrarLoading(mostrar) {
  appState.isLoading = mostrar;

  const container = document.getElementById("timeline");
  if (!container) return;

  if (mostrar) {
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p class="mt-3">Carregando dados...</p>
      </div>
    `;
  }
}




