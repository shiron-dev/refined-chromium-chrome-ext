import type { UiStatus } from "../../../popup/styles";
import type { AutoPinStateResponse, AutoPinTabEntry, RegisterCurrentResponse, UnregisterResponse } from "./types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackButton } from "../../../popup/BackButton";
import { baseCardStyle, getStatusColor } from "../../../popup/styles";

const extensionApi = (globalThis as { chrome?: { runtime?: { sendMessage: (msg: unknown) => Promise<any> } } }).chrome;

async function fetchState(): Promise<AutoPinStateResponse> {
  if (!extensionApi?.runtime) {
    return { entries: [] };
  }

  const response = await extensionApi.runtime.sendMessage({ moduleId: "autoPinOnLeave", action: "getState" }) as Partial<AutoPinStateResponse>;
  if (!Array.isArray(response.entries)) {
    return { entries: [] };
  }

  return {
    entries: response.entries.filter((e): e is AutoPinTabEntry => (
      typeof e.tabId === "number"
      && typeof e.url === "string"
      && typeof e.title === "string"
      && typeof e.registeredAt === "number"
    )),
  };
}

async function registerCurrent(): Promise<RegisterCurrentResponse> {
  if (!extensionApi?.runtime) {
    return { ok: false, reason: "no_active_tab" };
  }

  return extensionApi.runtime.sendMessage({ moduleId: "autoPinOnLeave", action: "registerCurrent" }) as Promise<RegisterCurrentResponse>;
}

async function unregister(tabId: number): Promise<UnregisterResponse> {
  if (!extensionApi?.runtime) {
    return { ok: false, reason: "not_found" };
  }

  return extensionApi.runtime.sendMessage({ moduleId: "autoPinOnLeave", action: "unregister", payload: { tabId } }) as Promise<UnregisterResponse>;
}

export default function AutoPinOnLeaveScreen({
  enabled = true,
  onBack,
  onToggle = () => {},
}: {
  enabled?: boolean
  onBack: () => void
  onToggle?: (enabled: boolean) => void
}) {
  const [entries, setEntries] = useState<AutoPinTabEntry[]>([]);
  const [status, setStatus] = useState<UiStatus>({ tone: "neutral", message: "" });

  const reloadEntries = useCallback(async () => {
    const state = await fetchState();
    setEntries(state.entries);
  }, []);

  useEffect(() => {
    reloadEntries().catch((error: unknown) => console.error(error));
  }, [reloadEntries]);

  const handleRegister = useCallback(async () => {
    const result = await registerCurrent();

    if (!result.ok && result.reason === "no_active_tab") {
      setStatus({ tone: "warn", message: "現在タブを取得できませんでした。" });
      return;
    }

    if (!result.ok && result.reason === "unsupported_url") {
      setStatus({ tone: "warn", message: "このURLは登録できません。" });
      return;
    }

    if (!result.ok && result.reason === "already_registered") {
      setStatus({ tone: "neutral", message: "このタブはすでに登録済みです。" });
      await reloadEntries();
      return;
    }

    setStatus({ tone: "success", message: "現在タブを登録しました。タブを離れると自動でpinされます。" });
    await reloadEntries();
  }, [reloadEntries]);

  const handleUnregister = useCallback(async (tabId: number) => {
    const result = await unregister(tabId);

    if (!result.ok) {
      setStatus({ tone: "warn", message: "登録解除に失敗しました。" });
      await reloadEntries();
      return;
    }

    setStatus({ tone: "success", message: "登録を解除しました。" });
    await reloadEntries();
  }, [reloadEntries]);

  const statusColor = useMemo(() => getStatusColor(status.tone), [status.tone]);

  return (
    <main style={{ padding: 16, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111827" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <BackButton onClick={onBack} />
        <h1 style={{ fontSize: 18, margin: 0 }}>Auto Pin on Leave</h1>
      </div>

      <section style={{ ...baseCardStyle }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
          登録したタブから離れると自動でpinされます。登録解除するとpinも外れます。
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
            handleRegister().catch((error: unknown) => console.error(error));
          }}
          disabled={!enabled}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 10,
            padding: "10px 12px",
            background: enabled ? "#111827" : "#9ca3af",
            color: "#ffffff",
            cursor: enabled ? "pointer" : "default",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          現在タブを登録
        </button>
      </section>

      {status.message && (
        <p style={{ marginTop: 12, fontSize: 12, color: statusColor }}>
          {status.message}
        </p>
      )}

      <section style={{ ...baseCardStyle, marginTop: 12 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 14 }}>
          登録済みタブ
          {" "}
          (
          {entries.length}
          )
        </h2>

        {entries.length === 0
          ? (
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>登録済みタブはありません。</p>
            )
          : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {entries.map(entry => (
                  <li key={entry.tabId} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, wordBreak: "break-all", color: "#111827" }}>
                      {entry.title}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280", wordBreak: "break-all" }}>
                      {entry.url}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
                      tabId:
                      {" "}
                      {entry.tabId}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleUnregister(entry.tabId).catch((error: unknown) => console.error(error));
                      }}
                      disabled={!enabled}
                      style={{
                        width: "100%",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        padding: "6px 8px",
                        marginTop: 8,
                        background: enabled ? "#ffffff" : "#f3f4f6",
                        color: enabled ? "#111827" : "#9ca3af",
                        cursor: enabled ? "pointer" : "default",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      登録解除
                    </button>
                  </li>
                ))}
              </ul>
            )}
      </section>
    </main>
  );
}
