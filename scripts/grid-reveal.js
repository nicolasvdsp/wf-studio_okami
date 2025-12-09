function initRadialSpreadReveal() {
    if (typeof gsap === "undefined") {
      console.warn("[radial-spread-reveal] GSAP not found.");
      return;
    }
  
    const containers = document.querySelectorAll(
      "[data-init-radial-spread-reveal]"
    );
    if (!containers.length) return;
  
    // Calculate viewport values once (same for all containers)
    const viewportCenter = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
  
    const maxDistance = Math.hypot(
      viewportCenter.x,
      viewportCenter.y
    );
  
    containers.forEach((container) => {
      // Parse container options once
      const baseOffset =
        parseFloat(container.dataset.radialSpreadOffset) || 60;
  
      const baseScale =
        parseFloat(container.dataset.radialSpreadScale) || 1.04;
  
      const baseDuration =
        parseFloat(container.dataset.radialSpreadDuration) || 1.05;
  
      const delayMultiplier =
        parseFloat(container.dataset.radialSpreadDelayMultiplier) || 0.1;
  
      const ease =
        container.dataset.radialSpreadEase || "power3.out";
  
      const items = container.querySelectorAll(
        "[data-radial-spread-target]"
      );
      
      if (!items.length) return;
  
      // Batch DOM reads: collect all positions first to avoid layout thrashing
      const itemData = Array.from(items).map((el) => {
        const rect = el.getBoundingClientRect();
        const elCenter = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
  
        const dx = elCenter.x - viewportCenter.x;
        const dy = elCenter.y - viewportCenter.y;
  
        const distance = Math.hypot(dx, dy) || 1;
        const strength = Math.min(distance / maxDistance, 1);
  
        const offsetX = (dx / maxDistance) * baseOffset;
        const offsetY = (dy / maxDistance) * baseOffset;
  
        const itemScale =
          parseFloat(el.dataset.radialSpreadScale) ||
          baseScale;
  
        const itemDuration =
          parseFloat(el.dataset.radialSpreadDuration) ||
          baseDuration;
  
        return {
          el,
          offsetX,
          offsetY,
          itemScale,
          itemDuration,
          strength,
          ease,
        };
      });
  
      // Batch DOM writes: apply all initial states, then all animations
      itemData.forEach(({ el, offsetX, offsetY, itemScale }) => {
        // Remove FOUC prevention class if present
        el.classList.remove('u-prevent-fouc');
        gsap.set(el, {
          x: offsetX,
          y: offsetY,
          scale: itemScale,
          opacity: 0,
        });
      });
  
      itemData.forEach(({ el, offsetX, offsetY, itemDuration, strength, ease }) => {
        gsap.to(el, {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          duration: itemDuration + strength * 0.4,
          delay: strength * delayMultiplier,
          ease,
        });
      });
    });
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRadialSpreadReveal);
  } else {
    initRadialSpreadReveal();
  }
  
  // Also listen for custom contentload event if it's used elsewhere
  document.addEventListener('contentload', initRadialSpreadReveal);