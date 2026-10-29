import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../src/core/arithmetic.js";
test("scientific calculator honors precedence, functions and angle mode", () => {
  assert.equal(calculate("2+3*4"), 14);
  assert.equal(calculate("-2^2"), -4);
  assert.equal(calculate("2^3^2"), 512);
  assert.equal(calculate("sin(30)", true), 0.5);
  assert.equal(calculate("sqrt(9)+5!"), 123);
  assert.equal(calculate("50%*80"), 40);
});
test("calculator rejects invalid syntax and non-finite results", () => {
  for (const text of [
    "1/0",
    "sqrt(-1)",
    "globalThis",
    "2+",
    "2abc",
    "1;alert(1)",
  ])
    assert.throws(() => calculate(text));
});
