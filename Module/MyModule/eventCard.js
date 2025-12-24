class EventCard {
    // Constants
    static CONSTANTS = {
        BASE_CARD_WIDTH: 205,
        BASE_WIDTH: 195,
        BASE_HEIGHT: 208,
        CORNER_RADIUS: 13,
        TAB_WIDTH: 65,
        TAB_HEIGHT: 26,
        INVERTED_CORNER_RADIUS: 13,
        TITLE_THRESHOLD_LENGTH: 20,
        FONT_FAMILY: 'OpenSans, Arial, sans-serif',
        ANIMATION_STYLE_ID: 'eventCardTitleAnimation',
        BLUR_MASK: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)'
    };

    // Priority color mapping
    static PRIORITY_COLORS = {
        high: { text: '#ff1d25', bg: 'rgba(255, 29, 37, 0.25)' },
        basic: { text: '#b8e84c', bg: 'rgba(184, 232, 76, 0.25)' },
        low: { text: '#60289b', bg: 'rgba(96, 40, 155, 0.25)' }
    };

    constructor(width = 205, height = 110, options = {}) {
        // Calculate scale from width
        this.scale = width / EventCard.CONSTANTS.BASE_CARD_WIDTH;
        
        // Base dimensions
        this.baseWidth = EventCard.CONSTANTS.BASE_WIDTH;
        this.baseHeight = EventCard.CONSTANTS.BASE_HEIGHT;
        this.baseCardWidth = EventCard.CONSTANTS.BASE_CARD_WIDTH;
        this.baseCardHeight = height;
        this.width = EventCard.CONSTANTS.BASE_CARD_WIDTH * this.scale;
        this.height = height * this.scale;
        this.cornerRadius = EventCard.CONSTANTS.CORNER_RADIUS;
        this.invertedCornerRadius = EventCard.CONSTANTS.INVERTED_CORNER_RADIUS;
        
        // Initialize properties from options with defaults
        this._initializeProperties(options);
        
        // Cache for DOM elements and calculations
        this._cache = {
            textMeasureElement: null,
            animationStyleElement: null,
            scaledValues: {}
        };
    }

    /**
     * Initialize all properties from options
     */
    _initializeProperties(options) {
        // Icon properties
        this.iconSize = options.iconSize ?? 16;
        this.iconOffsetX = 7;
        this.iconOffsetY = 7;
        this.iconScale = options.iconScale ?? 1.3;
        this.iconCornerRadiusSpacing = 10;
        this.iconElement = null;
        
        // Title and time
        this.title = options.title ?? 'Name Of The Event';
        this.time = options.time ?? '10,30';
        this.titleElement = null;
        this.titleContainer = null;
        this.timeElement = null;
        
        // Priority
        this.priority = options.priority ?? 'High';
        this.priorityElement = null;
        
        // Completion
        this.isComplete = options.isComplete ?? false;
        this.checkmarkElement = null;
        this.checkmarkOffsetX = 8;
        this.checkmarkOffsetY = 33;
        
        // XP
        this.xp = options.xp ?? 10;
        this.xpElement = null;
        this.xpNumberElement = null;
        this.xpTextElement = null;
        this.xpOffsetX = 8;
        this.xpOffsetY = 3;
        
        // Progress bars
        const progressBarValues = Array.isArray(options.progressBar) ? options.progressBar : [];
        this.showProgressBar1 = progressBarValues.length >= 1;
        this.showProgressBar2 = progressBarValues.length >= 2;
        this.progressBar1Value = progressBarValues[0] ?? 100;
        this.progressBar2Value = progressBarValues[1] ?? 100;
        this.progressBar1Color = options.progressBar1Color ?? '#b8e84c';
        this.progressBar2Color = options.progressBar2Color ?? '#ff8c00';
        this.progressBar1Element = null;
        this.progressBar1Background = null;
        this.progressBar1Label = null;
        this.progressBar2Element = null;
        this.progressBar2Background = null;
        this.progressBar2Label = null;
        this.progressBarContainer = null;
        this.progressBarWidth = options.progressBarWidth ?? 75;
        this.progressBarHeight = options.progressBarHeight ?? 6;
        this.progressBarOffsetX = -108;
        this.progressBarOffsetY = -3;
        this.progressBarGap = options.progressBarGap ?? 0;
    }

    /**
     * Get or create cached text measurement element
     */
    _getTextMeasureElement() {
        if (!this._cache.textMeasureElement) {
            this._cache.textMeasureElement = document.createElement('span');
            this._cache.textMeasureElement.style.position = 'absolute';
            this._cache.textMeasureElement.style.visibility = 'hidden';
            this._cache.textMeasureElement.style.whiteSpace = 'nowrap';
            this._cache.textMeasureElement.style.fontFamily = EventCard.CONSTANTS.FONT_FAMILY;
            this._cache.textMeasureElement.style.fontWeight = 'bold';
            document.body.appendChild(this._cache.textMeasureElement);
        }
        return this._cache.textMeasureElement;
    }

    /**
     * Measure text width efficiently
     */
    _measureTextWidth(text, fontSize) {
        const measureEl = this._getTextMeasureElement();
        measureEl.style.fontSize = `${fontSize}px`;
        measureEl.textContent = text;
        return measureEl.offsetWidth;
    }

    /**
     * Get or create animation style element
     */
    _getAnimationStyleElement() {
        if (!this._cache.animationStyleElement) {
            let styleElement = document.getElementById(EventCard.CONSTANTS.ANIMATION_STYLE_ID);
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = EventCard.CONSTANTS.ANIMATION_STYLE_ID;
                document.head.appendChild(styleElement);
            }
            this._cache.animationStyleElement = styleElement;
        }
        return this._cache.animationStyleElement;
    }

    /**
     * Update title animation
     */
    _updateTitleAnimation(textWidth, containerWidth) {
        const scrollDistance = textWidth - containerWidth;
        const animationDuration = Math.max(3, scrollDistance / 50);
        const styleElement = this._getAnimationStyleElement();
        
        styleElement.textContent = `
            @keyframes scrollTitle {
                0% { transform: translateX(0); }
                50% { transform: translateX(-${scrollDistance}px); }
                100% { transform: translateX(0); }
            }
        `;
        
        // Reset and restart animation
        this.titleElement.style.animation = 'none';
        void this.titleElement.offsetWidth; // Force reflow
        this.titleElement.style.animation = `scrollTitle ${animationDuration}s ease-in-out infinite`;
    }

    /**
     * Apply common text styles
     */
    _applyTextStyles(element, fontSize, color = '#FFFFFF', fontWeight = 'bold') {
        element.style.fontSize = `${fontSize * this.scale}px`;
        element.style.fontFamily = EventCard.CONSTANTS.FONT_FAMILY;
        element.style.fontWeight = fontWeight;
        element.style.color = color;
    }

    /**
     * Remove element safely
     */
    _removeElement(element) {
        if (element?.parentNode) {
            element.remove();
        }
    }

    /**
     * Calculate clip-path coordinates
     */
    getClipPath() {
        const s = this.scale;
        const cr = this.cornerRadius * s;
        const icr = this.invertedCornerRadius * s;
        
        const startX = 13 * s;
        const tabEndX = 65 * s;
        const tabCurveX = 78 * s;
        const tabCurveY = 13 * s;
        const invertedEndX = 91 * s;
        const invertedEndY = 26 * s;
        const bodyStartX = invertedEndX;
        const bodyStartY = invertedEndY;
        const bodyEndX = this.width - cr;
        const topRightX = this.width;
        const topRightY = bodyStartY + cr;
        const rightSideBottomY = this.height - cr;
        const bottomRightX = this.width - cr;
        const bottomRightY = this.height;
        const bottomLeftCornerStartX = startX;
        const leftBottomX = 0;
        const leftBottomY = this.height - cr;
        const leftTopY = 13 * s;
        
        return `M${startX},0H${tabEndX}A${icr},${icr} 0,0,1 ${tabCurveX},${tabCurveY}V${tabCurveY}A${icr},${icr} 0,0,0 ${bodyStartX},${bodyStartY}H${bodyEndX}A${cr},${cr} 0,0,1 ${topRightX},${topRightY}V${rightSideBottomY}A${cr},${cr} 0,0,1 ${bottomRightX},${bottomRightY}H${bottomLeftCornerStartX}A${cr},${cr} 0,0,1 ${leftBottomX},${leftBottomY}V${leftTopY}A${cr},${cr} 0,0,1 ${startX},0Z`;
    }

    setInternalHeight(height) {
        this.baseCardHeight = height;
        this.height = height * this.scale;
        this.updateIcon();
    }
    
    setDimensions(width, height) {
        this.baseCardWidth = EventCard.CONSTANTS.BASE_CARD_WIDTH;
        this.baseCardHeight = height;
        this.scale = width / EventCard.CONSTANTS.BASE_CARD_WIDTH;
        this.width = EventCard.CONSTANTS.BASE_CARD_WIDTH * this.scale;
        this.height = height * this.scale;
        this._updateAll();
    }

    setScale(scale) {
        this.scale = scale;
        this.width = EventCard.CONSTANTS.BASE_CARD_WIDTH * this.scale;
        this.height = this.baseCardHeight * this.scale;
        this._updateAll();
    }

    /**
     * Update all components
     */
    _updateAll() {
        this.updateIcon();
        this.updateXP();
        this.updateTitleAndTime();
        this.updatePriority();
        this.updateCheckmark();
        this.updateProgressBars();
    }

    /**
     * Apply the shape to a DOM element
     */
    applyToElement(element) {
        if (!element) return;
        
        element.innerHTML = '';
        element.style.width = `${this.width}px`;
        element.style.height = `${this.height}px`;
        element.style.clipPath = `path("${this.getClipPath()}")`;
        element.style.position = 'relative';
        element.style.overflow = 'visible';
        
        // Apply all components
        this.applyIcon(element);
        this.applyXP(element);
        this.applyTitleAndTime(element);
        this.applyPriority(element);
        this.applyCheckmark(element);
        this.applyProgressBars(element);
    }
    
    /**
     * Apply icon
     */
    applyIcon(cardElement) {
        if (!cardElement) return;
        
        this._removeElement(this.iconElement);
        
        const iconSize = this.iconSize * this.scale * this.iconScale;
        const iconOffsetX = this.iconOffsetX * this.scale;
        const iconOffsetY = this.iconOffsetY * this.scale;
        const iconCornerRadius = (this.cornerRadius - this.iconCornerRadiusSpacing) * this.scale * this.iconScale;
        
        this.iconElement = document.createElement('div');
        this.iconElement.className = 'event-card-icon';
        Object.assign(this.iconElement.style, {
            position: 'absolute',
            left: `${iconOffsetX}px`,
            top: `${iconOffsetY}px`,
            width: `${iconSize}px`,
            height: `${iconSize}px`,
            borderRadius: `${iconCornerRadius}px`,
            backgroundColor: '#b8e84c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${8 * this.scale * this.iconScale}px`,
            color: '#000000',
            fontWeight: 'bold',
            fontFamily: EventCard.CONSTANTS.FONT_FAMILY,
            zIndex: '10'
        });
        this.iconElement.textContent = 'icon';
        cardElement.appendChild(this.iconElement);
    }
    
    updateIcon() {
        if (!this.iconElement) return;
        
            const iconSize = this.iconSize * this.scale * this.iconScale;
            const iconOffsetX = this.iconOffsetX * this.scale;
            const iconOffsetY = this.iconOffsetY * this.scale;
            const iconCornerRadius = (this.cornerRadius - this.iconCornerRadiusSpacing) * this.scale * this.iconScale;
            
        Object.assign(this.iconElement.style, {
            left: `${iconOffsetX}px`,
            top: `${iconOffsetY}px`,
            width: `${iconSize}px`,
            height: `${iconSize}px`,
            borderRadius: `${iconCornerRadius}px`,
            fontSize: `${8 * this.scale * this.iconScale}px`
        });
    }
    
    setIconSize(size) {
        this.iconSize = size;
        this.updateIcon();
    }
    
    setIconScale(scale) {
        this.iconScale = scale;
        this.updateIcon();
    }
    
    /**
     * Apply XP
     */
    applyXP(cardElement) {
        if (!cardElement) return;
        
        this._removeElement(this.xpElement);
        
        const iconSize = this.iconSize * this.scale * this.iconScale;
        const iconOffsetX = this.iconOffsetX * this.scale;
        const iconOffsetY = this.iconOffsetY * this.scale;
        
        this.xpElement = document.createElement('div');
        this.xpElement.className = 'event-card-xp';
        Object.assign(this.xpElement.style, {
            position: 'absolute',
            left: `${iconOffsetX + iconSize + (this.xpOffsetX * this.scale)}px`,
            top: `${iconOffsetY + (this.xpOffsetY * this.scale)}px`,
            display: 'flex',
            alignItems: 'baseline',
            gap: `${2 * this.scale}px`,
            zIndex: '10'
        });
        
        this.xpNumberElement = document.createElement('span');
        this.xpNumberElement.className = 'event-card-xp-number';
        this.xpNumberElement.textContent = `${this.xp}`;
        this._applyTextStyles(this.xpNumberElement, 16, '#b8e84c');
        this.xpNumberElement.style.lineHeight = '1';
        
        this.xpTextElement = document.createElement('span');
        this.xpTextElement.className = 'event-card-xp-text';
        this.xpTextElement.textContent = 'XP';
        this._applyTextStyles(this.xpTextElement, 8, '#b8e84c');
        this.xpTextElement.style.lineHeight = '1';
        
        this.xpElement.appendChild(this.xpNumberElement);
        this.xpElement.appendChild(this.xpTextElement);
        cardElement.appendChild(this.xpElement);
    }
    
    updateXP() {
        if (!this.xpElement) return;
        
            const iconSize = this.iconSize * this.scale * this.iconScale;
            const iconOffsetX = this.iconOffsetX * this.scale;
            const iconOffsetY = this.iconOffsetY * this.scale;
            
            this.xpElement.style.left = `${iconOffsetX + iconSize + (this.xpOffsetX * this.scale)}px`;
            this.xpElement.style.top = `${iconOffsetY + (this.xpOffsetY * this.scale)}px`;
            this.xpElement.style.gap = `${2 * this.scale}px`;
            
            if (this.xpNumberElement) {
                this.xpNumberElement.style.fontSize = `${16 * this.scale}px`;
            }
            if (this.xpTextElement) {
                this.xpTextElement.style.fontSize = `${8 * this.scale}px`;
        }
    }
    
    setXP(xp) {
        this.xp = xp;
        if (this.xpNumberElement) {
            this.xpNumberElement.textContent = `${xp}`;
        }
    }
    
    /**
     * Apply title and time
     */
    applyTitleAndTime(cardElement) {
        if (!cardElement) return;
        
        this._removeElement(this.titleContainer);
        this._removeElement(this.timeElement);
        
        // Create title container
        this.titleContainer = document.createElement('div');
        this.titleContainer.className = 'event-card-title-container';
        const titleLeft = 7 * this.scale;
        const titleRight = 15 * this.scale;
        Object.assign(this.titleContainer.style, {
            position: 'absolute',
            left: `${titleLeft}px`,
            top: `${40 * this.scale}px`,
            right: `${titleRight}px`,
            height: `${14 * this.scale * 1.2}px`,
            overflow: 'hidden',
            zIndex: '10'
        });
        
        // Create title element
        this.titleElement = document.createElement('div');
        this.titleElement.className = 'event-card-title';
        this.titleElement.textContent = this.title;
        Object.assign(this.titleElement.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            color: '#FFFFFF',
            fontSize: `${14 * this.scale}px`,
            fontWeight: 'bold',
            fontFamily: EventCard.CONSTANTS.FONT_FAMILY,
            lineHeight: '1.2',
            whiteSpace: 'nowrap'
        });
        
        this.titleContainer.appendChild(this.titleElement);
        
        // Check if title needs animation
        const textWidth = this._measureTextWidth(this.title, 14 * this.scale);
        const containerWidth = this.width - titleLeft - titleRight;
        const isTooLong = this.title.length >= EventCard.CONSTANTS.TITLE_THRESHOLD_LENGTH || textWidth > containerWidth;
        
        if (isTooLong) {
            this.titleContainer.style.maskImage = EventCard.CONSTANTS.BLUR_MASK;
            this.titleContainer.style.webkitMaskImage = EventCard.CONSTANTS.BLUR_MASK;
            this._updateTitleAnimation(textWidth, containerWidth);
        } else {
            this.titleContainer.style.maskImage = 'none';
            this.titleContainer.style.webkitMaskImage = 'none';
        }
        
        // Create time element
        this.timeElement = document.createElement('div');
        this.timeElement.className = 'event-card-time';
        this.timeElement.textContent = this.formatTime(this.time);
        Object.assign(this.timeElement.style, {
            position: 'absolute',
            left: `${titleLeft}px`,
            top: `${60 * this.scale}px`,
            right: `${titleRight}px`,
            color: '#CCCCCC',
            fontSize: `${11 * this.scale}px`,
            fontFamily: EventCard.CONSTANTS.FONT_FAMILY,
            zIndex: '10',
            lineHeight: '1.2'
        });
        
        cardElement.appendChild(this.titleContainer);
        cardElement.appendChild(this.timeElement);
    }
    
    updateTitleAndTime() {
        if (this.titleContainer && this.titleElement) {
            const titleLeft = 7 * this.scale;
            const titleRight = 15 * this.scale;
            
            Object.assign(this.titleContainer.style, {
                left: `${titleLeft}px`,
                top: `${40 * this.scale}px`,
                right: `${titleRight}px`,
                height: `${14 * this.scale * 1.2}px`
            });
            
            this.titleElement.style.fontSize = `${14 * this.scale}px`;
            
            const textWidth = this._measureTextWidth(this.title, 14 * this.scale);
            const containerWidth = this.width - titleLeft - titleRight;
            const isTooLong = this.title.length >= EventCard.CONSTANTS.TITLE_THRESHOLD_LENGTH || textWidth > containerWidth;
            
            if (isTooLong) {
                this.titleContainer.style.maskImage = EventCard.CONSTANTS.BLUR_MASK;
                this.titleContainer.style.webkitMaskImage = EventCard.CONSTANTS.BLUR_MASK;
                this._updateTitleAnimation(textWidth, containerWidth);
            } else {
                this.titleContainer.style.maskImage = 'none';
                this.titleContainer.style.webkitMaskImage = 'none';
                this.titleElement.style.animation = 'none';
            }
        }
        
        if (this.timeElement) {
            const titleLeft = 7 * this.scale;
            const titleRight = 15 * this.scale;
            this.timeElement.textContent = this.formatTime(this.time);
            Object.assign(this.timeElement.style, {
                left: `${titleLeft}px`,
                top: `${60 * this.scale}px`,
                right: `${titleRight}px`,
                fontSize: `${11 * this.scale}px`
            });
        }
    }
    
    setTitle(title) {
        this.title = title;
        if (this.titleElement) {
            this.titleElement.textContent = title;
            if (this.titleContainer?.parentNode) {
                this.applyTitleAndTime(this.titleContainer.parentNode);
            }
        }
    }
    
    formatTime(time) {
        if (!time) return 'from 10 to 30';
        const lower = time.toLowerCase();
        if (lower.includes('from') && lower.includes('to')) return time;
        if (lower.includes('begin at')) return time;
        
        const parts = time.split(',');
        if (parts.length >= 2) {
            return `from ${parts[0].trim()} to ${parts[1].trim()}`;
        }
        return `begin at ${time.trim()}`;
    }
    
    setTime(time) {
        this.time = time;
        if (this.timeElement) {
            this.timeElement.textContent = this.formatTime(time);
        }
    }
    
    /**
     * Apply priority - creates element only if it doesn't exist
     */
    applyPriority(cardElement) {
        if (!cardElement) return;
        
        // Create element only if it doesn't exist or was removed from DOM
        if (!this.priorityElement || !this.priorityElement.parentNode) {
            if (this.priorityElement && !this.priorityElement.parentNode) {
                // Element exists but was removed from DOM, just re-append it
                cardElement.appendChild(this.priorityElement);
            } else {
                // Create new element
        this.priorityElement = document.createElement('div');
        this.priorityElement.className = 'event-card-priority';
                cardElement.appendChild(this.priorityElement);
            }
        }
        
        // Always update content and styles to ensure consistency
        this.priorityElement.textContent = this.priority;
        this._updatePriorityStyles();
        this.updatePriorityColors();
    }
    
    /**
     * Update priority styles (position, size, etc.)
     * Always applies all styles to ensure consistent sizing
     */
    _updatePriorityStyles() {
        if (!this.priorityElement) return;
        
        const priorityOffset = 7 * this.scale;
        const priorityHeight = (10 * this.scale) + (2 * this.scale);
        // Set a fixed width to ensure consistent background size regardless of text length
        // Calculate based on the longest priority text ("Basic" is longest with 5 chars)
        const minWidth = 50 * this.scale; // Fixed width to accommodate longest text
        
        // Always set all styles to ensure consistent size
        Object.assign(this.priorityElement.style, {
            position: 'absolute',
            right: `${priorityOffset}px`,
            bottom: `${priorityOffset}px`,
            padding: `${1 * this.scale}px ${12 * this.scale}px`,
            fontSize: `${10 * this.scale}px`,
            fontWeight: 'bold',
            fontFamily: EventCard.CONSTANTS.FONT_FAMILY,
            borderRadius: `${priorityHeight / 2}px`,
            zIndex: '10',
            lineHeight: '1.2',
            whiteSpace: 'nowrap',
            // Set fixed width to ensure consistent background size
            width: `${minWidth}px`,
            textAlign: 'center',
            // Ensure box-sizing for consistent sizing
            boxSizing: 'border-box'
        });
    }
    
    updatePriority() {
        if (!this.priorityElement) return;
        this._updatePriorityStyles();
            this.updatePriorityColors();
    }
    
    updatePriorityColors() {
        if (!this.priorityElement) return;
        
        const priority = this.priority.toLowerCase();
        const colors = EventCard.PRIORITY_COLORS[priority] || EventCard.PRIORITY_COLORS.high;
        
        // Only update color properties, not the entire element
        this.priorityElement.style.color = colors.text;
        this.priorityElement.style.backgroundColor = colors.bg;
    }
    
    setPriority(priority) {
        this.priority = priority;
        if (this.priorityElement) {
            // Only update text and colors, element stays the same
            this.priorityElement.textContent = priority;
            this.updatePriorityColors();
        }
    }
    
    /**
     * Apply checkmark
     */
    applyCheckmark(cardElement) {
        if (!cardElement) return;
        
        this._removeElement(this.checkmarkElement);
        
        this.checkmarkElement = document.createElement('div');
        this.checkmarkElement.className = 'event-card-checkmark';
        const checkmarkSize = 12 * this.scale;
        
        Object.assign(this.checkmarkElement.style, {
            position: 'absolute',
            right: `${this.checkmarkOffsetX * this.scale}px`,
            top: `${this.checkmarkOffsetY * this.scale}px`,
            width: `${checkmarkSize}px`,
            height: `${checkmarkSize}px`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10',
            backgroundColor: this.isComplete ? 'rgba(184, 232, 76, 0.25)' : 'rgba(255, 255, 255, 0.25)'
        });
        
        if (this.isComplete) {
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-check';
            icon.style.color = '#b8e84c';
            icon.style.fontSize = `${8 * this.scale}px`;
            this.checkmarkElement.appendChild(icon);
        }
        
        cardElement.appendChild(this.checkmarkElement);
    }
    
    updateCheckmark() {
        if (!this.checkmarkElement) return;
        
        const checkmarkSize = 12 * this.scale;
        Object.assign(this.checkmarkElement.style, {
            right: `${this.checkmarkOffsetX * this.scale}px`,
            top: `${this.checkmarkOffsetY * this.scale}px`,
            width: `${checkmarkSize}px`,
            height: `${checkmarkSize}px`
        });
        
            const icon = this.checkmarkElement.querySelector('i');
            if (icon) {
                icon.style.fontSize = `${8 * this.scale}px`;
        }
    }
    
    setComplete(isComplete) {
        this.isComplete = isComplete;
        if (this.checkmarkElement?.parentNode) {
            this.applyCheckmark(this.checkmarkElement.parentNode);
        }
    }
    
    /**
     * Create a progress bar (helper method to reduce duplication)
     */
    _createProgressBar(barIndex, value, color, isSingleBar) {
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            display: 'flex',
            alignItems: 'center',
            gap: `${6 * this.scale}px`,
            position: 'relative'
        });
        
            if (isSingleBar) {
                const barHeight = this.progressBarHeight * this.scale;
                const gap = this.progressBarGap * this.scale;
            const labelHeight = 10 * this.scale;
            const wrapperHeight = barHeight + labelHeight;
                const twoBarSpace = (wrapperHeight * 2) + gap;
                const centerOffset = (twoBarSpace / 2) - (wrapperHeight / 2);
            wrapper.style.marginTop = `${centerOffset}px`;
        }
        
        const background = document.createElement('div');
        const barWidth = this.progressBarWidth * this.scale;
        const barHeight = this.progressBarHeight * this.scale;
        const borderRadius = barHeight / 2;
        
        Object.assign(background.style, {
            width: `${barWidth}px`,
            height: `${barHeight}px`,
            backgroundColor: this.hexToRgba(color, 0.25),
            borderRadius: `${borderRadius}px`,
            position: 'relative'
        });
        
        const bar = document.createElement('div');
        const barValueWidth = (barWidth * value) / 100;
        Object.assign(bar.style, {
            width: `${barValueWidth}px`,
            height: `${barHeight}px`,
            backgroundColor: color,
            borderRadius: `${borderRadius}px`,
            position: 'absolute',
            left: '0',
            top: '0'
        });
        
        const label = document.createElement('span');
        label.textContent = `${value}%`;
        Object.assign(label.style, {
            color: '#FFFFFF',
            fontSize: `${10 * this.scale}px`,
            fontFamily: EventCard.CONSTANTS.FONT_FAMILY,
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
        });
        
        background.appendChild(bar);
        wrapper.appendChild(background);
        wrapper.appendChild(label);
        
        return { wrapper, background, bar, label };
    }
    
    /**
     * Apply progress bars
     */
    applyProgressBars(cardElement) {
        if (!cardElement) return;
        
        this._removeElement(this.progressBarContainer);
        
        const parentContainer = cardElement.parentNode;
        if (parentContainer) {
            parentContainer.querySelectorAll('.event-card-progress-container').forEach(c => c.remove());
        }
        
        if (!this.showProgressBar1 && !this.showProgressBar2) return;
        if (!parentContainer) return;
        
        const isSingleBar = (this.showProgressBar1 && !this.showProgressBar2) || (!this.showProgressBar1 && this.showProgressBar2);
        
        this.progressBarContainer = document.createElement('div');
        this.progressBarContainer.className = 'event-card-progress-container';
        Object.assign(this.progressBarContainer.style, {
            position: 'absolute',
            left: `${this.width + (this.progressBarOffsetX * this.scale)}px`,
            top: `${this.progressBarOffsetY * this.scale}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: `${this.progressBarGap * this.scale}px`,
            zIndex: '10',
            alignItems: (this.showProgressBar1 && this.showProgressBar2) ? 'flex-start' : 'center'
        });
        
        if (this.showProgressBar1) {
            const bar1 = this._createProgressBar(1, this.progressBar1Value, this.progressBar1Color, isSingleBar);
            this.progressBar1Background = bar1.background;
            this.progressBar1Element = bar1.bar;
            this.progressBar1Label = bar1.label;
            bar1.background.className = 'event-card-progress-bar-1-background';
            bar1.bar.className = 'event-card-progress-bar-1';
            bar1.label.className = 'event-card-progress-bar-1-label';
            this.progressBarContainer.appendChild(bar1.wrapper);
        }
        
        if (this.showProgressBar2) {
            const bar2 = this._createProgressBar(2, this.progressBar2Value, this.progressBar2Color, isSingleBar);
            this.progressBar2Background = bar2.background;
            this.progressBar2Element = bar2.bar;
            this.progressBar2Label = bar2.label;
            bar2.background.className = 'event-card-progress-bar-2-background';
            bar2.bar.className = 'event-card-progress-bar-2';
            bar2.label.className = 'event-card-progress-bar-2-label';
            this.progressBarContainer.appendChild(bar2.wrapper);
        }
        
        parentContainer.appendChild(this.progressBarContainer);
    }
    
    hexToRgba(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    updateProgressBars() {
        if (!this.progressBarContainer) return;
        
            const isSingleBar = (this.showProgressBar1 && !this.showProgressBar2) || (!this.showProgressBar1 && this.showProgressBar2);
            
        Object.assign(this.progressBarContainer.style, {
            left: `${this.width + (this.progressBarOffsetX * this.scale)}px`,
            top: `${this.progressBarOffsetY * this.scale}px`,
            gap: `${this.progressBarGap * this.scale}px`,
            alignItems: (this.showProgressBar1 && this.showProgressBar2) ? 'flex-start' : 'center'
        });
        
            if (isSingleBar) {
                const barHeight = this.progressBarHeight * this.scale;
                const gap = this.progressBarGap * this.scale;
                const labelHeight = 10 * this.scale;
                const wrapperHeight = barHeight + labelHeight;
                const twoBarSpace = (wrapperHeight * 2) + gap;
                const centerOffset = (twoBarSpace / 2) - (wrapperHeight / 2);
                
                const visibleWrapper = this.showProgressBar1 ? 
                    this.progressBar1Element?.parentElement?.parentElement : 
                    this.progressBar2Element?.parentElement?.parentElement;
                if (visibleWrapper) {
                    visibleWrapper.style.marginTop = `${centerOffset}px`;
                }
            } else {
                const bar1Wrapper = this.progressBar1Element?.parentElement?.parentElement;
                const bar2Wrapper = this.progressBar2Element?.parentElement?.parentElement;
                if (bar1Wrapper) bar1Wrapper.style.marginTop = '0';
                if (bar2Wrapper) bar2Wrapper.style.marginTop = '0';
            }
            
            if (this.showProgressBar1 && this.progressBar1Element && this.progressBar1Background) {
            const barWidth = this.progressBarWidth * this.scale;
            const barHeight = this.progressBarHeight * this.scale;
            const borderRadius = barHeight / 2;
            const barValueWidth = (barWidth * this.progressBar1Value) / 100;
            
            Object.assign(this.progressBar1Background.style, {
                width: `${barWidth}px`,
                height: `${barHeight}px`,
                borderRadius: `${borderRadius}px`,
                backgroundColor: this.hexToRgba(this.progressBar1Color, 0.25)
            });
            
            Object.assign(this.progressBar1Element.style, {
                width: `${barValueWidth}px`,
                height: `${barHeight}px`,
                borderRadius: `${borderRadius}px`
            });
            
                if (this.progressBar1Label) {
                    this.progressBar1Label.textContent = `${this.progressBar1Value}%`;
                    this.progressBar1Label.style.fontSize = `${10 * this.scale}px`;
                }
            }
            
            if (this.showProgressBar2 && this.progressBar2Element && this.progressBar2Background) {
            const barWidth = this.progressBarWidth * this.scale;
            const barHeight = this.progressBarHeight * this.scale;
            const borderRadius = barHeight / 2;
            const barValueWidth = (barWidth * this.progressBar2Value) / 100;
            
            Object.assign(this.progressBar2Background.style, {
                width: `${barWidth}px`,
                height: `${barHeight}px`,
                borderRadius: `${borderRadius}px`,
                backgroundColor: this.hexToRgba(this.progressBar2Color, 0.25)
            });
            
            Object.assign(this.progressBar2Element.style, {
                width: `${barValueWidth}px`,
                height: `${barHeight}px`,
                borderRadius: `${borderRadius}px`
            });
            
                if (this.progressBar2Label) {
                    this.progressBar2Label.textContent = `${this.progressBar2Value}%`;
                    this.progressBar2Label.style.fontSize = `${10 * this.scale}px`;
            }
        }
    }
    
    setProgressBar1Value(value) {
        this.progressBar1Value = Math.max(0, Math.min(100, value));
        if (this.progressBar1Label) {
            this.progressBar1Label.textContent = `${this.progressBar1Value}%`;
        }
        this.updateProgressBars();
    }
    
    setProgressBar2Value(value) {
        this.progressBar2Value = Math.max(0, Math.min(100, value));
        if (this.progressBar2Label) {
            this.progressBar2Label.textContent = `${this.progressBar2Value}%`;
        }
        this.updateProgressBars();
    }
    
    setProgressBar1Color(color) {
        this.progressBar1Color = color;
        if (this.progressBar1Element) {
            this.progressBar1Element.style.backgroundColor = color;
        }
    }
    
    setProgressBar2Color(color) {
        this.progressBar2Color = color;
        if (this.progressBar2Element) {
            this.progressBar2Element.style.backgroundColor = color;
        }
    }
}

