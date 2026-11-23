/**
 * Diccionarios formales de sintaxis y léxico por lenguaje de programación.
 * Utilizados tanto para la detección automática del lenguaje como para la
 * clasificación estricta de palabras reservadas en el analizador léxico.
 */
const DICCIONARIOS_LENGUAJES = {
  Python: {
    nombre: "Python",
    usaIndentacion: true,
    palabrasReservadas: [
      "def", "class", "if", "elif", "else", "for", "while", "in", "return",
      "import", "from", "as", "print", "True", "False", "None", "and", "or",
      "not", "is", "try", "except", "finally", "with", "lambda", "pass", "break", "continue"
    ],
    operadoresPropios: ["**", "//", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/="],
    patronesSintacticos: [
      /^\s*def\s+[a-zA-Z_]\w*\s*\(.*\)\s*:/m,
      /^\s*class\s+[a-zA-Z_]\w*(\(.*\))?\s*:/m,
      /^\s*(if|elif|else|for|while)\b.*:\s*$/m,
      /\bprint\s*\(/,
      /^\s*from\s+\w+\s+import\b/m
    ],
    penalizaciones: [/;$/m, /\{/, /\}/, /\bint\s+\w+\s*=/]
  },

  Java: {
    nombre: "Java",
    usaIndentacion: false,
    palabrasReservadas: [
      "public", "private", "protected", "class", "interface", "extends", "implements",
      "static", "final", "void", "int", "double", "float", "boolean", "char", "String",
      "new", "return", "if", "else", "for", "while", "do", "switch", "case", "break",
      "import", "package", "this", "super", "try", "catch", "System", "out", "println", "print"
    ],
    operadoresPropios: ["==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-="],
    patronesSintacticos: [
      /\bpublic\s+(static\s+)?(class|void|int|String)\b/,
      /\bSystem\.out\.print(ln)?\s*\(/,
      /\bString\s*\[\s*\]\s*\w+/,
      /\bimport\s+java\./
    ],
    penalizaciones: [/^#include/m, /\bfn\s+main/, /:=/]
  },

  C: {
    nombre: "C",
    usaIndentacion: false,
    palabrasReservadas: [
      "int", "void", "char", "float", "double", "long", "short", "unsigned", "signed",
      "struct", "typedef", "enum", "union", "const", "static", "extern", "return",
      "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
      "printf", "scanf", "include", "define", "main", "sizeof"
    ],
    operadoresPropios: ["->", "++", "--", "==", "!=", "<=", ">=", "&&", "||", "+=", "-="],
    patronesSintacticos: [
      /#include\s*<(stdio|stdlib|string|math)\.h>/,
      /#define\s+\w+/,
      /\bprintf\s*\(\s*".*%[dfsc].*"/,
      /\bscanf\s*\(/,
      /\b(int|void)\s+main\s*\(/
    ],
    penalizaciones: [/\bstd::/, /\bcout\b/, /\bSystem\.out/, /\bfn\s+/, /:=/]
  },

  "C++": {
    nombre: "C++",
    usaIndentacion: false,
    palabrasReservadas: [
      "int", "void", "char", "float", "double", "bool", "string", "auto", "class",
      "struct", "public", "private", "protected", "namespace", "using", "template",
      "typename", "virtual", "override", "new", "delete", "nullptr", "return",
      "if", "else", "for", "while", "std", "cout", "cin", "endl", "include", "define", "main"
    ],
    operadoresPropios: ["::", "<<", ">>", "->", "++", "--", "==", "!=", "<=", ">=", "&&", "||"],
    patronesSintacticos: [
      /#include\s*<(iostream|vector|string|algorithm)>/,
      /\busing\s+namespace\s+std\s*;/,
      /\bstd::(cout|cin|string|vector|endl)\b/,
      /\bcout\s*<<\s*/
    ],
    penalizaciones: [/\bSystem\.out/, /\bfn\s+/, /:=/]
  },

  Rust: {
    nombre: "Rust",
    usaIndentacion: false,
    palabrasReservadas: [
      "fn", "let", "mut", "const", "pub", "struct", "enum", "impl", "trait", "for",
      "in", "while", "loop", "if", "else", "match", "return", "use", "mod", "crate",
      "self", "Self", "i8", "i16", "i32", "i64", "u8", "u16", "u32", "u64", "f32", "f64",
      "bool", "str", "String", "println", "print", "vec", "Some", "None", "Ok", "Err"
    ],
    operadoresPropios: ["->", "=>", "::", "..", "..=", "==", "!=", "<=", ">=", "&&", "||"],
    patronesSintacticos: [
      /\bfn\s+[a-zA-Z_]\w*\s*\(/,
      /\blet\s+(mut\s+)?[a-zA-Z_]\w*/,
      /\bprintln!\s*\(/,
      /->\s*(i32|i64|u32|f64|bool|String|Self)\b/
    ],
    penalizaciones: [/#include/, /\bSystem\.out/, /\bprintf\s*\(/]
  },

  Go: {
    nombre: "Go",
    usaIndentacion: false,
    palabrasReservadas: [
      "package", "import", "func", "var", "const", "type", "struct", "interface",
      "map", "chan", "go", "select", "defer", "range", "return", "if", "else",
      "for", "switch", "case", "default", "break", "continue", "int", "string",
      "float64", "bool", "fmt", "Println", "Printf", "main"
    ],
    operadoresPropios: [":=", "<-", "++", "--", "==", "!=", "<=", ">=", "&&", "||"],
    patronesSintacticos: [
      /^\s*package\s+\w+/m,
      /\bfunc\s+[a-zA-Z_]\w*\s*\(/,
      /[a-zA-Z_]\w*\s*:=\s*/,
      /\bfmt\.(Println|Printf|Print)\s*\(/
    ],
    penalizaciones: [/;$/m, /#include/, /\bSystem\.out/, /\bfn\s+/]
  }
};

// Conjunto unificado de todas las palabras reservadas para clasificación léxica universal
const TODAS_RESERVADAS = new Set(
  Object.values(DICCIONARIOS_LENGUAJES).flatMap(lang => lang.palabrasReservadas)
);

/**
 * Evalúa el código fuente contra todos los diccionarios de lenguajes
 * y devuelve el lenguaje con mayor coincidencia léxica y sintáctica.
 */
function detectarLenguajePorDiccionario(codigo, tokens) {
  if (!codigo.trim()) return "Esperando código...";

  const puntuaciones = {};
  const identificadores = tokens
    .filter(t => t.tipo === "palabra reservada" || t.tipo === "variable")
    .map(t => t.valor);

  for (const [nombreLang, dict] of Object.entries(DICCIONARIOS_LENGUAJES)) {
    let puntos = 0;

    // 1. Coincidencia de palabras reservadas propias del lenguaje
    for (const id of identificadores) {
      if (dict.palabrasReservadas.includes(id)) {
        puntos += 2;
      }
    }

    // 2. Coincidencia de reglas sintácticas específicas
    for (const regex of dict.patronesSintacticos) {
      if (regex.test(codigo)) {
        puntos += 6;
      }
    }

    // 3. Penalización por construcciones incompatibles con ese lenguaje
    for (const pen of dict.penalizaciones) {
      if (pen.test(codigo)) {
        puntos -= 4;
      }
    }

    // 4. Bonificación si el lenguaje usa indentación significativa (tabuladores o 4 espacios)
    if (dict.usaIndentacion && (/^\t+/m.test(codigo) || /^ {4}/m.test(codigo)) && !/[{}]/.test(codigo)) {
      puntos += 3;
    }

    puntuaciones[nombreLang] = puntos;
  }

  let mejorLenguaje = "Genérico";
  let maxPuntos = 0;

  for (const [lang, pts] of Object.entries(puntuaciones)) {
    if (pts > maxPuntos) {
      maxPuntos = pts;
      mejorLenguaje = lang;
    }
  }

  return maxPuntos > 0 ? mejorLenguaje : "Genérico / Pseudocódigo";
}

