/** Keep the user's deck order through refreshes; append new unresolved items. */
export function reconcileActionOrder(order: string[], ids: string[]): string[] {
  const current = new Set(ids);
  const retained = order.filter(id => current.has(id));
  const known = new Set(retained);
  return [...retained, ...ids.filter(id => !known.has(id))];
}

export function cycleActionOrder(order: string[]): string[] {
  return order.length > 1 ? [...order.slice(1), order[0]] : order;
}

export function isUpwardCardDrag(dx: number, dy: number): boolean {
  return dy < -8 && -dy > Math.abs(dx) * 1.4;
}

export function shouldCycleCard(dx: number, dy: number, vy: number): boolean {
  return isUpwardCardDrag(dx, dy) && (dy <= -48 || (dy <= -16 && vy <= -0.45));
}
