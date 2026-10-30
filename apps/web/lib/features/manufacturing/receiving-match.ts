import { sameColor } from "../colors/color-spec";
type Expected = {
  id: string;
  name: string;
  profileCode: string | null;
  color: string | null;
  lengthMm: number | null;
};
/** Candidate matching never converts documentary totals into physical lengths or stock. */
export function receivingMatches(
  rows: Array<Record<string, any>>,
  expected: Expected[],
) {
  return rows.map((row, rowIndex) => {
    const candidates = expected
      .filter((line) => {
        if (row.profileCode)
          return (
            line.profileCode?.trim().toLocaleUpperCase("tr-TR") ===
            String(row.profileCode).trim().toLocaleUpperCase("tr-TR")
          );
        const text = String(
          row.text || row.productName || row.name || "",
        ).toLocaleUpperCase("tr-TR");
        return (
          !!line.profileCode &&
          text
            .split(/[^\p{L}\p{N}-]+/u)
            .includes(line.profileCode.toLocaleUpperCase("tr-TR"))
        );
      })
      .map((line) => ({
        lineId: line.id,
        name: line.name,
        issues: [
          ...(row.color && line.color && !sameColor(row.color, line.color)
            ? ["Belgedeki renk siparişten farklı"]
            : []),
          ...(row.lengthMm &&
          line.lengthMm &&
          Number(row.lengthMm) !== Number(line.lengthMm)
            ? ["Belgedeki tek profil boyu siparişten farklı"]
            : []),
        ],
      }));
    return {
      rowIndex,
      candidates,
      suggestedLineId: candidates.length === 1 ? candidates[0].lineId : null,
      requiresReview: true,
    };
  });
}
