/**
 * NEXO Agent Brain
 * Agente ReAct (Reasoning + Acting) para automação
 */

const axios = require('axios');

const CONFIG = {
  apiUrl: 'http://127.0.0.1:3456',
  cdpPort: 9222,
  githubUser: 'Jhin1v9',
  vercelUser: 'jhin1v9',
};

class NexoAgent {
  constructor() {
    this.memory = [];
  }

  async perceive() {
    try {
      const state = await axios.get(`${CONFIG.apiUrl}/api/state`);
      return state.data;
    } catch (err) {
      return null;
    }
  }

  async think(state) {
    const actions = [];
    
    if (!state) return actions;
    
    // Verifica health baixo
    for (const client of state.clients) {
      if (client.health < 50) {
        actions.push({
          type: 'alert',
          priority: 'high',
          msg: `Health baixo: ${client.name} (${client.health}%)`
        });
      }
    }
    
    // Verifica tarefas stale
    const staleTasks = state.tasks?.filter(t => {
      if (!t.createdAt || t.completed) return false;
      const days = (Date.now() - new Date(t.createdAt).getTime()) / (1000*60*60*24);
      return days > 14;
    }) || [];
    
    if (staleTasks.length > 0) {
      actions.push({
        type: 'alert',
        priority: 'medium',
        msg: `${staleTasks.length} tarefas stale detectadas`
      });
    }
    
    return actions;
  }

  async act(actions) {
    for (const action of actions) {
      console.log(`[${action.priority.toUpperCase()}] ${action.msg}`);
      this.memory.push({ time: new Date().toISOString(), ...action });
    }
  }

  async run() {
    console.log('🧠 NEXO Agent Brain iniciado');
    const state = await this.perceive();
    const actions = await this.think(state);
    await this.act(actions);
    
    if (actions.length === 0) {
      console.log('   ✅ Tudo OK - nenhuma ação necessária');
    }
  }
}

if (require.main === module) {
  const agent = new NexoAgent();
  agent.run().catch(console.error);
}

module.exports = NexoAgent;
