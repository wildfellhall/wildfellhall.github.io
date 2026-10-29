import * as THREE from 'three';
import { createGazetteGeometry, bendGazette, offsetGazetteLayer, createGazetteEdge, createLooseTwine, GAZETTE_WIDTH, GAZETTE_DEPTH } from './gazette-geometry.js';
import { createGazettePrinting, loadGazetteFonts } from './gazette-print.js';
import { parseGazette, dateLabel } from './gazette-text.js';
import { createControlFrame } from './control-frame.js';

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
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#d6ceba', roughness: 1 });
  // Four independently shaded leaves (eight exposed faces in the loose fold)
  // give even an empty edition a real gathered edge. Small textures on the
  // covered leaves reserve high-resolution ink for the page being read.
  const leaves = Array.from({length: 4}, (_, index) => {
    const g = geometry.clone();
    const front = new THREE.Mesh(g), back = new THREE.Mesh(g);
    front.name = `gazette-leaf-${index + 1}-recto`; back.name = `gazette-leaf-${index + 1}-verso`;
    front.castShadow = true; front.receiveShadow = back.receiveShadow = true;
    front.userData.gazettePick = back.userData.gazettePick = true;
    const edge = new THREE.Mesh(createGazetteEdge(g), edgeMaterial); edge.name = `gazette-cut-edge-${index + 1}`;
    group.add(front, back, edge); return {geometry: g, front, back, edge};
  });
  function updateBundle(openness) {
    bendGazette(geometry, openness);
    for (const [index, leaf] of leaves.entries()) {
      offsetGazetteLayer(leaf.geometry, geometry, index, openness);
      leaf.edge.geometry.dispose(); leaf.edge.geometry = createGazetteEdge(leaf.geometry);
    }
  }
  function assignBundle() {
    for (const [index, leaf] of leaves.entries()) {
      const printedPage = Math.min(printing.pages.length - 1, leaves.length - index - 1);
      leaf.front.material = printing.get(index === leaves.length - 1 ? page : printedPage, false, index !== leaves.length - 1);
      leaf.front.material.side = THREE.FrontSide;
      // A single paper surface must block the window light from either side
      // as its loose upper flap folds over the leaves underneath.
      leaf.front.material.shadowSide = THREE.DoubleSide;
      leaf.back.material = printing.get(index === 0 ? 0 : printedPage, true, index !== 0);
      leaf.back.material.side = THREE.BackSide;
    }
    printing.prune(page);
  }
  const twine = createLooseTwine(); group.add(twine); twine.position.set(2.8, 0, -.9); twine.rotation.y = -.3;
  // The folded outside carries page one; lifting it reveals the first
  // inside page. Keep that face prepared before the fold starts moving.
  let opened = false, progress = 0, page = 1, loading = false;
  function assignPage(index) { page = index; assignBundle(); }
  assignBundle(); updateBundle(0);
  return {
    group, twine, catalog, leaves,
    width: GAZETTE_WIDTH * .86, depth: GAZETTE_DEPTH * .86,
    get issue() { return issue; }, get opened() { return opened; }, get progress() { return progress; },
    get page() { return opened ? page : 0; }, get pageCount() { return printing.pages.length; }, get loading() { return loading; },
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
      if (action === 'open' || action === 'toggle') {
        const opening = action === 'open' || !opened;
        // Entering full-screen reading calls open again. Preserve the page
        // then, but start at the inside whenever a folded issue is reopened.
        if (opening && !opened) assignPage(1);
        opened = opening;
      }
      else if (action === 'close') opened = false;
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
        nextPrinting.get(1); nextPrinting.get(0, true);
        const old = printing; printing = nextPrinting; issue = next; assignPage(1); old.dispose();
      } finally { loading = false; }
    },
    animate(delta, reducedMotion) {
      const target = opened ? 1 : 0, before = progress;
      progress = reducedMotion ? target : THREE.MathUtils.lerp(progress, target, 1 - Math.exp(-delta * 4.5));
      if (Math.abs(progress - target) < .001) progress = target;
      if (progress !== before) { updateBundle(progress); group.updateMatrixWorld(true); }
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
    if (section.subtitle) { const subtitle = document.createElement('p'); subtitle.textContent = section.subtitle; article.append(subtitle); }
    if (section.byline) { const byline = document.createElement('p'); byline.textContent = section.byline; article.append(byline); }
    for (const text of section.body.split(/\n\s*\n/).filter(Boolean)) { const p = document.createElement('p'); p.textContent = text; article.append(p); }
    target.append(article);
  }
}

export function connectArchive({ gazette, invalidate = () => {}, status, fallback = false }) {
  const dialog = document.querySelector('#gazette-archive'), list = document.querySelector('#gazette-dates');
  const error = document.querySelector('#gazette-archive-error'), transcript = document.querySelector('#gazette-transcript');
  const button = document.querySelector('#gazette-archive-open'), close = document.querySelector('#gazette-archive-close');
  let returnFocus, archiveFrame, framePromise;
  async function renderFrame() {
    if (fallback) return;
    try {
      framePromise ||= createControlFrame(dialog, { portrait: true });
      archiveFrame = await framePromise;
      if (dialog.open) archiveFrame.render(document.querySelector('#room').classList.contains('is-evening') ? 1 : 0);
    } catch { /* The still, rendered from the same casting, remains visible. */ }
  }
  const dismiss = () => { dialog.close(); returnFocus?.focus({ preventScroll: true }); };
  close.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  button.addEventListener('click', async () => {
    returnFocus = document.activeElement; dialog.showModal(); error.textContent = ''; list.replaceChildren();
    renderFrame();
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
