import type { WaitHandle } from './api';

/**
 * FIFO of waiting requests with O(1) removal from anywhere, so a cancelled request
 * leaves the line immediately and `size` is always exact.
 */
export interface WaitNode<T> {
  readonly value: T;
  prev: WaitNode<T> | undefined;
  next: WaitNode<T> | undefined;
  /** False once removed (granted or withdrawn). */
  linked: boolean;
}

export class WaitList<T> {
  private head: WaitNode<T> | undefined;
  private tail: WaitNode<T> | undefined;
  size = 0;

  push(value: T): WaitNode<T> {
    const node: WaitNode<T> = { value, prev: this.tail, next: undefined, linked: true };
    if (this.tail) this.tail.next = node;
    else this.head = node;
    this.tail = node;
    this.size++;
    return node;
  }

  first(): WaitNode<T> | undefined {
    return this.head;
  }

  remove(node: WaitNode<T>): void {
    if (!node.linked) return;
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = node.next = undefined;
    node.linked = false;
    this.size--;
  }
}

/** The caller's handle on a waiting request; see `WaitHandle` in api.ts. */
export function waitHandle<T>(
  list: WaitList<T>,
  node: WaitNode<T>,
  onWithdraw?: () => void,
): WaitHandle {
  let withdrawn = false;
  return {
    cancel() {
      if (withdrawn) return true;
      if (!node.linked) return false; // granted: the caller owns the unit or item
      list.remove(node);
      onWithdraw?.();
      return (withdrawn = true);
    },
  };
}
