function initPreviewFollower() {
    // Find every follower wrap
    const wrappers = document.querySelectorAll('[data-follower-wrap]');
  
    wrappers.forEach(wrap => {
      const collection = wrap.querySelector('[data-follower-collection]');
      const items = wrap.querySelectorAll('[data-follower-item]');
      const follower = wrap.querySelector('[data-follower-cursor]');
      const followerInner = wrap.querySelector('[data-follower-cursor-inner]');
  
      let prevIndex = null;
      let firstEntry = true;
  
      const offset = 100; // The animation distance in %
      const duration = 0.5; // The animation duration of all visual transforms
      const ease = 'power2.inOut';
  
      // Initialize follower position
      gsap.set(follower, { xPercent: -50, yPercent: -50 });
  
      // Quick setters for x/y
      const xTo = gsap.quickTo(follower, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(follower, 'y', { duration: 0.6, ease: 'power3' });
  
      // Move all followers on mousemove
      window.addEventListener('mousemove', e => {
        xTo(e.clientX);
        yTo(e.clientY);
      });
  
      // Enter/leave per item within this wrap
      items.forEach((item, index) => {
        item.addEventListener('mouseenter', () => {
          const forward = prevIndex === null || index > prevIndex;
          prevIndex = index;
  
          // animate out existing visuals
          follower.querySelectorAll('[data-follower-visual]').forEach(el => {
            gsap.killTweensOf(el);
            gsap.to(el, {
              yPercent: forward ? -offset : offset,
              duration,
              ease,
              overwrite: 'auto',
              onComplete: () => el.remove()
            });
          });
  
          // clone & insert new visual
          const visual = item.querySelector('[data-follower-visual]');
          if (!visual) return;
          const clone = visual.cloneNode(true);
          followerInner.appendChild(clone);
  
          // animate it in (unless it's the very first entry)
          if (!firstEntry) {
            gsap.fromTo(clone,
              { yPercent: forward ? offset : -offset },
              { yPercent: 0, duration, ease, overwrite: 'auto' }
            );
          } else {
            firstEntry = false;
          }
        });
  
        item.addEventListener('mouseleave', () => {
          const el = follower.querySelector('[data-follower-visual]');
          if (!el) return;
          gsap.killTweensOf(el);
          gsap.to(el, {
            yPercent: -offset,
            duration,
            ease,
            overwrite: 'auto',
            onComplete: () => el.remove()
          });
        });
      });
  
      // If pointer leaves the collection, clear any visuals
      collection.addEventListener('mouseleave', () => {
        follower.querySelectorAll('[data-follower-visual]').forEach(el => {
          gsap.killTweensOf(el);
          gsap.delayedCall(duration, () => el.remove());
        });
        firstEntry = true;
        prevIndex = null;
      });
    });
  }
  
  function initGalleryViewSwitcher() {
    const buttons = document.querySelectorAll('[data-gallery-button]');
    const gridElement = document.querySelector('[data-gallery-element="grid"]');
    const listElement = document.querySelector('[data-gallery-element="list"]');

    if (!buttons.length || !gridElement || !listElement) return;

    // Function to force grid view on mobile
    function forceGridView() {
      if (window.innerWidth <= 991) {
        gridElement.style.display = 'block';
        listElement.style.display = 'none';
        
        // Update button active states to grid
        buttons.forEach(btn => {
          const btnType = btn.getAttribute('data-gallery-button');
          if (btnType === 'grid') {
            btn.setAttribute('data-gallery-active', 'true');
          } else {
            btn.setAttribute('data-gallery-active', 'false');
          }
        });
        return true; // Indicates grid was forced
      }
      return false; // Indicates normal behavior allowed
    }

    // Check on load and resize
    forceGridView();
    window.addEventListener('resize', forceGridView);

    buttons.forEach(button => {
      button.addEventListener('click', () => {
        // Force grid view on mobile, ignore click
        if (window.innerWidth <= 991) {
          forceGridView();
          return;
        }

        const viewType = button.getAttribute('data-gallery-button');
        
        // Update button active states
        buttons.forEach(btn => {
          const btnType = btn.getAttribute('data-gallery-button');
          if (btnType === viewType) {
            btn.setAttribute('data-gallery-active', 'true');
          } else {
            btn.setAttribute('data-gallery-active', 'false');
          }
        });

        // Show/hide gallery elements
        if (viewType === 'grid') {
          gridElement.style.display = 'block';
          listElement.style.display = 'none';
        } else if (viewType === 'list') {
          gridElement.style.display = 'none';
          listElement.style.display = 'block';
        }
      });
    });
  }

  // Initialize Image Preview Cursor Follower
  document.addEventListener('contentload', initPreviewFollower);
  initPreviewFollower();

  // Initialize Gallery View Switcher
  document.addEventListener('contentload', initGalleryViewSwitcher);
  initGalleryViewSwitcher();