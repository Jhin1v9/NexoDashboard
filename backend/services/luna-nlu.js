/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LUNA NLU ENGINE — NEXO Dashboard Pro
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Motor de Natural Language Understanding baseado em NLP.js (AXA Group).
 * Treinado para entender comandos em Português, Espanhol e Catalão
 * nos domínios do ERP NEXO Digital: email, tarefas, projetos, clientes,
 * financeiro, whatsapp, orçamentos, leads, ideias.
 *
 * Funciona 100% offline — não depende de API externa.
 * Quando API Gemini disponível: complementa com geração de texto.
 * Quando API indisponível: Smart Form Assistant assume com contexto.
 *
 * Arquitetura: Multi-domain NLU com confidence scoring e fallback.
 */

const { NlpManager } = require('node-nlp');
const fs = require('fs');
const path = require('path');

const MODEL_PATH = path.join(__dirname, '..', 'data', 'luna-model.nlp');
const CORPUS_PATH = path.join(__dirname, '..', 'data', 'luna-corpus.json');

// Configuração do manager
const manager = new NlpManager({
  languages: ['pt', 'es', 'ca'],
  forceNER: true,
  nlu: {
    useNoneFeature: true,      // Previne false positives
    log: false,
  },
});

// Domínios e intents do NEXO Digital
const DOMAINS = {
  email: {
    description: 'Comandos relacionados a emails e comunicação por email',
    intents: [
      'email.responder',
      'email.resumir',
      'email.analisar',
      'email.criar_rascunho',
      'email.enviar',
      'email.arquivar',
      'email.mover_lixeira',
      'email.marcar_importante',
      'email.listar_nao_lidos',
      'email.marcar_lido',
      'email.sincronizar',
    ],
  },
  tarefas: {
    description: 'Comandos relacionados a tarefas e gestão de atividades',
    intents: [
      'tarefa.criar',
      'tarefa.listar',
      'tarefa.atualizar',
      'tarefa.deletar',
      'tarefa.concluir',
      'tarefa.atribuir',
      'tarefa.adicionar_comentario',
    ],
  },
  projetos: {
    description: 'Comandos relacionados a projetos e gestão de projetos',
    intents: [
      'projeto.criar',
      'projeto.listar',
      'projeto.atualizar',
      'projeto.deletar',
      'projeto.adicionar_cliente',
      'projeto.ver_status',
    ],
  },
  clientes: {
    description: 'Comandos relacionados a gestão de clientes e contatos',
    intents: [
      'cliente.criar',
      'cliente.listar',
      'cliente.buscar',
      'cliente.atualizar',
      'cliente.deletar',
    ],
  },
  financeiro: {
    description: 'Comandos relacionados a finanças, pagamentos e despesas',
    intents: [
      'financeiro.consultar_caixa',
      'financeiro.adicionar_receita',
      'financeiro.adicionar_despesa',
      'financeiro.listar_pagamentos',
      'financeiro.listar_despesas',
      'financeiro.projetar_caixa',
      'financeiro.ver_balanco',
    ],
  },
  whatsapp: {
    description: 'Comandos relacionados ao WhatsApp Business',
    intents: [
      'whatsapp.enviar_mensagem',
      'whatsapp.responder_cliente',
      'whatsapp.ver_historico',
      'whatsapp.sincronizar',
      'whatsapp.marcar_nao_lido',
      'whatsapp.verificar_mencoes',
    ],
  },
  links: {
    description: 'Comandos relacionados a links e recursos',
    intents: [
      'link.listar',
      'link.adicionar',
      'link.excluir',
    ],
  },
  orcamentos: {
    description: 'Comandos relacionados a orçamentos e propostas comerciais',
    intents: [
      'orcamento.criar',
      'orcamento.listar',
      'orcamento.atualizar',
      'orcamento.enviar_cliente',
      'orcamento.aprovar',
      'orcamento.rejeitar',
    ],
  },
  leads: {
    description: 'Comandos relacionados a leads e pipeline de vendas',
    intents: [
      'lead.criar',
      'lead.listar',
      'lead.atualizar_status',
      'lead.converter',
      'lead.deletar',
    ],
  },
  ideias: {
    description: 'Comandos relacionados a sessão de ideias e brainstorm',
    intents: [
      'ideia.criar',
      'ideia.listar',
      'ideia.atualizar',
      'ideia.deletar',
      'ideia.converter_tarefa',
      'ideia.adicionar_comentario',
    ],
  },
  sistema: {
    description: 'Comandos gerais do sistema e navegação',
    intents: [
      'sistema.ajuda',
      'sistema.status',
      'sistema.navegar',
      'sistema.notificacoes',
    ],
  },
  social: {
    description: 'Saudações e conversação social',
    intents: [
      'social',
    ],
  },
  workspace: {
    description: 'Comandos relacionados ao workspace de clientes',
    intents: [
      'workspace.listar_clientes',
      'workspace.abrir',
      'workspace.criar_cliente',
      'workspace.criar_pasta',
      'workspace.upload',
      'workspace.servidores',
      'workspace.iniciar_demo',
      'workspace.parar_demo',
      'workspace.logs',
    ],
  },
  instagram: {
    description: 'Comandos relacionados ao Instagram',
    intents: [
      'instagram.importar',
      'instagram.mensagens',
      'instagram.configurar',
    ],
  },
  github: {
    description: 'Comandos relacionados ao GitHub',
    intents: [
      'github.repos',
      'github.git_push',
      'github.status',
    ],
  },
  vercel: {
    description: 'Comandos relacionados à Vercel',
    intents: [
      'vercel.projetos',
      'vercel.status',
    ],
  },
  seguranca: {
    description: 'Comandos relacionados à segurança e alertas',
    intents: [
      'seguranca.configuracoes',
      'seguranca.logs',
      'seguranca.testar_whatsapp',
      'seguranca.alerta',
    ],
  },
  operacoes: {
    description: 'Comandos relacionados ao centro de operações',
    intents: [
      'operacao.alerta',
      'operacao.excluir_alerta',
      'operacao.mudanca',
      'operacao.status',
    ],
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// CORPUS DE TREINAMENTO — Versão Inicial (expansível)
// ═════════════════════════════════════════════════════════════════════════════

const TRAINING_CORPUS = {
  // ══════════════════════════════════════════════════════════════════════════
  // DOMÍNIO: EMAIL
  // ══════════════════════════════════════════════════════════════════════════
  'email.responder': {
    pt: [
      'responde esse email',
      'responde essa mensagem',
      'manda uma resposta pro cliente',
      'quero responder esse email',
      'responde pro remetente',
      'dá uma resposta sobre isso',
      'escreve uma resposta',
      'responde o cara do email',
      'manda email de volta',
      'replica essa mensagem',
      'responde sobre o orçamento',
      'responde sobre o projeto',
      'manda resposta pro contato',
      'quero dar retorno sobre isso',
      'responde falando que sim',
      'responde falando que não',
      'manda um reply',
      'responde essa thread',
      'dá retorno pro cliente',
      'responde o email atual',
      'elabora uma resposta',
      'redige uma resposta pro cliente',
      'responde educadamente',
      'manda uma resposta formal',
    ],
    es: [
      'responde este email',
      'responde este mensaje',
      'manda una respuesta al cliente',
      'quiero responder este email',
      'responde al remitente',
      'escribe una respuesta',
      'responde al tipo del email',
      'manda email de vuelta',
      'replica este mensaje',
      'responde sobre el presupuesto',
      'responde sobre el proyecto',
      'manda respuesta al contacto',
      'quiero dar feedback sobre esto',
      'responde diciendo que sí',
      'responde diciendo que no',
      'manda un reply',
      'responde este hilo',
      'da feedback al cliente',
      'responde el email actual',
      'elabora una respuesta',
      'redacta una respuesta al cliente',
      'responde educadamente',
      'manda una respuesta formal',
    ],
    ca: [
      'respon aquest email',
      'respon aquest missatge',
      'envia una resposta al client',
      'vull respondre aquest email',
      'respon al remitent',
      'escriu una resposta',
      'respon al del email',
      'envia email de tornada',
      'replica aquest missatge',
      'respon sobre el pressupost',
      'respon sobre el projecte',
      'envia resposta al contacte',
      'vull donar feedback sobre això',
      'respon dient que sí',
      'respon dient que no',
      'envia un reply',
      'respon aquest fil',
      'dóna feedback al client',
      'respon l\'email actual',
      'elabora una resposta',
      'redacta una resposta al client',
      'respon educadament',
      'envia una resposta formal',
    ],
  },

  'email.resumir': {
    pt: [
      'resume essa conversa',
      'resume esse email',
      'o que foi discutido aqui',
      'me dá um resumo',
      'resume essa thread',
      'quero um resumo rápido',
      'sintetiza essa conversa',
      'resume os pontos principais',
      'me conta o essencial',
      'resume em bullets',
      'quero saber o que aconteceu',
      'resume essa troca de emails',
    ],
    es: [
      'resume esta conversación',
      'resume este email',
      'qué se discutió aquí',
      'dame un resumen',
      'resume este hilo',
      'quiero un resumen rápido',
      'sintetiza esta conversación',
      'resume los puntos principales',
      'cuéntame lo esencial',
      'resume en bullets',
      'quiero saber qué pasó',
      'resume este intercambio de emails',
    ],
    ca: [
      'resumeix aquesta conversa',
      'resumeix aquest email',
      'què s\'ha discutit aquí',
      'dona\'m un resum',
      'resumeix aquest fil',
      'vull un resum ràpid',
      'sintetitza aquesta conversa',
      'resumeix els punts principals',
      'explica\'m l\'essencial',
      'resumeix en bullets',
      'vull saber què ha passat',
      'resumeix aquest intercanvi d\'emails',
    ],
  },

  'email.analisar': {
    pt: [
      'analisa esse email',
      'isso é spam',
      'isso é phishing',
      'quão urgente é isso',
      'analisa o sentimento',
      'o que esse cliente quer',
      'qual a intenção desse email',
      'analisa a prioridade',
      'isso parece suspeito',
      'verifica se é seguro',
    ],
    es: [
      'analiza este email',
      'esto es spam',
      'esto es phishing',
      'qué tan urgente es esto',
      'analiza el sentimiento',
      'qué quiere este cliente',
      'cuál es la intención de este email',
      'analiza la prioridad',
      'esto parece sospechoso',
      'verifica si es seguro',
    ],
    ca: [
      'analitza aquest email',
      'això és spam',
      'això és phishing',
      'quina urgència té això',
      'analitza el sentiment',
      'què vol aquest client',
      'quina és la intenció d\'aquest email',
      'analitza la prioritat',
      'això sembla sospitós',
      'verifica si és segur',
    ],
  },

  'email.criar_rascunho': {
    pt: [
      'cria um rascunho',
      'escreve uma resposta',
      'gera um draft',
      'faz um rascunho de resposta',
      'cria um borrador',
      'elabora uma resposta profissional',
      'escreve um email pro cliente',
      'redige uma mensagem',
    ],
    es: [
      'crea un borrador',
      'escribe una respuesta',
      'genera un draft',
      'haz un borrador de respuesta',
      'elabora una respuesta profesional',
      'escribe un email al cliente',
      'redacta un mensaje',
    ],
    ca: [
      'crea un esborrany',
      'escriu una resposta',
      'genera un draft',
      'fes un esborrany de resposta',
      'elabora una resposta professional',
      'escriu un email al client',
      'redacta un missatge',
    ],
  },

  'email.enviar': {
    pt: [
      'envia esse email',
      'manda essa mensagem',
      'envia pro cliente',
      'dispara esse email',
      'manda agora',
      'envia imediatamente',
      'enviar email para',
      'manda email para o cliente',
      'envia email pro contato',
      'disparar email de cobrança',
      'enviar email com assunto',
      'manda email urgente',
      'envia email pro cliente sobre o projeto',
    ],
    es: [
      'envía este email',
      'manda este mensaje',
      'envía al cliente',
      'dispara este email',
      'manda ahora',
      'envía inmediatamente',
      'enviar email a',
      'manda email al cliente',
      'envía email al contacto',
      'disparar email de cobro',
      'enviar email con asunto',
      'manda email urgente',
      'envía email al cliente sobre el proyecto',
    ],
    ca: [
      'envia aquest email',
      'envia aquest missatge',
      'envia al client',
      'dispara aquest email',
      'envia ara',
      'envia immediatament',
      'enviar email a',
      'envia email al client',
      'envia email al contacte',
      'disparar email de cobrament',
      'enviar email amb assumpte',
      'envia email urgent',
      'envia email al client sobre el projecte',
    ],
  },

  'email.arquivar': {
    pt: [
      'arquiva esse email',
      'arquiva essa mensagem',
      'manda pra arquivados',
      'arquiva isso',
      'guarda esse email',
    ],
    es: [
      'archiva este email',
      'archiva este mensaje',
      'manda a archivados',
      'archiva esto',
      'guarda este email',
    ],
    ca: [
      'arquiva aquest email',
      'arquiva aquest missatge',
      'envia a arxivats',
      'arquiva això',
      'guarda aquest email',
    ],
  },

  'email.mover_lixeira': {
    pt: [
      'manda pra lixeira',
      'deleta esse email',
      'exclui essa mensagem',
      'joga no lixo',
      'remove esse email',
    ],
    es: [
      'manda a la papelera',
      'borra este email',
      'elimina este mensaje',
      'tira a la basura',
      'elimina este email',
    ],
    ca: [
      'envia a la paperera',
      'esborra aquest email',
      'elimina aquest missatge',
      'tira a la brossa',
      'elimina aquest email',
    ],
  },

  'email.listar_nao_lidos': {
    pt: [
      'mostra emails não lidos',
      'quais emails são novos',
      'lista mensagens não lidas',
      'tem email novo',
      'mostra notificações de email',
    ],
    es: [
      'muestra emails no leídos',
      'qué emails son nuevos',
      'lista mensajes no leídos',
      'hay email nuevo',
      'muestra notificaciones de email',
    ],
    ca: [
      'mostra emails no llegits',
      'quins emails són nous',
      'llista missatges no llegits',
      'hi ha email nou',
      'mostra notificacions d\'email',
    ],
  },

  'email.marcar_lido': {
    pt: [
      'marcar email como lido',
      'marcar email lido',
      'email lido',
      'marcar como lido',
      'marcar mensagem como lida',
      'marca esse email como lido',
      'marcar lido',
    ],
    es: [
      'marcar email como leído',
      'marcar email leído',
      'email leído',
      'marcar como leído',
      'marcar mensaje como leída',
      'marca este email como leído',
      'marcar leído',
    ],
    ca: [
      'marcar email com a llegit',
      'marcar email llegit',
      'email llegit',
      'marcar com a llegit',
      'marcar missatge com a llegida',
      'marca aquest email com a llegit',
      'marcar llegit',
    ],
  },

  'email.sincronizar': {
    pt: [
      'sincroniza emails',
      'atualiza a caixa de entrada',
      'puxa emails novos',
      'sincroniza gmail',
      'atualiza mensagens',
    ],
    es: [
      'sincroniza emails',
      'actualiza la bandeja de entrada',
      'trae emails nuevos',
      'sincroniza gmail',
      'actualiza mensajes',
    ],
    ca: [
      'sincronitza emails',
      'actualitza la safata d\'entrada',
      'agafa emails nous',
      'sincronitza gmail',
      'actualitza missatges',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMÍNIO: TAREFAS
  // ══════════════════════════════════════════════════════════════════════════
  'tarefa.criar': {
    pt: [
      'cria uma tarefa',
      'adiciona tarefa',
      'nova tarefa',
      'cria lembrete',
      'preciso fazer uma tarefa',
      'adiciona atividade',
      'cria uma coisa pra fazer',
      'nova atividade',
      'cria tarefa urgente',
      'adiciona ao backlog',
      // Typos comuns
      'crria tarefa',
      'cria tarfa',
      'cria tareefa',
      'nova tareefa',
    ],
    es: [
      'crea una tarea',
      'añade tarea',
      'nueva tarea',
      'crea recordatorio',
      'necesito hacer una tarea',
      'añade actividad',
      'crea algo que hacer',
      'nueva actividad',
      'crea tarea urgente',
      'añade al backlog',
    ],
    ca: [
      'crea una tasca',
      'afegeix tasca',
      'nova tasca',
      'crea recordatori',
      'necessito fer una tasca',
      'afegeix activitat',
      'crea una cosa per fer',
      'nova activitat',
      'crea tasca urgent',
      'afegeix al backlog',
    ],
  },

  'tarefa.listar': {
    pt: [
      'mostra minhas tarefas',
      'lista tarefas pendentes',
      'quais tarefas tenho',
      'mostra o backlog',
      'tarefas pra hoje',
      'o que preciso fazer',
      'lista atividades',
      'minhas tarefas pendentes',
    ],
    es: [
      'muestra mis tareas',
      'lista tareas pendientes',
      'qué tareas tengo',
      'muestra el backlog',
      'tareas para hoy',
      'qué necesito hacer',
      'lista actividades',
      'mis tareas pendientes',
    ],
    ca: [
      'mostra les meves tasques',
      'llista tasques pendents',
      'quines tasques tinc',
      'mostra el backlog',
      'tasques per avui',
      'què necessito fer',
      'llista activitats',
      'les meves tasques pendents',
    ],
  },

  'tarefa.concluir': {
    pt: [
      'marca como concluída',
      'finaliza essa tarefa',
      'conclui a tarefa',
      'marca como feito',
      'tarefa pronta',
      'termina essa atividade',
    ],
    es: [
      'marca como completada',
      'finaliza esta tarea',
      'concluye la tarea',
      'marca como hecho',
      'tarea lista',
      'termina esta actividad',
    ],
    ca: [
      'marca com a completada',
      'finalitza aquesta tasca',
      'conclou la tasca',
      'marca com a fet',
      'tasca llista',
      'termina aquesta activitat',
    ],
  },

  'tarefa.atribuir': {
    pt: [
      'atribui tarefa pro Abner',
      'manda essa tarefa pro Nonoke',
      'delega pro Elias',
      'quem vai fazer isso',
      'atribui responsável',
      'manda pro time',
    ],
    es: [
      'asigna tarea a Abner',
      'manda esta tarea a Nonoke',
      'delega a Elias',
      'quién va a hacer esto',
      'asigna responsable',
      'manda al equipo',
    ],
    ca: [
      'assigna tasca a l\'Abner',
      'envia aquesta tasca al Nonoke',
      'delega a l\'Elias',
      'qui farà això',
      'assigna responsable',
      'envia a l\'equip',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMÍNIO: FINANCEIRO
  // ══════════════════════════════════════════════════════════════════════════
  'financeiro.consultar_caixa': {
    pt: [
      'quanto temos no caixa',
      'saldo atual',
      'como está o caixa',
      'balanço atual',
      'dinheiro disponível',
      'quanto temos em conta',
      'consulta caixa',
      'status financeiro',
    ],
    es: [
      'cuánto tenemos en caja',
      'saldo actual',
      'cómo está la caja',
      'balance actual',
      'dinero disponible',
      'cuánto tenemos en cuenta',
      'consulta caja',
      'estado financiero',
    ],
    ca: [
      'quant tenim a caixa',
      'saldo actual',
      'com està la caixa',
      'balanç actual',
      'diners disponibles',
      'quant tenim al compte',
      'consulta caixa',
      'estat financer',
    ],
  },

  'financeiro.adicionar_receita': {
    pt: [
      'adiciona receita',
      'nova receita',
      'registra pagamento',
      'cliente pagou',
      'entrada de dinheiro',
      'adiciona pagamento recebido',
    ],
    es: [
      'añade ingreso',
      'nuevo ingreso',
      'registra pago',
      'cliente pagó',
      'entrada de dinero',
      'añade pago recibido',
    ],
    ca: [
      'afegeix ingrés',
      'nou ingrés',
      'registra pagament',
      'client ha pagat',
      'entrada de diners',
      'afegeix pagament rebut',
    ],
  },

  'financeiro.adicionar_despesa': {
    pt: [
      'adiciona despesa',
      'nova despesa',
      'registra gasto',
      'tivemos um custo',
      'saída de dinheiro',
      'registra pagamento feito',
      'quero registrar uma despesa',
      'registrar despesa',
      'nova saída de dinheiro',
      'temos um gasto novo',
    ],
    es: [
      'añade gasto',
      'nuevo gasto',
      'registra coste',
      'tuvimos un coste',
      'salida de dinero',
      'registra pago realizado',
    ],
    ca: [
      'afegeix despesa',
      'nova despesa',
      'registra cost',
      'hem tingut un cost',
      'sortida de diners',
      'registra pagament fet',
    ],
  },

  'financeiro.listar_pagamentos': {
    pt: [
      'listar pagamentos',
      'mostrar pagamentos',
      'ver pagamentos',
      'pagamentos recebidos',
      'receitas registradas',
      'histórico de pagamentos',
      'quais pagamentos temos',
    ],
    es: [
      'listar pagos',
      'mostrar pagos',
      'ver pagos',
      'pagos recibidos',
      'ingresos registrados',
      'histórico de pagos',
      'qué pagos tenemos',
    ],
    ca: [
      'llistar pagaments',
      'mostrar pagaments',
      'veure pagaments',
      'pagaments rebuts',
      'ingressos registrats',
      'històric de pagaments',
      'quins pagaments tenim',
    ],
  },

  'financeiro.listar_despesas': {
    pt: [
      'listar despesas',
      'mostrar despesas',
      'ver despesas',
      'gastos registrados',
      'despesas do mês',
      'histórico de despesas',
      'quais despesas temos',
    ],
    es: [
      'listar gastos',
      'mostrar gastos',
      'ver gastos',
      'costes registrados',
      'gastos del mes',
      'histórico de gastos',
      'qué gastos tenemos',
    ],
    ca: [
      'llistar despeses',
      'mostrar despeses',
      'veure despeses',
      'costos registrats',
      'despeses del mes',
      'històric de despeses',
      'quines despeses tenim',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMÍNIO: SOCIAL
  // ══════════════════════════════════════════════════════════════════════════
  'social': {
    pt: [
      'oi',
      'ola',
      'oi luna',
      'ola luna',
      'bom dia',
      'boa tarde',
      'boa noite',
      'tudo bem',
      'como vai',
      'como você está',
      'como voce esta',
      'e ai',
      'e aí',
      'salve',
      'opa',
      'iae',
    ],
    es: [
      'hola',
      'hola luna',
      'buenos dias',
      'buenas tardes',
      'buenas noches',
      'todo bien',
      'como estás',
      'como va',
      'que tal',
      'saludos',
    ],
    ca: [
      'hola',
      'hola luna',
      'bon dia',
      'bona tarda',
      'bona nit',
      'com estàs',
      'com va',
      'que tal',
      'salutacions',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMÍNIO: WHATSAPP
  // ══════════════════════════════════════════════════════════════════════════
  'whatsapp.enviar_mensagem': {
    pt: [
      'manda mensagem no whatsapp',
      'envia mensagem pro cliente',
      'manda zap',
      'envia whatsapp',
      'manda msg pro contato',
      'envia mensagem pelo whatsapp',
    ],
    es: [
      'manda mensaje por whatsapp',
      'envía mensaje al cliente',
      'manda zap',
      'envía whatsapp',
      'manda msg al contacto',
      'envía mensaje por whatsapp',
    ],
    ca: [
      'envia missatge per whatsapp',
      'envia missatge al client',
      'envia zap',
      'envia whatsapp',
      'envia msg al contacte',
      'envia missatge per whatsapp',
    ],
  },

  'whatsapp.responder_cliente': {
    pt: [
      'responde no whatsapp',
      'responde a mensagem',
      'manda resposta no zap',
      'reply no whatsapp',
      'responde o cliente no zap',
    ],
    es: [
      'responde por whatsapp',
      'responde el mensaje',
      'manda respuesta por zap',
      'reply por whatsapp',
      'responde al cliente por zap',
    ],
    ca: [
      'respon per whatsapp',
      'respon el missatge',
      'envia resposta per zap',
      'reply per whatsapp',
      'respon el client per zap',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMÍNIO: ORÇAMENTOS
  // ══════════════════════════════════════════════════════════════════════════
  'orcamento.criar': {
    pt: [
      'cria orçamento',
      'novo orçamento',
      'faz proposta',
      'gera orçamento pro cliente',
      'preciso de um orçamento',
      'cria proposta comercial',
      // Typos comuns
      'faz orcamentu',
      'cria orcamento',
      'faz propostta',
      'novo orçamentu',
    ],
    es: [
      'crea presupuesto',
      'nuevo presupuesto',
      'haz propuesta',
      'genera presupuesto para el cliente',
      'necesito un presupuesto',
      'crea propuesta comercial',
    ],
    ca: [
      'crea pressupost',
      'nou pressupost',
      'fes proposta',
      'genera pressupost per al client',
      'necessito un pressupost',
      'crea proposta comercial',
    ],
  },

  'orcamento.enviar_cliente': {
    pt: [
      'manda orçamento pro cliente',
      'envia proposta',
      'dispara o orçamento',
      'envia proposta comercial',
      'manda o orçamento por email',
    ],
    es: [
      'manda presupuesto al cliente',
      'envía propuesta',
      'dispara el presupuesto',
      'envía propuesta comercial',
      'manda el presupuesto por email',
    ],
    ca: [
      'envia pressupost al client',
      'envia proposta',
      'dispara el pressupost',
      'envia proposta comercial',
      'envia el pressupost per email',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMÍNIO: PROJETOS
  // ══════════════════════════════════════════════════════════════════════════
  'projeto.listar': {
    pt: [
      'listar projetos',
      'mostrar projetos',
      'ver projetos',
      'projetos ativos',
      'quais projetos temos',
      'status dos projetos',
      'meus projetos',
    ],
    es: [
      'listar proyectos',
      'mostrar proyectos',
      'ver proyectos',
      'proyectos activos',
      'qué proyectos tenemos',
      'estado de los proyectos',
      'mis proyectos',
    ],
    ca: [
      'llistar projectes',
      'mostrar projectes',
      'veure projectes',
      'projectes actius',
      'quins projectes tenim',
      'estat dels projectes',
      'els meus projectes',
    ],
  },

  'projeto.criar': {
    pt: [
      'criar projeto',
      'novo projeto',
      'adicionar projeto',
      'criar novo projeto',
    ],
    es: [
      'crear proyecto',
      'nuevo proyecto',
      'añadir proyecto',
      'crear nuevo proyecto',
    ],
    ca: [
      'crear projecte',
      'nou projecte',
      'afegir projecte',
      'crear nou projecte',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMÍNIO: IDEIAS
  // ══════════════════════════════════════════════════════════════════════════
  'ideia.listar': {
    pt: [
      'listar ideias',
      'mostrar ideias',
      'ver ideias',
      'ideias salvas',
      'brainstorms',
      'quais ideias temos',
      'minhas ideias',
      'sessao de ideias',
    ],
    es: [
      'listar ideas',
      'mostrar ideas',
      'ver ideas',
      'ideas guardadas',
      'brainstorms',
      'qué ideas tenemos',
      'mis ideas',
      'sesión de ideas',
    ],
    ca: [
      'llistar idees',
      'mostrar idees',
      'veure idees',
      'idees guardades',
      'brainstorms',
      'quines idees tenim',
      'les meves idees',
      'sessió d\'idees',
    ],
  },

  'ideia.criar': {
    pt: [
      'criar ideia',
      'nova ideia',
      'adicionar ideia',
      'novo brainstorm',
      'criar brainstorm',
    ],
    es: [
      'crear idea',
      'nueva idea',
      'añadir idea',
      'nuevo brainstorm',
      'crear brainstorm',
    ],
    ca: [
      'crear idea',
      'nova idea',
      'afegir idea',
      'nou brainstorm',
      'crear brainstorm',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMÍNIO: SISTEMA / GERAL
  // ══════════════════════════════════════════════════════════════════════════
  'whatsapp.verificar_mencoes': {
    pt: [
      'verificar mencoes',
      'checar mencoes',
      'tem alguem me mencionando',
      'quem me mencionou',
      'verifica se tem mencao',
      'menções pendentes',
      '@luna mencoes',
      'tem mencao no whatsapp',
    ],
    es: [
      'verificar menciones',
      'checar menciones',
      'hay alguien mencionándome',
      'quién me mencionó',
      'verifica si hay mención',
      'menciones pendientes',
      '@luna menciones',
      'hay mención en whatsapp',
    ],
    ca: [
      'verificar mencions',
      'comprovar mencions',
      'hi ha algú mencionant-me',
      'qui m\'ha mencionat',
      'verifica si hi ha menció',
      'mencions pendents',
      '@luna mencions',
      'hi ha menció al whatsapp',
    ],
  },

  'link.listar': {
    pt: [
      'listar links',
      'mostrar links',
      'ver links',
      'links cadastrados',
      'recursos salvos',
      'mostra os links',
      'quais links temos',
    ],
    es: [
      'listar links',
      'mostrar links',
      'ver links',
      'links registrados',
      'recursos guardados',
      'muestra los links',
      'qué links tenemos',
    ],
    ca: [
      'llistar links',
      'mostrar links',
      'veure links',
      'links registrats',
      'recursos guardats',
      'mostra els links',
      'quins links tenim',
    ],
  },

  'link.adicionar': {
    pt: [
      'adicionar link',
      'salvar link',
      'guardar link',
      'novo link',
      'adicionar url',
      'salvar url',
    ],
    es: [
      'añadir link',
      'guardar link',
      'salvar link',
      'nuevo link',
      'añadir url',
      'guardar url',
    ],
    ca: [
      'afegir link',
      'guardar link',
      'salvar link',
      'nou link',
      'afegir url',
      'guardar url',
    ],
  },

  'sistema.notificacoes': {
    pt: [
      'listar notificacoes',
      'mostrar notificacoes',
      'ver notificacoes',
      'notificacoes pendentes',
      'tem notificacao',
      'notificacoes do sistema',
      'alertas',
      'ver alertas',
    ],
    es: [
      'listar notificaciones',
      'mostrar notificaciones',
      'ver notificaciones',
      'notificaciones pendientes',
      'hay notificación',
      'notificaciones del sistema',
      'alertas',
      'ver alertas',
    ],
    ca: [
      'llistar notificacions',
      'mostrar notificacions',
      'veure notificacions',
      'notificacions pendents',
      'hi ha notificació',
      'notificacions del sistema',
      'alertes',
      'veure alertes',
    ],
  },

  'sistema.ajuda': {
    pt: [
      'ajuda',
      'o que você pode fazer',
      'como usar',
      'me ajuda',
      'preciso de ajuda',
      'o que consigo fazer',
      'quais comandos você entende',
      'me mostra as opções',
    ],
    es: [
      'ayuda',
      'qué puedes hacer',
      'cómo usar',
      'ayúdame',
      'necesito ayuda',
      'qué puedo hacer',
      'qué comandos entiendes',
      'muéstrame las opciones',
    ],
    ca: [
      'ajuda',
      'què pots fer',
      'com usar',
      'ajuda\'m',
      'necessito ajuda',
      'què puc fer',
      'quins comandaments entens',
      'mostra\'m les opcions',
    ],
  },

  'sistema.status': {
    pt: [
      'como está o sistema',
      'status do dashboard',
      'tudo ok',
      'tem algum problema',
      'como está tudo',
      'verifica status',
    ],
    es: [
      'cómo está el sistema',
      'estado del dashboard',
      'todo ok',
      'hay algún problema',
      'cómo está todo',
      'verifica estado',
    ],
    ca: [
      'com està el sistema',
      'estat del dashboard',
      'tot ok',
      'hi ha algun problema',
      'com està tot',
      'verifica estat',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FALLBACK / NONE — Frases que NÃO pertencem a nenhum domínio do NEXO
  // Objetivo: evitar false positives quando o usuário fala de coisas
  // completamente fora do contexto do ERP (comida, clima, notícias, etc.)
  // ══════════════════════════════════════════════════════════════════════════
  'None': {
    pt: [
      // Comida e bebida
      'batata frita', 'cachorro quente', 'eu gosto de pizza',
      'hambúrguer com queijo', 'sushi de salmão', 'café da manhã',
      'jantar com a família', 'almoço no restaurante',
      // Clima e tempo
      'o clima está bom hoje', 'qual é a previsão do tempo',
      'está chovendo lá fora', 'fez sol ontem',
      // Entretenimento
      'vamos ao cinema', 'me conta uma piada', 'melhor filme do ano',
      'recomendação de série', 'música boa para ouvir',
      // Conhecimento geral
      'quem é o presidente', 'como funciona a gravidade',
      'qual a capital do japão', 'quanto é dois mais dois',
      'quem descobriu o brasil', 'quando foi a segunda guerra',
      // Notícias e mundo
      'notícias do mundo', 'resultado do jogo de ontem',
      'últimas notícias de hoje', 'política internacional',
      // Receitas e domesticidade
      'receita de bolo de chocolate', 'como fazer macarrão',
      'como cozinhar arroz', 'ingredientes para lasanha',
      // Texto aleatório / nonsense
      'xyz abc def ghi', 'lorem ipsum dolor sit', 'foo bar baz qux',
      'asdfghjkl qwerty', '1234567890 teste',
      // Cores, frutas, natureza
      'banana maçã laranja', 'vermelho azul verde',
      'sol lua estrela', 'montanha oceano floresta',
      // Frases com preposições que podem confundir (simulando overlap)
      'no espaço sideral', 'para o outro lado', 'pro lado de lá',
      'sobre a mesa', 'debaixo da cadeira', 'dentro do carro',
      // Mix de palavras do domínio em contexto irrelevante
      'email do meu amigo', 'tarefa de casa da escola',
      'projeto de artes', 'cliente do restaurante',
      'caixa de sapato', 'mensagem no grupo da família',
      'orçamento da construção da casa', 'lead de guitarra',
      'ideia genial para jantar', 'status do relacionamento',
    ],
    es: [
      // Comida y bebida
      'patatas fritas', 'perro caliente', 'me gusta la pizza',
      'hamburguesa con queso', 'sushi de salmón', 'desayuno completo',
      'cena con la familia', 'almuerzo en el restaurante',
      // Clima y tiempo
      'el clima está bueno', 'qué tiempo hace hoy',
      'está lloviendo afuera', 'hizo sol ayer',
      // Entretenimiento
      'vamos al cine', 'cuéntame un chiste', 'mejor película del año',
      'recomendación de serie', 'buena música para escuchar',
      // Conocimiento general
      'quién es el presidente', 'cómo funciona la gravedad',
      'cuál es la capital de japón', 'cuánto es dos más dos',
      'quién descubrió américa', 'cuándo fue la segunda guerra',
      // Noticias y mundo
      'noticias del mundo', 'resultado del partido',
      'últimas noticias de hoy', 'política internacional',
      // Recetas y domesticidad
      'receta de tarta de chocolate', 'cómo hacer pasta',
      'cómo cocinar arroz', 'ingredientes para lasaña',
      // Texto aleatorio / nonsense
      'xyz abc def ghi', 'lorem ipsum dolor sit', 'foo bar baz qux',
      'asdfghjkl qwerty', '1234567890 prueba',
      // Colores, frutas, naturaleza
      'plátano manzana naranja', 'rojo azul verde',
      'sol luna estrella', 'montaña océano bosque',
      // Frases con preposiciones que pueden confundir
      'en el espacio sideral', 'para el otro lado', 'al lado de allá',
      'sobre la mesa', 'debajo de la silla', 'dentro del coche',
      // Mix de palabras del dominio en contexto irrelevante
      'email de mi amigo', 'tarea de la escuela',
      'proyecto de arte', 'cliente del restaurante',
      'caja de zapatos', 'mensaje en el grupo familiar',
      'presupuesto de la construcción', 'lead de guitarra',
      'idea genial para cenar', 'estado de la relación',
    ],
    ca: [
      // Menjar i beguda
      'patates fregides', 'gos calent', 'm\'agrada la pizza',
      'hamburguesa amb formatge', 'sushi de salmó', 'esmorzar complet',
      'sopar amb la família', 'dinar al restaurant',
      // Clima i temps
      'el temps és bo avui', 'quina previsió hi ha',
      'plou a fora', 'va fer sol ahir',
      // Entreteniment
      'anem al cinema', 'explica\'m un acudit', 'millor pel·lícula de l\'any',
      'recomanació de sèrie', 'bona música per escoltar',
      // Coneixement general
      'qui és el president', 'com funciona la gravetat',
      'quina és la capital del japó', 'quant és dos més dos',
      'qui va descobrir américa', 'quan va ser la segona guerra',
      // Notícies i món
      'notícies del món', 'resultat del partit',
      'últimes notícies d\'avui', 'política internacional',
      // Receptes i llar
      'recepta de pastís de xocolata', 'com fer pasta',
      'com cuinar arròs', 'ingredients per lasanya',
      // Text aleatori / nonsense
      'xyz abc def ghi', 'lorem ipsum dolor sit', 'foo bar baz qux',
      'asdfghjkl qwerty', '1234567890 prova',
      // Colors, fruites, natura
      'plàtan poma taronja', 'vermell blau verd',
      'sol lluna estrella', 'muntanya oceà bosc',
      // Frases amb preposicions que poden confondre
      'a l\'espai sideral', 'per l\'altre costat', 'cap al costat de llà',
      'sobre la taula', 'sota la cadira', 'dins del cotxe',
      // Mix de paraules del domini en context irrelevant
      'email del meu amic', 'tasca de l\'escola',
      'projecte d\'art', 'client del restaurant',
      'caixa de sabates', 'missatge al grup familiar',
      'pressupost de la construcció', 'lead de guitarra',
      'idea genial per sopar', 'estat de la relació',
    ],
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// ENTITIES (Named Entity Recognition)
// ═════════════════════════════════════════════════════════════════════════════

const ENTITIES = {
  cliente: {
    pt: ['cliente', 'clientes', 'contato', 'contatos'],
    es: ['cliente', 'clientes', 'contacto', 'contactos'],
    ca: ['client', 'clients', 'contacte', 'contactes'],
  },
  projeto: {
    pt: ['projeto', 'projetos'],
    es: ['proyecto', 'proyectos'],
    ca: ['projecte', 'projectes'],
  },
  tarefa: {
    pt: ['tarefa', 'tarefas', 'atividade', 'atividades'],
    es: ['tarea', 'tareas', 'actividad', 'actividades'],
    ca: ['tasca', 'tasques', 'activitat', 'activitats'],
  },
  orcamento: {
    pt: ['orçamento', 'orçamentos', 'proposta', 'propostas'],
    es: ['presupuesto', 'presupuestos', 'propuesta', 'propuestas'],
    ca: ['pressupost', 'pressupostos', 'proposta', 'propostes'],
  },
  prioridade: {
    pt: ['urgente', 'prioritário', 'alta prioridade', 'baixa prioridade', 'média'],
    es: ['urgente', 'prioritario', 'alta prioridad', 'baja prioridad', 'media'],
    ca: ['urgent', 'prioritari', 'alta prioritat', 'baixa prioritat', 'mitjana'],
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// FUNÇÕES PÚBLICAS
// ═════════════════════════════════════════════════════════════════════════════

let isTrained = false;

/**
 * Popula o manager com o corpus de treinamento.
 */
function populateCorpus() {
  console.log('[LunaNLU] Populando corpus de treinamento...');

  for (const [intent, translations] of Object.entries(TRAINING_CORPUS)) {
    for (const [lang, utterances] of Object.entries(translations)) {
      for (const utterance of utterances) {
        manager.addDocument(lang, utterance, intent);
      }
    }
  }

  // Adicionar respostas padrão para cada intent (usado quando não há API)
  const DEFAULT_ANSWERS = {
    'email.responder': {
      pt: 'Vou abrir o assistente de resposta para você preencher.',
      es: 'Voy a abrir el asistente de respuesta para que lo completes.',
      ca: 'Obriré l\'assistent de resposta perquè ho omplis.',
    },
    'email.resumir': {
      pt: 'Vou gerar um resumo da conversa.',
      es: 'Voy a generar un resumen de la conversación.',
      ca: 'Generaré un resum de la conversa.',
    },
    'email.analisar': {
      pt: 'Vou analisar este email.',
      es: 'Voy a analizar este email.',
      ca: 'Analitzaré aquest email.',
    },
    'tarefa.criar': {
      pt: 'Vou abrir o formulário de nova tarefa.',
      es: 'Voy a abrir el formulario de nueva tarea.',
      ca: 'Obriré el formulari de nova tasca.',
    },
    'financeiro.consultar_caixa': {
      pt: 'Consultando saldo do caixa...',
      es: 'Consultando saldo de caja...',
      ca: 'Consultant saldo de caixa...',
    },
    'sistema.ajuda': {
      pt: 'Posso ajudar com emails, tarefas, projetos, clientes, financeiro, WhatsApp, orçamentos, leads e ideias. O que você precisa?',
      es: 'Puedo ayudar con emails, tareas, proyectos, clientes, finanzas, WhatsApp, presupuestos, leads e ideas. ¿Qué necesitas?',
      ca: 'Puc ajudar amb emails, tasques, projectes, clients, finances, WhatsApp, pressupostos, leads i idees. Què necessites?',
    },
  };

  for (const [intent, translations] of Object.entries(DEFAULT_ANSWERS)) {
    for (const [lang, answer] of Object.entries(translations)) {
      manager.addAnswer(lang, intent, answer);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REGISTRAR ENTITIES (NER)
  // ══════════════════════════════════════════════════════════════════════════
  for (const [entityName, translations] of Object.entries(ENTITIES)) {
    for (const [lang, values] of Object.entries(translations)) {
      for (const value of values) {
        manager.addNamedEntityText(entityName, value, [lang], [value]);
      }
    }
  }

  console.log(`[LunaNLU] Corpus populado: ${Object.keys(TRAINING_CORPUS).length} intents em 3 idiomas.`);
  console.log(`[LunaNLU] Entities registradas: ${Object.keys(ENTITIES).join(', ')}.`);
}

/**
 * Treina o modelo e salva em disco.
 */
async function train() {
  if (isTrained) return;

  // Tenta carregar modelo existente
  if (fs.existsSync(MODEL_PATH)) {
    try {
      console.log('[LunaNLU] Carregando modelo existente...');
      await manager.load(MODEL_PATH);
      isTrained = true;
      console.log('[LunaNLU] ✅ Modelo carregado de', MODEL_PATH);
      return;
    } catch (e) {
      console.warn('[LunaNLU] Falha ao carregar modelo existente, treinando novo...');
    }
  }

  populateCorpus();
  console.log('[LunaNLU] Treinando modelo (isso pode levar alguns segundos)...');
  await manager.train();

  // Salva modelo
  const dir = path.dirname(MODEL_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  manager.save(MODEL_PATH);

  isTrained = true;
  console.log('[LunaNLU] ✅ Modelo treinado e salvo em', MODEL_PATH);
}

/**
 * Processa uma mensagem do usuário e retorna intent, entities, confidence.
 *
 * @param {string} text - Texto do usuário
 * @param {string} lang - Idioma preferencial ('pt', 'es', 'ca', ou null para auto-detect)
 * @returns {Promise<Object>} - Resultado do processamento
 */
async function process(text, lang = null) {
  if (!isTrained) await train();
  if (!text || !text.trim()) {
    return { intent: 'None', score: 0, entities: [], answer: '', language: null };
  }

  const result = await manager.process(lang, text.trim());

  // Normaliza resultado
  const normalized = {
    intent: result.intent || 'None',
    score: result.score || 0,
    entities: (result.entities || []).map((e) => ({
      type: e.entity,
      value: e.option || e.sourceText || e.utteranceText,
      start: e.start,
      end: e.end,
      accuracy: e.accuracy,
    })),
    answer: result.answer || '',
    language: result.locale || lang || 'auto',
    domain: (result.intent || 'None').split('.')[0] || 'unknown',
    sentiment: result.sentiment || null,
    raw: result,
  };

  // Determina ação baseada no confidence
  if (normalized.score >= 0.85) {
    normalized.action = 'execute';
  } else if (normalized.score >= 0.50) {
    normalized.action = 'confirm';
  } else if (normalized.score >= 0.20) {
    normalized.action = 'suggest';
    normalized.suggestions = await getTopIntents(text, 3);
  } else {
    normalized.action = 'fallback';
  }

  return normalized;
}

/**
 * Retorna os top-N intents mais prováveis para uma frase.
 */
async function getTopIntents(text, n = 3) {
  if (!isTrained) await train();

  const classifications = await manager.classify(text);
  if (!classifications || !classifications.classifications) return [];

  return classifications.classifications
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((c) => ({
      intent: c.intent,
      score: c.score,
      domain: c.intent.split('.')[0] || 'unknown',
    }));
}

/**
 * Lista todos os intents e domínios disponíveis.
 */
function getIntents() {
  const intents = [];
  for (const [domain, info] of Object.entries(DOMAINS)) {
    for (const intent of info.intents) {
      intents.push({ domain, intent, description: info.description });
    }
  }
  return intents;
}

/**
 * Adiciona novos exemplos de treinamento em runtime e re-treina.
 * Útil para active learning — quando o usuário corrige uma classificação.
 */
async function addTrainingExample(lang, utterance, intent) {
  manager.addDocument(lang, utterance, intent);
  console.log(`[LunaNLU] Novo exemplo adicionado: [${lang}] "${utterance}" → ${intent}`);

  // Re-treina incrementalmente
  await manager.train();
  manager.save(MODEL_PATH);
  console.log('[LunaNLU] Modelo re-treinado e salvo.');
}

module.exports = {
  train,
  process,
  getTopIntents,
  getIntents,
  addTrainingExample,
  DOMAINS,
  ENTITIES,
};
