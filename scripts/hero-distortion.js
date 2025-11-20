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

  const listRoot = root.querySelector('[data-hero-distortion-image-list]');
  let cmsSlidesConfig = [];

  if (listRoot) {
    const itemElements = Array.from(
      listRoot.querySelectorAll('[data-hero-distortion-source]')
    );

    cmsSlidesConfig = itemElements
      .map((item) => {
        const videoEl = item.querySelector('[data-hero-distortion-video-source]');
        const imageEl = item.querySelector('[data-hero-distortion-image-source]');

        const videoSrc = extractVideoSrc(videoEl);
        const imageSrc = extractImageSrc(imageEl);

        if (videoSrc) {
          return { type: 'video', src: videoSrc };
        }
        if (imageSrc) {
          return { type: inferSlideType(imageSrc), src: imageSrc };
        }
        return null;
      })
      .filter(Boolean);

    // Legacy fallback: allow direct image elements without wrapper
    if (!cmsSlidesConfig.length) {
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
  }

  const fallbackSlidesConfig = [
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-nosetack_header.mp4' },
    { type: 'image', src: 'https://cdn.prod.website-files.com/69171be02eed206b0102f9b9/69172d804fa7b36d0157d9ac_ruin_house-cover.webp' },
    { type: 'image', src: 'https://cdn.prod.website-files.com/68d14433cd550114f9ff7c1f/691b2bc40cbc606506067271_20251105-DSC05265-2_websize.jpg' },
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-milstack_header.mp4' },
    { type: 'video', src: 'https://the-mothership-collective.s3.eu-north-1.amazonaws.com/case-owlstack_header.mp4' },
  ];

  const slidesConfig = cmsSlidesConfig.length ? cmsSlidesConfig : fallbackSlidesConfig;

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

    if (t >= 1) {
      currentSlide.alpha = 0;
      nextSlide.alpha = 1;

      // Remove filters after transition completes
      currentSlide.filters = null;
      nextSlide.filters = null;

      currentIndex = nextIndex;
      nextIndex = (currentIndex + 1) % slides.length;
      inTransition = false;
    }
  });

  let scrollCooldown = false;

  function triggerScrollTransition(step) {
    if (scrollCooldown) return;
    beginTransition(step);
    scrollCooldown = true;
    setTimeout(() => {
      scrollCooldown = false;
    }, transitionDuration * 1000);
  }

  const wheelTriggerThreshold = 60;
  let wheelDeltaAccumulator = 0;
  let wheelResetTimeout = null;

  window.addEventListener('wheel', (event) => {
    wheelDeltaAccumulator += event.deltaY;

    if (Math.abs(wheelDeltaAccumulator) >= wheelTriggerThreshold) {
      const direction = wheelDeltaAccumulator > 0 ? 1 : -1;
      triggerScrollTransition(direction);
      wheelDeltaAccumulator = 0;
    }

    clearTimeout(wheelResetTimeout);
    wheelResetTimeout = setTimeout(() => {
      wheelDeltaAccumulator = 0;
    }, 200);
  }, { passive: true });

  let lastTouchY = null;

  window.addEventListener('touchstart', (event) => {
    lastTouchY = event.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (event) => {
    if (lastTouchY === null) return;
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

console.log("dev");
initHeroDistortion();