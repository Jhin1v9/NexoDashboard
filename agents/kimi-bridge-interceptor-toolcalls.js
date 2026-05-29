() => {
  // Kimi Bridge Stream Interceptor v2.5 — Tool Call Support
  // Injected via page.addInitScript() in kimi-bridge.cjs
  //
  // FEATURES:
  //   • Accumulates reasoning_content + content (existing)
  //   • Accumulates choice.delta.tool_calls by index (NEW)
  //   • Detects JSON completeness in tool call arguments
  //   • Synthesizes [[action]] tags in Luna format when tool calls complete
  //   • Maps Kimi built-in tools (ipython, web_search, browser, etc.) to Luna tools
  //   • Handles edge cases: index reuse, duplicate index in chunk, legacy function_call

  if (window.__lunaInterceptorInstalled) return;
  window.__lunaInterceptorInstalled = true;

  const MAX_EVENTS = 500;

  // ─────────────────────────────────────────────────────────────
  // GLOBAL STREAM STATE (extended with tool call accumulator)
  // ─────────────────────────────────────────────────────────────
  window.__lunaStream = {
    reasoning: '',       // accumulated reasoning/thinking
    content: '',         // accumulated response text + synthesized [[action]] tags
    events: [],          // circular buffer of parsed chunks
    active: false,       // becomes true on first chat chunk
    startTime: Date.now(),
    error: null,

    // Tool call accumulator: index (string) -> ToolCallState
    // ToolCallState = { id, type, name, args, complete, emitted }
    toolCalls: {},

    // Deduplication guard: list of action tags already injected into content
    emittedActions: [],
  };

  window.__lunaResetStream = function () {
    const s = window.__lunaStream;
    s.reasoning = '';
    s.content = '';
    s.events = [];
    s.active = false;
    s.error = null;
    s.toolCalls = {};
    s.emittedActions = [];
  };

  // ─────────────────────────────────────────────────────────────
  // URL DETECTION
  // ─────────────────────────────────────────────────────────────
  function isChatUrl(url) {
    if (typeof url !== 'string') return false;
    return url.includes('/chat/completions') ||
           url.includes('/api/chat') ||
           url.includes('/api/conversation') ||
           url.includes('/v1/chat') ||
           url.includes('/api/v1/chat') ||
           url.includes('/stream');
  }

  // ─────────────────────────────────────────────────────────────
  // TOOL NAME MAPPING: Kimi / Moonshot built-ins → Luna tools
  // ─────────────────────────────────────────────────────────────
  const KIMI_TO_LUNA_TOOL_MAP = {
    'ipython':           'executeShell',
    'code_runner':       'executeShell',
    'python':            'executeShell',
    'browser':           'executeShell',   // forbidden by system prompt → fallback
    'computer':          'executeShell',   // forbidden by system prompt → fallback
    'web_search':        'searchWeb',
    'web_open_url':      'fetchURL',
    'search_image_by_text': 'searchWeb',
    'search_image_by_image': 'searchWeb',
    'get_data_source_desc': 'executeShell',
    'get_data_source':   'executeShell',
    'memory_space_edits': 'executeShell',
  };

  /**
   * Convert a Kimi tool call (name + JSON args) into a Luna action payload.
   * Returns { tool: string, params: object }
   */
  function mapKimiToolToLuna(name, argsJson) {
    let args = {};
    if (typeof argsJson === 'string' && argsJson.trim()) {
      try { args = JSON.parse(argsJson); } catch { args = { raw: argsJson }; }
    } else if (argsJson && typeof argsJson === 'object') {
      args = argsJson;
    }

    switch (name) {
      case 'ipython':
      case 'code_runner':
      case 'python': {
        const code = args.code || args.input || args.query || args.command || '';
        // Prefer base64 heredoc for multi-line safety, fallback to -c for single line
        const isMulti = code.includes('\n') || code.length > 200;
        let shellCmd;
        if (isMulti) {
          const b64 = btoa(unescape(encodeURIComponent(code)));
          shellCmd = `python3 -c "import base64; exec(base64.b64decode('${b64}').decode('utf-8'))"`;
        } else {
          const safe = code.replace(/'/g, "'\\''");
          shellCmd = `python3 -c '${safe}'`;
        }
        return { tool: 'executeShell', params: { command: shellCmd } };
      }

      case 'browser':
      case 'computer': {
        // v3.3: These are now ALLOWED in Luna. The interceptor synthesizes an
        // executeShell action as fallback. The DOM Mirror will also detect these
        // and route them properly via _handleAction (browser→fetchURL, computer→desktop).
        const action = args.action || args.command || args.url || JSON.stringify(args);
        return { tool: 'executeShell', params: { command: String(action) } };
      }

      case 'web_search':
      case 'search_image_by_text': {
        const query = args.query || args.q || args.search || args.text || '';
        return { tool: 'searchWeb', params: { query: String(query) } };
      }

      case 'web_open_url':
      case 'fetch_url': {
        const url = args.url || args.link || args.href || '';
        return { tool: 'fetchURL', params: { url: String(url) } };
      }

      default: {
        // If the name is already a known Luna tool, pass through 1:1
        const LUNA_TOOLS = new Set([
          'readFile', 'writeFile', 'replaceInFile', 'executeShell', 'searchFiles',
          'grep', 'viewDirectory', 'gitStatus', 'gitCommit', 'searchWeb', 'fetchURL',
          'downloadFile', 'clipboardRead', 'clipboardWrite', 'runTests',
          'checkSyntax', 'installPackages', 'appendFile', 'deleteFile', 'moveFile',
          'copyFile', 'createDirectory', 'removeDirectory', 'applyPatch',
          'getFileInfo', 'listFiles', 'glob', 'think', 'screenshot', 'ocr',
          'shell', 'click', 'doubleClick', 'rightClick', 'type', 'keypress',
          'hotkey', 'scroll', 'open_app', 'wait'
        ]);
        if (LUNA_TOOLS.has(name)) {
          return { tool: name, params: args };
        }
        // Ultimate fallback: wrap as executeShell so it surfaces in the stream
        return {
          tool: 'executeShell',
          params: { command: `${name} ${JSON.stringify(args)}` }
        };
      }
    }
  }

  /**
   * Build the [[action]] tag string for a completed tool call.
   */
  function synthesizeActionTag(name, argsJson) {
    try {
      const mapped = mapKimiToolToLuna(name, argsJson);
      // compact JSON, no extra spaces — matches what Luna parser expects
      return `[[action]]${JSON.stringify(mapped)}[[/action]]`;
    } catch (e) {
      return '';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SSE PARSER (extended with tool_calls + finish_reason)
  // ─────────────────────────────────────────────────────────────
  function parseSseChunk(chunk) {
    const lines = chunk.split('\n');
    const results = [];
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          results.push({ done: true });
          continue;
        }
        currentData = data;
        try {
          const json = JSON.parse(data);
          const choice = json.choices?.[0];

          if (choice?.delta) {
            results.push(extractDelta(choice.delta, choice.finish_reason));
          } else if (choice?.message) {
            // Non-streaming fallback (some proxies return full message)
            results.push(extractMessage(choice.message, choice.finish_reason));
          }
        } catch (e) { /* ignore parse errors — stream may contain interleaved text */ }
      }
    }
    return results;
  }

  function extractDelta(delta, finishReason) {
    const result = {
      reasoning: delta.reasoning_content || delta.reasoning || '',
      content:   (delta.content === null || delta.content === undefined) ? '' : String(delta.content),
      toolCalls: [],
      finishReason: finishReason || null,
    };

    // Modern tool_calls array
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        if (!tc || typeof tc !== 'object') continue;
        mergeToolCallIntoResult(result.toolCalls, tc);
      }
    }

    // Legacy function_call (OpenAI-compat older spec)
    if (delta.function_call && typeof delta.function_call === 'object') {
      result.toolCalls.push({
        index: 0,
        id: delta.function_call.id || null,
        type: 'function',
        function: {
          name: delta.function_call.name || '',
          arguments: delta.function_call.arguments || '',
        }
      });
    }

    return result;
  }

  function extractMessage(msg, finishReason) {
    const result = {
      reasoning: msg.reasoning_content || msg.reasoning || '',
      content:   msg.content || '',
      toolCalls: [],
      finishReason: finishReason || null,
    };

    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (!tc || typeof tc !== 'object') continue;
        result.toolCalls.push({
          index: tc.index ?? 0,
          id: tc.id || null,
          type: tc.type || 'function',
          function: {
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || '',
          }
        });
      }
    }

    if (msg.function_call && typeof msg.function_call === 'object') {
      result.toolCalls.push({
        index: 0,
        id: msg.function_call.id || null,
        type: 'function',
        function: {
          name: msg.function_call.name || '',
          arguments: msg.function_call.arguments || '',
        }
      });
    }

    return result;
  }

  /**
   * Merge a raw tool-call delta into the result array, collapsing duplicates
   * that share the same index within a single SSE chunk.
   * This handles the OpenAI-Python "duplicate index in first chunk" bug.
   */
  function mergeToolCallIntoResult(list, tc) {
    const existing = list.find(x => x.index === tc.index);
    if (existing) {
      if (tc.id) existing.id = tc.id;
      if (tc.type) existing.type = tc.type;
      if (tc.function) {
        if (tc.function.name) existing.function.name = tc.function.name;
        if (tc.function.arguments) existing.function.arguments += tc.function.arguments;
      }
    } else {
      list.push({
        index: tc.index,
        id: tc.id || null,
        type: tc.type || 'function',
        function: {
          name: tc.function?.name || '',
          arguments: tc.function?.arguments || '',
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TOOL CALL ACCUMULATOR + SYNTHESIS
  // ─────────────────────────────────────────────────────────────
  function tryParseJson(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  /**
   * Process a batch of parsed SSE results, updating the global stream state.
   */
  function accumulate(results) {
    if (!results || !results.length) return;
    const stream = window.__lunaStream;
    stream.active = true;

    for (const r of results) {
      if (r.done) continue;

      // 1. Text / reasoning deltas
      if (r.reasoning) stream.reasoning += r.reasoning;
      if (r.content)   stream.content   += r.content;

      // 2. Tool call deltas
      if (r.toolCalls && r.toolCalls.length > 0) {
        for (const tc of r.toolCalls) {
          processToolCallDelta(stream, tc);
        }
      }

      // 3. On finish_reason === 'tool_calls', force-emit anything pending
      if (r.finishReason === 'tool_calls' || r.finishReason === 'function_call') {
        flushPendingToolCalls(stream);
      }

      // 4. Circular event buffer
      stream.events.push(r);
      if (stream.events.length > MAX_EVENTS) {
        stream.events = stream.events.slice(-MAX_EVENTS);
      }
    }
  }

  /**
   * Accumulate a single tool-call delta into the per-index accumulator.
   * Emits a synthesized [[action]] tag as soon as the arguments form valid JSON.
   */
  function processToolCallDelta(stream, tc) {
    const idx = String(tc.index);
    const existing = stream.toolCalls[idx];

    // Edge case: index reuse (Ollama & some proxies recycle index 0 for
    // parallel calls). If we see a *new non-empty id* at an index that
    // already has a completed/emitted call, relocate to a synthetic index.
    if (existing && existing.emitted && tc.id && tc.id !== existing.id) {
      let synth = parseInt(idx, 10) + 1000;
      while (stream.toolCalls[String(synth)]) synth++;
      stream.toolCalls[String(synth)] = {
        id: tc.id,
        type: tc.type || 'function',
        name: tc.function?.name || '',
        args: tc.function?.arguments || '',
        complete: false,
        emitted: false,
      };
      return;
    }

    if (!existing) {
      stream.toolCalls[idx] = {
        id: tc.id || null,
        type: tc.type || 'function',
        name: tc.function?.name || '',
        args: tc.function?.arguments || '',
        complete: false,
        emitted: false,
      };
    } else {
      // Accumulate fields (strings append, IDs replace)
      if (tc.id) existing.id = tc.id;
      if (tc.type) existing.type = tc.type;
      if (tc.function?.name) existing.name = tc.function.name;
      if (tc.function?.arguments) existing.args += tc.function.arguments;
    }

    tryEmitCompletedToolCall(stream, idx);
  }

  /**
   * If the tool call at `idx` has a name and its arguments are valid JSON,
   * synthesize the Luna [[action]] tag and append it to stream.content.
   */
  function tryEmitCompletedToolCall(stream, idx) {
    const tc = stream.toolCalls[idx];
    if (!tc || tc.emitted || !tc.name) return;

    // Empty arguments is valid for some tools (e.g. no-arg functions).
    // For non-empty args, require well-formed JSON before emitting.
    let argsValid = false;
    if (!tc.args || tc.args.trim() === '') {
      argsValid = true;
    } else {
      argsValid = tryParseJson(tc.args) !== null;
    }

    if (argsValid) {
      tc.complete = true;
      const tag = synthesizeActionTag(tc.name, tc.args || '{}');
      if (tag && !stream.emittedActions.includes(tag)) {
        stream.emittedActions.push(tag);
        stream.content += tag;
      }
      tc.emitted = true;
    }
  }

  /**
   * Force-emit all non-emitted tool calls when the stream signals completion
   * via finish_reason === 'tool_calls'. This catches edge cases where the
   * final argument chunk produces malformed JSON or arrives after finish.
   */
  function flushPendingToolCalls(stream) {
    for (const idx of Object.keys(stream.toolCalls)) {
      const tc = stream.toolCalls[idx];
      if (tc.emitted || !tc.name) continue;
      tc.complete = true;
      const tag = synthesizeActionTag(tc.name, tc.args || '{}');
      if (tag && !stream.emittedActions.includes(tag)) {
        stream.emittedActions.push(tag);
        stream.content += tag;
      }
      tc.emitted = true;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FETCH INTERCEPTOR
  // ─────────────────────────────────────────────────────────────
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = args[0]?.url || args[0];
    const isChat = isChatUrl(url);
    if (!isChat) return origFetch.apply(this, args);

    window.__lunaStream.active = true;
    const response = await origFetch.apply(this, args);

    try {
      const cloned = response.clone();
      const reader = cloned.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line
        const chunk = lines.join('\n');
        if (chunk) {
          const results = parseSseChunk(chunk);
          accumulate(results);
        }
      }
      if (buffer) {
        const results = parseSseChunk(buffer);
        accumulate(results);
      }
    } catch (e) {
      window.__lunaStream.error = e.message;
    }
    return response;
  };

  // ─────────────────────────────────────────────────────────────
  // XMLHttpRequest INTERCEPTOR
  // ─────────────────────────────────────────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._lunaIsChat = isChatUrl(url);
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (this._lunaIsChat) {
      window.__lunaStream.active = true;
      const origOnReady = this.onreadystatechange;
      this.onreadystatechange = function () {
        if (this.readyState >= 3 && this.responseText) {
          const newText = this.responseText.slice(this._lunaLastLen || 0);
          this._lunaLastLen = this.responseText.length;
          const results = parseSseChunk(newText);
          accumulate(results);
        }
        if (origOnReady) origOnReady.apply(this, arguments);
      };
    }
    return origSend.apply(this, args);
  };

  // ─────────────────────────────────────────────────────────────
  // EventSource INTERCEPTOR
  // ─────────────────────────────────────────────────────────────
  const origEventSource = window.EventSource;
  if (origEventSource) {
    window.EventSource = function (url, options) {
      const es = new origEventSource(url, options);
      if (isChatUrl(url)) {
        window.__lunaStream.active = true;
        es.addEventListener('message', (event) => {
          const results = parseSseChunk(event.data);
          accumulate(results);
        });
      }
      return es;
    };
    Object.setPrototypeOf(window.EventSource, origEventSource);
    window.EventSource.prototype = origEventSource.prototype;
  }

  // ─────────────────────────────────────────────────────────────
  // WebSocket INTERCEPTOR
  // ─────────────────────────────────────────────────────────────
  const origWebSocket = window.WebSocket;
  if (origWebSocket) {
    window.WebSocket = function (url, protocols) {
      const ws = new origWebSocket(url, protocols);
      ws._lunaIsChat = isChatUrl(url) || /chat|stream|completion/i.test(url);

      ws.addEventListener('message', (event) => {
        if (!ws._lunaIsChat) return;
        window.__lunaStream.active = true;

        let data = event.data;
        if (typeof data !== 'string') return;

        // Some WebSocket transports wrap SSE-style lines; others send raw JSON.
        const lines = data.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Strip optional SSE prefix
          const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
          if (payload === '[DONE]') continue;

          try {
            const json = JSON.parse(payload);
            // Try multiple shapes (OpenAI-compat, Anthropic-like, plain)
            const choices = json.choices || json.messages || json.data;
            if (Array.isArray(choices)) {
              for (const choice of choices) {
                if (choice?.delta) {
                  accumulate([extractDelta(choice.delta, choice.finish_reason)]);
                } else if (choice?.message) {
                  accumulate([extractMessage(choice.message, choice.finish_reason)]);
                } else if (choice?.content || choice?.text || choice?.reasoning_content) {
                  accumulate([{
                    reasoning: choice.reasoning_content || choice.reasoning || '',
                    content: choice.content || choice.text || '',
                    toolCalls: [],
                    finishReason: choice.finish_reason || null,
                  }]);
                }
              }
            } else if (json.reasoning_content || json.content || json.text || json.tool_calls) {
              // Flat object that looks like a delta itself
              accumulate([extractDelta(json, json.finish_reason)]);
            } else {
              // Unknown JSON — treat as plain content
              accumulate([{ content: payload, toolCalls: [], finishReason: null }]);
            }
          } catch (e) {
            // Not JSON — plain text stream
            accumulate([{ content: payload, toolCalls: [], finishReason: null }]);
          }
        }
      });
      return ws;
    };
    Object.setPrototypeOf(window.WebSocket, origWebSocket);
    window.WebSocket.prototype = origWebSocket.prototype;
  }
};
