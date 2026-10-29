import * as THREE from 'three';
import { createGazetteGeometry, bendGazette, createLooseTwine, GAZETTE_WIDTH, GAZETTE_DEPTH } from './gazette-geometry.js';
import { createGazettePrinting, loadGazetteFonts } from './gazette-print.js';
import { parseGazette, dateLabel } from './gazette-text.js';

const base = `${import.meta.env.BASE_URL}gazette/`;
async function fetchText(file) {
  const response = await fetch(`${base}${file}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Gazette: HTTP ${response.status}`);
  return response.text();
}
export async function loadCatalog() {
  const catalog = JSON.parse(await fetchText('index.json'));
  if (!Array.isArray(catalog) || !catalog.length) throw new Error('No Gazette issues are available.');
  return catalog;
}
export async function loadIssue(entry) {
  // Use only canonical dated files, never a path supplied by issue prose.
  return parseGazette(await fetchText(`issues/${entry.date}.txt`), entry.date);
}

export async function createGazette(surfaceY, maxTextureSize = 4096) {
  const [catalog] = await Promise.all([loadCatalog(), loadGazetteFonts()]);
  let issue = await loadIssue(catalog[0]), printing = createGazettePrinting(issue, maxTextureSize);
  const group = new THREE.Group(); group.name = 'wildfell-gazette';
  group.position.set(-3.9, surfaceY + .007, .25); group.rotation.y = .105; group.scale.setScalar(.86);
  const geometry = createGazetteGeometry();
  const front = new THREE.Mesh(geometry, printing.get(0)); front.name = 'continuous-folded-newspaper';
  front.material.side = THREE.FrontSide; front.castShadow = front.receiveShadow = true;
  const back = new THREE.Mesh(geometry, printing.get(0, true)); back.name = 'printed-newspaper-reverse';
  back.material.side = THREE.BackSide; back.receiveShadow = true;
  front.userData.gazettePick = back.userData.gazettePick = true;
  group.add(front, back);
  // Thin, uneven cut edge follows the very same boundary as both paper faces.
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#d4c8aa', roughness: 1 });
  let edge;
  function updateEdge() {
    const p = geometry.attributes.position, boundary = [], cols = 65, rows = 101;
    for (let x = 0; x < cols; x++) boundary.push(x);
    for (let y = 1; y < rows; y++) boundary.push(y * cols + cols - 1);
    for (let x = cols - 2; x >= 0; x--) boundary.push((rows - 1) * cols + x);
    for (let y = rows - 2; y > 0; y--) boundary.push(y * cols);
    boundary.push(0);
    const curve = new THREE.CatmullRomCurve3(boundary.map(i => new THREE.Vector3().fromBufferAttribute(p, i)));
    const g = new THREE.TubeGeometry(curve, boundary.length, .0016, 3, false);
    if (!edge) { edge = new THREE.Mesh(g, edgeMaterial); group.add(edge); } else { edge.geometry.dispose(); edge.geometry = g; }
  }
  updateEdge();
  const twine = createLooseTwine(); group.add(twine); twine.position.set(2.8, 0, -.9); twine.rotation.y = -.3;
  let opened = false, progress = 0, page = 0, loading = false;
  function assignPage(index) {
    page = index;
    front.material = printing.get(page); front.material.side = THREE.FrontSide;
    back.material = printing.get(page, true); back.material.side = THREE.BackSide;
  }
  return {
    group, twine, catalog,
    width: GAZETTE_WIDTH * .86, depth: GAZETTE_DEPTH * .86,
    get issue() { return issue; }, get opened() { return opened; }, get progress() { return progress; },
    get page() { return page; }, get pageCount() { return printing.pages.length; }, get loading() { return loading; },
    get phase() { return progress === (opened ? 1 : 0) ? opened ? 'open' : 'closed' : opened ? 'unfolding' : 'folding'; },
    place(viewWidth, portrait) {
      group.position.x = portrait ? -1.35 : -Math.min(3.9, Math.max(1.25, viewWidth / 2 - 2.3));
      // Keep the two objects beside each other in the narrow portrait crop.
      // The loose tie sits below the sheet, clear of its unfolding path.
      group.position.z = portrait ? .50 : .25;
      group.rotation.y = portrait ? -.035 : .105;
      twine.position.set(portrait ? -1.6 : 2.8, 0, portrait ? 3.7 : -.9);
      group.scale.setScalar(portrait ? .62 : .86);
      this.width = GAZETTE_WIDTH * group.scale.x; this.depth = GAZETTE_DEPTH * group.scale.x;
      group.updateMatrixWorld(true);
    },
    activate(action) {
      if (action === 'open') opened = true;
      else if (action === 'close') opened = false;
      else if (action === 'toggle') opened = !opened;
      else if (action === 'next' && page < printing.pages.length - 1) assignPage(page + 1);
      else if (action === 'previous' && page > 0) assignPage(page - 1);
    },
    async select(date) {
      if (loading || date === issue.date) return;
      const entry = catalog.find(item => item.date === date); if (!entry) throw new Error('This issue is not in the archive.');
      loading = true;
      try {
        const next = await loadIssue(entry), nextPrinting = createGazettePrinting(next, maxTextureSize);
        // Prepare both sides before replacing the current issue. A failed
        // fetch leaves the reader's existing issue and place intact.
        nextPrinting.get(0); nextPrinting.get(0, true);
        const old = printing; printing = nextPrinting; issue = next; assignPage(0); old.dispose();
      } finally { loading = false; }
    },
    animate(delta, reducedMotion) {
      const target = opened ? 1 : 0, before = progress;
      progress = reducedMotion ? target : THREE.MathUtils.lerp(progress, target, 1 - Math.exp(-delta * 4.5));
      if (Math.abs(progress - target) < .001) progress = target;
      if (progress !== before) { bendGazette(geometry, progress); updateEdge(); group.updateMatrixWorld(true); }
      return { changed: progress !== before, unsettled: progress !== target };
    },
    anchor() {
      geometry.computeBoundingBox(); const point = geometry.boundingBox.getCenter(new THREE.Vector3());
      return group.localToWorld(point);
    },
  };
}

export function issueTranscript(issue, target) {
  target.replaceChildren();
  const heading = document.createElement('h2'); heading.textContent = `Wildfell Gazette — ${dateLabel(issue.date)}`; target.append(heading);
  for (const section of issue.sections) {
    const article = document.createElement('section'), title = document.createElement('h3');
    title.textContent = section.title || section.label; article.append(title);
    if (section.byline) { const byline = document.createElement('p'); byline.textContent = section.byline; article.append(byline); }
    for (const text of section.body.split(/\n\s*\n/).filter(Boolean)) { const p = document.createElement('p'); p.textContent = text; article.append(p); }
    target.append(article);
  }
}

export function connectArchive({ gazette, invalidate = () => {}, status, fallback = false }) {
  const dialog = document.querySelector('#gazette-archive'), list = document.querySelector('#gazette-dates');
  const error = document.querySelector('#gazette-archive-error'), transcript = document.querySelector('#gazette-transcript');
  const button = document.querySelector('#gazette-archive-open'), close = document.querySelector('#gazette-archive-close');
  let returnFocus;
  const dismiss = () => { dialog.close(); returnFocus?.focus({ preventScroll: true }); };
  close.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  button.addEventListener('click', async () => {
    returnFocus = document.activeElement; dialog.showModal(); error.textContent = ''; list.replaceChildren();
    try {
      const catalog = gazette?.catalog || await loadCatalog();
      for (const entry of catalog) {
        const li = document.createElement('li'), select = document.createElement('button'); select.textContent = entry.label;
        if (entry.date === gazette?.issue.date) select.setAttribute('aria-current', 'date');
        select.addEventListener('click', async () => {
          list.setAttribute('aria-busy', 'true'); for (const b of list.querySelectorAll('button')) b.disabled = true;
          error.textContent = '';
          try {
            if (gazette) { await gazette.select(entry.date); issueTranscript(gazette.issue, transcript); invalidate(); dismiss(); }
            else { issueTranscript(await loadIssue(entry), document.querySelector('#gazette-fallback-text')); }
            status.textContent = `Wildfell Gazette, ${entry.label}.`;
          } catch { error.textContent = 'This issue could not be loaded. Please try again.'; }
          finally { list.setAttribute('aria-busy', 'false'); for (const b of list.querySelectorAll('button')) b.disabled = false; }
        });
        li.append(select); list.append(li);
      }
      list.querySelector('button')?.focus();
    } catch { error.textContent = 'The archive could not be loaded. Close and reopen it to try again.'; }
  });
  if (gazette) issueTranscript(gazette.issue, transcript);
  if (fallback) {
    document.querySelector('#gazette-tools').hidden = false;
    document.querySelector('#gazette-previous').hidden = document.querySelector('#gazette-next').hidden = true;
  }
}
