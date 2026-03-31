const vscode = require('vscode');

// ---- Intérprete NavaScript (Versión Completa para VS Code) ----
class NavascriptInterpreter {
  constructor(outputFunc) {
    this.output = outputFunc;
    this.vars = {};
    this.funcs = {};
    this.callDepth = 0;
    this.MAX_DEPTH = 200;
    this.MAX_ITER = 100000;
    this.iterCount = 0;
  }

  log(msg) {
    this.output(String(msg));
  }

  tokenizeLines(code) {
    return code.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  }

  runrun(code) {
    const lines = this.tokenizeLines(code);
    const cleaned = lines.map(l => l.trim()).filter(l => l.length > 0);
    this.preScanFunctions(cleaned);
    this.executeLines(cleaned, 0);
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

  extractBlock(lines, startIdx) {
    let i = startIdx;
    let depth = 0;
    let body = [];
    let foundOpen = false;
    while (i < lines.length) {
      const l = lines[i];
      if (!foundOpen && l.includes('{')) {
        foundOpen = true;
        depth = 1;
        const after = l.slice(l.indexOf('{') + 1).trim();
        if (after && after !== '}') {
          const subLines = after.split(';').map(s => s.trim()).filter(s => s);
          subLines.forEach(sl => body.push(sl));
          if (after.includes('}')) { depth--; }
        }
        i++;
        continue;
      }
      if (foundOpen) {
        const opens = (l.match(/\{/g) || []).length;
        const closes = (l.match(/\}/g) || []).length;
        if (l === '}' || (depth + opens - closes <= 0)) {
          if (l !== '}') {
            const inside = l.replace(/\}$/, '').trim();
            if (inside) body.push(inside);
          }
          depth += opens - closes;
          if (depth <= 0) { return { body, end: i }; }
        } else {
          depth += opens - closes;
          body.push(l);
        }
      }
      i++;
    }
    return { body, end: i - 1 };
  }

  executeLines(lines, startIdx, localVars) {
    const scope = localVars || this.vars;
    let i = startIdx;
    while (i < lines.length) {
      const line = lines[i];
      if (!line || line.startsWith('Rawr')) { i++; continue; }

      // Saltar definiciones de funciones en tiempo de ejecución
      if (line.startsWith('Gii Huu ')) {
        const { end } = this.extractBlock(lines, i);
        i = end + 1;
        continue;
      }

      const result = this.executeLine(line, lines, i, scope);
      if (result && result.type === 'return') return result;
      if (result && result.skip) { i = result.skip; continue; }
      i++;
    }
  }

  executeLine(line, lines, idx, scope) {
    this.iterCount++;
    if (this.iterCount > this.MAX_ITER) throw new Error('Límite de iteraciones alcanzado.');

    if (line.startsWith('Rawr')) return null;

    // Declaración de variable
    if (line.startsWith('lobo aparece ')) {
      const rest = line.slice(13).trim();
      const eqIdx = rest.indexOf('=');
      if (eqIdx === -1) throw new Error(`Sintaxis inválida: ${line}`);
      const varName = rest.slice(0, eqIdx).trim();
      const valExpr = rest.slice(eqIdx + 1).trim();
      scope[varName] = this.evalExpr(valExpr, scope);
      return null;
    }

    // Salida
    if (line.startsWith('SHAREEE ')) {
      const expr = line.slice(8).trim();
      const val = this.evalExpr(expr, scope);
      this.log(val);
      return null;
    }

    // Retorno
    if (line.startsWith('NOOOO MORE ')) {
      const expr = line.slice(11).trim();
      const val = this.evalExpr(expr, scope);
      return { type: 'return', value: val };
    }

    // Incremento
    if (line.startsWith('Zap ')) {
      const vname = line.slice(4).trim();
      if (scope[vname] === undefined && this.vars[vname] === undefined)
        throw new Error(`Variable no existe: ${vname}`);
      if (scope[vname] !== undefined) scope[vname]++;
      else this.vars[vname]++;
      return null;
    }

    // Decremento
    if (line.startsWith('Boom ')) {
      const vname = line.slice(5).trim();
      if (scope[vname] === undefined && this.vars[vname] === undefined)
        throw new Error(`Variable no existe: ${vname}`);
      if (scope[vname] !== undefined) scope[vname]--;
      else this.vars[vname]--;
      return null;
    }

    // Pausa
    if (line.startsWith('Uuh ')) {
      const ms = parseInt(this.evalExpr(line.slice(4).trim(), scope));
      const end = Date.now() + ms;
      while (Date.now() < end) {}
      this.log(`Pausa: ${ms}ms`);
      return null;
    }

    // Condicional si / sino
    if (line.startsWith('si ') || line === 'si{') {
      const condMatch = line.match(/^si\s+(.+?)\s*\{?$/);
      if (!condMatch) throw new Error(`Sintaxis si: ${line}`);
      const cond = condMatch[1].replace(/\{$/, '').trim();
      const { body: ifBody, end: ifEnd } = this.extractBlock(lines, idx);
      let elseBody = null;
      let afterEnd = ifEnd + 1;

      if (afterEnd < lines.length && (
        lines[afterEnd] === 'sino {' ||
        lines[afterEnd] === 'sino{' ||
        lines[afterEnd].startsWith('} sino') ||
        lines[afterEnd] === 'sino'
      )) {
        const { body: eb, end: elEnd } = this.extractBlock(lines, afterEnd);
        elseBody = eb;
        afterEnd = elEnd + 1;
      }

      const condVal = this.evalCondition(cond, scope);
      if (condVal) {
        const r = this.executeLines(ifBody, 0, scope);
        if (r && r.type === 'return') return r;
      } else if (elseBody) {
        const r = this.executeLines(elseBody, 0, scope);
        if (r && r.type === 'return') return r;
      }
      return { skip: afterEnd };
    }

    // Bucle mientras
    if (line.startsWith('mientras ')) {
      const condMatch = line.match(/^mientras\s+(.+?)\s*\{?$/);
      if (!condMatch) throw new Error(`Sintaxis mientras: ${line}`);
      const cond = condMatch[1].replace(/\{$/, '').trim();
      const { body, end } = this.extractBlock(lines, idx);
      let loopCount = 0;
      while (this.evalCondition(cond, scope)) {
        if (++loopCount > 10000) throw new Error('Bucle mientras infinito');
        const r = this.executeLines(body, 0, scope);
        if (r && r.type === 'return') return r;
      }
      return { skip: end + 1 };
    }

    // Bucle Grr (hasta que)
    if (line.startsWith('Grr ')) {
      const condMatch = line.match(/^Grr\s+(.+?)\s*\{?$/);
      if (!condMatch) throw new Error(`Sintaxis Grr: ${line}`);
      const cond = condMatch[1].replace(/\{$/, '').trim();
      const { body, end } = this.extractBlock(lines, idx);
      let loopCount = 0;
      while (!this.evalCondition(cond, scope)) {
        if (++loopCount > 10000) throw new Error('Bucle Grr infinito');
        const r = this.executeLines(body, 0, scope);
        if (r && r.type === 'return') return r;
      }
      return { skip: end + 1 };
    }

    // Asignación simple
    const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
    if (assignMatch) {
      const vname = assignMatch[1];
      const expr = assignMatch[2].trim();
      const val = this.evalExpr(expr, scope);
      if (scope !== this.vars && scope[vname] !== undefined) scope[vname] = val;
      else this.vars[vname] = val;
      return null;
    }

    // Llamada a función huérfana
    const callMatch = line.match(/^([a-zA-Z_]\w*)\s*\((.*)?\)$/);
    if (callMatch) {
      this.callFunction(callMatch[1], callMatch[2] || '', scope);
      return null;
    }

    throw new Error(`Instrucción desconocida: ${line}`);
  }

  evalCondition(cond, scope) {
    const expr = this.replaceVars(cond, scope);
    try {
      return !!Function('"use strict"; return (' + expr + ')')();
    } catch (e) {
      throw new Error(`Condición inválida: ${cond}`);
    }
  }

  evalExpr(expr, scope) {
    if (!expr && expr !== 0) return '';
    expr = expr.trim();

    if (
      (expr.startsWith('"') && expr.endsWith('"')) ||
      (expr.startsWith("'") && expr.endsWith("'"))
    ) {
      return expr.slice(1, -1);
    }

    if (!isNaN(expr) && expr !== '') return Number(expr);
    if (expr === 'verdad' || expr === 'true') return true;
    if (expr === 'falso' || expr === 'false') return false;

    // Llamada a función en expresión
    const funcCallMatch = expr.match(/^([a-zA-Z_]\w*)\s*\(([^)]*)\)$/);
    if (funcCallMatch && this.funcs[funcCallMatch[1]]) {
      return this.callFunction(funcCallMatch[1], funcCallMatch[2], scope);
    }

    // Variable simple
    if (/^[a-zA-Z_]\w*$/.test(expr)) {
      if (scope[expr] !== undefined) return scope[expr];
      if (this.vars[expr] !== undefined) return this.vars[expr];
      throw new Error(`Variable no definida: ${expr}`);
    }

    // Expresión compleja (concatenación, aritmética, etc.)
    const processed = this.processComplexExpr(expr, scope);
    try {
      return Function('"use strict"; return (' + processed + ')')();
    } catch (e) {
      throw new Error(`Expresión inválida: ${expr}`);
    }
  }

  processComplexExpr(expr, scope) {
    let result = '';
    let i = 0;
    while (i < expr.length) {
      if (expr[i] === '"' || expr[i] === "'") {
        const q = expr[i];
        let s = q;
        i++;
        while (i < expr.length && expr[i] !== q) { s += expr[i]; i++; }
        s += q;
        i++;
        result += s;
        continue;
      }
      if (/[a-zA-Z_]/.test(expr[i])) {
        let ident = '';
        while (i < expr.length && /\w/.test(expr[i])) { ident += expr[i]; i++; }
        let ws = '';
        while (i < expr.length && expr[i] === ' ') { ws += expr[i]; i++; }
        if (i < expr.length && expr[i] === '(') {
          let depth2 = 0;
          let args = '';
          while (i < expr.length) {
            if (expr[i] === '(') depth2++;
            else if (expr[i] === ')') {
              depth2--;
              if (depth2 === 0) { args += ')'; i++; break; }
            }
            args += expr[i]; i++;
          }
          const argsInner = args.slice(1, -1);
          const val = this.callFunction(ident, argsInner, scope);
          result += JSON.stringify(val);
          continue;
        }
        if (scope[ident] !== undefined) result += JSON.stringify(scope[ident]);
        else if (this.vars[ident] !== undefined) result += JSON.stringify(this.vars[ident]);
        else result += ident;
        result += ws;
        continue;
      }
      result += expr[i];
      i++;
    }
    return result;
  }

  replaceVars(expr, scope) {
    return expr.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
      if (scope[match] !== undefined) return JSON.stringify(scope[match]);
      if (this.vars[match] !== undefined) return JSON.stringify(this.vars[match]);
      return match;
    });
  }

  callFunction(fname, argsStr, scope) {
    if (this.callDepth > this.MAX_DEPTH)
      throw new Error(`Recursión máxima alcanzada en: ${fname}`);
    const fn = this.funcs[fname];
    if (!fn) throw new Error(`Función no definida: ${fname}`);

    const argVals = argsStr.trim()
      ? this.splitArgs(argsStr).map(a => this.evalExpr(a.trim(), scope))
      : [];
    const localScope = Object.assign({}, this.vars);
    fn.params.forEach((p, i) => {
      localScope[p] = argVals[i] !== undefined ? argVals[i] : 0;
    });

    this.callDepth++;
    const result = this.executeLines(fn.body, 0, localScope);
    this.callDepth--;

    // Propagar cambios a variables globales
    Object.keys(this.vars).forEach(k => {
      if (localScope[k] !== undefined) this.vars[k] = localScope[k];
    });

    if (result && result.type === 'return') return result.value;
    return null;
  }

  splitArgs(argsStr) {
    const args = [];
    let depth3 = 0;
    let current = '';
    for (const ch of argsStr) {
      if (ch === '(') depth3++;
      if (ch === ')') depth3--;
      if (ch === ',' && depth3 === 0) { args.push(current); current = ''; }
      else current += ch;
    }
    if (current.trim()) args.push(current);
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

  let runCommand = vscode.commands.registerCommand('navascript.run', () => {
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
      const interpreter = new NavascriptInterpreter((msg) => {
        outputChannel.appendLine(`> ${msg}`);
      });
      interpreter.runrun(editor.document.getText());
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