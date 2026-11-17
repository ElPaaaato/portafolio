/* Aviso fijo en todas las páginas: es una demo en desarrollo con datos de prueba */
(function () {
  const KEY = 'demo_aviso_cerrado';
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) {}

  function mostrar() {
    const el = document.createElement('div');
    el.setAttribute('role', 'note');
    el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;display:flex;align-items:center;gap:12px;max-width:calc(100% - 24px);padding:10px 12px 10px 16px;border-radius:999px;background:#111;color:#f4f3ee;font:500 13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3)';
    el.innerHTML =
      '<span style="flex:none;width:8px;height:8px;border-radius:50%;background:#ffd400"></span>' +
      '<span><b style="color:#ffd400">Demo en desarrollo</b> · Este proyecto aún no está terminado y todos los datos son de prueba.</span>' +
      '<button type="button" aria-label="Cerrar aviso" style="flex:none;width:26px;height:26px;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:inherit;font-size:14px;line-height:1;cursor:pointer">✕</button>';
    el.querySelector('button').addEventListener('click', function () {
      el.remove();
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    });
    document.body.appendChild(el);
  }

  if (document.body) mostrar();
  else document.addEventListener('DOMContentLoaded', mostrar);
})();
