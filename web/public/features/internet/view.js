export function renderInternet(main) {
  document.title = 'La planète Internet · ADI 4';
  main.innerHTML = `<section class="original-scene"><div class="scene-heading"><h1>La planète Internet</h1><a class="button secondary" href="#room">La chambre</a></div><iframe title="ADI Internet — simulation locale" src="/internet.html" sandbox="allow-scripts allow-same-origin allow-downloads allow-modals allow-forms" style="display:block;width:100%;height:850px;border:0;border-radius:12px;background:#071827"></iframe></section>`;
  const frame = main.querySelector('iframe');
  let sizeObserver;
  frame.addEventListener('load', () => {
    sizeObserver?.disconnect();
    const body = frame.contentDocument?.body;
    if (!body || !frame.isConnected) return;
    sizeObserver = new ResizeObserver(() => {
      frame.style.height = `${Math.ceil(body.getBoundingClientRect().height)}px`;
    });
    sizeObserver.observe(body);
  });
  const receive = event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'adi-internet-exit') location.hash = 'room';
  };
  window.addEventListener('message', receive);
  main.addEventListener('sceneleave', () => {
    sizeObserver?.disconnect();
    window.removeEventListener('message', receive);
  }, { once: true });
}
