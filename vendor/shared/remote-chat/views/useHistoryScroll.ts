import { useCallback, useLayoutEffect, useRef, useState, type TouchEvent, type WheelEvent } from 'react';
import type { ChatMessagesProps } from '../client/messageProps';
import { isNearHistoryStart, shouldFollowScroll, shouldShowScrollToBottom }
  from '../../chat/scrollPosition';
import { useScrollMovement } from '../../chat/useScrollMovement';
import { restoreVirtualScroll, useVirtualScroll } from '../../chat/virtualScroll';
import { useHistoryPull } from '../../chat/useHistoryPull';
import { useHistoryContinuation } from '../../chat/useHistoryContinuation';
import { useCommittedCallback } from '../../chat/useCommittedCallback';
import { canScrollWithin } from '../../chat/canScrollWithin';

const TOP_TOLERANCE = 1;

export function useHistoryScroll(
  { thread, loading, loadingMore, hasMore, loadOlder, historyLoad }: ChatMessagesProps,
  windowed = false,
) {
  const list = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [showBottom, setShowBottom] = useState(false);
  const fetching = useRef(false);
  const movement = useScrollMovement();
  useVirtualScroll({ viewport: list, following, movement });
  const anchor = useRef<{ element: Element; top: number }>();
  const scope = useRef(thread?.id);
  useLayoutEffect(() => {
    scope.current = thread?.id;
    following.current = true;
    fetching.current = false;
    anchor.current = undefined;
    const node = list.current;
    if (node) node.scrollTop = node.scrollHeight;
    movement.remember(node);
    setShowBottom(false);
  }, [thread?.id, movement]);
  const updateScrollButton = useCallback(() => {
    const node = list.current;
    if (node) setShowBottom(shouldShowScrollToBottom({
      contentHeight: node.scrollHeight, viewportHeight: node.clientHeight, offset: node.scrollTop,
    }));
  }, []);
  const rememberReadingAnchor = () => {
    const node = list.current;
    if (!node) return;
    const top = node.getBoundingClientRect().top;
    const element = [...node.querySelectorAll('[data-message-id]')]
      .find(item => item.getBoundingClientRect().bottom > top);
    anchor.current = element ? { element, top: element.getBoundingClientRect().top } : undefined;
  };
  const more = () => {
    if (!hasMore || loading || loadingMore || fetching.current || !loadOlder || !list.current) return;
    continueHistory();
    following.current = false;
    rememberReadingAnchor();
    fetching.current = true;
    const current = scope.current;
    void loadOlder().finally(() => { if (scope.current === current) fetching.current = false; });
  };
  const continueHistory = useHistoryContinuation({
    threadId: thread?.id, result: historyLoad, hasMore, loading: Boolean(loading || loadingMore), loadOlder: more,
    nearTop: () => Boolean(list.current && isNearHistoryStart({
      offset: list.current.scrollTop, viewportHeight: list.current.clientHeight,
    })),
  });
  const pull = useHistoryPull(() => Boolean(list.current && list.current.scrollTop <= TOP_TOLERANCE), more);
  const touchPoint = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches.length === 1 ? event.touches[0] : undefined;
    return touch && !event.defaultPrevented && !canScrollWithin(event.target, event.currentTarget, -1)
      ? { x: touch.pageX, y: touch.pageY } : undefined;
  };
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => pull.begin(touchPoint(event));
  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => pull.move(touchPoint(event));
  useLayoutEffect(() => {
    const node = list.current;
    const reading = anchor.current;
    if (!node || !reading) return;
    if (reading.element.isConnected) {
      node.scrollTop += reading.element.getBoundingClientRect().top - reading.top;
      movement.remember(node);
      updateScrollButton();
    }
    if (!loadingMore && !windowed) anchor.current = undefined;
  }, [thread, loadingMore, updateScrollButton, movement, windowed]);
  const onScroll = useCommittedCallback(() => {
    const node = list.current;
    if (!node) return;
    const offsetChange = movement.read(node);
    // Layout and resize effects already remember their restored position before the scroll event arrives.
    if (offsetChange === 0) return;
    if (windowed) {
      if (fetching.current) rememberReadingAnchor();
      else anchor.current = undefined;
    }
    following.current = shouldFollowScroll({ contentHeight: node.scrollHeight, viewportHeight: node.clientHeight,
      offset: node.scrollTop, movement: offsetChange });
    updateScrollButton();
    if (offsetChange < 0 && isNearHistoryStart({ offset: node.scrollTop, viewportHeight: node.clientHeight })) more();
  });
  useLayoutEffect(() => {
    const follow = () => {
      // Follow content size changes after layout instead of measuring on every streamed text commit.
      // Lazy measurements can arrive before the browser dispatches a pending reader scroll.
      if (windowed) onScroll();
      if (following.current && list.current) {
        list.current.scrollTop = list.current.scrollHeight;
      }
      movement.remember(list.current);
      updateScrollButton();
    };
    const observer = new ResizeObserver(follow);
    if (body.current) observer.observe(body.current, { box: 'border-box' });
    if (list.current) observer.observe(list.current);
    follow();
    return () => observer.disconnect();
  }, [updateScrollButton, movement, windowed, onScroll]);
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY >= 0 || event.ctrlKey || event.defaultPrevented
      || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (canScrollWithin(event.target, event.currentTarget, event.deltaY)) return;
    following.current = false;
    if (event.currentTarget.scrollTop > 0) return;
    // At the top (including short histories), upward wheels do not produce a scroll event.
    more();
  };
  const toBottom = () => {
    if (windowed) anchor.current = undefined;
    following.current = true;
    setShowBottom(false);
    const node = list.current;
    if (!node) return;
    // A windowed list learns heights as it mounts: a smooth scroll's obsolete target can stop halfway.
    if (windowed) restoreVirtualScroll({ root: node, bottom: true, top: 0, offset: node.scrollTop });
    else node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  };
  const pauseFollowing = () => { following.current = false; };
  return { list, content, body, following, readingAnchor: anchor,
    onScroll, onWheel, more, showBottom, toBottom, pauseFollowing,
    onTouchStart, onTouchMove, onTouchEnd: pull.clear, onTouchCancel: pull.clear };
}
