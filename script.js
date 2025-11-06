// =======================================
//  PARÁMETROS DEL ROBOT (m) Y TIEMPOS (s)
// =======================================
const l1 = 0.12;
const l2 = 0.12;
const pinza = 0.02;

const xi = 0.14;
const yi = 0.14;

const ti = 0;
const tf = 20;

// ===================
//  UTILIDADES BÁSICAS
// ===================
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function rad2deg(r) { return r * 180 / Math.PI; }
function deg2rad(d) { return d * Math.PI / 180; }

function validarAlcance (x_d, y_d, l1, l2){
  const r = Math.hypot(x_d, y_d);
  const minReach = Math.abs(l1 - l2);
  const maxReach = l1 + l2;
  return r >= minReach - 1e-9 && r <= maxReach + 1e-9;
}

// ============
//  CINEMÁTICAS
// ============
function cinematicaDirecta(q1, q2, l1, l2) {
  const x = l1*Math.cos(q1) + l2*Math.cos(q1+q2);
  const y = l1*Math.sin(q1) + l2*Math.sin(q1+q2);
  return { x, y };
}

function cinematicaInversa(x_d, y_d, l1, l2, elbow = 'up') {
  const r2 = x_d*x_d + y_d*y_d;
  const r  = Math.sqrt(r2);

  const maxR = l1 + l2;
  const minR = Math.abs(l1 - l2);
  const reachable = (r <= maxR + 1e-9) && (r >= minR - 1e-9);

  let c2 = (r2 - l1*l1 - l2*l2) / (2 * l1 * l2);
  c2 = clamp(c2, -1, 1);

  const s2_abs = Math.sqrt(Math.max(0, 1 - c2*c2));
  const s2 = (elbow === 'down') ? -s2_abs : s2_abs;

  const theta2 = Math.atan2(s2, c2);

  const k1 = l1 + l2 * c2;
  const k2 = l2 * s2;
  const theta1 = Math.atan2(y_d, x_d) - Math.atan2(k2, k1);

  return {
    theta1,
    theta2,
    theta1_deg: rad2deg(theta1),
    theta2_deg: rad2deg(theta2),
    reachable
  };
}

// ================
//  PERFIL QUÍNTICO
// ================
function quinticCoeffs(q0, qf, tf) {
  const dq = qf - q0;
  const tf2 = tf*tf, tf3 = tf2*tf, tf4 = tf3*tf, tf5 = tf4*tf;
  return {
    a0: q0, a1: 0, a2: 0,
    a3: 10*dq/tf3,
    a4: -15*dq/tf4,
    a5: 6*dq/tf5
  };
}

function evalQuintic({a0,a1,a2,a3,a4,a5}, t) {
  const t2 = t*t, t3=t2*t, t4=t3*t, t5=t4*t;
  const q  = a0 + a1*t + a2*t2 + a3*t3 + a4*t4 + a5*t5;
  const dq =        a1   + 2*a2*t + 3*a3*t2 + 4*a4*t3 + 5*a5*t4;
  const ddq=                 2*a2   + 6*a3*t +12*a4*t2 +20*a5*t3;
  return { q, dq, ddq };
}

// =============
//  DOM Y ESTADO
// =============
const $xd = document.getElementById('input-xd');
const $yd = document.getElementById('input-yd');
const $plotQ1 = document.getElementById('plot-q1');
const $plotQ2 = document.getElementById('plot-q2');
const $btnAplicar = document.getElementById('btn-aplicar');
const $btnHome = document.getElementById('btn-home');
const $btnTheme = document.getElementById('btn-theme');
const $selectElbow = document.getElementById('select-elbow');
const $btnLimite = document.getElementById('btn-limite');

const canvas = document.getElementById('robot-canvas');
const ctx = canvas.getContext('2d');

const home = cinematicaInversa(xi, yi, l1, l2, 'up');
let q1_now = home.theta1;
let q2_now = home.theta2;

let tray = [];
let animStart = null;

let SCALE = 300;

let modoAnimacion = true;

// =======
//  DIBUJO
// =======
function toCanvas(x, y) {
  const ORGX = canvas.width/2;
  const ORGY = canvas.height/2;
  return { X: ORGX + x*SCALE, Y: ORGY - y*SCALE };
}

let limitePorPinza = false;

function drawGrid() {
  const css = getComputedStyle(document.documentElement);
  const gridColor = css.getPropertyValue('--grid').trim() || '#2a313a';
  const limitColor = '#6366f1';
  const ORGX = canvas.width / 2;
  const ORGY = canvas.height / 2;

  ctx.save();

  ctx.lineWidth = 1;
  ctx.strokeStyle = gridColor;
  const stepM = 0.04;
  const stepPx = stepM * SCALE;

  for (let x = ORGX; x < canvas.width; x += stepPx) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let x = ORGX - stepPx; x > 0; x -= stepPx) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = ORGY; y < canvas.height; y += stepPx) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  for (let y = ORGY - stepPx; y > 0; y -= stepPx) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#6b7280';
  ctx.beginPath(); ctx.moveTo(0, ORGY); ctx.lineTo(canvas.width, ORGY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ORGX, 0); ctx.lineTo(ORGX, canvas.height); ctx.stroke();

  const extra = limitePorPinza ? pinza : 0;
  const rMax = (l1 + l2 + extra) * SCALE;

  ctx.strokeStyle = limitColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.arc(ORGX, ORGY, rMax, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = limitColor;
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.fillText(
    limitePorPinza
      ? `Límite considerando pinza (${(l1 + l2 + pinza).toFixed(2)} m)`
      : `Límite clásico (${(l1 + l2).toFixed(2)} m)`,
    ORGX + rMax / Math.SQRT2 + 8,
    ORGY - rMax / Math.SQRT2
  );

  ctx.restore();
}

function drawRobot(q1, q2, pathPts=null) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawGrid();

  const colL1 = '#3b82f6';
  const colL2 = '#f59e0b';
  const colJoint = '#111111';
  const colGripper = '#22c55e';
  const colPath = '#9ca3af';

  const p0 = {x:0, y:0};
  const p1 = {x:l1*Math.cos(q1), y:l1*Math.sin(q1)};
  const p2 = {x:p1.x + l2*Math.cos(q1+q2), y:p1.y + l2*Math.sin(q1+q2)};

  const P0 = toCanvas(p0.x, p0.y);
  const P1 = toCanvas(p1.x, p1.y);
  const P2 = toCanvas(p2.x, p2.y);

  // Eslabón 1
  ctx.lineWidth = 8;
  ctx.strokeStyle = colL1;
  ctx.beginPath(); ctx.moveTo(P0.X, P0.Y); ctx.lineTo(P1.X, P1.Y); ctx.stroke();

  // Eslabón 2
  ctx.lineWidth = 8;
  ctx.strokeStyle = colL2;
  ctx.beginPath(); ctx.moveTo(P1.X, P1.Y); ctx.lineTo(P2.X, P2.Y); ctx.stroke();

  // Articulaciones
  ctx.fillStyle = colJoint;
  ctx.beginPath(); ctx.arc(P0.X, P0.Y, 6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(P1.X, P1.Y, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(P2.X, P2.Y, 4, 0, Math.PI*2); ctx.fill();

  const half = pinza/2;
  const nx = Math.cos(q1+q2), ny = Math.sin(q1+q2);
  const g1 = toCanvas(p2.x - half*nx, p2.y - half*ny);
  const g2 = toCanvas(p2.x + half*nx, p2.y + half*ny);
  ctx.strokeStyle = colGripper;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(g1.X, g1.Y); ctx.lineTo(g2.X, g2.Y); ctx.stroke();

  if (pathPts && pathPts.length) {
    const pick = p => (limitePorPinza && p.xt != null && p.yt != null)
        ? {x:p.xt, y:p.yt}
        : {x:p.x,  y:p.y};

    ctx.save();
    ctx.setLineDash([6,6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = colPath;

    const p0c = pick(pathPts[0]);
    let Pc = toCanvas(p0c.x, p0c.y);
    ctx.beginPath();
    ctx.moveTo(Pc.X, Pc.Y);

    for (let i=1;i<pathPts.length;i++) {
      const pi = pick(pathPts[i]);
      Pc = toCanvas(pi.x, pi.y);
      ctx.lineTo(Pc.X, Pc.Y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// =========================
//  PLANIFICACIÓN Y MUESTREO
// =========================
function planMove(xd, yd, q1_0, q2_0, tf=20, elbow='up') {
  const sol = cinematicaInversa(xd, yd, l1, l2, elbow);
  if (!sol || !sol.reachable) return { error: 'Objetivo fuera del espacio de trabajo' };
  const { theta1: q1f, theta2: q2f } = sol;
  const c1 = quinticCoeffs(q1_0, q1f, tf);
  const c2 = quinticCoeffs(q2_0, q2f, tf);
  return { c1, c2, qf: {q1:q1f, q2:q2f}, tf };
}

function sampleTrajectory(plan, dt=0.05) {
  const {c1,c2,tf} = plan;
  const N = Math.max(2, Math.floor(tf/dt)+1);
  const pts = [];
  for (let i=0;i<N;i++) {
    const t = Math.min(tf, i*dt);
    const e1 = evalQuintic(c1, t);
    const e2 = evalQuintic(c2, t);
    const cd = cinematicaDirecta(e1.q, e2.q, l1, l2);

    // Punta de pinza
    const qsum = e1.q + e2.q;
    const tip = pinza * 0.5;
    const xt = limitePorPinza ? cd.x + tip * Math.cos(qsum) : undefined;
    const yt = limitePorPinza ? cd.y + tip * Math.sin(qsum) : undefined;

    pts.push({
      t,
      q1:e1.q, dq1:e1.dq, ddq1:e1.ddq,
      q2:e2.q, dq2:e2.dq, ddq2:e2.ddq,
      x:cd.x, y:cd.y,
      xt, yt
    });
  }
  return pts;
}

// ======
//  PLOTS
// ======
function plotArticular(traj) {
  const t = traj.map(p=>p.t);
  const q1 = traj.map(p=>rad2deg(p.q1));
  const q2 = traj.map(p=>rad2deg(p.q2));

  const css = getComputedStyle(document.documentElement);
  const gridc = css.getPropertyValue('--grid').trim() || '#2a313a';
  const fontFamily = css.getPropertyValue('--font').trim() || 'Inter, system-ui';
  const textc = css.getPropertyValue('--text').trim() || '#e8eef5';

  const base = {
    margin:{l:40,r:10,b:40,t:28},
    xaxis:{title:'t [s]', gridcolor:gridc, zerolinecolor:gridc},
    yaxis:{title:'θ [deg]', gridcolor:gridc, zerolinecolor:gridc},
    paper_bgcolor:'rgba(0,0,0,0)',
    plot_bgcolor:'rgba(0,0,0,0)',
    font:{family:fontFamily, color:textc},
    showlegend:false
  };

  Plotly.react($plotQ1, [{x:t,y:q1,mode:'lines'}], {...base, title:'q1d(t)'});
  Plotly.react($plotQ2, [{x:t,y:q2,mode:'lines'}], {...base, title:'q2d(t)'});
}

// ==========
//  ANIMACIÓN
// ==========
function animateTrajectory(traj) {
  animStart = performance.now();
  const T = traj[traj.length-1].t;

  function frame(now) {
    const elapsed = (now - animStart) / 1000;
    const t = Math.min(T, elapsed);

    const step = T / (traj.length - 1);
    let i = Math.max(0, Math.min(traj.length-2, Math.floor(t / step)));
    const a = traj[i], b = traj[i+1];
    const alpha = (t - a.t) / (b.t - a.t + 1e-12);

    const q1 = a.q1 + (b.q1 - a.q1)*alpha;
    const q2 = a.q2 + (b.q2 - a.q2)*alpha;

    drawRobot(q1, q2, traj);

    if (t < T) requestAnimationFrame(frame);
    else {
      q1_now = traj[traj.length-1].q1;
      q2_now = traj[traj.length-1].q2;
    }
  }
  requestAnimationFrame(frame);
}

// ============================
//  CONTROL PRINCIPAL / EVENTOS
// ============================
function hydrateTipCoords(traj) {
  const tip = pinza * 0.5;
  for (const p of traj) {
    if (limitePorPinza) {
      const qsum = p.q1 + p.q2;
      p.xt = p.x + tip * Math.cos(qsum);
      p.yt = p.y + tip * Math.sin(qsum);
    } else {
      p.xt = undefined;
      p.yt = undefined;
    }
  }
}

function run() {
  const xd = parseFloat($xd.value || $xd.placeholder || '0.10');
  const yd = parseFloat($yd.value || $yd.placeholder || '0.20');
  const elbow = ($selectElbow && $selectElbow.value) || 'up';

  if (!validarAlcance(xd, yd, l1, l2)) {
    alert('El punto deseado está FUERA del espacio de trabajo.');
    return;
  }

  const plan = planMove(xd, yd, q1_now, q2_now, tf, elbow);
  if (plan.error) { alert(plan.error); return; }

  tray = sampleTrajectory(plan, 0.05);
  hydrateTipCoords(tray);
  plotArticular(tray);

  if (modoAnimacion){
    animateTrajectory(tray);
  } else {
    const last = tray[tray.length - 1];
    q1_now = last.q1;
    q2_now = last.q2;
    drawRobot(q1_now, q2_now, tray);
  }
}

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - canvas.width/2) / SCALE;
  const y = -(e.clientY - rect.top - canvas.height/2) / SCALE;
  $xd.value = x.toFixed(2);
  $yd.value = y.toFixed(2);
  run();
});

if ($btnHome) {
  $btnHome.addEventListener('click', () => {
    const h = cinematicaInversa(xi, yi, l1, l2, 'up');
    if (h && h.reachable){
      const plan = planMove(xi, yi, q1_now, q2_now, tf, 'up');
      tray = sampleTrajectory(plan, 0.05);
      hydrateTipCoords(tray);
      plotArticular(tray);
      if (modoAnimacion) animateTrajectory(tray);
      else {
        const last = tray[tray.length-1];
        q1_now = last.q1; q2_now = last.q2;
        drawRobot(q1_now, q2_now, tray);
      }
    }
  });
}

if ($btnAplicar) $btnAplicar.addEventListener('click', run);

$xd.addEventListener('keyup', e => (e.key==='Enter') && run());
$yd.addEventListener('keyup', e => (e.key==='Enter') && run());

if ($btnTheme) {
  $btnTheme.addEventListener('click', ()=>{
    const r = document.documentElement;
    r.classList.toggle('light');
    if (tray.length) plotArticular(tray);
    drawRobot(q1_now, q2_now, tray.length ? tray : null);
  });
}

if ($btnLimite) {
  $btnLimite.addEventListener('click', (e) => {
    limitePorPinza = !limitePorPinza;
    if (tray && tray.length) hydrateTipCoords(tray);
    drawRobot(q1_now, q2_now, tray.length ? tray : null);
    e.currentTarget.classList.toggle('is-active', limitePorPinza);
  });
}

document.querySelectorAll('.btn').forEach(b=>{
  b.addEventListener('pointerdown', e=>{
    const r = b.getBoundingClientRect();
    b.style.setProperty('--rx', `${e.clientX - r.left}px`);
    b.style.setProperty('--ry', `${e.clientY - r.top}px`);
  });
});

const $modeAnim = document.getElementById('mode-anim');
const $modeInstant = document.getElementById('mode-instant');

if ($modeAnim && $modeInstant){
  $modeAnim.addEventListener('click', ()=>{
    if (!modoAnimacion){
      modoAnimacion = true;
      $modeAnim.classList.add('is-active');  $modeAnim.setAttribute('aria-selected','true');
      $modeInstant.classList.remove('is-active'); $modeInstant.setAttribute('aria-selected','false');
    }
  });
  $modeInstant.addEventListener('click', ()=>{
    if (modoAnimacion){
      modoAnimacion = false;
      $modeInstant.classList.add('is-active'); $modeInstant.setAttribute('aria-selected','true');
      $modeAnim.classList.remove('is-active');  $modeAnim.setAttribute('aria-selected','false');
    }
  });
}

// ==================
//  RESPONSIVE CANVAS
// ==================
function resizeCanvas(){
  const wrap = document.querySelector('.canvas-wrap') || canvas.parentElement;
  const w = wrap.clientWidth;
  const aspect = 4/3;
  canvas.width = w;
  canvas.height = Math.round(w / aspect);

  const R = l1 + l2;
  const margin = 0.06;
  const usable = Math.min(canvas.width, canvas.height) * 0.9;
  SCALE = usable / (2*(R + margin));

  drawRobot(q1_now, q2_now, tray.length ? tray : null);
}
window.addEventListener('resize', resizeCanvas);

// =====
//  BOOT
// =====
window.addEventListener('load', () => {
  resizeCanvas();
  drawRobot(q1_now, q2_now, null);
});