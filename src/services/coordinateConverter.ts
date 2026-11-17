import { Point, Rect, PageViewportTransform } from '@/types/geometry';

/**
 * Coordinate Converter
 * Handles exact transformations between:
 * 1. PDF User Space Points (72 DPI, origin bottom-left)
 * 2. Viewport CSS Pixels (origin top-left, scaled by zoom and rotation)
 * 3. HTML5 Canvas Backing Pixels (scaled by DPR)
 */

export class CoordinateConverter {
  /**
   * Converts PDF User Space point (points) to Viewport CSS coordinates (pixels).
   */
  static pdfPointToViewportPixel(
    point: Point,
    viewport: PageViewportTransform
  ): Point {
    const { scale, rotation, rawWidth, rawHeight } = viewport;
    const x = point.x;
    const y = point.y;

    switch (rotation) {
      case 0:
        return {
          x: x * scale,
          y: (rawHeight - y) * scale,
        };
      case 90:
        return {
          x: y * scale,
          y: x * scale,
        };
      case 180:
        return {
          x: (rawWidth - x) * scale,
          y: y * scale,
        };
      case 270:
        return {
          x: (rawHeight - y) * scale,
          y: (rawWidth - x) * scale,
        };
      default:
        return {
          x: x * scale,
          y: (rawHeight - y) * scale,
        };
    }
  }

  /**
   * Converts Viewport CSS coordinates (pixels) back into PDF User Space points.
   */
  static viewportPixelToPdfPoint(
    pixel: Point,
    viewport: PageViewportTransform
  ): Point {
    const { scale, rotation, rawWidth, rawHeight } = viewport;
    const vx = pixel.x / scale;
    const vy = pixel.y / scale;

    switch (rotation) {
      case 0:
        return {
          x: vx,
          y: rawHeight - vy,
        };
      case 90:
        return {
          x: vy,
          y: vx,
        };
      case 180:
        return {
          x: rawWidth - vx,
          y: vy,
        };
      case 270:
        return {
          x: rawWidth - vy,
          y: rawHeight - vx,
        };
      default:
        return {
          x: vx,
          y: rawHeight - vy,
        };
    }
  }

  /**
   * Converts a PDF User Space rectangle into Viewport CSS pixel bounds.
   */
  static pdfRectToViewportRect(
    rect: Rect,
    viewport: PageViewportTransform
  ): Rect {
    // A PDF rectangle is defined by [x, y, width, height]
    // Point 1: (x, y) bottom-left
    // Point 2: (x + width, y + height) top-right
    const p1 = this.pdfPointToViewportPixel({ x: rect.x, y: rect.y }, viewport);
    const p2 = this.pdfPointToViewportPixel(
      { x: rect.x + rect.width, y: rect.y + rect.height },
      viewport
    );

    const minX = Math.min(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxX = Math.max(p1.x, p2.x);
    const maxY = Math.max(p1.y, p2.y);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Converts a Viewport CSS pixel rectangle back into PDF User Space points.
   */
  static viewportRectToPdfRect(
    cssRect: Rect,
    viewport: PageViewportTransform
  ): Rect {
    const p1 = this.viewportPixelToPdfPoint(
      { x: cssRect.x, y: cssRect.y },
      viewport
    );
    const p2 = this.viewportPixelToPdfPoint(
      { x: cssRect.x + cssRect.width, y: cssRect.y + cssRect.height },
      viewport
    );

    const minX = Math.min(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxX = Math.max(p1.x, p2.x);
    const maxY = Math.max(p1.y, p2.y);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Configures HTML5 Canvas resolution for High-DPI displays.
   * DPR is applied only to the backing buffer; callers render with a viewport
   * already scaled by DPR, so the 2D context must stay at its default scale.
   */
  static setupCanvasResolution(
    canvas: HTMLCanvasElement,
    cssWidth: number,
    cssHeight: number,
    dpr: number = window.devicePixelRatio || 1
  ): CanvasRenderingContext2D {
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to acquire 2D canvas context');
    }

    return ctx;
  }
}

