<template>
  <div ref="siteShell" class="site-shell" :class="{ 'pointer-active': pointerGlowEnabled }">
    <div class="ambient ambient-one" aria-hidden="true"></div>
    <div class="ambient ambient-two" aria-hidden="true"></div>

    <header class="site-header">
      <div class="header-inner">
        <RouterLink class="brand" to="/" aria-label="SPADE home">
          <img class="brand-mark" src="/logo.svg" alt="" />
          <span class="brand-name">SPADE<span class="brand-period">.</span></span>
        </RouterLink>

        <nav class="main-nav" aria-label="Main navigation">
          <RouterLink to="/#features">Features</RouterLink>
          <RouterLink to="/#downloads">Downloads</RouterLink>
          <RouterLink to="/contact">Contact</RouterLink>
        </nav>

      </div>
    </header>

    <RouterView />

    <footer class="site-footer">
      <div class="footer-inner">
        <span class="footer-note">© bioinfo.guru 2026</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';

const siteShell = ref<HTMLDivElement | null>(null);
const pointerGlowEnabled = ref(false);
let pointerFrame = 0;
let pointerX = 0;
let pointerY = 0;

function trackPointer(event: PointerEvent) {
  pointerX = (event.clientX / window.innerWidth) * 100;
  pointerY = (event.clientY / window.innerHeight) * 100;
  if (pointerFrame) return;

  pointerFrame = window.requestAnimationFrame(() => {
    siteShell.value?.style.setProperty('--pointer-x', `${pointerX}%`);
    siteShell.value?.style.setProperty('--pointer-y', `${pointerY}%`);
    pointerFrame = 0;
  });
}

onMounted(() => {
  const canTrackPointer = window.matchMedia('(pointer: fine)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canTrackPointer || prefersReducedMotion) return;

  pointerGlowEnabled.value = true;
  window.addEventListener('pointermove', trackPointer, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('pointermove', trackPointer);
  if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
});
</script>
