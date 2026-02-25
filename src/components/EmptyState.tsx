interface EmptyStateProps {
  visible: boolean;
  message?: string;
}

export default function EmptyState({ visible, message }: EmptyStateProps) {
  if (!visible) return null;

  return (
    <div className="dlv-empty-state">
      {message || "No data found for the selected filters."}
    </div>
  );
}
