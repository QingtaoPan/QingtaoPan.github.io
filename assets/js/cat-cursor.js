(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var cat = document.getElementById("site-cat");
  var toysRoot = document.getElementById("site-cat-toys");
  if (!cat || !toysRoot) return;

  var assetUrls = ["--cat-idle", "--cat-walk", "--cat-run", "--cat-attack"]
    .map(function (property) {
      return cat.style.getPropertyValue(property).trim().replace(/^url\(["']?|["']?\)$/g, "");
    });
  var assetsReady = false;

  function preload(src) {
    return new Promise(function (resolve) {
      var image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = src;
    });
  }

  function revealCat() {
    if (assetsReady) return;
    assetsReady = true;
    cat.classList.add("is-ready");
  }

  Promise.all(assetUrls.map(preload)).then(revealCat);
  window.setTimeout(revealCat, 8000);

  var MOBILE_SCALE = 0.75;
  var scale = 1;
  var catW = 128;
  var catH = 128;
  var toySize = 26;
  var walkSpeed = 240;
  var runSpeed = 480;
  var arriveDistance = 8;
  var attackGap = 14;
  var edge = 8;
  var throwArc = 74;
  var throwDuration = 500;
  var attackDuration = 620;
  var attackHitAt = 350;
  var maxToys = 10;

  var x = 0;
  var y = 0;
  var homeX = 0;
  var homeY = 0;
  var facing = -1;
  var attackFacing = -1;
  var animation = "idle";
  var state = "idle";
  var moveSpeed = walkSpeed;
  var targetX = 0;
  var targetY = 0;
  var attackStarted = 0;
  var toyHit = false;
  var lastTick = 0;
  var currentToy = null;
  var toys = [];
  var tapValid = true;
  var touchX0 = 0;
  var touchY0 = 0;

  function applyScale() {
    scale = window.matchMedia("(max-width: 749px)").matches ? MOBILE_SCALE : 1;
    catW = Math.round(128 * scale);
    catH = Math.round(128 * scale);
    toySize = scale < 1 ? 22 : 26;
    walkSpeed = 240 * scale;
    runSpeed = 480 * scale;
    arriveDistance = 8 * scale;
    attackGap = 14 * scale;
    edge = 8 * scale;
    throwArc = 74 * scale;
  }

  function placeHome() {
    homeX = Math.max(edge, window.innerWidth - catW - 22 * scale);
    homeY = Math.max(edge, window.innerHeight - catH - 18 * scale);
  }

  function setAnimation(next) {
    if (animation === next) return;
    animation = next;
    cat.classList.remove("is-idle", "is-walk", "is-run", "is-attack");
    cat.classList.add("is-" + next);

    if (next === "attack") {
      var sheet = cat.querySelector(".site-cat-sheet--attack");
      if (sheet) {
        sheet.style.animation = "none";
        void sheet.offsetWidth;
        sheet.style.animation = "";
      }
    }
  }

  function applyCatTransform() {
    var direction = facing < 0 ? 1 : -1;
    cat.style.transform = "translate3d(" + x + "px," + y + "px,0) scaleX(" + direction + ")";
  }

  function applyToyTransform(entry) {
    var hitScale = entry.hit ? 0.35 : 1;
    entry.element.style.transform =
      "translate3d(" + entry.x + "px," + entry.y + "px,0) scale(" + hitScale + ")";
  }

  function distance(ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clampCatPosition(px, py) {
    return {
      x: Math.min(Math.max(edge, px), Math.max(edge, window.innerWidth - catW - edge)),
      y: Math.min(Math.max(edge, py), Math.max(edge, window.innerHeight - catH - edge))
    };
  }

  function clampCatOnScreen() {
    var position = clampCatPosition(x, y);
    x = position.x;
    y = position.y;
  }

  function moveToward(tx, ty, deltaMs) {
    var dx = tx - x;
    var dy = ty - y;
    var remaining = Math.sqrt(dx * dx + dy * dy);
    if (remaining < 0.001) return 0;

    if (Math.abs(dx) > 1.5) facing = dx < 0 ? -1 : 1;
    var step = moveSpeed * Math.min(deltaMs, 50) / 1000;
    if (step >= remaining) {
      x = tx;
      y = ty;
      return 0;
    }

    x += dx / remaining * step;
    y += dy / remaining * step;
    return remaining - step;
  }

  function targetForToy(toyX, toyY) {
    var toyCenterX = toyX + toySize / 2;
    var toyCenterY = toyY + toySize / 2;
    var catCenterX = x + catW / 2;
    var face = catCenterX <= toyCenterX ? 1 : -1;
    var standOff = attackGap + catW * 0.24;
    var preferredX = toyCenterX - face * standOff - catW / 2;
    var preferredY = toyCenterY - catH * 0.6;
    var result = clampCatPosition(preferredX, preferredY);

    if ((face > 0 && result.x + catW / 2 >= toyCenterX) ||
        (face < 0 && result.x + catW / 2 <= toyCenterX)) {
      face = -face;
      preferredX = toyCenterX - face * standOff - catW / 2;
      result = clampCatPosition(preferredX, preferredY);
    }

    return { x: result.x, y: result.y, facing: face };
  }

  function isInteractiveTarget(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.isContentEditable) return true;
    return !!node.closest(
      "a, button, input, select, textarea, label, summary, " +
      "[role='button'], .btn, .button, .greedy-nav, .masthead, .toc"
    );
  }

  function removeToy(entry) {
    var index = toys.indexOf(entry);
    if (index >= 0) toys.splice(index, 1);
    if (entry.element && entry.element.parentNode) entry.element.parentNode.removeChild(entry.element);
    if (currentToy === entry) currentToy = null;
  }

  function beginChase(entry) {
    currentToy = entry;
    entry.phase = "active";
    var destination = targetForToy(entry.x, entry.y);
    targetX = destination.x;
    targetY = destination.y;
    attackFacing = destination.facing;
    facing = attackFacing;

    var travel = distance(x, y, targetX, targetY);
    if (travel > 0.3 * Math.min(window.innerWidth, window.innerHeight)) {
      moveSpeed = runSpeed;
      setAnimation("run");
    } else {
      moveSpeed = walkSpeed;
      setAnimation("walk");
    }
    state = "moving";
  }

  function nextLandedToy() {
    for (var i = 0; i < toys.length; i += 1) {
      if (toys[i].phase === "landed") return toys[i];
    }
    return null;
  }

  function tossToy(clientX, clientY) {
    if (!assetsReady || toys.length >= maxToys) return;

    var landingX = Math.min(Math.max(edge, clientX - toySize / 2), window.innerWidth - toySize - edge);
    var landingY = Math.min(Math.max(edge, clientY - toySize / 2), window.innerHeight - toySize - edge);
    var element = document.createElement("span");
    element.className = "site-cat-toy is-visible";
    element.setAttribute("aria-hidden", "true");
    toysRoot.appendChild(element);

    var entry = {
      element: element,
      phase: "throwing",
      throwStarted: performance.now(),
      fromX: x + catW * 0.52,
      fromY: y + catH * 0.42,
      toX: landingX,
      toY: landingY,
      x: x + catW * 0.52,
      y: y + catH * 0.42,
      hit: false
    };
    toys.push(entry);
    applyToyTransform(entry);
  }

  function updateFlyingToys(now) {
    for (var i = 0; i < toys.length; i += 1) {
      var entry = toys[i];
      if (entry.phase !== "throwing") continue;

      var progress = Math.min(1, (now - entry.throwStarted) / throwDuration);
      var eased = progress * (2 - progress);
      entry.x = entry.fromX + (entry.toX - entry.fromX) * eased;
      entry.y = entry.fromY + (entry.toY - entry.fromY) * eased;
      entry.y -= Math.sin(Math.PI * progress) * throwArc;

      if (progress >= 1) {
        entry.x = entry.toX;
        entry.y = entry.toY;
        entry.phase = "landed";
      }
      applyToyTransform(entry);
    }
  }

  applyScale();
  placeHome();
  x = homeX;
  y = homeY;
  applyCatTransform();

  window.addEventListener("resize", function () {
    applyScale();
    if (state === "idle" && !currentToy) {
      placeHome();
      x = homeX;
      y = homeY;
    } else {
      clampCatOnScreen();
    }
    applyCatTransform();
  }, { passive: true });

  document.addEventListener("touchstart", function (event) {
    if (event.touches.length !== 1) {
      tapValid = false;
      return;
    }
    tapValid = true;
    touchX0 = event.touches[0].clientX;
    touchY0 = event.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchmove", function (event) {
    if (!tapValid || !event.touches[0]) return;
    var dx = event.touches[0].clientX - touchX0;
    var dy = event.touches[0].clientY - touchY0;
    if (dx * dx + dy * dy > 64) tapValid = false;
  }, { passive: true });

  document.addEventListener("click", function (event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!tapValid) {
      tapValid = true;
      return;
    }
    if (isInteractiveTarget(event.target)) return;
    tossToy(event.clientX, event.clientY);
  });

  function tick(now) {
    updateFlyingToys(now);

    if (state === "idle") {
      var nextToy = nextLandedToy();
      if (nextToy) beginChase(nextToy);
    } else if (state === "moving" && currentToy) {
      var delta = lastTick ? now - lastTick : 16;
      var remaining = moveToward(targetX, targetY, delta);
      clampCatOnScreen();

      if (remaining <= arriveDistance) {
        x = targetX;
        y = targetY;
        clampCatOnScreen();
        facing = attackFacing;
        state = "attacking";
        toyHit = false;
        attackStarted = now;
        setAnimation("attack");
      }
    } else if (state === "attacking" && currentToy) {
      facing = attackFacing;
      var elapsed = now - attackStarted;

      if (!toyHit && elapsed >= attackHitAt) {
        toyHit = true;
        currentToy.hit = true;
        currentToy.element.classList.add("is-hit");
        applyToyTransform(currentToy);
      }

      if (elapsed >= attackDuration) {
        removeToy(currentToy);
        state = "idle";
        var queuedToy = nextLandedToy();
        if (queuedToy) beginChase(queuedToy);
        else setAnimation("idle");
      }
    }

    applyCatTransform();
    lastTick = now;
    window.requestAnimationFrame(tick);
  }

  window.requestAnimationFrame(tick);
})();
