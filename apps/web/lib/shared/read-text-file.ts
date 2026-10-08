/** A text file as Excel in Turkish saves it: UTF-8 when it is valid UTF-8, otherwise Windows-1254. */
export async function readTextFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1254').decode(bytes);
  }
}
