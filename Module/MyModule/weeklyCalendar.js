class WeeklyCalendar {
    constructor(options = {}) {
        this.firebaseAuth = options.firebaseAuth || null;
        this.firebaseConfig = options.firebaseConfig || null;
        this.onEventClick = options.onEventClick || null;
        this.onEventUpdate = options.onEventUpdate || null; // Callback when event is updated/completed

        // Week start configuration: true = Monday, false = Sunday
        this.weekStartsOnMonday = options.weekStartsOnMonday !== false; // Default to Monday

        this.container = null;
        this.currentWeekStart = null;
        this.events = [];
        this.eventCards = []; // Store EventCard instances
        this.eventDetailView = null; // EventCardDetailView instance
        this._loadRequestId = 0; // Track async load requests to prevent race conditions
        this.resizeObserver = null; // ResizeObserver to monitor grid width changes
        this.resizeTimeout = null; // Debounce resize updates

        this._initWeek();
        this._createCalendar();
        this._initEventDetailView();
        this._initResizeObserver(); // Initialize resize observer
    }

    /**
     * Initialize Event Detail View
     */
    _initEventDetailView() {
        this.currentEventData = null; // Store current event being viewed

        this.eventDetailView = new EventCardDetailView({
            onComplete: async () => {
                console.log('Event completed');

                // Update isComplete status in Firestore
                if (this.currentEventData && this.currentEventData.id) {
                    await this._updateEventCompleteStatus(this.currentEventData.id, true, this.currentEventData);
                }

                this.eventDetailView.hide();
                // Refresh calendar to show updated status
                await this.refresh();

                // Notify parent component (e.g., day summary board)
                if (this.onEventUpdate) {
                    this.onEventUpdate();
                }
            },
            onDelete: async () => {
                console.log('Event deleted');

                if (!this.currentEventData || !this.currentEventData.id) {
                    return;
                }

                // Check if this is a repeat-forever event
                if (this.currentEventData._isVirtualInstance) {
                    // Show dialog with options
                    const deleteChoice = await this._showDeleteDialog();

                    if (deleteChoice === 'all') {
                        // Delete parent event and all instances
                        await this._deleteEventFromFirestore(this.currentEventData._parentEventId);
                        await this._deleteAllInstances(this.currentEventData._parentEventId);
                    } else if (deleteChoice === 'today') {
                        // Delete only this instance
                        await this._deleteInstance(this.currentEventData._parentEventId, this.currentEventData._instanceDate);
                    } else {
                        // User cancelled
                        return;
                    }
                } else {
                    // Regular event - simple confirmation
                    const confirmed = confirm('Are you sure you want to delete this event?');
                    if (!confirmed) {
                        return;
                    }
                    await this._deleteEventFromFirestore(this.currentEventData.id);
                }

                this.eventDetailView.hide();
                // Refresh calendar to remove deleted event
                await this.refresh();

                // Notify parent component (e.g., day summary board)
                if (this.onEventUpdate) {
                    this.onEventUpdate();
                }
            },
            onEdit: () => {
                console.log('Event edit requested');
                // TODO: Open edit panel
            },
            onRequirementToggle: async (requirement, index) => {
                console.log('Requirement toggled:', requirement, index);

                // Update current event data
                if (this.currentEventData && this.currentEventData.requirements) {
                    this.currentEventData.requirements[index] = requirement;

                    // Recalculate progress
                    const completedCount = this.currentEventData.requirements.filter(req => req.checked).length;
                    const progressValue = Math.round((completedCount / this.currentEventData.requirements.length) * 100);

                    // Update progress bar in detail view
                    this.eventDetailView.setProgressBar1Value(progressValue);

                    // Update requirement status in Firestore
                    await this._updateEventRequirements(this.currentEventData.id, this.currentEventData.requirements, this.currentEventData);

                    // Refresh calendar to show updated progress
                    await this.refresh();

                    // Notify parent component (e.g., day summary board)
                    if (this.onEventUpdate) {
                        this.onEventUpdate();
                    }
                }
            }
        });
    }

    /**
     * Update event requirements in Firestore
     * For virtual instances (repeat-forever), saves to eventInstances collection
     */
    async _updateEventRequirements(eventId, requirements, eventData = null) {
        if (!this.firebaseAuth || !eventId) {
            console.warn('⚠️ Cannot update requirements: missing firebaseAuth or eventId');
            return;
        }

        try {
            const { doc, updateDoc, setDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Initialize Firebase Auth if needed
            if (!this.firebaseAuth.initialized) {
                await this.firebaseAuth.initialize();
            }

            // Get current user
            const currentUser = this.firebaseAuth.getCurrentUser();
            if (!currentUser) {
                console.warn('⚠️ No user logged in');
                return;
            }

            // Get Firestore instance
            if (!this.firebaseAuth.db) {
                const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                if (this.firebaseAuth.app) {
                    this.firebaseAuth.db = getFirestore(this.firebaseAuth.app);
                } else {
                    console.error('❌ Firebase app not initialized');
                    return;
                }
            }

            // Check if this is a virtual instance (repeat-forever event)
            if (eventData && eventData._isVirtualInstance) {
                // Save to eventInstances collection
                const instanceId = `${eventData._parentEventId}_${eventData._instanceDate}`;
                const instanceRef = doc(
                    this.firebaseAuth.db,
                    "users", currentUser.uid,
                    "eventInstances", instanceId
                );

                await setDoc(instanceRef, {
                    eventId: eventData._parentEventId,
                    date: eventData._instanceDate,
                    requirements: requirements,
                    isComplete: eventData.isComplete || false,
                    updatedAt: Timestamp.now()
                }, { merge: true });

                console.log('✅ Instance requirements updated:', instanceId);
            } else {
                // Regular event - update event document directly
                const eventRef = doc(this.firebaseAuth.db, "users", currentUser.uid, "events", eventId);
                await updateDoc(eventRef, {
                    requirements: requirements
                });
                console.log('✅ Event requirements updated:', eventId);
            }

        } catch (error) {
            console.error('❌ Error updating event requirements:', error);
        }
    }

    /**
     * Update event complete status in Firestore
     * For virtual instances (repeat-forever), saves to eventInstances collection
     */
    async _updateEventCompleteStatus(eventId, isComplete, eventData = null) {
        if (!this.firebaseAuth || !eventId) {
            console.warn('⚠️ Cannot update complete status: missing firebaseAuth or eventId');
            return;
        }

        try {
            const { doc, updateDoc, setDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Initialize Firebase Auth if needed
            if (!this.firebaseAuth.initialized) {
                await this.firebaseAuth.initialize();
            }

            // Get current user
            const currentUser = this.firebaseAuth.getCurrentUser();
            if (!currentUser) {
                console.warn('⚠️ No user logged in');
                return;
            }

            // Get Firestore instance
            if (!this.firebaseAuth.db) {
                const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                if (this.firebaseAuth.app) {
                    this.firebaseAuth.db = getFirestore(this.firebaseAuth.app);
                } else {
                    console.error('❌ Firebase app not initialized');
                    return;
                }
            }

            // Check if this is a virtual instance (repeat-forever event)
            if (eventData && eventData._isVirtualInstance) {
                // Save to eventInstances collection
                const instanceId = `${eventData._parentEventId}_${eventData._instanceDate}`;
                const instanceRef = doc(
                    this.firebaseAuth.db,
                    "users", currentUser.uid,
                    "eventInstances", instanceId
                );

                await setDoc(instanceRef, {
                    eventId: eventData._parentEventId,
                    date: eventData._instanceDate,
                    isComplete: isComplete,
                    requirements: eventData.requirements || [],
                    updatedAt: Timestamp.now()
                }, { merge: true });

                console.log('✅ Instance complete status updated:', instanceId, 'isComplete:', isComplete);
            } else {
                // Regular event - update event document directly
                const eventRef = doc(this.firebaseAuth.db, "users", currentUser.uid, "events", eventId);
                await updateDoc(eventRef, {
                    isComplete: isComplete
                });
                console.log('✅ Event complete status updated:', eventId, 'isComplete:', isComplete);
            }

        } catch (error) {
            console.error('❌ Error updating event complete status:', error);
        }
    }

    /**
     * Delete event from Firestore
     */
    async _deleteEventFromFirestore(eventId) {
        if (!this.firebaseAuth || !eventId) {
            console.warn('⚠️ Cannot delete event: missing firebaseAuth or eventId');
            return;
        }

        try {
            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Initialize Firebase Auth if needed
            if (!this.firebaseAuth.initialized) {
                await this.firebaseAuth.initialize();
            }

            // Get current user
            const currentUser = this.firebaseAuth.getCurrentUser();
            if (!currentUser) {
                console.warn('⚠️ No user logged in');
                return;
            }

            // Get Firestore instance
            if (!this.firebaseAuth.db) {
                const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                if (this.firebaseAuth.app) {
                    this.firebaseAuth.db = getFirestore(this.firebaseAuth.app);
                } else {
                    console.error('❌ Firebase app not initialized');
                    return;
                }
            }

            // Delete event document
            const eventRef = doc(this.firebaseAuth.db, "users", currentUser.uid, "events", eventId);
            await deleteDoc(eventRef);

            console.log('✅ Event deleted:', eventId);

        } catch (error) {
            console.error('❌ Error deleting event:', error);
            alert('Error deleting event. Please try again.');
        }
    }

    /**
     * Show delete dialog for repeat-forever events
     * @returns {Promise<string>} 'all', 'today', or 'cancel'
     */
    _showDeleteDialog() {
        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
            `;

            // Create dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: #2C2C2E;
                border-radius: 16px;
                padding: 24px;
                max-width: 320px;
                width: 90%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            `;

            dialog.innerHTML = `
                <h3 style="color: #FFFFFF; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">Xóa sự kiện lặp lại</h3>
                <p style="color: #AEAEB2; margin: 0 0 24px 0; font-size: 14px; line-height: 1.5;">
                    Đây là sự kiện lặp lại vĩnh viễn. Bạn muốn xóa:
                </p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button id="deleteAll" style="
                        background: #FF3B30;
                        color: #FFFFFF;
                        border: none;
                        padding: 14px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">Xóa tất cả</button>
                    <button id="deleteToday" style="
                        background: #b8e84c;
                        color: #000000;
                        border: none;
                        padding: 14px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">Chỉ xóa hôm nay</button>
                    <button id="cancelDelete" style="
                        background: #3A3A3C;
                        color: #FFFFFF;
                        border: none;
                        padding: 14px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">Hủy</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Add event listeners
            dialog.querySelector('#deleteAll').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve('all');
            });

            dialog.querySelector('#deleteToday').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve('today');
            });

            dialog.querySelector('#cancelDelete').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve('cancel');
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve('cancel');
                }
            });
        });
    }

    /**
     * Delete all instances of a repeat-forever event
     * @param {string} parentEventId - The parent event ID
     */
    async _deleteAllInstances(parentEventId) {
        if (!this.firebaseAuth || !parentEventId) return;

        try {
            const { collection, getDocs, deleteDoc, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const currentUser = this.firebaseAuth.getCurrentUser();
            if (!currentUser) return;

            // Query all instances for this event
            const instancesRef = collection(this.firebaseAuth.db, "users", currentUser.uid, "eventInstances");
            const q = query(instancesRef, where("eventId", "==", parentEventId));
            const snapshot = await getDocs(q);

            // Delete each instance
            const deletePromises = [];
            snapshot.forEach((doc) => {
                deletePromises.push(deleteDoc(doc.ref));
            });

            await Promise.all(deletePromises);
            console.log(`✅ Deleted ${deletePromises.length} instances for event: ${parentEventId}`);

        } catch (error) {
            console.error('❌ Error deleting all instances:', error);
        }
    }

    /**
     * Delete a single instance of a repeat-forever event
     * @param {string} parentEventId - The parent event ID  
     * @param {string} date - The date string (YYYY-MM-DD)
     */
    async _deleteInstance(parentEventId, date) {
        if (!this.firebaseAuth || !parentEventId || !date) return;

        try {
            const { doc, setDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const currentUser = this.firebaseAuth.getCurrentUser();
            if (!currentUser) return;

            // Mark instance as deleted (we don't actually delete, just mark as deleted)
            // This way we can skip this date when generating instances
            const instanceId = `${parentEventId}_${date}`;
            const instanceRef = doc(
                this.firebaseAuth.db,
                "users", currentUser.uid,
                "eventInstances", instanceId
            );

            await setDoc(instanceRef, {
                eventId: parentEventId,
                date: date,
                isDeleted: true,
                updatedAt: Timestamp.now()
            }, { merge: true });

            console.log(`✅ Instance marked as deleted: ${instanceId}`);

        } catch (error) {
            console.error('❌ Error deleting instance:', error);
        }
    }

    /**
     * Initialize current week based on weekStartsOnMonday setting
     */
    _initWeek() {
        const today = new Date();
        const day = today.getDay();
        let diff;

        if (this.weekStartsOnMonday) {
            // Week starts on Monday
            diff = today.getDate() - day + (day === 0 ? -6 : 1);
        } else {
            // Week starts on Sunday
            diff = today.getDate() - day;
        }

        this.currentWeekStart = new Date(today.setDate(diff));
        this.currentWeekStart.setHours(0, 0, 0, 0);
    }

    /**
     * Initialize ResizeObserver to monitor grid width changes
     */
    _initResizeObserver() {
        // Create ResizeObserver to monitor container width changes
        this.resizeObserver = new ResizeObserver((entries) => {
            // Debounce resize updates to avoid excessive re-rendering
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }

            this.resizeTimeout = setTimeout(() => {
                // Re-render events with new cell widths
                if (this.events && this.events.length > 0) {
                    this._renderEvents();
                }
            }, 150); // 150ms debounce
        });

        // Start observing the container when it's created
        // This will be called after container is created in _createCalendar
        if (this.container) {
            this.resizeObserver.observe(this.container);
        }
    }

    /**
     * Create calendar structure
     */
    _createCalendar() {
        // Main container
        this.container = document.createElement('div');
        this.container.className = 'weekly-calendar-container';
        this.container.style.cssText = `
            position: fixed;
            left: calc(max(20%, 280px) + 24px);
            top: 80px;
            right: 24px;
            bottom: 0;
            background-color: #1C1C1E;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            z-index: 10;
            min-width: 600px;
        `;

        // Add mobile-specific CSS to expand to full width
        if (!document.getElementById('weekly-calendar-mobile-width-style')) {
            const style = document.createElement('style');
            style.id = 'weekly-calendar-mobile-width-style';
            style.textContent = `
                @media (max-width: 640px) {
                    .weekly-calendar-container {
                        left: 0 !important;
                        right: 0 !important;
                        width: 100% !important;
                    }
                    .weekly-calendar-mobile-wrapper {
                        left: 0 !important;
                        right: 0 !important;
                        width: 100% !important;
                    }
                    /* Enable horizontal scroll with snap */
                    .weekly-calendar-scroll-wrapper {
                        overflow-x: auto !important;
                        scroll-snap-type: x mandatory;
                        -webkit-overflow-scrolling: touch;
                    }
                    /* Hide horizontal scrollbar */
                    .weekly-calendar-scroll-wrapper::-webkit-scrollbar {
                        display: none;
                    }
                    .weekly-calendar-scroll-wrapper {
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    }
                    /* Make calendar grid use horizontal scroll */
                    .weekly-calendar-scroll {
                        overflow-x: auto !important;
                        scroll-snap-type: x mandatory;
                    }
                    /* Set day columns to 70vw width */
                    .weekly-calendar-grid {
                        grid-template-columns: 80px repeat(7, 70vw) !important;
                        width: max-content !important;
                        padding-right: calc(100vw - 70vw - 80px) !important;
                    }
                    /* Configure scroll snap on container */
                    .weekly-calendar-scroll {
                        scroll-padding-left: 80px !important;
                        scroll-snap-type: x mandatory !important;
                    }
                    /* Snap only the first row day cells (hour 0) - cells 2-8 */
                    .weekly-calendar-grid > div:nth-child(n+2):nth-child(-n+8) {
                        scroll-snap-align: start;
                    }
                    /* Make time column sticky on mobile */
                    .weekly-calendar-time-label {
                        position: sticky !important;
                        left: 0 !important;
                        background-color: #1C1C1E !important;
                        z-index: 3 !important;
                    }
                    /* Also make header corner sticky */
                    .weekly-calendar-days-header > div:first-child {
                        position: sticky !important;
                        left: 0 !important;
                        background-color: #1C1C1E !important;
                        z-index: 6 !important;
                    }
                    /* Make time column sticky on mobile - improved */
                    .weekly-calendar-grid {
                        position: relative !important;
                    }
                    .weekly-calendar-time-label {
                        position: sticky !important;
                        left: 0 !important;
                        background-color: #1C1C1E !important;
                        z-index: 4 !important;
                        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1) !important;
                    }
                    /* Match days header with grid columns */
                    .weekly-calendar-days-header {
                        grid-template-columns: 80px repeat(7, 70vw) !important;
                        width: max-content !important;
                        overflow-x: auto !important;
                        padding-right: calc(100vw - 70vw - 80px) !important;
                    }
                    /* Wrapper for header to enable horizontal scroll */
                    .weekly-calendar-header-wrapper {
                        overflow-x: auto !important;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    }
                    .weekly-calendar-header-wrapper::-webkit-scrollbar {
                        display: none;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Loading overlay
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'weekly-calendar-loading-overlay';
        this.loadingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(28, 28, 30, 0.7);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 100;
            backdrop-filter: blur(2px);
        `;

        // Spinner container
        const spinnerContainer = document.createElement('div');
        spinnerContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        `;

        // Circular spinner (border style like authentication loading)
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 40px;
            height: 40px;
            border: 3px solid rgba(184, 232, 76, 0.2);
            border-top: 3px solid #b8e84c;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        `;

        // Loading text
        const loadingText = document.createElement('div');
        loadingText.textContent = 'Loading...';
        loadingText.style.cssText = `
            font-family: 'Poppins', sans-serif;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
        `;

        spinnerContainer.appendChild(spinner);
        spinnerContainer.appendChild(loadingText);
        this.loadingOverlay.appendChild(spinnerContainer);

        // Add keyframes for spinner animation if not exists
        if (!document.getElementById('weekly-calendar-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'weekly-calendar-spinner-style';
            style.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        // Calendar grid
        const calendarGrid = this._createCalendarGrid();

        this.container.appendChild(calendarGrid);
        this.container.appendChild(this.loadingOverlay);

        // Start observing container size changes for responsive event cards
        if (this.resizeObserver) {
            this.resizeObserver.observe(this.container);
        }
    }

    /**
     * Show loading overlay
     */
    _showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'flex';
        }
    }

    /**
     * Hide loading overlay
     */
    _hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
    }

    /**
     * Create calendar grid
     */
    _createCalendarGrid() {
        const gridContainer = document.createElement('div');
        gridContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 0;
        `;

        // Days header wrapper for horizontal scroll sync
        const headerWrapper = document.createElement('div');
        headerWrapper.className = 'weekly-calendar-header-wrapper';
        headerWrapper.style.cssText = `
            overflow-x: hidden;
            flex-shrink: 0;
        `;
        const daysHeader = this._createDaysHeader();
        headerWrapper.appendChild(daysHeader);
        this.headerWrapper = headerWrapper;

        // Scrollable grid wrapper
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'weekly-calendar-scroll-wrapper';
        scrollWrapper.style.cssText = `
            flex: 1;
            display: flex;
            position: relative;
            min-height: 0;
            overflow: hidden;
        `;

        // Scrollable grid
        const scrollContainer = document.createElement('div');
        scrollContainer.style.cssText = `
            flex: 1;
            overflow-y: scroll;
            overflow-x: hidden;
            min-height: 0;
            position: relative;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
        `;

        // Hide scrollbar completely
        const style = document.createElement('style');
        style.textContent = `
            .weekly-calendar-scroll::-webkit-scrollbar {
                display: none; /* Chrome, Safari, Opera */
            }
        `;
        scrollContainer.className = 'weekly-calendar-scroll';
        if (!document.querySelector('style[data-weekly-calendar-scroll]')) {
            style.setAttribute('data-weekly-calendar-scroll', 'true');
            document.head.appendChild(style);
        }

        // Custom scrollbar
        const customScrollbar = this._createCustomScrollbar();
        this.customScrollbar = customScrollbar;
        this.scrollContainer = scrollContainer;

        this.calendarGrid = document.createElement('div');
        this.calendarGrid.className = 'weekly-calendar-grid';
        this.calendarGrid.style.cssText = `
            display: grid;
            grid-template-columns: 80px repeat(7, minmax(0, 1fr));
            grid-template-rows: auto;
            transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 1;
            transform: translateX(0);
            overflow: visible;
        `;

        scrollContainer.appendChild(this.calendarGrid);

        // Add current time line indicator
        const currentTimeLine = this._createCurrentTimeLine();
        scrollContainer.appendChild(currentTimeLine);
        this.currentTimeLine = currentTimeLine;

        scrollWrapper.appendChild(scrollContainer);
        scrollWrapper.appendChild(customScrollbar);

        // Add gradient fade effect at bottom
        const gradientOverlay = this._createGradientOverlay();
        scrollWrapper.appendChild(gradientOverlay);

        // Sync horizontal scroll between header and grid on mobile
        scrollContainer.addEventListener('scroll', () => {
            if (window.innerWidth <= 640) {
                headerWrapper.scrollLeft = scrollContainer.scrollLeft;
                // Keep current time line visible when scrolling horizontally
                if (this.currentTimeLine) {
                    this.currentTimeLine.style.transform = `translateX(${scrollContainer.scrollLeft}px)`;
                }
            } else {
                // Reset transform on desktop
                if (this.currentTimeLine) {
                    this.currentTimeLine.style.transform = '';
                }
            }
        });

        gridContainer.appendChild(headerWrapper);
        gridContainer.appendChild(scrollWrapper);

        // Setup scroll event listener
        this._setupScrollListener();

        return gridContainer;
    }

    /**
     * Create gradient overlay for fade effect at bottom
     */
    _createGradientOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'weekly-calendar-gradient-overlay';
        overlay.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 80px;
            background: linear-gradient(to bottom, transparent, rgba(28, 28, 30, 0.8), rgba(28, 28, 30, 1));
            pointer-events: none;
            z-index: 5;
        `;

        return overlay;
    }

    /**
     * Create current time line indicator
     */
    _createCurrentTimeLine() {
        const line = document.createElement('div');
        line.className = 'current-time-line';
        line.style.cssText = `
            position: absolute;
            left: 80px;
            right: 0;
            height: 2px;
            background-color: #b8e84c;
            z-index: 10;
            pointer-events: none;
            box-shadow: 0 0 4px rgba(184, 232, 76, 0.5);
            display: none;
        `;

        // Add circle indicator
        const circle = document.createElement('div');
        circle.style.cssText = `
            position: absolute;
            left: -6px;
            top: 50%;
            transform: translateY(-50%);
            width: 12px;
            height: 12px;
            background-color: #b8e84c;
            border-radius: 50%;
            box-shadow: 0 0 4px rgba(184, 232, 76, 0.5);
        `;
        line.appendChild(circle);

        return line;
    }

    /**
     * Update current time line position
     */
    _updateCurrentTimeLine() {
        if (!this.currentTimeLine || !this.calendarGrid) return;

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

        // Check if current day is in the displayed week
        const weekStart = new Date(this.currentWeekStart);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        weekStart.setHours(0, 0, 0, 0);
        weekEnd.setHours(23, 59, 59, 999);

        // Only show line if today is in the current week
        if (today < weekStart || today > weekEnd) {
            this.currentTimeLine.style.display = 'none';
            return;
        }

        this.currentTimeLine.style.display = 'block';

        // Calculate position based on actual rendered cell heights
        // Find all time label elements using specific class selector
        let totalPosition = 0;

        // Get only the time label elements (marked with specific class)
        const timeLabels = this.calendarGrid.querySelectorAll(':scope > .weekly-calendar-time-label');

        // Calculate position by summing up actual heights of previous hours
        for (let hour = 0; hour < currentHour; hour++) {
            if (hour < timeLabels.length) {
                const timeLabel = timeLabels[hour];
                totalPosition += timeLabel.offsetHeight;
            }
        }

        // Add offset for current hour based on minutes
        // Get the current hour's cell height
        if (currentHour < timeLabels.length) {
            const currentHourLabel = timeLabels[currentHour];
            const currentHourHeight = currentHourLabel.offsetHeight;
            const minuteOffset = (currentMinute / 60) * currentHourHeight;
            totalPosition += minuteOffset;
        }

        // Set line position
        this.currentTimeLine.style.top = `${totalPosition}px`;

        // Auto-scroll to current time line only on first load
        if (!this._hasAutoScrolled) {
            const lineTop = totalPosition;
            const containerHeight = this.scrollContainer.clientHeight;

            // Scroll to show the line with some padding
            setTimeout(() => {
                this.scrollContainer.scrollTop = lineTop - containerHeight / 3;
                this._hasAutoScrolled = true;
            }, 200);
        }
    }

    /**
     * Create custom scrollbar
     */
    _createCustomScrollbar() {
        const scrollbar = document.createElement('div');
        scrollbar.className = 'custom-scrollbar';
        scrollbar.style.cssText = `
            width: 8px;
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            background-color: transparent;
            z-index: 10;
            pointer-events: none;
            opacity: 0;
            transition: opacity 200ms ease-out;
        `;

        const track = document.createElement('div');
        track.style.cssText = `
            width: 100%;
            height: 100%;
            position: relative;
            background-color: transparent;
        `;

        const thumb = document.createElement('div');
        thumb.className = 'custom-scrollbar-thumb';
        thumb.style.cssText = `
            width: 6px;
            background-color: #636366;
            border-radius: 4px;
            position: absolute;
            right: 1px;
            top: 0;
            min-height: 40px;
            cursor: pointer;
            transition: background-color 150ms ease-out;
            pointer-events: all;
        `;

        thumb.addEventListener('mouseenter', () => {
            thumb.style.backgroundColor = '#8E8E93';
        });

        thumb.addEventListener('mouseleave', () => {
            thumb.style.backgroundColor = '#636366';
        });

        // Drag functionality
        this.isDragging = false;
        let startY = 0;
        let startScrollTop = 0;

        thumb.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            startY = e.clientY;
            startScrollTop = this.scrollContainer.scrollTop;
            thumb.style.backgroundColor = '#8E8E93';
            // Force show scrollbar when dragging starts
            this._showScrollbar();
            e.preventDefault();
        });

        const handleMouseMove = (e) => {
            if (!this.isDragging) return;

            const deltaY = e.clientY - startY;
            const scrollRatio = this.scrollContainer.scrollHeight / this.scrollContainer.clientHeight;
            const thumbHeight = this.scrollContainer.clientHeight / this.scrollContainer.scrollHeight * this.scrollContainer.clientHeight;
            const maxThumbTop = this.scrollContainer.clientHeight - thumbHeight;
            const scrollDelta = deltaY * scrollRatio;

            this.scrollContainer.scrollTop = startScrollTop + scrollDelta;
            // Keep scrollbar visible while dragging
            this._showScrollbar();
        };

        document.addEventListener('mousemove', handleMouseMove);

        const handleMouseUp = () => {
            if (this.isDragging) {
                this.isDragging = false;
                thumb.style.backgroundColor = '#636366';
                // Allow scrollbar to hide after drag ends (if mouse is not near)
                setTimeout(() => {
                    if (!this.isDragging) {
                        // Check if mouse is still near scrollbar area
                        // If not, hide it
                        this._checkAndHideScrollbar();
                    }
                }, 100);
            }
        };

        document.addEventListener('mouseup', handleMouseUp);

        track.appendChild(thumb);
        scrollbar.appendChild(track);

        this.scrollbarThumb = thumb;
        this.scrollbarTrack = track;

        return scrollbar;
    }

    /**
     * Setup scroll event listener
     */
    _setupScrollListener() {
        this.scrollContainer.addEventListener('scroll', () => {
            this._updateScrollbar();
            this._updateCurrentTimeLine();
        });

        // Show scrollbar on hover near right edge
        const scrollWrapper = this.scrollContainer.parentElement;
        let hoverTimeout = null;

        scrollWrapper.addEventListener('mouseenter', () => {
            // Check if mouse is near right edge (within 20px)
            scrollWrapper.addEventListener('mousemove', this._handleMouseMove);
        });

        scrollWrapper.addEventListener('mouseleave', () => {
            scrollWrapper.removeEventListener('mousemove', this._handleMouseMove);
            // Don't hide if user is dragging
            if (!this.isDragging) {
                this._hideScrollbar();
            }
        });

        // Store reference for cleanup
        this._handleMouseMove = (e) => {
            // Don't hide scrollbar if user is dragging
            if (this.isDragging) {
                this._showScrollbar();
                return;
            }

            const rect = scrollWrapper.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const width = rect.width;

            // Show scrollbar if mouse is within 20px of right edge
            if (width - mouseX <= 20) {
                this._showScrollbar();
            } else {
                this._hideScrollbar();
            }
        };

        // Update scrollbar on resize
        const resizeObserver = new ResizeObserver(() => {
            this._updateScrollbar();
        });
        resizeObserver.observe(this.scrollContainer);

        // Initial update
        setTimeout(() => {
            this._updateScrollbar();
        }, 100);
    }

    /**
     * Show custom scrollbar
     */
    _showScrollbar() {
        if (this.customScrollbar) {
            this.customScrollbar.style.opacity = '1';
            this.customScrollbar.style.pointerEvents = 'auto';
        }
    }

    /**
     * Hide custom scrollbar
     */
    _hideScrollbar() {
        // Don't hide if user is dragging
        if (this.isDragging) {
            return;
        }

        if (this.customScrollbar) {
            this.customScrollbar.style.opacity = '0';
            // Keep pointer events for thumb dragging
            setTimeout(() => {
                if (this.customScrollbar.style.opacity === '0' && !this.isDragging) {
                    this.customScrollbar.style.pointerEvents = 'none';
                }
            }, 200);
        }
    }

    /**
     * Check and hide scrollbar if mouse is not near
     */
    _checkAndHideScrollbar() {
        // This will be called after drag ends to check if we should hide
        // The _handleMouseMove will handle the actual hiding logic
        if (!this.isDragging && this._handleMouseMove) {
            // Trigger a check by simulating a mouse move event
            // But we'll let the normal hover logic handle it
        }
    }

    /**
     * Update custom scrollbar position
     */
    _updateScrollbar() {
        const container = this.scrollContainer;
        const thumb = this.scrollbarThumb;

        if (!container || !thumb) return;

        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const scrollTop = container.scrollTop;

        if (scrollHeight <= clientHeight) {
            // No scroll needed
            thumb.style.display = 'none';
            this._hideScrollbar();
            return;
        }

        thumb.style.display = 'block';

        // Calculate thumb height and position
        const thumbHeight = (clientHeight / scrollHeight) * clientHeight;
        const maxThumbTop = clientHeight - thumbHeight;
        const thumbTop = (scrollTop / (scrollHeight - clientHeight)) * maxThumbTop;

        thumb.style.height = `${thumbHeight}px`;
        thumb.style.top = `${thumbTop}px`;
    }

    /**
     * Create days header
     */
    _createDaysHeader() {
        const header = document.createElement('div');
        header.className = 'weekly-calendar-days-header';
        header.style.cssText = `
            display: grid;
            grid-template-columns: 80px repeat(7, 1fr);
            border-bottom: 1px solid rgba(209, 209, 214, 0.2);
            flex-shrink: 0;
            background-color: #1C1C1E;
            position: sticky;
            top: 0;
            z-index: 5;
        `;

        // Empty corner
        const corner = document.createElement('div');
        corner.style.cssText = `
            padding: 12px;
            border-right: 1px solid rgba(209, 209, 214, 0.2);
        `;
        header.appendChild(corner);

        // Day headers - order based on weekStartsOnMonday
        const days = this.weekStartsOnMonday
            ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        this.dayHeaders = [];

        for (let i = 0; i < 7; i++) {
            const dayHeader = document.createElement('div');
            dayHeader.style.cssText = `
                padding: 12px;
                text-align: center;
                border-right: 1px solid rgba(209, 209, 214, 0.2);
                color: #AEAEB2;
                font-size: 12px;
                font-weight: 600;
                font-family: 'OpenSans', Arial, sans-serif;
            `;

            const dayName = document.createElement('div');
            dayName.textContent = days[i];
            dayName.style.cssText = `
                margin-bottom: 4px;
            `;

            const dayDate = document.createElement('div');
            dayDate.className = 'day-date';
            dayDate.style.cssText = `
                color: #FFFFFF;
                font-size: 16px;
                font-weight: 500;
            `;

            dayHeader.appendChild(dayName);
            dayHeader.appendChild(dayDate);
            header.appendChild(dayHeader);
            this.dayHeaders.push(dayDate);
        }

        return header;
    }

    /**
     * Update calendar display
     */
    async _updateCalendar() {
        // Update week title with animation
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const startMonth = monthNames[this.currentWeekStart.getMonth()];
        const endMonth = monthNames[weekEnd.getMonth()];
        const startYear = this.currentWeekStart.getFullYear();
        const endYear = weekEnd.getFullYear();

        // Update day dates - currentWeekStart is already set to the correct first day
        // based on weekStartsOnMonday setting
        for (let i = 0; i < 7; i++) {
            const date = new Date(this.currentWeekStart);
            date.setDate(date.getDate() + i);
            this.dayHeaders[i].textContent = date.getDate();

            // Highlight today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);

            if (date.getTime() === today.getTime()) {
                this.dayHeaders[i].parentElement.style.backgroundColor = 'rgba(184, 232, 76, 0.1)';
                this.dayHeaders[i].style.color = '#b8e84c';
            } else {
                this.dayHeaders[i].parentElement.style.backgroundColor = 'transparent';
                this.dayHeaders[i].style.color = '#FFFFFF';
            }
        }

        // Animate week transition
        await this._animateWeekTransition();

        // Clear and rebuild time slots (after fade out animation)
        this.calendarGrid.innerHTML = '';
        // Ensure transition is applied after clearing
        this.calendarGrid.style.transition = 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)';
        this._createTimeSlots();

        // Fade in and slide back (start from right, slide to center)
        this.calendarGrid.style.opacity = '0';
        this.calendarGrid.style.transform = 'translateX(20px)';

        // Trigger fade in animation
        requestAnimationFrame(() => {
            this.calendarGrid.style.opacity = '1';
            this.calendarGrid.style.transform = 'translateX(0)';
        });

        // Update scrollbar after content is loaded
        setTimeout(() => {
            this._updateScrollbar();
            this._updateCurrentTimeLine();
        }, 100);

        // Load and display events
        this._loadEvents();
    }

    /**
     * Animate week transition
     */
    async _animateWeekTransition() {
        return new Promise((resolve) => {
            // Only animate if grid has content
            if (this.calendarGrid.children.length === 0) {
                resolve();
                return;
            }

            // Fade out and slide left
            this.calendarGrid.style.opacity = '0';
            this.calendarGrid.style.transform = 'translateX(-20px)';

            // Wait for fade out animation to complete
            setTimeout(() => {
                resolve();
            }, 300);
        });
    }

    /**
     * Create time slots (0h-23h)
     */
    _createTimeSlots() {
        for (let hour = 0; hour < 24; hour++) {
            // Time label - add specific class for timeline position calculation
            const timeLabel = document.createElement('div');
            timeLabel.className = 'weekly-calendar-time-label';
            timeLabel.style.cssText = `
                padding: 8px 12px;
                border-right: 1px solid rgba(209, 209, 214, 0.2);
                border-bottom: 1px solid rgba(209, 209, 214, 0.1);
                color: #8E8E93;
                font-size: 12px;
                font-weight: 500;
                font-family: 'OpenSans', Arial, sans-serif;
                text-align: right;
                min-height: 120px;
                display: flex;
                align-items: flex-start;
                justify-content: flex-end;
                padding-top: 12px;
            `;
            timeLabel.textContent = `${hour.toString().padStart(2, '0')}:00`;
            this.calendarGrid.appendChild(timeLabel);

            // Day cells for this hour
            for (let day = 0; day < 7; day++) {
                const cell = document.createElement('div');
                cell.className = 'time-slot-cell';
                cell.dataset.hour = hour;
                cell.dataset.day = day;
                cell.style.cssText = `
                    padding: 4px;
                    border-right: 1px solid rgba(209, 209, 214, 0.1);
                    border-bottom: 1px solid rgba(209, 209, 214, 0.1);
                    min-height: 120px;
                    position: relative;
                    background-color: #1C1C1E;
                    overflow: visible;
                    z-index: 1;
                    box-sizing: border-box;
                    width: 100%;
                    max-width: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                `;

                // Add hover effect
                cell.addEventListener('mouseenter', () => {
                    cell.style.backgroundColor = 'rgba(184, 232, 76, 0.05)';
                });
                cell.addEventListener('mouseleave', () => {
                    cell.style.backgroundColor = '#1C1C1E';
                });

                this.calendarGrid.appendChild(cell);
            }
        }
    }

    /**
     * Navigate week
     */
    _navigateWeek(direction) {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() + (direction * 7));
        this._hasAutoScrolled = false; // Reset auto-scroll flag when navigating
        this._updateCalendar();
    }

    /**
     * Generate repeat instances for a repeat-forever event within a date range
     * @param {Object} event - The event with repeatForever: true
     * @param {Date} rangeStart - Start date of the range
     * @param {Date} rangeEnd - End date of the range
     * @returns {Array} Array of dates where this event should appear
     */
    _generateRepeatInstances(event, rangeStart, rangeEnd) {
        const instances = [];

        // Parse original event date
        const dateParts = event.date.split('-');
        const originalDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2])
        );
        originalDate.setHours(0, 0, 0, 0);

        // Don't generate instances before the original date
        const effectiveStart = new Date(Math.max(rangeStart.getTime(), originalDate.getTime()));

        const repeatType = event.repeat;
        const originalDay = originalDate.getDay(); // 0-6
        const originalDayOfMonth = originalDate.getDate();
        const originalMonth = originalDate.getMonth();

        // Iterate through each day in the range
        let current = new Date(effectiveStart);
        current.setHours(0, 0, 0, 0);

        while (current < rangeEnd) {
            let shouldInclude = false;

            switch (repeatType) {
                case 'Daily':
                    shouldInclude = true;
                    break;

                case 'Weekly':
                    shouldInclude = current.getDay() === originalDay;
                    break;

                case 'Monthly':
                    // Get the last day of current month
                    const lastDayOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
                    // If original day is greater than days in this month, use last day
                    const targetDay = Math.min(originalDayOfMonth, lastDayOfMonth);
                    shouldInclude = current.getDate() === targetDay;
                    break;

                case 'Yearly':
                    // Check if same month and same day (with fallback for Feb 29)
                    if (current.getMonth() === originalMonth) {
                        const lastDayOfCurrentMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
                        const targetDayOfMonth = Math.min(originalDayOfMonth, lastDayOfCurrentMonth);
                        shouldInclude = current.getDate() === targetDayOfMonth;
                    }
                    break;
            }

            if (shouldInclude) {
                // Format date as YYYY-MM-DD
                const year = current.getFullYear();
                const month = String(current.getMonth() + 1).padStart(2, '0');
                const day = String(current.getDate()).padStart(2, '0');
                instances.push(`${year}-${month}-${day}`);
            }

            // Move to next day
            current.setDate(current.getDate() + 1);
        }

        return instances;
    }

    /**
     * Load instance data from eventInstances collection
     * @param {string} eventId - Parent event ID
     * @param {Array} dates - Array of date strings (YYYY-MM-DD)
     * @returns {Object} Map of date -> instance data
     */
    async _loadInstanceData(eventId, dates) {
        const instancesMap = {};

        if (!this.firebaseAuth || !dates.length) return instancesMap;

        try {
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const currentUser = this.firebaseAuth.getCurrentUser();
            if (!currentUser) return instancesMap;

            // Load each instance document
            for (const date of dates) {
                const instanceId = `${eventId}_${date}`;
                const instanceRef = doc(
                    this.firebaseAuth.db,
                    "users", currentUser.uid,
                    "eventInstances", instanceId
                );

                const instanceDoc = await getDoc(instanceRef);
                if (instanceDoc.exists()) {
                    instancesMap[date] = instanceDoc.data();
                }
            }
        } catch (error) {
            console.error('❌ Error loading instance data:', error);
        }

        return instancesMap;
    }

    /**
     * Set week to contain a specific date
     * @param {Date} date - The date to set the week to contain
     */
    setWeekForDate(date) {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        // Calculate week start based on weekStartsOnMonday setting
        const day = targetDate.getDay();
        let diff;

        if (this.weekStartsOnMonday) {
            // Week starts on Monday
            diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
        } else {
            // Week starts on Sunday
            diff = targetDate.getDate() - day;
        }

        const newWeekStart = new Date(targetDate.setDate(diff));
        newWeekStart.setHours(0, 0, 0, 0);

        // Only update if week actually changed
        if (this.currentWeekStart && this.currentWeekStart.getTime() === newWeekStart.getTime()) {
            // Same week, no need to update
            return;
        }

        this.currentWeekStart = newWeekStart;
        this._hasAutoScrolled = false; // Reset auto-scroll flag when changing week
        this._updateCalendar();
    }

    /**
     * Load events from Firestore
     */
    async _loadEvents() {
        if (!this.firebaseAuth) {
            console.warn('⚠️ Firebase Auth not provided');
            return;
        }

        // Show loading overlay
        this._showLoading();

        // Increment request ID to track this specific load request
        this._loadRequestId++;
        const currentRequestId = this._loadRequestId;

        try {
            const { collection, getDocs, query, where, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Initialize Firebase Auth if needed
            if (!this.firebaseAuth.initialized) {
                await this.firebaseAuth.initialize();
            }

            // Get current user
            const currentUser = this.firebaseAuth.getCurrentUser();
            if (!currentUser) {
                console.warn('⚠️ No user logged in');
                return;
            }

            // Get Firestore instance
            if (!this.firebaseAuth.db) {
                const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                if (this.firebaseAuth.app) {
                    this.firebaseAuth.db = getFirestore(this.firebaseAuth.app);
                } else {
                    console.error('❌ Firebase app not initialized');
                    return;
                }
            }

            // Load categories first
            const categoriesRef = collection(this.firebaseAuth.db, "users", currentUser.uid, "categories");
            const categoriesSnapshot = await getDocs(categoriesRef);
            const categoriesMap = {};
            categoriesSnapshot.forEach((doc) => {
                const catData = doc.data();
                if (catData._type !== 'collection_initializer') {
                    categoriesMap[catData.name] = {
                        name: catData.name,
                        color: catData.color || '#b8e84c',
                        icon: catData.icon || 'fa-solid fa-star'
                    };
                }
            });

            // Calculate week range based on weekStartsOnMonday setting
            // currentWeekStart is already set to the correct day (Monday or Sunday)
            const weekStart = new Date(this.currentWeekStart);
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            weekEnd.setHours(0, 0, 0, 0);

            // Format date string without timezone conversion (YYYY-MM-DD)
            const formatDateString = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // Query events for this week
            const eventsRef = collection(this.firebaseAuth.db, "users", currentUser.uid, "events");
            const weekStartDateStr = formatDateString(weekStart);
            const weekEndDateStr = formatDateString(weekEnd);

            // Get all events and filter by date (Firestore doesn't support range queries on strings easily)
            const eventsSnapshot = await getDocs(eventsRef);
            this.events = [];

            // Collect repeat-forever events for processing
            const repeatForeverEvents = [];

            eventsSnapshot.forEach((doc) => {
                const eventData = doc.data();
                const eventDate = eventData.date;

                // Map category helper
                const mapCategory = (data) => {
                    if (data.category && categoriesMap[data.category]) {
                        data.category = categoriesMap[data.category];
                    } else if (data.category) {
                        data.category = {
                            name: data.category,
                            color: '#b8e84c',
                            icon: 'fa-solid fa-star'
                        };
                    }
                };

                // Check if this is a repeat-forever event
                if (eventData.repeatForever === true && ['Daily', 'Weekly', 'Monthly', 'Yearly'].includes(eventData.repeat)) {
                    repeatForeverEvents.push({
                        id: doc.id,
                        ...eventData
                    });
                } else {
                    // Regular event - check if within this week
                    if (eventDate >= weekStartDateStr && eventDate < weekEndDateStr) {
                        mapCategory(eventData);
                        this.events.push({
                            id: doc.id,
                            ...eventData
                        });
                    }
                }
            });

            // Process repeat-forever events
            for (const event of repeatForeverEvents) {
                // Generate instances for this week
                const instanceDates = this._generateRepeatInstances(event, weekStart, weekEnd);

                if (instanceDates.length > 0) {
                    // Load instance-specific data (completion status, requirements)
                    const instancesData = await this._loadInstanceData(event.id, instanceDates);

                    // Create virtual events for each date
                    for (const date of instanceDates) {
                        const instanceData = instancesData[date] || {};

                        // Skip deleted instances
                        if (instanceData.isDeleted === true) {
                            continue;
                        }

                        // Clone event and override with instance data
                        const virtualEvent = {
                            ...event,
                            date: date,
                            // Instance-specific data
                            isComplete: instanceData.isComplete ?? false,
                            requirements: instanceData.requirements ?? event.requirements?.map(req => ({ ...req, checked: false })) ?? [],
                            // Mark as virtual instance
                            _isVirtualInstance: true,
                            _parentEventId: event.id,
                            _instanceDate: date
                        };

                        // Map category
                        if (virtualEvent.category && categoriesMap[virtualEvent.category]) {
                            virtualEvent.category = categoriesMap[virtualEvent.category];
                        } else if (virtualEvent.category && typeof virtualEvent.category === 'string') {
                            virtualEvent.category = {
                                name: virtualEvent.category,
                                color: '#b8e84c',
                                icon: 'fa-solid fa-star'
                            };
                        }

                        this.events.push(virtualEvent);
                    }
                }
            }

            // Check if this request is still valid (user hasn't navigated to another week)
            if (currentRequestId !== this._loadRequestId) {
                console.log('⚠️ Load request cancelled - user navigated to different week');
                return;
            }

            console.log(`✅ Loaded ${this.events.length} events for the week (including repeat instances)`);
            this._renderEvents();
            this._hideLoading();

        } catch (error) {
            console.error('❌ Error loading events:', error);
            this._hideLoading();
        }
    }

    /**
     * Render events on calendar using EventCard
     */
    _renderEvents() {
        // Clear existing event elements and cards
        const cells = this.calendarGrid.querySelectorAll('.time-slot-cell');
        cells.forEach(cell => {
            const existingWrappers = cell.querySelectorAll('.calendar-event-wrapper');
            existingWrappers.forEach(wrapper => wrapper.remove());
        });

        // Clear event cards array
        this.eventCards = [];

        // Parse and render each event
        this.events.forEach(event => {
            try {
                // Skip events without time (dashboard-only events)
                if (!event.time || event.time === 'none') {
                    return;
                }

                // Parse date string (YYYY-MM-DD) without timezone offset
                // Split date string to avoid timezone issues
                const dateParts = event.date.split('-');
                if (dateParts.length !== 3) {
                    console.warn('Invalid date format:', event.date);
                    return;
                }

                const year = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
                const day = parseInt(dateParts[2]);

                // Create date in local timezone (no timezone conversion)
                const eventDate = new Date(year, month, day, 0, 0, 0, 0);

                // Get day of week (0 = Sunday, 6 = Saturday)
                const dayOfWeek = eventDate.getDay();

                // Convert to column index based on weekStartsOnMonday setting
                let columnIndex;
                if (this.weekStartsOnMonday) {
                    // When week starts on Monday: Mon=0, Tue=1, ..., Sat=5, Sun=6
                    columnIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                } else {
                    // When week starts on Sunday: Sun=0, Mon=1, ..., Sat=6
                    columnIndex = dayOfWeek;
                }

                // Parse time string (format: "from 10:00 AM to 10:30 AM")
                const timeMatch = event.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
                if (!timeMatch) return;

                let hour = parseInt(timeMatch[1]);
                const minute = parseInt(timeMatch[2]);
                const period = timeMatch[3];

                if (period === 'PM' && hour !== 12) hour += 12;
                if (period === 'AM' && hour === 12) hour = 0;

                // Find the cell for this day and hour
                const cell = this.calendarGrid.querySelector(
                    `.time-slot-cell[data-day="${columnIndex}"][data-hour="${hour}"]`
                );

                if (!cell) return;

                // Calculate cell width for scaling event card
                const cellWidth = cell.offsetWidth;
                // Use 85% of cell width for better card visibility, with constraints
                const cardWidth = Math.max(140, Math.min(cellWidth * 0.85, 200));
                const cardHeight = 110; // Fixed height for consistency

                // Calculate progress based on requirements
                // Always calculate progress - default to 0% if no requirements
                let progressValue = 0;
                if (event.requirements && Array.isArray(event.requirements) && event.requirements.length > 0) {
                    const completedCount = event.requirements.filter(req => req && req.checked === true).length;
                    progressValue = Math.round((completedCount / event.requirements.length) * 100);
                } else if (event.isComplete) {
                    // If no requirements but event is complete, show 100%
                    progressValue = 100;
                } else {
                    // No requirements and not complete, show 0%
                    progressValue = 0;
                }

                // Create EventCard instance - ALWAYS include progress bar
                // Ensure progressValue is a valid number
                const finalProgressValue = isNaN(progressValue) ? 0 : Math.max(0, Math.min(100, progressValue));

                const eventCard = new EventCard(cardWidth, cardHeight, {
                    title: event.title || 'Untitled',
                    time: this._formatEventTime(event.time),
                    priority: event.priority || 'Basic',
                    xp: event.xp || 10,
                    progressBar: [finalProgressValue], // Always show progress bar for all events
                    isComplete: event.isComplete || false,
                    iconSize: 16,
                    iconScale: 1.5, // Position to the right of card
                });

                // Create a wrapper for the event card and its progress bar
                const eventWrapper = document.createElement('div');
                eventWrapper.className = 'calendar-event-wrapper';
                eventWrapper.dataset.eventId = event.id;
                eventWrapper.style.cssText = `
                    position: relative;
                    display: block;
                    overflow: visible;
                    margin: 0 auto 4px auto;
                    max-width: 100%;
                    box-sizing: border-box;
                    width: fit-content;
                `;

                // Append wrapper to cell first
                cell.appendChild(eventWrapper);

                // Create container for the event card
                const eventContainer = document.createElement('div');
                eventContainer.className = 'calendar-event-container';
                eventContainer.dataset.eventId = event.id;
                eventContainer.style.cssText = `
                    background-color: #2C2C2E;
                    cursor: pointer;
                    transition: all 150ms ease-out;
                    position: relative;
                    overflow: visible;
                    max-width: 100%;
                    box-sizing: border-box;
                `;

                // Append container to wrapper
                eventWrapper.appendChild(eventContainer);

                // Apply event card to container (progress bar will be appended to wrapper as parent)
                eventCard.applyToElement(eventContainer);

                // Progress bar is now appended to wrapper (which is the parent of eventContainer)
                // This ensures each event has its own progress bar container

                // Add unique ID to progress bar container to avoid conflicts
                if (eventCard.progressBarContainer) {
                    eventCard.progressBarContainer.id = `progress-bar-${event.id}`;
                    eventCard.progressBarContainer.dataset.eventId = event.id;
                }

                // Force progress bar to be visible if it should be shown
                if (eventCard.showProgressBar1 && eventCard.progressBarContainer) {
                    eventCard.progressBarContainer.style.display = 'flex';
                    eventCard.progressBarContainer.style.visibility = 'visible';
                    eventCard.progressBarContainer.style.opacity = '1';
                }

                // Update icon with category color and icon if available
                if (eventCard.iconElement) {
                    if (event.category?.color) {
                        eventCard.iconElement.style.backgroundColor = event.category.color;
                    }
                    const iconFontSize = 10 * eventCard.scale * eventCard.iconScale;
                    if (event.category?.icon) {
                        eventCard.iconElement.innerHTML = `<i class="${event.category.icon}" style="color: #000000; font-size: ${iconFontSize}px;"></i>`;
                    } else {
                        // Use skull-crossbones icon as default when no category
                        eventCard.iconElement.innerHTML = `<i class="fa-solid fa-skull-crossbones" style="color: #000000; font-size: ${iconFontSize}px;"></i>`;
                    }
                }

                // Add hover effects
                eventContainer.addEventListener('mouseenter', () => {
                    eventContainer.style.transform = 'scale(1.02)';
                    eventContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                    eventContainer.style.zIndex = '100';
                });

                eventContainer.addEventListener('mouseleave', () => {
                    eventContainer.style.transform = 'scale(1)';
                    eventContainer.style.boxShadow = 'none';
                    eventContainer.style.zIndex = '1';
                });

                // Add click handler to show detail view
                eventContainer.addEventListener('click', () => {
                    this._showEventDetail(event);
                });

                this.eventCards.push({ card: eventCard, element: eventContainer, data: event });

            } catch (error) {
                console.error('❌ Error rendering event:', event, error);
            }
        });

        // Update scrollbar after rendering events
        setTimeout(() => {
            this._updateScrollbar();
            this._updateCurrentTimeLine(); // Update timeline position after grid changes
        }, 50);
    }

    /**
     * Format event time for display
     */
    _formatEventTime(timeString) {
        // Extract start and end time from string like "from 10:00 AM to 10:30 AM"
        const match = timeString.match(/from\s+(\d{1,2}:\d{2}\s*[AP]M)\s+to\s+(\d{1,2}:\d{2}\s*[AP]M)/i);
        if (match) {
            return `${match[1]} to ${match[2]}`;
        }
        return timeString;
    }

    /**
     * Show event detail view
     */
    _showEventDetail(event) {
        if (!this.eventDetailView) return;

        // Store current event data
        this.currentEventData = event;

        // Calculate progress based on requirements
        let progressValue = 0;
        if (event.requirements && Array.isArray(event.requirements) && event.requirements.length > 0) {
            const completedCount = event.requirements.filter(req => req.checked).length;
            progressValue = Math.round((completedCount / event.requirements.length) * 100);
        } else {
            progressValue = event.isComplete ? 100 : 0;
        }

        // Update detail view with event data
        this.eventDetailView.setTitle(event.title || 'Untitled');
        this.eventDetailView.setTime(this._formatEventTime(event.time));
        this.eventDetailView.setPriority(event.priority || 'Basic');
        this.eventDetailView.setDescription(event.description || '');

        // Set progress bar based on requirements
        this.eventDetailView.setProgressBar1Value(progressValue);
        this.eventDetailView.setShowProgressBar2(false); // Only show one progress bar for requirements

        // Set requirements if available
        if (event.requirements && Array.isArray(event.requirements)) {
            this.eventDetailView.setRequirements(event.requirements);
        } else {
            this.eventDetailView.setRequirements([]);
        }

        // Show the detail view
        this.eventDetailView.show();

        // Call onEventClick callback if provided
        if (this.onEventClick) {
            this.onEventClick(event);
        }
    }

    /**
     * Refresh calendar (reload events)
     */
    async refresh() {
        await this._loadEvents();
    }

    /**
     * Get container element
     */
    getContainer() {
        return this.container;
    }

    /**
     * Append to DOM
     */
    appendTo(parent) {
        if (typeof parent === 'string') {
            parent = document.querySelector(parent);
        }
        if (parent) {
            // Create mobile wrapper for responsive layout
            const mobileWrapper = document.createElement('div');
            mobileWrapper.className = 'weekly-calendar-mobile-wrapper';
            mobileWrapper.id = 'weeklyCalendarMobile Wrapper';

            // Create back button for mobile
            const backButton = document.createElement('button');
            backButton.className = 'weekly-calendar-back-button';
            backButton.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back';
            backButton.addEventListener('click', () => {
                this.hideMobile();
            });

            // Append back button and calendar to wrapper
            mobileWrapper.appendChild(backButton);
            mobileWrapper.appendChild(this.container);

            // Store references
            this.mobileWrapper = mobileWrapper;
            this.backButton = backButton;

            // Append wrapper to parent
            parent.appendChild(mobileWrapper);

            this._updateCalendar();

            // Update current time line periodically
            this._updateCurrentTimeLine();
            setInterval(() => {
                this._updateCurrentTimeLine();
            }, 60000); // Update every minute
        }
    }

    /**
     * Show mobile calendar (slide in from right)
     */
    showMobile() {
        if (this.mobileWrapper) {
            this.mobileWrapper.classList.add('show');
        }
    }

    /**
     * Hide mobile calendar (slide out to right)
     */
    hideMobile() {
        if (this.mobileWrapper) {
            this.mobileWrapper.classList.remove('show');
        }
    }
}

