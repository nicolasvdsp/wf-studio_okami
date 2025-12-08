function initDynamicCustomTextCursor() {  
    let cursorItem = document.querySelector(".cursor");
    let cursorParagraph = cursorItem.querySelector("p");
    let targets = document.querySelectorAll("[data-cursor]");
    let xOffset = 10;
    let yOffset = -35;
    let cursorIsOnRight = false;
    let currentTarget = null;
    let lastText = '';
  
    // Position cursor relative to actual cursor position on page load
    gsap.set(cursorItem, { xPercent: xOffset, yPercent: yOffset });
  
    // Use GSAP quick.to for a more performative tween on the cursor
    let xTo = gsap.quickTo(cursorItem, "x", { ease: "power3" });
    let yTo = gsap.quickTo(cursorItem, "y", { ease: "power3" });
  
    // Function to get the width of the cursor element including a buffer
    const getCursorEdgeThreshold = () => {
      return cursorItem.offsetWidth + 16; // Cursor width + 16px margin
    };
  
    // On mousemove, call the quickTo functions to the actual cursor position
    window.addEventListener("mousemove", e => {
      let windowWidth = window.innerWidth;
      let windowHeight = window.innerHeight;
      let scrollY = window.scrollY;
      let cursorX = e.clientX;
      let cursorY = e.clientY + scrollY; // Adjust cursorY to account for scroll

      // Default offsets
      let xPercent = xOffset;
      let yPercent = yOffset;

      // Adjust X offset dynamically based on cursor width
      let cursorEdgeThreshold = getCursorEdgeThreshold();
      
      // Check if current target has data-cursor-this-edge attribute
      let useElementBounds = currentTarget && currentTarget.hasAttribute("data-cursor-this-edge");
      
      if (useElementBounds) {
        // Use element boundaries for edge detection
        let elementRect = currentTarget.getBoundingClientRect();
        let elementRight = elementRect.right;
        let elementBottom = elementRect.bottom + scrollY;
        let elementLeft = elementRect.left;
        let elementTop = elementRect.top + scrollY;
        
        // Check if cursor is near the right edge of the element
        if (cursorX > elementRight - cursorEdgeThreshold) {
          cursorIsOnRight = true;
          xPercent = -100;
        } else {
          cursorIsOnRight = false;
        }
        
        // Check if cursor is near the bottom edge of the element (bottom 10%)
        let elementHeight = elementRect.height;
        if (cursorY > elementBottom - elementHeight * 0.1) {
          yPercent = -120;
        }
      } else {
        // Use window boundaries for edge detection (original behavior)
        if (cursorX > windowWidth - cursorEdgeThreshold) {
          cursorIsOnRight = true;
          xPercent = -100;
        } else {
          cursorIsOnRight = false;
        }

        // Adjust Y offset if in the bottom 10% of the current viewport
        if (cursorY > scrollY + windowHeight * 0.9) {
          yPercent = -120;
        }
      }
  
      if (currentTarget) {
        let newText = currentTarget.getAttribute("data-cursor");
        if (newText !== lastText) { // Only update if the text is different
          cursorParagraph.innerHTML = newText;
          lastText = newText;
  
          // Recalculate edge awareness whenever the text changes
          cursorEdgeThreshold = getCursorEdgeThreshold();
        }
      }
  
      gsap.to(cursorItem, { xPercent: xPercent, yPercent: yPercent, duration: 0.9, ease: "power3" });
      xTo(cursorX);
      yTo(cursorY - scrollY);
    });
  
    // Add a mouse enter listener for each link that has a data-cursor attribute
    targets.forEach(target => {
      target.addEventListener("mouseenter", () => {
        currentTarget = target; // Set the current target

        let newText = target.getAttribute("data-cursor");

        // Update only if the text changes
        if (newText !== lastText) {
          cursorParagraph.innerHTML = newText;
          lastText = newText;

          // Recalculate edge awareness whenever the text changes
          let cursorEdgeThreshold = getCursorEdgeThreshold();
        }
      });
      
      target.addEventListener("mouseleave", () => {
        currentTarget = null; // Clear the current target when mouse leaves
        cursorParagraph.innerHTML = ''; // Clear the cursor text
        lastText = '';
      });
    });
  }
  
  // Initialize Dynamic Text Cursor (Edge Aware)
  document.addEventListener('contentload', initDynamicCustomTextCursor);
initDynamicCustomTextCursor();