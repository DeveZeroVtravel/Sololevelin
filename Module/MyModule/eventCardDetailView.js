class EventCardDetailView {
    constructor(options = {}) {
        // Default values
        this.title = options.title ?? 'Name Of The Event';
        this.time = options.time ?? '10.am to 10:30.am';
        this.priority = options.priority ?? 'High';
        this.progressBar1Value = options.progressBar1Value ?? 60;
        this.progressBar2Value = options.progressBar2Value ?? 60;
        this.showProgressBar2 = options.showProgressBar2 !== undefined ? options.showProgressBar2 : true;
        this.description = options.description ?? 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad';
        // Requirements should be an array of objects: [{text: 'Requirement 1', checked: false}, ...]
        this.requirements = Array.isArray(options.requirements) ? options.requirements : 
            (options.requirement ? [{text: options.requirement, checked: options.requirementEnabled ?? false}] : 
            [{text: 'Lorem ipsum dolor sit amet', checked: false}]);
        
        // Callbacks
        this.onBack = options.onBack ?? null;
        this.onClose = options.onClose ?? null;
        this.onComplete = options.onComplete ?? null;
        this.onRequirementToggle = options.onRequirementToggle ?? null;
        this.onDelete = options.onDelete ?? null;
        this.onEdit = options.onEdit ?? null;
        
        // DOM elements
        this.overlay = null;
        this.modal = null;
        this.isVisible = false;
        this.descriptionContainer = null;
        this.requirementSectionContainer = null;
        
        // Swipe tracking
        this.touchStartY = 0;
        this.touchCurrentY = 0;
        this.isDragging = false;
        this.modalHeight = 0;
        
        // Store original body overflow to restore later
        this.originalBodyOverflow = null;
        
        // Create the modal structure
        this._createModal();
        
        // Add swipe functionality
        this._addSwipeHandlers();
    }
    
    /**
     * Create the modal structure (only called once)
     */
    _createModal() {
        // Create overlay (blur background)
        this.overlay = document.createElement('div');
        this.overlay.className = 'event-card-detail-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 9998;
            display: none;
            opacity: 0;
            transition: opacity 0.3s ease-in-out, backdrop-filter 0.3s ease-in-out;
        `;
        
        // Create modal container (phone-like vertical shape)
        this.modal = document.createElement('div');
        this.modal.className = 'event-card-detail-modal';
        this.modal.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%) translateY(100%);
            width: 100%;
            max-width: 414px;
            min-height: 80vh;
            max-height: 90vh;
            background-color: #1a1a1a;
            border-radius: 24px 24px 0 0;
            z-index: 9999;
            display: none;
            flex-direction: column;
            overflow: hidden;
            transition: transform 0.3s ease-out;
            box-sizing: border-box;
        `;
        
        // Create drag handle (horizontal line at top)
        const dragHandle = document.createElement('div');
        dragHandle.className = 'event-card-detail-drag-handle';
        dragHandle.style.cssText = `
            width: 60px;
            height: 4px;
            background-color: #666;
            border-radius: 2px;
            margin: 12px auto 0 auto;
            cursor: grab;
            flex-shrink: 0;
        `;
        
        // Create header
        const header = this._createHeader();
        
        // Create scrollable content wrapper
        const scrollableContent = document.createElement('div');
        scrollableContent.style.cssText = `
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
            position: relative;
            z-index: 1;
        `;
        
        // Hide scrollbar for webkit browsers in scrollable content
        const scrollableStyle = document.createElement('style');
        scrollableStyle.textContent = `
            .event-card-detail-scrollable::-webkit-scrollbar {
                display: none;
            }
        `;
        scrollableContent.className = 'event-card-detail-scrollable';
        document.head.appendChild(scrollableStyle);
        
        // Create content container
        const content = document.createElement('div');
        content.className = 'event-card-detail-content';
        content.style.cssText = `
            padding: 20px;
            padding-bottom: 100px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        `;
        
        // Create event info section
        const eventInfo = this._createEventInfo();
        
        // Create description section (only if description exists)
        let descriptionSection = null;
        if (this.description && this.description.trim() !== '') {
            descriptionSection = this._createDescriptionSection();
        }
        
        // Create requirement section (only if requirements exist)
        let requirementSection = null;
        if (this.requirements && this.requirements.length > 0) {
            requirementSection = this._createRequirementSection();
        }
        
        // Create complete button (fixed at bottom of card)
        const completeButton = this._createCompleteButton();
        
        // Assemble modal
        content.appendChild(eventInfo);
        if (descriptionSection) {
            content.appendChild(descriptionSection);
        }
        if (requirementSection) {
            content.appendChild(requirementSection);
        }
        
        scrollableContent.appendChild(content);
        
        // Create gradient overlay to dim content near complete button
        const gradientOverlay = document.createElement('div');
        gradientOverlay.className = 'event-card-detail-button-gradient';
        gradientOverlay.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 150px;
            pointer-events: none;
            z-index: 100;
            background: linear-gradient(to bottom, 
                transparent 0%,
                rgba(26, 26, 26, 0.6) 30%,
                rgba(26, 26, 26, 0.85) 60%,
                rgba(26, 26, 26, 0.95) 80%,
                rgba(26, 26, 26, 1) 100%
            );
        `;
        
        this.modal.appendChild(dragHandle);
        this.modal.appendChild(header);
        this.modal.appendChild(scrollableContent);
        this.modal.appendChild(gradientOverlay);
        this.modal.appendChild(completeButton);
        
        // Add click handler to overlay to close modal
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });
        
        // Update complete button state after modal is created
        this._updateCompleteButtonState();
    }
    
    /**
     * Add swipe handlers for drag-to-dismiss
     */
    _addSwipeHandlers() {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        
        // Touch start
        const handleTouchStart = (e) => {
            startY = e.touches[0].clientY;
            currentY = startY;
            isDragging = false;
            this.modalHeight = this.modal.offsetHeight;
        };
        
        // Touch move
        const handleTouchMove = (e) => {
            if (!startY) return;
            
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            // Only allow downward swipes
            if (deltaY > 0) {
                isDragging = true;
                // Move modal down as user drags
                const translateY = Math.min(deltaY, this.modalHeight);
                this.modal.style.transform = `translateX(-50%) translateY(${translateY}px)`;
                // Add opacity fade to overlay
                const opacity = 1 - (translateY / this.modalHeight) * 0.5;
                this.overlay.style.opacity = opacity;
            }
        };
        
        // Touch end
        const handleTouchEnd = () => {
            if (!startY) return;
            
            const deltaY = currentY - startY;
            const threshold = this.modalHeight * 0.3; // 30% of modal height to dismiss
            
            if (isDragging && deltaY > threshold) {
                // Swipe down enough - hide modal
                this.hide();
            } else {
                // Not enough swipe - snap back with smooth transition
                this.modal.style.transition = 'transform 0.3s ease-out';
                this.overlay.style.transition = 'opacity 0.3s ease-in-out';
                this.modal.style.transform = 'translateX(-50%) translateY(0)';
                this.overlay.style.opacity = '1';
                
                // Remove transition after animation completes
                setTimeout(() => {
                    this.modal.style.transition = 'transform 0.3s ease-out';
                    this.overlay.style.transition = 'opacity 0.3s ease-in-out, backdrop-filter 0.3s ease-in-out';
                }, 300);
            }
            
            startY = 0;
            currentY = 0;
            isDragging = false;
        };
        
        // Mouse events for desktop drag support
        let mouseStartY = 0;
        let mouseCurrentY = 0;
        let isMouseDragging = false;
        
        const handleMouseDown = (e) => {
            // Only allow dragging from the top area (drag handle or header)
            const headerArea = e.target.closest('.event-card-detail-drag-handle, .event-card-detail-header');
            if (!headerArea) return;
            
            mouseStartY = e.clientY;
            mouseCurrentY = mouseStartY;
            isMouseDragging = false;
            this.modalHeight = this.modal.offsetHeight;
            e.preventDefault();
        };
        
        const handleMouseMove = (e) => {
            if (!mouseStartY) return;
            
            mouseCurrentY = e.clientY;
            const deltaY = mouseCurrentY - mouseStartY;
            
            if (deltaY > 0) {
                isMouseDragging = true;
                const translateY = Math.min(deltaY, this.modalHeight);
                this.modal.style.transform = `translateX(-50%) translateY(${translateY}px)`;
                const opacity = 1 - (translateY / this.modalHeight) * 0.5;
                this.overlay.style.opacity = opacity;
            }
        };
        
        const handleMouseUp = () => {
            if (!mouseStartY) return;
            
            const deltaY = mouseCurrentY - mouseStartY;
            const threshold = this.modalHeight * 0.3;
            
            if (isMouseDragging && deltaY > threshold) {
                this.hide();
            } else {
                // Snap back with smooth transition
                this.modal.style.transition = 'transform 0.3s ease-out';
                this.overlay.style.transition = 'opacity 0.3s ease-in-out';
                this.modal.style.transform = 'translateX(-50%) translateY(0)';
                this.overlay.style.opacity = '1';
                
                // Remove transition after animation completes
                setTimeout(() => {
                    this.modal.style.transition = 'transform 0.3s ease-out';
                    this.overlay.style.transition = 'opacity 0.3s ease-in-out, backdrop-filter 0.3s ease-in-out';
                }, 300);
            }
            
            mouseStartY = 0;
            mouseCurrentY = 0;
            isMouseDragging = false;
        };
        
        // Add event listeners
        this.modal.addEventListener('touchstart', handleTouchStart, { passive: true });
        this.modal.addEventListener('touchmove', handleTouchMove, { passive: true });
        this.modal.addEventListener('touchend', handleTouchEnd, { passive: true });
        
        this.modal.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    
    /**
     * Create header with menu dots
     */
    _createHeader() {
        const header = document.createElement('div');
        header.className = 'event-card-detail-header';
        header.style.cssText = `
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 12px 20px;
            position: relative;
        `;
        
        // Menu dots (right, inside dark area)
        const menuButton = document.createElement('button');
        menuButton.className = 'event-card-detail-menu';
        menuButton.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
        menuButton.style.cssText = `
            background: none;
            border: none;
            color: #fff;
            font-size: 20px;
            cursor: pointer;
            padding: 8px;
            margin: -8px;
            position: relative;
        `;
        
        // Create floating menu
        const floatingMenu = document.createElement('div');
        floatingMenu.className = 'event-card-detail-floating-menu';
        floatingMenu.style.cssText = `
            position: absolute;
            top: 40px;
            right: 10px;
            background-color: #2a2a2a;
            border-radius: 26px;
            padding: 6px;
            min-width: 150px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            display: none;
            z-index: 10001;
            transform-origin: top right;
            animation: slideZoomDown 0.2s ease-out;
        `;
        
        // Add keyframe animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideZoomDown {
                0% {
                    opacity: 0;
                    transform: translateY(-10px) scale(0.95);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
        `;
        if (!document.querySelector('style[data-floating-menu-animation]')) {
            style.setAttribute('data-floating-menu-animation', 'true');
            document.head.appendChild(style);
        }
        
        // Delete option
        const deleteOption = document.createElement('button');
        deleteOption.className = 'event-card-detail-menu-option';
        deleteOption.innerHTML = '<i class="fa-solid fa-trash"></i> Delete Task';
        deleteOption.style.cssText = `
            width: 100%;
            background: none;
            border: none;
            color: #ff4444;
            padding: 12px 16px;
            text-align: left;
            cursor: pointer;
            font-size: 14px;
            font-family: 'OpenSans', Arial, sans-serif;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: background-color 0.2s;
            border-radius: 20px;
        `;
        
        deleteOption.addEventListener('mouseenter', () => {
            deleteOption.style.backgroundColor = 'rgba(255, 68, 68, 0.1)';
        });
        
        deleteOption.addEventListener('mouseleave', () => {
            deleteOption.style.backgroundColor = 'transparent';
        });
        
        deleteOption.addEventListener('click', () => {
            floatingMenu.style.display = 'none';
            if (this.onDelete) {
                this.onDelete();
            } else {
                // Default behavior: hide the modal
                this.hide();
            }
        });
        
        // Edit option
        const editOption = document.createElement('button');
        editOption.className = 'event-card-detail-menu-option';
        editOption.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Task';
        editOption.style.cssText = `
            width: 100%;
            background: none;
            border: none;
            color: #b8e84c;
            padding: 12px 16px;
            text-align: left;
            cursor: pointer;
            font-size: 14px;
            font-family: 'OpenSans', Arial, sans-serif;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: background-color 0.2s;
            border-radius: 20px;
        `;
        
        editOption.addEventListener('mouseenter', () => {
            editOption.style.backgroundColor = 'rgba(184, 232, 76, 0.1)';
        });
        
        editOption.addEventListener('mouseleave', () => {
            editOption.style.backgroundColor = 'transparent';
        });
        
        editOption.addEventListener('click', () => {
            floatingMenu.style.display = 'none';
            if (this.onEdit) {
                this.onEdit();
            }
        });
        
        floatingMenu.appendChild(deleteOption);
        floatingMenu.appendChild(editOption);
        header.appendChild(menuButton);
        header.appendChild(floatingMenu);
        
        // Toggle menu on button click
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            floatingMenu.style.display = floatingMenu.style.display === 'none' ? 'block' : 'none';
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!header.contains(e.target)) {
                floatingMenu.style.display = 'none';
            }
        });
        
        return header;
    }
    
    /**
     * Create event info section (title, time, priority, progress bars)
     */
    _createEventInfo() {
        const container = document.createElement('div');
        container.className = 'event-card-detail-event-info';
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 16px;
        `;
        
        // Title container with mask for fade effect
        const titleContainer = document.createElement('div');
        titleContainer.className = 'event-card-detail-title-container';
        titleContainer.style.cssText = `
            position: relative;
            overflow: hidden;
            max-width: 100%;
            padding: 0 20px;
        `;
        
        // Title
        const title = document.createElement('h1');
        title.className = 'event-card-detail-title';
        title.textContent = this.title;
        title.style.cssText = `
            color: #fff;
            font-size: 24px;
            font-weight: bold;
            font-family: 'OpenSans', Arial, sans-serif;
            margin: 0;
            text-align: center;
            white-space: nowrap;
            display: inline-block;
            width: 100%;
        `;
        
        titleContainer.appendChild(title);
        
        // Check if title is too long and needs animation
        this._checkAndAnimateTitle(title, titleContainer);
        
        // Time
        const time = document.createElement('div');
        time.className = 'event-card-detail-time';
        time.textContent = this.time;
        time.style.cssText = `
            color: #999;
            font-size: 14px;
            font-family: 'OpenSans', Arial, sans-serif;
            text-align: center;
        `;
        
        // Priority tag (centered)
        const priorityContainer = document.createElement('div');
        priorityContainer.style.cssText = `
            display: flex;
            justify-content: center;
            margin-bottom: 16px;
        `;
        
        const priorityTag = document.createElement('div');
        priorityTag.className = 'event-card-detail-priority';
        priorityTag.textContent = this.priority;
        this._updatePriorityTag(priorityTag);
        priorityContainer.appendChild(priorityTag);
        
        // Progress bars container
        const progressBarsContainer = document.createElement('div');
        progressBarsContainer.className = 'event-card-detail-progress-bars';
        progressBarsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        
        // Progress bar 1 (lime green) - always shown
        const progressBar1 = this._createProgressBar(1, this.progressBar1Value, '#b8e84c');
        progressBarsContainer.appendChild(progressBar1);
        
        // Progress bar 2 (orange) - only if enabled
        if (this.showProgressBar2) {
            const progressBar2 = this._createProgressBar(2, this.progressBar2Value, '#ff8c00');
            progressBarsContainer.appendChild(progressBar2);
            this.progressBar2Element = progressBar2;
        } else {
            this.progressBar2Element = null;
        }
        
        container.appendChild(titleContainer);
        container.appendChild(time);
        container.appendChild(priorityContainer);
        container.appendChild(progressBarsContainer);
        
        // Store references
        this.titleElement = title;
        this.titleContainer = titleContainer;
        this.timeElement = time;
        this.priorityTag = priorityTag;
        this.progressBar1Element = progressBar1;
        this.progressBarsContainer = progressBarsContainer;
        
        return container;
    }
    
    /**
     * Create a progress bar
     */
    _createProgressBar(index, value, color) {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `;
        
        const barContainer = document.createElement('div');
        barContainer.style.cssText = `
            flex: 1;
            height: 8px;
            background-color: #333;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
        `;
        
        const bar = document.createElement('div');
        bar.className = `event-card-detail-progress-bar-${index}`;
        const width = Math.max(0, Math.min(100, value));
        bar.style.cssText = `
            width: ${width}%;
            height: 100%;
            background-color: ${color};
            border-radius: 4px;
            transition: width 0.3s ease;
        `;
        
        const label = document.createElement('span');
        label.className = `event-card-detail-progress-label-${index}`;
        label.textContent = `${value}%`;
        label.style.cssText = `
            color: #999;
            font-size: 14px;
            font-family: 'OpenSans', Arial, sans-serif;
            min-width: 40px;
            text-align: right;
        `;
        
        barContainer.appendChild(bar);
        container.appendChild(barContainer);
        container.appendChild(label);
        
        // Store references
        if (index === 1) {
            this.progressBar1Bar = bar;
            this.progressBar1Label = label;
        } else {
            this.progressBar2Bar = bar;
            this.progressBar2Label = label;
        }
        
        return container;
    }
    
    /**
     * Create description section
     */
    _createDescriptionSection() {
        const container = document.createElement('div');
        container.className = 'event-card-detail-description';
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        
        const heading = document.createElement('h2');
        heading.textContent = 'Description';
        heading.style.cssText = `
            color: #999;
            font-size: 16px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
            margin: 0;
        `;
        
        const textBox = document.createElement('div');
        textBox.className = 'event-card-detail-description-text';
        textBox.textContent = this.description;
        textBox.style.cssText = `
            background-color: #2a2a2a;
            color: #fff;
            padding: 16px;
            border-radius: 12px;
            font-size: 14px;
            font-family: 'OpenSans', Arial, sans-serif;
            line-height: 1.5;
        `;
        
        container.appendChild(heading);
        container.appendChild(textBox);
        
        this.descriptionElement = textBox;
        this.descriptionContainer = container;
        
        return container;
    }
    
    /**
     * Create requirement section with checklist
     */
    _createRequirementSection() {
        const container = document.createElement('div');
        container.className = 'event-card-detail-requirement';
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        
        const heading = document.createElement('h2');
        heading.textContent = 'Requrierment'; // Note: keeping typo as in image
        heading.style.cssText = `
            color: #999;
            font-size: 16px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
            margin: 0;
        `;
        
        // Create checklist container
        const checklistContainer = document.createElement('div');
        checklistContainer.className = 'event-card-detail-requirement-checklist';
        checklistContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        
        // Store checklist items
        this.requirementCheckboxes = [];
        
        // Create checklist items
        this.requirements.forEach((req, index) => {
            const checklistItem = this._createChecklistItem(req.text, req.checked, index);
            checklistContainer.appendChild(checklistItem);
        });
        
        container.appendChild(heading);
        container.appendChild(checklistContainer);
        
        this.requirementContainer = checklistContainer;
        this.requirementSectionContainer = container;
        
        // Update complete button state after requirements are created
        if (this.completeButton) {
            this._updateCompleteButtonState();
        }
        
        return container;
    }
    
    /**
     * Create a checklist item
     */
    _createChecklistItem(text, checked, index) {
        const itemContainer = document.createElement('div');
        itemContainer.className = 'event-card-detail-checklist-item';
        itemContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            background-color: #2a2a2a;
            padding: 16px;
            border-radius: 999px;
        `;
        
        // Create checkbox container for custom styling
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.cssText = `
            position: relative;
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        `;
        
        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checked;
        checkbox.id = `requirement-checkbox-${index}`;
        checkbox.style.cssText = `
            width: 100%;
            height: 100%;
            cursor: pointer;
            margin: 0;
            padding: 0;
            border-radius: 50%;
            appearance: none;
            -webkit-appearance: none;
            border: 2px solid #666;
            background-color: transparent;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 1;
        `;
        
        // Create checkmark icon
        const checkmark = document.createElement('i');
        checkmark.className = 'fa-solid fa-check';
        checkmark.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 10px;
            color: #000;
            z-index: 2;
            pointer-events: none;
            opacity: ${checked ? '1' : '0'};
            transition: opacity 0.2s;
        `;
        
        // Update styling on change
        const updateCheckboxStyle = () => {
            if (checkbox.checked) {
                checkbox.style.backgroundColor = '#b8e84c';
                checkbox.style.borderColor = '#b8e84c';
                checkmark.style.opacity = '1';
            } else {
                checkbox.style.backgroundColor = 'transparent';
                checkbox.style.borderColor = '#666';
                checkmark.style.opacity = '0';
            }
        };
        
        checkbox.addEventListener('change', updateCheckboxStyle);
        updateCheckboxStyle(); // Set initial state
        
        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(checkmark);
        
        // Create label
        const label = document.createElement('label');
        label.htmlFor = `requirement-checkbox-${index}`;
        label.textContent = text;
        label.style.cssText = `
            flex: 1;
            color: #fff;
            font-size: 14px;
            font-family: 'OpenSans', Arial, sans-serif;
            cursor: pointer;
            margin: 0;
        `;
        
        // Update text style when checked
        if (checked) {
            label.style.textDecoration = 'line-through';
            label.style.opacity = '0.6';
        }
        
        // Handle checkbox change
        checkbox.addEventListener('change', () => {
            this.requirements[index].checked = checkbox.checked;
            if (checkbox.checked) {
                label.style.textDecoration = 'line-through';
                label.style.opacity = '0.6';
            } else {
                label.style.textDecoration = 'none';
                label.style.opacity = '1';
            }
            
            // Update complete button state
            this._updateCompleteButtonState();
            
            if (this.onRequirementToggle) {
                this.onRequirementToggle(this.requirements[index], index);
            }
        });
        
        itemContainer.appendChild(checkboxContainer);
        itemContainer.appendChild(label);
        
        // Store reference
        this.requirementCheckboxes.push({checkbox, label, container: itemContainer});
        
        return itemContainer;
    }
    
    
    /**
     * Check if all requirements are checked
     */
    _areAllRequirementsChecked() {
        if (!this.requirements || this.requirements.length === 0) {
            return true; // If no requirements, allow completion
        }
        return this.requirements.every(req => req.checked === true);
    }
    
    /**
     * Update complete button state based on requirements
     */
    _updateCompleteButtonState() {
        if (!this.completeButton) return;
        
        const allChecked = this._areAllRequirementsChecked();
        
        if (allChecked) {
            this.completeButton.style.opacity = '1';
            this.completeButton.style.pointerEvents = 'auto';
            this.completeButton.disabled = false;
            this.completeButton.style.cursor = 'pointer';
        } else {
            this.completeButton.style.opacity = '0.2';
            this.completeButton.style.pointerEvents = 'none';
            this.completeButton.disabled = true;
            this.completeButton.style.cursor = 'not-allowed';
        }
    }
    
    /**
     * Create complete button (fixed at bottom of card, fully rounded)
     */
    _createCompleteButton() {
        // Create wrapper div behind button for solid background
        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'event-card-detail-complete-button-wrapper';
        
        const buttonHeight = 50; // Approximate height (padding 16px * 2 + font size)
        const borderRadius = buttonHeight / 2;
        
        buttonWrapper.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            width: calc(100% - 40px);
            margin: 0 20px 20px 20px;
            background-color: #1a1a1a;
            border-radius: ${borderRadius}px;
            z-index: 9999;
            pointer-events: none;
        `;
        
        // Create the actual button
        const button = document.createElement('button');
        button.className = 'event-card-detail-complete-button';
        button.textContent = 'Complete';
        
        button.style.cssText = `
            position: relative;
            width: 100%;
            background-color: #b8e84c;
            color: #000;
            border: none;
            padding: 16px 20px;
            border-radius: ${borderRadius}px;
            font-size: 18px;
            font-weight: bold;
            font-family: 'OpenSans', Arial, sans-serif;
            cursor: pointer;
            z-index: 1;
            flex-shrink: 0;
            transition: opacity 0.3s ease;
            box-sizing: border-box;
        `;
        
        button.addEventListener('click', () => {
            if (this.onComplete && !button.disabled) {
                this.onComplete();
            }
        });
        
        // Append button to wrapper
        buttonWrapper.appendChild(button);
        
        this.completeButton = button;
        
        // Set initial state
        this._updateCompleteButtonState();
        
        return buttonWrapper;
    }
    
    /**
     * Check if title is too long and add animation and dim effect
     */
    _checkAndAnimateTitle(titleElement, containerElement) {
        // Create temporary measurement element
        const measureEl = document.createElement('span');
        measureEl.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: nowrap;
            font-size: 24px;
            font-weight: bold;
            font-family: 'OpenSans', Arial, sans-serif;
        `;
        measureEl.textContent = this.title;
        document.body.appendChild(measureEl);
        
        const textWidth = measureEl.offsetWidth;
        document.body.removeChild(measureEl);
        
        // Get container width (subtract padding)
        const containerWidth = containerElement.offsetWidth || 374; // 414 - 40px padding
        
        if (textWidth > containerWidth) {
            // Title is too long - add mask and animation
            containerElement.style.maskImage = 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)';
            containerElement.style.webkitMaskImage = 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)';
            
            // Create animation
            const scrollDistance = textWidth - containerWidth;
            const animationDuration = Math.max(3, scrollDistance / 50);
            
            // Add animation style if not exists
            if (!document.getElementById('eventCardDetailTitleAnimation')) {
                const styleElement = document.createElement('style');
                styleElement.id = 'eventCardDetailTitleAnimation';
                document.head.appendChild(styleElement);
            }
            
            const styleElement = document.getElementById('eventCardDetailTitleAnimation');
            styleElement.textContent = `
                @keyframes scrollDetailTitle {
                    0% { transform: translateX(0); }
                    50% { transform: translateX(-${scrollDistance}px); }
                    100% { transform: translateX(0); }
                }
            `;
            
            titleElement.style.animation = `scrollDetailTitle ${animationDuration}s ease-in-out infinite`;
        } else {
            // Title fits - no mask or animation needed
            containerElement.style.maskImage = 'none';
            containerElement.style.webkitMaskImage = 'none';
            titleElement.style.animation = 'none';
        }
    }
    
    /**
     * Convert hex to rgba
     */
    _hexToRgba(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    /**
     * Update priority tag styling
     */
    _updatePriorityTag(element) {
        const priorityColors = {
            high: { text: '#fff', bg: '#ff1d25' },
            basic: { text: '#000', bg: '#b8e84c' },
            low: { text: '#fff', bg: '#60289b' }
        };
        
        const priority = this.priority.toLowerCase();
        const colors = priorityColors[priority] || priorityColors.high;
        
        element.style.cssText = `
            background-color: ${this._hexToRgba(colors.bg, 0.25)};
            color: ${colors.text};
            padding: 6px 16px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: bold;
            font-family: 'OpenSans', Arial, sans-serif;
            display: inline-block;
        `;
    }
    
    /**
     * Show the modal
     */
    show(parentElement = document.body) {
        if (!this.isVisible) {
            // Prevent body scroll
            this.originalBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            
            // Append overlay first (so it's behind the modal)
            if (!this.overlay.parentNode) {
                parentElement.appendChild(this.overlay);
            }
            // Append modal second (so it's on top)
            if (!this.modal.parentNode) {
                parentElement.appendChild(this.modal);
            }
            
            // Show overlay first (blur background)
            this.overlay.style.display = 'block';
            // Then show modal
            this.modal.style.display = 'flex';
            
            // Trigger fade-in and slide-up animation (maintain horizontal centering)
            requestAnimationFrame(() => {
                this.overlay.style.opacity = '1';
                this.modal.style.transform = 'translateX(-50%) translateY(0)';
                
                // Re-check title animation after modal is visible
                if (this.titleElement && this.titleContainer) {
                    setTimeout(() => {
                        this._checkAndAnimateTitle(this.titleElement, this.titleContainer);
                    }, 100); // Small delay to ensure container is fully rendered
                }
            });
            
            this.isVisible = true;
        }
    }
    
    /**
     * Hide the modal
     */
    hide() {
        if (this.isVisible) {
            this.modal.style.transform = 'translateX(-50%) translateY(100%)';
            this.overlay.style.opacity = '0'; // Fade out overlay
            
            setTimeout(() => {
                this.overlay.style.display = 'none';
                this.modal.style.display = 'none';
                this.isVisible = false;
                
                // Restore body scroll
                if (this.originalBodyOverflow !== null) {
                    document.body.style.overflow = this.originalBodyOverflow;
                } else {
                    document.body.style.overflow = '';
                }
            }, 300); // Match transition duration
        }
    }
    
    /**
     * Set title
     */
    setTitle(title) {
        this.title = title;
        if (this.titleElement) {
            this.titleElement.textContent = title;
            // Re-check and update animation
            if (this.titleContainer) {
                this._checkAndAnimateTitle(this.titleElement, this.titleContainer);
            }
        }
    }
    
    /**
     * Set time
     */
    setTime(time) {
        this.time = time;
        if (this.timeElement) {
            this.timeElement.textContent = time;
        }
    }
    
    /**
     * Set priority
     */
    setPriority(priority) {
        this.priority = priority;
        if (this.priorityTag) {
            this.priorityTag.textContent = priority;
            this._updatePriorityTag(this.priorityTag);
        }
    }
    
    /**
     * Set progress bar 1 value
     */
    setProgressBar1Value(value) {
        this.progressBar1Value = Math.max(0, Math.min(100, value));
        if (this.progressBar1Bar) {
            this.progressBar1Bar.style.width = `${this.progressBar1Value}%`;
        }
        if (this.progressBar1Label) {
            this.progressBar1Label.textContent = `${this.progressBar1Value}%`;
        }
    }
    
    /**
     * Set progress bar 2 value
     */
    setProgressBar2Value(value) {
        this.progressBar2Value = Math.max(0, Math.min(100, value));
        if (this.progressBar2Bar) {
            this.progressBar2Bar.style.width = `${this.progressBar2Value}%`;
        }
        if (this.progressBar2Label) {
            this.progressBar2Label.textContent = `${this.progressBar2Value}%`;
        }
    }
    
    /**
     * Set whether to show progress bar 2
     */
    setShowProgressBar2(show) {
        this.showProgressBar2 = show;
        if (this.progressBarsContainer) {
            // Remove existing progress bar 2 if it exists
            if (this.progressBar2Element) {
                this.progressBar2Element.remove();
                this.progressBar2Element = null;
                this.progressBar2Bar = null;
                this.progressBar2Label = null;
            }
            
            // Add progress bar 2 if it should be shown
            if (show) {
                const progressBar2 = this._createProgressBar(2, this.progressBar2Value, '#ff8c00');
                this.progressBarsContainer.appendChild(progressBar2);
                this.progressBar2Element = progressBar2;
            }
        }
    }
    
    /**
     * Set description
     */
    setDescription(description) {
        this.description = description;
        
        // Show or hide the description section based on content
        if (this.descriptionContainer) {
            if (description && description.trim() !== '') {
                this.descriptionContainer.style.display = 'flex';
                if (this.descriptionElement) {
                    this.descriptionElement.textContent = description;
                }
            } else {
                this.descriptionContainer.style.display = 'none';
            }
        }
    }
    
    /**
     * Set requirements (array of requirement objects)
     */
    setRequirements(requirements) {
        if (Array.isArray(requirements)) {
            this.requirements = requirements;
            
            // Show or hide the requirements section based on whether there are requirements
            if (this.requirementSectionContainer) {
                if (requirements && requirements.length > 0) {
                    this.requirementSectionContainer.style.display = 'flex';
                    // Rebuild checklist if container exists
                    if (this.requirementContainer) {
                        this.requirementContainer.innerHTML = '';
                        this.requirementCheckboxes = [];
                        this.requirements.forEach((req, index) => {
                            const checklistItem = this._createChecklistItem(req.text, req.checked ?? false, index);
                            this.requirementContainer.appendChild(checklistItem);
                        });
                    }
                } else {
                    this.requirementSectionContainer.style.display = 'none';
                }
            }
            
            // Update complete button state
            this._updateCompleteButtonState();
        }
    }
    
    /**
     * Set requirement checked state by index
     */
    setRequirementChecked(index, checked) {
        if (this.requirements[index] && this.requirementCheckboxes[index]) {
            this.requirements[index].checked = checked;
            this.requirementCheckboxes[index].checkbox.checked = checked;
            if (checked) {
                this.requirementCheckboxes[index].label.style.textDecoration = 'line-through';
                this.requirementCheckboxes[index].label.style.opacity = '0.6';
            } else {
                this.requirementCheckboxes[index].label.style.textDecoration = 'none';
                this.requirementCheckboxes[index].label.style.opacity = '1';
            }
            // Update complete button state
            this._updateCompleteButtonState();
        }
    }
}
