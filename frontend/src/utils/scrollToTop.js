// On the Chats tab, back first scrolls the list to the top. Returns true if it scrolled.
export function scrollListToTop(threshold = 50) {
  if (window.scrollY > threshold) { window.scrollTo({ top: 0, behavior: 'smooth' }); return true; }
  const scrolled = [...document.querySelectorAll('main, div, section, ul')].filter(el => {
    if (el.scrollTop <= threshold) return false;
    const oy = getComputedStyle(el).overflowY;
    return oy === 'auto' || oy === 'scroll';
  });
  if (!scrolled.length) return false;
  scrolled.forEach(el => el.scrollTo({ top: 0, behavior: 'smooth' }));
  return true;
}
