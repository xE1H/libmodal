import { expect, test } from "vitest";

import { sum } from "..";

test("sum from native", () => {
  expect(sum(1, 2)).toBe(3);
});
