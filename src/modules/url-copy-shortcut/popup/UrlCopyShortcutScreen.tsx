import { BackButton } from "../../../popup/BackButton";
import { baseCardStyle } from "../../../popup/styles";

export default function UrlCopyShortcutScreen({
  enabled = true,
  onBack,
  onToggle = () => {},
}: {
  enabled?: boolean
  onBack: () => void
  onToggle?: (enabled: boolean) => void
}) {
  return (
    <main style={{ padding: 16, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111827" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <BackButton onClick={onBack} />
        <h1 style={{ fontSize: 18, margin: 0 }}>URL Copy Shortcut</h1>
      </div>

      <section style={{ ...baseCardStyle }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>ショートカット</p>
        <p style={{ margin: 0, fontSize: 12, color: "#374151" }}>mac: Command + Shift + C</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#374151" }}>Windows/Linux: Ctrl + Shift + C</p>
      </section>

      <section style={{ ...baseCardStyle, marginTop: 12, background: "#f9fafb" }}>
        <p style={{ margin: 0, fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
          Webページ上でショートカットを押すと、現在のページURLをクリップボードへコピーします。
          コピー後は右上に完了トーストを表示します。
        </p>
      </section>

      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 10,
          padding: "10px 12px",
          marginTop: 12,
          background: enabled ? "#111827" : "#f3f4f6",
          color: enabled ? "#ffffff" : "#111827",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {enabled ? "モジュールを無効化" : "モジュールを有効化"}
      </button>
    </main>
  );
}
