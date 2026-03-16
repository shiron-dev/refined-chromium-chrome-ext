import type { UiStatus } from "../../../popup/styles";
import type { BulkReloadResult } from "../background";
import { useCallback, useState } from "react";
import { BackButton } from "../../../popup/BackButton";
import { baseCardStyle, getStatusColor } from "../../../popup/styles";

const extensionApi = (globalThis as { chrome?: { runtime?: { sendMessage: (msg: unknown) => Promise<any> } } }).chrome;

async function bulkReloadHealthyTabs(): Promise<BulkReloadResult> {
  if (!extensionApi?.runtime) {
    return { reloaded: 0, skipped: 0 };
  }

  return extensionApi.runtime.sendMessage({
    moduleId: "bulkTabReload",
    action: "bulkReloadHealthyTabs",
  }) as Promise<BulkReloadResult>;
}

export default function BulkTabReloadScreen({
  enabled = true,
  onBack,
  onToggle = () => {},
}: {
  enabled?: boolean
  onBack: () => void
  onToggle?: (enabled: boolean) => void
}) {
  const [status, setStatus] = useState<UiStatus>({ tone: "neutral", message: "" });
  const [loading, setLoading] = useState(false);

  const handleBulkReload = useCallback(async () => {
    setLoading(true);
    setStatus({ tone: "neutral", message: "" });

    try {
      const result = await bulkReloadHealthyTabs();
      setStatus({
        tone: "success",
        message: `${result.reloaded}個のタブをリロードしました。${result.skipped}個のタブをスキップしました。`,
      });
    }
    catch {
      setStatus({ tone: "warn", message: "リロード中にエラーが発生しました。" });
    }
    finally {
      setLoading(false);
    }
  }, []);

  const statusColor = getStatusColor(status.tone);

  return (
    <main style={{ padding: 16, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111827" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <BackButton onClick={onBack} />
        <h1 style={{ fontSize: 18, margin: 0 }}>タブ一斉リロード</h1>
      </div>

      <section style={{ ...baseCardStyle }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
          問題のないタブをまとめてリロードします。テキスト入力中などのタブは自動的にスキップされます。
        </p>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          style={{
            width: "100%",
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 8,
            background: enabled ? "#111827" : "#f3f4f6",
            color: enabled ? "#ffffff" : "#111827",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {enabled ? "モジュールを無効化" : "モジュールを有効化"}
        </button>
        <button
          type="button"
          onClick={() => {
            handleBulkReload().catch((error: unknown) => console.error(error));
          }}
          disabled={!enabled || loading}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 10,
            padding: "10px 12px",
            background: enabled && !loading ? "#111827" : "#9ca3af",
            color: "#ffffff",
            cursor: enabled && !loading ? "pointer" : "default",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {loading ? "リロード中..." : "問題のないタブを一斉リロード"}
        </button>
      </section>

      {status.message && (
        <p style={{ marginTop: 12, fontSize: 12, color: statusColor }}>
          {status.message}
        </p>
      )}
    </main>
  );
}
