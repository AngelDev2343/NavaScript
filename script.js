const EXAMPLE_CODE = `SHAREEE "=========================================="
SHAREEE "NAVASCRIPT - Ejemplo Completo"
SHAREEE "=========================================="

Rawr --- Variables ---
lobo aparece x = 10
lobo aparece y = 5
SHAREEE "Valores iniciales: x=" + x + " y=" + y

Rawr --- Función básica ---
Gii Huu sumar(a, b) {
  NOOOO MORE a + b
}
SHAREEE "Suma de x+y = " + sumar(x, y)

Rawr --- Condicional con sino si / sino ---
si x > y {
  SHAREEE "x es mayor que y"
} sino si x == y {
  SHAREEE "son iguales"
} sino {
  SHAREEE "y es mayor que x"
}

Rawr --- Bucle para ---
lobo aparece suma = 0
para i = 1 hasta 5 {
  suma = suma + i
}
SHAREEE "Suma del 1 al 5: " + suma

Rawr --- SHAREEE con decimales ---
lobo aparece pi = 3.14159265358979
SHAREEE pi con 2 decimales
`;

class NavascriptInterpreter {
  constructor(output, inputFn) {
    this.output = output;
    this.inputFn = inputFn;
    this.vars = {};
    this.funcs = {};
    this.callDepth = 0;
    this.MAX_DEPTH = 200;
    this.MAX_ITER = 100000;
    this.iterCount = 0;
  }

  log(msg, type = 'text') { this.output(String(msg), type); }

  tokenizeLines(code) {
    return code.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  }

  async runrun(code) {
    const lines = this.tokenizeLines(code).map(l => l.trim()).filter(l => l.length > 0);
    this.preScanFunctions(lines);
    await this.executeLines(lines, 0, this.vars);
  }

  preScanFunctions(lines) {
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('Rawr')) { i++; continue; }
      if (line.startsWith('Gii Huu ')) {
        const { body, end } = this.extractBlock(lines, i);
        const header = line.slice(8).trim();
        const match = header.match(/^(\w+)\s*\(([^)]*)\)/);
        if (match) {
          const fname = match[1];
          const params = match[2].split(',').map(p => p.trim()).filter(p => p);
          this.funcs[fname] = { params, body };
        }
        i = end + 1;
      } else { i++; }
    }
  }

  // Cuenta { y } fuera de strings, char por char, y retorna ambos por separado.
  _countBraces(line) {
    let opens = 0, closes = 0, inStr = false, strChar = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) { if (c === strChar) inStr = false; }
      else {
        if (c === '"' || c === "'") { inStr = true; strChar = c; }
        else if (c === '{') opens++;
        else if (c === '}') closes++;
      }
    }
    return { opens, closes };
  }

  // Versión que procesa carácter a carácter y retorna el depth
  // al primer momento que baja a 0, para detectar cierre prematuro.
  // Retorna: { closesFirst: bool } — si el primer } baja depth a 0 antes que cualquier {
  _closesBeforeOpens(line, depth) {
    let d = depth;
    let inStr = false, strChar = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) { if (c === strChar) inStr = false; continue; }
      if (c === '"' || c === "'") { inStr = true; strChar = c; continue; }
      if (c === '}') {
        d--;
        if (d <= 0) return true; // cierra antes de cualquier {
      } else if (c === '{') {
        d++;
      }
    }
    return false;
  }

  // extractBlock: retorna body y end.
  // end = índice de la línea que cierra el bloque (NO incluida en body).
  // Clave: si una línea cierra depth a 0 con un } ANTES de abrir con {,
  // esa línea es el cierre aunque también tenga un { después (caso "} sino si ... {").
  extractBlock(lines, startIdx) {
    let i = startIdx;
    let depth = 0;
    const body = [];
    let foundOpen = false;

    while (i < lines.length) {
      const l = lines[i];

      if (!foundOpen) {
        if (l.includes('{')) {
          foundOpen = true;
          const openIdx = l.indexOf('{');
          depth = 1;
          const after = l.slice(openIdx + 1).trim();
          if (after) {
            // ¿El after cierra el bloque en la misma línea?
            if (this._closesBeforeOpens(after, depth)) {
              return { body, end: i };
            }
            const { opens, closes } = this._countBraces(after);
            depth += opens - closes;
            if (depth <= 0) return { body, end: i };
            after.split(';').map(s => s.trim()).filter(s => s).forEach(sl => body.push(sl));
          }
          i++; continue;
        }
        i++; continue;
      }

      // Dentro del bloque: ¿esta línea cierra depth a 0 con un } ANTES de cualquier {?
      if (this._closesBeforeOpens(l, depth)) {
        // Esta línea cierra el bloque. No va al body.
        return { body, end: i };
      }

      const { opens, closes } = this._countBraces(l);
      const newDepth = depth + opens - closes;
      if (newDepth <= 0) {
        return { body, end: i };
      }
      depth = newDepth;
      body.push(l);
      i++;
    }
    return { body, end: i - 1 };
  }

  async executeLines(lines, startIdx, scope) {
    let i = startIdx;
    while (i < lines.length) {
      const line = lines[i];
      if (!line || line.startsWith('Rawr')) { i++; continue; }
      if (line.startsWith('Gii Huu ')) {
        const { end } = this.extractBlock(lines, i);
        i = end + 1; continue;
      }
      const result = await this.executeLine(line, lines, i, scope);
      if (result && result.type === 'return') return result;
      if (result && result.skip !== undefined) { i = result.skip; continue; }
      i++;
    }
  }

  setVar(name, value, scope) {
    if (scope !== this.vars && Object.prototype.hasOwnProperty.call(scope, name)) {
      scope[name] = value;
    } else if (Object.prototype.hasOwnProperty.call(this.vars, name)) {
      this.vars[name] = value;
    } else {
      scope[name] = value;
    }
  }

  getVar(name, scope) {
    if (scope[name] !== undefined) return scope[name];
    if (this.vars[name] !== undefined) return this.vars[name];
    return undefined;
  }

  async executeLine(line, lines, idx, scope) {
    this.iterCount++;
    if (this.iterCount > this.MAX_ITER)
      throw new Error('Límite de iteraciones alcanzado. ¿Hay un bucle infinito?');

    if (line.startsWith('Rawr')) return null;

    if (line.startsWith('lobo aparece ')) {
      const rest = line.slice(13).trim();
      const eqIdx = rest.indexOf('=');
      if (eqIdx === -1) throw new Error(`Sintaxis inválida: ${line}`);
      const varName = rest.slice(0, eqIdx).trim();
      scope[varName] = await this.evalExprAsync(rest.slice(eqIdx + 1).trim(), scope);
      return null;
    }

    if (line.startsWith('SHAREEE ')) {
      const rest = line.slice(8).trim();
      const decMatch = rest.match(/^(.+?)\s+con\s+(\d+)\s+decimales$/);
      if (decMatch) {
        const num = parseFloat(await this.evalExprAsync(decMatch[1].trim(), scope));
        if (isNaN(num)) throw new Error(`'con decimales' requiere un número`);
        this.log(num.toFixed(parseInt(decMatch[2])));
      } else {
        this.log(await this.evalExprAsync(rest, scope));
      }
      return null;
    }

    if (line.startsWith('NOOOO MORE ')) {
      return { type: 'return', value: await this.evalExprAsync(line.slice(11).trim(), scope) };
    }

    if (line.startsWith('Zap ')) {
      const vname = line.slice(4).trim();
      const cur = this.getVar(vname, scope);
      if (cur === undefined) throw new Error(`Variable no existe: "${vname}"`);
      if (typeof cur !== 'number') throw new Error(`Zap solo funciona con números. "${vname}" es ${typeof cur} (valor: "${cur}")`);
      this.setVar(vname, cur + 1, scope); return null;
    }

    if (line.startsWith('Boom ')) {
      const vname = line.slice(5).trim();
      const cur = this.getVar(vname, scope);
      if (cur === undefined) throw new Error(`Variable no existe: "${vname}"`);
      if (typeof cur !== 'number') throw new Error(`Boom solo funciona con números. "${vname}" es ${typeof cur} (valor: "${cur}")`);
      this.setVar(vname, cur - 1, scope); return null;
    }

    if (line.startsWith('si ') || line === 'si{') {
      return await this.executeIf(line, lines, idx, scope);
    }

    if (line.startsWith('para ')) {
      const match = line.match(/^para\s+(\w+)\s*=\s*(.+?)\s+hasta\s+(.+?)\s*\{?$/);
      if (!match) throw new Error(`Sintaxis para: ${line}\nEjemplo: para i = 0 hasta 10 { }`);
      const varName = match[1];
      const startVal = Number(await this.evalExprAsync(match[2].trim(), scope));
      const endVal   = Number(await this.evalExprAsync(match[3].replace(/\{$/, '').trim(), scope));
      const { body, end } = this.extractBlock(lines, idx);
      let lc = 0;
      for (let v = startVal; v <= endVal; v++) {
        if (++lc > 10000) throw new Error(`Bucle 'para' demasiado largo`);
        scope[varName] = v;
        const r = await this.executeLines(body, 0, scope);
        if (r && r.type === 'return') return r;
      }
      return { skip: end + 1 };
    }

    if (line.startsWith('mientras ')) {
      const m = line.match(/^mientras\s+(.+?)\s*\{?$/);
      if (!m) throw new Error(`Sintaxis mientras: ${line}`);
      const cond = m[1].replace(/\{$/, '').trim();
      const { body, end } = this.extractBlock(lines, idx);
      let lc = 0;
      while (await this.evalCondition(cond, scope)) {
        if (++lc > 10000) throw new Error('Bucle mientras demasiado largo. ¿Es infinito?');
        const r = await this.executeLines(body, 0, scope);
        if (r && r.type === 'return') return r;
      }
      return { skip: end + 1 };
    }

    if (line.startsWith('Grr ')) {
      const m = line.match(/^Grr\s+(.+?)\s*\{?$/);
      if (!m) throw new Error(`Sintaxis Grr: ${line}`);
      const cond = m[1].replace(/\{$/, '').trim();
      const { body, end } = this.extractBlock(lines, idx);
      let lc = 0;
      while (!(await this.evalCondition(cond, scope))) {
        if (++lc > 10000) throw new Error('Bucle Grr demasiado largo. ¿Es infinito?');
        const r = await this.executeLines(body, 0, scope);
        if (r && r.type === 'return') return r;
      }
      return { skip: end + 1 };
    }

    const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
    if (assignMatch) {
      const expr = assignMatch[2].trim();
      if (expr.startsWith('=')) throw new Error(`¿Quisiste comparar? Usa == para comparar, = para asignar.`);
      this.setVar(assignMatch[1], await this.evalExprAsync(expr, scope), scope);
      return null;
    }

    const callMatch = line.match(/^([a-zA-Z_]\w*)\s*\((.*)?\)$/);
    if (callMatch) {
      await this.callFunction(callMatch[1], callMatch[2] || '', scope);
      return null;
    }

    throw new Error(`Instrucción desconocida: "${line}"`);
  }

  // executeIf con la nueva lógica de extractBlock:
  // lines[end] = línea de cierre del bloque (p.ej. "} sino si x == y {")
  async executeIf(line, lines, idx, scope) {
    const condMatch = line.match(/^si\s+(.+?)\s*\{?$/);
    if (!condMatch) throw new Error(`Sintaxis si: ${line}`);
    const cond = condMatch[1].replace(/\{$/, '').trim();

    const { body: ifBody, end: ifEnd } = this.extractBlock(lines, idx);
    const branches = [{ cond, body: ifBody }];
    let curEnd = ifEnd;

    while (true) {
      const cl = (lines[curEnd] || '').trim();

      // "} sino si condicion {" o "} sino si condicion"
      const elseIfMatch = cl.match(/^\}\s*sino\s+si\s+(.+?)(\s*\{)?\s*$/);
      if (elseIfMatch) {
        const elseIfCond = elseIfMatch[1].trim().replace(/\{$/, '').trim();
        const { body: eib, end: eiEnd } = this.extractBlock(lines, curEnd);
        branches.push({ cond: elseIfCond, body: eib });
        curEnd = eiEnd;
        continue;
      }

      // "} sino {" o "} sino"
      const elseMatch = cl.match(/^\}\s*sino\s*(\{)?\s*$/);
      if (elseMatch) {
        const { body: eb, end: elEnd } = this.extractBlock(lines, curEnd);
        branches.push({ cond: null, body: eb });
        curEnd = elEnd;
        break;
      }

      break;
    }

    for (const branch of branches) {
      if (branch.cond === null || await this.evalCondition(branch.cond, scope)) {
        const r = await this.executeLines(branch.body, 0, scope);
        if (r && r.type === 'return') return r;
        break;
      }
    }

    return { skip: curEnd + 1 };
  }

  async evalCondition(cond, scope) {
    const processed = this.processComplexExpr(cond, scope);
    try {
      return !!Function('"use strict"; return (' + processed + ')')();
    } catch(e) {
      throw new Error(`Condición inválida: "${cond}"`);
    }
  }

  async evalExprAsync(expr, scope) {
    if (!expr && expr !== 0) return '';
    expr = expr.trim();
    if ((expr.startsWith('"') && expr.endsWith('"')) ||
        (expr.startsWith("'") && expr.endsWith("'"))) return expr.slice(1, -1);
    if (!isNaN(expr) && expr !== '') return Number(expr);
    if (expr === 'verdad' || expr === 'true') return true;
    if (expr === 'falso' || expr === 'false') return false;

    if (expr.startsWith('PREGUNTA')) {
      const rawPrompt = expr.slice(8).trim();
      const prompt = rawPrompt ? await this.evalExprAsync(rawPrompt, scope) : '';
      const answer = await this.inputFn(String(prompt));
      if (!isNaN(answer) && String(answer).trim() !== '') return Number(answer);
      return answer;
    }

    const funcCallMatch = expr.match(/^([a-zA-Z_]\w*)\s*\(([^)]*)\)$/);
    if (funcCallMatch && this.funcs[funcCallMatch[1]])
      return await this.callFunction(funcCallMatch[1], funcCallMatch[2], scope);

    if (/^[a-zA-Z_]\w*$/.test(expr)) {
      const val = this.getVar(expr, scope);
      if (val !== undefined) return val;
      throw new Error(`Variable no definida: "${expr}"`);
    }

    const processed = this.processComplexExpr(expr, scope);
    try {
      return Function('"use strict"; return (' + processed + ')')();
    } catch(e) {
      throw new Error(`Expresión inválida: "${expr}"`);
    }
  }

  processComplexExpr(expr, scope) {
    let result = '', i = 0;
    while (i < expr.length) {
      if (expr[i] === '"' || expr[i] === "'") {
        const q = expr[i]; let s = q; i++;
        while (i < expr.length && expr[i] !== q) { s += expr[i]; i++; }
        s += q; i++;
        result += s; continue;
      }
      if (/[a-zA-Z_]/.test(expr[i])) {
        let ident = '';
        while (i < expr.length && /\w/.test(expr[i])) { ident += expr[i]; i++; }
        let ws = '';
        while (i < expr.length && expr[i] === ' ') { ws += expr[i]; i++; }
        if (i < expr.length && expr[i] === '(') {
          let d2 = 0, args = '';
          while (i < expr.length) {
            if (expr[i] === '(') d2++;
            else if (expr[i] === ')') { d2--; if (d2 === 0) { args += ')'; i++; break; } }
            args += expr[i]; i++;
          }
          const val = this.evalExprSync(ident + args, scope);
          result += JSON.stringify(val) + ws; continue;
        }
        if (ident === 'verdad') { result += 'true' + ws; continue; }
        if (ident === 'falso')  { result += 'false' + ws; continue; }
        const val = this.getVar(ident, scope);
        result += (val !== undefined ? JSON.stringify(val) : ident) + ws;
        continue;
      }
      result += expr[i]; i++;
    }
    return result;
  }

  evalExprSync(expr, scope) {
    expr = expr.trim();
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) return expr.slice(1, -1);
    if (!isNaN(expr) && expr !== '') return Number(expr);
    if (expr === 'verdad' || expr === 'true') return true;
    if (expr === 'falso' || expr === 'false') return false;
    const funcCallMatch = expr.match(/^([a-zA-Z_]\w*)\s*\(([^)]*)\)$/);
    if (funcCallMatch && this.funcs[funcCallMatch[1]])
      return this.callFunctionSync(funcCallMatch[1], funcCallMatch[2], scope);
    const val = this.getVar(expr, scope);
    if (val !== undefined) return val;
    const processed = this.processComplexExpr(expr, scope);
    return Function('"use strict"; return (' + processed + ')')();
  }

  callFunctionSync(fname, argsStr, scope) {
    if (this.callDepth > this.MAX_DEPTH) throw new Error(`Recursión máxima en: ${fname}`);
    const fn = this.funcs[fname];
    if (!fn) throw new Error(`Función no definida: "${fname}"`);
    const argVals = argsStr.trim() ? this.splitArgs(argsStr).map(a => this.evalExprSync(a.trim(), scope)) : [];
    const localScope = Object.assign({}, this.vars, scope !== this.vars ? scope : {});
    fn.params.forEach((p, idx) => { localScope[p] = argVals[idx] !== undefined ? argVals[idx] : 0; });
    this.callDepth++;
    const result = this.executeLinesSync(fn.body, 0, localScope);
    this.callDepth--;
    Object.keys(this.vars).forEach(k => { if (localScope[k] !== undefined) this.vars[k] = localScope[k]; });
    if (result && result.type === 'return') return result.value;
    return null;
  }

  executeLinesSync(lines, startIdx, scope) {
    let i = startIdx;
    while (i < lines.length) {
      const line = lines[i];
      if (!line || line.startsWith('Rawr')) { i++; continue; }
      if (line.startsWith('Gii Huu ')) { const { end } = this.extractBlock(lines, i); i = end + 1; continue; }
      if (line.startsWith('NOOOO MORE '))
        return { type: 'return', value: this.evalExprSync(line.slice(11).trim(), scope) };
      if (line.startsWith('SHAREEE ')) { this.log(this.evalExprSync(line.slice(8).trim(), scope)); i++; continue; }
      const am = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
      if (am) { this.setVar(am[1], this.evalExprSync(am[2].trim(), scope), scope); i++; continue; }
      i++;
    }
  }

  async callFunction(fname, argsStr, scope) {
    if (this.callDepth > this.MAX_DEPTH) throw new Error(`Recursión máxima en: ${fname}`);
    const fn = this.funcs[fname];
    if (!fn) throw new Error(`Función no definida: "${fname}"`);
    const argVals = argsStr.trim()
      ? await Promise.all(this.splitArgs(argsStr).map(a => this.evalExprAsync(a.trim(), scope))) : [];
    const localScope = Object.assign({}, this.vars, scope !== this.vars ? scope : {});
    fn.params.forEach((p, idx) => { localScope[p] = argVals[idx] !== undefined ? argVals[idx] : 0; });
    this.callDepth++;
    const result = await this.executeLines(fn.body, 0, localScope);
    this.callDepth--;
    Object.keys(this.vars).forEach(k => { if (localScope[k] !== undefined) this.vars[k] = localScope[k]; });
    if (result && result.type === 'return') return result.value;
    return null;
  }

  splitArgs(argsStr) {
    const args = []; let d = 0, cur = '';
    for (const ch of argsStr) {
      if (ch === '(') d++;
      if (ch === ')') d--;
      if (ch === ',' && d === 0) { args.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) args.push(cur);
    return args;
  }
}

// ---- UI ----
let isRunning = false;
let pendingInputResolve = null;

function runCode() {
  if (isRunning) return;
  const code = document.getElementById('code-editor').value;
  const outputArea = document.getElementById('output-area');
  outputArea.innerHTML = '';
  isRunning = true;
  const runBtn = document.getElementById('run-btn');
  runBtn.textContent = 'Ejecutando...';
  runBtn.disabled = true;
  const statusBar = document.getElementById('status-bar');
  statusBar.textContent = 'Procesando...';
  const startTime = Date.now();

  async function askInput(prompt) {
    return new Promise(resolve => { pendingInputResolve = resolve; showInputPrompt(prompt); });
  }

  addOutputLine('NavaScript — Inicio de ejecución', 'system');
  const interp = new NavascriptInterpreter(
    (msg, type) => addOutputLine(msg, type || 'text'), askInput
  );

  interp.runrun(code).then(() => {
    const elapsed = Date.now() - startTime;
    document.getElementById('exec-time').textContent = `${elapsed}ms`;
    addOutputLine(`Ejecución terminada (${elapsed}ms)`, 'system');
    statusBar.textContent = `Listo (${elapsed}ms)`;
  }).catch(e => {
    addOutputLine('ERROR: ' + e.message, 'error');
    statusBar.textContent = 'Error en ejecución';
  }).finally(() => {
    isRunning = false;
    runBtn.textContent = 'RUNRUN';
    runBtn.disabled = false;
    hideInputPrompt();
  });
}

function showInputPrompt(promptText) {
  const area = document.getElementById('output-area');
  const empty = area.querySelector('.output-empty');
  if (empty) empty.remove();
  const container = document.createElement('div');
  container.className = 'input-prompt-container';
  container.id = 'input-prompt';
  const label = document.createElement('div');
  label.className = 'input-prompt-label';
  label.textContent = promptText ? `› ${promptText}` : '› Ingresa un valor:';
  const row = document.createElement('div');
  row.className = 'input-prompt-row';
  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'input-prompt-field';
  inputEl.placeholder = 'Escribe aquí y presiona Enter...';
  inputEl.autocomplete = 'off';
  inputEl.spellcheck = false;
  const btn = document.createElement('button');
  btn.className = 'input-prompt-btn';
  btn.textContent = 'OK';
  function submit() {
    const val = inputEl.value;
    container.remove();
    addOutputLine(`  ← ${val}`, 'info');
    if (pendingInputResolve) { pendingInputResolve(val); pendingInputResolve = null; }
  }
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  btn.addEventListener('click', submit);
  row.appendChild(inputEl); row.appendChild(btn);
  container.appendChild(label); container.appendChild(row);
  area.appendChild(container);
  area.scrollTop = area.scrollHeight;
  setTimeout(() => inputEl.focus(), 50);
}

function hideInputPrompt() {
  const p = document.getElementById('input-prompt');
  if (p) p.remove();
}

function addOutputLine(text, type = 'text') {
  const area = document.getElementById('output-area');
  const empty = area.querySelector('.output-empty');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'output-line';
  const arrow = document.createElement('span');
  arrow.className = 'output-arrow';
  arrow.textContent = '›';
  const textSpan = document.createElement('span');
  textSpan.className = 'output-' + type;
  textSpan.textContent = String(text);
  div.appendChild(arrow); div.appendChild(textSpan);
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function clearOutput() {
  document.getElementById('output-area').innerHTML = '<div class="output-empty">Esperando ejecución...</div>';
  document.getElementById('exec-time').textContent = '';
  document.getElementById('status-bar').textContent = 'Listo';
  hideInputPrompt();
}

function loadExample() {
  document.getElementById('code-editor').value = EXAMPLE_CODE;
  document.getElementById('status-bar').textContent = 'Ejemplo cargado';
}

function loadFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('code-editor').value = e.target.result;
    document.getElementById('filename-input').value = file.name;
    document.getElementById('status-bar').textContent = `Archivo cargado: ${file.name}`;
  };
  reader.readAsText(file);
  event.target.value = '';
}

function downloadFile() {
  const code = document.getElementById('code-editor').value;
  let filename = document.getElementById('filename-input').value.trim() || 'script.ns';
  if (!filename.endsWith('.ns')) filename += '.ns';
  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  document.getElementById('status-bar').textContent = `Descargado: ${filename}`;
}

let sheetOpen = true;
function toggleSheet() {
  const content = document.getElementById('sheet-content');
  const arrow = document.getElementById('sheet-arrow');
  sheetOpen = !sheetOpen;
  content.style.display = sheetOpen ? '' : 'none';
  arrow.textContent = sheetOpen ? '▼' : '▶';
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(); }
});

document.getElementById('code-editor').addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const ta = e.target, start = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + 2;
  }
});