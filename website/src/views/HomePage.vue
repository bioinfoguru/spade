<template>
  <main>
    <section class="hero section-wrap">
      <div class="hero-copy">
        <div class="eyebrow"><span class="status-dot"></span> Your next PDF workspace</div>
        <h1>PDF work,<br /><span>without the friction.</span></h1>
        <p class="hero-lede">A focused desktop editor for the details that matter. Arrange pages, add clear markups, and get back to your work.</p>
        <div class="hero-actions">
          <RouterLink class="button button-primary" to="/#downloads">Download SPADE <ArrowDownToLine :size="17" /></RouterLink>
          <RouterLink class="button button-quiet" to="/#features">Explore features <ArrowRight :size="16" /></RouterLink>
        </div>
        <div class="hero-proof">
          <span><ShieldCheck :size="15" /> Your files stay on your device</span>
          <i></i>
          <span>Windows · macOS · Linux</span>
        </div>
      </div>

      <div class="hero-art">
        <div class="orbit orbit-a"></div>
        <div class="orbit orbit-b"></div>
        <img class="hero-screenshot" src="/spade-editor.png" alt="SPADE PDF editor running on Windows" />
      </div>
    </section>

    <section id="features" class="features-section section-wrap">
      <div class="section-heading">
        <span class="section-kicker"><strong>S</strong>imple <strong>P</strong>DF <strong>A</strong>nnotation &amp; <strong>D</strong>ocument <strong>E</strong>ditor</span>
        <h2>All the useful tools.<br /><span>None of the clutter.</span></h2>
        <p>Move from reading to refining without losing your place.</p>
      </div>
      <div class="feature-grid">
        <article class="feature-card">
          <div class="feature-icon"><Layers :size="20" /></div>
          <h3>Shape your pages</h3>
          <p>Reorder, rotate, duplicate, crop, and merge pages in a few clicks.</p>
          <span class="feature-index">01</span>
        </article>
        <article class="feature-card">
          <div class="feature-icon"><PenLine :size="20" /></div>
          <h3>Make your mark</h3>
          <p>Highlight, draw, add notes, place text, and bring in images.</p>
          <span class="feature-index">02</span>
        </article>
        <article class="feature-card">
          <div class="feature-icon"><Undo2 :size="20" /></div>
          <h3>Stay in control</h3>
          <p>Undo and redo edits, inspect pages, and save an exported PDF when you’re ready.</p>
          <span class="feature-index">03</span>
        </article>
        <article class="feature-card">
          <div class="feature-icon"><Laptop :size="20" /></div>
          <h3>Work on your desktop</h3>
          <p>SPADE is a native-feeling desktop app for Windows, macOS, and Linux.</p>
          <span class="feature-index">04</span>
        </article>
      </div>
    </section>

    <section id="downloads" class="download-section section-wrap">
      <div class="download-shell">
        <div class="download-heading">
          <div>
            <span class="section-kicker">READY WHEN YOU ARE</span>
            <h2>Get SPADE<span class="brand-period">.</span></h2>
            <p>Choose your platform to see the right download.</p>
          </div>
          <div class="release-state" :class="{ 'release-state-error': releaseError }">
            <span class="status-dot"></span>
            <template v-if="release">Latest release {{ release.tag_name }}</template>
            <template v-else-if="releaseLoading">Checking releases…</template>
            <template v-else-if="releaseError">Release info unavailable</template>
            <template v-else>No release found</template>
          </div>
        </div>

        <div class="platform-tabs" role="tablist" aria-label="Choose your operating system">
          <button
            v-for="platform in platforms"
            :key="platform.id"
            type="button"
            role="tab"
            :aria-selected="activePlatform === platform.id"
            :class="['platform-tab', { 'platform-tab-active': activePlatform === platform.id }]"
            @click="activePlatform = platform.id"
          >
            <component :is="platform.icon" :size="17" />
            {{ platform.label }}
            <span v-if="detectedPlatform === platform.id" class="detected-pill">YOUR OS</span>
          </button>
        </div>

        <div class="download-content" role="tabpanel">
          <div class="platform-intro">
            <div>
              <h3>{{ activePlatformInfo.title }}</h3>
              <p>{{ activePlatformInfo.description }}</p>
            </div>
            <button v-if="releaseError" class="retry-link" type="button" @click="loadLatestRelease">Try again</button>
          </div>

          <div v-if="releaseLoading" class="download-empty">
            <span class="loading-spinner"></span> Finding the latest downloads…
          </div>
          <div v-else-if="releaseError" class="download-empty">
            Couldn’t reach GitHub Releases. Please try again in a moment.
          </div>
          <div v-else-if="downloadOptions.length" class="download-list">
            <a v-for="option in downloadOptions" :key="option.asset.name" class="download-row" :href="option.asset.browser_download_url">
              <span class="download-file-icon"><FileDown :size="18" /></span>
              <span class="download-file-copy">
                <strong>{{ option.title }}</strong>
                <small>{{ option.description }} <span class="asset-name">{{ option.asset.name }}</span></small>
              </span>
              <span class="download-cta">Download <ArrowDownToLine :size="15" /></span>
            </a>
          </div>
          <div v-else class="download-empty">
            No {{ activePlatformInfo.title }} downloads are attached to the latest release yet.
          </div>

        </div>
      </div>
    </section>

  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  ArrowDownToLine,
  ArrowRight,
  FileDown,
  Laptop,
  Layers,
  Monitor,
  PenLine,
  ShieldCheck,
  Terminal,
  Undo2,
} from '@lucide/vue';

type PlatformId = 'windows' | 'macos' | 'linux';
interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}
interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: ReleaseAsset[];
}

const platforms = [
  { id: 'windows' as const, label: 'Windows', title: 'Windows 64-bit', description: 'Choose the installer for a guided setup, or download the standalone app.', icon: Monitor },
  { id: 'macos' as const, label: 'macOS', title: 'macOS', description: 'Download the disk image or compressed app bundle for your Mac.', icon: Laptop },
  { id: 'linux' as const, label: 'Linux', title: 'Linux', description: 'Choose a package for your distribution or use the portable AppImage.', icon: Terminal },
];

function detectPlatform(): PlatformId {
  const agent = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (agent.includes('windows')) return 'windows';
  if (agent.includes('macintosh') || agent.includes('mac os') || agent.includes('darwin')) return 'macos';
  if (agent.includes('linux') || agent.includes('x11')) return 'linux';
  return 'windows';
}

const detectedPlatform = detectPlatform();
const activePlatform = ref<PlatformId>(detectedPlatform);
const release = ref<GitHubRelease | null>(null);
const releaseLoading = ref(true);
const releaseError = ref(false);

const activePlatformInfo = computed(() => platforms.find((item) => item.id === activePlatform.value) ?? platforms[0]);

function findAsset(pattern: RegExp): ReleaseAsset | undefined {
  return release.value?.assets.find((asset) => pattern.test(asset.name));
}

const downloadOptions = computed(() => {
  const definitions: Record<PlatformId, { title: string; description: string; pattern: RegExp }[]> = {
    windows: [
      { title: 'SPADE app', description: 'Standalone executable · Windows may require WebView2', pattern: /^spade\.exe$/i },
      { title: 'Windows setup', description: 'Recommended installer · 64-bit', pattern: /-setup\.exe$/i },
      { title: 'MSI package', description: 'Windows Installer package · 64-bit', pattern: /\.msi$/i },
    ],
    macos: [
      { title: 'Disk image', description: 'Standard macOS installation · choose the build for your processor', pattern: /\.dmg$/i },
      { title: 'App bundle archive', description: 'Compressed macOS application bundle', pattern: /\.app\.tar\.gz$/i },
    ],
    linux: [
      { title: 'AppImage', description: 'Portable package for most Linux distributions', pattern: /\.appimage$/i },
      { title: 'Debian package', description: 'For Debian, Ubuntu, and related distributions', pattern: /\.deb$/i },
      { title: 'RPM package', description: 'For Fedora, RHEL, openSUSE, and related distributions', pattern: /\.rpm$/i },
    ],
  };

  return (definitions[activePlatform.value] ?? []).flatMap((definition) => {
    const asset = findAsset(definition.pattern);
    return asset ? [{ ...definition, asset }] : [];
  });
});

async function loadLatestRelease() {
  releaseLoading.value = true;
  releaseError.value = false;
  try {
    const response = await fetch('https://api.github.com/repos/bioinfoguru/spade/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    release.value = await response.json() as GitHubRelease;
  } catch {
    releaseError.value = true;
  } finally {
    releaseLoading.value = false;
  }
}

onMounted(loadLatestRelease);
</script>
