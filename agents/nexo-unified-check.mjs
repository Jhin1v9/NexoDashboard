/**
 * NEXO UNIFIED CHECK — Script Master de Automação
 * 
 * Executa a cada 30 minutos:
 * 1. Check WhatsApp (extrai mensagens, detecta tarefas/ideias/decisões)
 * 2. Check Discord (extrai mensagens, dicas, perguntas, respostas)
 * 3. Check GitHub (commits, issues, PRs, releases)
 * 4. Check Vercel (deploys, previews, errors)
 * 5. Check Site Forms (novos leads)
 * 6. Check Finance (novas transações)
 * 7. Classifica todos os itens novos
 * 8. Atualiza Dashboard JSONs
 * 9. Gera relatório unificado
 * 10. Envia resumo WhatsApp se itens críticos encontrados
 * 
 * Criado por Luna — NEXO DIGITAL — 2026-05-01
 * Versão: 1.0
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');

// ============================================
// CONFIGURAÇÃO
// ============================================
const CONFIG = {
  version: '1.0',
  updatedAt: '2026-05-01',
  intervals: {
    unifiedCheck: '30min',      // Check master a cada 30 min
    whatsapp: '30min',          // WhatsApp check
    discord: '30min',           // Discord check
    github: '1h',               // GitHub check
    vercel: '1h',               // Vercel check
    siteForms: '30min',         // Site forms check
    finance: '5min'             // Finance file watcher
  },
  sources: ['whatsapp', 'discord', 'github', 'vercel', 'site-leads', 'finance']
};

// ============================================
// CLASSIFICADORES DE MENSAGENS
// ============================================
const CLASSIFIERS = {
  task: {
    name: 'TaskDetector',
    patterns: [
      'tarefa', 'fazer', 'precisamos', 'tem que', 'deveríamos',
      'tem que fazer', 'precisa fazer', 'vamos fazer', 'falta fazer',
      'logo ta', 'ta pequena', 'precisa ajustar', 'precisa mudar',
      'corrigir', 'arrumar', 'consertar'
    ],
    priority: 'high',
    type: 'task'
  },
  idea: {
    name: 'IdeaDetector',
    patterns: [
      'ideia', 'sugestão', 'podemos', 'que tal', 'seria bom',
      'poderíamos', 'seria legal', 'podia ter', 'faltaria'
    ],
    priority: 'medium',
    type: 'idea'
  },
  decision: {
    name: 'DecisionDetector',
    patterns: [
      'decidimos', 'vamos fazer', 'fechamos', 'combinado', 'aprovar',
      'ficou decidido', 'vai ser assim', 'definimos', 'confirmado'
    ],
    priority: 'high',
    type: 'decision'
  },
  payment: {
    name: 'PaymentDetector',
    patterns: [
      'paguei', 'transferi', 'bizum', 'recebi', 'depositar',
      'pagamento', 'fatura', 'invoice', '€', 'EUR', 'euro'
    ],
    priority: 'critical',
    type: 'payment'
  },
  question: {
    name: 'QuestionDetector',
    patterns: [
      'pergunta', 'dúvida', 'como faz', 'onde fica', 'qual é',
      'sabe como', 'alguém sabe', 'preciso de ajuda'
    ],
    priority: 'medium',
    type: 'question'
  },
  tip: {
    name: 'TipDetector',
    patterns: [
      'dica', 'tip', 'sugestão técnica', 'melhor prática',
      'recomendo', 'indico', 'usar isso', 'ferramenta boa'
    ],
    priority: 'low',
    type: 'tip'
  },
  link: {
    name: 'LinkDetector',
    regex: /https?:\/\/[^\s]+/g,
    priority: 'low',
    type: 'link'
  },
  code: {
    name: 'CodeSnippetDetector',
    patterns: ['```', 'function', 'const', 'import', 'export', 'class', 'return'],
    priority: 'medium',
    type: 'code'
  }
};

// ============================================
// EXEMPLOS DE DETECÇÃO
// ============================================
const EXAMPLES = {
  discord: {
    // Exemplo: Nonoke envia "ABNER A LOGO TA MT PEQUENA"
    logoTooSmall: {
      source: 'discord',
      sourceGroup: 'Programadores de Plantão',
      author: 'Nonoke',
      content: 'ABNER A LOGO TA MT PEQUENA',
      detectedType: 'task',
      detectedPriority: 'high',
      extractedData: {
        issue: 'logo muito pequena',
        client: null,
        project: 'Site NEXO',
        actionable: true,
        suggestedAction: 'Aumentar tamanho da logo no site nexo.chatopsmaster.com'
      },
      dashboardEntry: {
        type: 'task',
        title: 'Ajustar tamanho da logo (Discord: Nonoke reportou)',
        description: 'Nonoke enviou no Discord: "ABNER A LOGO TA MT PEQUENA"',
        source: 'Discord — Programadores de Plantão',
        priority: 'high',
        status: 'pending',
        category: 'empresa'
      }
    },
    // Exemplo: dica técnica
    techTip: {
      source: 'discord',
      sourceGroup: 'Programadores de Plantão',
      author: 'Wardilias',
      content: 'Dica: usar o useMemo do React quando o componente re-renderiza muito',
      detectedType: 'tip',
      detectedPriority: 'low',
      extractedData: {
        tip: 'useMemo para performance',
        technology: 'React'
      }
    }
  },
  whatsapp: {
    // Exemplo: pagamento
    payment: {
      source: 'whatsapp',
      sourceGroup: 'Production 2026',
      author: 'Paulo',
      content: 'Paguei €175 via Bizum, obrigado!',
      detectedType: 'payment',
      detectedPriority: 'critical',
      extractedData: {
        amount: 175,
        currency: 'EUR',
        method: 'Bizum',
        client: 'Paulo Santafe',
        project: 'Site Santafe'
      }
    }
  }
};

// ============================================
// FUNÇÃO DE CLASSIFICAÇÃO
// ============================================
function classifyMessage(source, author, content, groupName = null) {
  const result = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    source: source,
    sourceGroup: groupName,
    timestamp: new Date().toISOString(),
    author: author,
    content: content,
    types: [],
    priority: 'low',
    actionable: false,
    extractedData: {},
    dashboardAction: null
  };

  const lowerContent = content.toLowerCase();

  // Verificar cada classificador
  for (const [key, classifier] of Object.entries(CLASSIFIERS)) {
    let matched = false;

    if (classifier.regex) {
      // Regex matcher (links)
      const matches = content.match(classifier.regex);
      if (matches && matches.length > 0) {
        matched = true;
        result.extractedData.links = matches;
      }
    } else if (classifier.patterns) {
      // Pattern matcher
      for (const pattern of classifier.patterns) {
        if (lowerContent.includes(pattern.toLowerCase())) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      result.types.push(classifier.type);
      
      // Atualizar prioridade se for mais alta
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      if (priorityOrder[classifier.priority] > priorityOrder[result.priority]) {
        result.priority = classifier.priority;
      }
    }
  }

  // Determinar se é actionable
  result.actionable = result.types.some(t => 
    ['task', 'payment', 'decision', 'question'].includes(t)
  );

  // Determinar ação do dashboard
  if (result.types.includes('task') && result.actionable) {
    result.dashboardAction = 'create_task';
  } else if (result.types.includes('payment')) {
    result.dashboardAction = 'update_payment';
  } else if (result.types.includes('idea')) {
    result.dashboardAction = 'log_idea';
  } else if (result.types.includes('tip')) {
    result.dashboardAction = 'log_tip';
  }

  return result;
}

// ============================================
// FUNÇÃO DE CHECK UNIFICADO
// ============================================
async function runUnifiedCheck() {
  const now = new Date();
  const report = {
    timestamp: now.toISOString(),
    sourcesChecked: [],
    newItems: [],
    tasksDetected: [],
    paymentsDetected: [],
    ideasDetected: [],
    tipsDetected: [],
    alerts: [],
    errors: []
  };

  console.log(`[${now.toLocaleString()}] 🔄 NEXO Unified Check iniciando...`);

  // 1. CHECK WHATSAPP
  try {
    console.log('📱 Check WhatsApp...');
    // Chamar WhatsApp agent existente ou extrair via API
    const whatsappData = await checkWhatsApp();
    report.sourcesChecked.push('whatsapp');
    
    for (const msg of whatsappData.newMessages) {
      const classified = classifyMessage('whatsapp', msg.author, msg.content, msg.group);
      report.newItems.push(classified);
      
      if (classified.types.includes('task')) report.tasksDetected.push(classified);
      if (classified.types.includes('payment')) report.paymentsDetected.push(classified);
      if (classified.types.includes('idea')) report.ideasDetected.push(classified);
      if (classified.types.includes('tip')) report.tipsDetected.push(classified);
    }
  } catch (err) {
    report.errors.push({ source: 'whatsapp', error: err.message });
  }

  // 2. CHECK DISCORD
  try {
    console.log('💬 Check Discord...');
    const discordData = await checkDiscord();
    report.sourcesChecked.push('discord');
    
    for (const msg of discordData.newMessages) {
      const classified = classifyMessage('discord', msg.author, msg.content, msg.channel);
      report.newItems.push(classified);
      
      if (classified.types.includes('task')) report.tasksDetected.push(classified);
      if (classified.types.includes('payment')) report.paymentsDetected.push(classified);
      if (classified.types.includes('idea')) report.ideasDetected.push(classified);
      if (classified.types.includes('tip')) report.tipsDetected.push(classified);
    }
  } catch (err) {
    report.errors.push({ source: 'discord', error: err.message });
  }

  // 3. CHECK GITHUB
  try {
    console.log('🐙 Check GitHub...');
    const githubData = await checkGitHub();
    report.sourcesChecked.push('github');
    // Processar commits, issues, PRs
  } catch (err) {
    report.errors.push({ source: 'github', error: err.message });
  }

  // 4. CHECK VERCEL
  try {
    console.log('▲ Check Vercel...');
    const vercelData = await checkVercel();
    report.sourcesChecked.push('vercel');
    // Processar deploys
  } catch (err) {
    report.errors.push({ source: 'vercel', error: err.message });
  }

  // 5. CHECK SITE FORMS
  try {
    console.log('🌐 Check Site Forms...');
    const siteData = await checkSiteForms();
    report.sourcesChecked.push('site-leads');
    // Processar novos leads
  } catch (err) {
    report.errors.push({ source: 'site-leads', error: err.message });
  }

  // 6. CHECK FINANCE
  try {
    console.log('💰 Check Finance...');
    const financeData = await checkFinance();
    report.sourcesChecked.push('finance');
    // Processar novas transações
  } catch (err) {
    report.errors.push({ source: 'finance', error: err.message });
  }

  // 7. UPDATE DASHBOARD
  console.log('📊 Atualizando Dashboard...');
  await updateDashboard(report);

  // 8. SAVE REPORT
  const reportPath = join(DATA_DIR, `unified-report-${now.toISOString().split('T')[0]}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // 9. SEND WHATSAPP SUMMARY IF CRITICAL
  if (report.tasksDetected.length > 0 || report.paymentsDetected.length > 0) {
    await sendWhatsAppSummary(report);
  }

  console.log(`✅ Unified Check concluído. ${report.newItems.length} itens novos.`);
  return report;
}

// ============================================
// FUNÇÕES DE CHECK (STUBS — IMPLEMENTAR)
// ============================================
async function checkWhatsApp() {
  // Usar agente existente ou extrair via WhatsApp Web API
  return { newMessages: [] };
}

async function checkDiscord() {
  // Usar Discord.js ou webhook
  return { newMessages: [] };
}

async function checkGitHub() {
  // Usar GitHub API
  return { commits: [], issues: [], prs: [] };
}

async function checkVercel() {
  // Usar Vercel API
  return { deploys: [] };
}

async function checkSiteForms() {
  // Verificar formulários do site
  return { leads: [] };
}

async function checkFinance() {
  // Verificar JSONs financeiros
  return { transactions: [] };
}

async function updateDashboard(report) {
  // Atualizar JSONs do backend
  console.log('Dashboard atualizado.');
}

async function sendWhatsAppSummary(report) {
  // Enviar resumo no WhatsApp Production 2026
  console.log('WhatsApp summary enviado.');
}

// ============================================
// EXECUÇÃO
// ============================================
if (process.argv.includes('--run')) {
  runUnifiedCheck().catch(console.error);
}

export { runUnifiedCheck, classifyMessage, CLASSIFIERS, CONFIG };
