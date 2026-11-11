/**
 * TR STUDIO — Editor Engine Foundation
 * Core state & viewport primitives prepared for Step 2+ interactive canvas and storyboard editing.
 */

export type EditorToolMode = "select" | "pan" | "character" | "camera" | "dialogue";

export interface EditorViewportState {
  zoom: number;
  panX: number;
  panY: number;
  activeTool: EditorToolMode;
  gridVisible: boolean;
}

export const INITIAL_VIEWPORT_STATE: EditorViewportState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  activeTool: "select",
  gridVisible: true,
};
