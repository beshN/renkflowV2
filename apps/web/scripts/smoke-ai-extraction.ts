import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
async function main() {
  const { getAIService } = await import("../lib/ai/service");
  const sharp = (await import("sharp")).default;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="440"><rect width="1100" height="440" fill="white"/><g fill="black" font-family="Arial" font-size="36"><text x="40" y="70">TEST ORDER DOCUMENT</text><text x="40" y="140">Customer: Example Test Company</text><text x="40" y="205">Product: Scissor awning - Quantity: 2</text><text x="40" y="270">Width: 300 cm - Projection: 250 cm</text><text x="40" y="335">Mounting height: 310 cm - Body: Anthracite</text><text x="40" y="400">LED: warm white</text></g></svg>';
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const { extractedData } = await getAIService().analyzeDocument(
    png.toString("base64"),
    "image/png",
  );
  const assert = await import("node:assert/strict");
  assert.equal(extractedData.items[0].widthMm, 3000);
  assert.equal(extractedData.items[0].projectionMm, 2500, "image projection");
  assert.equal(extractedData.items[0].mountingHeightMm, 3100);
  assert.equal(extractedData.items[0].quantity, 2);
  assert.ok(extractedData.items[0].fieldEvidence?.some(e=>e.field==="widthMm" && e.value===3000 && e.sourceText));
  assert.ok(extractedData.fieldEvidence?.some(e=>e.field==="customerName"));
  console.log("PASS · native image extraction and field provenance");
  const pdfIndex = process.argv.indexOf("--pdf");
  if (pdfIndex >= 0) {
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(process.argv[pdfIndex + 1]);
    const pdf = await getAIService().analyzeDocument(
      bytes.toString("base64"),
      "application/pdf",
    );
    assert.equal(pdf.extractedData.items[0].widthMm, 7000);
    assert.equal(
      pdf.extractedData.items[0].projectionMm,
      2500,
      "PDF projection",
    );
    assert.equal(pdf.extractedData.items[0].mountingHeightMm, 3200);
    assert.equal(pdf.extractedData.items[0].quantity, 1);
    console.log(
      "PASS · actual Claude native PDF extraction from synthetic quote",
    );
  }
  console.log(
    "PASS · actual Claude image extraction: units, separate projection/mounting height, quantity",
  );
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "AI extraction failed");
    process.exit(1);
  });
