(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Ribbon: 途切れず流すために中身を複製する（複製は支援技術から隠す）
  const track = document.querySelector('.ribbon-track');
  if (track && !reduceMotion) {
    [...track.children].forEach((li) => {
      const clone = li.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelector('img').alt = '';
      track.appendChild(clone);
    });
  }

  // Reveal on scroll
  const targets = document.querySelectorAll('.section > *');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0.01 });
    targets.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }

  // Photo globe
  const PHOTOS = [
    ['sea-of-clouds', 480, 320], ['chairs', 360, 480], ['spring', 480, 320], ['komorebi', 360, 480],
    ['meadow', 480, 321], ['cat', 270, 480], ['fuji-far', 480, 321], ['dogu', 360, 480],
    ['waterfall', 480, 321], ['summer-light', 360, 480], ['yakushima', 360, 480], ['valley', 480, 320],
    ['fuji-lake', 360, 480], ['shrine', 480, 321], ['stars', 360, 480], ['leather', 480, 321],
    ['feet', 360, 480], ['camera-mirror', 480, 320], ['paddy', 360, 480], ['graduation', 480, 320],
    ['snow-hat', 480, 321], ['portrait', 360, 480], ['hero', 360, 480], ['talk', 480, 320],
  ];
  const stage = document.getElementById('globe');
  if (!stage) return;

  const fallback = () => {
    stage.removeAttribute('role');
    stage.removeAttribute('aria-label');
    stage.style.height = 'auto';
    stage.style.cursor = 'auto';
    const grid = document.createElement('div');
    grid.className = 'globe-fallback';
    PHOTOS.slice(0, 12).forEach(([name, w, h]) => {
      const img = new Image(w, h);
      img.src = `images/${name}-s.webp`;
      img.alt = '';
      img.loading = 'lazy';
      grid.appendChild(img);
    });
    stage.appendChild(grid);
    const hint = document.getElementById('globe-hint');
    if (hint) hint.hidden = true;
  };

  const webglOK = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  })();
  if (!window.THREE || !webglOK) { fallback(); return; }

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    const THREE = window.THREE;
    const w0 = stage.clientWidth;
    const h0 = stage.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w0 / h0, 1, 1000);
    camera.position.z = w0 < 600 ? 360 : 290;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w0, h0);
    stage.appendChild(renderer.domElement);

    const globe = new THREE.Group();
    scene.add(globe);

    const R = 92;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.9, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xe0a06a, wireframe: true, transparent: true, opacity: 0.06 })
    );
    globe.add(core);

    const loader = new THREE.TextureLoader();
    const golden = Math.PI * (3 - Math.sqrt(5));
    const N = PHOTOS.length;
    PHOTOS.forEach(([name, w, h], i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      const pos = new THREE.Vector3(Math.cos(t) * r * R, y * R, Math.sin(t) * r * R);
      const scale = 46 / Math.max(w, h);
      const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * scale, h * scale), mat);
      loader.load(`images/${name}-s.webp`, (tex) => {
        if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
        mat.map = tex; mat.opacity = 0.95; mat.needsUpdate = true;
      });
      mesh.position.copy(pos);
      mesh.lookAt(pos.clone().multiplyScalar(2));
      globe.add(mesh);
    });
    renderer.outputEncoding = THREE.sRGBEncoding;

    // Drag / swipe
    const auto = reduceMotion ? 0 : 0.0016;
    const vel = { x: 0, y: auto };
    let dragging = false;
    let last = { x: 0, y: 0 };
    stage.addEventListener('pointerdown', (e) => {
      dragging = true; last = { x: e.clientX, y: e.clientY };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      vel.y = (e.clientX - last.x) * 0.005;
      vel.x = (e.clientY - last.y) * 0.003;
      last = { x: e.clientX, y: e.clientY };
    });
    const end = () => { dragging = false; };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    // 画面外では描画しない
    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);

    const tick = () => {
      requestAnimationFrame(tick);
      if (!visible) return;
      if (!dragging) {
        vel.x *= 0.94;
        vel.y = vel.y * 0.95 + auto * 0.05;
      }
      globe.rotation.y += vel.y;
      globe.rotation.x = Math.max(-0.6, Math.min(0.6, globe.rotation.x + vel.x));
      renderer.render(scene, camera);
    };
    tick();

    window.addEventListener('resize', () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      camera.aspect = w / h;
      camera.position.z = w < 600 ? 360 : 290;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
  };

  // 近づいてから初期化する（初期表示を軽くするため）
  if ('IntersectionObserver' in window) {
    const lazy = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { lazy.disconnect(); start(); }
    }, { rootMargin: '400px 0px' });
    lazy.observe(stage);
  } else {
    start();
  }
})();
