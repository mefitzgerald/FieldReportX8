// Escapes HTML special characters in user-supplied text before it is embedded
// in generated HTML or PDF content. Prevents injected markup from being
// interpreted as code rather than displayed as plain text.
export const sanitizeText = (input: string): string =>
  input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
