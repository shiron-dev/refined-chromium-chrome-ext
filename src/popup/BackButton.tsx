/**
 * Shared back button component for popup detail screens
 */

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontSize: 14,
        color: "#374151",
        display: "flex",
        alignItems: "center",
      }}
    >
      ←
    </button>
  );
}
