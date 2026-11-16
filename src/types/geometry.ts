export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageViewportTransform {
  scale: number;
  rotation: 0 | 90 | 180 | 270;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  rawWidth: number;
  rawHeight: number;
}

