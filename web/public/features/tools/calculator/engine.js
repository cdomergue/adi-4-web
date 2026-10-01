// ADI4.EXE external 457 uses radians and restricts inverse sine/cosine to [0, 1].
// ADI4_CAL.TOT: immediate binary evaluation, ten input digits, ten nested groups.
const binary = { '+': (a, b) => a + b, '-': (a, b) => a - b,
  '*': (a, b) => a * b, '/': (a, b) => a / b };
const unary = { square: x => x * x, sqrt: Math.sqrt, reciprocal: x => 1 / x,
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: x => x < 0 || x > 1 ? NaN : Math.asin(x), acos: x => x < 0 || x > 1 ? NaN : Math.acos(x), atan: Math.atan };
export function formatNumber(number) {
  if (!Number.isFinite(number)) return 'Erreur';
  if (Object.is(number, -0) || Math.abs(number) < 1e-99) return '0';
  const rounded = Number(number.toPrecision(10));
  const text = String(rounded);
  return text.length <= 12 ? text : rounded.toExponential(5).replace(/\.?0+e/, 'e');
}
export function createCalculator() {
  let input, value, accumulator, operator, fresh, stack, error, waiting;
  function clear() {
    input = '0'; value = 0; accumulator = null; operator = null;
    fresh = true; stack = []; error = false; waiting = false;
  }
  clear();
  function result(n) {
    value = n; input = formatNumber(n); fresh = true;
    error = input === 'Erreur';
  }
  function number() {
    return fresh ? value : Number(input.replace(/e[+-]?$/, ''));
  }
  function evaluate() {
    const n = number();
    if (operator !== null && accumulator !== null) result(binary[operator](accumulator, n));
    else result(n);
    accumulator = null; operator = null;
  }
  return {
    get display() { return input; },
    get depth() { return stack.length; },
    press(key) {
      if (key === 'C') { clear(); return input; }
      if (error) return input;
      if (/^\d$/.test(key)) {
        waiting = false;
        if (fresh) { input = '0'; fresh = false; }
        const digits = input.replace(/[^0-9]/g, '').length;
        const exponent = input.split('e')[1];
        if (digits < 10 && (!exponent || exponent.replace(/[+-]/, '').length < 2)) {
          input = input === '0' ? key : input === '-0' ? '-' + key : input + key;
        }
      } else if (key === '.') {
        waiting = false;
        if (fresh) { input = '0'; fresh = false; }
        if (!/[.e]/.test(input)) input += '.';
      } else if (key === 'E') {
        waiting = false;
        if (fresh) { input = value === 0 ? '1' : formatNumber(value); fresh = false; }
        if (!input.includes('e')) input += 'e+';
      } else if (key === 'sign') {
        if (waiting || (fresh && value === 0)) { input = '0'; fresh = false; waiting = false; }
        if (input.includes('e') && !fresh) input = input.replace(/e([+-])/, (_, s) => 'e' + (s === '+' ? '-' : '+'));
        else { input = input.startsWith('-') ? input.slice(1) : '-' + input; value = -value; }
      } else if (key === 'Backspace' && !fresh) {
        input = input.slice(0, -1) || '0';
        if (input === '-') input = '0';
      } else if (binary[key]) {
        if (operator && waiting) { operator = key; return input; }
        if (operator) evaluate();
        if (!error) { accumulator = number(); value = accumulator; operator = key; fresh = true; waiting = true; }
      } else if (unary[key]) { result(unary[key](number())); waiting = false; }
      else if (key === '(' && stack.length < 10) {
        stack.push({ accumulator, operator }); accumulator = null; operator = null;
        result(0); waiting = false;
      } else if (key === ')' && stack.length) {
        evaluate(); const saved = stack.pop(); accumulator = saved.accumulator; operator = saved.operator;
        // The closed group is the right operand of its enclosing calculation.
        fresh = false; waiting = false;
      } else if (key === '=') {
        evaluate();
        while (stack.length && !error) {
          const saved = stack.pop(); accumulator = saved.accumulator; operator = saved.operator; evaluate();
        }
      }
      return input;
    },
  };
}
