// Small DOM helpers shared by the experiment pages.

export const $ = (id) => document.getElementById(id);

// Shows the sections whose ids are in `visible` and hides the rest of `all`.
export function showOnly(all, visible) {
  for (const id of all) $(id).hidden = !visible.includes(id);
}

// Speaks a status message through the page's aria-live region (#status).
export function announce(text) {
  const region = $('status');
  // Clear first so the same message is read again if it repeats.
  region.textContent = '';
  setTimeout(() => { region.textContent = text; }, 50);
}

// Puts a value into every element marked data-fill="name".
export function fill(name, value) {
  for (const el of document.querySelectorAll(`[data-fill="${name}"]`)) el.textContent = value;
}

// "Copy my results": copies text to the clipboard. If that fails, shows the
// text pre-selected in the box's textarea so the student can copy it by hand.
// The button must sit inside a .copy-box with a .copy-status and a .copy-fallback.
export function copyResults(button, text) {
  const box = button.closest('.copy-box');
  const status = box.querySelector('.copy-status');
  const fallback = box.querySelector('.copy-fallback');
  const showFallback = () => {
    fallback.value = text;
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
    status.textContent = 'Select the text below and copy it.';
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      status.textContent = 'Copied!';
      fallback.hidden = true;
    }, showFallback);
  } else {
    showFallback();
  }
}

export function clearCopyBoxes() {
  for (const el of document.querySelectorAll('.copy-status')) el.textContent = '';
  for (const el of document.querySelectorAll('.copy-fallback')) el.hidden = true;
}

// Calls fn when the student switches away from the tab.
export function onTabHidden(fn) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') fn();
  });
}
