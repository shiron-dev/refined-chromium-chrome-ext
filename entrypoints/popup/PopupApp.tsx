import type { ModuleManifest, PopupCard } from "../../src/core/types";

import { useCallback, useEffect, useState } from "react";

import { registry } from "../../src/core/registry";
import { getModuleSettings, setModuleEnabled } from "../../src/core/settings";
import { baseCardStyle } from "../../src/popup/styles";

// Auto-collect all module manifests
const moduleFiles = import.meta.glob<{ default: ModuleManifest }>(
  "../../src/modules/*/index.ts",
  { eager: true },
);

for (const mod of Object.values(moduleFiles)) {
  registry.register(mod.default);
}

interface ModuleSettings {
  [moduleId: string]: { enabled: boolean }
}

function HomeScreen({
  cards,
  moduleSettings,
  onNavigate,
  onToggle,
}: {
  cards: PopupCard[]
  moduleSettings: ModuleSettings
  onNavigate: (cardId: string) => void
  onToggle: (moduleId: string, enabled: boolean) => void
}) {
  return (
    <main style={{ padding: 16, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111827" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 16px" }}>拡張機能モジュール</h1>

      <div style={{ display: "grid", gap: 12 }}>
        {cards.map((card) => {
          const enabled = card.settingKey ? moduleSettings[card.settingKey]?.enabled ?? true : true;

          return (
            <div
              key={card.id}
              role="button"
              tabIndex={0}
              onClick={() => onNavigate(card.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onNavigate(card.id);
                }
              }}
              style={{
                ...baseCardStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{card.title}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>
                  {card.description}
                </p>
              </div>
              {card.settingKey && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(card.settingKey!, !enabled);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      background: enabled ? "#111827" : "#f3f4f6",
                      color: enabled ? "#ffffff" : "#6b7280",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {enabled ? "有効" : "無効"}
                  </button>
                  <span style={{ fontSize: 16, color: "#9ca3af" }}>›</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

type PopupView = string | "home";

export default function PopupApp() {
  const [view, setView] = useState<PopupView>("home");
  const [moduleSettings, setModuleSettingsState] = useState<ModuleSettings>({});

  const defaultSettings: ModuleSettings = Object.fromEntries(
    registry.getAll().map(m => [m.id, { enabled: m.defaultEnabled }]),
  );

  useEffect(() => {
    getModuleSettings()
      .then(settings => setModuleSettingsState({ ...defaultSettings, ...settings }))
      .catch((error: unknown) => console.error(error));
  }, []);

  const handleToggleModule = useCallback(async (moduleId: string, enabled: boolean) => {
    await setModuleEnabled(moduleId, enabled);
    setModuleSettingsState(prev => ({
      ...prev,
      [moduleId]: { enabled },
    }));
  }, []);

  const cards = registry.getPopupCards();
  const card = cards.find(c => c.id === view);

  if (card && view !== "home") {
    const enabled = card.settingKey ? moduleSettings[card.settingKey]?.enabled ?? true : true;
    const onToggle = card.settingKey
      ? (e: boolean) => handleToggleModule(card.settingKey!, e)
      : undefined;
    return (
      <card.DetailScreen
        onBack={() => {
          setView("home");
        }}
        enabled={enabled}
        onToggle={onToggle}
      />
    );
  }

  return (
    <HomeScreen
      cards={cards}
      moduleSettings={moduleSettings}
      onNavigate={setView}
      onToggle={handleToggleModule}
    />
  );
}
