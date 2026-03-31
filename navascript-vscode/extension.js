const vscode = require('vscode');

// ---- Intérprete NavaScript (Versión Completa para VS Code) ----
class NavascriptInterpreter {
  constructor(outputFunc, inputFn) {
    this.output = outputFunc;
    this.inputFn = inputFn || (() => '');
    this.vars = {};
    this.funcs = {};
    this.callDepth = 0;
    this.MAX_DEPTH = 200;
    this.MAX_ITER = 100000;
    this.iterCount = 0;
  }

  log(msg, type) {
    this.output(String(msg));
  }

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
      } else {
        i++;
      }
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

  // Retorna true si el primer } baja depth a 0 antes que cualquier {
  _closesBeforeOpens(line, depth) {
    let d = depth;
    let inStr = false, strChar = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) { if (c === strChar) inStr = false; continue; }
      if (c === '"' || c === "'") { inStr = true; strChar = c; continue; }
      if (c === '}') {
        d--;
        if (d <= 0) return true;
      } else if (c === '{') {
        d++;
      }
    }
    return false;
  }

  // extractBlock: retorna body y end.
  // end = índice de la línea que cierra el bloque (NO incluida en body).
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

      if (this._closesBeforeOpens(l, depth)) {
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

    // Declaración de variable
    if (line.startsWith('lobo aparece ')) {
      const rest = line.slice(13).trim();
      const eqIdx = rest.indexOf('=');
      if (eqIdx === -1) throw new Error(`Sintaxis inválida: ${line}`);
      const varName = rest.slice(0, eqIdx).trim();
      scope[varName] = await this.evalExprAsync(rest.slice(eqIdx + 1).trim(), scope);
      return null;
    }

    // Salida con soporte de decimales
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

    // Retorno
    if (line.startsWith('NOOOO MORE ')) {
      return { type: 'return', value: await this.evalExprAsync(line.slice(11).trim(), scope) };
    }

    // Incremento
    if (line.startsWith('Zap ')) {
      const vname = line.slice(4).trim();
      const cur = this.getVar(vname, scope);
      if (cur === undefined) throw new Error(`Variable no existe: "${vname}"`);
      if (typeof cur !== 'number') throw new Error(`Zap solo funciona con números. "${vname}" es ${typeof cur} (valor: "${cur}")`);
      this.setVar(vname, cur + 1, scope); return null;
    }

    // Decremento
    if (line.startsWith('Boom ')) {
      const vname = line.slice(5).trim();
      const cur = this.getVar(vname, scope);
      if (cur === undefined) throw new Error(`Variable no existe: "${vname}"`);
      if (typeof cur !== 'number') throw new Error(`Boom solo funciona con números. "${vname}" es ${typeof cur} (valor: "${cur}")`);
      this.setVar(vname, cur - 1, scope); return null;
    }

    // Pausa (síncrona en VS Code)
    if (line.startsWith('Uuh ')) {
      const ms = parseInt(await this.evalExprAsync(line.slice(4).trim(), scope));
      const end = Date.now() + ms;
      while (Date.now() < end) {}
      this.log(`Pausa: ${ms}ms`);
      return null;
    }

    // Condicional si / sino si / sino
    if (line.startsWith('si ') || line === 'si{') {
      return await this.executeIf(line, lines, idx, scope);
    }

    // Bucle para
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

    // Bucle mientras
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

    // Bucle Grr (hasta que)
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

    // Asignación simple
    const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
    if (assignMatch) {
      const expr = assignMatch[2].trim();
      if (expr.startsWith('=')) throw new Error(`¿Quisiste comparar? Usa == para comparar, = para asignar.`);
      this.setVar(assignMatch[1], await this.evalExprAsync(expr, scope), scope);
      return null;
    }

    // Llamada a función huérfana
    const callMatch = line.match(/^([a-zA-Z_]\w*)\s*\((.*)?\)$/);
    if (callMatch) {
      await this.callFunction(callMatch[1], callMatch[2] || '', scope);
      return null;
    }

    throw new Error(`Instrucción desconocida: "${line}"`);
  }

  // executeIf con soporte de sino si encadenado
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

    // Input del usuario (PREGUNTA) - en VS Code usa inputFn si está disponible
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
    try {
      return Function('"use strict"; return (' + processed + ')')();
    } catch(e) {
      throw new Error(`Expresión inválida: "${expr}"`);
    }
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

// ---- VS Code Extension Logic ----
class NavascriptDebugConfigurationProvider {
  resolveDebugConfiguration(folder, config, token) {
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'navascript') {
        config.type = 'navascript';
        config.name = 'Launch NavaScript';
        config.request = 'launch';
        config.program = '${file}';
      }
    }
    if (config.program) {
      vscode.commands.executeCommand('navascript.run');
    }
    return undefined;
  }
}

function activate(context) {
  const outputChannel = vscode.window.createOutputChannel("NavaScript Console");

  let runCommand = vscode.commands.registerCommand('navascript.run', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('NavaScript: No hay archivo abierto.');
      return;
    }
    if (editor.document.languageId !== 'navascript') {
      vscode.window.showWarningMessage('NavaScript: El archivo activo no es un archivo .ns');
      return;
    }

    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine(`[Running] ${editor.document.fileName}\n`);

    try {
      // inputFn para PREGUNTA: usa showInputBox de VS Code
      const inputFn = async (prompt) => {
        const answer = await vscode.window.showInputBox({
          prompt: prompt || 'Ingresa un valor:',
          ignoreFocusOut: true,
        });
        return answer !== undefined ? answer : '';
      };

      const interpreter = new NavascriptInterpreter(
        (msg) => { outputChannel.appendLine(`> ${msg}`); },
        inputFn
      );
      await interpreter.runrun(editor.document.getText());
      outputChannel.appendLine("\n[Done] Ejecución finalizada.");
    } catch (err) {
      outputChannel.appendLine(`\n[Error] ${err.message}`);
      vscode.window.showErrorMessage(`NavaScript Error: ${err.message}`);
    }
  });

  // Preguntar una sola vez si activar el ícono para archivos .ns
  const config = vscode.workspace.getConfiguration();
  const currentTheme = config.get('workbench.iconTheme');
  const asked = context.globalState.get('navascript.iconThemeAsked');

  if (!asked && currentTheme !== 'navascript-icons') {
    context.globalState.update('navascript.iconThemeAsked', true);
    vscode.window.showInformationMessage(
      '¿Activar el ícono de NavaScript para archivos .ns?',
      'Sí', 'No'
    ).then(answer => {
      if (answer === 'Sí') {
        config.update('workbench.iconTheme', 'navascript-icons', vscode.ConfigurationTarget.Global);
      }
    });
  }

  const provider = new NavascriptDebugConfigurationProvider();
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider('navascript', provider)
  );
  context.subscriptions.push(runCommand);
}

module.exports = { activate, deactivate: () => {} };