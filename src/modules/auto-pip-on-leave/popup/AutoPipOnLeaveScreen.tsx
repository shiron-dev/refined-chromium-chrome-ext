import { BackButton } from "../../../popup/BackButton";
import { baseCardStyle } from "../../../popup/styles";

export default function AutoPipOnLeaveScreen({
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
        <h1 style={{ fontSize: 18, margin: 0 }}>Auto PiP on Leave</h1>
      </div>

      <section style={{ ...baseCardStyle }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
          タブを離れた際に再生中の動画があれば、自動でピクチャーインピクチャーを起動します。
        </p>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          style={{
            width: "100%",
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: "10px 12px",
            background: enabled ? "#111827" : "#f3f4f6",
            color: enabled ? "#ffffff" : "#111827",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {enabled ? "モジュールを無効化" : "モジュールを有効化"}
        </button>
      </section>
    </main>
  );
}
