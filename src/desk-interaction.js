import * as THREE from 'three';

// The camera stays square to the furniture. Inspection moves within its image
// plane, so dragging and zooming cannot tip the desk relative to the carpet.
export function createDeskInteraction({ canvas, room, camera, desk, book, status, invalidate, resetView }) {
  const zoomIn = document.querySelector('#zoom-in'), zoomOut = document.querySelector('#zoom-out');
  const drawerControls = document.querySelector('#drawer-controls');
  const buttons = [...drawerControls.querySelectorAll('button')];
  const names = ['left', 'centre', 'right'];
  const bookControls = document.querySelector('#book-controls');
  const transcript = document.querySelector('#book-transcript');
  const bookClose = document.querySelector('#book-close');
  const bookRead = document.querySelector('#book-read'), viewToggle = document.querySelector('#view-toggle');
  const viewReset = document.querySelector('#view-reset');
  const bookButtons = [...bookControls.querySelectorAll('button')];
  const pan = new THREE.Vector2(), pointers = new Map(), raycaster = new THREE.Raycaster();
  const pickMeshes = [];
  desk.group.traverse(object => {
    // Relief follows the backing timber, whose simpler surfaces provide the
    // same picking area without testing every small carved leaf on each move.
    if (object.isMesh && object.name !== 'ivory-relief') pickMeshes.push(object);
  });
  book.group.traverse(object => { if (object.isMesh && object.userData.bookPick) pickMeshes.push(object); });
  let zoom = 1, gesture = null, enabled = false, focusedDrawer = null, focusedBook = null;
  let lastBookPhase = 'closed', lastBookPage = 0;
  let reading = false, deskView = null, ownedFullscreen = false, pendingTap = 0, lastTap = null;
  const MIN_ZOOM = 1, MAX_ZOOM = 2.8;
  const size = () => canvas.getBoundingClientRect();
  const visible = () => new THREE.Vector2((camera.right - camera.left) / camera.zoom, (camera.top - camera.bottom) / camera.zoom);
  function limits() {
    if (reading) {
      const view = visible();
      return new THREE.Vector2(Math.max(0, (book.width - view.x) / 2 + .12), Math.max(0, (book.depth - view.y) / 2 + .12));
    }
    const view = visible(), cropped = 8.1 - view.x / 2;
    return new THREE.Vector2(cropped > 0 ? Math.min(6.6, cropped + 1.2) : 0, Math.max(0, 6.1 - view.y / 2));
  }
  function clampPan() {
    const limit = limits();
    pan.x = THREE.MathUtils.clamp(pan.x, -limit.x, limit.x);
    pan.y = THREE.MathUtils.clamp(pan.y, -limit.y, limit.y);
  }
  function setZoom(value, anchor) {
    if (!enabled) return;
    const next = THREE.MathUtils.clamp(value, MIN_ZOOM, MAX_ZOOM), rect = size(), before = visible();
    const ratio = next / zoom;
    // Keep the point under the mouse or pinch midpoint stationary.
    if (anchor) {
      pan.x += ((anchor.x - rect.left) / rect.width - .5) * before.x * (1 - 1 / ratio);
      pan.y += (.5 - (anchor.y - rect.top) / rect.height) * before.y * (1 - 1 / ratio);
    }
    camera.zoom *= ratio; zoom = next;
    clampPan(); invalidate();
    zoomIn.disabled = zoom >= MAX_ZOOM - .001;
    zoomOut.disabled = zoom <= MIN_ZOOM + .001;
  }
  function reset() {
    if (!reading) resetView();
    setZoom(1); pan.set(0, 0); invalidate();
  }
  function clearTap() {
    clearTimeout(pendingTap); pendingTap = 0; lastTap = null;
  }
  function readingControls() {
    room.classList.toggle('is-reading', reading);
    room.dataset.bookReading = String(reading);
    drawerControls.hidden = !enabled || reading;
    bookRead.setAttribute('aria-pressed', String(reading));
    bookRead.setAttribute('aria-label', reading ? 'Return to desk' : 'Read book full screen');
    viewReset.setAttribute('aria-label', reading ? 'Fit book to screen' : 'Reset view');
    zoomIn.disabled = zoom >= MAX_ZOOM - .001; zoomOut.disabled = zoom <= MIN_ZOOM + .001;
  }
  function leaveReading() {
    if (!reading) return;
    clearTap(); reading = false;
    zoom = deskView.zoom; pan.copy(deskView.pan); deskView = null;
    focusedBook = focusedDrawer = null;
    readingControls(); invalidate(); canvas.focus({ preventScroll: true });
    status.textContent = 'Returned to the desk. Your place in the book is preserved.';
    if (document.fullscreenElement === room) document.exitFullscreen().catch(() => {});
  }
  function enterReading() {
    if (!enabled || reading) return;
    clearTap(); deskView = { zoom, pan: pan.clone() };
    reading = true; zoom = 1; pan.set(0, 0); focusedBook = focusedDrawer = null;
    book.motion.open(); readingControls(); invalidate(); canvas.focus({ preventScroll: true });
    status.textContent = 'Full-screen reading view. Click the pages or use the arrow keys to turn them. Press Escape to return to the desk.';
    // The viewport reader also works on browsers that do not offer fullscreen
    // or reject the request. Keep the request within the user's input event.
    if (room.requestFullscreen && !document.fullscreenElement) {
      room.requestFullscreen().then(() => {
        if (!reading && document.fullscreenElement === room) document.exitFullscreen().catch(() => {});
      }).catch(() => {});
    }
  }
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === room) ownedFullscreen = true;
    else if (ownedFullscreen) { ownedFullscreen = false; leaveReading(); }
    invalidate();
  });
  room.addEventListener('keydown', event => {
    if (event.key === 'Escape' && reading) {
      event.preventDefault(); event.stopPropagation(); leaveReading();
    }
  }, true);
  function hitTarget(x, y) {
    const rect = size();
    raycaster.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), camera);
    const hit = raycaster.intersectObjects(pickMeshes.filter(mesh => {
      for (let object = mesh; object; object = object.parent) if (!object.visible) return false;
      return true;
    }), false)[0];
    // Respect occlusion: clicking the top above a closed drawer does nothing.
    for (let object = hit?.object; object; object = object.parent) {
      if (object.userData.bookAction) return `book:${object.userData.bookAction}`;
      if (object.userData.drawerIndex !== undefined) return `drawer:${object.userData.drawerIndex}`;
    }
    return null;
  }
  function activateBook(action) {
    clearTap();
    if (reading && (action === 'close' || action === 'toggle' || (action === 'previous' && book.motion.page === 0))) leaveReading();
    if (!enabled || !book.activate(action)) return;
    if (!book.motion.opened || action === 'close') bookButtons[0].focus({ preventScroll: true });
    status.textContent = action === 'next' || action === 'previous'
      ? 'Turning an aged paper page.' : book.motion.opened
        ? 'The Tenant of Wildfell Hall is opening. Click the right page to turn forward, or the left to turn back. Press Escape to close.'
        : 'The Tenant of Wildfell Hall is closing.';
    invalidate();
  }
  function toggleDrawer(index) {
    if (!enabled) return;
    const drawer = desk.drawers[index]; drawer.open = !drawer.open;
    buttons[index].setAttribute('aria-expanded', String(drawer.open));
    buttons[index].setAttribute('aria-label', `${drawer.open ? 'Close' : 'Open'} ${names[index]} drawer`);
    status.textContent = `The ${names[index]} drawer is ${drawer.open ? 'open' : 'closed'}.`;
    invalidate();
  }
  function anchorFor(index) {
    const drawer = desk.drawers[index];
    return new THREE.Vector3(index === 1 ? -1.34 : drawer.x, -.93, 3.884 + drawer.group.position.z);
  }
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => toggleDrawer(index));
    button.addEventListener('focus', () => {
      // Resolve this against the next frame's zoom and pan, since preceding
      // keyboard events may have changed them before the camera was rendered.
      focusedDrawer = index; invalidate();
    });
  });
  bookButtons.forEach(button => {
    button.addEventListener('click', () => activateBook(button.dataset.bookAction));
    button.addEventListener('focus', () => { focusedBook = button.dataset.bookAction; invalidate(); });
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      activateBook(event.key === 'Escape' ? 'close' : event.key === 'ArrowRight' ? 'next' : 'previous');
    });
  });
  bookClose.addEventListener('click', () => activateBook('close'));
  bookRead.addEventListener('click', () => reading ? leaveReading() : enterReading());
  zoomIn.addEventListener('click', () => setZoom(zoom * 1.25));
  zoomOut.addEventListener('click', () => setZoom(zoom / 1.25));
  viewReset.addEventListener('click', reset);
  canvas.addEventListener('wheel', event => {
    if (!enabled) return;
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size().height : 1);
    setZoom(zoom * Math.exp(-THREE.MathUtils.clamp(pixels, -250, 250) * .002), { x: event.clientX, y: event.clientY });
  }, { passive: false });
  function midpoint() {
    const points = [...pointers.values()];
    if (points.length === 1) return { x: points[0].x, y: points[0].y, span: 0 };
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2,
      span: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) };
  }
  canvas.addEventListener('pointerdown', event => {
    if (!enabled || event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    const multi = pointers.size > 1;
    const doubleTap = !multi && lastTap && event.timeStamp - lastTap.time < 340 &&
      Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 28;
    // Cancel the first page tap on the second press, before a slow rendered
    // frame or a held finger can let the single-tap timer turn that page.
    if (doubleTap) clearTimeout(pendingTap);
    if (multi) clearTap();
    gesture = { previous: midpoint(), start: midpoint(), moved: multi, doubleTap, startedAt: event.timeStamp, target: multi ? null : hitTarget(event.clientX, event.clientY) };
  });
  canvas.addEventListener('pointermove', event => {
    if (!enabled) return;
    if (!pointers.has(event.pointerId)) {
      const target = hitTarget(event.clientX, event.clientY);
      room.classList.toggle('is-drawer-hover', event.pointerType !== 'touch' && target !== null && target !== 'book:busy');
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const point = midpoint(), previous = gesture.previous;
    if (!gesture.moved && Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) < 6) return;
    gesture.moved = true;
    clearTap();
    const rect = size(), view = visible();
    pan.x -= (point.x - previous.x) / rect.width * view.x;
    pan.y += (point.y - previous.y) / rect.height * view.y;
    if (point.span > 0 && previous.span > 0) setZoom(zoom * point.span / previous.span, point);
    clampPan(); gesture.previous = point;
    room.classList.add('is-dragging'); invalidate();
  });
  function release(event, cancelled = false) {
    if (!pointers.has(event.pointerId)) return;
    const click = !cancelled && !gesture.moved && pointers.size === 1;
    const { target, doubleTap, startedAt } = gesture;
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (pointers.size) gesture = { previous: midpoint(), start: midpoint(), moved: true, target: null };
    else { gesture = null; room.classList.remove('is-dragging'); }
    if (click && target && hitTarget(event.clientX, event.clientY) === target) {
      if (target.startsWith('book:')) {
        if (doubleTap) {
          clearTap(); enterReading();
        } else {
          clearTap();
          const action = target.slice(5);
          if (book.motion.phase === 'closed') activateBook(action);
          else if (action !== 'busy') pendingTap = setTimeout(() => activateBook(action), 340);
          lastTap = { time: startedAt, x: event.clientX, y: event.clientY };
        }
      }
      else toggleDrawer(Number(target.slice(7)));
    }
    if (cancelled) clearTap();
  }
  canvas.addEventListener('pointerup', event => release(event));
  canvas.addEventListener('dblclick', event => {
    if (!enabled || !hitTarget(event.clientX, event.clientY)?.startsWith('book:')) return;
    event.preventDefault(); clearTap(); enterReading();
  });
  canvas.addEventListener('pointercancel', event => release(event, true));
  canvas.addEventListener('lostpointercapture', event => release(event, true));
  canvas.addEventListener('pointerleave', () => room.classList.remove('is-drawer-hover'));
  canvas.addEventListener('keydown', event => {
    if (!enabled || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape' || ['Enter', ' '].includes(event.key) ||
      (book.motion.opened && ['ArrowLeft', 'ArrowRight'].includes(event.key))) {
      event.preventDefault();
      activateBook(event.key === 'Escape' ? 'close' : event.key === 'ArrowLeft' ? 'previous' : event.key === 'ArrowRight' ? 'next' : 'toggle');
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') reset();
    else if (['+', '=', '-'].includes(event.key)) setZoom(zoom * (event.key === '-' ? 1 / 1.25 : 1.25));
    else {
      if (event.key === 'ArrowLeft') pan.x -= .9;
      if (event.key === 'ArrowRight') pan.x += .9;
      if (event.key === 'ArrowUp') pan.y += .9;
      if (event.key === 'ArrowDown') pan.y -= .9;
      clampPan(); invalidate();
    }
  });
  return {
    get dragging() { return pointers.size > 0; },
    get reading() { return reading; },
    setEnabled(value) {
      enabled = value; bookControls.hidden = !value; readingControls();
      canvas.tabIndex = value ? 0 : -1;
      if (!value) {
        clearTap();
        for (const id of pointers.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
        pointers.clear(); gesture = null;
        room.classList.remove('is-dragging', 'is-drawer-hover');
      }
    },
    applyCamera(target, direction, detail) {
      if (reading) {
        const rect = size(), aspect = rect.width / rect.height;
        const usableHeight = Math.max(.55, 1 - 140 / rect.height);
        const viewHeight = Math.max(book.depth / usableHeight, book.width / (aspect * .90));
        camera.left = -viewHeight * aspect / 2; camera.right = -camera.left;
        camera.top = viewHeight / 2; camera.bottom = -camera.top; camera.zoom = zoom;
        direction.set(0, 1, 0);
        const up = new THREE.Vector3(0, 0, -1).applyQuaternion(book.group.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(book.group.quaternion);
        camera.up.copy(up); target.copy(book.group.position);
        if (focusedBook !== null) {
          const relative = book.anchor(focusedBook).sub(target), view = visible();
          if (Math.abs(relative.dot(right) - pan.x) > view.x * .40) pan.x = relative.dot(right);
          if (Math.abs(relative.dot(up) - pan.y) > view.y * .40) pan.y = relative.dot(up);
          focusedBook = null;
        }
        clampPan(); target.addScaledVector(right, pan.x).addScaledVector(up, pan.y - viewHeight * (50 / rect.height) / zoom);
        room.classList.toggle('is-pannable', limits().lengthSq() > .01);
        return;
      }
      camera.up.set(0, 1, 0);
      camera.zoom = zoom * (1 + detail * .14); clampPan();
      const up = new THREE.Vector3(0, direction.z, -direction.y);
      if (focusedDrawer !== null) {
        const relative = anchorFor(focusedDrawer).sub(target), view = visible();
        if (Math.abs(relative.x - pan.x) > view.x * .425) pan.x = relative.x;
        if (Math.abs(relative.dot(up) - pan.y) > view.y * .40) pan.y = relative.dot(up);
        focusedDrawer = null; clampPan();
      }
      if (focusedBook !== null) {
        const relative = book.anchor(focusedBook).sub(target), view = visible();
        if (Math.abs(relative.x - pan.x) > view.x * .425) pan.x = relative.x;
        if (Math.abs(relative.dot(up) - pan.y) > view.y * .40) pan.y = relative.dot(up);
        focusedBook = null; clampPan();
      }
      target.x += pan.x;
      target.addScaledVector(up, pan.y);
      room.classList.toggle('is-pannable', limits().lengthSq() > .01);
    },
    animateDrawers(delta, reducedMotion) {
      let changed = false, unsettled = false;
      const factor = reducedMotion ? 1 : 1 - Math.exp(-delta * 10);
      for (const drawer of desk.drawers) {
        const target = drawer.open ? drawer.travel : 0, previous = drawer.group.position.z;
        let next = THREE.MathUtils.lerp(previous, target, factor);
        if (Math.abs(next - target) < .001) next = target;
        drawer.group.position.z = next;
        changed ||= next !== previous; unsettled ||= next !== target;
      }
      return { changed, unsettled };
    },
    projectButtons() {
      const rect = size();
      buttons.forEach((button, index) => {
        const point = anchorFor(index).project(camera);
        // Keep invisible keyboard targets inside the viewport. Otherwise Tab
        // can scroll the entire clipped room before focus recenters the camera.
        button.style.left = `${THREE.MathUtils.clamp((point.x + 1) * rect.width / 2, 26, rect.width - 26)}px`;
        button.style.top = `${THREE.MathUtils.clamp((1 - point.y) * rect.height / 2, 26, rect.height - 26)}px`;
      });
      const { motion } = book;
      if (motion.phase !== lastBookPhase || motion.page !== lastBookPage) {
        if (motion.phase === 'open') {
          status.textContent = `The book is open. ${motion.page} of ${motion.leafCount} leaves turned. Use the left and right pages or arrow keys to turn pages. ${reading ? 'Escape returns to the desk.' : 'Double-click for full-screen reading, or press Escape to close.'}`;
          transcript.replaceChildren();
          for (const index of [motion.page * 2 - 1, motion.page * 2]) {
            if (!book.pages[index]?.text) continue;
            const section = document.createElement('section'); section.setAttribute('aria-label', `Page ${index + 1}`);
            for (const text of book.pages[index].text.split('\n\n')) {
              const p = document.createElement('p'); p.textContent = text; section.append(p);
            }
            transcript.append(section);
          }
        }
        if (motion.phase === 'closed') status.textContent = 'The Tenant of Wildfell Hall is closed.';
        lastBookPhase = motion.phase; lastBookPage = motion.page;
      }
      room.dataset.bookOpen = String(motion.opened);
      room.dataset.bookPage = String(motion.page); room.dataset.bookPhase = motion.phase;
      room.dataset.bookLeaves = String(motion.leafCount);
      transcript.hidden = !motion.opened;
      bookControls.setAttribute('aria-busy', String(motion.busy));
      bookClose.hidden = !motion.opened;
      bookRead.hidden = !motion.opened;
      viewToggle.hidden = motion.opened;
      bookButtons.forEach(button => {
        const action = button.dataset.bookAction;
        button.hidden = action !== 'toggle' && !motion.opened;
        button.disabled = action !== 'toggle' && (motion.busy || (action === 'next' ? motion.page >= motion.leafCount : motion.page === 0));
        if (action === 'toggle') {
          button.setAttribute('aria-expanded', String(motion.opened));
          button.setAttribute('aria-label', `${motion.opened ? 'Close' : 'Open'} The Tenant of Wildfell Hall`);
        }
        const point = book.anchor(action).project(camera);
        button.style.left = `${THREE.MathUtils.clamp((point.x + 1) * rect.width / 2, 26, rect.width - 26)}px`;
        button.style.top = `${THREE.MathUtils.clamp((1 - point.y) * rect.height / 2, 26, rect.height - 26)}px`;
      });
    },
  };
}
