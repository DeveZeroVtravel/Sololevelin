class AnimatedGradient {
    // Default constants
    static CONSTANTS = {
        DEFAULT_DURATION: 50,
        DEFAULT_SIZE: 750,
        DEFAULT_BLUR_RATIO: 5,
        ANIMATION_STYLE_ID: 'animatedGradientStyles',
        DEFAULT_EASING: 'cubic-bezier(0.8, 0.2, 0.2, 0.8)',
        DEFAULT_BACKGROUND_COLOR: '#071c39'
    };

    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        
        if (!this.element) {
            throw new Error('Element not found');
        }

        // Initialize properties from options with defaults
        this._initializeProperties(options);
        
        // Cache for style element
        this._cache = {
            styleElement: null
        };

        // Initialize the gradient
        this._init();
    }

    /**
     * Initialize all properties from options
     */
    _initializeProperties(options) {
        // Colors - user can provide custom colors
        this.colors = options.colors || [
            'hsl(222, 84%, 60%)',
            'hsl(164, 79%, 71%)'
        ];

        // Animation properties
        this.duration = options.duration || AnimatedGradient.CONSTANTS.DEFAULT_DURATION;
        this.size = options.size || AnimatedGradient.CONSTANTS.DEFAULT_SIZE;
        this.blurRatio = options.blurRatio || AnimatedGradient.CONSTANTS.DEFAULT_BLUR_RATIO;
        this.easing = options.easing || AnimatedGradient.CONSTANTS.DEFAULT_EASING;
        
        // Border radius for organic blob shape
        this.borderRadius = options.borderRadius || '30% 70% 70% 30% / 30% 30% 70% 70%';
        
        // Animation direction
        this.direction = options.direction || 'normal'; // 'normal' or 'reverse'
        
        // Whether animation is paused
        this.isPaused = options.isPaused || false;
        
        // Background color - can be a color string or element selector/object
        this.backgroundColor = options.backgroundColor || AnimatedGradient.CONSTANTS.DEFAULT_BACKGROUND_COLOR;
        this.backgroundColorTarget = options.backgroundColorTarget || 'body'; // 'body', element selector, or element object
    }

    /**
     * Get or create animation style element
     */
    _getStyleElement() {
        if (!this._cache.styleElement) {
            let styleElement = document.getElementById(AnimatedGradient.CONSTANTS.ANIMATION_STYLE_ID);
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = AnimatedGradient.CONSTANTS.ANIMATION_STYLE_ID;
                document.head.appendChild(styleElement);
            }
            this._cache.styleElement = styleElement;
        }
        return this._cache.styleElement;
    }

    /**
     * Generate gradient stops string
     */
    _generateGradientStops() {
        if (this.colors.length === 0) {
            return 'hsl(222, 84%, 60%), hsl(164, 79%, 71%)';
        }
        
        if (this.colors.length === 1) {
            return `${this.colors[0]}, ${this.colors[0]}`;
        }
        
        return this.colors.join(', ');
    }

    /**
     * Generate keyframes for rotation animation
     */
    _generateKeyframes(animationId) {
        return `
            @keyframes ${animationId} {
                0% {
                    transform: rotate(0deg);
                }
                100% {
                    transform: rotate(360deg);
                }
            }
        `;
    }

    /**
     * Initialize the gradient
     */
    _init() {
        if (!this.element) return;

        // Set base styles
        this.element.style.position = 'absolute';
        this.element.style.width = `${this.size}px`;
        this.element.style.height = `${this.size}px`;
        this.element.style.filter = `blur(calc(${this.size}px / ${this.blurRatio}))`;
        this.element.style.borderRadius = this.borderRadius;
        
        // Create gradient background
        this._updateGradient();
        
        // Apply background color
        this._applyBackgroundColor();
        
        // Apply animation
        this._applyAnimation();
    }

    /**
     * Apply background color to target element
     */
    _applyBackgroundColor() {
        let targetElement;
        
        if (this.backgroundColorTarget === 'body') {
            targetElement = document.body;
        } else if (typeof this.backgroundColorTarget === 'string') {
            targetElement = document.querySelector(this.backgroundColorTarget);
        } else {
            targetElement = this.backgroundColorTarget;
        }
        
        if (targetElement) {
            targetElement.style.backgroundColor = this.backgroundColor;
        }
    }

    /**
     * Update gradient background
     */
    _updateGradient() {
        if (!this.element) return;

        const gradientStops = this._generateGradientStops();
        this.element.style.backgroundImage = `linear-gradient(${gradientStops})`;
    }

    /**
     * Apply animation
     */
    _applyAnimation() {
        if (!this.element) return;

        const styleElement = this._getStyleElement();
        const uniqueId = `gradientRotate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.animationId = uniqueId;

        // Generate keyframes
        const keyframes = this._generateKeyframes(uniqueId);
        
        // Check if this animation already exists, if not add it
        if (!styleElement.textContent.includes(`@keyframes ${uniqueId}`)) {
            styleElement.textContent += keyframes;
        }

        // Apply animation to element
        const animationDirection = this.direction === 'reverse' ? 'reverse' : 'normal';
        this.element.style.animation = this.isPaused 
            ? 'none' 
            : `${uniqueId} ${this.duration}s ${this.easing} alternate infinite ${animationDirection}`;
    }

    /**
     * Update colors
     */
    setColors(colors) {
        if (!Array.isArray(colors) || colors.length < 1) {
            throw new Error('Colors must be an array with at least 1 color');
        }
        this.colors = colors;
        this._updateGradient();
    }

    /**
     * Add a color
     */
    addColor(color) {
        this.colors.push(color);
        this._updateGradient();
    }

    /**
     * Remove a color by index
     */
    removeColor(index) {
        if (this.colors.length <= 1) {
            throw new Error('Must have at least 1 color');
        }
        this.colors.splice(index, 1);
        this._updateGradient();
    }

    /**
     * Set duration
     */
    setDuration(duration) {
        this.duration = duration;
        this._applyAnimation();
    }

    /**
     * Set size
     */
    setSize(size) {
        this.size = size;
        this.element.style.width = `${this.size}px`;
        this.element.style.height = `${this.size}px`;
        this.element.style.filter = `blur(calc(${this.size}px / ${this.blurRatio}))`;
        this._applyAnimation();
    }

    /**
     * Set blur ratio
     */
    setBlurRatio(ratio) {
        this.blurRatio = ratio;
        this.element.style.filter = `blur(calc(${this.size}px / ${this.blurRatio}))`;
    }

    /**
     * Set easing
     */
    setEasing(easing) {
        this.easing = easing;
        this._applyAnimation();
    }

    /**
     * Set border radius (for organic blob shape)
     */
    setBorderRadius(borderRadius) {
        this.borderRadius = borderRadius;
        this.element.style.borderRadius = this.borderRadius;
    }

    /**
     * Set direction
     */
    setDirection(direction) {
        if (direction !== 'normal' && direction !== 'reverse') {
            throw new Error('Direction must be "normal" or "reverse"');
        }
        this.direction = direction;
        this._applyAnimation();
    }

    /**
     * Set background color
     */
    setBackgroundColor(color) {
        this.backgroundColor = color;
        this._applyBackgroundColor();
    }

    /**
     * Set background color target
     */
    setBackgroundColorTarget(target) {
        this.backgroundColorTarget = target;
        this._applyBackgroundColor();
    }

    /**
     * Pause animation
     */
    pause() {
        this.isPaused = true;
        this._applyAnimation();
    }

    /**
     * Resume animation
     */
    resume() {
        this.isPaused = false;
        this._applyAnimation();
    }

    /**
     * Toggle animation
     */
    toggle() {
        this.isPaused = !this.isPaused;
        this._applyAnimation();
    }

    /**
     * Destroy the gradient and clean up
     */
    destroy() {
        if (this.element) {
            this.element.style.backgroundImage = '';
            this.element.style.animation = '';
            this.element.style.filter = '';
            this.element.style.borderRadius = '';
            this.element.style.width = '';
            this.element.style.height = '';
            this.element.style.position = '';
        }
        
        // Optionally reset background color
        let targetElement;
        if (this.backgroundColorTarget === 'body') {
            targetElement = document.body;
        } else if (typeof this.backgroundColorTarget === 'string') {
            targetElement = document.querySelector(this.backgroundColorTarget);
        } else {
            targetElement = this.backgroundColorTarget;
        }
        
        if (targetElement) {
            targetElement.style.backgroundColor = '';
        }
    }
}
