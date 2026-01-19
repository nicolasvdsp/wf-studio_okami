async function initHeroDistortion() {
  console.log("haha");
  const root = document.querySelector('[data-hero-distortion-init]');
  if (!root) return;

  // Clear background image placeholder (only needed for Webflow designer preview)
  root.style.backgroundImage = 'none';

  // Config
  const isAutoplayEnabled = root.getAttribute('data-hero-distortion-autoplay') !== 'false';
  const switchInterval = parseFloat(root.getAttribute('data-hero-distortion-interval')) || 5;
  const transitionDuration = parseFloat(root.getAttribute('data-hero-distortion-duration')) || 0.45;
  const maxStrength = parseFloat(root.getAttribute('data-hero-distortion-strength')) || 40;
  const scrollDebounceMs = parseFloat(root.getAttribute('data-hero-scroll-debounce')) || Math.max(transitionDuration * 2000 + 250, 900);

  // PIXI setup
  const app = new PIXI.Application();
  await app.init({ resizeTo: window, background: '#000000', antialias: true });
  root.appendChild(app.canvas);

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
  const listRoot = root.querySelector('[data-hero-distortion-image-list]');
  const itemElements = listRoot ? Array.from(listRoot.querySelectorAll('[data-hero-distortion-source]')) : [];
  
  let cmsSlidesConfig = [];
  if (itemElements.length) {
    cmsSlidesConfig = itemElements.map((item, idx) => {
      const videoSrc = extractSrc(item.querySelector('[data-hero-distortion-video-source]'), 'data-hero-video-src');
      const imageSrc = extractImageSrc(item.querySelector('[data-hero-distortion-image-source]'));
      const textData = {};
      
      item.querySelectorAll('[data-hero-text]').forEach((el) => {
        const key = el.getAttribute('data-hero-text');
        if (!key) return;
        let value = el.textContent?.trim();
        if ((!value || !value.length) && key === 'pagination') value = String(idx + 1);
        if (value) textData[key] = value;
      });
      
      // Extract link href from .hero-distortion_link[data-hero-distortion-link] (should be <a> tag)
      const linkEl = item.querySelector('.hero-distortion_link[data-hero-distortion-link]') || 
                     item.querySelector('[data-hero-distortion-link]');
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
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-nosetack_header.mp4', title: 'Nose Stack', description: 'Project description' },
    { type: 'image', src: 'https://cdn.prod.website-files.com/69171be02eed206b0102f9b9/69172d804fa7b36d0157d9ac_ruin_house-cover.webp', title: 'Ruin House', description: 'Project description' },
    { type: 'image', src: 'https://cdn.prod.website-files.com/68d14433cd550114f9ff7c1f/691b2bc40cbc606506067271_20251105-DSC05265-2_websize.jpg', title: 'Project Title', description: 'Project description' },
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-milstack_header.mp4', title: 'Mil Stack', description: 'Project description' },
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-owlstack_header.mp4', title: 'Owl Stack', description: 'Project description' },
  ];

  const slidesConfig = cmsSlidesConfig.length ? cmsSlidesConfig : fallbackSlidesConfig;
  const slideCount = slidesConfig.length;

  // Log all collected slide data for debugging
  /*console.group('🎬 Hero Distortion - Collected Slide Data');
  console.log(`Total slides: ${slideCount}`);
  slidesConfig.forEach((slide, index) => {
    console.group(`Slide ${index + 1} (index: ${index})`);
    console.log('Type:', slide.type);
    console.log('Source:', slide.src);
    // Log all text fields
    const textFields = {};
    Object.keys(slide).forEach((key) => {
      if (!['type', 'src'].includes(key)) {
        textFields[key] = slide[key];
      }
    });
    console.log('Text Fields:', textFields);
    console.log('Full Object:', slide);
    console.groupEnd();
  });
  console.log('All Slides Array:', slidesConfig);
  console.groupEnd();*/

  // Collect text sequences
  const collectTextSequences = (items) => {
    const sequences = {};
    items.forEach((item, idx) => {
      item.querySelectorAll('[data-hero-text]').forEach((el) => {
        const key = el.getAttribute('data-hero-text');
        if (!key) return;
        let value = el.textContent?.trim();
        if ((!value || !value.length) && key === 'pagination') value = String(idx + 1);
        if (value) {
          if (!sequences[key]) sequences[key] = [];
          sequences[key].push(value);
        }
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
            if (!['type', 'src'].includes(key) && slide[key]) {
              if (!seq[key]) seq[key] = [];
              seq[key].push(slide[key]);
            }
          });
        });
        ensurePagination(seq, slideCount);
        return seq;
      })();

  // Load textures
  const slideTextures = await Promise.all(slidesConfig.map((slide) => 
    slide.type === 'video' 
      ? PIXI.Assets.load({ src: slide.src, data: { autoPlay: true, autoLoad: true, loop: true, muted: true }, loadParser: 'loadVideo' })
      : PIXI.Assets.load(slide.src)
  ));

  // Create sprites
  const fitSpriteToScreen = (sprite) => {
    const tex = sprite.texture;
    if (!tex?.width || !tex?.height) return;
    const scale = Math.max(app.screen.width / tex.width, app.screen.height / tex.height);
    sprite.width = tex.width * scale;
    sprite.height = tex.height * scale;
    sprite.anchor.set(0.5);
    sprite.position.set(app.screen.width / 2, app.screen.height / 2);
  };

  const slides = slideTextures.map((tex) => {
    const sprite = new PIXI.Sprite(tex);
    fitSpriteToScreen(sprite);
    return sprite;
  });

  slides.forEach((sprite, i) => {
    sprite.alpha = i === 0 ? 1 : 0;
    app.stage.addChild(sprite);
  });

  // Displacement map
  const displacementSrc = root.querySelector('[data-hero-distortion-displacement_map]')?.getAttribute('src') || 'https://cdn.prod.fasfswebsite-files.com/69171be02eed206b0102f9b0/691dde12f3d23dc0d263f461_displacement-map.png';
  const displacementTexture = await PIXI.Assets.load(displacementSrc);
  const displacementSprite = new PIXI.Sprite(displacementTexture);
  displacementSprite.anchor.set(0.5);
  displacementSprite.position.set(app.screen.width / 2, app.screen.height / 2);
  displacementSprite.width = app.screen.width;
  displacementSprite.height = app.screen.height;
  app.stage.addChild(displacementSprite);

  const displacementFilterCurrent = new PIXI.DisplacementFilter({ sprite: displacementSprite, scale: 0 });
  const displacementFilterNext = new PIXI.DisplacementFilter({ sprite: displacementSprite, scale: 0 });

  // Text system
  const customTextElements = {};
  const textWordRegistry = {};
  const hasGSAP = typeof gsap !== 'undefined';
  const hasSplitText = hasGSAP && typeof SplitText !== 'undefined';
  const canUseSplitText = hasSplitText && Object.keys(textSequencesByKey).length > 0;

  // Find target elements
  [root, document].forEach((container) => {
    container.querySelectorAll('[data-hero-text-target]').forEach((el) => {
      const key = el.getAttribute('data-hero-text-target');
      if (key && (!customTextElements[key] || (root.contains(customTextElements[key]) && !root.contains(el)))) {
        customTextElements[key] = el;
      }
    });
  });

  // Find link block element (div that needs to be updated)
  const linkBlock = document.querySelector('.hero-distortion_link-block[data-cursor]');

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
          if (!acc.includes(cls) && !cls.startsWith('hero-text-wrapper')) acc.push(cls);
        });
        return acc;
      }, []);

      wrapper.innerHTML = '';

      const nodes = words.map((word) => {
        const node = document.createElement('div');
        node.setAttribute('data-hero-text-word', '');
        node.className = 'hero-text-word ' + inheritedClasses.join(' ');
        node.style.cssText = 'position:absolute;top:0;left:0;';
        node.textContent = word;
        wrapper.appendChild(node);
        return node;
      });

      if (!wrapper.style.position) wrapper.style.cssText += 'position:relative;overflow:hidden;';

      textWordRegistry[key] = { wrapper, wordNodes: nodes, splits: [], activeIndex: 0 };

      // Pagination extras
      if (key === 'pagination') {
        const parent = wrapper.parentElement;
        const slashEl = findPaginationSibling(wrapper, 'hero-text-pagination-slash', 'data-hero-pagination-slash');
        const totalEl = findPaginationSibling(wrapper, 'hero-text-pagination-total', 'data-hero-pagination-total');
        const slash = slashEl || document.createElement('span');
        const total = totalEl || document.createElement('span');
        
        if (!slashEl) {
          slash.className = 'hero-text-pagination-slash';
          wrapper.appendChild(slash);
        }
        if (!totalEl) {
          total.className = 'hero-text-pagination-total';
          wrapper.appendChild(total);
        }
        
        slash.textContent = slash.getAttribute('data-hero-pagination-slash') || wrapper.getAttribute('data-hero-pagination-slash') || '/';
        total.textContent = String(slideCount);
      }
    });
  };

  const updatePaginationTotal = (wrapper) => {
    const totalEl = wrapper.querySelector('.hero-text-pagination-total') || 
                    wrapper.querySelector('[data-hero-pagination-total]') ||
                    findPaginationSibling(wrapper, 'hero-text-pagination-total', 'data-hero-pagination-total');
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

      const duration = parseFloat(wrapper.getAttribute('data-hero-text-duration')) || transitionDuration;
      const stagger = parseFloat(wrapper.getAttribute('data-hero-text-stagger')) || 
                      parseFloat(wrapper.getAttribute('data-hero-stagger')) || 0.01;
      const ease = wrapper.getAttribute('data-hero-text-ease') || 'power1.inOut';
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
    
    // Log what text is being updated
    console.log('📝 Updating text content:', {
      slideIndex: newSlideIndex,
      progress,
      slideData: slide,
      textFields: Object.keys(slide).filter(k => !['type', 'src'].includes(k))
    });
    
    Object.keys(customTextElements).forEach((key) => {
      if (slide[key] !== undefined) {
        const el = customTextElements[key];
        if (el) {
          console.log(`  → ${key}: "${slide[key]}"`);
          el.textContent = slide[key];
          el.style.opacity = progress;
        }
      }
    });
    if (customTextElements['pagination']) {
      const pagEl = customTextElements['pagination'];
      const totalEl = pagEl.querySelector('.hero-text-pagination-total') || 
                      pagEl.querySelector('[data-hero-pagination-total]') ||
                      findPaginationSibling(pagEl, 'hero-text-pagination-total', 'data-hero-pagination-total');
      const numberEl = pagEl.querySelector('[data-hero-text-word], .hero-text-word');
      if (totalEl) totalEl.textContent = String(slideCount);
      if (numberEl) numberEl.textContent = String((newSlideIndex % slideCount) + 1);
    }
  };

  // Update link block data-href and data-cursor attribute
  const updateLinkBlock = (slideIndex) => {
    const linkElement = document.querySelector('.hero-distortion_link-block[data-cursor]');
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
  if (!useSplitTextAnimations) updateTextContent(0, 1);
  
  // Initialize link block with first slide
  updateLinkBlock(0);
  // Initialize cursor text with first slide
  updateCursorText(0);

  // Transition state
  let currentIndex = 0, nextIndex = 1, elapsed = 0, transitionTime = 0, inTransition = false;

  const beginTransition = (step = 1) => {
    if (inTransition) return;
    nextIndex = (currentIndex + step + slides.length) % slides.length;
    inTransition = true;
    elapsed = transitionTime = 0;
    
    // Log transition details
    /*console.log('🔄 Transition:', {
      from: currentIndex,
      to: nextIndex,
      step,
      currentSlide: slidesConfig[currentIndex],
      nextSlide: slidesConfig[nextIndex]
    });*/
    
    if (useSplitTextAnimations) {
      triggerSplitWordTransitions(currentIndex, nextIndex, step === 0 ? 1 : Math.sign(step));
    }
  };

  // Animation loop
  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    displacementSprite.position.set(app.screen.width / 2, app.screen.height / 2);

    if (!inTransition) {
      slides.forEach((slide) => slide.filters = null);
      elapsed += dt;
      if (isAutoplayEnabled && elapsed >= switchInterval) beginTransition();
      return;
    }

    transitionTime += dt;
    const t = Math.min(transitionTime / transitionDuration, 1);
    const easeInOut = t * t * (3 - 2 * t);
    const strengthOut = maxStrength * easeInOut;
    const strengthIn = maxStrength * (1 - easeInOut);

    const currentSlide = slides[currentIndex];
    const nextSlide = slides[nextIndex];

    currentSlide.filters = [displacementFilterCurrent];
    nextSlide.filters = [displacementFilterNext];
    displacementFilterCurrent.scale.set(strengthOut, strengthOut);
    displacementFilterNext.scale.set(strengthIn, strengthIn);
    currentSlide.alpha = 1 - easeInOut;
    nextSlide.alpha = easeInOut;

    if (!useSplitTextAnimations) updateTextContent(nextIndex, easeInOut);

    if (t >= 1) {
      currentSlide.alpha = 0;
      nextSlide.alpha = 1;
      currentSlide.filters = null;
      nextSlide.filters = null;
      currentIndex = nextIndex;
      nextIndex = (currentIndex + 1) % slides.length;
      inTransition = false;
      if (!useSplitTextAnimations) updateTextContent(currentIndex, 1);
      // Update link block with new slide
      updateLinkBlock(currentIndex);
      // Update cursor text with new slide
      updateCursorText(currentIndex);
    }
  });

  // Scroll handlers
  let scrollCooldown = false, scrollCooldownTimer = null, wheelDeltaAccumulator = 0, wheelResetTimeout = null, lastTouchY = null;
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

  window.addEventListener('resize', () => {
    slides.forEach(fitSpriteToScreen);
    displacementSprite.position.set(app.screen.width / 2, app.screen.height / 2);
    displacementSprite.width = app.screen.width;
    displacementSprite.height = app.screen.height;
  });
}

document.addEventListener('contentload', initHeroDistortion);
initHeroDistortion();
