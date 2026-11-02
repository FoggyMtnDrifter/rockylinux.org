import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import type {
  PlatformId,
  ProcessedArchitectures,
  Release,
} from "@/types/downloads";
import {
  availableArchs,
  availablePlatforms,
  listReleases,
  resolveArch,
  resolvePlatform,
} from "@/utils/downloadSelection";

interface RawSelection {
  version: string | null;
  platform: string | null;
  arch: string | null;
}

const fromParams = (params: URLSearchParams): RawSelection => ({
  version: params.get("version"),
  platform: params.get("platform"),
  arch: params.get("arch"),
});

export interface DownloadSelection {
  releases: Release[];
  release: Release | undefined;
  platforms: PlatformId[];
  platform: PlatformId;
  archs: string[];
  arch: string | undefined;
  selectRelease: (versionId: string) => void;
  selectPlatform: (platform: PlatformId) => void;
  selectArch: (arch: string) => void;
}

/**
 * The release, platform and architecture on screen, kept in the URL
 * (?version=&platform=&arch=) so any result can be linked to directly.
 *
 * Requested values the data cannot satisfy fall back to something else (see
 * `resolvePlatform` and `resolveArch`). The URL always gets the values that
 * are actually shown, so a stale value never lingers and a shared link opens
 * what was on screen.
 */
export function useDownloadSelection(
  architectures: ProcessedArchitectures
): DownloadSelection {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [requested, setRequested] = useState<RawSelection>(() =>
    fromParams(searchParams)
  );
  const [prevQuery, setPrevQuery] = useState(searchParams.toString());

  // Re-sync when the URL changes from outside (browser back/forward)
  if (searchParams.toString() !== prevQuery) {
    setPrevQuery(searchParams.toString());
    setRequested(fromParams(searchParams));
  }

  const resolve = (raw: RawSelection) => {
    const releases = listReleases(architectures);
    const release =
      releases.find((r) => r.versionId === raw.version) ?? releases[0];
    const platforms = release
      ? availablePlatforms(architectures, release.versionId)
      : [];
    const platform = resolvePlatform(platforms, raw.platform);
    const archs = release
      ? availableArchs(architectures, release.versionId, platform)
      : [];
    const arch = resolveArch(archs, raw.arch);
    return { releases, release, platforms, platform, archs, arch };
  };

  const current = resolve(requested);

  // Releases get their own history entry; picking a platform or architecture
  // replaces the entry, so arrow-keying through a radio group can't flood
  // the back button
  const update = (patch: Partial<RawSelection>, push: boolean) => {
    const next = resolve({ ...requested, ...patch });
    const resolved: RawSelection = {
      version: next.release?.versionId ?? null,
      platform: next.platform,
      arch: next.arch ?? null,
    };
    setRequested(resolved);

    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(resolved)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const url = `${pathname}?${params.toString()}`;
    // Shallow update: no server round-trip
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  };

  return {
    ...current,
    selectRelease: (version) => update({ version }, true),
    selectPlatform: (platform) => update({ platform }, false),
    selectArch: (arch) => update({ arch }, false),
  };
}
