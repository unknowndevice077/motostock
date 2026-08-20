import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Checks GitHub Releases (see tauri.conf.json's plugins.updater.endpoints)
 * for a newer signed build, and downloads it in the background if found.
 * Never throws — a failed check (offline, no releases yet, running outside
 * a Tauri window in `next dev`) just means no update, same as none found.
 */
export async function checkForUpdate(): Promise<Update | null> {
  try {
    const update = await check();
    if (!update?.available) return null;
    await update.downloadAndInstall();
    return update;
  } catch (err) {
    // Not an application error — no release published yet, offline, or a
    // transient network hiccup are all normal, expected outcomes here.
    // console.warn (not .error) so Next's dev overlay doesn't treat a
    // silently-handled "nothing to update" as a crash.
    console.warn("Update check found nothing (this is normal until a release is published):", err);
    return null;
  }
}

/** Restarts the app to finish applying an already-downloaded update. */
export async function restartToApplyUpdate(): Promise<void> {
  await relaunch();
}
