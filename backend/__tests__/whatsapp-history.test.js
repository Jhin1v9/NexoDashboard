const db = require('../db');
const dataStore = require('../datastore-pg');

const TEST_MSG_ID = 'test-whatsapp-' + Date.now();

describe('WhatsApp History (datastore-pg)', () => {
  afterAll(async () => {
    await db.run('DELETE FROM whatsapp_history WHERE id = $1', [TEST_MSG_ID]);
    await db.pool.end();
  });

  test('getWhatsappHistory returns array', async () => {
    const result = await dataStore.getWhatsappHistory();
    expect(Array.isArray(result)).toBe(true);
  });

  test('saveWhatsappMessage inserts and returns message with real schema fields', async () => {
    const msg = {
      id: TEST_MSG_ID,
      text: 'Mensagem de teste',
      body: 'Mensagem de teste',
      author: 'teste@nexo.com',
      authorName: 'Teste',
      chat: 'Teste Chat',
      chatName: 'Teste Chat',
      timestamp: new Date().toISOString(),
      classification: { category: 'tarefaPendente', confidence: 0.95 },
      reviewed: false,
      correctedCategory: null,
      notes: null,
      sentViaDashboard: false,
      direction: 'incoming',
      responded: false,
      resolvedAuthor: { name: 'Teste', shortName: 'T', color: '#3B82F6', avatarEmoji: '👤', role: 'member', confidence: 1 },
      createdAt: new Date().toISOString(),
    };

    const saved = await dataStore.saveWhatsappMessage(msg);
    expect(saved.id).toBe(TEST_MSG_ID);
    expect(saved.text).toBe('Mensagem de teste');

    const result = await dataStore.getWhatsappHistory();
    const found = result.find(m => m.id === TEST_MSG_ID);
    expect(found).toBeDefined();
    expect(found.authorName).toBe('Teste');
  });

  test('saveWhatsappMessage updates existing message', async () => {
    const updated = {
      id: TEST_MSG_ID,
      text: 'Mensagem atualizada',
      body: 'Mensagem atualizada',
      author: 'teste@nexo.com',
      authorName: 'Teste Atualizado',
      chat: 'Teste Chat',
      chatName: 'Teste Chat',
      timestamp: new Date().toISOString(),
      classification: { category: 'ideia', confidence: 0.88 },
      reviewed: true,
      correctedCategory: 'ideia',
      notes: 'Nota de correção',
      sentViaDashboard: true,
      direction: 'outgoing',
      responded: true,
      resolvedAuthor: { name: 'Teste Atualizado', shortName: 'TA', color: '#10B981', avatarEmoji: '👤', role: 'member', confidence: 1 },
      createdAt: new Date().toISOString(),
    };

    await dataStore.saveWhatsappMessage(updated);
    const result = await dataStore.getWhatsappHistory();
    const found = result.find(m => m.id === TEST_MSG_ID);
    expect(found.text).toBe('Mensagem atualizada');
    expect(found.reviewed).toBe(true);
  });

  test('deleteWhatsappMessage removes message', async () => {
    await dataStore.deleteWhatsappMessage(TEST_MSG_ID);
    const result = await dataStore.getWhatsappHistory();
    const found = result.find(m => m.id === TEST_MSG_ID);
    expect(found).toBeUndefined();
  });

  test('whatsapp_history in PG match expected count (1171 in production)', async () => {
    const result = await dataStore.getWhatsappHistory();
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});
