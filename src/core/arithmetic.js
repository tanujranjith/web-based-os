export function calculate(expression, degrees = false) {
  const input = expression
    .replaceAll("π", "pi")
    .replaceAll("×", "*")
    .replaceAll("÷", "/");
  let at = 0;
  const tokens =
    input.match(/(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?|[a-z]+|[+\-*/^()%!]/gi) ||
    [];
  if (tokens.join("") !== input.replace(/\s/g, ""))
    throw new Error("Invalid expression");
  const peek = () => tokens[at],
    take = () => tokens[at++];
  const funcs = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    ln: Math.log,
    log: Math.log10,
    sin: (x) => Math.sin(degrees ? (x * Math.PI) / 180 : x),
    cos: (x) => Math.cos(degrees ? (x * Math.PI) / 180 : x),
    tan: (x) => Math.tan(degrees ? (x * Math.PI) / 180 : x),
  };
  function primary() {
    const token = take();
    let value;
    if (token === "(") {
      value = sum();
      if (take() !== ")") throw new Error("Missing closing parenthesis");
    } else if (token === "pi") value = Math.PI;
    else if (token === "e") value = Math.E;
    else if (token in funcs) {
      if (take() !== "(") throw new Error("Use parentheses for functions");
      value = funcs[token](sum());
      if (take() !== ")") throw new Error("Missing closing parenthesis");
    } else if (token !== undefined && /^\d|^\./.test(token))
      value = Number(token);
    else throw new Error("Expected a number");
    while (peek() === "%" || peek() === "!") {
      if (take() === "%") value /= 100;
      else {
        if (!Number.isInteger(value) || value < 0 || value > 170)
          throw new Error("Factorial requires an integer from 0 to 170");
        let result = 1;
        for (let n = 2; n <= value; n++) result *= n;
        value = result;
      }
    }
    return value;
  }
  function power() {
    const value = primary();
    return peek() === "^" ? (take(), value ** unary()) : value;
  }
  function unary() {
    if (peek() === "+") {
      take();
      return unary();
    }
    if (peek() === "-") {
      take();
      return -unary();
    }
    return power();
  }
  function product() {
    let value = unary();
    while (peek() === "*" || peek() === "/") {
      const op = take(),
        rhs = unary();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }
  function sum() {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const op = take(),
        rhs = product();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }
  const value = sum();
  if (at !== tokens.length || !Number.isFinite(value))
    throw new Error("Expression has no finite result");
  return Number(value.toPrecision(13));
}
