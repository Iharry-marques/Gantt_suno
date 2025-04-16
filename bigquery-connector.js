/**
 * BigQuery Connector
 * Módulo para conexão e consulta ao BigQuery
 * 
 * Instruções:
 * 1. Configure as credenciais OAuth 2.0 no Console Google Cloud
 * 2. Adicione o script da API BigQuery ao HTML
 * 3. Inclua este arquivo em sua aplicação
 */

// Configuração do cliente BigQuery
const BigQueryConnector = {
    // Configurações
    config: {
      apiKey: null,
      clientId: null,
      scopes: 'https://www.googleapis.com/auth/bigquery.readonly',
      discoveryDocs: ['https://bigquery.googleapis.com/$discovery/rest?version=v2'],
      isInitialized: false,
      isSignedIn: false
    },
    
    // Inicializa a biblioteca da API
    init: function(apiKey, clientId) {
      return new Promise((resolve, reject) => {
        this.config.apiKey = apiKey;
        this.config.clientId = clientId;
        
        // Verifica se a biblioteca gapi está carregada
        if (!window.gapi) {
          reject(new Error('Biblioteca Google API (gapi) não encontrada. Adicione-a ao HTML.'));
          return;
        }
        
        // Carrega a biblioteca de cliente
        gapi.load('client:auth2', () => {
          gapi.client.init({
            apiKey: this.config.apiKey,
            clientId: this.config.clientId,
            scope: this.config.scopes,
            discoveryDocs: this.config.discoveryDocs
          }).then(() => {
            this.config.isInitialized = true;
            
            // Ouve mudanças no estado de autenticação
            gapi.auth2.getAuthInstance().isSignedIn.listen(isSignedIn => {
              this.config.isSignedIn = isSignedIn;
            });
            
            // Define o estado inicial de login
            this.config.isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
            
            resolve();
          }).catch(error => {
            reject(error);
          });
        });
      });
    },
    
    // Realiza login
    signIn: function() {
      return new Promise((resolve, reject) => {
        if (!this.config.isInitialized) {
          reject(new Error('Conector não inicializado. Chame init() primeiro.'));
          return;
        }
        
        gapi.auth2.getAuthInstance().signIn().then(() => {
          this.config.isSignedIn = true;
          resolve();
        }).catch(error => {
          reject(error);
        });
      });
    },
    
    // Realiza logout
    signOut: function() {
      return new Promise((resolve, reject) => {
        if (!this.config.isInitialized) {
          reject(new Error('Conector não inicializado. Chame init() primeiro.'));
          return;
        }
        
        gapi.auth2.getAuthInstance().signOut().then(() => {
          this.config.isSignedIn = false;
          resolve();
        }).catch(error => {
          reject(error);
        });
      });
    },
    
    // Verifica se está autenticado
    isAuthenticated: function() {
      return this.config.isInitialized && this.config.isSignedIn;
    },
    
    // Executa uma consulta SQL no BigQuery
    executeQuery: function(projectId, query) {
      return new Promise((resolve, reject) => {
        if (!this.isAuthenticated()) {
          reject(new Error('Não autenticado. Faça login primeiro.'));
          return;
        }
        
        // Prepara a requisição
        const request = {
          query: query,
          useLegacySql: false
        };
        
        // Executa a consulta
        gapi.client.bigquery.jobs.query({
          projectId: projectId,
          resource: request
        }).then(response => {
          // Processa os resultados
          const result = {
            schema: response.result.schema,
            rows: []
          };
          
          // Converte os resultados em um formato mais amigável
          if (response.result.rows && response.result.rows.length > 0) {
            result.rows = response.result.rows.map(row => {
              const processedRow = {};
              
              // Mapeia os valores para suas colunas
              response.result.schema.fields.forEach((field, index) => {
                processedRow[field.name] = row.f[index].v;
              });
              
              return processedRow;
            });
          }
          
          resolve(result);
        }).catch(error => {
          reject(error);
        });
      });
    },
    
    // Consulta uma tabela específica do BigQuery
    queryTable: function(projectId, datasetId, tableId, fields = '*', filter = null, limit = 1000) {
      // Constrói a consulta
      let query = `SELECT ${fields} FROM \`${projectId}.${datasetId}.${tableId}\``;
      
      // Adiciona filtro se fornecido
      if (filter) {
        query += ` WHERE ${filter}`;
      }
      
      // Adiciona limite
      query += ` LIMIT ${limit}`;
      
      // Executa a consulta
      return this.executeQuery(projectId, query);
    },
    
    // Consulta a tabela CJT_RD_RTC com filtros comuns
    queryCJT_RD_RTC: function(projectId, filter = null, limit = 1000) {
      const fields = `
        ClientNickname,
        TaskNumber,
        TaskTitle,
        RequestDate,
        UnitName,
        EndDate,
        CurrentDueDate,
        RequestTypeName,
        TaskExecutionFunctionGroupName,
        TaskOwnerDisplayName,
        TaskOwnerGroupName,
        TaskClosingDate
      `;
      
      return this.queryTable(
        projectId, 
        'taskrow_views', 
        'CJT_RD_RTC', 
        fields, 
        filter, 
        limit
      );
    }
  };
  
  // Função de inicialização exemplo
  async function inicializarBigQuery() {
    try {
      // Estas credenciais devem ser obtidas no Console do Google Cloud
      const API_KEY = 'SUA_API_KEY';
      const CLIENT_ID = 'SEU_CLIENT_ID.apps.googleusercontent.com';
      
      // Inicializa o conector
      await BigQueryConnector.init(API_KEY, CLIENT_ID);
      
      // Solicita autenticação do usuário
      if (!BigQueryConnector.isAuthenticated()) {
        await BigQueryConnector.signIn();
      }
      
      console.log('Conectado ao BigQuery com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro ao conectar ao BigQuery:', error);
      return false;
    }
  }
  
  // Exemplo de consulta à tabela CJT_RD_RTC
  async function consultarTarefas(projectId = 'monday-export') {
    try {
      // Garante que estamos conectados
      if (!BigQueryConnector.isAuthenticated()) {
        await inicializarBigQuery();
      }
      
      // Filtro de exemplo: tarefas dos últimos 90 dias
      const noventa_dias_atras = new Date();
      noventa_dias_atras.setDate(noventa_dias_atras.getDate() - 90);
      const data_formatada = noventa_dias_atras.toISOString().split('T')[0];
      
      const filtro = `RequestDate >= "${data_formatada}"`;
      
      // Executa a consulta
      const resultado = await BigQueryConnector.queryCJT_RD_RTC(projectId, filtro, 1000);
      
      console.log(`${resultado.rows.length} tarefas encontradas.`);
      return resultado.rows;
    } catch (error) {
      console.error('Erro ao consultar tarefas:', error);
      return [];
    }
  }
  
  // Exporta o módulo se estiver em um ambiente que suporta ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BigQueryConnector, inicializarBigQuery, consultarTarefas };
  }