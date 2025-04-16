/**
 * Dashboard de Tarefas - SOMOS CREATORS
 * clients.js - Versão completa para visualização por cliente
 */

const CONFIG = {
  priorityClasses: {
    high: "task-priority-high",
    medium: "task-priority-medium",
    low: "task-priority-low"
  }
};

let appState = {
  allData: [],
  filteredData: [],
  timeline: null,
  isLoading: false,
  settings: {
    dataSource: localStorage.getItem("dataSource") || "json",
    jsonUrl: localStorage.getItem("jsonUrl") || "dados.json"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("ano-atual").textContent = new Date().getFullYear();
  setupEventListeners();
  carregarDados();
});

function setupEventListeners() {
  document.getElementById("btn-anterior").addEventListener("click", () => moverTimeline(-7));
  document.getElementById("btn-hoje").addEventListener("click", () => irParaHoje());
  document.getElementById("btn-proximo").addEventListener("click", () => moverTimeline(7));
  document.getElementById("btn-zoom-out").addEventListener("click", () => ajustarZoom(0.7));
  document.getElementById("btn-zoom-in").addEventListener("click", () => ajustarZoom(1.3));
  document.getElementById("exportar-dados").addEventListener("click", exportarCSV);
  document.getElementById("cliente-select").addEventListener("change", atualizarFiltros);
  document.getElementById("periodo-select").addEventListener("change", atualizarFiltros);
  document.getElementById("grupo-principal-select").addEventListener("change", atualizarFiltros);
  configurarEventoTelaCheia();
}

async function carregarDados() {
  try {
    mostrarLoading(true);
    await carregarDadosDeJSON();
    preencherFiltros();
    atualizarFiltros();
  } catch (e) {
    console.error(e);
    mostrarNotificacao("Erro", e.message, "error");
  } finally {
    mostrarLoading(false);
  }
}

async function carregarDadosDeJSON() {
  const response = await fetch(appState.settings.jsonUrl);
  if (!response.ok) throw new Error(`Erro ao carregar JSON: ${response.status}`);
  const dados = await response.json();
  appState.allData = dados.map(preprocessarDados);
  mostrarNotificacao("Dados carregados", `${appState.allData.length} tarefas carregadas.`, "success");
}

function preprocessarDados(item) {
  const clone = { ...item };
  if (!clone.Priority) {
    const p = ["high", "medium", "low"];
    clone.Priority = p[Math.floor(Math.random() * 3)];
  }
  return clone;
}

function preencherFiltros() {
  const clientes = [...new Set(appState.allData.map(t => t.ClientNickname).filter(Boolean))].sort();
  const grupos = [...new Set(appState.allData.map(t => t.TaskExecutionFunctionGroupName).filter(Boolean))].sort();

  const clienteSelect = document.getElementById("cliente-select");
  clienteSelect.innerHTML = '<option value="todos">Todos</option>';
  clientes.forEach(c => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    clienteSelect.appendChild(o);
  });

  const grupoSelect = document.getElementById("grupo-principal-select");
  const existentes = Array.from(grupoSelect.options).map(o => o.value);
  grupos.forEach(g => {
    if (!existentes.includes(g)) {
      const o = document.createElement("option");
      o.value = g;
      o.textContent = g;
      grupoSelect.appendChild(o);
    }
  });
}

function atualizarFiltros() {
  const cliente = document.getElementById("cliente-select").value;
  const grupo = document.getElementById("grupo-principal-select").value;
  const dias = parseInt(document.getElementById("periodo-select").value);
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);

  let filtrado = appState.allData.filter(item => item.RequestDate && new Date(item.RequestDate) >= limite);
  if (cliente !== "todos") filtrado = filtrado.filter(i => i.ClientNickname === cliente);
  if (grupo !== "todos") filtrado = filtrado.filter(i => i.TaskExecutionFunctionGroupName === grupo || i.TaskOwnerGroup === grupo);
  appState.filteredData = filtrado;
  criarTimeline(filtrado);
}

function criarTimeline(dados) {
  const container = document.getElementById("timeline");
  container.innerHTML = "";
  if (!dados || dados.length === 0) {
    container.innerHTML = '<div class="alert alert-info m-3">Nenhuma tarefa encontrada.</div>';
    return;
  }

  const grupos = [...new Set(dados.map(t => t.TaskExecutionFunctionGroupName || t.TaskOwnerGroup || "Sem grupo"))].sort();
  const items = new vis.DataSet(dados.map((item, i) => {
    const fim = item.TaskClosingDate || item.CurrentDueDate || moment().add(7, 'days').format('YYYY-MM-DD');
    const titulo = item.TaskTitle || "Sem título";
    return {
      id: i,
      content: `<span title="${titulo}">${titulo.length > 30 ? titulo.slice(0, 27) + '...' : titulo}</span>`,
      start: item.RequestDate,
      end: fim,
      group: item.TaskExecutionFunctionGroupName || item.TaskOwnerGroup || "Outro",
      className: CONFIG.priorityClasses[item.Priority] || ""
    };
  }));
  const visGroups = new vis.DataSet(grupos.map(g => ({ id: g, content: g })));

  appState.timeline = new vis.Timeline(container, items, visGroups, {
    orientation: "top",
    stack: true,
    horizontalScroll: true,
    zoomKey: "ctrlKey",
    height: "700px",
    zoomMin: 1000 * 60 * 60 * 24 * 7,
    zoomMax: 1000 * 60 * 60 * 24 * 90
  });
  setTimeout(() => appState.timeline.fit(), 500);
}

function moverTimeline(dias) {
  if (!appState.timeline) return;
  const range = appState.timeline.getWindow();
  appState.timeline.setWindow({
    start: moment(range.start).add(dias, 'days'),
    end: moment(range.end).add(dias, 'days')
  });
}

function irParaHoje() {
  if (!appState.timeline) return;
  const range = appState.timeline.getWindow();
  const meio = (range.end - range.start) / 2;
  const hoje = moment().valueOf();
  appState.timeline.setWindow({ start: hoje - meio, end: hoje + meio });
}

function ajustarZoom(fator) {
  if (!appState.timeline) return;
  const range = appState.timeline.getWindow();
  const inicio = new Date(range.start);
  const fim = new Date(range.end);
  const intervalo = fim - inicio;
  const centro = new Date((fim.getTime() + inicio.getTime()) / 2);
  const novo = intervalo / fator;
  appState.timeline.setWindow({
    start: new Date(centro.getTime() - novo / 2),
    end: new Date(centro.getTime() + novo / 2)
  });
}

function exportarCSV() {
  if (!appState.filteredData.length) return mostrarNotificacao("Exportação", "Sem dados para exportar", "warning");
  const linhas = appState.filteredData.map(i => [
    i.ClientNickname,
    i.TaskTitle,
    i.RequestDate,
    i.CurrentDueDate || i.TaskClosingDate || "",
    i.TaskExecutionFunctionGroupName || i.TaskOwnerGroup,
    i.Priority
  ]);
  const conteudo = [
    ["Cliente", "Tarefa", "Início", "Fim", "Grupo", "Prioridade"],
    ...linhas
  ].map(l => l.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tarefas_exportadas.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  mostrarNotificacao("Exportado", "Arquivo CSV gerado com sucesso.", "success");
}

function configurarEventoTelaCheia() {
  const btn = document.getElementById("btn-fullscreen");
  const card = document.querySelector(".cronograma-card");
  if (!btn || !card) return;
  btn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      card.requestFullscreen();
      setTimeout(() => {
        document.getElementById("timeline").style.height = window.innerHeight - 150 + "px";
        appState.timeline.redraw();
      }, 300);
    } else {
      document.exitFullscreen();
      setTimeout(() => {
        document.getElementById("timeline").style.height = "700px";
        appState.timeline.redraw();
      }, 300);
    }
  });
}

function mostrarLoading(mostrar) {
  appState.isLoading = mostrar;
  const container = document.getElementById("timeline");
  if (mostrar) {
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p class="mt-3">Carregando dados...</p>
      </div>
    `;
  }
}

function mostrarNotificacao(titulo, mensagem, tipo = 'info') {
  console.log(`[${tipo}] ${titulo}: ${mensagem}`);
}