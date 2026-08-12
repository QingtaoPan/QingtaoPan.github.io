(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var cat = document.getElementById("site-cat");
  if (!cat) return;

  var assetUrls = ["--cat-idle", "--cat-run", "--cat-attack"].map(function (property) {
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
  var runSpeed = 480;
  var arriveDistance = 5;
  var edge = 8;
  var attackDuration = 620;

  var x = 0;
  var y = 0;
  var targetX = 0;
  var targetY = 0;
  var clickX = 0;
  var facing = -1;
  var animation = "idle";
  var state = "idle";
  var attackStarted = 0;
  var lastTick = 0;
  var tapValid = true;
  var touchX0 = 0;
  var touchY0 = 0;

  function applyScale() {
    scale = window.matchMedia("(max-width: 749px)").matches ? MOBILE_SCALE : 1;
    catW = Math.round(128 * scale);
    catH = Math.round(128 * scale);
    runSpeed = 480 * scale;
    arriveDistance = 5 * scale;
    edge = 8 * scale;
  }

  function placeInitialPosition() {
    x = Math.max(edge, window.innerWidth - catW - 22 * scale);
    y = Math.max(edge, window.innerHeight - catH - 18 * scale);
  }

  function setAnimation(next) {
    if (animation === next) return;
    animation = next;
    cat.classList.remove("is-idle", "is-run", "is-attack");
    cat.classList.add("is-" + next);

    if (next === "attack") {
      var attackSheet = cat.querySelector(".site-cat-sheet--attack");
      if (attackSheet) {
        attackSheet.style.animation = "none";
        void attackSheet.offsetWidth;
        attackSheet.style.animation = "";
      }
    }
  }

  function applyTransform() {
    var direction = facing < 0 ? 1 : -1;
    cat.style.transform = "translate3d(" + x + "px," + y + "px,0) scaleX(" + direction + ")";
  }

  function clampPosition(px, py) {
    return {
      x: Math.min(Math.max(edge, px), Math.max(edge, window.innerWidth - catW - edge)),
      y: Math.min(Math.max(edge, py), Math.max(edge, window.innerHeight - catH - edge))
    };
  }

  function setTarget(clientX, clientY) {
    clickX = clientX;
    facing = clientX < x + catW / 2 ? -1 : 1;

    /* Stop with the cat's front paw at the click point, ready to attack it. */
    var frontOffsetX = facing < 0 ? catW * 0.27 : catW * 0.73;
    var destination = clampPosition(
      clientX - frontOffsetX,
      clientY - catH * 0.58
    );

    targetX = destination.x;
    targetY = destination.y;
    state = "running";
    setAnimation("run");
  }

  function moveToward(deltaMs) {
    var dx = targetX - x;
    var dy = targetY - y;
    var remaining = Math.sqrt(dx * dx + dy * dy);
    if (remaining <= arriveDistance) {
      x = targetX;
      y = targetY;
      return true;
    }

    if (Math.abs(dx) > 1.5) facing = dx < 0 ? -1 : 1;
    var step = runSpeed * Math.min(deltaMs, 50) / 1000;
    if (step >= remaining) {
      x = targetX;
      y = targetY;
      return true;
    }

    x += dx / remaining * step;
    y += dy / remaining * step;
    return false;
  }

  function beginAttack(now) {
    facing = clickX < x + catW / 2 ? -1 : 1;
    state = "attacking";
    attackStarted = now;
    setAnimation("attack");
  }

  function isInteractiveTarget(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.isContentEditable) return true;
    return !!node.closest(
      "a, button, input, select, textarea, label, summary, " +
      "[role='button'], .btn, .button, .greedy-nav, .masthead, .toc"
    );
  }

  applyScale();
  placeInitialPosition();
  applyTransform();

  window.addEventListener("resize", function () {
    applyScale();
    var clamped = clampPosition(x, y);
    x = clamped.x;
    y = clamped.y;
    applyTransform();
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
    if (!assetsReady || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey) return;
    if (!tapValid) {
      tapValid = true;
      return;
    }
    if (isInteractiveTarget(event.target)) return;
    setTarget(event.clientX, event.clientY);
  });

  function tick(now) {
    if (state === "running") {
      var delta = lastTick ? now - lastTick : 16;
      if (moveToward(delta)) beginAttack(now);
    } else if (state === "attacking" && now - attackStarted >= attackDuration) {
      state = "idle";
      setAnimation("idle");
    }

    applyTransform();
    lastTick = now;
    window.requestAnimationFrame(tick);
  }

  window.requestAnimationFrame(tick);
})();
