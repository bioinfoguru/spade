import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import packageInfo from '../../package.json';

const RELEASES_API_URL = 'https://api.github.com/repos/bioinfoguru/spade/releases/latest';
const REQUEST_TIMEOUT_MS = 10_000;

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[] | null;
}

function parseVersion(value: string): ParsedVersion | null {
  const match = value
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : null,
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  }

  if (!left.prerelease && !right.prerelease) return 0;
  if (!left.prerelease) return 1;
  if (!right.prerelease) return -1;

  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftIsNumeric = /^\d+$/.test(leftPart);
    const rightIsNumeric = /^\d+$/.test(rightPart);
    if (leftIsNumeric && rightIsNumeric) {
      return Number(leftPart) > Number(rightPart) ? 1 : -1;
    }
    if (leftIsNumeric !== rightIsNumeric) return leftIsNumeric ? -1 : 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

/**
 * Checks the public GitHub releases feed for a newer SPADE build.
 *
 * The startup check is silent: network failures, GitHub outages, and rate
 * limits never interrupt the user. The Help page can trigger a visible retry.
 */
export const useUpdateStore = defineStore('update', () => {
  const currentVersion = ref(packageInfo.version);
  const latestVersion = ref('');
  const releasePageUrl = ref('');
  const updateAvailable = ref(false);
  const isChecking = ref(false);
  const lastCheckedAt = ref<number | null>(null);
  const lastError = ref('');

  let versionResolved = false;
  let inFlight: Promise<void> | null = null;

  const hasError = computed(() => Boolean(lastError.value) && !updateAvailable.value);

  const statusMessage = computed(() => {
    if (isChecking.value) return 'Checking for updates…';
    if (updateAvailable.value) {
      return `SPADE ${latestVersion.value} is available (you have ${currentVersion.value}).`;
    }
    if (lastError.value) return lastError.value;
    if (lastCheckedAt.value) {
      return `You're up to date. The latest release is ${latestVersion.value}.`;
    }
    return '';
  });

  async function resolveCurrentVersion(): Promise<string> {
    if (versionResolved) return currentVersion.value;

    if (isTauri()) {
      try {
        currentVersion.value = await getVersion();
      } catch (err) {
        console.warn('Could not read the installed app version:', err);
      }
    }

    versionResolved = true;
    return currentVersion.value;
  }

  async function runCheck(silent: boolean): Promise<void> {
    isChecking.value = true;
    lastError.value = '';

    try {
      await resolveCurrentVersion();

      const response = await fetch(RELEASES_API_URL, {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

      const release = (await response.json()) as GitHubRelease;
      if (!release.tag_name || !release.html_url) {
        throw new Error('GitHub returned an incomplete release.');
      }

      const installed = parseVersion(currentVersion.value);
      const latest = parseVersion(release.tag_name);
      if (!installed || !latest) {
        throw new Error('GitHub returned an invalid release version.');
      }

      latestVersion.value = release.tag_name;
      releasePageUrl.value = release.html_url;
      updateAvailable.value = compareVersions(latest, installed) > 0;
      lastCheckedAt.value = Date.now();
    } catch (err) {
      // Keep any previously discovered update so the Help badge does not
      // disappear because of a transient network failure.
      if (!silent) {
        lastError.value =
          'Could not check for updates. Check your internet connection and try again.';
      }
      console.warn('Update check failed:', err);
    } finally {
      isChecking.value = false;
      inFlight = null;
    }
  }

  function checkForUpdates(options: { silent?: boolean } = {}): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = runCheck(options.silent ?? false);
    return inFlight;
  }

  return {
    currentVersion,
    latestVersion,
    releasePageUrl,
    updateAvailable,
    isChecking,
    lastCheckedAt,
    lastError,
    hasError,
    statusMessage,
    checkForUpdates,
  };
});
