import type { ModuleManifest, PopupCard } from "./types";

export class ModuleRegistry {
  private manifests: ModuleManifest[] = [];

  register(manifest: ModuleManifest): void {
    // Skip if already registered
    if (this.manifests.some(m => m.id === manifest.id)) {
      return;
    }
    this.manifests.push(manifest);
  }

  getAll(): ReadonlyArray<ModuleManifest> {
    return this.manifests;
  }

  getPopupCards(): PopupCard[] {
    return this.manifests.flatMap(m => m.popupCards);
  }

  getDefaultSettings(): Record<string, { enabled: boolean }> {
    return Object.fromEntries(
      this.manifests.map(m => [m.id, { enabled: m.defaultEnabled }]),
    );
  }
}

// Global singleton
export const registry = new ModuleRegistry();
