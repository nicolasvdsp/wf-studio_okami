async function initCarousel() {
  const root = document.querySelector('[data-carousel-init]');
  if (!root) return;

  // Config
  const isAutoplayEnabled = root.getAttribute('data-carousel-autoplay') !== 'false';
  const switchInterval = parseFloat(root.getAttribute('data-carousel-interval')) || 5;
  const transitionDuration = parseFloat(root.getAttribute('data-carousel-duration')) || 0.45;
  const scrollDebounceMs = parseFloat(root.getAttribute('data-carousel-scroll-debounce')) || Math.max(transitionDuration * 2000 + 250, 900);

  // Helpers
  const inferSlideType = (src) => {
    if (!src) return 'image';
    const ext = src.split('?')[0].split('.').pop()?.toLowerCase() || '';
    return ['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(ext) ? 'video' : 'image';
  };
  const extractSrc = (el, attr) => el?.getAttribute(attr) || el?.getAttribute('src') || el?.textContent?.trim() || '';
  const extractImageSrc = (el) => el?.getAttribute('src')?.trim() || '';
  const ensurePagination = (sequences, length) => {
    if (length && (!sequences.pagination || sequences.pagination.length !== length)) {
      sequences.pagination = Array.from({ length }, (_, i) => String(i + 1));
    }
  };

  // Collect slide config
  const listRoot = root.querySelector('[data-carousel-image-list]');
  const itemElements = listRoot ? Array.from(listRoot.querySelectorAll('[data-carousel-source]')) : [];
  
  let cmsSlidesConfig = [];
  if (itemElements.length) {
    cmsSlidesConfig = itemElements.map((item, idx) => {
      const videoSrc = extractSrc(item.querySelector('[data-carousel-video-source]'), 'data-carousel-video-src');
      const imageSrc = extractImageSrc(item.querySelector('[data-carousel-image-source]'));
      const textData = {};
      
      item.querySelectorAll('[data-carousel-text]').forEach((el) => {
        const key = el.getAttribute('data-carousel-text');
        if (!key) return;
        let value = el.textContent?.trim();
        if ((!value || !value.length) && key === 'pagination') value = String(idx + 1);
        // Always store value - use " " (space) if empty to maintain consistency
        textData[key] = value || ' ';
      });
      
      // Extract link href from .carousel_link[data-carousel-link] (should be <a> tag)
      const linkEl = item.querySelector('.carousel_link[data-carousel-link]') || 
                     item.querySelector('[data-carousel-link]');
      const linkHref = linkEl?.getAttribute('href') || linkEl?.href || '';
      if (linkHref) {
        textData.link = linkHref;
      }
      
      if (!textData.pagination) textData.pagination = String(idx + 1);
      if (videoSrc) return { type: 'video', src: videoSrc, ...textData };
      if (imageSrc) return { type: inferSlideType(imageSrc), src: imageSrc, ...textData };
      return null;
    }).filter(Boolean);
  }

  const fallbackSlidesConfig = [
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-nosetack_header.mp4', title: 'Nose Stack', quote: 'Project description' },
    { type: 'image', src: 'https://cdn.prod.website-files.com/69171be02eed206b0102f9b9/69172d804fa7b36d0157d9ac_ruin_house-cover.webp', title: 'Ruin House', quote: 'Project description' },
    { type: 'image', src: 'https://cdn.prod.website-files.com/68d14433cd550114f9ff7c1f/691b2bc40cbc606506067271_20251105-DSC05265-2_websize.jpg', title: 'Project Title', quote: 'Project description' },
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-milstack_header.mp4', title: 'Mil Stack', quote: 'Project description' },
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-owlstack_header.mp4', title: 'Owl Stack', quote: 'Project description' },
  ];

  const slidesConfig = cmsSlidesConfig.length ? cmsSlidesConfig : fallbackSlidesConfig;
  const slideCount = slidesConfig.length;

  // Collect text sequences
  const collectTextSequences = (items) => {
    const sequences = {};
    items.forEach((item, idx) => {
      item.querySelectorAll('[data-carousel-text]').forEach((el) => {
        const key = el.getAttribute('data-carousel-text');
        if (!key) return;
        let value = el.textContent?.trim();
        if ((!value || !value.length) && key === 'pagination') value = String(idx + 1);
        // Always push a value - use " " (space) if empty to maintain array length
        if (!sequences[key]) sequences[key] = [];
        sequences[key].push(value || ' ');
      });
    });
    ensurePagination(sequences, items.length);
    return sequences;
  };

  const textSequencesByKey = itemElements.length 
    ? collectTextSequences(itemElements)
    : (() => {
        const seq = {};
        slidesConfig.forEach((slide) => {
          Object.keys(slide).forEach((key) => {
            if (!['type', 'src'].includes(key)) {
              if (!seq[key]) seq[key] = [];
              // Always push a value - use " " (space) if empty to maintain array length
              seq[key].push(slide[key] || ' ');
            }
          });
        });
        ensurePagination(seq, slideCount);
        return seq;
      })();

  // Create slide elements container
  const componentContainer = root.querySelector('.carousel_component');
  if (!componentContainer) {
    console.warn('⚠️ .carousel_component container not found');
    return;
  }

  // Create slides wrapper container with fixed dimensions to prevent iOS Safari zoom issues
  const slidesWrapper = document.createElement('div');
  slidesWrapper.className = 'carousel-slides-wrapper';
  slidesWrapper.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    transform: translateZ(0);
    backface-visibility: hidden;
  `;
  componentContainer.appendChild(slidesWrapper);

  // Create slide elements
  const slides = [];
  const slideElements = [];

  for (let i = 0; i < slideCount; i++) {
    const slide = slidesConfig[i];
    const slideEl = document.createElement('div');
    slideEl.className = 'carousel-slide';
      slideEl.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: ${i === 0 ? 1 : 0};
      transition: opacity ${transitionDuration}s linear;
      pointer-events: ${i === 0 ? 'auto' : 'none'};
      will-change: opacity;
      transform: translateZ(0);
      backface-visibility: hidden;
    `;

    if (slide.type === 'video') {
      const video = document.createElement('video');
      video.src = slide.src;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = 'width: 100%; height: 100%; object-fit: cover; transform: translateZ(0); backface-visibility: hidden;';
      slideEl.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = slide.src;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; transform: translateZ(0); backface-visibility: hidden;';
      slideEl.appendChild(img);
    }

    slidesWrapper.appendChild(slideEl);
    slideElements.push(slideEl);
    slides.push({ element: slideEl, config: slide });
  }

  // Text system
  const customTextElements = {};
  const textWordRegistry = {};
  const hasGSAP = typeof gsap !== 'undefined';
  const hasSplitText = hasGSAP && typeof SplitText !== 'undefined';
  const canUseSplitText = hasSplitText && Object.keys(textSequencesByKey).length > 0;

  // Find target elements
  [root, document].forEach((container) => {
    container.querySelectorAll('[data-carousel-text-target]').forEach((el) => {
      const key = el.getAttribute('data-carousel-text-target');
      if (key && (!customTextElements[key] || (root.contains(customTextElements[key]) && !root.contains(el)))) {
        customTextElements[key] = el;
      }
    });
  });

  // Find link block element (div that needs to be updated)
  const linkBlock = document.querySelector('.carousel_link-block[data-cursor]');

  // Helper to find pagination siblings
  const findPaginationSibling = (wrapper, className, attrName) => {
    const parent = wrapper.parentElement;
    if (!parent) return null;
    return Array.from(parent.children).find((el) => 
      el !== wrapper && (el.classList.contains(className) || el.getAttribute(attrName) !== null)
    );
  };

  // Build word registry
  const buildTextWordRegistry = () => {
    Object.keys(customTextElements).forEach((key) => {
      const wrapper = customTextElements[key];
      const words = textSequencesByKey[key];
      if (!wrapper || !words?.length) return;

      const inheritedClasses = Array.from(wrapper.children).reduce((acc, child) => {
        child.classList.forEach((cls) => {
          if (!acc.includes(cls) && !cls.startsWith('carousel-text-wrapper')) acc.push(cls);
        });
        return acc;
      }, []);

      wrapper.innerHTML = '';

      const nodes = words.map((word) => {
        const node = document.createElement('div');
        node.setAttribute('data-carousel-text-word', '');
        node.className = 'carousel-text-word ' + inheritedClasses.join(' ');
        node.style.cssText = 'position:absolute;top:0;left:0;';
        node.textContent = word;
        wrapper.appendChild(node);
        return node;
      });

      if (!wrapper.style.position) wrapper.style.cssText += 'position:relative;overflow:hidden;';

      textWordRegistry[key] = { wrapper, wordNodes: nodes, splits: [], activeIndex: 0 };

      // Pagination extras - only use existing elements, don't create new ones
      if (key === 'pagination') {
        const slashEl = findPaginationSibling(wrapper, 'carousel-text-pagination-slash', 'data-carousel-pagination-slash');
        const totalEl = findPaginationSibling(wrapper, 'carousel-text-pagination-total', 'data-carousel-pagination-total');
        
        // Only update if elements exist - don't create new ones
        if (slashEl) {
          slashEl.textContent = slashEl.getAttribute('data-carousel-pagination-slash') || wrapper.getAttribute('data-carousel-pagination-slash') || '/';
        }
        if (totalEl) {
          totalEl.textContent = String(slideCount);
        }
      }
    });
  };

  const updatePaginationTotal = (wrapper) => {
    // Only look for siblings, not children (slash and total are siblings of wrapper, not children)
    const totalEl = findPaginationSibling(wrapper, 'carousel-text-pagination-total', 'data-carousel-pagination-total');
    if (totalEl) totalEl.textContent = String(slideCount);
  };

  const updatePaginationNumbers = (activeIndex) => {
    const registry = textWordRegistry['pagination'];
    if (!registry) return;
    const index = ((activeIndex % slideCount) + slideCount) % slideCount;
    registry.wordNodes.forEach((node, i) => node.classList.toggle('is-active', i === index));
    updatePaginationTotal(registry.wrapper);
    registry.activeIndex = index;
  };

  const setupSplitTextWords = () => {
    Object.keys(textWordRegistry).forEach((key) => {
      const registry = textWordRegistry[key];
      registry.splits = registry.wordNodes.map((wordNode, index) => {
        const split = new SplitText(wordNode, { type: 'chars' });
        gsap.set(split.chars, { yPercent: index === 0 ? 0 : 100, immediateRender: true });
        return split;
      });
    });
  };

  const triggerSplitWordTransitions = (fromIndex, toIndex, direction = 1) => {
    Object.keys(textWordRegistry).forEach((key) => {
      const registry = textWordRegistry[key];
      if (!registry?.splits?.length) return;
      const { splits, wrapper } = registry;
      if (fromIndex >= splits.length || toIndex >= splits.length || fromIndex === toIndex) return;

      const duration = parseFloat(wrapper.getAttribute('data-carousel-text-duration')) || transitionDuration;
      const stagger = parseFloat(wrapper.getAttribute('data-carousel-text-stagger')) || 
                      parseFloat(wrapper.getAttribute('data-carousel-stagger')) || 0.01;
      const ease = wrapper.getAttribute('data-carousel-text-ease') || 'power1.inOut';
      const isForward = direction >= 0;

      gsap.timeline()
        .set(splits[toIndex].chars, { yPercent: isForward ? 100 : -100 }, 0)
        .to(splits[fromIndex].chars, { yPercent: isForward ? -100 : 100, duration, stagger, ease }, 0)
        .to(splits[toIndex].chars, { yPercent: 0, duration, stagger, ease }, 0);

      registry.activeIndex = toIndex;
      if (key === 'pagination') updatePaginationNumbers(toIndex);
    });
    
    // Update link block for the new slide (once, after all text transitions are triggered)
    updateLinkBlock(toIndex);
    // Update cursor text to match the new slide
    updateCursorText(toIndex);
  };

  const updateTextContent = (newSlideIndex, progress = 1) => {
    const slide = slidesConfig[newSlideIndex];
    if (!slide) {
      console.warn('⚠️ No slide found at index:', newSlideIndex);
      return;
    }
    
    Object.keys(customTextElements).forEach((key) => {
      if (slide[key] !== undefined) {
        const el = customTextElements[key];
        if (el) {
          el.textContent = slide[key];
          el.style.opacity = progress;
        }
      }
    });
    if (customTextElements['pagination']) {
      const pagEl = customTextElements['pagination'];
      // Only look for siblings, not children (slash and total are siblings of wrapper, not children)
      const totalEl = findPaginationSibling(pagEl, 'carousel-text-pagination-total', 'data-carousel-pagination-total');
      const numberEl = pagEl.querySelector('[data-carousel-text-word], .carousel-text-word');
      if (totalEl) totalEl.textContent = String(slideCount);
      if (numberEl) numberEl.textContent = String((newSlideIndex % slideCount) + 1);
    }
  };

  // Update link block data-href and data-cursor attribute
  const updateLinkBlock = (slideIndex) => {
    const linkElement = document.querySelector('.carousel_link-block[data-cursor]');
    if (!linkElement) return;
    
    const slide = slidesConfig[slideIndex];
    if (!slide) return;
    
    // Update data-href with link
    if (slide.link) {
      linkElement.setAttribute('data-href', slide.link);
    }
    
    // Update data-cursor with title if it exists
    if (slide.title) {
      linkElement.setAttribute('data-cursor', slide.title);
    }
  };

  // Update cursor paragraph text when slide changes
  const updateCursorText = (slideIndex) => {
    const cursorParagraph = document.querySelector('.cursor p');
    if (!cursorParagraph) return;
    
    const slide = slidesConfig[slideIndex];
    if (!slide || !slide.title) return;
    
    cursorParagraph.innerHTML = slide.title;
  };

  // Setup click handler for div-based link blocks
  if (linkBlock) {
    // Make it keyboard accessible
    linkBlock.setAttribute('role', 'button');
    linkBlock.setAttribute('tabindex', '0');
    
    // Click handler
    linkBlock.addEventListener('click', (e) => {
      const href = linkBlock.getAttribute('data-href');
      if (href) {
        window.location.href = href;
      }
    });
    
    // Keyboard handler (Enter and Space)
    linkBlock.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const href = linkBlock.getAttribute('data-href');
        if (href) {
          window.location.href = href;
        }
      }
    });
  }

  // Initialize text system
  let useSplitTextAnimations = false;
  if (canUseSplitText) {
    buildTextWordRegistry();
    if (Object.keys(textWordRegistry).length) {
      updatePaginationTotal(customTextElements['pagination']);
      setupSplitTextWords();
      if (textWordRegistry['pagination']) updatePaginationNumbers(0);
      useSplitTextAnimations = true;
    }
  }

  // Initialize first slide
  if (!useSplitTextAnimations) updateTextContent(0, 1);
  updateLinkBlock(0);
  updateCursorText(0);

  // Transition state
  let currentIndex = 0;
  let nextIndex = 1;
  let elapsed = 0;
  let inTransition = false;
  let transitionStartTime = 0;

  const beginTransition = (step = 1) => {
    if (inTransition) return;
    nextIndex = (currentIndex + step + slides.length) % slides.length;
    inTransition = true;
    elapsed = 0;
    transitionStartTime = Date.now();
    
    if (useSplitTextAnimations) {
      triggerSplitWordTransitions(currentIndex, nextIndex, step === 0 ? 1 : Math.sign(step));
    }

    // Start fade transition
    slideElements[currentIndex].style.opacity = '1';
    slideElements[nextIndex].style.opacity = '0';
    slideElements[nextIndex].style.pointerEvents = 'auto';
    
    // Use requestAnimationFrame for smooth fade
    const animate = () => {
      if (!inTransition) return;
      
      const now = Date.now();
      const elapsed = (now - transitionStartTime) / 1000;
      const progress = Math.min(elapsed / transitionDuration, 1);
      const linear = progress;
      
      slideElements[currentIndex].style.opacity = String(1 - linear);
      slideElements[nextIndex].style.opacity = String(linear);
      
      if (!useSplitTextAnimations) updateTextContent(nextIndex, linear);
      
      if (progress >= 1) {
        // Transition complete
        slideElements[currentIndex].style.opacity = '0';
        slideElements[currentIndex].style.pointerEvents = 'none';
        slideElements[nextIndex].style.opacity = '1';
        currentIndex = nextIndex;
        nextIndex = (currentIndex + 1) % slides.length;
        inTransition = false;
        if (!useSplitTextAnimations) updateTextContent(currentIndex, 1);
        updateLinkBlock(currentIndex);
        updateCursorText(currentIndex);
      } else {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };

  // Autoplay loop
  const autoplayLoop = () => {
    if (!isAutoplayEnabled) {
      return;
    }
    
    // Only increment elapsed and check for transition when not in transition
    if (!inTransition) {
      elapsed += 0.016; // ~60fps
      if (elapsed >= switchInterval) {
        beginTransition();
        elapsed = 0; // Reset only when triggering a transition
      }
    }
    
    requestAnimationFrame(autoplayLoop);
  };
  
  if (isAutoplayEnabled) {
    requestAnimationFrame(autoplayLoop);
  }

  // Scroll handlers
  let scrollCooldown = false;
  let scrollCooldownTimer = null;
  let wheelDeltaAccumulator = 0;
  let wheelResetTimeout = null;
  let lastTouchY = null;
  const wheelTriggerThreshold = 60;

  const triggerScrollTransition = (step) => {
    if (scrollCooldown) return;
    beginTransition(step);
    scrollCooldown = true;
    if (scrollCooldownTimer) clearTimeout(scrollCooldownTimer);
    scrollCooldownTimer = setTimeout(() => { scrollCooldown = false; scrollCooldownTimer = null; }, scrollDebounceMs);
    wheelDeltaAccumulator = 0;
    if (wheelResetTimeout) { clearTimeout(wheelResetTimeout); wheelResetTimeout = null; }
  };

  window.addEventListener('wheel', (e) => {
    if (scrollCooldown) return;
    wheelDeltaAccumulator += e.deltaY;
    if (Math.abs(wheelDeltaAccumulator) >= wheelTriggerThreshold) {
      triggerScrollTransition(wheelDeltaAccumulator > 0 ? 1 : -1);
      wheelDeltaAccumulator = 0;
    }
    clearTimeout(wheelResetTimeout);
    wheelResetTimeout = setTimeout(() => { wheelDeltaAccumulator = 0; wheelResetTimeout = null; }, Math.max(200, scrollDebounceMs * 0.5));
  }, { passive: true });

  window.addEventListener('touchstart', (e) => { lastTouchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (lastTouchY === null || scrollCooldown) return;
    const direction = e.touches[0].clientY < lastTouchY ? 1 : -1;
    triggerScrollTransition(direction);
    lastTouchY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchend', () => { lastTouchY = null; });

  // Prevent layout shifts during viewport changes (e.g., iOS Safari menu)
  let resizeTimeout;
  let isResizing = false;
  
  window.addEventListener('resize', () => {
    // Don't interfere with active transitions
    if (inTransition) return;
    
    if (!isResizing) {
      isResizing = true;
      // Temporarily disable transitions during resize to prevent jerky movements
      slideElements.forEach((el) => {
        el.style.transition = 'none';
      });
    }
    
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      isResizing = false;
      // Re-enable transitions after resize settles
      slideElements.forEach((el) => {
        el.style.transition = `opacity ${transitionDuration}s linear`;
      });
    }, 150);
  });
}

document.addEventListener('contentload', initCarousel);
initCarousel();
