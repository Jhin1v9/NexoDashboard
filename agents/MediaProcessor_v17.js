// ============================================================
// MEDIA PROCESSOR v17.0 — Voz e Imagens
// ============================================================

const fs = require('fs');
const path = require('path');

class MediaProcessor {
  constructor() {
    this.supportedAudio = ['audio/ogg; codecs=opus', 'audio/mpeg', 'audio/wav'];
    this.supportedImage = ['image/jpeg', 'image/png', 'image/webp'];
  }

  // Verificar se mensagem tem mídia
  hasMedia(msg) {
    return msg.hasMedia || msg._data?.mimetype || false;
  }

  // Detectar tipo de mídia
  getMediaType(msg) {
    const mimetype = msg._data?.mimetype || '';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    return 'unknown';
  }

  // Processar áudio (voice note)
  async processAudio(msg) {
    try {
      if (!msg.hasMedia) return null;
      
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        console.log('[MEDIA] Áudio vazio ou não disponível');
        return null;
      }

      // Verificar se é mencionado a Luna
      const text = msg.body || '';
      const isMentioned = /@luna|@kimi|@kimiclaw/i.test(text);
      
      if (!isMentioned) {
        console.log('[MEDIA] Áudio sem menção à Luna, ignorando');
        return null;
      }

      // Guardar arquivo temporariamente
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      
      const ext = media.mimetype.includes('ogg') ? 'ogg' : 'mp3';
      const tempFile = path.join(tempDir, `audio_${Date.now()}.${ext}`);
      fs.writeFileSync(tempFile, Buffer.from(media.data, 'base64'));

      // Tentar transcrever via Ollama (se suportar) ou retornar indicativo
      console.log(`[MEDIA] Áudio salvo: ${tempFile} (${media.data.length} bytes)`);
      
      // Por enquanto, retorna que recebeu áudio mas precisa de transcrição manual
      // Futuro: integrar Whisper ou Ollama vision
      return {
        type: 'audio',
        transcript: null,
        tempFile: tempFile,
        duration: msg._data?.duration || 0,
        note: 'Áudio recebido. Transcrição automática será implementada na próxima fase.'
      };
    } catch (e) {
      console.error('[MEDIA] Erro ao processar áudio:', e.message);
      return null;
    }
  }

  // Processar imagem
  async processImage(msg) {
    try {
      if (!msg.hasMedia) return null;
      
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        console.log('[MEDIA] Imagem vazia ou não disponível');
        return null;
      }

      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      
      const ext = media.mimetype.includes('png') ? 'png' : 'jpg';
      const tempFile = path.join(tempDir, `image_${Date.now()}.${ext}`);
      fs.writeFileSync(tempFile, Buffer.from(media.data, 'base64'));

      console.log(`[MEDIA] Imagem salva: ${tempFile} (${media.data.length} bytes)`);

      // Futuro: OCR + análise visual via Ollama vision
      return {
        type: 'image',
        tempFile: tempFile,
        mimetype: media.mimetype,
        note: 'Imagem recebida. Análise visual será implementada na próxima fase.'
      };
    } catch (e) {
      console.error('[MEDIA] Erro ao processar imagem:', e.message);
      return null;
    }
  }

  // Limpar arquivos temporários antigos
  cleanupTempFiles(maxAgeHours = 24) {
    try {
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) return;
      
      const files = fs.readdirSync(tempDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtime.getTime();
        
        if (age > maxAgeHours * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
          console.log(`[MEDIA] Arquivo antigo removido: ${file}`);
        }
      }
    } catch (e) {
      console.error('[MEDIA] Erro ao limpar temp:', e.message);
    }
  }
}

module.exports = { MediaProcessor };
