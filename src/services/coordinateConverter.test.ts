import { CoordinateConverter } from './coordinateConverter';
import { PageViewportTransform, Rect } from '@/types/geometry';

function assertApprox(a: number, b: number, epsilon = 0.001, msg = '') {
  if (Math.abs(a - b) > epsilon) {
    throw new Error(`Assertion failed: ${a} != ${b} (${msg})`);
  }
}

export function runCoordinateTests() {
  console.log('Testing CoordinateConverter...');

  const viewport0: PageViewportTransform = {
    scale: 1.5,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    width: 612 * 1.5,
    height: 792 * 1.5,
    rawWidth: 612,
    rawHeight: 792,
  };

  // Test 1: Roundtrip at rotation 0
  const pdfPoint1 = { x: 100, y: 200 };
  const screenPixel1 = CoordinateConverter.pdfPointToViewportPixel(pdfPoint1, viewport0);
  const roundtrip1 = CoordinateConverter.viewportPixelToPdfPoint(screenPixel1, viewport0);
  assertApprox(roundtrip1.x, pdfPoint1.x, 0.001, 'Roundtrip X (0 deg)');
  assertApprox(roundtrip1.y, pdfPoint1.y, 0.001, 'Roundtrip Y (0 deg)');

  // Test 2: Rotation 90 degrees
  const viewport90: PageViewportTransform = {
    ...viewport0,
    rotation: 90,
    width: 792 * 1.5,
    height: 612 * 1.5,
  };
  const screenPixel90 = CoordinateConverter.pdfPointToViewportPixel(pdfPoint1, viewport90);
  const roundtrip90 = CoordinateConverter.viewportPixelToPdfPoint(screenPixel90, viewport90);
  assertApprox(roundtrip90.x, pdfPoint1.x, 0.001, 'Roundtrip X (90 deg)');
  assertApprox(roundtrip90.y, pdfPoint1.y, 0.001, 'Roundtrip Y (90 deg)');

  // Test 3: Rect roundtrip
  const testRect: Rect = { x: 50, y: 150, width: 200, height: 100 };
  const screenRect = CoordinateConverter.pdfRectToViewportRect(testRect, viewport0);
  const roundtripRect = CoordinateConverter.viewportRectToPdfRect(screenRect, viewport0);
  assertApprox(roundtripRect.x, testRect.x, 0.001, 'Rect X');
  assertApprox(roundtripRect.y, testRect.y, 0.001, 'Rect Y');
  assertApprox(roundtripRect.width, testRect.width, 0.001, 'Rect Width');
  assertApprox(roundtripRect.height, testRect.height, 0.001, 'Rect Height');

  console.log('All CoordinateConverter tests passed successfully!');
}
