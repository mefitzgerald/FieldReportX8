// ─── Date / Time ──────────────────────────────────────────────────────────────

export const formatDateTime = (isoString?: string | null): string => {
  if (!isoString) return "Unknown date";
  const date = new Date(isoString);
  return (
    date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    "  " +
    date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
};

// ─── Report Status ────────────────────────────────────────────────────────────

export const statusLabel = (status?: string | null): string => {
  switch (status) {
    case "draft":
      return "Draft";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
    default:
      return "Unknown";
  }
};
