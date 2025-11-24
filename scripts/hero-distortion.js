async function initHeroDistortion() {
  const root = document.querySelector('[data-hero-distortion-init]');
  if (!root) return;

  const autoplayAttr = root.getAttribute('data-hero-distortion-autoplay');
  const intervalAttr = root.getAttribute('data-hero-distortion-interval');

  const isAutoplayEnabled = autoplayAttr === null ? true : autoplayAttr !== 'false';
  const switchInterval = intervalAttr && !Number.isNaN(parseFloat(intervalAttr))
    ? parseFloat(intervalAttr)
    : 6;

  const app = new PIXI.Application();
  await app.init({
    resizeTo: window,
    background: '#000000',
    antialias: true,
  });
  root.appendChild(app.canvas);

  function inferSlideType(src) {
    if (!src) return 'image';
    const cleanSrc = src.split('?')[0];
    const extension = cleanSrc.split('.').pop()?.toLowerCase() || '';
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'm4v'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'avif', 'webp', 'gif'];
    if (videoExtensions.includes(extension)) return 'video';
    if (imageExtensions.includes(extension)) return 'image';
    return 'image';
  }

  function extractVideoSrc(element) {
    if (!element) return '';
    return (
      element.getAttribute('data-hero-video-src') ||
      element.getAttribute('src') ||
      element.textContent?.trim() ||
      ''
    );
  }

  function extractImageSrc(element) {
    if (!element) return '';
    return element.getAttribute('src')?.trim() || '';
  }

  function collectTextSequencesFromDom(items) {
    const sequences = {};
    items.forEach((item, index) => {
      item.querySelectorAll('[data-hero-text]').forEach((textEl) => {
        const key = textEl.getAttribute('data-hero-text');
        if (!key) return;
        let value = textEl.textContent?.trim();
        if ((!value || !value.length) && key === 'pagination') {
          value = String(index + 1);
        }
        if (!value) return;
        if (!sequences[key]) sequences[key] = [];
        sequences[key].push(value);
      });
    });
    ensurePaginationSequence(sequences, items.length);
    return sequences;
  }

  function collectTextSequencesFromSlides(slides) {
    const sequences = {};
    slides.forEach((slide) => {
      Object.keys(slide).forEach((key) => {
        if (['type', 'src'].includes(key)) return;
        const value = slide[key];
        if (!value) return;
        if (!sequences[key]) sequences[key] = [];
        sequences[key].push(value);
      });
    });
    ensurePaginationSequence(sequences, slides.length);
    return sequences;
  }

  function ensurePaginationSequence(sequences, length) {
    if (!length) return;
    if (!sequences.pagination || sequences.pagination.length !== length) {
      sequences.pagination = Array.from({ length }, (_, i) => String(i + 1));
    }
  }

  const listRoot = root.querySelector('[data-hero-distortion-image-list]');
  const itemElements = listRoot
    ? Array.from(listRoot.querySelectorAll('[data-hero-distortion-source]'))
    : [];

  let cmsSlidesConfig = [];

  if (itemElements.length) {
    cmsSlidesConfig = itemElements
      .map((item, itemIndex) => {
        const videoEl = item.querySelector('[data-hero-distortion-video-source]');
        const imageEl = item.querySelector('[data-hero-distortion-image-source]');

        const videoSrc = extractVideoSrc(videoEl);
        const imageSrc = extractImageSrc(imageEl);

        const textData = {};
        item.querySelectorAll('[data-hero-text]').forEach((textEl) => {
          const key = textEl.getAttribute('data-hero-text');
          let value = textEl.textContent?.trim();
          if ((!value || !value.length) && key === 'pagination') {
            value = String(itemIndex + 1);
          }
          if (!key || !value) return;
          textData[key] = value;
        });
        if (!textData.pagination) {
          textData.pagination = String(itemIndex + 1);
        }

        if (videoSrc) {
          return { type: 'video', src: videoSrc, ...textData };
        }
        if (imageSrc) {
          return { type: inferSlideType(imageSrc), src: imageSrc, ...textData };
        }
        return null;
      })
      .filter(Boolean);
  }

  // Legacy fallback: allow direct image elements without wrapper
  if (!cmsSlidesConfig.length && listRoot) {
    const legacyImageEls = Array.from(
      listRoot.querySelectorAll('[data-hero-distortion-image-source]')
    );
    cmsSlidesConfig = legacyImageEls
      .map((el) => {
        const src = extractImageSrc(el);
        if (!src) return null;
        return {
          type: inferSlideType(src),
          src,
        };
      })
      .filter(Boolean);
  }

  const fallbackSlidesConfig = [
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-nosetack_header.mp4', title: 'Nose Stack', description: 'Project description' },
    { type: 'image', src: 'https://cdn.prod.website-files.com/69171be02eed206b0102f9b9/69172d804fa7b36d0157d9ac_ruin_house-cover.webp', title: 'Ruin House', description: 'Project description' },
    { type: 'image', src: 'https://cdn.prod.website-files.com/68d14433cd550114f9ff7c1f/691b2bc40cbc606506067271_20251105-DSC05265-2_websize.jpg', title: 'Project Title', description: 'Project description' },
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-milstack_header.mp4', title: 'Mil Stack', description: 'Project description' },
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-owlstack_header.mp4', title: 'Owl Stack', description: 'Project description' },
  ];

  const slidesConfig = cmsSlidesConfig.length ? cmsSlidesConfig : fallbackSlidesConfig;
  const slideCount = slidesConfig.length;

  const textSequencesByKey = itemElements.length
    ? collectTextSequencesFromDom(itemElements)
    : collectTextSequencesFromSlides(slidesConfig);

  async function loadSlideTexture(slide) {
    if (slide.type === 'video') {
      return PIXI.Assets.load({
        src: slide.src,
        data: { autoPlay: true, autoLoad: true, loop: true, muted: true },
        loadParser: 'loadVideo',
      });
    }
    return PIXI.Assets.load(slide.src);
  }

  const slideTextures = await Promise.all(slidesConfig.map(loadSlideTexture));

  function fitSpriteToScreen(sprite) {
    const tex = sprite.texture;
    if (!tex || !tex.width || !tex.height) return;

    const screenW = app.screen.width;
    const screenH = app.screen.height;
    const scale = Math.max(screenW / tex.width, screenH / tex.height);

    sprite.width = tex.width * scale;
    sprite.height = tex.height * scale;
    sprite.anchor.set(0.5);
    sprite.position.set(screenW / 2, screenH / 2);
  }

  const slides = slideTextures.map((tex) => {
    const sprite = new PIXI.Sprite(tex);
    fitSpriteToScreen(sprite);
    return sprite;
  });

  slides.forEach((sprite, i) => {
    sprite.alpha = i === 0 ? 1 : 0;
    app.stage.addChild(sprite);
  });

  const displacementImgEl = root.querySelector('[data-hero-distortion-displacement_map]');
  const displacementSrc = displacementImgEl?.getAttribute('src') || 'https://cdn.prod.fasfswebsite-files.com/69171be02eed206b0102f9b0/691dde12f3d23dc0d263f461_displacement-map.png';
  const displacementTexture = await PIXI.Assets.load(displacementSrc);
  const displacementSprite = new PIXI.Sprite(displacementTexture);
  displacementSprite.anchor.set(0.5);
  displacementSprite.position.set(app.screen.width / 2, app.screen.height / 2);
  displacementSprite.width = app.screen.width;
  displacementSprite.height = app.screen.height;
  app.stage.addChild(displacementSprite);

  // Create two separate displacement filters for current and next slides
  const displacementFilterCurrent = new PIXI.DisplacementFilter({
    sprite: displacementSprite,
    scale: 0,
  });
  const displacementFilterNext = new PIXI.DisplacementFilter({
    sprite: displacementSprite,
    scale: 0,
  });

  const maxStrength = 40;

  let currentIndex = 0;
  let nextIndex = 1;
  const transitionDuration = 0.55;

  // Find all target elements with data-hero-text-target="key" (these are the display elements)
  // Title, description, and all other text fields use this same system
  const customTextElements = {};
  const textWordRegistry = {};
  let useSplitTextAnimations = false;
  const canUseSplitText =
    typeof gsap !== 'undefined' &&
    typeof SplitText !== 'undefined' &&
    Object.keys(textSequencesByKey).length > 0;
  
  function findTargetElements(container) {
    container.querySelectorAll('[data-hero-text-target]').forEach(el => {
      const key = el.getAttribute('data-hero-text-target');
      if (key) {
        // Prefer elements inside root, but allow document-wide targets too
        if (!customTextElements[key] || 
            (root.contains(customTextElements[key]) && !root.contains(el))) {
          customTextElements[key] = el;
        }
      }
    });
  }
  
  // Scan root container first (priority)
  findTargetElements(root);
  // Then scan document-wide for any targets we missed
  findTargetElements(document);

  if (canUseSplitText) {
    buildTextWordRegistry();
    if (Object.keys(textWordRegistry).length) {
      initPaginationTotals();
      setupSplitTextWords();
      // Initialize pagination to show first slide
      if (textWordRegistry['pagination']) {
        updatePaginationNumbers(0);
      }
      useSplitTextAnimations = true;
    }
  }

  function buildTextWordRegistry() {
    Object.keys(customTextElements).forEach((key) => {
      const wrapper = customTextElements[key];
      const words = textSequencesByKey[key];
      if (!wrapper || !words || !words.length) return;

      // collect classes (excluding data/hero-text-specific ones) from existing children
      const inheritedClasses = Array.from(wrapper.children).reduce((acc, child) => {
        child.classList.forEach((cls) => {
          if (!acc.includes(cls) && !cls.startsWith('hero-text-wrapper')) {
            acc.push(cls);
          }
        });
        return acc;
      }, []);

      wrapper.innerHTML = '';

      const nodes = words.map((word) => {
        const node = document.createElement('div');
        node.setAttribute('data-hero-text-word', '');
        node.classList.add('hero-text-word');
        inheritedClasses.forEach((cls) => node.classList.add(cls));
        // Ensure absolute positioning for stacking (like GSAP example)
        node.style.cssText += 'position:absolute;top:0;left:0;';
        node.textContent = word;
        wrapper.appendChild(node);
        return node;
      });
      
      // Ensure wrapper has proper CSS for masking
      if (!wrapper.style.position) {
        wrapper.style.cssText += 'position:relative;overflow:hidden;';
      }

      textWordRegistry[key] = {
        wrapper,
        wordNodes: nodes,
        splits: [],
        activeIndex: 0,
      };

      if (key === 'pagination') {
        // Check for existing static slash/total as siblings (outside wrapper)
        const parent = wrapper.parentElement;
        if (parent) {
          // Find existing slash span (sibling of wrapper)
          let slashEl = Array.from(parent.children).find(
            (el) =>
              el !== wrapper &&
              (el.classList.contains('hero-text-pagination-slash') ||
                el.getAttribute('data-hero-pagination-slash') !== null)
          );
          
          // Find existing total span (sibling of wrapper)
          let totalEl = Array.from(parent.children).find(
            (el) =>
              el !== wrapper &&
              (el.classList.contains('hero-text-pagination-total') ||
                el.getAttribute('data-hero-pagination-total') !== null)
          );

          // If slash exists, update it; otherwise create inside wrapper
          if (slashEl) {
            slashEl.textContent =
              slashEl.getAttribute('data-hero-pagination-slash') ||
              wrapper.getAttribute('data-hero-pagination-slash') ||
              '/';
          } else {
            const slash = document.createElement('span');
            slash.className = 'hero-text-pagination-slash';
            slash.textContent =
              wrapper.getAttribute('data-hero-pagination-slash') || '/';
            wrapper.appendChild(slash);
          }

          // If total exists, update it; otherwise create inside wrapper
          if (totalEl) {
            totalEl.textContent = String(slideCount);
          } else {
            const total = document.createElement('span');
            total.className = 'hero-text-pagination-total';
            total.textContent = String(slideCount);
            wrapper.appendChild(total);
          }
        } else {
          // Fallback: create inside wrapper if no parent
          const slash = document.createElement('span');
          slash.className = 'hero-text-pagination-slash';
          slash.textContent =
            wrapper.getAttribute('data-hero-pagination-slash') || '/';
          const total = document.createElement('span');
          total.className = 'hero-text-pagination-total';
          total.textContent = String(slideCount);
          wrapper.appendChild(slash);
          wrapper.appendChild(total);
        }
      }
    });
  }

  function initPaginationTotals() {
    Object.keys(customTextElements).forEach((key) => {
      if (key !== 'pagination') return;
      const wrapper = customTextElements[key];
      const parent = wrapper.parentElement;
      
      // Check inside wrapper first
      let totalEl =
        wrapper.querySelector('.hero-text-pagination-total') ||
        wrapper.querySelector('[data-hero-pagination-total]');
      
      // If not found, check siblings
      if (!totalEl && parent) {
        totalEl = Array.from(parent.children).find(
          (el) =>
            el !== wrapper &&
            (el.classList.contains('hero-text-pagination-total') ||
              el.getAttribute('data-hero-pagination-total') !== null)
        );
      }
      
      if (totalEl) totalEl.textContent = String(slideCount);
    });
  }

  function updatePaginationNumbers(activeIndex) {
    const registry = textWordRegistry['pagination'];
    if (!registry) return;
    const index = ((activeIndex % slideCount) + slideCount) % slideCount;
    
    // Don't change textContent after SplitText - just update active class
    registry.wordNodes.forEach((node, i) => {
      node.classList.toggle('is-active', i === index);
    });
    
    // Update total - check inside wrapper first, then siblings
    const wrapper = registry.wrapper;
    const parent = wrapper.parentElement;
    let totalEl =
      wrapper.querySelector('.hero-text-pagination-total') ||
      wrapper.querySelector('[data-hero-pagination-total]');
    
    if (!totalEl && parent) {
      totalEl = Array.from(parent.children).find(
        (el) =>
          el !== wrapper &&
          (el.classList.contains('hero-text-pagination-total') ||
            el.getAttribute('data-hero-pagination-total') !== null)
      );
    }
    
    if (totalEl) totalEl.textContent = String(slideCount);
    registry.activeIndex = index;
  }

  function setupSplitTextWords() {
    Object.keys(textWordRegistry).forEach((key) => {
      const registry = textWordRegistry[key];
      registry.splits = registry.wordNodes.map((wordNode, index) => {
        const split = new SplitText(wordNode, { type: 'chars' });
        // First word visible (yPercent: 0), all others hidden below (yPercent: 100)
        gsap.set(split.chars, { 
          yPercent: index === 0 ? 0 : 100,
          immediateRender: true 
        });
        return split;
      });
    });
  }

  function triggerSplitWordTransitions(fromIndex, toIndex, direction = 1) {
    Object.keys(textWordRegistry).forEach((key) => {
      const registry = textWordRegistry[key];
      if (!registry || !registry.splits?.length) return;
      const { splits, wrapper } = registry;
      if (fromIndex >= splits.length || toIndex >= splits.length) return;
      if (fromIndex === toIndex) return;

      const duration =
        parseFloat(wrapper.getAttribute('data-hero-text-duration')) || transitionDuration;
      // Support both data-hero-text-stagger and data-hero-stagger
      const stagger =
        parseFloat(wrapper.getAttribute('data-hero-text-stagger')) ||
        parseFloat(wrapper.getAttribute('data-hero-stagger')) ||
        0.01;
      const ease = wrapper.getAttribute('data-hero-text-ease') || 'power1.inOut';

      const currentSplit = splits[fromIndex];
      const nextSplit = splits[toIndex];
      const isForward = direction >= 0;
      const nextStart = isForward ? 100 : -100;
      const currentEnd = isForward ? -100 : 100;

      gsap.timeline()
        .set(nextSplit.chars, { yPercent: nextStart }, 0)
        .to(currentSplit.chars, { yPercent: currentEnd, duration, stagger, ease }, 0)
        .to(nextSplit.chars, { yPercent: 0, duration, stagger, ease }, 0);

      registry.activeIndex = toIndex;
      if (key === 'pagination') updatePaginationNumbers(toIndex);
    });
  }

  // Function to update text content with fade transition (fallback when GSAP/SplitText unavailable)
  function updateTextContent(newSlideIndex, transitionProgress = 1) {
    const newSlide = slidesConfig[newSlideIndex];
    if (!newSlide) return;

    Object.keys(customTextElements).forEach(key => {
      if (newSlide[key] !== undefined) {
        const el = customTextElements[key];
        if (el) {
          el.textContent = newSlide[key];
          el.style.opacity = transitionProgress;
        }
      }
    });

    if (customTextElements['pagination']) {
      const paginationEl = customTextElements['pagination'];
      const parent = paginationEl.parentElement;
      
      // Find total - check inside wrapper first, then siblings
      let totalEl =
        paginationEl.querySelector('.hero-text-pagination-total') ||
        paginationEl.querySelector('[data-hero-pagination-total]');
      if (!totalEl && parent) {
        totalEl = Array.from(parent.children).find(
          (el) =>
            el !== paginationEl &&
            (el.classList.contains('hero-text-pagination-total') ||
              el.getAttribute('data-hero-pagination-total') !== null)
        );
      }
      
      // Find slash - check inside wrapper first, then siblings
      let slashEl =
        paginationEl.querySelector('.hero-text-pagination-slash') ||
        paginationEl.querySelector('[data-hero-pagination-slash]');
      if (!slashEl && parent) {
        slashEl = Array.from(parent.children).find(
          (el) =>
            el !== paginationEl &&
            (el.classList.contains('hero-text-pagination-slash') ||
              el.getAttribute('data-hero-pagination-slash') !== null)
        );
      }
      
      if (totalEl) totalEl.textContent = String(slideCount);
      if (slashEl) {
        slashEl.textContent =
          slashEl.getAttribute('data-hero-pagination-slash') ||
          paginationEl.getAttribute('data-hero-pagination-slash') ||
          '/';
      }
      const numberEl =
        paginationEl.querySelector('[data-hero-text-word], .hero-text-word') ||
        paginationEl.querySelector('.hero-text-word');
      if (numberEl) numberEl.textContent = String((newSlideIndex % slideCount) + 1);
    }
  }

  if (!useSplitTextAnimations) {
    updateTextContent(0, 1);
  }

  let elapsed = 0;
  let transitionTime = 0;
  let inTransition = false;

  function resetIntervalTimer() {
    elapsed = 0;
  }

  function beginTransition(step = 1) {
    if (inTransition) return;
    nextIndex = (currentIndex + step + slides.length) % slides.length;
    inTransition = true;
    resetIntervalTimer();
    transitionTime = 0;
    if (useSplitTextAnimations) {
      const direction = step === 0 ? 1 : Math.sign(step);
      triggerSplitWordTransitions(currentIndex, nextIndex, direction);
    }
  }

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    const time = ticker.lastTime / 1000;

    displacementSprite.x = app.screen.width / 2;
    displacementSprite.y = app.screen.height / 2;

    if (!inTransition) {
      // Remove filters when not transitioning
      slides.forEach((slide) => {
        slide.filters = null;
      });
      elapsed += dt;
      if (isAutoplayEnabled && elapsed >= switchInterval) beginTransition();
      return;
    }

    transitionTime += dt;
    const t = Math.min(transitionTime / transitionDuration, 1);
    
    // Easing function for smooth transitions (ease-in-out)
    const easeInOut = t * t * (3 - 2 * t);
    
    // Outgoing slide: starts at 0 (undistorted), distorts as it fades out
    const strengthOut = maxStrength * easeInOut;              // 0 → max (eased)
    // Incoming slide: starts at max (distorted), ends at 0 (undistorted)
    const strengthIn = maxStrength * (1 - easeInOut);         // max → 0 (eased)

    const currentSlide = slides[currentIndex];
    const nextSlide = slides[nextIndex];

    // Apply filters to respective slides
    currentSlide.filters = [displacementFilterCurrent];
    displacementFilterCurrent.scale.set(strengthOut, strengthOut);

    nextSlide.filters = [displacementFilterNext];
    displacementFilterNext.scale.set(strengthIn, strengthIn);

    // Crossfade alpha (eased for smooth transition)
    currentSlide.alpha = 1 - easeInOut;
    nextSlide.alpha = easeInOut;

    if (!useSplitTextAnimations) {
      updateTextContent(nextIndex, easeInOut);
    }

    if (t >= 1) {
      currentSlide.alpha = 0;
      nextSlide.alpha = 1;

      // Remove filters after transition completes
      currentSlide.filters = null;
      nextSlide.filters = null;

      currentIndex = nextIndex;
      nextIndex = (currentIndex + 1) % slides.length;
      inTransition = false;
      
      if (!useSplitTextAnimations) {
        updateTextContent(currentIndex, 1);
      }
    }
  });

  let scrollCooldown = false;
  let scrollCooldownTimer = null;
  let wheelDeltaAccumulator = 0;
  let wheelResetTimeout = null;
  let lastTouchY = null;
  const scrollDebounceMs =
    parseFloat(root.getAttribute('data-hero-scroll-debounce')) ||
    Math.max(transitionDuration * 2000 + 250, 900);

  function triggerScrollTransition(step) {
    if (scrollCooldown) return;
    beginTransition(step);
    scrollCooldown = true;
    if (scrollCooldownTimer) clearTimeout(scrollCooldownTimer);
    scrollCooldownTimer = setTimeout(() => {
      scrollCooldown = false;
      scrollCooldownTimer = null;
    }, scrollDebounceMs);
    wheelDeltaAccumulator = 0;
    if (wheelResetTimeout) {
      clearTimeout(wheelResetTimeout);
      wheelResetTimeout = null;
    }
  }

  const wheelTriggerThreshold = 60;

  window.addEventListener('wheel', (event) => {
    if (scrollCooldown) return;
    wheelDeltaAccumulator += event.deltaY;

    if (Math.abs(wheelDeltaAccumulator) >= wheelTriggerThreshold) {
      const direction = wheelDeltaAccumulator > 0 ? 1 : -1;
      triggerScrollTransition(direction);
      wheelDeltaAccumulator = 0;
    }

    clearTimeout(wheelResetTimeout);
    wheelResetTimeout = setTimeout(() => {
      wheelDeltaAccumulator = 0;
      wheelResetTimeout = null;
    }, Math.max(200, scrollDebounceMs * 0.5));
  }, { passive: true });

  window.addEventListener('touchstart', (event) => {
    lastTouchY = event.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (event) => {
    if (lastTouchY === null || scrollCooldown) return;
    const currentY = event.touches[0].clientY;
    const direction = currentY < lastTouchY ? 1 : -1;
    triggerScrollTransition(direction);
    lastTouchY = currentY;
  }, { passive: true });

  window.addEventListener('touchend', () => {
    lastTouchY = null;
  });

  window.addEventListener('resize', () => {
    slides.forEach(fitSpriteToScreen);
    displacementSprite.position.set(app.screen.width / 2, app.screen.height / 2);
    displacementSprite.width = app.screen.width;
    displacementSprite.height = app.screen.height;
  });
}

// Initialize - works whether script loads early or late
document.addEventListener('contentload', 
  initHeroDistortion
);


initHeroDistortion();