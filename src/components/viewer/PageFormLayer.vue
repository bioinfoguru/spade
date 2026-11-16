<template>
  <div ref="containerRef" class="annotationLayer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';

const props = defineProps<{
  page: any;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
}>();

const containerRef = ref<HTMLDivElement | null>(null);

async function renderAnnotationLayer() {
  if (!containerRef.value || !props.page) return;

  const container = containerRef.value;
  container.innerHTML = '';

  try {
    const viewport = props.page.getViewport({
      scale: props.scale,
      rotation: props.rotation,
    });

    const annotations = await props.page.getAnnotations({ intent: 'display' });
    if (!annotations || annotations.length === 0) return;

    if ((pdfjsLib as any).AnnotationLayer) {
      try {
        const AnnotationLayerClass = (pdfjsLib as any).AnnotationLayer;
        const layer = new AnnotationLayerClass({
          div: container,
          accessibilityManager: null,
          annotationCanvasMap: null,
          page: props.page,
          viewport: viewport.clone({ dontFlip: true }),
        });
        await layer.render({
          viewport: viewport.clone({ dontFlip: true }),
          div: container,
          annotations,
          page: props.page,
          renderForms: true,
          linkService: {
            externalLinkTarget: 2,
            externalLinkRel: 'noopener noreferrer',
            getDestinationHash: () => '#',
            getAnchorUrl: () => '#',
            setHash: () => {},
            executeNamedAction: () => {},
            addOrUpdateUrl: () => {},
          } as any,
        });
      } catch (layerErr) {
        // Fallback for different pdfjs versions
        if (typeof (pdfjsLib as any).AnnotationLayer?.render === 'function') {
          (pdfjsLib as any).AnnotationLayer.render({
            viewport: viewport.clone({ dontFlip: true }),
            div: container,
            annotations,
            page: props.page,
            renderForms: true,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Annotation layer render error:', err);
  }
}

onMounted(() => {
  renderAnnotationLayer();
});

watch(
  () => [props.scale, props.rotation],
  () => {
    renderAnnotationLayer();
  }
);
</script>
