async function initHeroDistortion() {
  // Register GSAP PixiPlugin if available
  if (typeof gsap !== 'undefined' && typeof PixiPlugin !== 'undefined') {
    gsap.registerPlugin(PixiPlugin);
  }
  
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
  
  // Preloader config
  const preloaderEnabled = root.getAttribute('data-hero-preloader') !== 'false';
  const preloaderDuration = parseFloat(root.getAttribute('data-hero-preloader-duration')) || 1.4; // seconds per image
  const preloaderOverlap = parseFloat(root.getAttribute('data-hero-preloader-overlap')) || 0.3; // overlap in seconds (how much they overlap)
  const preloaderStorageKey = 'hero-distortion-preloader-shown';

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
    // Use Math.max for "cover" behavior - image fills screen
    const scale = Math.max(app.screen.width / tex.width, app.screen.height / tex.height);
    sprite.width = tex.width * scale;
    sprite.height = tex.height * scale;
    sprite.anchor.set(0.5);
    sprite.position.set(app.screen.width / 2, app.screen.height / 2);
    // Store the scale that was applied (for preloader animations)
    sprite.baseScale = scale;
  };

  const slides = slideTextures.map((tex) => {
    const sprite = new PIXI.Sprite(tex);
    fitSpriteToScreen(sprite);
    // Store original fitted dimensions to preserve them during preloader and after
    sprite.originalFittedWidth = sprite.width;
    sprite.originalFittedHeight = sprite.height;
    return sprite;
  });

  // Initialize all slides as hidden (preloader will show them)
  slides.forEach((sprite, i) => {
    sprite.alpha = 0;
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

  // Transition state
  let currentIndex = 0, nextIndex = 1, elapsed = 0, transitionTime = 0, inTransition = false;
  let preloaderActive = false;
  let preloaderComplete = false;

  // Preloader function
  const runPreloader = () => {
    // Check if preloader should run
    if (!preloaderEnabled) {
      // Skip preloader, start with first slide
      currentIndex = 0;
      slides[0].alpha = 1;
      if (!useSplitTextAnimations) updateTextContent(0, 1);
      updateLinkBlock(0);
      updateCursorText(0);
      preloaderComplete = true;
      return;
    }

    // Check sessionStorage
    const hasSeenPreloader = sessionStorage.getItem(preloaderStorageKey) === 'true';
    if (hasSeenPreloader) {
      // Skip preloader, start with first slide (index 0)
      currentIndex = 0;
      slides[currentIndex].alpha = 1;
      slides[currentIndex].scale.set(1, 1);
      slides[currentIndex].position.y = app.screen.height / 2;
      // Hide other slides
      slides.forEach((sprite, index) => {
        if (index !== 0) {
          sprite.alpha = 0;
        }
      });
      if (!useSplitTextAnimations) updateTextContent(currentIndex, 1);
      updateLinkBlock(currentIndex);
      updateCursorText(currentIndex);
      preloaderComplete = true;
      return;
    }

    // Run preloader sequence with GSAP timeline
    preloaderActive = true;
    
    // Check if GSAP is available
    if (typeof gsap === 'undefined') {
      console.warn('GSAP is required for preloader animations');
      // Fallback to simple preloader
      let preloaderIndex = 0;
      const showNextSlide = () => {
        slides.forEach(sprite => sprite.alpha = 0);
        slides[preloaderIndex].alpha = 1;
        if (!useSplitTextAnimations) updateTextContent(preloaderIndex, 1);
        updateLinkBlock(preloaderIndex);
        updateCursorText(preloaderIndex);
        preloaderIndex++;
        if (preloaderIndex < slideCount) {
          setTimeout(showNextSlide, preloaderDuration * 1000);
        } else {
          currentIndex = slideCount - 1;
          slides[currentIndex].alpha = 1;
          if (!useSplitTextAnimations) updateTextContent(currentIndex, 1);
          updateLinkBlock(currentIndex);
          updateCursorText(currentIndex);
          sessionStorage.setItem(preloaderStorageKey, 'true');
          preloaderActive = false;
          preloaderComplete = true;
        }
      };
      showNextSlide();
      return;
    }

    // Create GSAP timeline for preloader
    const preloaderTimeline = gsap.timeline({
      onComplete: () => {
        // Preloader complete - end on last slide (index 4, slide 5) so distortion can continue
        const finalIndex = slideCount - 1; // Last slide (slide 5)
        currentIndex = finalIndex;
        nextIndex = 0; // Next transition will go to slide 1
        
        // Reset all slides to proper state for transitions
        // The last slide (slide 5) stays visible, others are reset for smooth transitions
        slides.forEach((sprite, index) => {
          // Reset sprite completely - clear any animation state
          sprite.scale.set(1, 1);
          sprite.anchor.set(0.5);
          
          // Re-fit sprite to screen to ensure correct sizing
          // This recalculates based on texture and screen size
          const tex = sprite.texture;
          if (tex?.width && tex?.height) {
            const scale = Math.max(app.screen.width / tex.width, app.screen.height / tex.height);
            sprite.width = tex.width * scale;
            sprite.height = tex.height * scale;
          }
          
          sprite.position.set(app.screen.width / 2, app.screen.height / 2);
          sprite.filters = null;
          
          if (index === finalIndex) {
            // Last slide (slide 5) is visible - this is where we ended
            sprite.alpha = 1;
          } else {
            // All other slides are hidden and reset for smooth transitions
            sprite.alpha = 0;
          }
        });
        
        if (useSplitTextAnimations) {
          Object.keys(textWordRegistry).forEach((key) => {
            const registry = textWordRegistry[key];
            if (registry && registry.wordNodes) {
              registry.wordNodes.forEach((node, i) => {
                node.classList.toggle('is-active', i === currentIndex);
              });
              registry.activeIndex = currentIndex;
            }
          });
          if (textWordRegistry['pagination']) updatePaginationNumbers(currentIndex);
        } else {
          updateTextContent(currentIndex, 1);
        }
        updateLinkBlock(currentIndex);
        updateCursorText(currentIndex);
        
        // Store in sessionStorage
        sessionStorage.setItem(preloaderStorageKey, 'true');
        
        // Mark preloader as complete
        preloaderActive = false;
        preloaderComplete = true;
      }
    });

    // Ensure all sprites are at correct size before preloader
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2;
    const startY = centerY + (app.screen.height * 1.01); // yPercent 101
    
    // Prepare sprites for animation - start at 0 width/height
    slides.forEach((sprite, index) => {
      // Use the original fitted dimensions that were stored when sprites were first created
      // Don't overwrite them - they should already be stored from line 171-172
      
      // Set initial size to 0 and position below screen
      sprite.width = 0;
      sprite.height = 0;
      sprite.scale.set(1, 1);
      sprite.alpha = 0;
      sprite.position.set(centerX, startY);
    });
    
    // Show each slide one by one with fade and scale animation
    // Start from index 0 (slide 1) and go through all slides in order, ending at index 4 (slide 5)
    for (let i = 0; i < slideCount; i++) {
      const slideIndex = i;
      // Calculate start time with slight overlap
      const startTime = i * (preloaderDuration - preloaderOverlap);
      const sprite = slides[slideIndex];
      
      // Animate sprite from width/height 0 to original, moving from yPercent 101 to center
      // Use PixiPlugin if available, otherwise fallback to manual animation
      if (typeof PixiPlugin !== 'undefined' && gsap && gsap.plugins && gsap.plugins.PixiPlugin) {
        // Use PixiPlugin for direct PIXI property animation
        preloaderTimeline
          .set(sprite, { 
            pixi: { alpha: 1, width: 0, height: 0, y: startY }
          }, startTime)
          .to(sprite, {
            pixi: { 
              width: sprite.originalFittedWidth, 
              height: sprite.originalFittedHeight,
              y: centerY
            },
            duration: preloaderDuration,
            ease: 'power2.out'
          }, startTime)
          // Update text content when slide animation starts
          .call(() => {
            if (useSplitTextAnimations) {
              Object.keys(textWordRegistry).forEach((key) => {
                const registry = textWordRegistry[key];
                if (registry && registry.wordNodes) {
                  registry.wordNodes.forEach((node, idx) => {
                    node.classList.toggle('is-active', idx === slideIndex);
                  });
                  registry.activeIndex = slideIndex;
                }
              });
              if (textWordRegistry['pagination']) updatePaginationNumbers(slideIndex);
            } else {
              updateTextContent(slideIndex, 1);
            }
            updateLinkBlock(slideIndex);
            updateCursorText(slideIndex);
          }, null, startTime);
      } else {
        // Fallback: use custom properties with onUpdate
        sprite.preloaderWidth = 0;
        sprite.preloaderHeight = 0;
        sprite.preloaderY = startY;
        preloaderTimeline
          .set(sprite, { 
            alpha: 1,
            preloaderWidth: 0,
            preloaderHeight: 0,
            preloaderY: startY
          }, startTime)
          .to(sprite, {
            preloaderWidth: sprite.originalFittedWidth,
            preloaderHeight: sprite.originalFittedHeight,
            preloaderY: centerY,
            duration: preloaderDuration,
            ease: 'power2.out',
            onUpdate: function() {
              sprite.width = sprite.preloaderWidth;
              sprite.height = sprite.preloaderHeight;
              sprite.position.y = sprite.preloaderY;
            }
          }, startTime)
          // Move this slide to the top when it starts (so it appears above previous ones)
          .call(() => {
            // Move to top of stage (highest z-index)
            app.stage.setChildIndex(sprite, app.stage.children.length - 1);
          }, null, startTime)
          // Update text content when slide animation starts
          .call(() => {
            if (useSplitTextAnimations) {
              Object.keys(textWordRegistry).forEach((key) => {
                const registry = textWordRegistry[key];
                if (registry && registry.wordNodes) {
                  registry.wordNodes.forEach((node, idx) => {
                    node.classList.toggle('is-active', idx === slideIndex);
                  });
                  registry.activeIndex = slideIndex;
                }
              });
              if (textWordRegistry['pagination']) updatePaginationNumbers(slideIndex);
            } else {
              updateTextContent(slideIndex, 1);
            }
            updateLinkBlock(slideIndex);
            updateCursorText(slideIndex);
          }, null, startTime);
      }
    }
  };

  // Initialize: run preloader or start normally
  runPreloader();

  const beginTransition = (step = 1) => {
    // Don't allow transitions during preloader
    if (preloaderActive || !preloaderComplete) return;
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

    // Don't run normal interactions during preloader
    if (preloaderActive || !preloaderComplete) {
      return;
    }

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
    // Don't allow scroll transitions during preloader
    if (preloaderActive || !preloaderComplete) return;
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
