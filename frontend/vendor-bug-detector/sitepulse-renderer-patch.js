/**
 * SitePulse Renderer Patch
 *
 * Adicione este bloco no final do arquivo:
 *   companion/src/renderer.js
 *
 * Ele escuta reports do Bug Detector, enriquece com análise de IA
 * (Gemini → Kimi fallback) e injeta no contexto do assistant.
 */

(function attachBugDetectorBridge() {
  if (window.bugDetectorBridge) {
    window.bugDetectorBridge.onMessage((data) => {
      if (data.type === "report-created") {
        handleBugDetectorReport(data.payload);
      }
    });
  }

  async function handleBugDetectorReport(report) {
    // 1. Envia para o Cloud (se ainda não foi enviado pelo widget)
    try {
      await fetch("http://localhost:3456/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
    } catch (e) {
      console.warn("[BugDetectorBridge] Cloud não respondeu:", e);
    }

    // 2. Análise de IA via Gemini (ou Kimi fallback)
    //    Nota: em produção, mova esta chamada para o backend do SitePulse
    //    para não expor API keys no renderer.
    let aiAnalysis = null;
    try {
      aiAnalysis = await analyzeWithGemini(report);
    } catch (geminiErr) {
      console.warn("[BugDetectorBridge] Gemini falhou, tentando Kimi...", geminiErr);
      try {
        aiAnalysis = await analyzeWithKimi(report);
      } catch (kimiErr) {
        console.error("[BugDetectorBridge] Ambos os providers falharam:", kimiErr);
      }
    }

    // 3. Injeta no appContext para o assistant
    const bdContext = {
      reportId: report.id,
      description: report.description,
      url: report.url,
      elementSelector: report.element?.selector || "",
      severity: report.severity,
      aiProvider: aiAnalysis?.provider || "none",
      aiConfidence: aiAnalysis?.confidence || 0,
      rootCause: aiAnalysis?.rootCause || "",
      solution: aiAnalysis?.solution || "",
      recommendations: aiAnalysis?.recommendations || [],
      fixCode: aiAnalysis?.codeFix?.codigoCorrigido || "",
      fixLanguage: aiAnalysis?.codeFix?.linguagem || "",
      consoleLogCount: report.consoleLogs?.length || 0,
      networkRequestCount: report.networkRequests?.length || 0,
      hasScreenshot: !!report.screenshot,
      hasVideo: !!report.video,
    };

    // Supondo que uiState ou appContext esteja acessível globalmente
    if (typeof uiState !== "undefined") {
      uiState.bugDetector = bdContext;
    }
    if (typeof appContext !== "undefined") {
      appContext.bugDetector = bdContext;
    }

    // 4. Notifica visualmente o usuário
    if (typeof showToast === "function") {
      showToast("Bug reportado e analisado pela IA. Pergunte ao assistente sobre ele.");
    }

    console.log("[BugDetectorBridge] Report processado:", bdContext);
  }

  async function analyzeWithGemini(report) {
    const apiKey = localStorage.getItem("sitepulse_gemini_key") || "";
    if (!apiKey) throw new Error("Gemini API key não configurada");

    const prompt = buildAnalysisPrompt(report);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      }
    );

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return parseAnalysisResponse(text, "gemini");
  }

  async function analyzeWithKimi(report) {
    const apiKey = localStorage.getItem("sitepulse_kimi_key") || "";
    if (!apiKey) throw new Error("Kimi API key não configurada");

    const prompt = buildAnalysisPrompt(report);
    const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "moonshot-v1-8k",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    return parseAnalysisResponse(text, "kimi");
  }

  function buildAnalysisPrompt(report) {
    const logs = report.consoleLogs?.map((l) => `[${l.type}] ${l.message}`).join("\n") || "Nenhum";
    const network = report.networkRequests?.map((r) => `${r.method} ${r.url} → ${r.status}`).join("\n") || "Nenhuma";

    return `Você é um engenheiro sênior de debug. Analise o bug abaixo e retorne APENAS um JSON válido.

BUG:
- Descrição: ${report.description}
- URL: ${report.url}
- Elemento: ${report.element?.tag} (${report.element?.selector})
- Severidade: ${report.severity}

CONSOLE LOGS:
${logs}

NETWORK REQUESTS:
${network}

RETORNE EXATAMENTE ESTE JSON (sem markdown, sem explicações antes ou depois):
{
  "provider": "gemini",
  "severity": "low|medium|high|critical",
  "rootCause": "causa raiz em 1-2 frases",
  "technicalDescription": "descrição técnica detalhada",
  "solution": "solução em texto",
  "recommendations": ["rec 1", "rec 2"],
  "codeFix": {
    "linguagem": "typescript|javascript|css|html",
    "codigoCorrigido": "código corrigido completo",
    "explicacao": "explicação da correção"
  },
  "confidence": 0.95
}`;
  }

  function parseAnalysisResponse(text, provider) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return { ...parsed, provider };
      }
    } catch (e) {
      console.error("[BugDetectorBridge] Falha ao parsear resposta da IA:", e);
    }
    return null;
  }
})();
