class EventCardCreatePanel {
    constructor(options = {}) {
        // Callbacks
        this.onCreate = options.onCreate ?? null;
        this.onCancel = options.onCancel ?? null;
        this.onCategoryCreate = options.onCategoryCreate ?? null;

        // Firebase instances (optional - can be passed or accessed via window)
        this.firebaseAuth = options.firebaseAuth ?? null;
        this.firebaseConfig = options.firebaseConfig ?? null;

        // Default values for form
        this.formData = {
            title: '',
            time: '',
            date: this._formatDateLocal(new Date()), // Today's date
            category: '',
            priority: 'Basic',
            repeat: 'None',
            repeatDuration: 1, // Number of days/weeks/months/years
            repeatForever: false, // True if repeat is forever
            description: '',
            requirements: []
        };

        // DOM elements
        this.overlay = null;
        this.modal = null;
        this.isVisible = false;

        // Form elements
        this.titleInput = null;
        this.timeFromInput = null;
        this.timeToInput = null;
        this.dateInput = null;
        this.advanceButton = null;
        this.advanceSection = null;
        this.isAdvanceExpanded = false;
        this.priorityButtons = [];
        this.repeatButtons = [];
        this.repeatDurationSection = null;
        this.repeatDurationInput = null;
        this.repeatDurationLabel = null;
        this.repeatForeverCheckbox = null;
        this.descriptionInput = null;
        this.requirementsContainer = null;
        this.requirementsList = [];
        this.categoryButton = null;
        this.categorySelectorPanel = null;
        this.isCategorySelectorVisible = false;
        this.createCategoryPanelInstance = null;
        this.categories = []; // Store categories
        this.projects = []; // Store projects
        this.categorySelectorOverlay = null;

        // Time picker
        this.timePickerPanel = null;
        this.activeTimeInput = null;

        // Swipe tracking
        this.touchStartY = 0;
        this.touchCurrentY = 0;
        this.isDragging = false;
        this.modalHeight = 0;

        // Store original body overflow to restore later
        this.originalBodyOverflow = null;

        // Create the modal structure
        this._createModal();

        // Initialize create category panel
        this._initCreateCategoryPanel();

        // Add swipe functionality
        this._addSwipeHandlers();
    }

    /**
     * Format date in YYYY-MM-DD using local timezone (no UTC conversion)
     * @param {Date} date - Date object to format
     * @returns {string} Date string in YYYY-MM-DD format
     */
    _formatDateLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Create the modal structure
     */
    _createModal() {
        // Create overlay (blur background)
        this.overlay = document.createElement('div');
        this.overlay.className = 'event-card-create-overlay';
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

        // Create modal container (floating panel)
        this.modal = document.createElement('div');
        this.modal.className = 'event-card-create-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            background-color: #1a1a1a;
            border-radius: 24px;
            z-index: 9999;
            display: none;
            flex-direction: column;
            overflow: hidden;
            transition: transform 0.3s ease-out, opacity 0.3s ease-out;
            opacity: 0;
            box-sizing: border-box;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        `;

        // No drag handle needed for floating panel

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

        // Hide scrollbar for webkit browsers
        const scrollableStyle = document.createElement('style');
        scrollableStyle.textContent = `
            .event-card-create-scrollable::-webkit-scrollbar {
                display: none;
            }
        `;
        scrollableContent.className = 'event-card-create-scrollable';
        if (!document.querySelector('style[data-create-scrollable]')) {
            scrollableStyle.setAttribute('data-create-scrollable', 'true');
            document.head.appendChild(scrollableStyle);
        }

        // Create content container
        const content = document.createElement('div');
        content.className = 'event-card-create-content';
        content.style.cssText = `
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        `;

        // Create form sections
        const formSections = this._createFormSections();
        formSections.forEach(section => content.appendChild(section));

        // Create button and add to content
        const createButton = this._createButton();
        content.appendChild(createButton);

        scrollableContent.appendChild(content);

        this.modal.appendChild(header);
        this.modal.appendChild(scrollableContent);

        // Add click handler to overlay to close modal
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });
    }

    /**
     * Create header with title and close button
     */
    _createHeader() {
        const header = document.createElement('div');
        header.className = 'event-card-create-header';
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            position: relative;
        `;

        // Title
        const title = document.createElement('h1');
        title.textContent = 'Create New Task';
        title.style.cssText = `
            color: #fff;
            font-size: 20px;
            font-weight: bold;
            font-family: 'OpenSans', Arial, sans-serif;
            margin: 0;
            flex: 1;
            text-align: center;
        `;

        // Close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeButton.style.cssText = `
            background: none;
            border: none;
            color: #999;
            font-size: 24px;
            cursor: pointer;
            padding: 8px;
            margin: -8px;
            position: absolute;
            right: 20px;
        `;

        closeButton.addEventListener('click', () => {
            this.hide();
            if (this.onCancel) {
                this.onCancel();
            }
        });

        header.appendChild(title);
        header.appendChild(closeButton);

        return header;
    }

    /**
     * Create form sections
     */
    _createFormSections() {
        const sections = [];

        // Title input
        sections.push(this._createTitleSection());

        // Time input
        sections.push(this._createTimeSection());

        // Date input
        sections.push(this._createDateSection());

        // Category selection
        sections.push(this._createCategorySection());

        // Advance button
        sections.push(this._createAdvanceButton());

        // Advance section (Priority and Repeat - hidden by default)
        sections.push(this._createAdvanceSection());

        // Description input
        sections.push(this._createDescriptionSection());

        // Requirements input
        sections.push(this._createRequirementsSection());

        return sections;
    }

    /**
     * Create advance button
     */
    _createAdvanceButton() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            justify-content: center;
            margin-top: 8px;
        `;

        this.advanceButton = document.createElement('button');
        this.advanceButton.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Advance';
        this.advanceButton.style.cssText = `
            background-color: #2a2a2a;
            color: #b8e84c;
            border: 2px solid #2a2a2a;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        `;

        this.advanceButton.addEventListener('mouseenter', () => {
            this.advanceButton.style.backgroundColor = '#333';
            this.advanceButton.style.borderColor = '#b8e84c';
        });

        this.advanceButton.addEventListener('mouseleave', () => {
            if (!this.isAdvanceExpanded) {
                this.advanceButton.style.backgroundColor = '#2a2a2a';
                this.advanceButton.style.borderColor = '#2a2a2a';
            }
        });

        this.advanceButton.addEventListener('click', () => {
            this._toggleAdvanceSection();
        });

        container.appendChild(this.advanceButton);
        return container;
    }

    /**
     * Create advance section (contains Priority and Repeat)
     */
    _createAdvanceSection() {
        const container = document.createElement('div');
        container.className = 'advance-section';
        container.style.cssText = `
            display: none;
            flex-direction: column;
            gap: 24px;
            overflow: hidden;
            transition: max-height 0.3s ease-out, opacity 0.3s ease-out;
            max-height: 0;
            opacity: 0;
        `;

        // Priority selection
        const prioritySection = this._createPrioritySection();

        // Repeat selection
        const repeatSection = this._createRepeatSection();

        container.appendChild(prioritySection);
        container.appendChild(repeatSection);

        this.advanceSection = container;
        return container;
    }

    /**
     * Toggle advance section visibility
     */
    _toggleAdvanceSection() {
        this.isAdvanceExpanded = !this.isAdvanceExpanded;

        if (this.isAdvanceExpanded) {
            // Expand
            this.advanceSection.style.display = 'flex';
            this.advanceSection.style.maxHeight = '1000px';
            this.advanceSection.style.opacity = '1';
            this.advanceButton.innerHTML = '<i class="fa-solid fa-chevron-up"></i> Advance';
            this.advanceButton.style.backgroundColor = '#333';
            this.advanceButton.style.borderColor = '#b8e84c';
        } else {
            // Collapse
            this.advanceSection.style.maxHeight = '0';
            this.advanceSection.style.opacity = '0';
            setTimeout(() => {
                if (!this.isAdvanceExpanded) {
                    this.advanceSection.style.display = 'none';
                }
            }, 300);
            this.advanceButton.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Advance';
            this.advanceButton.style.backgroundColor = '#2a2a2a';
            this.advanceButton.style.borderColor = '#2a2a2a';
        }
    }

    /**
     * Create title input section
     */
    _createTitleSection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Task Title';
        label.style.cssText = `
            color: #999;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        this.titleInput = document.createElement('input');
        this.titleInput.type = 'text';
        this.titleInput.placeholder = 'Enter task title';
        this.titleInput.style.cssText = `
            background-color: #2a2a2a;
            color: #fff;
            border: none;
            padding: 14px 16px;
            border-radius: 12px;
            font-size: 16px;
            font-family: 'OpenSans', Arial, sans-serif;
            outline: none;
        `;

        this.titleInput.addEventListener('focus', () => {
            this.titleInput.style.backgroundColor = '#333';
        });

        this.titleInput.addEventListener('blur', () => {
            this.titleInput.style.backgroundColor = '#2a2a2a';
        });

        container.appendChild(label);
        container.appendChild(this.titleInput);

        return container;
    }

    /**
     * Create time input section
     */
    _createTimeSection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Time';
        label.style.cssText = `
            color: #999;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        // Time inputs container
        const timeInputsContainer = document.createElement('div');
        timeInputsContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        // From input
        this.timeFromInput = document.createElement('div');
        this.timeFromInput.textContent = 'From';
        this.timeFromInput.dataset.placeholder = 'true';
        this.timeFromInput.style.cssText = `
            flex: 1;
            background-color: #2a2a2a;
            color: #666;
            border: none;
            padding: 14px 16px;
            border-radius: 12px;
            font-size: 16px;
            font-family: 'OpenSans', Arial, sans-serif;
            outline: none;
            cursor: pointer;
            transition: background-color 0.2s;
            user-select: none;
        `;

        this.timeFromInput.addEventListener('mouseenter', () => {
            this.timeFromInput.style.backgroundColor = '#333';
        });

        this.timeFromInput.addEventListener('mouseleave', () => {
            this.timeFromInput.style.backgroundColor = '#2a2a2a';
        });

        this.timeFromInput.addEventListener('click', () => {
            this.activeTimeInput = this.timeFromInput;
            this._showTimePicker();
        });

        // Separator
        const separator = document.createElement('span');
        separator.textContent = '-';
        separator.style.cssText = `
            color: #999;
            font-size: 20px;
            font-weight: bold;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        // To input
        this.timeToInput = document.createElement('div');
        this.timeToInput.textContent = 'To';
        this.timeToInput.dataset.placeholder = 'true';
        this.timeToInput.style.cssText = `
            flex: 1;
            background-color: #2a2a2a;
            color: #666;
            border: none;
            padding: 14px 16px;
            border-radius: 12px;
            font-size: 16px;
            font-family: 'OpenSans', Arial, sans-serif;
            outline: none;
            cursor: pointer;
            transition: background-color 0.2s;
            user-select: none;
        `;

        this.timeToInput.addEventListener('mouseenter', () => {
            this.timeToInput.style.backgroundColor = '#333';
        });

        this.timeToInput.addEventListener('mouseleave', () => {
            this.timeToInput.style.backgroundColor = '#2a2a2a';
        });

        this.timeToInput.addEventListener('click', () => {
            this.activeTimeInput = this.timeToInput;
            this._showTimePicker();
        });

        timeInputsContainer.appendChild(this.timeFromInput);
        timeInputsContainer.appendChild(separator);
        timeInputsContainer.appendChild(this.timeToInput);

        container.appendChild(label);
        container.appendChild(timeInputsContainer);

        return container;
    }

    /**
     * Create priority selection section
     */
    _createPrioritySection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Priority';
        label.style.cssText = `
            color: #999;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            gap: 12px;
        `;

        const priorities = [
            { value: 'High', color: '#ff1d25' },
            { value: 'Basic', color: '#b8e84c' },
            { value: 'Low', color: '#60289b' }
        ];

        priorities.forEach(priority => {
            const button = document.createElement('button');
            button.textContent = priority.value;
            button.dataset.priority = priority.value;
            button.style.cssText = `
                flex: 1;
                background-color: ${priority.value === 'Basic' ? priority.color : '#2a2a2a'};
                color: ${priority.value === 'Basic' ? '#000' : '#999'};
                border: 2px solid ${priority.value === 'Basic' ? priority.color : '#2a2a2a'};
                padding: 12px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: bold;
                font-family: 'OpenSans', Arial, sans-serif;
                cursor: pointer;
                transition: all 0.2s;
            `;

            button.addEventListener('click', () => {
                // Update all buttons
                this.priorityButtons.forEach(btn => {
                    const btnPriority = priorities.find(p => p.value === btn.dataset.priority);
                    btn.style.backgroundColor = '#2a2a2a';
                    btn.style.color = '#999';
                    btn.style.borderColor = '#2a2a2a';
                });

                // Highlight selected button
                button.style.backgroundColor = priority.color;
                button.style.color = priority.value === 'Basic' ? '#000' : '#fff';
                button.style.borderColor = priority.color;

                this.formData.priority = priority.value;
            });

            this.priorityButtons.push(button);
            buttonsContainer.appendChild(button);
        });

        container.appendChild(label);
        container.appendChild(buttonsContainer);

        return container;
    }

    /**
     * Create date input section
     */
    _createDateSection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Date';
        label.style.cssText = `
            color: #999;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        // Custom date button (instead of native input)
        this.dateButton = document.createElement('div');
        this.selectedDate = new Date();
        this._updateDateButtonText();

        this.dateButton.style.cssText = `
            background-color: #2a2a2a;
            color: #fff;
            border: none;
            padding: 14px 16px;
            border-radius: 12px;
            font-size: 16px;
            font-family: 'OpenSans', Arial, sans-serif;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: background 0.15s;
        `;

        const calendarIcon = document.createElement('i');
        calendarIcon.className = 'fa-solid fa-calendar';
        calendarIcon.style.color = '#b8e84c';
        this.dateButton.appendChild(calendarIcon);

        this.dateButton.addEventListener('mouseenter', () => {
            this.dateButton.style.backgroundColor = '#333';
        });
        this.dateButton.addEventListener('mouseleave', () => {
            this.dateButton.style.backgroundColor = '#2a2a2a';
        });
        this.dateButton.addEventListener('click', () => {
            this._showDatePicker();
        });

        // Hidden input for form compatibility
        this.dateInput = document.createElement('input');
        this.dateInput.type = 'hidden';
        this.dateInput.value = this._formatDateLocal(this.selectedDate);

        container.appendChild(label);
        container.appendChild(this.dateButton);
        container.appendChild(this.dateInput);

        return container;
    }

    /**
     * Update date button display text
     */
    _updateDateButtonText() {
        const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' };
        const dateText = this.selectedDate.toLocaleDateString('en-US', options);

        // Remove existing text node if any
        const existingText = this.dateButton.querySelector('.date-text');
        if (existingText) {
            existingText.textContent = dateText;
        } else {
            const textSpan = document.createElement('span');
            textSpan.className = 'date-text';
            textSpan.textContent = dateText;
            this.dateButton.insertBefore(textSpan, this.dateButton.firstChild);
        }
    }

    /**
     * Create date picker panel
     */
    _createDatePicker() {
        const picker = document.createElement('div');
        picker.className = 'date-picker-panel';
        picker.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            background-color: #2c2c2c;
            border-radius: 12px;
            z-index: 10001;
            padding: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            opacity: 0;
            transition: all 0.2s ease-out;
            box-sizing: border-box;
            min-width: 320px;
            border: 1px solid #404040;
        `;

        // Current view date (for navigation)
        this.datePickerViewDate = new Date(this.selectedDate);
        this.datePickerMode = 'day'; // 'day', 'month', or 'year'
        this.datePickerYearRangeStart = this.datePickerViewDate.getFullYear() - (this.datePickerViewDate.getFullYear() % 12);


        // Header with month/year and navigation
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        `;

        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevBtn.style.cssText = `
            background: none;
            border: none;
            color: #b8e84c;
            font-size: 16px;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 6px;
            transition: background 0.15s;
        `;
        prevBtn.addEventListener('mouseenter', () => prevBtn.style.background = 'rgba(255,255,255,0.1)');
        prevBtn.addEventListener('mouseleave', () => prevBtn.style.background = 'none');
        prevBtn.addEventListener('click', () => {
            if (this.datePickerMode === 'year') {
                this.datePickerYearRangeStart -= 12;
                this._showYearPicker();
            } else if (this.datePickerMode === 'month') {
                this.datePickerViewDate.setFullYear(this.datePickerViewDate.getFullYear() - 1);
                this._showMonthPicker();
            } else {
                this.datePickerViewDate.setMonth(this.datePickerViewDate.getMonth() - 1);
                this._updateDatePickerCalendar();
            }
        });

        // Clickable Month/Year display
        this.datePickerMonthYear = document.createElement('div');
        this.datePickerMonthYear.style.cssText = `
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            font-family: 'OpenSans', sans-serif;
            cursor: pointer;
            padding: 6px 12px;
            border-radius: 6px;
            transition: background 0.15s;
        `;
        this.datePickerMonthYear.addEventListener('mouseenter', () => {
            this.datePickerMonthYear.style.background = 'rgba(255,255,255,0.1)';
        });
        this.datePickerMonthYear.addEventListener('mouseleave', () => {
            this.datePickerMonthYear.style.background = 'none';
        });
        this.datePickerMonthYear.addEventListener('click', () => {
            if (this.datePickerMode === 'day') {
                this._showMonthPicker();
            } else if (this.datePickerMode === 'month') {
                this._showYearPicker();
            } else {
                this._showDayPicker();
            }
        });

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextBtn.style.cssText = `
            background: none;
            border: none;
            color: #b8e84c;
            font-size: 16px;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 6px;
            transition: background 0.15s;
        `;
        nextBtn.addEventListener('mouseenter', () => nextBtn.style.background = 'rgba(255,255,255,0.1)');
        nextBtn.addEventListener('mouseleave', () => nextBtn.style.background = 'none');
        nextBtn.addEventListener('click', () => {
            if (this.datePickerMode === 'year') {
                this.datePickerYearRangeStart += 12;
                this._showYearPicker();
            } else if (this.datePickerMode === 'month') {
                this.datePickerViewDate.setFullYear(this.datePickerViewDate.getFullYear() + 1);
                this._showMonthPicker();
            } else {
                this.datePickerViewDate.setMonth(this.datePickerViewDate.getMonth() + 1);
                this._updateDatePickerCalendar();
            }
        });

        header.appendChild(prevBtn);
        header.appendChild(this.datePickerMonthYear);
        header.appendChild(nextBtn);

        // Weekday headers
        this.datePickerWeekdayHeader = document.createElement('div');
        this.datePickerWeekdayHeader.style.cssText = `
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 4px;
            margin-bottom: 8px;
        `;
        const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        weekdays.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.textContent = day;
            dayEl.style.cssText = `
                text-align: center;
                color: #888;
                font-size: 12px;
                font-weight: 600;
                padding: 8px 0;
                font-family: 'OpenSans', sans-serif;
            `;
            this.datePickerWeekdayHeader.appendChild(dayEl);
        });

        // Calendar grid
        this.datePickerGrid = document.createElement('div');
        this.datePickerGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 4px;
            min-height: 240px;
            transition: opacity 0.2s ease, transform 0.2s ease;
        `;

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = `
            display: flex;
            justify-content: space-between;
            margin-top: 16px;
            gap: 8px;
        `;

        const todayBtn = document.createElement('button');
        todayBtn.textContent = 'Today';
        todayBtn.style.cssText = `
            background: transparent;
            border: 1px solid #b8e84c;
            color: #b8e84c;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-family: 'OpenSans', sans-serif;
            cursor: pointer;
            transition: all 0.15s;
        `;
        todayBtn.addEventListener('mouseenter', () => {
            todayBtn.style.background = 'rgba(184, 232, 76, 0.1)';
        });
        todayBtn.addEventListener('mouseleave', () => {
            todayBtn.style.background = 'transparent';
        });
        todayBtn.addEventListener('click', () => {
            this.selectedDate = new Date();
            this.datePickerViewDate = new Date();
            this._updateDatePickerCalendar();
            this._selectDate(this.selectedDate);
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            background: transparent;
            border: 1px solid #666;
            color: #ccc;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-family: 'OpenSans', sans-serif;
            cursor: pointer;
            transition: all 0.15s;
        `;
        cancelBtn.addEventListener('click', () => this._hideDatePicker());

        footer.appendChild(todayBtn);
        footer.appendChild(cancelBtn);

        picker.appendChild(header);
        picker.appendChild(this.datePickerWeekdayHeader);
        picker.appendChild(this.datePickerGrid);
        picker.appendChild(footer);

        this._updateDatePickerCalendar();

        return picker;
    }

    /**
     * Update date picker calendar grid
     */
    _updateDatePickerCalendar() {
        // Update month/year display
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        this.datePickerMonthYear.textContent =
            `${months[this.datePickerViewDate.getMonth()]} ${this.datePickerViewDate.getFullYear()}`;

        // Clear grid
        this.datePickerGrid.innerHTML = '';

        // Get first day of month and total days
        const firstDay = new Date(this.datePickerViewDate.getFullYear(), this.datePickerViewDate.getMonth(), 1);
        const lastDay = new Date(this.datePickerViewDate.getFullYear(), this.datePickerViewDate.getMonth() + 1, 0);
        const totalDays = lastDay.getDate();

        // Adjust for Monday start (0 = Monday, 6 = Sunday)
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) startDay = 6;

        // Today for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Add empty cells for days before first day
        for (let i = 0; i < startDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.style.cssText = `padding: 10px;`;
            this.datePickerGrid.appendChild(emptyCell);
        }

        // Add day cells
        for (let day = 1; day <= totalDays; day++) {
            const dayCell = document.createElement('div');
            dayCell.textContent = day;

            const cellDate = new Date(this.datePickerViewDate.getFullYear(), this.datePickerViewDate.getMonth(), day);
            cellDate.setHours(0, 0, 0, 0);

            const isToday = cellDate.getTime() === today.getTime();
            const isSelected = this.selectedDate &&
                cellDate.getFullYear() === this.selectedDate.getFullYear() &&
                cellDate.getMonth() === this.selectedDate.getMonth() &&
                cellDate.getDate() === this.selectedDate.getDate();

            dayCell.style.cssText = `
                text-align: center;
                padding: 10px;
                font-size: 14px;
                font-family: 'OpenSans', sans-serif;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.15s;
                color: ${isSelected ? '#000' : (isToday ? '#b8e84c' : '#fff')};
                background: ${isSelected ? '#b8e84c' : 'transparent'};
                font-weight: ${isToday || isSelected ? '600' : '400'};
                ${isToday && !isSelected ? 'border: 1px solid #b8e84c;' : ''}
            `;

            dayCell.addEventListener('mouseenter', () => {
                if (!isSelected) {
                    dayCell.style.background = 'rgba(255,255,255,0.1)';
                }
            });

            dayCell.addEventListener('mouseleave', () => {
                if (!isSelected) {
                    dayCell.style.background = 'transparent';
                }
            });

            dayCell.addEventListener('click', () => {
                const newDate = new Date(this.datePickerViewDate.getFullYear(), this.datePickerViewDate.getMonth(), day);
                this._selectDate(newDate);
            });

            this.datePickerGrid.appendChild(dayCell);
        }
    }

    /**
     * Show day picker (calendar grid)
     */
    _showDayPicker() {
        this.datePickerMode = 'day';

        // Zoom in animation
        this.datePickerGrid.style.opacity = '0';
        this.datePickerGrid.style.transform = 'scale(1.1)';

        // Show weekday header
        if (this.datePickerWeekdayHeader) {
            this.datePickerWeekdayHeader.style.display = 'grid';
        }

        // Set grid to 7 columns for days
        this.datePickerGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';

        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        this.datePickerMonthYear.textContent =
            `${months[this.datePickerViewDate.getMonth()]} ${this.datePickerViewDate.getFullYear()}`;
        this._updateDatePickerCalendar();

        // Trigger animation
        requestAnimationFrame(() => {
            this.datePickerGrid.style.opacity = '1';
            this.datePickerGrid.style.transform = 'scale(1)';
        });
    }

    /**
     * Show month picker (12 months grid)
     */
    _showMonthPicker() {
        this.datePickerMode = 'month';
        this.datePickerMonthYear.textContent = this.datePickerViewDate.getFullYear();

        // Zoom out animation
        this.datePickerGrid.style.opacity = '0';
        this.datePickerGrid.style.transform = 'scale(0.9)';

        // Hide weekday header
        if (this.datePickerWeekdayHeader) {
            this.datePickerWeekdayHeader.style.display = 'none';
        }

        // Set grid to 4 columns for months
        this.datePickerGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';

        // Clear grid
        this.datePickerGrid.innerHTML = '';

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        months.forEach((month, index) => {
            const monthCell = document.createElement('div');
            monthCell.textContent = month;

            const isCurrentMonth = index === this.datePickerViewDate.getMonth();

            monthCell.style.cssText = `
                text-align: center;
                padding: 16px;
                font-size: 14px;
                font-family: 'OpenSans', sans-serif;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.15s;
                color: ${isCurrentMonth ? '#000' : '#fff'};
                background: ${isCurrentMonth ? '#b8e84c' : 'transparent'};
                font-weight: ${isCurrentMonth ? '600' : '400'};
            `;

            monthCell.addEventListener('mouseenter', () => {
                if (!isCurrentMonth) {
                    monthCell.style.background = 'rgba(255,255,255,0.1)';
                }
            });

            monthCell.addEventListener('mouseleave', () => {
                if (!isCurrentMonth) {
                    monthCell.style.background = 'transparent';
                }
            });

            monthCell.addEventListener('click', () => {
                this.datePickerViewDate.setMonth(index);
                this._showDayPicker();
            });

            this.datePickerGrid.appendChild(monthCell);
        });

        // Trigger animation
        requestAnimationFrame(() => {
            this.datePickerGrid.style.opacity = '1';
            this.datePickerGrid.style.transform = 'scale(1)';
        });
    }

    /**
     * Show year picker (12 years grid)
     */
    _showYearPicker() {
        this.datePickerMode = 'year';
        const startYear = this.datePickerYearRangeStart;
        const endYear = startYear + 11;
        this.datePickerMonthYear.textContent = `${startYear} - ${endYear}`;

        // Zoom out animation
        this.datePickerGrid.style.opacity = '0';
        this.datePickerGrid.style.transform = 'scale(0.9)';

        // Hide weekday header
        if (this.datePickerWeekdayHeader) {
            this.datePickerWeekdayHeader.style.display = 'none';
        }

        // Set grid to 4 columns for years
        this.datePickerGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';

        // Clear grid
        this.datePickerGrid.innerHTML = '';

        for (let year = startYear; year <= endYear; year++) {
            const yearCell = document.createElement('div');
            yearCell.textContent = year;

            const isCurrentYear = year === this.datePickerViewDate.getFullYear();

            yearCell.style.cssText = `
                text-align: center;
                padding: 16px;
                font-size: 14px;
                font-family: 'OpenSans', sans-serif;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.15s;
                color: ${isCurrentYear ? '#000' : '#fff'};
                background: ${isCurrentYear ? '#b8e84c' : 'transparent'};
                font-weight: ${isCurrentYear ? '600' : '400'};
            `;

            yearCell.addEventListener('mouseenter', () => {
                if (!isCurrentYear) {
                    yearCell.style.background = 'rgba(255,255,255,0.1)';
                }
            });

            yearCell.addEventListener('mouseleave', () => {
                if (!isCurrentYear) {
                    yearCell.style.background = 'transparent';
                }
            });

            yearCell.addEventListener('click', () => {
                this.datePickerViewDate.setFullYear(year);
                this._showMonthPicker();
            });

            this.datePickerGrid.appendChild(yearCell);
        }

        // Trigger animation
        requestAnimationFrame(() => {
            this.datePickerGrid.style.opacity = '1';
            this.datePickerGrid.style.transform = 'scale(1)';
        });
    }

    /**
     * Select a date and close picker
     */
    _selectDate(date) {
        this.selectedDate = new Date(date);
        this.dateInput.value = this._formatDateLocal(this.selectedDate);
        this._updateDateButtonText();
        this._hideDatePicker();
    }

    /**
     * Show date picker
     */
    _showDatePicker() {
        if (!this.datePickerPanel) {
            this.datePickerPanel = this._createDatePicker();
            document.body.appendChild(this.datePickerPanel);
        }

        // Reset view to selected date
        this.datePickerViewDate = new Date(this.selectedDate);
        this._updateDatePickerCalendar();

        requestAnimationFrame(() => {
            this.datePickerPanel.style.opacity = '1';
            this.datePickerPanel.style.transform = 'translate(-50%, -50%) scale(1)';
        });
    }

    /**
     * Hide date picker
     */
    _hideDatePicker() {
        if (this.datePickerPanel) {
            this.datePickerPanel.style.opacity = '0';
            this.datePickerPanel.style.transform = 'translate(-50%, -50%) scale(0.95)';

            // Remove from DOM after animation
            setTimeout(() => {
                if (this.datePickerPanel && this.datePickerPanel.parentNode) {
                    this.datePickerPanel.parentNode.removeChild(this.datePickerPanel);
                    this.datePickerPanel = null;
                }
            }, 200);
        }
    }

    /**
     * Create category selection section
     */
    _createCategorySection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Category';
        label.style.cssText = `
            color: #AEAEB2;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        this.categoryButton = document.createElement('div');
        this.categoryButton.style.cssText = `
            background-color: #1C1C1E;
            color: #FFFFFF;
            border: 1px solid #636366;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            font-family: 'OpenSans', Arial, sans-serif;
            cursor: pointer;
            transition: all 150ms ease-out;
            user-select: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        // Add category text
        const categoryText = document.createElement('span');
        categoryText.textContent = 'Select category';
        categoryText.className = 'category-text';
        categoryText.style.cssText = `
            color: #8E8E93;
            flex: 1;
        `;
        this.categoryButton.appendChild(categoryText);

        // Add chevron icon
        const chevron = document.createElement('span');
        chevron.innerHTML = '▼';
        chevron.style.cssText = `
            font-size: 12px;
            color: #8E8E93;
            transition: transform 200ms ease-out;
            margin-left: 8px;
        `;
        this.categoryButton.appendChild(chevron);

        this.categoryButton.addEventListener('mouseenter', () => {
            this.categoryButton.style.backgroundColor = '#2C2C2E';
            this.categoryButton.style.borderColor = '#8E8E93';
        });

        this.categoryButton.addEventListener('mouseleave', () => {
            this.categoryButton.style.backgroundColor = '#1C1C1E';
            this.categoryButton.style.borderColor = '#636366';
        });

        this.categoryButton.addEventListener('click', () => {
            this._toggleCategorySelector();
        });

        container.appendChild(label);
        container.appendChild(this.categoryButton);

        // Create category selector panel
        this._createCategorySelector();

        return container;
    }

    /**
     * Create category selector panel
     */
    _createCategorySelector() {
        this.categorySelectorPanel = document.createElement('div');
        this.categorySelectorPanel.className = 'category-selector-panel';
        this.categorySelectorPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            width: 400px;
            height: 500px;
            background-color: #1C1C1E;
            border-radius: 12px;
            z-index: 10002;
            display: none;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
            box-sizing: border-box;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Select Category';
        title.style.cssText = `
            color: #FFFFFF;
            font-size: 20px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
            margin: 0;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #8E8E93;
            font-size: 24px;
            cursor: pointer;
            padding: 4px 8px;
            line-height: 1;
            transition: color 150ms ease-out;
            min-width: 40px;
            min-height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.color = '#FFFFFF';
        });

        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.color = '#8E8E93';
        });

        closeBtn.addEventListener('click', () => {
            this._hideCategorySelector();
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Categories container - vertical list layout
        const categoriesContainer = document.createElement('div');
        categoriesContainer.style.cssText = `
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            height: calc(500px - 80px);
            overflow-y: auto;
            flex: 1;
            min-height: 0;
        `;

        // Hide scrollbar
        categoriesContainer.style.scrollbarWidth = 'none';
        categoriesContainer.style.msOverflowStyle = 'none';
        const style = document.createElement('style');
        style.textContent = `
            .category-selector-panel > div:nth-child(2)::-webkit-scrollbar {
                display: none;
            }
            .category-selector-panel > div:nth-child(2) {
                scrollbar-width: none;
                -ms-overflow-style: none;
            }
        `;
        if (!document.querySelector('style[data-category-scroll]')) {
            style.setAttribute('data-category-scroll', 'true');
            document.head.appendChild(style);
        }

        // Category options
        const categories = [];

        categories.forEach(category => {
            const categoryOption = document.createElement('div');
            categoryOption.className = 'category-option';
            categoryOption.textContent = category;
            categoryOption.dataset.category = category;
            categoryOption.style.cssText = `
                padding: 12px 8px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                font-family: 'OpenSans', Arial, sans-serif;
                color: #FFFFFF;
                cursor: pointer;
                transition: all 150ms ease-out;
                background-color: transparent;
                min-height: 40px;
                aspect-ratio: 1.5;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
            `;

            // Highlight selected category
            if (category === this.formData.category) {
                categoryOption.style.backgroundColor = 'rgba(184, 232, 76, 0.2)';
                categoryOption.style.color = '#b8e84c';
            }

            categoryOption.addEventListener('mouseenter', () => {
                if (category !== this.formData.category) {
                    categoryOption.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
            });

            categoryOption.addEventListener('mouseleave', () => {
                if (category !== this.formData.category) {
                    categoryOption.style.backgroundColor = 'transparent';
                } else {
                    categoryOption.style.backgroundColor = 'rgba(184, 232, 76, 0.2)';
                }
            });

            categoryOption.addEventListener('click', () => {
                // Update selected category
                this.formData.category = category;

                // Update button text
                const categoryText = this.categoryButton.querySelector('.category-text');
                if (categoryText) {
                    categoryText.textContent = category;
                    categoryText.style.color = '#FFFFFF';
                } else {
                    // Fallback if structure changed
                    this.categoryButton.childNodes[0].textContent = category;
                }

                // Update all options
                categoriesContainer.querySelectorAll('.category-option').forEach(opt => {
                    if (opt.dataset.category === category) {
                        opt.style.backgroundColor = 'rgba(184, 232, 76, 0.2)';
                        opt.style.color = '#b8e84c';
                    } else {
                        opt.style.backgroundColor = 'transparent';
                        opt.style.color = '#FFFFFF';
                    }
                });

                // Hide selector
                this._hideCategorySelector();
            });

            categoriesContainer.appendChild(categoryOption);
        });

        // Add Category button
        const addCategoryButton = document.createElement('div');
        addCategoryButton.className = 'add-category-button';
        addCategoryButton.innerHTML = '<i class="fa-solid fa-plus"></i> Add Category';
        addCategoryButton.style.cssText = `
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            font-family: 'OpenSans', Arial, sans-serif;
            color: #b8e84c;
            cursor: pointer;
            transition: all 150ms ease-out;
            background-color: rgba(184, 232, 76, 0.1);
            border: 2px dashed rgba(184, 232, 76, 0.3);
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            gap: 8px;
            margin-top: 12px;
            box-sizing: border-box;
        `;

        addCategoryButton.addEventListener('mouseenter', () => {
            addCategoryButton.style.backgroundColor = 'rgba(184, 232, 76, 0.2)';
            addCategoryButton.style.borderColor = 'rgba(184, 232, 76, 0.5)';
        });

        addCategoryButton.addEventListener('mouseleave', () => {
            addCategoryButton.style.backgroundColor = 'rgba(184, 232, 76, 0.1)';
            addCategoryButton.style.borderColor = 'rgba(184, 232, 76, 0.3)';
        });

        addCategoryButton.addEventListener('click', () => {
            this._showCreateCategoryPanel();
        });

        categoriesContainer.appendChild(addCategoryButton);

        this.categorySelectorPanel.appendChild(header);
        this.categorySelectorPanel.appendChild(categoriesContainer);

        // Add overlay for category selector
        this.categorySelectorOverlay = document.createElement('div');
        this.categorySelectorOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 10001;
            display: none;
            opacity: 0;
            transition: opacity 200ms ease-in-out;
        `;

        this.categorySelectorOverlay.addEventListener('click', () => {
            this._hideCategorySelector();
        });
    }

    /**
     * Toggle category selector visibility
     */
    _toggleCategorySelector() {
        if (this.isCategorySelectorVisible) {
            this._hideCategorySelector();
        } else {
            this._showCategorySelector();
        }
    }

    /**
     * Show category selector
     */
    async _showCategorySelector() {
        if (!this.categorySelectorPanel.parentNode) {
            document.body.appendChild(this.categorySelectorOverlay);
            document.body.appendChild(this.categorySelectorPanel);
        }

        // Load categories and projects from Firestore
        try {
            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const firebaseAuthInstance = this.firebaseAuth || window.firebaseAuth;

            console.log('🔍 Loading categories and projects...');
            console.log('firebaseAuthInstance:', firebaseAuthInstance);

            if (firebaseAuthInstance && firebaseAuthInstance.db) {
                // Try multiple ways to get current user
                let currentUser = null;
                if (typeof firebaseAuthInstance.getCurrentUser === 'function') {
                    currentUser = firebaseAuthInstance.getCurrentUser();
                } else if (firebaseAuthInstance.auth && firebaseAuthInstance.auth.currentUser) {
                    currentUser = firebaseAuthInstance.auth.currentUser;
                }

                console.log('currentUser:', currentUser);

                if (currentUser) {
                    // Load categories
                    const categoriesRef = collection(firebaseAuthInstance.db, "users", currentUser.uid, "categories");
                    const categoriesSnapshot = await getDocs(categoriesRef);
                    this.categories = [];
                    categoriesSnapshot.forEach((docSnap) => {
                        const catData = docSnap.data();
                        if (catData._type !== 'collection_initializer') {
                            this.categories.push({
                                id: docSnap.id,
                                name: catData.name,
                                color: catData.color || '#b8e84c',
                                icon: catData.icon || 'fa-solid fa-star',
                                type: 'category'
                            });
                        }
                    });
                    console.log('✅ Loaded categories:', this.categories);

                    // Load projects
                    const projectsRef = collection(firebaseAuthInstance.db, "users", currentUser.uid, "projects");
                    const projectsSnapshot = await getDocs(projectsRef);
                    this.projects = [];
                    projectsSnapshot.forEach((docSnap) => {
                        const projData = docSnap.data();
                        if (projData._type !== 'collection_initializer') {
                            this.projects.push({
                                id: docSnap.id,
                                name: projData.name,
                                color: projData.color || '#b8e84c',
                                icon: projData.icon || 'fa-solid fa-rocket',
                                type: 'project'
                            });
                        }
                    });
                    console.log('✅ Loaded projects:', this.projects);

                    // Refresh the selector with loaded data
                    this._refreshCategorySelector();
                } else {
                    console.warn('⚠️ No current user found');
                }
            } else {
                console.warn('⚠️ firebaseAuthInstance or db not available');
            }
        } catch (error) {
            console.error('❌ Error loading categories/projects:', error);
        }

        this.isCategorySelectorVisible = true;
        this.categorySelectorOverlay.style.display = 'block';
        this.categorySelectorPanel.style.display = 'flex';

        requestAnimationFrame(() => {
            this.categorySelectorOverlay.style.opacity = '1';
            this.categorySelectorPanel.style.transform = 'translate(-50%, -50%) scale(1)';
            this.categorySelectorPanel.style.opacity = '1';
        });
    }

    /**
     * Hide category selector
     */
    _hideCategorySelector() {
        this.isCategorySelectorVisible = false;
        this.categorySelectorPanel.style.transform = 'translate(-50%, -50%) scale(0.95)';
        this.categorySelectorPanel.style.opacity = '0';
        this.categorySelectorOverlay.style.opacity = '0';

        setTimeout(() => {
            this.categorySelectorOverlay.style.display = 'none';
            this.categorySelectorPanel.style.display = 'none';
        }, 200);
    }

    /**
     * Initialize create category panel
     */
    _initCreateCategoryPanel() {
        this.createCategoryPanelInstance = new CreateCategoryPanel({
            onCreate: async (category) => {
                // Save to Firestore
                await this._saveCategoryToFirestore(category);

                // Add to categories list
                this.categories.push(category);

                // Refresh category selector
                this._refreshCategorySelector();

                // Notify parent component (e.g., day summary board)
                if (this.onCategoryCreate) {
                    await this.onCategoryCreate();
                }
            },
            onCancel: () => {
                // Do nothing on cancel
            }
        });
    }

    /**
     * Save category to Firestore
     * @param {Object} category - Category object with name, color, icon
     * @returns {Promise<void>}
     */
    async _saveCategoryToFirestore(category) {
        try {
            const { collection, addDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Get Firebase instances
            let firebaseAuthInstance = this.firebaseAuth || window.firebaseAuth;
            let firebaseConfigInstance = this.firebaseConfig || window.firebaseConfig;

            if (!firebaseAuthInstance) {
                console.error('❌ Firebase Auth instance not found');
                alert('Firebase not initialized. Please refresh the page.');
                return;
            }

            // Initialize Firebase Auth if needed
            if (!firebaseAuthInstance.initialized) {
                await firebaseAuthInstance.initialize();
            }

            // Get current user
            const currentUser = firebaseAuthInstance.getCurrentUser();
            if (!currentUser) {
                console.error('❌ No user logged in');
                alert('Please log in to save categories');
                return;
            }

            // Get Firestore instance from firebaseAuth
            // We need to access the db property
            if (!firebaseAuthInstance.db) {
                // Initialize db if not available
                const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                if (firebaseAuthInstance.app) {
                    firebaseAuthInstance.db = getFirestore(firebaseAuthInstance.app);
                } else {
                    console.error('❌ Firebase app not initialized');
                    return;
                }
            }

            // Add category to Firestore
            const categoryRef = collection(firebaseAuthInstance.db, "users", currentUser.uid, "categories");
            const docRef = await addDoc(categoryRef, {
                name: category.name,
                color: category.color,
                icon: category.icon,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });

            // Add document ID to category object for reference
            category.id = docRef.id;

            console.log('✅ Category saved to Firestore:', docRef.id);
        } catch (error) {
            console.error('❌ Error saving category to Firestore:', error);
            alert('Failed to save category. Please try again.');
        }
    }

    /**
     * Show create category panel
     */
    _showCreateCategoryPanel() {
        // Hide category selector first
        this._hideCategorySelector();

        // Show create category panel
        if (this.createCategoryPanelInstance) {
            this.createCategoryPanelInstance.show();
        }
    }


    /**
     * Refresh category selector with updated categories
     */
    _refreshCategorySelector() {
        const categoriesContainer = this.categorySelectorPanel.querySelector('div:nth-child(2)');
        if (!categoriesContainer) return;

        // Remove all category options and section headers (keep Add Category button)
        const categoryOptions = categoriesContainer.querySelectorAll('.category-option, .section-header');
        categoryOptions.forEach(opt => opt.remove());

        const addButton = categoriesContainer.querySelector('.add-category-button');

        // Helper function to delete item from Firestore
        const deleteItem = async (item) => {
            const confirmed = confirm(`Are you sure you want to delete "${item.name}"?`);
            if (!confirmed) return;

            try {
                const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const firebaseAuthInstance = this.firebaseAuth || window.firebaseAuth;

                if (firebaseAuthInstance && firebaseAuthInstance.db) {
                    let currentUser = null;
                    if (typeof firebaseAuthInstance.getCurrentUser === 'function') {
                        currentUser = firebaseAuthInstance.getCurrentUser();
                    } else if (firebaseAuthInstance.auth && firebaseAuthInstance.auth.currentUser) {
                        currentUser = firebaseAuthInstance.auth.currentUser;
                    }

                    if (currentUser && item.id) {
                        const collectionName = item.type === 'project' ? 'projects' : 'categories';
                        const docRef = doc(firebaseAuthInstance.db, "users", currentUser.uid, collectionName, item.id);
                        await deleteDoc(docRef);
                        console.log(`✅ ${item.type} "${item.name}" deleted successfully`);

                        // Remove from local array
                        if (item.type === 'project') {
                            this.projects = this.projects.filter(p => p.id !== item.id);
                        } else {
                            this.categories = this.categories.filter(c => c.id !== item.id);
                        }

                        // Refresh the selector
                        this._refreshCategorySelector();
                    }
                }
            } catch (error) {
                console.error(`❌ Error deleting ${item.type}:`, error);
                alert(`Failed to delete ${item.type}. Please try again.`);
            }
        };

        // Helper function to create an option element (vertical list style)
        const createOption = (item) => {
            const option = document.createElement('div');
            option.className = 'category-option';
            option.dataset.category = item.name;
            option.dataset.type = item.type || 'category';
            option.dataset.id = item.id || '';
            option.style.cssText = `
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                font-family: 'OpenSans', Arial, sans-serif;
                color: #FFFFFF;
                cursor: pointer;
                transition: all 150ms ease-out;
                background-color: rgba(255, 255, 255, 0.03);
                min-height: 44px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                text-align: left;
                border-left: 4px solid ${item.color};
            `;

            // Left side: icon and name
            const leftContent = document.createElement('div');
            leftContent.style.cssText = `
                display: flex;
                align-items: center;
                flex: 1;
            `;
            leftContent.innerHTML = `<i class="${item.icon}" style="margin-right: 12px; width: 20px; text-align: center;"></i>${item.name}`;
            option.appendChild(leftContent);

            // Right side: 3-dot menu button
            const menuBtn = document.createElement('button');
            menuBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
            menuBtn.style.cssText = `
                background: none;
                border: none;
                color: #8E8E93;
                font-size: 16px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: all 150ms ease-out;
                opacity: 1;
            `;

            menuBtn.addEventListener('mouseenter', () => {
                menuBtn.style.color = '#FFFFFF';
                menuBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            });

            menuBtn.addEventListener('mouseleave', () => {
                menuBtn.style.color = '#8E8E93';
                menuBtn.style.backgroundColor = 'transparent';
            });

            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteItem(item);
            });

            option.appendChild(menuBtn);

            // Hover effects for option
            option.addEventListener('mouseenter', () => {
                if (item.name !== this.formData.category) {
                    option.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }
            });

            option.addEventListener('mouseleave', () => {
                if (item.name !== this.formData.category) {
                    option.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                } else {
                    option.style.backgroundColor = 'rgba(184, 232, 76, 0.15)';
                }
            });

            if (item.name === this.formData.category) {
                option.style.backgroundColor = 'rgba(184, 232, 76, 0.15)';
                option.style.color = '#b8e84c';
            }

            // Click handler for selection (on left content only)
            leftContent.addEventListener('click', () => {
                this.formData.category = item.name;
                const categoryText = this.categoryButton.querySelector('.category-text');
                if (categoryText) {
                    categoryText.textContent = item.name;
                    categoryText.style.color = '#FFFFFF';
                }
                categoriesContainer.querySelectorAll('.category-option').forEach(opt => {
                    if (opt.dataset.category === item.name) {
                        opt.style.backgroundColor = 'rgba(184, 232, 76, 0.15)';
                        opt.style.color = '#b8e84c';
                    } else {
                        opt.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                        opt.style.color = '#FFFFFF';
                    }
                });
                this._hideCategorySelector();
            });

            return option;
        };

        // Add Projects section if there are projects
        if (this.projects && this.projects.length > 0) {
            const projectsHeader = document.createElement('div');
            projectsHeader.className = 'section-header';
            projectsHeader.innerHTML = '<i class="fa-solid fa-rocket" style="margin-right: 8px;"></i>Projects';
            projectsHeader.style.cssText = `
                padding: 10px 12px;
                font-size: 12px;
                font-weight: 600;
                font-family: 'OpenSans', Arial, sans-serif;
                color: #b8e84c;
                background: rgba(184, 232, 76, 0.1);
                border-radius: 6px;
                margin-bottom: 4px;
            `;
            if (addButton) {
                categoriesContainer.insertBefore(projectsHeader, addButton);
            } else {
                categoriesContainer.appendChild(projectsHeader);
            }

            this.projects.forEach(project => {
                const option = createOption(project);
                if (addButton) {
                    categoriesContainer.insertBefore(option, addButton);
                } else {
                    categoriesContainer.appendChild(option);
                }
            });
        }

        // Add Categories section if there are categories
        if (this.categories && this.categories.length > 0) {
            const categoriesHeader = document.createElement('div');
            categoriesHeader.className = 'section-header';
            categoriesHeader.innerHTML = '<i class="fa-solid fa-folder" style="margin-right: 8px;"></i>Categories';
            categoriesHeader.style.cssText = `
                padding: 10px 12px;
                font-size: 12px;
                font-weight: 600;
                font-family: 'OpenSans', Arial, sans-serif;
                color: #8E8E93;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 6px;
                margin-top: 12px;
                margin-bottom: 4px;
            `;
            if (addButton) {
                categoriesContainer.insertBefore(categoriesHeader, addButton);
            } else {
                categoriesContainer.appendChild(categoriesHeader);
            }

            this.categories.forEach(category => {
                const option = createOption(category);
                if (addButton) {
                    categoriesContainer.insertBefore(option, addButton);
                } else {
                    categoriesContainer.appendChild(option);
                }
            });
        }
    }

    /**
     * Create repeat selection section
     */
    _createRepeatSection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Repeat';
        label.style.cssText = `
            color: #999;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        `;

        const repeatOptions = ['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

        repeatOptions.forEach((option, index) => {
            const button = document.createElement('button');
            button.textContent = option;
            button.dataset.repeat = option;
            button.style.cssText = `
                background-color: ${index === 0 ? '#b8e84c' : '#2a2a2a'};
                color: ${index === 0 ? '#000' : '#999'};
                border: 2px solid ${index === 0 ? '#b8e84c' : '#2a2a2a'};
                padding: 12px;
                border-radius: 12px;
                font-size: 14px;
                font-weight: bold;
                font-family: 'OpenSans', Arial, sans-serif;
                cursor: pointer;
                transition: all 0.2s;
            `;

            button.addEventListener('click', () => {
                // Update all buttons
                this.repeatButtons.forEach(btn => {
                    btn.style.backgroundColor = '#2a2a2a';
                    btn.style.color = '#999';
                    btn.style.borderColor = '#2a2a2a';
                });

                // Highlight selected button
                button.style.backgroundColor = '#b8e84c';
                button.style.color = '#000';
                button.style.borderColor = '#b8e84c';

                this.formData.repeat = option;

                // Show/hide duration input based on selection
                this._updateRepeatDurationInput(option);
            });

            this.repeatButtons.push(button);
            buttonsContainer.appendChild(button);
        });

        // Create duration input section (hidden by default)
        this.repeatDurationSection = this._createRepeatDurationInput();

        container.appendChild(label);
        container.appendChild(buttonsContainer);
        container.appendChild(this.repeatDurationSection);

        return container;
    }

    /**
     * Create repeat duration input
     */
    _createRepeatDurationInput() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: none;
            flex-direction: column;
            gap: 8px;
            margin-top: 8px;
        `;

        this.repeatDurationLabel = document.createElement('label');
        this.repeatDurationLabel.textContent = 'Duration';
        this.repeatDurationLabel.style.cssText = `
            color: #b8e84c;
            font-size: 12px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        this.repeatDurationInput = document.createElement('input');
        this.repeatDurationInput.type = 'number';
        this.repeatDurationInput.min = '1';
        this.repeatDurationInput.value = '1';
        this.repeatDurationInput.placeholder = 'Enter duration';
        this.repeatDurationInput.style.cssText = `
            background-color: #2a2a2a;
            color: #fff;
            border: none;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 16px;
            font-family: 'OpenSans', Arial, sans-serif;
            outline: none;
        `;

        this.repeatDurationInput.addEventListener('focus', () => {
            this.repeatDurationInput.style.backgroundColor = '#333';
        });

        this.repeatDurationInput.addEventListener('blur', () => {
            this.repeatDurationInput.style.backgroundColor = '#2a2a2a';
        });

        this.repeatDurationInput.addEventListener('input', () => {
            this.formData.repeatDuration = parseInt(this.repeatDurationInput.value) || 1;
        });

        // Forever checkbox
        const foreverContainer = document.createElement('div');
        foreverContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            background-color: #2a2a2a;
            padding: 12px 16px;
            border-radius: 12px;
            cursor: pointer;
        `;

        this.repeatForeverCheckbox = document.createElement('input');
        this.repeatForeverCheckbox.type = 'checkbox';
        this.repeatForeverCheckbox.id = 'repeatForever';
        this.repeatForeverCheckbox.style.cssText = `
            width: 20px;
            height: 20px;
            cursor: pointer;
            accent-color: #b8e84c;
        `;

        const foreverLabel = document.createElement('label');
        foreverLabel.htmlFor = 'repeatForever';
        foreverLabel.textContent = 'Repeat Forever';
        foreverLabel.style.cssText = `
            flex: 1;
            color: #fff;
            font-size: 14px;
            font-family: 'OpenSans', Arial, sans-serif;
            cursor: pointer;
        `;

        this.repeatForeverCheckbox.addEventListener('change', () => {
            this.formData.repeatForever = this.repeatForeverCheckbox.checked;
            if (this.repeatForeverCheckbox.checked) {
                // Disable duration input when forever is checked
                this.repeatDurationInput.disabled = true;
                this.repeatDurationInput.style.opacity = '0.5';
                this.repeatDurationInput.style.cursor = 'not-allowed';
            } else {
                // Enable duration input when forever is unchecked
                this.repeatDurationInput.disabled = false;
                this.repeatDurationInput.style.opacity = '1';
                this.repeatDurationInput.style.cursor = 'text';
            }
        });

        foreverContainer.appendChild(this.repeatForeverCheckbox);
        foreverContainer.appendChild(foreverLabel);

        container.appendChild(this.repeatDurationLabel);
        container.appendChild(this.repeatDurationInput);
        container.appendChild(foreverContainer);

        return container;
    }

    /**
     * Update repeat duration input based on repeat type
     */
    _updateRepeatDurationInput(repeatType) {
        const config = {
            'Daily': { show: true, label: 'Number of Days', max: 365, placeholder: 'How many days?' },
            'Weekly': { show: true, label: 'Number of Weeks', max: 52, placeholder: 'How many weeks?' },
            'Monthly': { show: true, label: 'Number of Months', max: 24, placeholder: 'How many months?' },
            'Yearly': { show: true, label: 'Number of Years', max: 10, placeholder: 'How many years?' },
            'None': { show: false }
        };

        const setting = config[repeatType];

        if (setting.show) {
            this.repeatDurationSection.style.display = 'flex';
            this.repeatDurationLabel.textContent = setting.label;
            this.repeatDurationInput.max = setting.max;
            this.repeatDurationInput.placeholder = setting.placeholder;
            // Reset forever checkbox
            this.repeatForeverCheckbox.checked = false;
            this.formData.repeatForever = false;
            this.repeatDurationInput.disabled = false;
            this.repeatDurationInput.style.opacity = '1';
            this.repeatDurationInput.style.cursor = 'text';
        } else {
            this.repeatDurationSection.style.display = 'none';
            this.repeatDurationInput.value = '1';
            this.formData.repeatDuration = 1;
            this.repeatForeverCheckbox.checked = false;
            this.formData.repeatForever = false;
        }
    }

    /**
     * Create description input section
     */
    _createDescriptionSection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Description (Optional)';
        label.style.cssText = `
            color: #999;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        this.descriptionInput = document.createElement('textarea');
        this.descriptionInput.placeholder = 'Enter task description';
        this.descriptionInput.rows = 4;
        this.descriptionInput.style.cssText = `
            background-color: #2a2a2a;
            color: #fff;
            border: none;
            padding: 14px 16px;
            border-radius: 12px;
            font-size: 14px;
            font-family: 'OpenSans', Arial, sans-serif;
            outline: none;
            resize: vertical;
        `;

        this.descriptionInput.addEventListener('focus', () => {
            this.descriptionInput.style.backgroundColor = '#333';
        });

        this.descriptionInput.addEventListener('blur', () => {
            this.descriptionInput.style.backgroundColor = '#2a2a2a';
        });

        container.appendChild(label);
        container.appendChild(this.descriptionInput);

        return container;
    }

    /**
     * Create requirements input section
     */
    _createRequirementsSection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Requirements (Optional)';
        label.style.cssText = `
            color: #999;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        this.requirementsContainer = document.createElement('div');
        this.requirementsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        // Add requirement button
        const addButton = document.createElement('button');
        addButton.innerHTML = '<i class="fa-solid fa-plus"></i> Add Requirement';
        addButton.style.cssText = `
            background-color: #2a2a2a;
            color: #b8e84c;
            border: 2px dashed #666;
            padding: 12px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: bold;
            font-family: 'OpenSans', Arial, sans-serif;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
        `;

        addButton.addEventListener('mouseenter', () => {
            addButton.style.backgroundColor = '#333';
            addButton.style.borderColor = '#b8e84c';
        });

        addButton.addEventListener('mouseleave', () => {
            addButton.style.backgroundColor = '#2a2a2a';
            addButton.style.borderColor = '#666';
        });

        addButton.addEventListener('click', () => {
            this._addRequirementInput();
        });

        container.appendChild(label);
        container.appendChild(this.requirementsContainer);
        container.appendChild(addButton);

        return container;
    }

    /**
     * Add a requirement input field
     */
    _addRequirementInput(value = '') {
        const requirementItem = document.createElement('div');
        requirementItem.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter requirement';
        input.value = value;
        input.style.cssText = `
            flex: 1;
            background-color: #2a2a2a;
            color: #fff;
            border: none;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 14px;
            font-family: 'OpenSans', Arial, sans-serif;
            outline: none;
        `;

        input.addEventListener('focus', () => {
            input.style.backgroundColor = '#333';
        });

        input.addEventListener('blur', () => {
            input.style.backgroundColor = '#2a2a2a';
        });

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteButton.style.cssText = `
            background-color: rgba(255, 68, 68, 0.2);
            color: #ff4444;
            border: none;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;

        deleteButton.addEventListener('mouseenter', () => {
            deleteButton.style.backgroundColor = 'rgba(255, 68, 68, 0.3)';
        });

        deleteButton.addEventListener('mouseleave', () => {
            deleteButton.style.backgroundColor = 'rgba(255, 68, 68, 0.2)';
        });

        deleteButton.addEventListener('click', () => {
            requirementItem.remove();
            const index = this.requirementsList.indexOf(input);
            if (index > -1) {
                this.requirementsList.splice(index, 1);
            }
        });

        requirementItem.appendChild(input);
        requirementItem.appendChild(deleteButton);
        this.requirementsContainer.appendChild(requirementItem);
        this.requirementsList.push(input);
    }

    /**
     * Create the create button
     */
    _createButton() {
        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'event-card-create-button-wrapper';

        const buttonHeight = 50;
        const borderRadius = buttonHeight / 2;

        buttonWrapper.style.cssText = `
            position: relative;
            width: 100%;
            margin-top: 8px;
            background-color: transparent;
            border-radius: ${borderRadius}px;
            z-index: 1;
            pointer-events: auto;
        `;

        const button = document.createElement('button');
        button.className = 'event-card-create-button';
        button.textContent = 'Create Task';

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
            pointer-events: auto;
        `;

        button.addEventListener('click', () => {
            this._handleCreate();
        });

        buttonWrapper.appendChild(button);

        return buttonWrapper;
    }

    /**
     * Check if device is desktop/PC
     */
    _isDesktop() {
        return window.innerWidth >= 768 && !('ontouchstart' in window);
    }

    /**
     * Create time picker panel - chooses style based on device
     */
    _createTimePicker() {
        if (this._isDesktop()) {
            return this._createDesktopTimePicker();
        } else {
            return this._createMobileTimePicker();
        }
    }

    /**
     * Create Microsoft-style flyout time picker for desktop
     */
    _createDesktopTimePicker() {
        const picker = document.createElement('div');
        picker.className = 'time-picker-panel desktop-time-picker';
        picker.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            background-color: #2c2c2c;
            border-radius: 8px;
            z-index: 10001;
            padding: 0;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            opacity: 0;
            transition: all 0.2s ease-out;
            box-sizing: border-box;
            min-width: 320px;
            border: 1px solid #404040;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid #404040;
        `;

        const title = document.createElement('span');
        title.textContent = 'Select Time';
        title.style.cssText = `
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            font-family: 'Segoe UI', 'OpenSans', sans-serif;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #999;
            font-size: 16px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background 0.15s;
        `;
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(255,255,255,0.1)');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'none');
        closeBtn.addEventListener('click', () => this._hideTimePicker());

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Columns container
        const columnsContainer = document.createElement('div');
        columnsContainer.style.cssText = `
            display: flex;
            padding: 12px;
            gap: 8px;
        `;

        // Create column helper (no scroll, show all items)
        const createColumn = (items, width, initialValue) => {
            const column = document.createElement('div');
            column.style.cssText = `
                width: ${width}px;
                display: flex;
                flex-direction: column;
                background: #1a1a1a;
                border-radius: 6px;
                padding: 4px;
            `;

            let selectedValue = initialValue;

            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.dataset.value = item.value;
                itemEl.textContent = item.label;
                itemEl.style.cssText = `
                    padding: 8px 12px;
                    font-size: 14px;
                    font-family: 'Segoe UI', 'OpenSans', sans-serif;
                    color: ${item.value === initialValue ? '#b8e84c' : '#ccc'};
                    background: ${item.value === initialValue ? 'rgba(184, 232, 76, 0.15)' : 'transparent'};
                    cursor: pointer;
                    text-align: center;
                    transition: background 0.1s, color 0.1s;
                    border-radius: 4px;
                `;

                itemEl.addEventListener('mouseenter', () => {
                    if (item.value !== selectedValue) {
                        itemEl.style.background = 'rgba(255,255,255,0.08)';
                    }
                });

                itemEl.addEventListener('mouseleave', () => {
                    if (item.value !== selectedValue) {
                        itemEl.style.background = 'transparent';
                    }
                });

                itemEl.addEventListener('click', () => {
                    // Update all items in column
                    column.querySelectorAll('[data-value]').forEach(el => {
                        el.style.color = '#ccc';
                        el.style.background = 'transparent';
                    });
                    itemEl.style.color = '#b8e84c';
                    itemEl.style.background = 'rgba(184, 232, 76, 0.15)';
                    selectedValue = item.value;
                });

                column.appendChild(itemEl);
            });

            column.getValue = () => selectedValue;
            return column;
        };

        // Hour items (1-12)
        const hourItems = [];
        for (let i = 1; i <= 12; i++) {
            hourItems.push({ value: i.toString(), label: i.toString().padStart(2, '0') });
        }

        // Minute items (00-55, step 5)
        const minuteItems = [];
        for (let i = 0; i < 60; i += 5) {
            minuteItems.push({ value: i.toString(), label: i.toString().padStart(2, '0') });
        }

        // Period items
        const periodItems = [
            { value: 'AM', label: 'AM' },
            { value: 'PM', label: 'PM' }
        ];

        const hourColumn = createColumn(hourItems, 90, '10');
        const minuteColumn = createColumn(minuteItems, 90, '0');
        const periodColumn = createColumn(periodItems, 80, 'AM');

        columnsContainer.appendChild(hourColumn);
        columnsContainer.appendChild(minuteColumn);
        columnsContainer.appendChild(periodColumn);

        // Store references
        this.timePickerHourColumn = hourColumn;
        this.timePickerMinuteColumn = minuteColumn;
        this.timePickerPeriodColumn = periodColumn;

        // Footer with confirm button
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 12px 16px;
            border-top: 1px solid #404040;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            background: transparent;
            border: 1px solid #666;
            color: #ccc;
            padding: 8px 20px;
            border-radius: 4px;
            font-size: 14px;
            font-family: 'Segoe UI', 'OpenSans', sans-serif;
            cursor: pointer;
            transition: all 0.15s;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.1)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'transparent';
        });
        cancelBtn.addEventListener('click', () => this._hideTimePicker());

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'OK';
        confirmBtn.style.cssText = `
            background: #b8e84c;
            border: none;
            color: #000;
            padding: 8px 24px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            font-family: 'Segoe UI', 'OpenSans', sans-serif;
            cursor: pointer;
            transition: all 0.15s;
        `;
        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.background = '#a8d83c';
        });
        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.background = '#b8e84c';
        });
        confirmBtn.addEventListener('click', () => {
            const hour = hourColumn.getValue();
            const minute = minuteColumn.getValue().padStart(2, '0');
            const period = periodColumn.getValue();
            const timeString = `${hour}:${minute} ${period}`;

            if (this.activeTimeInput) {
                this.activeTimeInput.textContent = timeString;
                this.activeTimeInput.style.color = '#fff';
                this.activeTimeInput.dataset.placeholder = 'false';
            }

            this._hideTimePicker();
        });

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        picker.appendChild(header);
        picker.appendChild(columnsContainer);
        picker.appendChild(footer);

        return picker;
    }

    /**
     * Create Apple Clock style wheel picker for mobile
     */
    _createMobileTimePicker() {
        const picker = document.createElement('div');
        picker.className = 'time-picker-panel mobile-time-picker';
        picker.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%) translateY(100%);
            width: 100%;
            max-width: 414px;
            background-color: #1c1c1e;
            border-radius: 24px 24px 0 0;
            z-index: 10001;
            padding: 20px;
            box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.6);
            transition: transform 0.3s ease-out;
            box-sizing: border-box;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            background: none;
            border: none;
            color: #ff453a;
            font-size: 17px;
            font-family: 'OpenSans', sans-serif;
            cursor: pointer;
            padding: 8px 12px;
        `;
        cancelBtn.addEventListener('click', () => this._hideTimePicker());

        const title = document.createElement('span');
        title.textContent = 'Select Time';
        title.style.cssText = `
            color: #fff;
            font-size: 17px;
            font-weight: 600;
            font-family: 'OpenSans', sans-serif;
        `;

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Done';
        confirmBtn.style.cssText = `
            background: none;
            border: none;
            color: #b8e84c;
            font-size: 17px;
            font-weight: 600;
            font-family: 'OpenSans', sans-serif;
            cursor: pointer;
            padding: 8px 12px;
        `;

        header.appendChild(cancelBtn);
        header.appendChild(title);
        header.appendChild(confirmBtn);

        // Wheel picker container
        const wheelContainer = document.createElement('div');
        wheelContainer.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            position: relative;
            overflow: hidden;
            background: #2c2c2e;
            border-radius: 12px;
            margin-bottom: 16px;
        `;

        // Selection indicator (the highlighted row in the middle)
        const selectionIndicator = document.createElement('div');
        selectionIndicator.style.cssText = `
            position: absolute;
            left: 8px;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            height: 40px;
            background: rgba(118, 118, 128, 0.24);
            border-radius: 8px;
            pointer-events: none;
            z-index: 1;
        `;
        wheelContainer.appendChild(selectionIndicator);

        // Create wheel column helper
        const createWheelColumn = (items, width, initialIndex = 0) => {
            const column = document.createElement('div');
            column.style.cssText = `
                width: ${width}px;
                height: 200px;
                overflow-y: scroll;
                scroll-snap-type: y mandatory;
                -webkit-overflow-scrolling: touch;
                position: relative;
                z-index: 2;
            `;
            // Hide scrollbar
            column.style.scrollbarWidth = 'none';
            column.style.msOverflowStyle = 'none';

            // Padding items for centering (2 items top and bottom)
            const itemHeight = 40;
            const paddingItems = 2;

            // Top padding
            for (let i = 0; i < paddingItems; i++) {
                const spacer = document.createElement('div');
                spacer.style.cssText = `height: ${itemHeight}px;`;
                column.appendChild(spacer);
            }

            // Actual items
            items.forEach((item, index) => {
                const itemEl = document.createElement('div');
                itemEl.dataset.value = item.value;
                itemEl.dataset.index = index;
                itemEl.textContent = item.label;
                itemEl.style.cssText = `
                    height: ${itemHeight}px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 22px;
                    font-weight: 500;
                    font-family: 'SF Pro Display', 'OpenSans', sans-serif;
                    color: #fff;
                    scroll-snap-align: center;
                    cursor: pointer;
                    transition: opacity 0.15s, transform 0.15s;
                `;
                column.appendChild(itemEl);
            });

            // Bottom padding
            for (let i = 0; i < paddingItems; i++) {
                const spacer = document.createElement('div');
                spacer.style.cssText = `height: ${itemHeight}px;`;
                column.appendChild(spacer);
            }

            // Set initial position
            requestAnimationFrame(() => {
                column.scrollTop = initialIndex * itemHeight;
            });

            // Update visual feedback on scroll
            const updateVisualFeedback = () => {
                const centerY = column.scrollTop + column.clientHeight / 2;
                const allItems = column.querySelectorAll('[data-index]');
                allItems.forEach(item => {
                    const itemTop = item.offsetTop;
                    const itemCenter = itemTop + itemHeight / 2;
                    const distance = Math.abs(centerY - itemCenter);
                    const maxDistance = itemHeight * 2;
                    const opacity = Math.max(0.3, 1 - (distance / maxDistance) * 0.7);
                    const scale = Math.max(0.85, 1 - (distance / maxDistance) * 0.15);
                    item.style.opacity = opacity;
                    item.style.transform = `scale(${scale})`;
                });
            };

            column.addEventListener('scroll', updateVisualFeedback);
            requestAnimationFrame(updateVisualFeedback);

            // Get current selected value
            column.getValue = () => {
                const centerY = column.scrollTop + column.clientHeight / 2;
                const allItems = column.querySelectorAll('[data-index]');
                let closestItem = allItems[0];
                let minDistance = Infinity;
                allItems.forEach(item => {
                    const itemCenter = item.offsetTop + itemHeight / 2;
                    const distance = Math.abs(centerY - itemCenter);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestItem = item;
                    }
                });
                return closestItem.dataset.value;
            };

            return column;
        };

        // Hour items (1-12)
        const hourItems = [];
        for (let i = 1; i <= 12; i++) {
            hourItems.push({ value: i.toString(), label: i.toString() });
        }

        // Minute items (00-55, step 5)
        const minuteItems = [];
        for (let i = 0; i < 60; i += 5) {
            minuteItems.push({ value: i.toString(), label: i.toString().padStart(2, '0') });
        }

        // Period items
        const periodItems = [
            { value: 'AM', label: 'AM' },
            { value: 'PM', label: 'PM' }
        ];

        // Create columns
        const hourColumn = createWheelColumn(hourItems, 70, 9); // Default to 10
        const minuteColumn = createWheelColumn(minuteItems, 70, 0); // Default to 00
        const periodColumn = createWheelColumn(periodItems, 70, 0); // Default to AM

        // Colon separator
        const colon = document.createElement('div');
        colon.textContent = ':';
        colon.style.cssText = `
            font-size: 26px;
            font-weight: 600;
            color: #fff;
            padding: 0 4px;
        `;

        wheelContainer.appendChild(hourColumn);
        wheelContainer.appendChild(colon);
        wheelContainer.appendChild(minuteColumn);
        wheelContainer.appendChild(periodColumn);

        // Store references
        this.timePickerHourColumn = hourColumn;
        this.timePickerMinuteColumn = minuteColumn;
        this.timePickerPeriodColumn = periodColumn;

        // Confirm button action
        confirmBtn.addEventListener('click', () => {
            const hour = hourColumn.getValue();
            const minute = minuteColumn.getValue().padStart(2, '0');
            const period = periodColumn.getValue();
            const timeString = `${hour}:${minute} ${period}`;

            if (this.activeTimeInput) {
                this.activeTimeInput.textContent = timeString;
                this.activeTimeInput.style.color = '#fff';
                this.activeTimeInput.dataset.placeholder = 'false';
            }

            this._hideTimePicker();
        });

        // Add hide scrollbar style
        if (!document.getElementById('wheel-picker-style')) {
            const style = document.createElement('style');
            style.id = 'wheel-picker-style';
            style.textContent = `
                .time-picker-panel div::-webkit-scrollbar {
                    display: none;
                }
            `;
            document.head.appendChild(style);
        }

        picker.appendChild(header);
        picker.appendChild(wheelContainer);

        return picker;
    }

    /**
     * Show time picker
     */
    _showTimePicker() {
        if (!this.timePickerPanel) {
            this.timePickerPanel = this._createTimePicker();
            document.body.appendChild(this.timePickerPanel);
        }

        // Show with animation based on device type
        requestAnimationFrame(() => {
            if (this._isDesktop()) {
                // Desktop: fade in and scale
                this.timePickerPanel.style.opacity = '1';
                this.timePickerPanel.style.transform = 'translate(-50%, -50%) scale(1)';
            } else {
                // Mobile: slide up from bottom
                this.timePickerPanel.style.transform = 'translateX(-50%) translateY(0)';
            }
        });
    }

    /**
     * Hide time picker
     */
    _hideTimePicker() {
        if (this.timePickerPanel) {
            // Prevent interactions while animating out
            this.timePickerPanel.style.pointerEvents = 'none';

            if (this._isDesktop()) {
                // Desktop: fade out and scale
                this.timePickerPanel.style.opacity = '0';
                this.timePickerPanel.style.transform = 'translate(-50%, -50%) scale(0.95)';
            } else {
                // Mobile: slide down
                this.timePickerPanel.style.transform = 'translateX(-50%) translateY(100%)';
            }

            // Remove from DOM after animation
            setTimeout(() => {
                if (this.timePickerPanel && this.timePickerPanel.parentNode) {
                    this.timePickerPanel.parentNode.removeChild(this.timePickerPanel);
                }
                this.timePickerPanel = null;
            }, 300); // 300ms matches CSS transition
        }
    }

    /**
     * Handle create button click
     */
    async _handleCreate() {
        // Get time values
        const timeFrom = this.timeFromInput.dataset.placeholder === 'false'
            ? this.timeFromInput.textContent
            : '';
        const timeTo = this.timeToInput.dataset.placeholder === 'false'
            ? this.timeToInput.textContent
            : '';

        // If user didn't select time, set to 'none' (event only shows on dashboard)
        let timeString;
        if (timeFrom && timeTo) {
            timeString = `from ${timeFrom} to ${timeTo}`;
        } else if (timeFrom) {
            // Only start time selected, use 30 min duration
            timeString = `from ${timeFrom} to ${timeFrom}`;
        } else {
            // No time selected - event only shows on dashboard
            timeString = 'none';
        }

        // Gather form data
        const data = {
            title: this.titleInput.value.trim() || 'Untitled Task',
            time: timeString,
            date: this.dateInput.value || new Date().toISOString().split('T')[0],
            category: this.formData.category,
            priority: this.formData.priority,
            repeat: this.formData.repeat,
            description: this.descriptionInput.value.trim(),
            requirements: this.requirementsList.map(input => ({
                text: input.value.trim(),
                checked: false
            })).filter(req => req.text !== '')
        };

        // Add repeatDuration or repeatForever for Daily, Weekly, Monthly, Yearly
        if (['Daily', 'Weekly', 'Monthly', 'Yearly'].includes(this.formData.repeat)) {
            if (this.formData.repeatForever) {
                data.repeatForever = true;
            } else {
                data.repeatDuration = this.formData.repeatDuration;
            }
        }

        // Save to Firestore
        await this._saveEventToFirestore(data);

        // Call onCreate callback
        if (this.onCreate) {
            this.onCreate(data);
        }

        // Reset form and hide
        this._resetForm();
        this.hide();
    }

    /**
     * Save event/task to Firestore
     * @param {Object} eventData - Event/task data object
     * @returns {Promise<void>}
     */
    async _saveEventToFirestore(eventData) {
        try {
            const { collection, addDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Get Firebase instances
            let firebaseAuthInstance = this.firebaseAuth || window.firebaseAuth;

            if (!firebaseAuthInstance) {
                console.error('❌ Firebase Auth instance not found');
                alert('Firebase not initialized. Please refresh the page.');
                return;
            }

            // Initialize Firebase Auth if needed
            if (!firebaseAuthInstance.initialized) {
                await firebaseAuthInstance.initialize();
            }

            // Get current user
            const currentUser = firebaseAuthInstance.getCurrentUser();
            if (!currentUser) {
                console.error('❌ No user logged in');
                alert('Please log in to save events');
                return;
            }

            // Get Firestore instance from firebaseAuth
            if (!firebaseAuthInstance.db) {
                // Initialize db if not available
                const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                if (firebaseAuthInstance.app) {
                    firebaseAuthInstance.db = getFirestore(firebaseAuthInstance.app);
                } else {
                    console.error('❌ Firebase app not initialized');
                    return;
                }
            }

            // Prepare event data for Firestore
            const firestoreData = {
                title: eventData.title,
                time: eventData.time,
                date: eventData.date,
                category: eventData.category || '',
                priority: eventData.priority || 'High',
                repeat: eventData.repeat || 'None',
                description: eventData.description || '',
                requirements: eventData.requirements || [],
                isComplete: eventData.isComplete || false,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            // Add repeat settings if applicable
            if (eventData.repeatForever !== undefined) {
                firestoreData.repeatForever = eventData.repeatForever;
            }
            if (eventData.repeatDuration !== undefined) {
                firestoreData.repeatDuration = eventData.repeatDuration;
            }

            // Add event to Firestore
            const eventRef = collection(firebaseAuthInstance.db, "users", currentUser.uid, "events");
            const docRef = await addDoc(eventRef, firestoreData);

            // Add document ID to event data for reference
            eventData.id = docRef.id;

            console.log('✅ Event saved to Firestore:', docRef.id);
        } catch (error) {
            console.error('❌ Error saving event to Firestore:', error);
            alert('Failed to save event. Please try again.');
        }
    }

    /**
     * Reset form to default values
     */
    _resetForm() {
        this.titleInput.value = '';

        // Reset time inputs
        this.timeFromInput.textContent = 'From';
        this.timeFromInput.style.color = '#666';
        this.timeFromInput.dataset.placeholder = 'true';
        this.timeToInput.textContent = 'To';
        this.timeToInput.style.color = '#666';
        this.timeToInput.dataset.placeholder = 'true';

        // Reset date to today
        this.selectedDate = new Date();
        this.dateInput.value = this._formatDateLocal(this.selectedDate);
        if (this.dateButton) {
            this._updateDateButtonText();
        }

        // Reset category
        this.formData.category = '';
        if (this.categoryButton) {
            const categoryText = this.categoryButton.querySelector('.category-text');
            if (categoryText) {
                categoryText.textContent = 'Select category';
                categoryText.style.color = '#8E8E93';
            } else {
                // Fallback if structure changed
                this.categoryButton.childNodes[0].textContent = 'Select category';
            }
        }

        this.descriptionInput.value = '';

        // Reset priority buttons
        this.priorityButtons.forEach((btn, index) => {
            if (index === 0) {
                btn.style.backgroundColor = '#ff1d25';
                btn.style.color = '#fff';
                btn.style.borderColor = '#ff1d25';
            } else {
                btn.style.backgroundColor = '#2a2a2a';
                btn.style.color = '#999';
                btn.style.borderColor = '#2a2a2a';
            }
        });

        // Reset repeat buttons
        this.repeatButtons.forEach((btn, index) => {
            if (index === 0) {
                btn.style.backgroundColor = '#b8e84c';
                btn.style.color = '#000';
                btn.style.borderColor = '#b8e84c';
            } else {
                btn.style.backgroundColor = '#2a2a2a';
                btn.style.color = '#999';
                btn.style.borderColor = '#2a2a2a';
            }
        });

        // Hide repeat duration section and reset input
        if (this.repeatDurationSection) {
            this.repeatDurationSection.style.display = 'none';
        }
        if (this.repeatDurationInput) {
            this.repeatDurationInput.value = '1';
            this.repeatDurationInput.disabled = false;
            this.repeatDurationInput.style.opacity = '1';
            this.repeatDurationInput.style.cursor = 'text';
        }
        if (this.repeatForeverCheckbox) {
            this.repeatForeverCheckbox.checked = false;
        }

        // Collapse advance section
        if (this.isAdvanceExpanded) {
            this._toggleAdvanceSection();
        }

        // Clear requirements
        this.requirementsContainer.innerHTML = '';
        this.requirementsList = [];

        this.formData = {
            title: '',
            time: '',
            date: this._formatDateLocal(new Date()),
            category: '',
            priority: 'High',
            repeat: 'None',
            repeatDuration: 1,
            repeatForever: false,
            description: '',
            requirements: []
        };
    }

    /**
     * Add swipe handlers for drag-to-dismiss
     */
    _addSwipeHandlers() {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const handleTouchStart = (e) => {
            startY = e.touches[0].clientY;
            currentY = startY;
            isDragging = false;
            this.modalHeight = this.modal.offsetHeight;
        };

        const handleTouchMove = (e) => {
            // Disable drag-to-dismiss for floating panel
            if (!startY) return;
        };

        const handleTouchEnd = () => {
            // Disable drag-to-dismiss for floating panel
            if (!startY) return;

            startY = 0;
            currentY = 0;
            isDragging = false;
        };

        // Mouse events
        let mouseStartY = 0;
        let mouseCurrentY = 0;
        let isMouseDragging = false;

        const handleMouseDown = (e) => {
            // Disable drag for floating panel - only allow click outside to close
            return;

            mouseStartY = e.clientY;
            mouseCurrentY = mouseStartY;
            isMouseDragging = false;
            this.modalHeight = this.modal.offsetHeight;
            e.preventDefault();
        };

        const handleMouseMove = (e) => {
            // Disable drag-to-dismiss for floating panel
            if (!mouseStartY) return;
        };

        const handleMouseUp = () => {
            // Disable drag-to-dismiss for floating panel
            if (!mouseStartY) return;

            mouseStartY = 0;
            mouseCurrentY = 0;
            isMouseDragging = false;
        };

        this.modal.addEventListener('touchstart', handleTouchStart, { passive: true });
        this.modal.addEventListener('touchmove', handleTouchMove, { passive: true });
        this.modal.addEventListener('touchend', handleTouchEnd, { passive: true });

        this.modal.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    /**
     * Show the modal
     */
    show(parentElement = document.body) {
        if (!this.isVisible) {
            this.originalBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';

            if (!this.overlay.parentNode) {
                parentElement.appendChild(this.overlay);
            }
            if (!this.modal.parentNode) {
                parentElement.appendChild(this.modal);
            }

            // Ensure advance section is collapsed
            if (this.isAdvanceExpanded) {
                this.isAdvanceExpanded = false;
                if (this.advanceSection) {
                    this.advanceSection.style.display = 'none';
                    this.advanceSection.style.maxHeight = '0';
                    this.advanceSection.style.opacity = '0';
                }
                if (this.advanceButton) {
                    this.advanceButton.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Advance';
                    this.advanceButton.style.backgroundColor = '#2a2a2a';
                    this.advanceButton.style.borderColor = '#2a2a2a';
                }
            }

            this.overlay.style.display = 'block';
            this.modal.style.display = 'flex';

            requestAnimationFrame(() => {
                this.overlay.style.opacity = '1';
                this.modal.style.transform = 'translate(-50%, -50%) scale(1)';
                this.modal.style.opacity = '1';
            });

            this.isVisible = true;
        }
    }

    /**
     * Hide the modal
     */
    hide() {
        if (this.isVisible) {
            // Hide time picker if open
            this._hideTimePicker();

            // Hide date picker if open
            this._hideDatePicker();

            this.modal.style.transform = 'translate(-50%, -50%) scale(0.9)';
            this.modal.style.opacity = '0';
            this.overlay.style.opacity = '0';

            setTimeout(() => {
                this.overlay.style.display = 'none';
                this.modal.style.display = 'none';
                this.isVisible = false;

                if (this.originalBodyOverflow !== null) {
                    document.body.style.overflow = this.originalBodyOverflow;
                } else {
                    document.body.style.overflow = '';
                }
            }, 300);
        }
    }

    /**
     * Show category creation panel directly
     */
    showCategoryCreation() {
        if (this.createCategoryPanelInstance) {
            this.createCategoryPanelInstance.show();
        }
    }
}

