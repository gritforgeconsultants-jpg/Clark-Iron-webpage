// Load the locally bundled model only when the connection study approaches view.
const study = document.getElementById('connection-study');
const header = document.querySelector('.site-header');
const updateHeader = () => study.style.setProperty('--study-header', `${Math.ceil(header.getBoundingClientRect().height)}px`);
new ResizeObserver(updateHeader).observe(header);
updateHeader();
const observer = new IntersectionObserver(async entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    try {
        await import('./scene.js?v=orbit-3');
    } catch {
        study.classList.add('unavailable');
        study.querySelector('.fallback').textContent = 'The 3D view is unavailable in this browser. This illustration joins a W21×62 beam to a W14×90 column with flange plates, a shear tab, and structural bolts. Our services and contact links remain available below.';
    }
}, { rootMargin: '300px' });
observer.observe(study);
