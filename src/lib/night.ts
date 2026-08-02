// Inline scripts for the "lights off" feature.  Posts marked `dark: true`
// stay invisible until the reader turns the lights off; the choice lives in
// sessionStorage so it follows the reader across pages within a visit.
//
// Each snippet is injected via <script innerHTML>, so they must stay
// self-contained ES5 with no dependencies.

/**
 * Runs in <head> before first paint: tags <html> with "js" (progressive
 * enhancement gate — the toggle and the veil only render styled when a
 * script can make them work) and restores the lights-off state without a
 * flash.
 */
export const NIGHT_INIT = `(function () {
  var c = document.documentElement.classList;
  c.add("js");
  try {
    if (sessionStorage.getItem("night") === "1") c.add("night");
  } catch (e) {}
})();`;

/** The light switch on list pages. */
export const NIGHT_TOGGLE = `(function () {
  var button = document.querySelector(".night-toggle");
  if (!button) return;
  button.addEventListener("click", function () {
    var c = document.documentElement.classList;
    c.toggle("night");
    try {
      sessionStorage.setItem("night", c.contains("night") ? "1" : "0");
    } catch (e) {}
  });
})();`;

/**
 * The frosted veil over a dark post reached with the lights on.  Readers who
 * already turned them off walk straight in.
 */
export const NIGHT_VEIL = `(function () {
  var veil = document.querySelector(".night-veil");
  if (!veil) return;
  var root = document.documentElement;
  if (root.classList.contains("night")) {
    veil.remove();
    return;
  }
  var main = document.querySelector("main");
  if (main) main.inert = true;
  veil.querySelector("button").addEventListener("click", function () {
    root.classList.add("night");
    try {
      sessionStorage.setItem("night", "1");
    } catch (e) {}
    if (main) main.inert = false;
    root.classList.add("veil-lifting");
    var wait =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 520;
    setTimeout(function () {
      veil.remove();
      root.classList.remove("veil-lifting");
    }, wait);
  });
})();`;
