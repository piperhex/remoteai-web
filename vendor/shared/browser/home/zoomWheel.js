if (window.parent !== window) {
  window.addEventListener('wheel', event => {
    if (!event.isTrusted || !event.ctrlKey || !event.deltaY || event.defaultPrevented) return;
    event.preventDefault();
    parent.postMessage({ type: 'remoteai:browser-home:zoom', step: event.deltaY < 0 ? 1 : -1 }, '*');
  }, { passive: false });
}
