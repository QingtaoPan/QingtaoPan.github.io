(function () {
  "use strict";

  var cat = document.getElementById("cat-cursor");
  var finePointer = window.matchMedia("(any-pointer: fine)");

  if (!cat || !finePointer.matches) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var current = {
    x: Math.max(8, window.innerWidth - 96),
    y: Math.max(8, window.innerHeight - 88)
  };
  var target = { x: current.x, y: current.y };
  var lastPointer = null;
  var movementTimer = 0;
  var attackTimer = 0;
  var attacking = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function placeTarget(clientX, clientY) {
    target.x = clamp(clientX + 15, 4, window.innerWidth - 72);
    target.y = clamp(clientY - 42, 4, window.innerHeight - 70);
  }

  function setMovementState(speed) {
    if (attacking) return;
    cat.dataset.state = speed > 24 ? "run" : "walk";
    window.clearTimeout(movementTimer);
    movementTimer = window.setTimeout(function () {
      if (!attacking) cat.dataset.state = "idle";
    }, 110);
  }

  function onPointerMove(event) {
    if (event.pointerType === "touch") return;

    cat.dataset.ready = "true";
    placeTarget(event.clientX, event.clientY);

    if (lastPointer) {
      var dx = event.clientX - lastPointer.x;
      var dy = event.clientY - lastPointer.y;
      if (Math.abs(dx) > 1) cat.dataset.facing = dx > 0 ? "right" : "left";
      setMovementState(Math.sqrt(dx * dx + dy * dy));
    }

    lastPointer = { x: event.clientX, y: event.clientY };
  }

  function attack(event) {
    if (event.pointerType === "touch" || event.button !== 0) return;

    placeTarget(event.clientX, event.clientY);
    attacking = true;
    window.clearTimeout(attackTimer);
    cat.classList.remove("is-attacking");
    void cat.offsetWidth;
    cat.classList.add("is-attacking");

    attackTimer = window.setTimeout(function () {
      cat.classList.remove("is-attacking");
      attacking = false;
      cat.dataset.state = "idle";
    }, 560);
  }

  function render() {
    var ease = reducedMotion ? 1 : 0.24;
    current.x += (target.x - current.x) * ease;
    current.y += (target.y - current.y) * ease;
    cat.style.transform = "translate3d(" + current.x.toFixed(2) + "px," + current.y.toFixed(2) + "px,0)";
    window.requestAnimationFrame(render);
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerdown", attack, { passive: true });
  document.documentElement.addEventListener("mouseleave", function () {
    cat.dataset.ready = "false";
  });
  document.documentElement.addEventListener("mouseenter", function () {
    cat.dataset.ready = "true";
  });
  window.addEventListener("resize", function () {
    target.x = clamp(target.x, 4, window.innerWidth - 72);
    target.y = clamp(target.y, 4, window.innerHeight - 70);
  });

  cat.dataset.ready = "true";
  render();
})();
