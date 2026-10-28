const COLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type Grid = Record<string, string>;

export function cellId(col: number, row: number): string {
  return `${COLS[col] ?? "A"}${row}`;
}

export function evaluateGrid(grid: Grid): Record<string, string | number> {
  const cache = new Map<string, string | number>();
  const stack = new Set<string>();

  function evalCell(id: string): string | number {
    const key = id.toUpperCase();
    if (cache.has(key)) return cache.get(key)!;
    if (stack.has(key)) throw new Error("Référence circulaire");
    stack.add(key);
    const raw = (grid[key] ?? grid[id] ?? "").trim();
    let result: string | number = "";
    if (!raw) result = "";
    else if (raw.startsWith("=")) result = evalExpr(raw.slice(1));
    else {
      const n = Number(raw.replace(/\s/g, "").replace(",", "."));
      result = raw !== "" && Number.isFinite(n) && /^-?[\d\s]+([.,]\d+)?$/.test(raw) ? n : raw;
    }
    stack.delete(key);
    cache.set(key, result);
    return result;
  }

  function evalExpr(expr: string): number {
    let i = 0;
    const s = expr.replace(/\s/g, "");
    function peek() {
      return s[i] ?? "";
    }
    function parseExpr(): number {
      let value = parseTerm();
      while (peek() === "+" || peek() === "-") {
        const op = s[i++];
        const right = parseTerm();
        value = op === "+" ? value + right : value - right;
      }
      return value;
    }
    function parseTerm(): number {
      let value = parseFactor();
      while (peek() === "*" || peek() === "/") {
        const op = s[i++];
        const right = parseFactor();
        value = op === "*" ? value * right : right === 0 ? NaN : value / right;
      }
      return value;
    }
    function parseFactor(): number {
      if (peek() === "+") {
        i += 1;
        return parseFactor();
      }
      if (peek() === "-") {
        i += 1;
        return -parseFactor();
      }
      if (peek() === "(") {
        i += 1;
        const value = parseExpr();
        if (peek() === ")") i += 1;
        return value;
      }
      if (s.slice(i, i + 4).toUpperCase() === "SUM(") {
        i += 4;
        const start = i;
        while (peek() && peek() !== ")") i += 1;
        const inside = s.slice(start, i);
        if (peek() === ")") i += 1;
        return sumRange(inside);
      }
      const ref = /^(\$?[A-Z]\$?\d+)/i.exec(s.slice(i));
      if (ref) {
        i += ref[1].length;
        const v = evalCell(ref[1].replaceAll("$", ""));
        return typeof v === "number" ? v : Number(v) || 0;
      }
      const num = /^-?\d+(?:[.,]\d+)?/.exec(s.slice(i));
      if (num) {
        i += num[0].length;
        return Number(num[0].replace(",", "."));
      }
      throw new Error("Formule invalide");
    }
    function sumRange(inside: string): number {
      const m = /^(\$?[A-Z])\$?(\d+):(\$?[A-Z])\$?(\d+)$/i.exec(inside);
      if (!m) throw new Error("Plage invalide");
      const c1 = COLS.indexOf(m[1].replace("$", "").toUpperCase());
      const c2 = COLS.indexOf(m[3].replace("$", "").toUpperCase());
      const r1 = Number(m[2]);
      const r2 = Number(m[4]);
      let total = 0;
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c += 1) {
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r += 1) {
          const v = evalCell(cellId(c, r));
          if (typeof v === "number") total += v;
        }
      }
      return total;
    }
    const value = parseExpr();
    if (!Number.isFinite(value)) throw new Error("Calcul impossible");
    return Math.round(value * 100) / 100;
  }

  const out: Record<string, string | number> = {};
  const ids = new Set<string>(Object.keys(grid).map((k) => k.toUpperCase()));
  for (const id of ids) {
    try {
      out[id] = evalCell(id);
    } catch (error) {
      out[id] = error instanceof Error ? error.message : "Erreur";
    }
  }
  return out;
}
