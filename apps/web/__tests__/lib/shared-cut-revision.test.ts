import { remainingSharedBars } from "@/lib/features/orders/shared-cut-revision";
const parameters = {
  kerfMm: 3,
  trimStartMm: 5,
  trimEndMm: 5,
  minimumRemnantMm: 500,
  standardLengthMm: 6000,
};
it("keeps other assignments and recalculates kerf/remnant only for cuts that did not happen", () => {
  const source = {
    id: "bar",
    itemId: "profile",
    color: "RAL 7016 Mat",
    lengthMm: 6000,
    unitCost: 2,
    isRemnant: false,
  };
  const bar = {
    source,
    pieces: [
      { workOrderId: "a", lengthMm: 2000 },
      { workOrderId: "b", lengthMm: 1000 },
      { workOrderId: "c", lengthMm: 1500 },
    ],
    usedMm: 4519,
    remainingMm: 1481,
    reusable: true,
    lossMm: 19,
  };
  const result = remainingSharedBars(
    [bar],
    new Set(["a"]),
    new Set(),
    parameters,
  );
  expect(result).toEqual([
    {
      ...bar,
      pieces: bar.pieces.slice(1),
      usedMm: 2516,
      remainingMm: 3484,
      lossMm: 16,
    },
  ]);
  expect(
    remainingSharedBars([bar], new Set(["a"]), new Set(["bar"]), parameters),
  ).toEqual([]);
  expect(bar.pieces).toHaveLength(3);
});
