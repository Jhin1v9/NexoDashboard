/**
 * NEXO WhatsApp Desktop Agent
 * Lê mensagens do app WhatsApp Windows via UI Automation
 */

const axios = require('axios');
const { execSync } = require('child_process');

const CONFIG = {
  groupName: '🏆Production - 2026🙏',
  apiUrl: 'http://127.0.0.1:3456/api/whatsapp',
  checkIntervalMs: 5000,
};

function nowISO() { return new Date().toISOString(); }

async function sendToDashboard(msg) {
  try {
    await axios.post(CONFIG.apiUrl, msg);
    console.log('   📤 Dashboard:', msg.text?.substring(0, 50));
  } catch (e) {
    console.log('   ⚠️  Dashboard offline');
  }
}

function extractTasks(text) {
  const patterns = [
    /(fazer|faz|fazemos|precisamos|tem que|temos que|devemos|vamos)\s+(.+)/i,
    /(tarefa|task|todo|ação):?\s*(.+)/i,
    /(bug|erro|problema|issue):?\s*(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[2] ? m[2].trim() : m[0];
  }
  return null;
}

function detectMentions(text) {
  const m = [];
  if (/\b(abner|jhin)\b/i.test(text)) m.push('abner');
  if (/\b(nonoke|nono)\b/i.test(text)) m.push('nonoke');
  if (/\b(elias)\b/i.test(text)) m.push('elias');
  if (/\b(todos|equipe|time)\b/i.test(text)) m.push('all');
  return m;
}

// ── PowerShell UI Automation ─────────────────────────────────────────────

function getWhatsAppMessages() {
  const psScript = `
Add-Type -AssemblyName UIAutomationClient

function Get-WhatsAppMessages {
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    
    # Encontra a janela do WhatsApp
    $whatsapp = $root.FindFirst(
        [System.Windows.Automation.TreeScope]::Children,
        [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::NameProperty, "WhatsApp"
        )
    )
    
    if (-not $whatsapp) {
        Write-Host "WHATSAPP_NOT_FOUND"
        return
    }
    
    # Procura elementos de texto dentro da janela
    $textPattern = [System.Windows.Automation.ControlType]::Text
    $textElements = $whatsapp.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.ControlTypeCondition]::new($textPattern)
    )
    
    $messages = @()
    for ($i = 0; $i -lt $textElements.Count; $i++) {
        $el = $textElements[$i]
        $name = $el.Current.Name
        if ($name -and $name.Length -gt 2 -and $name.Length -lt 500) {
            $messages += $name
        }
    }
    
    # Também procura por ListItems (mensagens em lista)
    $listItems = $whatsapp.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.ControlTypeCondition]::new([System.Windows.Automation.ControlType]::ListItem)
    )
    
    for ($i = 0; $i -lt $listItems.Count; $i++) {
        $item = $listItems[$i]
        $name = $item.Current.Name
        if ($name -and $name.Length -gt 2 -and $name.Length -lt 500) {
            $messages += $name
        }
    }
    
    $messages | Select-Object -Last 30 | ForEach-Object { Write-Host $_ }
}

Get-WhatsAppMessages
`;

  try {
    const result = execSync('powershell -Command "' + psScript.replace(/"/g, '\"') + '"', {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    });
    
    if (result.includes('WHATSAPP_NOT_FOUND')) {
      return { error: 'WhatsApp Desktop não encontrado' };
    }
    
    const lines = result.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && l.length < 500 && !l.startsWith('Add-Type'));
    
    return { messages: lines };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function run() {
  console.log('📱 NEXO WhatsApp Desktop Agent');
  console.log('   App: WhatsApp Desktop (Windows)');
  console.log('   Grupo:', CONFIG.groupName);
  console.log('');

  // Verifica se o app está rodando
  const check = getWhatsAppMessages();
  if (check.error) {
    console.error('❌', check.error);
    console.error('   Abra o WhatsApp Desktop e entre no grupo.');
    process.exit(1);
  }

  console.log('✅ WhatsApp Desktop detectado!');
  console.log(`   ${check.messages?.length || 0} elementos de texto encontrados.`);
  console.log('');
  console.log('👁️  Monitorando... (Ctrl+C para parar)');
  console.log('────────────────────────────────────────');

  let lastMessages = new Set();
  
  // Inicializa
  if (check.messages) {
    check.messages.forEach(m => lastMessages.add(m));
  }

  // Loop
  while (true) {
    await new Promise(r => setTimeout(r, CONFIG.checkIntervalMs));
    
    const result = getWhatsAppMessages();
    if (result.error) {
      console.log('⚠️  Erro:', result.error);
      continue;
    }
    
    const current = result.messages || [];
    const newMsgs = current.filter(m => !lastMessages.has(m));
    
    for (const text of newMsgs) {
      lastMessages.add(text);
      
      // Filtra lixo do UI
      if (text.match(/^(WhatsApp|Search|Menu|Back|Attach|Camera|Mic|Type a message)$/i)) continue;
      if (text.length < 3) continue;
      
      const task = extractTasks(text);
      const mentions = detectMentions(text);
      
      console.log('');
      console.log(`💬 ${text.substring(0, 120)}`);
      if (task) console.log('   🎯 Tarefa:', task);
      if (mentions.length) console.log('   👥 Menções:', mentions.join(', '));

      await sendToDashboard({
        text,
        from: 'whatsapp-desktop',
        time: nowISO(),
        group: CONFIG.groupName,
        task,
        mentions,
        source: 'whatsapp-desktop-agent',
      });
    }
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });
}

module.exports = { extractTasks, detectMentions, getWhatsAppMessages };
