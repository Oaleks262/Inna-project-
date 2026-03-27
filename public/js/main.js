(function () {

  /* ── Needle cursor ── */
  var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  var needleEl = document.getElementById('cursorNeedle');
  var canvas   = document.getElementById('threadCanvas');

  if (isTouch) {
    needleEl.style.display = 'none';
    canvas.style.display   = 'none';
    document.body.style.cursor = 'auto';
    document.querySelectorAll('a,button,input,select,textarea').forEach(function(el){ el.style.cursor='auto'; });
  } else {
    needleEl.style.opacity = '0';

    var mx = 0, my = 0, pmx = 0, pmy = 0;
    var angle = 0;
    var POINTS = 26;
    var pts = [];
    for (var i = 0; i < POINTS; i++) pts.push({ x: -200, y: -200 });

    var ctx = canvas.getContext('2d');
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    var started = false;
    var targetAngle = 0;  // raw angle from mouse movement
    var smoothAngle = 0;  // smoothed angle — no jitter

    document.addEventListener('mousemove', function (e) {
      pmx = mx; pmy = my;
      mx = e.clientX; my = e.clientY;

      if (!started) {
        started = true;
        needleEl.style.opacity = '1';
        for (var i = 0; i < POINTS; i++) { pts[i].x = mx; pts[i].y = my; }
      }

      var dx = mx - pmx, dy = my - pmy;
      // Only update angle if mouse moved enough — kills micro-jitter
      if (dx*dx + dy*dy > 9) {
        targetAngle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      }
    });

    (function loop() {
      // Smooth angle interpolation — eases towards target, no sudden jumps
      var da = targetAngle - smoothAngle;
      // Wrap angle delta to [-180, 180] so needle doesn't spin 340deg the wrong way
      if (da > 180)  da -= 360;
      if (da < -180) da += 360;
      smoothAngle += da * 0.12;  // 0.12 = nice lag, raise for faster response

      // Position: tip of needle (SVG top center = cx=8, cy=0) must sit exactly on mx,my
      // SVG is 16×72, transform-origin default = top-left
      // We rotate around the tip point:
      //   translate so tip lands on mouse → tip is at (8, 0) in SVG → offset (-8px, 0px)
      needleEl.style.left      = mx + 'px';
      needleEl.style.top       = my + 'px';
      needleEl.style.transform = 'translate(-8px, 0px) rotate(' + smoothAngle + 'deg)';
      // Note: rotation happens around top-left of element (0,0),
      // but we want rotation around the tip which is at (8,0) in SVG space.
      // Correct approach: use transform-origin on the element.
      needleEl.style.transformOrigin = '8px 0px';

      /* Eye position: rotate vector (0, 64) by smoothAngle around tip */
      var r = smoothAngle * Math.PI / 180;
      var EYE_Y = 64; // px down from tip to eye center
      var ex = mx + (0   * Math.cos(r) - EYE_Y * Math.sin(r));
      var ey = my + (0   * Math.sin(r) + EYE_Y * Math.cos(r));

      // Spring chain: pt[0] chases eye, rest chase each other
      pts[0].x += (ex - pts[0].x) * 0.4;
      pts[0].y += (ey - pts[0].y) * 0.4;
      for (var i = 1; i < POINTS; i++) {
        var f = Math.max(0.28 - i * 0.007, 0.05);
        pts[i].x += (pts[i-1].x - pts[i].x) * f;
        pts[i].y += (pts[i-1].y - pts[i].y) * f;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (started) {
        var g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[POINTS-1].x, pts[POINTS-1].y);
        g.addColorStop(0,    'rgba(184,150,90,0.92)');
        g.addColorStop(0.25, 'rgba(220,185,120,0.7)');
        g.addColorStop(0.6,  'rgba(184,150,90,0.3)');
        g.addColorStop(1,    'rgba(184,150,90,0)');

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var j = 1; j < POINTS - 2; j++) {
          ctx.quadraticCurveTo(pts[j].x, pts[j].y, (pts[j].x+pts[j+1].x)/2, (pts[j].y+pts[j+1].y)/2);
        }
        ctx.lineTo(pts[POINTS-1].x, pts[POINTS-1].y);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.stroke();

        /* tail knot */
        ctx.beginPath();
        ctx.arc(pts[POINTS-1].x, pts[POINTS-1].y, 1.8, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(184,150,90,0.4)';
        ctx.fill();
      }
      requestAnimationFrame(loop);
    })();

    document.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('mouseenter', function () { needleEl.classList.add('hovering'); });
      el.addEventListener('mouseleave', function () { needleEl.classList.remove('hovering'); });
    });
  }

  /* ── Smooth scroll ── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    e.preventDefault();
    var t = document.getElementById(id);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeMob();
  });
  var navCtaEl = document.getElementById('navCta');
  if (navCtaEl) {
    navCtaEl.addEventListener('click', function () {
      var contactEl = document.getElementById('contact');
      if (contactEl) contactEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ── Navbar ── */
  var navbar = document.getElementById('navbar');
  window.addEventListener('scroll', function () {
    navbar.classList.toggle('scrolled', window.pageYOffset > 60);
  }, { passive: true });

  /* ── Burger ── */
  var burger  = document.getElementById('burger');
  var mobMenu = document.getElementById('mobileMenu');
  function closeMob() {
    burger.classList.remove('open');
    mobMenu.classList.remove('open');
    document.body.style.overflow = '';
  }
  burger.addEventListener('click', function () {
    if (mobMenu.classList.contains('open')) { closeMob(); }
    else { burger.classList.add('open'); mobMenu.classList.add('open'); document.body.style.overflow = 'hidden'; }
  });
  document.querySelectorAll('.mob-link').forEach(function (el) { el.addEventListener('click', closeMob); });

  /* ── Scroll reveal ── */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ── Portfolio filter ── */
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var f = btn.getAttribute('data-filter');
      document.querySelectorAll('.portfolio-grid .item').forEach(function (item) {
        item.style.display = (f === 'all' || item.getAttribute('data-cat') === f) ? '' : 'none';
      });
    });
  });

  /* ── Form ── */
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      this.style.display = 'none';
      document.getElementById('formSuccess').classList.add('show');
    });
  }

})();
