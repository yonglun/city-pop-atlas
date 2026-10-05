// D1 limits each bound string to 2,000,000 bytes. Keep the existing margin.
export const SNAPSHOT_JSON_LIMIT = 1_800_000;
export function snapshotJSONChunks(rows, limit = SNAPSHOT_JSON_LIMIT) {
  if (!Number.isInteger(limit) || limit < 2 || limit > SNAPSHOT_JSON_LIMIT) throw new Error('Invalid snapshot chunk limit');
  const encoder = new TextEncoder(), chunks = [];
  let entries = [], bytes = 2; // JSON array brackets.
  for (const row of rows) {
    const text = JSON.stringify(row);
    if (text === undefined) throw new Error('Invalid snapshot row');
    const rowBytes = encoder.encode(text).length;
    if (rowBytes + 2 > limit) throw new Error('Snapshot row exceeds safe JSON parameter size');
    if (entries.length && bytes + 1 + rowBytes > limit) {
      chunks.push('[' + entries.join(',') + ']');
      entries = []; bytes = 2;
    }
    bytes += rowBytes + (entries.length ? 1 : 0);
    entries.push(text);
  }
  if (entries.length) chunks.push('[' + entries.join(',') + ']');
  return chunks;
}
