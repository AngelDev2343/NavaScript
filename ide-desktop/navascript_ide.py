"""
NavaScript IDE — Desktop (Python + Tkinter)
Ejecutar: python navascript_ide.py
"""

import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog
import re
import threading
import time
import operator
import math
from PIL import Image, ImageTk

# ─────────────────────────────────────────────
# EJEMPLO DE CÓDIGO
# ─────────────────────────────────────────────
EXAMPLE_CODE = '''\
SHAREEE "=========================================="
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
'''

# ─────────────────────────────────────────────
# INTÉRPRETE NAVASCRIPT
# ─────────────────────────────────────────────
class NavascriptError(Exception):
    pass

class NavascriptInterpreter:
    MAX_DEPTH = 200
    MAX_ITER  = 100_000

    def __init__(self, output_fn, input_fn):
        self.output   = output_fn   # fn(msg, type)
        self.input_fn = input_fn    # fn(prompt) -> str
        self.vars      = {}
        self.funcs     = {}
        self.call_depth = 0
        self.iter_count = 0

    def log(self, msg, kind="text"):
        self.output(str(msg), kind)

    # ── tokenización ──────────────────────────
    def tokenize(self, code):
        lines = code.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        return [l.strip() for l in lines if l.strip()]

    # ── pre-scan funciones ────────────────────
    def pre_scan_functions(self, lines):
        i = 0
        while i < len(lines):
            line = lines[i]
            if line.startswith("Rawr"):
                i += 1; continue
            if line.startswith("Gii Huu "):
                body, end = self.extract_block(lines, i)
                header = line[8:].strip()
                m = re.match(r'^(\w+)\s*\(([^)]*)\)', header)
                if m:
                    fname  = m.group(1)
                    params = [p.strip() for p in m.group(2).split(",") if p.strip()]
                    self.funcs[fname] = {"params": params, "body": body}
                i = end + 1
            else:
                i += 1

    # ── extracción de bloque con llaves ───────
    def _count_braces(self, line):
        opens = closes = 0
        in_str = False; sq = ''
        for c in line:
            if in_str:
                if c == sq: in_str = False
            else:
                if c in ('"', "'"): in_str = True; sq = c
                elif c == '{': opens += 1
                elif c == '}': closes += 1
        return opens, closes

    def _closes_before_opens(self, line, depth):
        d = depth; in_str = False; sq = ''
        for c in line:
            if in_str:
                if c == sq: in_str = False
                continue
            if c in ('"', "'"):
                in_str = True; sq = c; continue
            if c == '}':
                d -= 1
                if d <= 0: return True
            elif c == '{':
                d += 1
        return False

    def extract_block(self, lines, start):
        i = start; depth = 0; body = []; found_open = False
        while i < len(lines):
            l = lines[i]
            if not found_open:
                if '{' in l:
                    found_open = True
                    open_idx = l.index('{')
                    depth = 1
                    after = l[open_idx+1:].strip()
                    if after:
                        if self._closes_before_opens(after, depth):
                            return body, i
                        o, c = self._count_braces(after)
                        depth += o - c
                        if depth <= 0: return body, i
                        for sl in after.split(';'):
                            sl = sl.strip()
                            if sl: body.append(sl)
                    i += 1; continue
                i += 1; continue
            if self._closes_before_opens(l, depth):
                return body, i
            o, c = self._count_braces(l)
            new_depth = depth + o - c
            if new_depth <= 0:
                return body, i
            depth = new_depth
            body.append(l)
            i += 1
        return body, i - 1

    # ── ejecución de líneas ───────────────────
    def execute_lines(self, lines, start, scope):
        i = start
        while i < len(lines):
            line = lines[i]
            if not line or line.startswith("Rawr"):
                i += 1; continue
            if line.startswith("Gii Huu "):
                _, end = self.extract_block(lines, i)
                i = end + 1; continue
            result = self.execute_line(line, lines, i, scope)
            if result and result.get("type") == "return":
                return result
            if result and result.get("skip") is not None:
                i = result["skip"]; continue
            i += 1

    # ── variables: get / set ──────────────────
    def set_var(self, name, value, scope):
        if scope is not self.vars and name in scope:
            scope[name] = value
        elif name in self.vars:
            self.vars[name] = value
        else:
            scope[name] = value

    def get_var(self, name, scope):
        if name in scope: return scope[name]
        if name in self.vars: return self.vars[name]
        return None

    # ── ejecutar una línea ────────────────────
    def execute_line(self, line, lines, idx, scope):
        self.iter_count += 1
        if self.iter_count > self.MAX_ITER:
            raise NavascriptError("Límite de iteraciones alcanzado. ¿Hay un bucle infinito?")

        if line.startswith("Rawr"):
            return None

        # lobo aparece
        if line.startswith("lobo aparece "):
            rest = line[13:].strip()
            eq = rest.find("=")
            if eq == -1: raise NavascriptError(f"Sintaxis inválida: {line}")
            var_name = rest[:eq].strip()
            scope[var_name] = self.eval_expr(rest[eq+1:].strip(), scope)
            return None

        # SHAREEE
        if line.startswith("SHAREEE "):
            rest = line[8:].strip()
            m = re.match(r'^(.+?)\s+con\s+(\d+)\s+decimales$', rest)
            if m:
                num = self.eval_expr(m.group(1).strip(), scope)
                try:
                    self.log(f"{float(num):.{int(m.group(2))}f}")
                except:
                    raise NavascriptError("'con decimales' requiere un número")
            else:
                self.log(self.eval_expr(rest, scope))
            return None

        # NOOOO MORE
        if line.startswith("NOOOO MORE "):
            return {"type": "return", "value": self.eval_expr(line[11:].strip(), scope)}

        # Zap
        if line.startswith("Zap "):
            vname = line[4:].strip()
            cur = self.get_var(vname, scope)
            if cur is None: raise NavascriptError(f'Variable no existe: "{vname}"')
            if not isinstance(cur, (int, float)):
                raise NavascriptError(f'Zap solo funciona con números. "{vname}" es {type(cur).__name__}')
            self.set_var(vname, cur + 1, scope)
            return None

        # Boom
        if line.startswith("Boom "):
            vname = line[5:].strip()
            cur = self.get_var(vname, scope)
            if cur is None: raise NavascriptError(f'Variable no existe: "{vname}"')
            if not isinstance(cur, (int, float)):
                raise NavascriptError(f'Boom solo funciona con números. "{vname}" es {type(cur).__name__}')
            self.set_var(vname, cur - 1, scope)
            return None

        # Uuh (pausa)
        if line.startswith("Uuh "):
            ms = int(self.eval_expr(line[4:].strip(), scope))
            time.sleep(ms / 1000)
            self.log(f"Pausa: {ms}ms", "info")
            return None

        # si / sino si / sino
        if line.startswith("si ") or line == "si{":
            return self.execute_if(line, lines, idx, scope)

        # para
        if line.startswith("para "):
            m = re.match(r'^para\s+(\w+)\s*=\s*(.+?)\s+hasta\s+(.+?)\s*\{?$', line)
            if not m: raise NavascriptError(f"Sintaxis para: {line}")
            var_name = m.group(1)
            start_val = int(self.eval_expr(m.group(2).strip(), scope))
            end_val   = int(self.eval_expr(m.group(3).replace("{","").strip(), scope))
            body, end = self.extract_block(lines, idx)
            lc = 0
            for v in range(start_val, end_val + 1):
                lc += 1
                if lc > 10000: raise NavascriptError("Bucle 'para' demasiado largo")
                scope[var_name] = v
                r = self.execute_lines(body, 0, scope)
                if r and r.get("type") == "return": return r
            return {"skip": end + 1}

        # mientras
        if line.startswith("mientras "):
            m = re.match(r'^mientras\s+(.+?)\s*\{?$', line)
            if not m: raise NavascriptError(f"Sintaxis mientras: {line}")
            cond = m.group(1).replace("{","").strip()
            body, end = self.extract_block(lines, idx)
            lc = 0
            while self.eval_condition(cond, scope):
                lc += 1
                if lc > 10000: raise NavascriptError("Bucle mientras demasiado largo. ¿Es infinito?")
                r = self.execute_lines(body, 0, scope)
                if r and r.get("type") == "return": return r
            return {"skip": end + 1}

        # Grr
        if line.startswith("Grr "):
            m = re.match(r'^Grr\s+(.+?)\s*\{?$', line)
            if not m: raise NavascriptError(f"Sintaxis Grr: {line}")
            cond = m.group(1).replace("{","").strip()
            body, end = self.extract_block(lines, idx)
            lc = 0
            while not self.eval_condition(cond, scope):
                lc += 1
                if lc > 10000: raise NavascriptError("Bucle Grr demasiado largo. ¿Es infinito?")
                r = self.execute_lines(body, 0, scope)
                if r and r.get("type") == "return": return r
            return {"skip": end + 1}

        # asignación
        m = re.match(r'^([a-zA-Z_]\w*)\s*=\s*(.+)$', line)
        if m:
            expr = m.group(2).strip()
            if expr.startswith("="):
                raise NavascriptError("¿Quisiste comparar? Usa == para comparar, = para asignar.")
            self.set_var(m.group(1), self.eval_expr(expr, scope), scope)
            return None

        # llamada a función suelta
        m = re.match(r'^([a-zA-Z_]\w*)\s*\((.*)\)$', line)
        if m:
            self.call_function(m.group(1), m.group(2) or "", scope)
            return None

        raise NavascriptError(f'Instrucción desconocida: "{line}"')

    # ── si / sino si / sino ───────────────────
    def execute_if(self, line, lines, idx, scope):
        m = re.match(r'^si\s+(.+?)\s*\{?$', line)
        if not m: raise NavascriptError(f"Sintaxis si: {line}")
        cond = m.group(1).replace("{","").strip()

        if_body, if_end = self.extract_block(lines, idx)
        branches = [{"cond": cond, "body": if_body}]
        cur_end = if_end

        while True:
            cl = (lines[cur_end] if cur_end < len(lines) else "").strip()
            m_elif = re.match(r'^\}\s*sino\s+si\s+(.+?)(\s*\{)?\s*$', cl)
            if m_elif:
                ec = m_elif.group(1).strip().replace("{","").strip()
                eib, ei_end = self.extract_block(lines, cur_end)
                branches.append({"cond": ec, "body": eib})
                cur_end = ei_end; continue
            m_else = re.match(r'^\}\s*sino\s*(\{)?\s*$', cl)
            if m_else:
                eb, el_end = self.extract_block(lines, cur_end)
                branches.append({"cond": None, "body": eb})
                cur_end = el_end; break
            break

        for branch in branches:
            if branch["cond"] is None or self.eval_condition(branch["cond"], scope):
                r = self.execute_lines(branch["body"], 0, scope)
                if r and r.get("type") == "return": return r
                break

        return {"skip": cur_end + 1}

    # ── evaluación de condición ───────────────
    def eval_condition(self, cond, scope):
        processed = self.process_complex_expr(cond, scope)
        # Reemplazar operadores NavaScript → Python
        processed = processed.replace("&&", " and ").replace("||", " or ")
        try:
            return bool(eval(processed, {"__builtins__": {}}, {}))
        except Exception:
            raise NavascriptError(f'Condición inválida: "{cond}"')

    # ── evaluación de expresión ───────────────
    def eval_expr(self, expr, scope):
        if expr is None or expr == '': return ''
        expr = expr.strip()

        # String literal
        if (expr.startswith('"') and expr.endswith('"')) or \
           (expr.startswith("'") and expr.endswith("'")):
            return expr[1:-1]

        # Número
        try:
            return int(expr) if '.' not in expr else float(expr)
        except ValueError:
            pass

        # Booleanos
        if expr in ('verdad', 'true'):  return True
        if expr in ('falso',  'false'): return False

        # PREGUNTA
        if expr.startswith("PREGUNTA"):
            raw = expr[8:].strip()
            prompt = self.eval_expr(raw, scope) if raw else ''
            answer = self.input_fn(str(prompt))
            try: return int(answer)
            except ValueError:
                try: return float(answer)
                except ValueError: return answer

        # Llamada a función
        m = re.match(r'^([a-zA-Z_]\w*)\s*\(([^)]*)\)$', expr)
        if m and m.group(1) in self.funcs:
            return self.call_function(m.group(1), m.group(2), scope)

        # Variable simple
        if re.match(r'^[a-zA-Z_]\w*$', expr):
            val = self.get_var(expr, scope)
            if val is not None: return val
            raise NavascriptError(f'Variable no definida: "{expr}"')

        # Expresión compleja
        processed = self.process_complex_expr(expr, scope)
        try:
            return eval(processed, {"__builtins__": {}}, {})
        except Exception:
            raise NavascriptError(f'Expresión inválida: "{expr}"')

    # ── procesar expresión compleja ───────────
    def process_complex_expr(self, expr, scope):
        result = ''; i = 0
        while i < len(expr):
            c = expr[i]
            # strings
            if c in ('"', "'"):
                q = c; s = q; i += 1
                while i < len(expr) and expr[i] != q:
                    s += expr[i]; i += 1
                s += q; i += 1
                result += s; continue
            # identificadores
            if re.match(r'[a-zA-Z_]', c):
                ident = ''
                while i < len(expr) and re.match(r'\w', expr[i]):
                    ident += expr[i]; i += 1
                ws = ''
                while i < len(expr) and expr[i] == ' ':
                    ws += expr[i]; i += 1
                # llamada a función
                if i < len(expr) and expr[i] == '(':
                    d2 = 0; args = ''
                    while i < len(expr):
                        if expr[i] == '(': d2 += 1
                        elif expr[i] == ')':
                            d2 -= 1
                            if d2 == 0: args += ')'; i += 1; break
                        args += expr[i]; i += 1
                    inner = args[1:-1]
                    val = self.call_function(ident, inner, scope)
                    result += self._py_repr(val) + ws; continue
                # booleanos
                if ident == 'verdad': result += 'True' + ws; continue
                if ident == 'falso':  result += 'False' + ws; continue
                # variable
                val = self.get_var(ident, scope)
                result += (self._py_repr(val) if val is not None else ident) + ws
                continue
            # operadores: == ya es == en Python, pero != también
            result += c; i += 1
        # convertir concatenación JS (+) entre strings a Python
        return result

    def _py_repr(self, val):
        if isinstance(val, bool): return 'True' if val else 'False'
        if isinstance(val, str):  return repr(val)
        return str(val)

    # ── llamar función ────────────────────────
    def call_function(self, fname, args_str, scope):
        if self.call_depth > self.MAX_DEPTH:
            raise NavascriptError(f'Recursión máxima en: {fname}')
        fn = self.funcs.get(fname)
        if not fn: raise NavascriptError(f'Función no definida: "{fname}"')
        arg_vals = [self.eval_expr(a.strip(), scope) for a in self.split_args(args_str)] \
                   if args_str.strip() else []
        local_scope = {**self.vars, **(scope if scope is not self.vars else {})}
        for idx, p in enumerate(fn["params"]):
            local_scope[p] = arg_vals[idx] if idx < len(arg_vals) else 0
        self.call_depth += 1
        result = self.execute_lines(fn["body"], 0, local_scope)
        self.call_depth -= 1
        for k in self.vars:
            if k in local_scope: self.vars[k] = local_scope[k]
        if result and result.get("type") == "return":
            return result["value"]
        return None

    def split_args(self, args_str):
        args = []; d = 0; cur = ''
        for ch in args_str:
            if ch == '(': d += 1
            elif ch == ')': d -= 1
            if ch == ',' and d == 0:
                args.append(cur); cur = ''
            else:
                cur += ch
        if cur.strip(): args.append(cur)
        return args

    # ── punto de entrada ──────────────────────
    def run(self, code):
        self.vars = {}; self.funcs = {}
        self.call_depth = 0; self.iter_count = 0
        lines = self.tokenize(code)
        self.pre_scan_functions(lines)
        self.execute_lines(lines, 0, self.vars)


# ─────────────────────────────────────────────
# IDE — INTERFAZ TKINTER
# ─────────────────────────────────────────────
COLORS = {
    "bg":           "#121212",
    "panel":        "#1a1a1a",
    "border":       "#333333",
    "text":         "#e0e0e0",
    "muted":        "#888888",
    "accent":       "#ffffff",
    "green":        "#4ade80",
    "error":        "#f87171",
    "info":         "#888888",
    "input_accent": "#7c6af7",
    # sintaxis
    "hl_comment":   "#636363",
    "hl_control":   "#c792ea",
    "hl_decl":      "#82aaff",
    "hl_builtin":   "#ffcb6b",
    "hl_string":    "#c3e88d",
    "hl_number":    "#f78c6c",
    "hl_bool":      "#ff5370",
    "hl_fn":        "#80cbc4",
}

FONT_MONO = ("Courier New", 11)
FONT_UI   = ("Segoe UI", 10)
FONT_BOLD = ("Segoe UI", 10, "bold")

SYNTAX_RULES = [
    ("hl_comment", re.compile(r'Rawr[^\n]*')),
    ("hl_string",  re.compile(r'"[^"]*"|\'[^\']*\'')),
    ("hl_builtin", re.compile(r'\b(SHAREEE|Zap|Boom|Uuh|PREGUNTA)\b')),
    ("hl_control", re.compile(r'\b(NOOOO MORE|sino si|sino|si|mientras|para|hasta|Grr|con|decimales)\b')),
    ("hl_decl",    re.compile(r'\b(lobo aparece|Gii Huu)\b')),
    ("hl_bool",    re.compile(r'\b(verdad|falso|true|false)\b')),
    ("hl_number",  re.compile(r'\b\d+(?:\.\d+)?\b')),
    ("hl_fn",      re.compile(r'\b([a-zA-Z_]\w*)(?=\s*\()')),
]


class NavaScriptIDE(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("NavaScript IDE")
        self.geometry("1100x700")
        self.minsize(800, 500)
        self.configure(bg=COLORS["bg"])

        # --- Cambiar el icono de la ventana ---
        img = Image.open("NS.png").resize((32, 32), Image.Resampling.LANCZOS)  # tamaño recomendado 32x32
        self.icon_img = ImageTk.PhotoImage(img)  # guardamos como atributo para que no se recolecte
        self.iconphoto(True, self.icon_img)
        # --------------------------------------

        self.current_file = None
        self._hl_after_id = None

        self._build_ui()
        self._apply_syntax_highlight()
        self.bind_all("<Control-Return>", lambda e: self.run_code())
        self.bind_all("<Control-s>",      lambda e: self.save_file())
        self.bind_all("<Control-o>",      lambda e: self.open_file())

    # ── construcción de UI ────────────────────
    def _build_ui(self):
        self._build_header()
        self._build_toolbar()

        paned = tk.PanedWindow(self, orient=tk.HORIZONTAL,
                               bg=COLORS["border"], sashwidth=4,
                               sashrelief=tk.FLAT, bd=0)
        paned.pack(fill=tk.BOTH, expand=True)

        self._build_editor(paned)
        self._build_output(paned)

        paned.paneconfig(paned.panes()[0], minsize=300)
        paned.paneconfig(paned.panes()[1], minsize=250)

        self._build_statusbar()

    def _build_header(self):
        hdr = tk.Frame(self, bg=COLORS["bg"],
                    highlightbackground=COLORS["border"],
                    highlightthickness=1)
        hdr.pack(fill=tk.X)

        # Cargar y redimensionar imagen (compatible con Pillow 10+)
        img = Image.open("NS.png").resize((60, 60), Image.Resampling.LANCZOS)
        self.logo_img = ImageTk.PhotoImage(img)
        tk.Label(hdr, image=self.logo_img, bg=COLORS["bg"]).pack(side=tk.LEFT, padx=(14,4), pady=8)

        tk.Label(hdr, text="NavaScript", bg=COLORS["bg"],
                fg=COLORS["text"], font=("Segoe UI", 13, "bold")).pack(side=tk.LEFT)
        tk.Label(hdr, text="IDE Oficial", bg=COLORS["bg"],
                fg=COLORS["muted"], font=FONT_UI).pack(side=tk.LEFT, padx=8)

    def _build_toolbar(self):
        bar = tk.Frame(self, bg=COLORS["panel"],
                       highlightbackground=COLORS["border"],
                       highlightthickness=1)
        bar.pack(fill=tk.X)

        def btn(parent, text, cmd, accent=False):
            fg = COLORS["bg"]    if accent else COLORS["text"]
            bg = COLORS["accent"] if accent else COLORS["panel"]
            b = tk.Button(parent, text=text, command=cmd,
                          bg=bg, fg=fg, font=FONT_BOLD if accent else FONT_UI,
                          relief=tk.FLAT, padx=12, pady=5, cursor="hand2",
                          activebackground=COLORS["border"],
                          activeforeground=COLORS["text"],
                          highlightbackground=COLORS["border"],
                          highlightthickness=1)
            b.pack(side=tk.LEFT, padx=4, pady=6)
            return b

        self.run_btn = btn(bar, "▶  RUNRUN", self.run_code, accent=True)
        btn(bar, "Cargar ejemplo",  self.load_example)
        btn(bar, "Abrir .ns",       self.open_file)
        btn(bar, "Guardar .ns",     self.save_file)
        btn(bar, "Limpiar salida",  self.clear_output)

        # tiempo de ejecución (derecha)
        self.exec_time_var = tk.StringVar()
        tk.Label(bar, textvariable=self.exec_time_var,
                 bg=COLORS["panel"], fg=COLORS["muted"],
                 font=("Courier New", 9)).pack(side=tk.RIGHT, padx=12)

    def _build_editor(self, paned):
        frame = tk.Frame(paned, bg=COLORS["bg"])
        paned.add(frame, stretch="always")

        # cabecera
        hdr = tk.Frame(frame, bg=COLORS["panel"],
                       highlightbackground=COLORS["border"],
                       highlightthickness=1)
        hdr.pack(fill=tk.X)
        tk.Label(hdr, text="✎", bg=COLORS["panel"],
                 fg=COLORS["muted"], font=FONT_UI).pack(side=tk.LEFT, padx=(10,4), pady=4)
        self.filename_var = tk.StringVar(value="codigo.ns")
        fn_entry = tk.Entry(hdr, textvariable=self.filename_var,
                            bg=COLORS["panel"], fg=COLORS["text"],
                            font=("Courier New", 9), relief=tk.FLAT,
                            insertbackground=COLORS["text"], width=22)
        fn_entry.pack(side=tk.LEFT, pady=4)
        tk.Label(hdr, text="Ctrl+Enter para ejecutar", bg=COLORS["panel"],
                 fg=COLORS["muted"], font=("Segoe UI", 8)).pack(side=tk.RIGHT, padx=10)

        # editor con números de línea
        edit_frame = tk.Frame(frame, bg=COLORS["bg"])
        edit_frame.pack(fill=tk.BOTH, expand=True)

        self.line_nums = tk.Text(edit_frame, width=4,
                                 bg=COLORS["panel"], fg=COLORS["muted"],
                                 font=FONT_MONO, state=tk.DISABLED,
                                 relief=tk.FLAT, pady=10,
                                 highlightthickness=0, bd=0,
                                 selectbackground=COLORS["panel"])
        self.line_nums.pack(side=tk.LEFT, fill=tk.Y)

        scroll = tk.Scrollbar(edit_frame, bg=COLORS["border"], troughcolor=COLORS["panel"])
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

        self.editor = tk.Text(edit_frame,
                              bg=COLORS["bg"], fg=COLORS["text"],
                              font=FONT_MONO, relief=tk.FLAT,
                              insertbackground=COLORS["text"],
                              selectbackground=COLORS["border"],
                              yscrollcommand=self._on_editor_scroll,
                              padx=12, pady=10, wrap=tk.NONE,
                              highlightthickness=0, bd=0,
                              tabs="2c", undo=True)
        self.editor.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.config(command=self.editor.yview)

        # configurar tags de resaltado
        for tag, color in [
            ("hl_comment", COLORS["hl_comment"]),
            ("hl_control", COLORS["hl_control"]),
            ("hl_decl",    COLORS["hl_decl"]),
            ("hl_builtin", COLORS["hl_builtin"]),
            ("hl_string",  COLORS["hl_string"]),
            ("hl_number",  COLORS["hl_number"]),
            ("hl_bool",    COLORS["hl_bool"]),
            ("hl_fn",      COLORS["hl_fn"]),
        ]:
            kw = {"foreground": color}
            if tag == "hl_comment": kw["font"] = ("Courier New", 11, "italic")
            self.editor.tag_configure(tag, **kw)

        self.editor.bind("<<Modified>>", self._on_editor_change)
        self.editor.bind("<KeyRelease>", self._on_editor_change)
        self.editor.bind("<Tab>", self._on_tab)

    def _build_output(self, paned):
        frame = tk.Frame(paned, bg=COLORS["bg"])
        paned.add(frame, stretch="always")

        hdr = tk.Frame(frame, bg=COLORS["panel"],
                       highlightbackground=COLORS["border"],
                       highlightthickness=1)
        hdr.pack(fill=tk.X)
        tk.Label(hdr, text="Salida", bg=COLORS["panel"],
                 fg=COLORS["muted"], font=FONT_UI).pack(side=tk.LEFT, padx=10, pady=4)

        out_frame = tk.Frame(frame, bg=COLORS["bg"])
        out_frame.pack(fill=tk.BOTH, expand=True)

        out_scroll = tk.Scrollbar(out_frame, bg=COLORS["border"], troughcolor=COLORS["panel"])
        out_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        self.output_area = tk.Text(out_frame,
                                   bg=COLORS["bg"], fg=COLORS["text"],
                                   font=FONT_MONO, relief=tk.FLAT,
                                   state=tk.DISABLED,
                                   yscrollcommand=out_scroll.set,
                                   padx=12, pady=10,
                                   highlightthickness=0, bd=0,
                                   wrap=tk.WORD, cursor="arrow")
        self.output_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        out_scroll.config(command=self.output_area.yview)

        self.output_area.tag_configure("system", foreground=COLORS["green"])
        self.output_area.tag_configure("error",  foreground=COLORS["error"])
        self.output_area.tag_configure("info",   foreground=COLORS["info"])
        self.output_area.tag_configure("text",   foreground=COLORS["text"])
        self.output_area.tag_configure("arrow",  foreground=COLORS["muted"])

    def _build_statusbar(self):
        bar = tk.Frame(self, bg=COLORS["panel"],
                       highlightbackground=COLORS["border"],
                       highlightthickness=1)
        bar.pack(fill=tk.X, side=tk.BOTTOM)
        self.status_var = tk.StringVar(value="Listo")
        tk.Label(bar, textvariable=self.status_var,
                 bg=COLORS["panel"], fg=COLORS["muted"],
                 font=("Segoe UI", 8)).pack(side=tk.LEFT, padx=10, pady=3)

    # ── eventos del editor ────────────────────
    def _on_tab(self, event):
        self.editor.insert(tk.INSERT, "  ")
        return "break"

    def _on_editor_scroll(self, *args):
        # sincronizar números de línea
        self.line_nums.yview_moveto(args[0])

    def _on_editor_change(self, event=None):
        self._update_line_numbers()
        # debounce: esperar 120ms sin escribir antes de colorear
        if self._hl_after_id:
            self.after_cancel(self._hl_after_id)
        self._hl_after_id = self.after(120, self._apply_syntax_highlight)

    def _update_line_numbers(self):
        content = self.editor.get("1.0", tk.END)
        n_lines = content.count("\n")
        self.line_nums.config(state=tk.NORMAL)
        self.line_nums.delete("1.0", tk.END)
        self.line_nums.insert("1.0", "\n".join(str(i) for i in range(1, n_lines + 1)))
        self.line_nums.config(state=tk.DISABLED)

    def _apply_syntax_highlight(self):
        # quitar todos los tags anteriores
        for tag, _ in SYNTAX_RULES:
            self.editor.tag_remove(tag, "1.0", tk.END)

        content = self.editor.get("1.0", tk.END)
        for tag, pattern in SYNTAX_RULES:
            for m in pattern.finditer(content):
                start_idx = self._offset_to_index(m.start(), content)
                end_idx   = self._offset_to_index(m.end(), content)
                self.editor.tag_add(tag, start_idx, end_idx)

    def _offset_to_index(self, offset, content):
        line = content[:offset].count("\n") + 1
        col  = offset - content[:offset].rfind("\n") - 1
        return f"{line}.{col}"

    # ── salida ────────────────────────────────
    def _append_output(self, msg, kind="text"):
        self.output_area.config(state=tk.NORMAL)
        self.output_area.insert(tk.END, "› ", "arrow")
        self.output_area.insert(tk.END, str(msg) + "\n", kind)
        self.output_area.see(tk.END)
        self.output_area.config(state=tk.DISABLED)

    def clear_output(self):
        self.output_area.config(state=tk.NORMAL)
        self.output_area.delete("1.0", tk.END)
        self.output_area.config(state=tk.DISABLED)
        self.exec_time_var.set("")
        self.status_var.set("Listo")

    # ── ejecutar código ───────────────────────
    def run_code(self):
        code = self.editor.get("1.0", tk.END).strip()
        if not code: return

        self.clear_output()
        self.run_btn.config(state=tk.DISABLED, text="Ejecutando...")
        self.status_var.set("Procesando...")
        self._append_output("NavaScript — Inicio de ejecución", "system")

        def _run():
            start = time.time()
            try:
                interp = NavascriptInterpreter(
                    output_fn=lambda msg, kind="text": self.after(0, self._append_output, msg, kind),
                    input_fn=self._ask_input,
                )
                interp.run(code)
                elapsed = int((time.time() - start) * 1000)
                self.after(0, self._on_run_done, elapsed, None)
            except NavascriptError as e:
                self.after(0, self._on_run_done, None, str(e))
            except Exception as e:
                self.after(0, self._on_run_done, None, f"Error interno: {e}")

        threading.Thread(target=_run, daemon=True).start()

    def _on_run_done(self, elapsed, error):
        self.run_btn.config(state=tk.NORMAL, text="▶  RUNRUN")
        if error:
            self._append_output(f"ERROR: {error}", "error")
            self.status_var.set("Error en ejecución")
        else:
            self._append_output(f"Ejecución terminada ({elapsed}ms)", "system")
            self.exec_time_var.set(f"{elapsed}ms")
            self.status_var.set(f"Listo ({elapsed}ms)")

    def _ask_input(self, prompt):
        result = simpledialog.askstring(
            "PREGUNTA",
            prompt or "Ingresa un valor:",
            parent=self,
        )
        return result or ""

    # ── archivos ──────────────────────────────
    def load_example(self):
        self.editor.delete("1.0", tk.END)
        self.editor.insert("1.0", EXAMPLE_CODE)
        self.filename_var.set("ejemplo.ns")
        self.status_var.set("Ejemplo cargado")
        self._on_editor_change()

    def open_file(self):
        path = filedialog.askopenfilename(
            filetypes=[("NavaScript", "*.ns"), ("Texto", "*.txt"), ("Todos", "*.*")]
        )
        if not path: return
        with open(path, encoding="utf-8") as f:
            content = f.read()
        self.editor.delete("1.0", tk.END)
        self.editor.insert("1.0", content)
        self.current_file = path
        self.filename_var.set(path.split("/")[-1].split("\\")[-1])
        self.status_var.set(f"Abierto: {self.filename_var.get()}")
        self._on_editor_change()

    def save_file(self):
        fname = self.filename_var.get().strip() or "script.ns"
        if not fname.endswith(".ns"): fname += ".ns"
        path = filedialog.asksaveasfilename(
            defaultextension=".ns",
            initialfile=fname,
            filetypes=[("NavaScript", "*.ns"), ("Texto", "*.txt")],
        )
        if not path: return
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.editor.get("1.0", tk.END))
        self.current_file = path
        self.filename_var.set(path.split("/")[-1].split("\\")[-1])
        self.status_var.set(f"Guardado: {self.filename_var.get()}")


# ─────────────────────────────────────────────
if __name__ == "__main__":
    app = NavaScriptIDE()
    app.mainloop()