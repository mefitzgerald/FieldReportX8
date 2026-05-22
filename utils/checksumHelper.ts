// Generates a lightweight integrity fingerprint from the report data.
// Not cryptographic — used to detect if a report has been modified after submission.
// Uses a djb2-style hash: (hash * 31) + charCode, accumulated over every character.
// `hash |= 0` clamps the value to a signed 32-bit integer each iteration to prevent
// the number from growing beyond JavaScript's safe integer range.
export const generateChecksum = (data: object): string => {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
};
