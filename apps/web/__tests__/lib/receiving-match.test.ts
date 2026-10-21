import { receivingMatches } from "@/lib/features/manufacturing/receiving-match";
describe("receiving document candidates", () => {
  const expected = [
    {
      id: "a",
      name: "170 Dere",
      profileCode: "170",
      color: "RAL 7016 Mat",
      lengthMm: 6000,
    },
  ];
  it("flags a documented difference without converting totals into a bar length", () => {
    const [match] = receivingMatches(
      [{ profileCode: "170", color: "RAL 9005 Mat", quantity: 12, unit: "m" }],
      expected,
    );
    expect(match.suggestedLineId).toBe("a");
    expect(match.candidates[0].issues).toEqual([
      "Belgedeki renk siparişten farklı",
    ]);
    expect(match).not.toHaveProperty("lengthMm");
    expect(match.requiresReview).toBe(true);
  });
  it("keeps ambiguous and missing codes unresolved", () => {
    const matches = receivingMatches(
      [{ text: "170 Dere 12 m" }, { profileCode: "1700" }],
      [...expected, { ...expected[0], id: "b" }],
    );
    expect(matches[0].suggestedLineId).toBeNull();
    expect(matches[0].candidates).toHaveLength(2);
    expect(matches[1].candidates).toEqual([]);
  });
});
