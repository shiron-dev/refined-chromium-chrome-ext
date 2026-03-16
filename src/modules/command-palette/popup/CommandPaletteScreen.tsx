import { BackButton } from "../../../popup/BackButton";
import { baseCardStyle } from "../../../popup/styles";

export default function CommandPaletteScreen({
  enabled = true,
  onBack,
  onToggle = () => {},
}: {
  enabled?: boolean
  onBack: () => void
  onToggle?: (enabled: boolean) => void
}) {
  return (
    <main style={{ padding: 16, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <BackButton onClick={onBack} />
        <h1 style={{ fontSize: 18, margin: 0 }}>Command Palette</h1>
      </div>

      <section style={{ ...baseCardStyle, marginBottom: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#374151" }}>
          ページ上で
          {" "}
          <strong>⌘K</strong>
          {" "}
          (Mac) /
          {" "}
          <strong>Ctrl+K</strong>
          {" "}
          (Windows/Linux)
          を押すとCommand Paletteが開きます。
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#374151" }}>
          現在の機能: タブの検索 &amp; 切り替え
        </p>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: enabled ? "#dc2626" : "#16a34a",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {enabled ? "無効にする" : "有効にする"}
        </button>
      </section>
    </main>
  );
}
