// ==========================================
// 1. ANALIZADOR LÉXICO (LEXER)
// ==========================================
function tokenizarCodigo(codigo) {
  const tokens = [];
  let i = 0;

  while (i < codigo.length) {
    const char = codigo[i];

    // 1. Salto de línea
    if (char === "\n") {
      tokens.push({ valor: "\\n", tipo: "salto de linea" });
      i++;
      continue;
    }

    // 2. Retorno de carro (ignorar \r en Windows)
    if (char === "\r") {
      i++;
      continue;
    }

    // 3. Tabulador explícito (diferenciado de espacio en blanco)
    if (char === "\t") {
      tokens.push({ valor: "\\t", tipo: "tabulador" });
      i++;
      continue;
    }

    // 4. Espacio en blanco individual
    if (char === " ") {
      tokens.push({ valor: " ", tipo: "espacio en blanco" });
      i++;
      continue;
    }

    // 5. Comentarios de línea (// o # cuando no es directiva #define/#include)
    if (char === "/" && codigo[i + 1] === "/") {
      let comentario = "";
      while (i < codigo.length && codigo[i] !== "\n") {
        comentario += codigo[i++];
      }
      tokens.push({ valor: comentario, tipo: "caracter especial" });
      continue;
    }

    // 6. Cadenas de texto entre comillas dobles o simples
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

    // 7. Números enteros
    if (/[0-9]/.test(char)) {
      let num = "";
      while (i < codigo.length && /[0-9]/.test(codigo[i])) {
        num += codigo[i++];
      }
      tokens.push({ valor: num, tipo: "numero entero" });
      continue;
    }

    // 8. Identificadores y Palabras Reservadas (según diccionarios.js)
    if (/[a-zA-Z_]/.test(char)) {
      let palabra = "";
      while (i < codigo.length && /[a-zA-Z0-9_]/.test(codigo[i])) {
        palabra += codigo[i++];
      }
      const tipo = TODAS_RESERVADAS.has(palabra) ? "palabra reservada" : "variable";
      tokens.push({ valor: palabra, tipo });
      continue;
    }

    // 9. Operadores compuestos (2 caracteres)
    const dosChars = codigo.slice(i, i + 2);
    const opsCompuestos = [":=", "==", "!=", "<=", ">=", "++", "--", "&&", "||", "->", "=>", "::", "<<", ">>", "+=", "-=", "*=", "/="];
    if (opsCompuestos.includes(dosChars)) {
      tokens.push({ valor: dosChars, tipo: "operador" });
      i += 2;
      continue;
    }

    // 10. Operadores simples
    if (/[=+\-*/%<>!&|]/.test(char)) {
      tokens.push({ valor: char, tipo: "operador" });
      i++;
      continue;
    }

    // 11. Caracteres especiales (#, (, ), {, }, [, ], ;, ,, :, .)
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
    // Filtramos espacios, tabuladores y saltos de línea para construir el árbol estructural
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

    // Caso 1: Directivas (#define / #include)
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

    // Caso 2: Condicional if (cond) then ...
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

    // Caso 3: Declaración de clase (class Nombre { ... })
    if (tk.valor === "class" || (tk.valor === "public" && this.siguiente()?.valor === "class")) {
      const nodos = [];
      if (tk.valor === "public") nodos.push({ tipo: "cadena", valor: this.consumir().valor });
      nodos.push({ tipo: "cadena", valor: this.consumir().valor }); // class
      if (this.actual()) nodos.push({ tipo: "cadena", valor: this.consumir().valor }); // Nombre
      if (this.actual() && this.actual().valor === "{") {
        nodos.push(this.parsearBloqueLlaves());
      }
      return { tipo: "cascada", nodos };
    }

    // Caso 4: Bloque de llaves aislado { ... }
    if (tk.valor === "{") {
      return this.parsearBloqueLlaves();
    }

    // Caso 5: Firmas de funciones o métodos (ej. public static void main(...), fn main(), def suma():)
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
          nodos.push({ tipo: "rombo_multi", centro: "params", hijos: params, cierre: null });
        }
      }
      // Tipo de retorno opcional (-> i32 o :)
      while (this.actual() && this.actual().valor !== "{" && this.actual().valor !== ";") {
        nodos.push({ tipo: "cadena", valor: this.consumir().valor });
      }
      if (this.actual() && this.actual().valor === "{") {
        nodos.push(this.parsearBloqueLlaves());
      }
      return { tipo: "cascada", nodos };
    }

    // Caso 6: Declaraciones de variables con tipo (int w, x, z; o int i = 4;)
    if (["int", "float", "double", "char", "String", "boolean", "var", "let", "const"].includes(tk.valor)) {
      const tipoDato = this.consumir().valor;
      const nodos = [{ tipo: "cadena", valor: tipoDato }];
      if (this.actual() && this.actual().valor === "mut") {
        nodos.push({ tipo: "cadena", valor: this.consumir().valor });
      }

      const primerId = this.consumir();
      if (!primerId) return { tipo: "cascada", nodos };

      // Declaración múltiple: int w, x, z;
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

      // Declaración con asignación: int i = 4;
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

    // Caso 7: Llamadas a función / impresión (ej. System.out.print("Hola Mundo"), printf("%d", x);)
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

    // Caso 8: Asignación directa (ej. x = 2; o w = i + j;)
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

    // Cualquier otro token suelto
    return { tipo: "cadena", valor: this.consumir().valor };
  }

  parsearBloqueLlaves() {
    this.consumir(); // '{'
    const sentenciasInternas = [];
    while (this.actual() && this.actual().valor !== "}") {
      const s = this.parsearSentencia();
      if (s) sentenciasInternas.push(s);
    }
    if (this.actual() && this.actual().valor === "}") {
      this.consumir(); // '}'
    }
    return {
      tipo: "bloque",
      simbolo: "{}",
      hijos: sentenciasInternas
    };
  }

  parsearValorDerecho() {
    const primero = this.consumir();
    if (!primero) return "";
    // Si es una operación binaria (ej. i + j)
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
      // Cadena entre comillas
      if (this.actual().valor === '"' || this.actual().valor === "'") {
        const comilla = this.consumir().valor;
        let texto = "";
        while (this.actual() && this.actual().valor !== comilla && this.actual().valor !== ")") {
          texto += this.consumir().valor;
        }
        if (this.actual() && this.actual().valor === comilla) this.consumir();
        args.push({
          tipo: "cascada",
          nodos: [
            { tipo: "cadena", valor: comilla + comilla },
            { tipo: "cadena", valor: texto }
          ]
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
      if (v === "(") {
        // Verificar si antes del '(' hay al menos 2 identificadores/tipos (ej. void main o fn suma)
        return lookahead >= 2;
      }
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
// 3. RENDERIZADOR SVG EN CASCADA Y ROMBOS
// ==========================================
function renderizarArbolSVG(pasos, svgEl, esHojaBlanca) {
  svgEl.innerHTML = "";
  if (!pasos || pasos.length === 0) return;

  const strokeColor = esHojaBlanca ? "#1e293b" : "#64748b";
  const textColor = esHojaBlanca ? "#0f172a" : "#f1f5f9";
  const pillFill = esHojaBlanca ? "#f8fafc" : "#1e293b";
  const pillStroke = esHojaBlanca ? "#94a3b8" : "#334155";

  let cursorY = 35;
  const centerX = 320;
  const elements = [];

  function drawLine(x1, y1, x2, y2) {
    elements.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="1.8" />`);
  }

  function drawNodeText(x, y, text) {
    const label = String(text);
    const width = Math.max(36, label.length * 9 + 18);
    elements.push(`
      <g transform="translate(${x}, ${y})">
        <rect x="${-width / 2}" y="-14" width="${width}" height="28" rx="6" fill="${pillFill}" stroke="${pillStroke}" stroke-width="1.4" />
        <text x="0" y="5" text-anchor="middle" fill="${textColor}" font-family="Consolas, monospace" font-size="13" font-weight="600">${escapeXml(label)}</text>
      </g>
    `);
  }

  function renderNodo(nodo, x, y) {
    if (!nodo) return y;

    if (nodo.tipo === "cadena") {
      drawNodeText(x, y, nodo.valor);
      return y + 28;
    }

    if (nodo.tipo === "cascada") {
      let currentY = y;
      nodo.nodos.forEach((sub, idx) => {
        if (idx > 0) {
          drawLine(x, currentY - 14, x, currentY + 14);
          currentY += 14;
        }
        currentY = renderNodo(sub, x, currentY);
      });
      return currentY;
    }

    if (nodo.tipo === "rombo_binario") {
      const leftX = x - 55;
      const rightX = x + 55;
      const midY = y + 32;
      const botY = y + 64;

      // Líneas superiores del rombo
      drawLine(x, y - 14, leftX, midY - 14);
      drawLine(x, y - 14, rightX, midY - 14);

      drawNodeText(leftX, midY, nodo.izq);

      if (typeof nodo.der === "object" && nodo.der.tipo === "sub_rombo") {
        drawNodeText(rightX, midY, nodo.der.op);
        const subLeftX = rightX - 42;
        const subRightX = rightX + 42;
        const subMidY = midY + 32;
        const subBotY = midY + 64;

        drawLine(rightX, midY + 14, subLeftX, subMidY - 14);
        drawLine(rightX, midY + 14, subRightX, subMidY - 14);
        drawNodeText(subLeftX, subMidY, nodo.der.izq);
        drawNodeText(subRightX, subMidY, nodo.der.der);

        if (nodo.cierre) {
          drawLine(leftX, midY + 14, x, subBotY - 14);
          drawLine(subLeftX, subMidY + 14, x, subBotY - 14);
          drawLine(subRightX, subMidY + 14, x, subBotY - 14);
          drawNodeText(x, subBotY, nodo.cierre);
          return subBotY + 28;
        }
        return subMidY + 28;
      } else {
        drawNodeText(rightX, midY, nodo.der);
        if (nodo.cierre) {
          drawLine(leftX, midY + 14, x, botY - 14);
          drawLine(rightX, midY + 14, x, botY - 14);
          drawNodeText(x, botY, nodo.cierre);
          return botY + 28;
        }
        return midY + 28;
      }
    }

    if (nodo.tipo === "rombo_multi") {
      const count = nodo.hijos.length;
      const spacing = 65;
      const totalWidth = (count - 1) * spacing;
      const startX = x - totalWidth / 2;
      const midY = y + 34;
      const botY = y + 68;

      nodo.hijos.forEach((h, idx) => {
        const hx = startX + idx * spacing;
        drawLine(x, y - 14, hx, midY - 14);
        drawNodeText(hx, midY, h);
        if (nodo.cierre) {
          drawLine(hx, midY + 14, x, botY - 14);
        }
      });

      if (nodo.cierre) {
        drawNodeText(x, botY, nodo.cierre);
        return botY + 28;
      }
      return midY + 28;
    }

    if (nodo.tipo === "bloque") {
      drawNodeText(x, y, nodo.simbolo);
      let nextY = y + 28;
      if (nodo.hijos.length === 1) {
        drawLine(x, nextY - 14, x, nextY + 14);
        nextY = renderNodo(nodo.hijos[0], x, nextY + 14);
      } else if (nodo.hijos.length > 1) {
        const colSpacing = 175;
        const totalW = (nodo.hijos.length - 1) * colSpacing;
        const startX = x - totalW / 2;
        let maxBranchY = nextY + 25;

        nodo.hijos.forEach((hijo, idx) => {
          const bx = startX + idx * colSpacing;
          drawLine(x, nextY - 14, bx, nextY + 18);
          const endY = renderNodo(hijo, bx, nextY + 28);
          if (endY > maxBranchY) maxBranchY = endY;
        });
        nextY = maxBranchY;
      }
      return nextY;
    }

    return y;
  }

  pasos.forEach((paso, idx) => {
    if (idx > 0) {
      drawLine(centerX, cursorY - 14, centerX, cursorY + 16);
      cursorY += 16;
    }
    cursorY = renderNodo(paso, centerX, cursorY);
  });

  svgEl.setAttribute("width", "660");
  svgEl.setAttribute("height", Math.max(460, cursorY + 40));
  svgEl.innerHTML = elements.join("");
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

    // 1. Tokenización
    ultimosTokens = tokenizarCodigo(codigo);

    // 2. Detección de lenguaje mediante diccionarios
    const lenguaje = detectarLenguajePorDiccionario(codigo, ultimosTokens);
    langBadge.classList.add("detected");
    langText.textContent = `Lenguaje detectado: ${lenguaje}`;

    // 3. Renderizado de Tokens
    pintarTokens();

    // 4. Análisis Sintáctico y Renderizado del Árbol
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

  // Permitir presionar la tecla Tab dentro del editor de código para insertar tabuladores reales
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
