// Fade-in on scroll. Any element with data-reveal="out" switches to "in" the first time
// it enters the viewport; the transition itself is CSS (see [data-reveal] in components.css).
// Optional stagger: style="--reveal-delay: 120ms".

const targets = document.querySelectorAll<HTMLElement>('[data-reveal="out"]');

if (!("IntersectionObserver" in window)) {
  targets.forEach((el) => (el.dataset.reveal = "in"));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.reveal = "in";
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
  );
  targets.forEach((el) => observer.observe(el));
}
