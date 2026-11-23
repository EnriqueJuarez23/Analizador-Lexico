// ==========================================
// 1. ANALIZADOR LÉXICO (LEXER)
// ==========================================
function tokenizarCodigo(codigo) {
  const tokens = [];
  let i = 0;

  while (i < codigo.length) {
    const char = codigo[i];

    if (char === "\n") {
      tokens.push({ valor: "\\n", tipo: "salto de linea" });
      i++;
      continue;
    }

    if (char === "\r") {
      i++;
      continue;
    }

    if (char === "\t") {
      tokens.push({ valor: "\\t", tipo: "tabulador" });
      i++;
      continue;
    }

    if (char === " ") {
      tokens.push({ valor: " ", tipo: "espacio en blanco" });
      i++;
      continue;
    }

    if (char === "/" && codigo[i + 1] === "/") {
      let comentario = "";
      while (i < codigo.length && codigo[i] !== "\n") {
        comentario += codigo[i++];
      }
      tokens.push({ valor: comentario, tipo: "caracter especial" });
      continue;
    }

    if (char === '"' || char === "'") {
      const comilla = char;
      tokens.push({ valor: comilla, tipo: "caracter especial" });
      i++;
      let contenido = "";
      while (i < codigo.length && codigo[i] !== comilla && codigo[i] !== "\n") {
        if (codigo[i] === "\\" && i + 1 < codigo.length) {
          contenido += codigo[i] + codigo[i + 1];
          i += 2;
        } else {
          contenido += codigo[i++];
        }
      }
      if (contenido.length > 0) {
        tokens.push({ valor: contenido, tipo: "variable" });
      }
      if (i < codigo.length && codigo[i] === comilla) {
        tokens.push({ valor: comilla, tipo: "caracter especial" });
        i++;
      }
      continue;
    }

    if (/[0-9]/.test(char)) {
      let num = "";
      while (i < codigo.length && /[0-9]/.test(codigo[i])) {
        num += codigo[i++];
      }
      tokens.push({ valor: num, tipo: "numero entero" });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let palabra = "";
      while (i < codigo.length && /[a-zA-Z0-9_]/.test(codigo[i])) {
        palabra += codigo[i++];
      }
      const tipo = TODAS_RESERVADAS.has(palabra) ? "palabra reservada" : "variable";
      tokens.push({ valor: palabra, tipo });
      continue;
    }

    const dosChars = codigo.slice(i, i + 2);
    const opsCompuestos = [":=", "==", "!=", "<=", ">=", "++", "--", "&&", "||", "->", "=>", "::", "<<", ">>", "+=", "-=", "*=", "/="];
    if (opsCompuestos.includes(dosChars)) {
      tokens.push({ valor: dosChars, tipo: "operador" });
      i += 2;
      continue;
    }

    if (/[=+\-*/%<>!&|]/.test(char)) {
      tokens.push({ valor: char, tipo: "operador" });
      i++;
      continue;
    }

    tokens.push({ valor: char, tipo: "caracter especial" });
    i++;
  }

  return tokens;
}

// ==========================================
// 2. ANALIZADOR SINTÁCTICO (AST EN CASCADA / ROMBO)
// ==========================================
class ParserSintactico {
  constructor(tokens) {
    this.tokens = tokens.filter(
      t => t.tipo !== "espacio en blanco" && t.tipo !== "tabulador" && t.tipo !== "salto de linea"
    );
    this.pos = 0;
  }

  actual() {
    return this.tokens[this.pos] || null;
  }

  siguiente(offset = 1) {
    return this.tokens[this.pos + offset] || null;
  }

  consumir() {
    return this.tokens[this.pos++] || null;
  }

  construirPrograma() {
    const pasos = [];
    while (this.actual()) {
      const nodo = this.parsearSentencia();
      if (nodo) pasos.push(nodo);
      else this.consumir();
    }
    return pasos;
  }

  parsearSentencia() {
    const tk = this.actual();
    if (!tk) return null;

    // Directivas (#define / #include)
    if (tk.valor === "#") {
      this.consumir();
      const directiva = this.consumir();
      const items = [{ tipo: "cadena", valor: "#" }];
      if (directiva) items.push({ tipo: "cadena", valor: directiva.valor });

      while (this.actual() && this.actual().valor !== ";" && !this.esInicioSentencia()) {
        if (this.actual().valor === "(") {
          this.consumir();
          items.push({ tipo: "cadena", valor: "()" });
          const expr = this.parsearExpresionHasta(")");
          if (expr) items.push(expr);
          if (this.actual() && this.actual().valor === ")") this.consumir();
        } else {
          items.push({ tipo: "cadena", valor: this.consumir().valor });
        }
      }
      return { tipo: "cascada", nodos: items };
    }

    // Condicional if
    if (tk.valor === "if") {
      this.consumir();
      const nodos = [{ tipo: "cadena", valor: "if" }];
      if (this.actual() && this.actual().valor === "(") {
        this.consumir();
        nodos.push({ tipo: "cadena", valor: "()" });
        const cond = this.parsearExpresionHasta(")");
        if (cond) nodos.push(cond);
        if (this.actual() && this.actual().valor === ")") this.consumir();
      } else {
        const cond = this.parsearExpresionHasta("then");
        if (cond) nodos.push(cond);
      }

      if (this.actual() && (this.actual().valor === "then" || this.actual().valor === ":")) {
        nodos.push({ tipo: "cadena", valor: this.consumir().valor });
      }

      if (this.actual() && this.actual().valor === "{") {
        nodos.push(this.parsearBloqueLlaves());
      } else {
        const cuerpo = this.parsearSentencia();
        if (cuerpo) nodos.push(cuerpo);
      }
      return { tipo: "cascada", nodos };
    }

    // Clase
    if (tk.valor === "class" || (tk.valor === "public" && this.siguiente()?.valor === "class")) {
      const nodos = [];
      if (tk.valor === "public") nodos.push({ tipo: "cadena", valor: this.consumir().valor });
      nodos.push({ tipo: "cadena", valor: this.consumir().valor });
      if (this.actual()) nodos.push({ tipo: "cadena", valor: this.consumir().valor });
      if (this.actual() && this.actual().valor === "{") {
        nodos.push(this.parsearBloqueLlaves());
      }
      return { tipo: "cascada", nodos };
    }

    // Bloque { ... }
    if (tk.valor === "{") {
      return this.parsearBloqueLlaves();
    }

    // Firmas de función
    if (this.esFirmaFuncion()) {
      const nodos = [];
      while (this.actual() && this.actual().valor !== "(") {
        nodos.push({ tipo: "cadena", valor: this.consumir().valor });
      }
      if (this.actual() && this.actual().valor === "(") {
        this.consumir();
        nodos.push({ tipo: "cadena", valor: "()" });
        const params = [];
        while (this.actual() && this.actual().valor !== ")") {
          if (this.actual().valor === ",") {
            this.consumir();
          } else if (this.actual().valor === "[" && this.siguiente()?.valor === "]") {
            this.consumir();
            this.consumir();
            if (params.length > 0) params[params.length - 1] += "[]";
          } else {
            params.push(this.consumir().valor);
          }
        }
        if (this.actual() && this.actual().valor === ")") this.consumir();
        if (params.length > 0) {
          nodos.push({ tipo: "rombo_multi", hijos: params, cierre: null });
        }
      }
      while (this.actual() && this.actual().valor !== "{" && this.actual().valor !== ";") {
        nodos.push({ tipo: "cadena", valor: this.consumir().valor });
      }
      if (this.actual() && this.actual().valor === "{") {
        nodos.push(this.parsearBloqueLlaves());
      }
      return { tipo: "cascada", nodos };
    }

    // Declaraciones con tipo
    if (["int", "float", "double", "char", "String", "boolean", "var", "let", "const"].includes(tk.valor)) {
      const tipoDato = this.consumir().valor;
      const nodos = [{ tipo: "cadena", valor: tipoDato }];
      if (this.actual() && this.actual().valor === "mut") {
        nodos.push({ tipo: "cadena", valor: this.consumir().valor });
      }

      const primerId = this.consumir();
      if (!primerId) return { tipo: "cascada", nodos };

      if (this.actual() && this.actual().valor === ",") {
        const vars = [primerId.valor];
        while (this.actual() && this.actual().valor === ",") {
          this.consumir();
          if (this.actual()) vars.push(this.consumir().valor);
        }
        const cierre = this.actual()?.valor === ";" ? this.consumir().valor : null;
        nodos.push({ tipo: "rombo_multi", hijos: vars, cierre });
        return { tipo: "cascada", nodos };
      }

      if (this.actual() && (this.actual().valor === "=" || this.actual().valor === ":=")) {
        const op = this.consumir().valor;
        nodos.push({ tipo: "cadena", valor: op });
        const derecha = this.parsearValorDerecho();
        const cierre = this.actual()?.valor === ";" ? this.consumir().valor : null;
        nodos.push({ tipo: "rombo_binario", izq: primerId.valor, der: derecha, cierre });
        return { tipo: "cascada", nodos };
      }

      const cierre = this.actual()?.valor === ";" ? this.consumir().valor : null;
      nodos.push({ tipo: "cadena", valor: primerId.valor });
      if (cierre) nodos.push({ tipo: "cadena", valor: cierre });
      return { tipo: "cascada", nodos };
    }

    // Llamadas a función / impresión
    if (this.esLlamadaFuncion()) {
      let nombreCompleto = this.consumir().valor;
      while (this.actual() && (this.actual().valor === "." || this.actual().valor === "::" || this.actual().valor === "!")) {
        nombreCompleto += this.consumir().valor;
        if (this.actual() && (this.actual().tipo === "variable" || this.actual().tipo === "palabra reservada")) {
          nombreCompleto += this.consumir().valor;
        }
      }

      const nodos = [{ tipo: "cadena", valor: nombreCompleto }];
      if (this.actual() && this.actual().valor === "(") {
        this.consumir();
        nodos.push({ tipo: "cadena", valor: "()" });
        const args = this.parsearArgumentosLlamada();
        if (this.actual() && this.actual().valor === ")") this.consumir();
        const cierre = this.actual()?.valor === ";" ? this.consumir().valor : null;

        if (args.length === 1) {
          nodos.push(args[0]);
          if (cierre) nodos.push({ tipo: "cadena", valor: cierre });
        } else if (args.length > 1) {
          nodos.push({ tipo: "rombo_multi", hijos: args.map(a => a.valor || a), cierre });
        } else if (cierre) {
          nodos.push({ tipo: "cadena", valor: cierre });
        }
      }
      return { tipo: "cascada", nodos };
    }

    // Asignación directa
    if ((tk.tipo === "variable" || tk.tipo === "palabra reservada") &&
        (this.siguiente()?.valor === "=" || this.siguiente()?.valor === ":=")) {
      const izq = this.consumir().valor;
      const op = this.consumir().valor;
      const derecha = this.parsearValorDerecho();
      const cierre = this.actual()?.valor === ";" ? this.consumir().valor : null;
      return {
        tipo: "cascada",
        nodos: [
          { tipo: "cadena", valor: op },
          { tipo: "rombo_binario", izq, der: derecha, cierre }
        ]
      };
    }

    return { tipo: "cadena", valor: this.consumir().valor };
  }

  parsearBloqueLlaves() {
    this.consumir(); // '{'
    const sentenciasInternas = [];
    while (this.actual() && this.actual().valor !== "}") {
      const s = this.parsearSentencia();
      if (s) sentenciasInternas.push(s);
    }
    const cierreLlave = this.actual()?.valor === "}" ? this.consumir().valor : null;
    return {
      tipo: "bloque",
      simbolo: "{}",
      hijos: sentenciasInternas,
      cierre: cierreLlave
    };
  }

  parsearValorDerecho() {
    const primero = this.consumir();
    if (!primero) return "";
    if (this.actual() && ["+", "-", "*", "/", "%"].includes(this.actual().valor)) {
      const op = this.consumir().valor;
      const segundo = this.consumir()?.valor || "";
      return { tipo: "sub_rombo", op, izq: primero.valor, der: segundo };
    }
    return primero.valor;
  }

  parsearExpresionHasta(tokenFin) {
    const izq = this.consumir()?.valor || "";
    if (this.actual() && this.actual().valor !== tokenFin) {
      const op = this.consumir().valor;
      const der = this.consumir()?.valor || "";
      return {
        tipo: "cascada",
        nodos: [
          { tipo: "cadena", valor: op },
          { tipo: "rombo_binario", izq, der, cierre: null }
        ]
      };
    }
    return { tipo: "cadena", valor: izq };
  }

  parsearArgumentosLlamada() {
    const args = [];
    while (this.actual() && this.actual().valor !== ")") {
      if (this.actual().valor === ",") {
        this.consumir();
        continue;
      }
      if (this.actual().valor === '"' || this.actual().valor === "'") {
        const comilla = this.consumir().valor;
        let texto = "";
        while (this.actual() && this.actual().valor !== comilla && this.actual().valor !== ")") {
          texto += this.consumir().valor;
        }
        if (this.actual() && this.actual().valor === comilla) this.consumir();
        args.push({
          tipo: "rombo_multi",
          hijos: [comilla, texto, comilla].filter(Boolean),
          cierre: null
        });
      } else {
        args.push({ tipo: "cadena", valor: this.consumir().valor });
      }
    }
    return args;
  }

  esFirmaFuncion() {
    let lookahead = 0;
    while (this.siguiente(lookahead)) {
      const v = this.siguiente(lookahead).valor;
      if (v === ";" || v === "=" || v === "{") return false;
      if (v === "(") return lookahead >= 2;
      lookahead++;
    }
    return false;
  }

  esLlamadaFuncion() {
    let lookahead = 0;
    while (this.siguiente(lookahead)) {
      const t = this.siguiente(lookahead);
      if (t.tipo === "variable" || t.tipo === "palabra reservada" || t.valor === "." || t.valor === "::" || t.valor === "!") {
        lookahead++;
        continue;
      }
      return t.valor === "(" && lookahead >= 1;
    }
    return false;
  }

  esInicioSentencia() {
    const v = this.actual()?.valor;
    return ["int", "void", "class", "public", "if", "def", "fn", "func", "let", "var"].includes(v);
  }
}

// ==========================================
// 3. RENDERIZADOR SVG CENTRADO Y SIN CORTES
// ==========================================
function renderizarArbolSVG(pasos, svgEl, esHojaBlanca) {
  svgEl.innerHTML = "";
  if (!pasos || pasos.length === 0) return;

  const bgColor = esHojaBlanca ? "#ffffff" : "#090d16";
  const strokeColor = esHojaBlanca ? "#1e293b" : "#64748b";
  const textColor = esHojaBlanca ? "#0f172a" : "#f8fafc";
  const pillFill = esHojaBlanca ? "#f8fafc" : "#162033";
  const pillStroke = esHojaBlanca ? "#475569" : "#3b82f6";

  const NODE_H = 30;
  const V_GAP = 24;
  const elements = [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  function calcularAnchoCaja(texto) {
    const str = String(texto);
    return Math.max(46, str.length * 10.2 + 26);
  }

  function actualizarLimites(x1, y1, x2, y2) {
    if (x1 < minX) minX = x1;
    if (x2 > maxX) maxX = x2;
    if (y1 < minY) minY = y1;
    if (y2 > maxY) maxY = y2;
  }

  function drawLine(x1, y1, x2, y2) {
    actualizarLimites(
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.max(x1, x2),
      Math.max(y1, y2)
    );
    elements.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" />`
    );
  }

  function drawNodeBox(x, y, text) {
    const label = String(text);
    const width = calcularAnchoCaja(label);
    actualizarLimites(x - width / 2, y - NODE_H / 2, x + width / 2, y + NODE_H / 2);

    elements.push(`
      <g transform="translate(${x}, ${y})">
        <rect x="${-width / 2}" y="${-NODE_H / 2}" width="${width}" height="${NODE_H}" rx="7" fill="${pillFill}" stroke="${pillStroke}" stroke-width="1.5" />
        <text x="0" y="5" text-anchor="middle" fill="${textColor}" font-family="'Fira Code', Consolas, monospace" font-size="13" font-weight="600">${escapeXml(label)}</text>
      </g>
    `);
  }

  function renderNodo(nodo, x, y) {
    if (!nodo) return y;

    if (nodo.tipo === "cadena") {
      drawNodeBox(x, y, nodo.valor);
      return y + NODE_H / 2;
    }

    if (nodo.tipo === "cascada") {
      let currentY = y;
      nodo.nodos.forEach((sub, idx) => {
        if (idx > 0) {
          const lineStartY = currentY;
          const lineEndY = currentY + V_GAP;
          drawLine(x, lineStartY, x, lineEndY);
          currentY = lineEndY + NODE_H / 2;
        }
        currentY = renderNodo(sub, x, currentY);
      });
      return currentY;
    }

    if (nodo.tipo === "rombo_binario") {
      const izqLabel = String(nodo.izq || "");
      const derLabel = typeof nodo.der === "object" && nodo.der.tipo === "sub_rombo"
        ? String(nodo.der.op)
        : String(nodo.der || "");

      const wIzq = calcularAnchoCaja(izqLabel);
      const wDer = calcularAnchoCaja(derLabel);
      const spread = Math.max(76, (wIzq + wDer) / 2 + 28);

      const leftX = x - spread;
      const rightX = x + spread;
      const midY = y + NODE_H / 2 + V_GAP + NODE_H / 2;

      drawLine(x, y + NODE_H / 2, leftX, midY - NODE_H / 2);
      drawLine(x, y + NODE_H / 2, rightX, midY - NODE_H / 2);

      drawNodeBox(leftX, midY, izqLabel);

      if (typeof nodo.der === "object" && nodo.der.tipo === "sub_rombo") {
        drawNodeBox(rightX, midY, derLabel);

        const sIzq = String(nodo.der.izq || "");
        const sDer = String(nodo.der.der || "");
        const subSpread = Math.max(60, (calcularAnchoCaja(sIzq) + calcularAnchoCaja(sDer)) / 2 + 22);
        const subLeftX = rightX - subSpread;
        const subRightX = rightX + subSpread;
        const subMidY = midY + NODE_H / 2 + V_GAP + NODE_H / 2;

        drawLine(rightX, midY + NODE_H / 2, subLeftX, subMidY - NODE_H / 2);
        drawLine(rightX, midY + NODE_H / 2, subRightX, subMidY - NODE_H / 2);

        drawNodeBox(subLeftX, subMidY, sIzq);
        drawNodeBox(subRightX, subMidY, sDer);

        if (nodo.cierre) {
          const botY = subMidY + NODE_H / 2 + V_GAP + NODE_H / 2;
          drawLine(leftX, midY + NODE_H / 2, x, botY - NODE_H / 2);
          drawLine(subLeftX, subMidY + NODE_H / 2, x, botY - NODE_H / 2);
          drawLine(subRightX, subMidY + NODE_H / 2, x, botY - NODE_H / 2);
          drawNodeBox(x, botY, nodo.cierre);
          return botY + NODE_H / 2;
        }
        return subMidY + NODE_H / 2;
      } else {
        drawNodeBox(rightX, midY, derLabel);
        if (nodo.cierre) {
          const botY = midY + NODE_H / 2 + V_GAP + NODE_H / 2;
          drawLine(leftX, midY + NODE_H / 2, x, botY - NODE_H / 2);
          drawLine(rightX, midY + NODE_H / 2, x, botY - NODE_H / 2);
          drawNodeBox(x, botY, nodo.cierre);
          return botY + NODE_H / 2;
        }
        return midY + NODE_H / 2;
      }
    }

    if (nodo.tipo === "rombo_multi") {
      const hijos = nodo.hijos || [];
      if (hijos.length === 0) return y;

      const anchos = hijos.map(h => calcularAnchoCaja(h));
      const gapEntreHijos = 24;
      const posicionesX = [];
      let totalW = 0;

      anchos.forEach((w, idx) => {
        if (idx > 0) totalW += gapEntreHijos;
        totalW += w;
      });

      let cursorX = x - totalW / 2;
      anchos.forEach(w => {
        posicionesX.push(cursorX + w / 2);
        cursorX += w + gapEntreHijos;
      });

      const midY = y + NODE_H / 2 + V_GAP + NODE_H / 2;

      hijos.forEach((h, idx) => {
        const hx = posicionesX[idx];
        drawLine(x, y + NODE_H / 2, hx, midY - NODE_H / 2);
        drawNodeBox(hx, midY, h);
      });

      if (nodo.cierre) {
        const botY = midY + NODE_H / 2 + V_GAP + NODE_H / 2;
        posicionesX.forEach(hx => {
          drawLine(hx, midY + NODE_H / 2, x, botY - NODE_H / 2);
        });
        drawNodeBox(x, botY, nodo.cierre);
        return botY + NODE_H / 2;
      }

      return midY + NODE_H / 2;
    }

    if (nodo.tipo === "bloque") {
      drawNodeBox(x, y, nodo.simbolo);
      let currentBottomY = y + NODE_H / 2;

      // Renderizamos las sentencias del bloque en cascada vertical limpia
      // para evitar ramas horizontales gigantes que se salgan del lienzo
      (nodo.hijos || []).forEach(hijo => {
        const lineEndY = currentBottomY + V_GAP;
        drawLine(x, currentBottomY, x, lineEndY);
        currentBottomY = renderNodo(hijo, x, lineEndY + NODE_H / 2);
      });

      if (nodo.cierre) {
        const closeLineEndY = currentBottomY + V_GAP;
        drawLine(x, currentBottomY, x, closeLineEndY);
        const closeCenterY = closeLineEndY + NODE_H / 2;
        drawNodeBox(x, closeCenterY, nodo.cierre);
        currentBottomY = closeCenterY + NODE_H / 2;
      }

      return currentBottomY;
    }

    return y;
  }

  const originX = 0;
  let currentY = 0;

  pasos.forEach((paso, idx) => {
    if (idx > 0) {
      const lineEndY = currentY + V_GAP;
      drawLine(originX, currentY, originX, lineEndY);
      currentY = lineEndY + NODE_H / 2;
    }
    currentY = renderNodo(paso, originX, currentY);
  });

  if (!isFinite(minX)) {
    minX = -200;
    maxX = 200;
    minY = 0;
    maxY = 300;
  }

  const pad = 44;
  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = Math.max(360, (maxX - minX) + pad * 2);
  const vbH = Math.max(320, (maxY - minY) + pad * 2);

  const bgRect = `<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${bgColor}" />`;

  svgEl.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
  svgEl.setAttribute("width", String(vbW));
  svgEl.setAttribute("height", String(vbH));
  svgEl.innerHTML = bgRect + elements.join("");
}

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ==========================================
// 4. CONTROLADOR DE INTERFAZ Y EVENTOS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const codeInput = document.getElementById("code-input");
  const btnAnalizar = document.getElementById("btn-analizar");
  const btnLimpiar = document.getElementById("btn-limpiar");
  const btnCopyTokens = document.getElementById("btn-copy-tokens");
  const chkWhitespace = document.getElementById("chk-whitespace");
  const tokensList = document.getElementById("tokens-list");
  const tokenCount = document.getElementById("token-count");
  const langBadge = document.getElementById("lang-badge");
  const langText = document.getElementById("lang-text");
  const astSvg = document.getElementById("ast-svg");
  const treeViewport = document.getElementById("tree-viewport");
  const btnThemeSheet = document.getElementById("btn-theme-sheet");
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const btnZoomReset = document.getElementById("btn-zoom-reset");
  const zoomLabel = document.getElementById("zoom-label");
  const btnExportSvg = document.getElementById("btn-export-svg");

  let ultimosTokens = [];
  let ultimosPasosAST = [];
  let esHojaBlanca = false;
  let zoomActual = 1;

  function ejecutarAnalisis() {
    const codigo = codeInput.value;
    if (!codigo.trim()) {
      tokensList.innerHTML = '<div class="empty-state">Ingresa un código para analizar.</div>';
      tokenCount.textContent = "0 tokens";
      langBadge.classList.remove("detected");
      langText.textContent = "Lenguaje detectado: Esperando código...";
      astSvg.innerHTML = "";
      return;
    }

    ultimosTokens = tokenizarCodigo(codigo);
    const lenguaje = detectarLenguajePorDiccionario(codigo, ultimosTokens);
    langBadge.classList.add("detected");
    langText.textContent = `Lenguaje detectado: ${lenguaje}`;

    pintarTokens();

    const parser = new ParserSintactico(ultimosTokens);
    ultimosPasosAST = parser.construirPrograma();
    renderizarArbolSVG(ultimosPasosAST, astSvg, esHojaBlanca);
  }

  function pintarTokens() {
    const incluirEspacios = chkWhitespace.checked;
    const filtrados = incluirEspacios
      ? ultimosTokens
      : ultimosTokens.filter(
          t => t.tipo !== "espacio en blanco" && t.tipo !== "tabulador" && t.tipo !== "salto de linea"
        );

    tokenCount.textContent = `${filtrados.length} tokens`;
    tokensList.innerHTML = "";

    filtrados.forEach(t => {
      const div = document.createElement("div");
      const claseTipo = "tk-" + t.tipo.replace(/\s+/g, "-");
      div.className = `token-item ${claseTipo}`;
      div.textContent = `<'${t.valor}', ${t.tipo}>`;
      tokensList.appendChild(div);
    });
  }

  btnAnalizar.addEventListener("click", ejecutarAnalisis);

  btnLimpiar.addEventListener("click", () => {
    codeInput.value = "";
    ultimosTokens = [];
    ultimosPasosAST = [];
    tokensList.innerHTML = '<div class="empty-state">Ingresa un código y presiona "Analizar Código" para generar los tokens.</div>';
    tokenCount.textContent = "0 tokens";
    langBadge.classList.remove("detected");
    langText.textContent = "Lenguaje detectado: Esperando código...";
    astSvg.innerHTML = "";
  });

  chkWhitespace.addEventListener("change", () => {
    if (ultimosTokens.length > 0) pintarTokens();
  });

  btnCopyTokens.addEventListener("click", () => {
    const texto = Array.from(tokensList.querySelectorAll(".token-item"))
      .map(el => el.textContent)
      .join("\n");
    if (texto) navigator.clipboard.writeText(texto);
  });

  btnThemeSheet.addEventListener("click", () => {
    esHojaBlanca = !esHojaBlanca;
    treeViewport.classList.toggle("light-grid", esHojaBlanca);
    treeViewport.classList.toggle("dark-grid", !esHojaBlanca);
    btnThemeSheet.textContent = esHojaBlanca ? "🌑 Hoja Oscura" : "📓 Hoja Blanca";
    renderizarArbolSVG(ultimosPasosAST, astSvg, esHojaBlanca);
  });

  function actualizarZoom() {
    astSvg.style.transform = `scale(${zoomActual})`;
    astSvg.style.transformOrigin = "top center";
    zoomLabel.textContent = `${Math.round(zoomActual * 100)}%`;
  }

  btnZoomIn.addEventListener("click", () => {
    zoomActual = Math.min(2, zoomActual + 0.15);
    actualizarZoom();
  });

  btnZoomOut.addEventListener("click", () => {
    zoomActual = Math.max(0.4, zoomActual - 0.15);
    actualizarZoom();
  });

  btnZoomReset.addEventListener("click", () => {
    zoomActual = 1;
    actualizarZoom();
  });

  btnExportSvg.addEventListener("click", () => {
    if (!astSvg.innerHTML) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(astSvg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arbol_sintactico.svg";
    a.click();
    URL.revokeObjectURL(url);
  });

  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = codeInput.selectionStart;
      const end = codeInput.selectionEnd;
      codeInput.value = codeInput.value.substring(0, start) + "\t" + codeInput.value.substring(end);
      codeInput.selectionStart = codeInput.selectionEnd = start + 1;
    }
  });
});
