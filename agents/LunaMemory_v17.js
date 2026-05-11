// ============================================================
// LUNA MEMORY v17.0 — Memória Contextual de Longo Prazo
// SQLite local + embeddings via Ollama
// ============================================================

const fs = require('fs');
const path = require('path');

class LunaMemory {
  constructor() {
    this.dbPath = path.join(__dirname, '../backend/data/luna-memory.db');
    this.init();
  }

  init() {
    try {
      // Usar better-sqlite3 se disponível, senão fallback para JSON
      try {
        const Database = require('better-sqlite3');
        this.db = new Database(this.dbPath);
        this.createTables();
        this.useSQLite = true;
        console.log('[MEMORY] ✅ SQLite ativo');
      } catch (e) {
        console.log('[MEMORY] ⚠️  better-sqlite3 não disponível, usando JSON fallback');
        this.useSQLite = false;
        this.jsonPath = path.join(__dirname, '../backend/data/luna-memory.json');
        this.memory = this.loadJson();
      }
    } catch (e) {
      console.error('[MEMORY] ❌ Erro ao inicializar:', e.message);
      this.useSQLite = false;
      this.memory = { messages: [], ceo_profiles: {}, interactions: {} };
    }
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE,
        author TEXT,
        author_name TEXT,
        body TEXT,
        category TEXT,
        timestamp TEXT,
        chat_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_messages_author ON messages(author);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_category ON messages(category);

      CREATE TABLE IF NOT EXISTS ceo_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE,
        name TEXT,
        preference_style TEXT DEFAULT 'balanced',
        preference_detail TEXT DEFAULT 'medium',
        total_interactions INTEGER DEFAULT 0,
        last_interaction TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ceo_phone TEXT,
        interaction_type TEXT,
        content TEXT,
        timestamp TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_interactions_ceo ON interactions(ceo_phone);
    `);
  }

  loadJson() {
    try {
      if (fs.existsSync(this.jsonPath)) {
        return JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
      }
    } catch (e) {
      console.error('[MEMORY] Erro ao carregar JSON:', e.message);
    }
    return { messages: [], ceo_profiles: {}, interactions: {} };
  }

  saveJson() {
    if (!this.useSQLite) {
      try {
        fs.writeFileSync(this.jsonPath, JSON.stringify(this.memory, null, 2));
      } catch (e) {
        console.error('[MEMORY] Erro ao salvar JSON:', e.message);
      }
    }
  }

  // Guardar mensagem na memória
  storeMessage(msg) {
    try {
      if (this.useSQLite) {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO messages (message_id, author, author_name, body, category, timestamp, chat_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          msg.id || `${msg.from}:${msg.timestamp}`,
          msg.author || msg.from,
          msg.authorName || msg.pushname || 'Desconhecido',
          msg.body || msg.text || '',
          msg.category || 'unknown',
          msg.timestamp || new Date().toISOString(),
          msg.from || ''
        );
      } else {
        this.memory.messages.push({
          id: msg.id || `${msg.from}:${msg.timestamp}`,
          author: msg.author || msg.from,
          authorName: msg.authorName || msg.pushname || 'Desconhecido',
          body: msg.body || msg.text || '',
          category: msg.category || 'unknown',
          timestamp: msg.timestamp || new Date().toISOString(),
          chatId: msg.from || ''
        });
        // Manter só últimas 1000 mensagens no JSON
        if (this.memory.messages.length > 1000) {
          this.memory.messages = this.memory.messages.slice(-1000);
        }
        this.saveJson();
      }
    } catch (e) {
      console.error('[MEMORY] Erro ao guardar mensagem:', e.message);
    }
  }

  // Buscar mensagens por autor
  getMessagesByAuthor(author, limit = 50) {
    try {
      if (this.useSQLite) {
        const stmt = this.db.prepare(`
          SELECT * FROM messages 
          WHERE author = ? OR author_name = ?
          ORDER BY timestamp DESC
          LIMIT ?
        `);
        return stmt.all(author, author, limit);
      } else {
        return this.memory.messages
          .filter(m => m.author === author || m.authorName === author)
          .slice(-limit);
      }
    } catch (e) {
      console.error('[MEMORY] Erro ao buscar mensagens:', e.message);
      return [];
    }
  }

  // Buscar mensagens por conteúdo (busca simples)
  searchMessages(query, limit = 20) {
    try {
      const lowerQuery = query.toLowerCase();
      if (this.useSQLite) {
        const stmt = this.db.prepare(`
          SELECT * FROM messages 
          WHERE body LIKE ?
          ORDER BY timestamp DESC
          LIMIT ?
        `);
        return stmt.all(`%${lowerQuery}%`, limit);
      } else {
        return this.memory.messages
          .filter(m => (m.body || '').toLowerCase().includes(lowerQuery))
          .slice(-limit);
      }
    } catch (e) {
      console.error('[MEMORY] Erro na busca:', e.message);
      return [];
    }
  }

  // Perfil do CEO
  getCeoProfile(phone) {
    try {
      if (this.useSQLite) {
        const stmt = this.db.prepare('SELECT * FROM ceo_profiles WHERE phone = ?');
        return stmt.get(phone);
      } else {
        return this.memory.ceo_profiles[phone] || null;
      }
    } catch (e) {
      return null;
    }
  }

  updateCeoProfile(phone, data) {
    try {
      if (this.useSQLite) {
        const stmt = this.db.prepare(`
          INSERT INTO ceo_profiles (phone, name, preference_style, preference_detail, total_interactions, last_interaction, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(phone) DO UPDATE SET
            name = COALESCE(?, name),
            preference_style = COALESCE(?, preference_style),
            preference_detail = COALESCE(?, preference_detail),
            total_interactions = total_interactions + ?,
            last_interaction = COALESCE(?, last_interaction),
            updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(
          phone,
          data.name,
          data.preference_style,
          data.preference_detail,
          data.interaction_count || 1,
          data.last_interaction,
          // ON CONFLICT params
          data.name,
          data.preference_style,
          data.preference_detail,
          data.interaction_count || 1,
          data.last_interaction
        );
      } else {
        if (!this.memory.ceo_profiles[phone]) {
          this.memory.ceo_profiles[phone] = { name: '', preference_style: 'balanced', preference_detail: 'medium', total_interactions: 0, last_interaction: null };
        }
        const profile = this.memory.ceo_profiles[phone];
        if (data.name) profile.name = data.name;
        if (data.preference_style) profile.preference_style = data.preference_style;
        if (data.preference_detail) profile.preference_detail = data.preference_detail;
        profile.total_interactions += data.interaction_count || 1;
        if (data.last_interaction) profile.last_interaction = data.last_interaction;
        this.saveJson();
      }
    } catch (e) {
      console.error('[MEMORY] Erro ao atualizar perfil:', e.message);
    }
  }

  // Detectar preferências do CEO baseado no histórico
  inferCeoPreferences(phone) {
    const messages = this.getMessagesByAuthor(phone, 100);
    if (messages.length === 0) return { style: 'balanced', detail: 'medium' };

    // Analisar comprimento das mensagens
    const avgLength = messages.reduce((sum, m) => sum + (m.body || '').length, 0) / messages.length;
    
    // Analisar uso de emojis
    const emojiCount = messages.filter(m => /[\u{1F600}-\u{1F64F}]/u.test(m.body || '')).length;
    const emojiRate = emojiCount / messages.length;

    // Analisar perguntas detalhadas
    const detailedQuestions = messages.filter(m => /como|por que|detalhe|espec[íi]fico/i.test(m.body || '')).length;
    const detailRate = detailedQuestions / messages.length;

    return {
      style: emojiRate > 0.3 ? 'friendly' : (avgLength > 100 ? 'formal' : 'balanced'),
      detail: detailRate > 0.2 ? 'high' : (avgLength > 50 ? 'medium' : 'low')
    };
  }

  // Buscar contexto para uma pergunta
  async resolveContext(query, author) {
    // Buscar mensagens relacionadas do autor
    const authorMsgs = this.getMessagesByAuthor(author, 20);
    
    // Buscar mensagens relacionadas ao tema
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const relatedMsgs = [];
    
    for (const keyword of keywords) {
      const found = this.searchMessages(keyword, 10);
      relatedMsgs.push(...found);
    }

    // Remover duplicatas e ordenar por timestamp
    const unique = [...new Map(relatedMsgs.map(m => [m.id || m.message_id, m])).values()];
    unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return unique.slice(0, 10);
  }

  // Estatísticas
  getStats() {
    try {
      if (this.useSQLite) {
        const msgCount = this.db.prepare('SELECT COUNT(*) as count FROM messages').get();
        const ceoCount = this.db.prepare('SELECT COUNT(*) as count FROM ceo_profiles').get();
        return { messages: msgCount.count, ceos: ceoCount.count };
      } else {
        return { messages: this.memory.messages.length, ceos: Object.keys(this.memory.ceo_profiles).length };
      }
    } catch (e) {
      return { messages: 0, ceos: 0 };
    }
  }
}

module.exports = { LunaMemory };
