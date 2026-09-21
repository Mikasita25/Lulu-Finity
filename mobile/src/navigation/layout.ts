export const BOTTOM_NAV_CONTENT_HEIGHT = 72;
export const BOTTOM_NAV_CONTENT_GAP = 18;

export function bottomNavigationHeight(bottomInset: number) {
  return BOTTOM_NAV_CONTENT_HEIGHT + Math.max(0, bottomInset);
}

export function screenBottomPadding(bottomInset: number) {
  return bottomNavigationHeight(bottomInset) + BOTTOM_NAV_CONTENT_GAP;
}
