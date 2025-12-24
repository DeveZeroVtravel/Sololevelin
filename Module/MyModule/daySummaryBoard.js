class DaySummaryBoard {
    constructor(firebaseAuth, options = {}) {
        this.firebaseAuth = firebaseAuth;
        this.container = null;
        this.progressValue = 0;
        this.selectedDate = new Date();
        this.progressCircle = null;
        this.progressText = null;
        this.totalTasksText = null;
        this.completedTasksText = null;
        this.isExpanded = false;
        this.expandButton = null;
        this.expandableSection = null;
        this.categoryBreakdown = null;
        this.hasData = false;
        this.eventDetailView = null;
        this.currentEventData = null;
        this.onEventUpdate = options.onEventUpdate || null;
        this.projects = []; // Store loaded projects

        // Initialize Event Detail View
        this._initEventDetailView();
    }

    /**
     * Initialize Event Detail View
     */
    _initEventDetailView() {
        this.currentEventData = null;

        this.eventDetailView = new EventCardDetailView({
            onComplete: async () => {
                console.log('Event completed from DaySummaryBoard');

                // Check if this is a virtual instance (repeat-forever event)
                if (this.currentEventData && this.currentEventData._isVirtualInstance) {
                    // Update instance document instead of parent event
                    const instanceId = `${this.currentEventData._parentEventId}_${this.currentEventData._instanceDate}`;
                    await this._updateInstanceCompleteStatus(instanceId, this.currentEventData._parentEventId, this.currentEventData._instanceDate, true);
                } else if (this.currentEventData && this.currentEventData.id) {
                    // Regular event - update event document
                    await this._updateEventCompleteStatus(this.currentEventData.id, true);
                }

                this.eventDetailView.hide();

                // Refresh day summary board AFTER Firestore update completes
                await this.refresh();

                // Notify parent component (e.g., weekly calendar)
                if (this.onEventUpdate) {
                    await this.onEventUpdate();
                }
            },
            onDelete: async () => {
                console.log('Event deleted from DaySummaryBoard');

                // Confirm deletion
                const confirmed = confirm('Are you sure you want to delete this event?');
                if (!confirmed) {
                    return;
                }

                // Delete event from Firestore
                if (this.currentEventData && this.currentEventData.id) {
                    await this._deleteEventFromFirestore(this.currentEventData.id);
                }

                this.eventDetailView.hide();
                // Refresh day summary board
                await this.refresh();

                // Notify parent component (e.g., weekly calendar)
                if (this.onEventUpdate) {
                    await this.onEventUpdate();
                }
            },
            onEdit: () => {
                console.log('Event edit requested from DaySummaryBoard');
                // TODO: Open edit panel
            },
            onRequirementToggle: async (requirement, index) => {
                // Update current event data requirements
                if (this.currentEventData && this.currentEventData.requirements) {
                    this.currentEventData.requirements[index] = requirement;
                }

                // Update requirement in Firestore
                if (this.currentEventData && this.currentEventData.id) {
                    await this._updateEventRequirements(this.currentEventData.id, this.currentEventData.requirements);
                }

                // Refresh day summary board
                await this.refresh();

                // Notify parent component (e.g., weekly calendar)
                if (this.onEventUpdate) {
                    await this.onEventUpdate();
                }
            }
        });
    }

    /**
     * Update event requirements in Firestore
     */
    async _updateEventRequirements(eventId, requirements) {
        try {
            const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const currentUser = this.firebaseAuth.auth.currentUser;
            if (!currentUser) return;

            const eventRef = doc(this.firebaseAuth.db, "users", currentUser.uid, "events", eventId);
            await updateDoc(eventRef, {
                requirements: requirements,
                updatedAt: (await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')).Timestamp.now()
            });
        } catch (error) {
            console.error('Error updating event requirements:', error);
        }
    }

    /**
 * Update event complete status in Firestore
 */
    async _updateEventCompleteStatus(eventId, isComplete) {
        console.log(`🔄 Updating event ${eventId} complete status to: ${isComplete}`);
        try {
            const { doc, updateDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const currentUser = this.firebaseAuth.auth.currentUser;

            if (!currentUser) {
                console.error('❌ No current user found');
                return;
            }

            console.log(`👤 Current user: ${currentUser.uid}`);
            const eventRef = doc(this.firebaseAuth.db, "users", currentUser.uid, "events", eventId);

            console.log(`📝 Updating document at path: users/${currentUser.uid}/events/${eventId}`);
            await updateDoc(eventRef, {
                isComplete: isComplete,
                updatedAt: Timestamp.now()
            });

            console.log(`✅ Successfully updated event ${eventId} complete status`);
        } catch (error) {
            console.error('❌ Error updating event complete status:', error);
            console.error('Error details:', error.message, error.code);
        }
    }

    /**
     * Update instance complete status in Firestore (for repeat-forever events)
     */
    async _updateInstanceCompleteStatus(instanceId, parentEventId, date, isComplete) {
        console.log(`🔄 Updating instance ${instanceId} complete status to: ${isComplete}`);
        try {
            const { doc, setDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const currentUser = this.firebaseAuth.auth.currentUser;

            if (!currentUser) {
                console.error('❌ No current user found');
                return;
            }

            console.log(`👤 Current user: ${currentUser.uid}`);
            const instanceRef = doc(this.firebaseAuth.db, "users", currentUser.uid, "eventInstances", instanceId);

            console.log(`📝 Updating instance document at path: users/${currentUser.uid}/eventInstances/${instanceId}`);
            await setDoc(instanceRef, {
                eventId: parentEventId,
                date: date,
                isComplete: isComplete,
                updatedAt: Timestamp.now()
            }, { merge: true });

            console.log(`✅ Successfully updated instance ${instanceId} complete status`);
        } catch (error) {
            console.error('❌ Error updating instance complete status:', error);
            console.error('Error details:', error.message, error.code);
        }
    }

    /**
     * Delete event from Firestore
     */
    async _deleteEventFromFirestore(eventId) {
        try {
            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const currentUser = this.firebaseAuth.auth.currentUser;
            if (!currentUser) return;

            const eventRef = doc(this.firebaseAuth.db, "users", currentUser.uid, "events", eventId);
            await deleteDoc(eventRef);
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    }

    /**
     * Format event time for display
     */
    _formatEventTime(timeString) {
        if (!timeString) return 'begin at 10:00 AM';
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
            const completedCount = event.requirements.filter(req => req && req.checked).length;
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
        this.eventDetailView.setShowProgressBar2(false);

        // Set requirements if available
        if (event.requirements && Array.isArray(event.requirements)) {
            this.eventDetailView.setRequirements(event.requirements);
        } else {
            this.eventDetailView.setRequirements([]);
        }

        // Show the detail view
        this.eventDetailView.show();
    }

    _createBoard() {
        console.log('📊 _createBoard: Creating day summary board container');
        this.container = document.createElement('div');
        this.container.className = 'day-summary-board';
        this.container.style.cssText = `
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
        `;
        console.log('📊 Container created:', this.container);

        // Title
        const title = document.createElement('div');
        title.textContent = 'Today\'s Progress';
        title.style.cssText = `
            font-family: 'Poppins', sans-serif;
            font-size: 16px;
            font-weight: 600;
            color: #FFFFFF;
            text-align: center;
        `;
        this.container.appendChild(title);

        // Circular Progress Container (Semicircle)
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            position: relative;
            width: 160px;
            height: 100px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            flex-shrink: 0;
        `;

        // SVG Circle Progress (Semicircle/Gauge)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '160');
        svg.setAttribute('height', '90');
        svg.setAttribute('viewBox', '0 0 160 90');
        svg.style.transform = 'rotate(0deg)';
        svg.style.overflow = 'visible';

        // Background semicircle
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const radius = 70;
        const centerX = 80;
        const centerY = 85;
        // Semicircle arc from left to right (180 degrees)
        const bgArc = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`;
        bgCircle.setAttribute('d', bgArc);
        bgCircle.setAttribute('fill', 'none');
        bgCircle.setAttribute('stroke', 'rgba(184, 232, 76, 0.1)');
        bgCircle.setAttribute('stroke-width', '12');
        bgCircle.setAttribute('stroke-linecap', 'round');
        svg.appendChild(bgCircle);

        // Progress semicircle
        this.progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.progressCircle.setAttribute('d', bgArc);
        this.progressCircle.setAttribute('fill', 'none');
        this.progressCircle.setAttribute('stroke', '#b8e84c');
        this.progressCircle.setAttribute('stroke-width', '12');
        this.progressCircle.setAttribute('stroke-linecap', 'round');

        // For semicircle, circumference is half of full circle
        const circumference = Math.PI * radius;
        this.progressCircle.style.strokeDasharray = circumference;
        this.progressCircle.style.strokeDashoffset = circumference;
        this.progressCircle.style.transition = 'stroke-dashoffset 0.5s ease';

        svg.appendChild(this.progressCircle);
        progressContainer.appendChild(svg);

        // Percentage text
        const textContainer = document.createElement('div');
        textContainer.style.cssText = `
            position: absolute;
            bottom: 5px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        this.progressText = document.createElement('div');
        this.progressText.textContent = '0';
        this.progressText.style.cssText = `
            font-family: 'Poppins', sans-serif;
            font-size: 36px;
            font-weight: 700;
            color: #b8e84c;
            line-height: 1;
        `;
        textContainer.appendChild(this.progressText);

        const percentSymbol = document.createElement('div');
        percentSymbol.textContent = '%';
        percentSymbol.style.cssText = `
            font-family: 'Poppins', sans-serif;
            font-size: 16px;
            font-weight: 500;
            color: #b8e84c;
            margin-top: 2px;
        `;
        textContainer.appendChild(percentSymbol);

        progressContainer.appendChild(textContainer);
        this.container.appendChild(progressContainer);

        // Task stats
        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
            width: 100%;
        `;

        // Completed tasks
        const completedRow = document.createElement('div');
        completedRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            background: rgba(184, 232, 76, 0.1);
            border-radius: 8px;
        `;

        const completedLabel = document.createElement('span');
        completedLabel.textContent = 'Completed';
        completedLabel.style.cssText = `
            font-family: 'Poppins', sans-serif;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
        `;
        completedRow.appendChild(completedLabel);

        this.completedTasksText = document.createElement('span');
        this.completedTasksText.textContent = '0';
        this.completedTasksText.style.cssText = `
            font-family: 'Poppins', sans-serif;
            font-size: 14px;
            font-weight: 600;
            color: #b8e84c;
        `;
        completedRow.appendChild(this.completedTasksText);

        statsContainer.appendChild(completedRow);

        // Total tasks
        const totalRow = document.createElement('div');
        totalRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
        `;

        const totalLabel = document.createElement('span');
        totalLabel.textContent = 'Total Tasks';
        totalLabel.style.cssText = `
            font-family: 'Poppins', sans-serif;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
        `;
        totalRow.appendChild(totalLabel);

        this.totalTasksText = document.createElement('span');
        this.totalTasksText.textContent = '0';
        this.totalTasksText.style.cssText = `
            font-family: 'Poppins', sans-serif;
            font-size: 14px;
            font-weight: 600;
            color: #FFFFFF;
        `;
        totalRow.appendChild(this.totalTasksText);

        statsContainer.appendChild(totalRow);
        this.container.appendChild(statsContainer);

        // Expand button
        this.expandButton = document.createElement('button');
        this.expandButton.className = 'day-summary-expand-btn';
        this.expandButton.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
        this.expandButton.style.cssText = `
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: none;
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.5);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            margin-top: 4px;
        `;

        // Add CSS for hiding button in mobile
        if (!document.getElementById('day-summary-mobile-style')) {
            const style = document.createElement('style');
            style.id = 'day-summary-mobile-style';
            style.textContent = `
                @media (max-width: 640px) {
                    .day-summary-expand-btn {
                        display: none !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        this.expandButton.addEventListener('mouseenter', () => {
            if (this.hasData) {
                this.expandButton.style.background = 'rgba(255, 255, 255, 0.1)';
                this.expandButton.style.color = 'rgba(255, 255, 255, 0.8)';
            }
        });

        this.expandButton.addEventListener('mouseleave', () => {
            this.expandButton.style.background = 'rgba(255, 255, 255, 0.05)';
            this.expandButton.style.color = 'rgba(255, 255, 255, 0.5)';
        });

        this.expandButton.addEventListener('click', () => {
            if (this.hasData) {
                this.toggleExpand();
            }
        });

        this.container.appendChild(this.expandButton);

        // Expandable section for category breakdown
        this.expandableSection = document.createElement('div');
        this.expandableSection.style.cssText = `
            width: 100%;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease, opacity 0.3s ease;
            opacity: 0;
        `;

        this.categoryBreakdown = document.createElement('div');
        this.categoryBreakdown.className = 'category-breakdown';
        this.categoryBreakdown.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding-top: 12px;
            max-height: 400px;
            overflow-y: auto;
            overflow-x: visible;
            scrollbar-width: none;
            -ms-overflow-style: none;
            width: 100%;
        `;

        // Hide scrollbar for webkit browsers
        if (!document.getElementById('day-summary-scrollbar-style')) {
            const style = document.createElement('style');
            style.id = 'day-summary-scrollbar-style';
            style.textContent = `
                .day-summary-board .category-breakdown::-webkit-scrollbar {
                    display: none;
                }
            `;
            document.head.appendChild(style);
        }

        this.expandableSection.appendChild(this.categoryBreakdown);
        this.container.appendChild(this.expandableSection);

        return this.container;
    }

    toggleExpand() {
        this.isExpanded = !this.isExpanded;

        // Get parent sidebar-top element
        const sidebarTop = this.container.parentElement;

        if (this.isExpanded) {
            // Expand - use larger max-height to accommodate event cards
            this.expandButton.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
            this.expandableSection.style.maxHeight = '600px';
            this.expandableSection.style.opacity = '1';
            if (sidebarTop) {
                sidebarTop.classList.add('expanded');
            }
        } else {
            // Collapse
            this.expandButton.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
            this.expandableSection.style.maxHeight = '0';
            this.expandableSection.style.opacity = '0';
            if (sidebarTop) {
                sidebarTop.classList.remove('expanded');
            }
        }
    }

    _updateProgress(percent, completed, total) {
        this.progressValue = Math.min(100, Math.max(0, percent));

        // Animate progress semicircle
        const radius = 70;
        const circumference = Math.PI * radius; // Half circle
        const offset = circumference - (this.progressValue / 100) * circumference;

        if (this.progressCircle) {
            this.progressCircle.style.strokeDashoffset = offset;
        }

        // Update text
        if (this.progressText) {
            this.progressText.textContent = Math.round(this.progressValue);
        }

        if (this.completedTasksText) {
            this.completedTasksText.textContent = completed;
        }

        if (this.totalTasksText) {
            this.totalTasksText.textContent = total;
        }
    }

    async loadDayProgress(date = new Date()) {
        this.selectedDate = new Date(date);
        this.selectedDate.setHours(0, 0, 0, 0);

        const currentUser = this.firebaseAuth.auth.currentUser;
        if (!currentUser) {
            this._updateProgress(0, 0, 0);
            return;
        }

        try {
            // Import Firebase modules
            const { collection, query, where, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');


            // Load categories first to get full category info
            const categoriesRef = collection(this.firebaseAuth.db, "users", currentUser.uid, "categories");
            const categoriesSnapshot = await getDocs(categoriesRef);
            const categoriesMap = {};
            categoriesSnapshot.forEach((docSnap) => {
                const catData = docSnap.data();
                if (catData._type !== 'collection_initializer') {
                    categoriesMap[catData.name] = {
                        name: catData.name,
                        color: catData.color || '#b8e84c',
                        icon: catData.icon || 'fa-solid fa-star'
                    };
                }
            });

            // Load projects
            const projectsRef = collection(this.firebaseAuth.db, "users", currentUser.uid, "projects");
            const projectsSnapshot = await getDocs(projectsRef);
            this.projects = [];
            const projectsMap = {}; // Map project names for quick lookup
            projectsSnapshot.forEach((docSnap) => {
                const projData = docSnap.data();
                if (projData._type !== 'collection_initializer') {
                    const project = {
                        id: docSnap.id,
                        name: projData.name,
                        color: projData.color || '#b8e84c',
                        icon: projData.icon || 'fa-solid fa-rocket',
                        tasks: [] // Will hold tasks for this project
                    };
                    this.projects.push(project);
                    projectsMap[projData.name] = project;
                }
            });

            // Format date as YYYY-MM-DD
            const year = this.selectedDate.getFullYear();
            const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(this.selectedDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // Query all events to also find repeat-forever events
            const eventsRef = collection(this.firebaseAuth.db, "users", currentUser.uid, "events");
            const allEventsSnapshot = await getDocs(eventsRef);

            const events = [];
            const repeatForeverEvents = [];

            // Helper to map category
            const mapCategory = (eventData) => {
                if (eventData.category) {
                    let categoryName = '';
                    if (typeof eventData.category === 'string') {
                        categoryName = eventData.category;
                    } else if (eventData.category.name) {
                        categoryName = eventData.category.name;
                    }

                    if (categoryName && categoriesMap[categoryName]) {
                        eventData.category = categoriesMap[categoryName];
                    } else if (categoryName) {
                        eventData.category = {
                            name: categoryName,
                            color: '#b8e84c',
                            icon: 'fa-solid fa-star'
                        };
                    } else {
                        eventData.category = null;
                    }
                } else {
                    eventData.category = null;
                }
            };

            allEventsSnapshot.forEach((docSnap) => {
                const eventData = docSnap.data();
                const eventWithId = { id: docSnap.id, ...eventData };

                // Get category name
                let categoryName = '';
                if (typeof eventData.category === 'string') {
                    categoryName = eventData.category;
                } else if (eventData.category && eventData.category.name) {
                    categoryName = eventData.category.name;
                }

                // Check if this event belongs to a project
                if (projectsMap[categoryName]) {
                    // This is a project task - add to project.tasks (all dates)
                    mapCategory(eventWithId);
                    projectsMap[categoryName].tasks.push(eventWithId);
                } else if (eventData.repeatForever === true && ['Daily', 'Weekly', 'Monthly', 'Yearly'].includes(eventData.repeat)) {
                    // Check if this is a repeat-forever event
                    repeatForeverEvents.push(eventWithId);
                } else if (eventData.date === dateStr) {
                    // Regular event for this date (not project-related)
                    mapCategory(eventWithId);
                    events.push(eventWithId);
                }
            });

            // Process repeat-forever events
            for (const event of repeatForeverEvents) {
                if (this._shouldEventAppearOnDate(event, this.selectedDate)) {
                    // Check for instance data (completion status)
                    const instanceId = `${event.id}_${dateStr}`;
                    const instanceRef = doc(this.firebaseAuth.db, "users", currentUser.uid, "eventInstances", instanceId);
                    const instanceDoc = await getDoc(instanceRef);
                    const instanceData = instanceDoc.exists() ? instanceDoc.data() : {};

                    // Skip deleted instances
                    if (instanceData.isDeleted === true) {
                        continue;
                    }

                    // Clone event and override with instance data
                    const virtualEvent = {
                        ...event,
                        date: dateStr,
                        isComplete: instanceData.isComplete ?? false,
                        requirements: instanceData.requirements ?? event.requirements?.map(req => ({ ...req, checked: false })) ?? [],
                        _isVirtualInstance: true,
                        _parentEventId: event.id,
                        _instanceDate: dateStr
                    };

                    mapCategory(virtualEvent);
                    events.push(virtualEvent);
                }
            }

            // Calculate progress
            const totalEvents = events.length;
            let completedEvents = 0;
            const categoryStats = {}; // Track stats by category

            events.forEach(event => {
                const categoryName = event.category?.name || 'Uncategorized';
                const categoryColor = event.category?.color || '#666666';
                const categoryIcon = event.category?.icon || 'fa-solid fa-skull-crossbones';

                if (!categoryStats[categoryName]) {
                    categoryStats[categoryName] = {
                        total: 0,
                        completed: 0,
                        color: categoryColor,
                        icon: categoryIcon
                    };
                }

                categoryStats[categoryName].total++;

                if (event.isComplete) {
                    completedEvents++;
                    categoryStats[categoryName].completed++;
                } else if (event.requirements && event.requirements.length > 0) {
                    // Check if all requirements are completed
                    const allRequirementsComplete = event.requirements.every(req => req.completed || req.checked);
                    if (allRequirementsComplete) {
                        completedEvents++;
                        categoryStats[categoryName].completed++;
                    }
                }
            });

            const progress = totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0;
            this._updateProgress(progress, completedEvents, totalEvents);
            this._updateCategoryBreakdown(categoryStats, events);

            // Show/hide expand button based on whether there's data (events OR projects)
            this.hasData = totalEvents > 0 || (this.projects && this.projects.length > 0);
            if (this.expandButton) {
                this.expandButton.style.opacity = this.hasData ? '1' : '0.3';
                this.expandButton.style.cursor = this.hasData ? 'pointer' : 'not-allowed';
            }

            // Auto-expand in mobile mode if there's data
            const isMobile = window.innerWidth <= 640;
            if (isMobile && this.hasData && !this.isExpanded) {
                this.toggleExpand();
            }

        } catch (error) {
            console.error("Error loading day progress:", error);
            this._updateProgress(0, 0, 0);
        }
    }

    /**
     * Check if a repeat-forever event should appear on a specific date
     * @param {Object} event - The repeat-forever event
     * @param {Date} targetDate - The date to check
     * @returns {boolean}
     */
    _shouldEventAppearOnDate(event, targetDate) {
        // Parse original event date
        const dateParts = event.date.split('-');
        const originalDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2])
        );
        originalDate.setHours(0, 0, 0, 0);

        // Event can't appear before its start date
        if (targetDate < originalDate) return false;

        const repeatType = event.repeat;
        const originalDay = originalDate.getDay();
        const originalDayOfMonth = originalDate.getDate();
        const originalMonth = originalDate.getMonth();

        switch (repeatType) {
            case 'Daily':
                return true;

            case 'Weekly':
                return targetDate.getDay() === originalDay;

            case 'Monthly':
                const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
                const targetDay = Math.min(originalDayOfMonth, lastDayOfMonth);
                return targetDate.getDate() === targetDay;

            case 'Yearly':
                if (targetDate.getMonth() === originalMonth) {
                    const lastDayOfCurrentMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
                    const targetDayOfMonth = Math.min(originalDayOfMonth, lastDayOfCurrentMonth);
                    return targetDate.getDate() === targetDayOfMonth;
                }
                return false;

            default:
                return false;
        }
    }

    _updateCategoryBreakdown(categoryStats, events = []) {
        // Clear existing breakdown
        this.categoryBreakdown.innerHTML = '';

        // Display Projects section (always shown)
        if (this.projects && this.projects.length > 0) {
            const projectsSection = document.createElement('div');
            projectsSection.style.cssText = `
                display: flex;
                flex-direction: column;
                width: 100%;
                margin-bottom: 16px;
                background: rgba(184, 232, 76, 0.05);
                border-radius: 8px;
                padding: 12px;
                box-sizing: border-box;
            `;

            // Projects header
            const projectsHeader = document.createElement('div');
            projectsHeader.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                padding-bottom: 10px;
                border-bottom: 1px solid rgba(184, 232, 76, 0.2);
                margin-bottom: 10px;
            `;

            const projectsIcon = document.createElement('i');
            projectsIcon.className = 'fa-solid fa-rocket';
            projectsIcon.style.cssText = `
                font-size: 14px;
                color: #b8e84c;
            `;
            projectsHeader.appendChild(projectsIcon);

            const projectsTitle = document.createElement('span');
            projectsTitle.textContent = 'Projects';
            projectsTitle.style.cssText = `
                font-family: 'Poppins', sans-serif;
                font-size: 13px;
                font-weight: 600;
                color: #b8e84c;
            `;
            projectsHeader.appendChild(projectsTitle);

            projectsSection.appendChild(projectsHeader);

            // Projects list
            const projectsList = document.createElement('div');
            projectsList.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 8px;
            `;

            this.projects.forEach(project => {
                // Skip projects with no tasks
                if (!project.tasks || project.tasks.length === 0) {
                    // Still show the project header even if no tasks
                    const projectItem = document.createElement('div');
                    projectItem.style.cssText = `
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 8px 10px;
                        background: rgba(255, 255, 255, 0.03);
                        border-radius: 6px;
                        border-left: 3px solid ${project.color};
                    `;

                    const projIcon = document.createElement('i');
                    projIcon.className = project.icon;
                    projIcon.style.cssText = `
                        font-size: 14px;
                        color: ${project.color};
                        width: 20px;
                        text-align: center;
                    `;
                    projectItem.appendChild(projIcon);

                    const projName = document.createElement('span');
                    projName.textContent = project.name;
                    projName.style.cssText = `
                        font-family: 'Poppins', sans-serif;
                        font-size: 13px;
                        font-weight: 500;
                        color: rgba(255, 255, 255, 0.6);
                        flex: 1;
                        font-style: italic;
                    `;
                    projectItem.appendChild(projName);

                    const noTaskLabel = document.createElement('span');
                    noTaskLabel.textContent = 'No tasks';
                    noTaskLabel.style.cssText = `
                        font-family: 'Poppins', sans-serif;
                        font-size: 11px;
                        color: rgba(255, 255, 255, 0.3);
                    `;
                    projectItem.appendChild(noTaskLabel);

                    projectsList.appendChild(projectItem);
                    return;
                }

                // Project container with tasks
                const projectContainer = document.createElement('div');
                projectContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 6px;
                    border-left: 3px solid ${project.color};
                    overflow: hidden;
                `;

                // Project header
                const projectHeader = document.createElement('div');
                projectHeader.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    background: rgba(255, 255, 255, 0.02);
                    cursor: pointer;
                `;

                const projIcon = document.createElement('i');
                projIcon.className = project.icon;
                projIcon.style.cssText = `
                    font-size: 14px;
                    color: ${project.color};
                    width: 20px;
                    text-align: center;
                `;
                projectHeader.appendChild(projIcon);

                const projName = document.createElement('span');
                projName.textContent = project.name;
                projName.style.cssText = `
                    font-family: 'Poppins', sans-serif;
                    font-size: 13px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                    flex: 1;
                `;
                projectHeader.appendChild(projName);

                // Task count badge
                const completedTasks = project.tasks.filter(t => t.isComplete).length;
                const taskCount = document.createElement('span');
                taskCount.textContent = `${completedTasks}/${project.tasks.length}`;
                taskCount.style.cssText = `
                    font-family: 'Poppins', sans-serif;
                    font-size: 11px;
                    font-weight: 600;
                    color: ${completedTasks === project.tasks.length ? '#b8e84c' : 'rgba(255, 255, 255, 0.5)'};
                    background: ${completedTasks === project.tasks.length ? 'rgba(184, 232, 76, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
                    padding: 2px 8px;
                    border-radius: 10px;
                `;
                projectHeader.appendChild(taskCount);

                projectContainer.appendChild(projectHeader);

                // Event cards container for project tasks
                const eventCardsContainer = document.createElement('div');
                eventCardsContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    width: 100%;
                    overflow: hidden;
                    position: relative;
                    max-height: ${115 + 6}px;
                    transition: max-height 0.3s ease;
                `;

                // Gradient overlay for collapsed state
                const hasMultipleTasks = project.tasks.length > 1;
                const gradientOverlay = document.createElement('div');
                gradientOverlay.className = 'project-gradient-overlay';
                gradientOverlay.style.cssText = `
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    width: 100%;
                    height: 60px;
                    background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.15) 30%, rgba(0, 0, 0, 0.35) 70%, rgba(0, 0, 0, 0.5) 100%);
                    pointer-events: none;
                    opacity: 1;
                    transition: opacity 0.3s ease;
                    z-index: 10;
                    display: ${hasMultipleTasks ? 'block' : 'none'};
                    border-radius: 0 0 8px 8px;
                `;

                // Create EventCard for each task in this project
                project.tasks.forEach((task, index) => {
                    // Calculate progress
                    let progressValue = 0;
                    if (task.requirements && Array.isArray(task.requirements) && task.requirements.length > 0) {
                        const completedCount = task.requirements.filter(req => req && req.checked === true).length;
                        progressValue = Math.round((completedCount / task.requirements.length) * 100);
                    } else if (task.isComplete) {
                        progressValue = 100;
                    } else {
                        progressValue = 0;
                    }

                    const finalProgressValue = isNaN(progressValue) ? 0 : Math.max(0, Math.min(100, progressValue));

                    // Format time
                    const formatTime = (timeString) => {
                        if (!timeString) return 'No time set';
                        const match = timeString.match(/from\s+(\d{1,2}:\d{2}\s*[AP]M)\s+to\s+(\d{1,2}:\d{2}\s*[AP]M)/i);
                        if (match) {
                            return `${match[1]} to ${match[2]}`;
                        }
                        return timeString;
                    };

                    // Create EventCard with smaller size for sidebar
                    const sidebarWidth = this.container?.offsetWidth || 300;
                    const categoryPadding = 16;
                    const availableWidth = sidebarWidth - categoryPadding;
                    const cardWidth = Math.max(150, Math.min(200, availableWidth - 80));
                    const cardHeight = 115;
                    const progressBarWidth = 60;
                    const progressBarOffsetX = -70;

                    const eventCard = new EventCard(cardWidth, cardHeight, {
                        title: task.title || 'Untitled',
                        time: formatTime(task.time),
                        priority: task.priority || 'Basic',
                        xp: task.xp || 10,
                        progressBar: [finalProgressValue],
                        isComplete: task.isComplete || false,
                        iconSize: 14,
                        iconScale: 1.3,
                        progressBarWidth: progressBarWidth,
                        progressBarOffsetX: progressBarOffsetX,
                    });

                    // Calculate space needed for progress bar on the left
                    const progressBarSpace = Math.abs(progressBarOffsetX * eventCard.scale);
                    const totalWidth = cardWidth + progressBarSpace;

                    // Create wrapper for event card
                    const eventWrapper = document.createElement('div');
                    eventWrapper.className = 'project-task-wrapper';
                    eventWrapper.dataset.eventId = task.id;
                    eventWrapper.style.cssText = `
                        position: relative;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        width: 100%;
                        max-width: ${totalWidth}px;
                        overflow: hidden;
                        min-height: ${cardHeight}px;
                        margin: 0 auto;
                        background: rgba(0, 0, 0, 0.3);
                        border-radius: 12px;
                        padding: 8px;
                        box-sizing: border-box;
                    `;

                    // Create container for the event card
                    const eventContainer = document.createElement('div');
                    eventContainer.className = 'project-event-container';
                    eventContainer.dataset.eventId = task.id;
                    eventContainer.style.cssText = `
                        background-color: #2C2C2E;
                        cursor: pointer;
                        transition: all 150ms ease-out;
                        position: relative;
                        overflow: visible;
                        width: ${cardWidth}px;
                        flex-shrink: 0;
                    `;

                    // Add click handler to open event detail view
                    eventContainer.addEventListener('click', () => {
                        this._showEventDetail(task);
                    });

                    // Add hover effect
                    eventContainer.addEventListener('mouseenter', () => {
                        eventContainer.style.opacity = '0.9';
                        eventContainer.style.transform = 'scale(0.98)';
                    });

                    eventContainer.addEventListener('mouseleave', () => {
                        eventContainer.style.opacity = '1';
                        eventContainer.style.transform = 'scale(1)';
                    });

                    // Apply event card to container (same as category breakdown)
                    eventCard.applyToElement(eventContainer);

                    // Update icon with project color and icon
                    if (eventCard.iconElement) {
                        const projectColor = project.color || '#b8e84c';
                        const projectIcon = project.icon || 'fa-solid fa-rocket';
                        eventCard.iconElement.style.backgroundColor = projectColor;
                        eventCard.iconElement.innerHTML = `<i class="${projectIcon}"></i>`;
                    }

                    // Append container to wrapper
                    eventWrapper.appendChild(eventContainer);
                    eventCardsContainer.appendChild(eventWrapper);
                });

                // Add expand/collapse button if more than 1 task
                let isProjectExpanded = false;
                if (hasMultipleTasks) {
                    const expandBtn = document.createElement('button');
                    expandBtn.innerHTML = `<i class="fa-solid fa-chevron-down"></i> Show ${project.tasks.length - 1} more`;
                    expandBtn.style.cssText = `
                        background: rgba(184, 232, 76, 0.1);
                        border: 1px solid rgba(184, 232, 76, 0.3);
                        color: #b8e84c;
                        padding: 6px 12px;
                        border-radius: 6px;
                        font-size: 11px;
                        font-family: 'Poppins', sans-serif;
                        cursor: pointer;
                        margin-top: 8px;
                        transition: all 150ms ease-out;
                        z-index: 20;
                        position: relative;
                    `;

                    expandBtn.addEventListener('click', () => {
                        isProjectExpanded = !isProjectExpanded;
                        if (isProjectExpanded) {
                            eventCardsContainer.style.maxHeight = `${(115 + 6) * project.tasks.length + 50}px`;
                            gradientOverlay.style.opacity = '0';
                            expandBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i> Show less';
                        } else {
                            eventCardsContainer.style.maxHeight = `${115 + 6}px`;
                            gradientOverlay.style.opacity = '1';
                            expandBtn.innerHTML = `<i class="fa-solid fa-chevron-down"></i> Show ${project.tasks.length - 1} more`;
                        }
                    });

                    eventCardsContainer.appendChild(gradientOverlay);
                    projectContainer.appendChild(eventCardsContainer);
                    projectContainer.appendChild(expandBtn);
                } else {
                    projectContainer.appendChild(eventCardsContainer);
                }

                projectsList.appendChild(projectContainer);
            });

            projectsSection.appendChild(projectsList);
            this.categoryBreakdown.appendChild(projectsSection);
        }

        // If no categories, don't show anything else
        if (Object.keys(categoryStats).length === 0) {
            return;
        }

        // Sort categories by total tasks (descending)
        const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1].total - a[1].total);

        // Group events by category
        const eventsByCategory = {};
        events.forEach(event => {
            const categoryName = event.category?.name || 'Uncategorized';
            if (!eventsByCategory[categoryName]) {
                eventsByCategory[categoryName] = [];
            }
            eventsByCategory[categoryName].push(event);
        });

        // Add each category section with event cards
        sortedCategories.forEach(([categoryName, stats]) => {
            const categoryEvents = eventsByCategory[categoryName] || [];

            // Create main container div for this category
            const categoryContainer = document.createElement('div');
            categoryContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                width: 100%;
                margin-bottom: 12px;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
                padding: 8px;
                box-sizing: border-box;
            `;

            // Category header - icon and name on the left, completed count on the right
            const categoryHeader = document.createElement('div');
            categoryHeader.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                margin-bottom: 8px;
            `;

            // Left side: icon and name
            const leftSide = document.createElement('div');
            leftSide.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
                min-width: 0;
            `;

            const icon = document.createElement('i');
            icon.className = stats.icon;
            icon.style.cssText = `
                font-size: 14px;
                color: ${stats.color};
                flex-shrink: 0;
            `;
            leftSide.appendChild(icon);

            const name = document.createElement('span');
            name.textContent = categoryName;
            name.style.cssText = `
                font-family: 'Poppins', sans-serif;
                font-size: 12px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            leftSide.appendChild(name);
            categoryHeader.appendChild(leftSide);

            // Right side: completed/total count
            const count = document.createElement('span');
            count.textContent = `${stats.completed}/${stats.total}`;
            count.style.cssText = `
                font-family: 'Poppins', sans-serif;
                font-size: 11px;
                font-weight: 600;
                color: ${stats.completed === stats.total ? '#b8e84c' : 'rgba(255, 255, 255, 0.6)'};
                flex-shrink: 0;
            `;
            categoryHeader.appendChild(count);

            categoryContainer.appendChild(categoryHeader);

            // Expand/collapse button for category (only show if more than 1 event)
            const hasMultipleEvents = categoryEvents.length > 1;
            let isCategoryExpanded = false;

            // Event cards container for this category
            const eventCardsContainer = document.createElement('div');
            eventCardsContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                width: 100%;
                overflow: hidden;
                position: relative;
                max-height: ${115 + 6}px;
                transition: max-height 0.3s ease;
            `;

            // Gradient overlay for collapsed state - placed outside container to avoid overflow hidden
            const gradientOverlay = document.createElement('div');
            gradientOverlay.className = 'category-gradient-overlay';
            gradientOverlay.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                width: 100%;
                height: 60px;
                background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.15) 30%, rgba(0, 0, 0, 0.35) 70%, rgba(0, 0, 0, 0.5) 100%);
                pointer-events: none;
                opacity: 1;
                transition: opacity 0.3s ease;
                z-index: 10;
                display: block;
                border-radius: 0 0 8px 8px;
            `;

            // Create EventCard for each event in this category
            categoryEvents.forEach((event, index) => {
                // Calculate progress
                let progressValue = 0;
                if (event.requirements && Array.isArray(event.requirements) && event.requirements.length > 0) {
                    const completedCount = event.requirements.filter(req => req && req.checked === true).length;
                    progressValue = Math.round((completedCount / event.requirements.length) * 100);
                } else if (event.isComplete) {
                    progressValue = 100;
                } else {
                    progressValue = 0;
                }

                const finalProgressValue = isNaN(progressValue) ? 0 : Math.max(0, Math.min(100, progressValue));

                // Format time
                const formatTime = (timeString) => {
                    if (!timeString) return 'begin at 10:00 AM';
                    const match = timeString.match(/from\s+(\d{1,2}:\d{2}\s*[AP]M)\s+to\s+(\d{1,2}:\d{2}\s*[AP]M)/i);
                    if (match) {
                        return `${match[1]} to ${match[2]}`;
                    }
                    return timeString;
                };

                // Create EventCard with smaller size for sidebar
                // Calculate width to fit sidebar (accounting for padding)
                const sidebarWidth = this.container?.offsetWidth || 300;
                const categoryPadding = 16; // 8px padding on each side
                const availableWidth = sidebarWidth - categoryPadding;
                // Ensure card width fits within available space, with minimum of 150px
                const cardWidth = Math.max(150, Math.min(200, availableWidth - 80)); // Reserve 80px for progress bar
                const cardHeight = 115; // Increased from 100 to 115

                // Progress bar width and offset - adjust to fit inside container
                const progressBarWidth = 60;
                const progressBarOffsetX = -70; // Negative offset means it goes to the left of card

                const eventCard = new EventCard(cardWidth, cardHeight, {
                    title: event.title || 'Untitled',
                    time: formatTime(event.time),
                    priority: event.priority || 'Basic',
                    xp: event.xp || 10,
                    progressBar: [finalProgressValue],
                    isComplete: event.isComplete || false,
                    iconSize: 14,
                    iconScale: 1.3,
                    progressBarWidth: progressBarWidth,
                    progressBarOffsetX: progressBarOffsetX,
                });

                // Calculate space needed for progress bar on the left
                const progressBarSpace = Math.abs(progressBarOffsetX * eventCard.scale);
                const totalWidth = cardWidth + progressBarSpace;

                // Create wrapper for event card - this will contain both card and progress bar
                const eventWrapper = document.createElement('div');
                eventWrapper.className = 'day-summary-event-wrapper';
                eventWrapper.dataset.eventId = event.id;
                eventWrapper.style.cssText = `
                    position: relative;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                    max-width: ${totalWidth}px;
                    overflow: hidden;
                    min-height: ${cardHeight}px;
                    margin: 0 auto;
                `;

                // Create container for the event card
                const eventContainer = document.createElement('div');
                eventContainer.className = 'day-summary-event-container';
                eventContainer.dataset.eventId = event.id;
                eventContainer.style.cssText = `
                    background-color: #2C2C2E;
                    cursor: pointer;
                    transition: all 150ms ease-out;
                    position: relative;
                    overflow: visible;
                    width: ${cardWidth}px;
                    flex-shrink: 0;
                `;

                // Add click handler to open event detail view
                eventContainer.addEventListener('click', () => {
                    this._showEventDetail(event);
                });

                // Add hover effect
                eventContainer.addEventListener('mouseenter', () => {
                    eventContainer.style.opacity = '0.9';
                    eventContainer.style.transform = 'scale(0.98)';
                });

                eventContainer.addEventListener('mouseleave', () => {
                    eventContainer.style.opacity = '1';
                    eventContainer.style.transform = 'scale(1)';
                });

                // Apply event card to container
                eventCard.applyToElement(eventContainer);

                // Update icon with category color and icon
                if (eventCard.iconElement) {
                    // Get category info from event or use defaults
                    const categoryColor = event.category?.color || '#b8e84c';
                    const categoryIcon = event.category?.icon || 'fa-solid fa-skull-crossbones';

                    // Set background color
                    eventCard.iconElement.style.backgroundColor = categoryColor;

                    // Set icon - always set an icon
                    eventCard.iconElement.innerHTML = `<i class="${categoryIcon}"></i>`;
                }

                // Append container to wrapper first
                eventWrapper.appendChild(eventContainer);

                // Append progress bar container to wrapper if it exists
                // Position it relative to the wrapper
                if (eventCard.progressBarContainer) {
                    eventCard.progressBarContainer.id = `day-summary-progress-bar-${event.id}`;
                    eventCard.progressBarContainer.dataset.eventId = event.id;
                    // Position progress bar relative to card
                    const progressBarLeft = cardWidth + (eventCard.progressBarOffsetX * eventCard.scale);
                    eventCard.progressBarContainer.style.left = `${progressBarLeft}px`;
                    eventCard.progressBarContainer.style.position = 'absolute';
                    eventCard.progressBarContainer.style.top = '0';
                    eventWrapper.appendChild(eventCard.progressBarContainer);
                }

                // Only show first event initially
                if (index > 0) {
                    eventWrapper.style.display = 'none';
                }

                eventCardsContainer.appendChild(eventWrapper);
            });

            // Append event cards container to category container
            categoryContainer.appendChild(eventCardsContainer);

            // Append gradient overlay to category container (outside eventCardsContainer to avoid overflow hidden)
            if (hasMultipleEvents) {
                categoryContainer.style.position = 'relative';
                categoryContainer.appendChild(gradientOverlay);
            }

            // Expand/collapse button - placed below event cards, centered
            if (hasMultipleEvents) {
                const expandButton = document.createElement('button');
                expandButton.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
                expandButton.style.cssText = `
                    width: 100%;
                    border: none;
                    background: transparent;
                    color: rgba(255, 255, 255, 0.6);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 8px 0;
                    transition: all 0.3s ease;
                    font-size: 12px;
                    margin-top: 4px;
                `;

                expandButton.addEventListener('mouseenter', () => {
                    expandButton.style.color = 'rgba(255, 255, 255, 0.9)';
                });

                expandButton.addEventListener('mouseleave', () => {
                    expandButton.style.color = 'rgba(255, 255, 255, 0.6)';
                });

                expandButton.addEventListener('click', () => {
                    isCategoryExpanded = !isCategoryExpanded;

                    // Update button icon
                    expandButton.innerHTML = isCategoryExpanded
                        ? '<i class="fa-solid fa-chevron-up"></i>'
                        : '<i class="fa-solid fa-chevron-down"></i>';

                    // Show/hide additional events
                    const eventWrappers = eventCardsContainer.querySelectorAll('.day-summary-event-wrapper');
                    eventWrappers.forEach((wrapper, idx) => {
                        if (idx > 0) {
                            wrapper.style.display = isCategoryExpanded ? 'flex' : 'none';
                        }
                    });

                    // Update container max-height
                    if (isCategoryExpanded) {
                        eventCardsContainer.style.maxHeight = `${(categoryEvents.length * (115 + 6))}px`;
                        gradientOverlay.style.opacity = '0';
                        gradientOverlay.style.display = 'none';
                    } else {
                        eventCardsContainer.style.maxHeight = `${115 + 6}px`;
                        gradientOverlay.style.opacity = '1';
                        gradientOverlay.style.display = 'block';
                    }
                });

                categoryContainer.appendChild(expandButton);
            } else {
                // No gradient overlay if only 1 event
                gradientOverlay.style.display = 'none';
            }

            // Append category container to breakdown
            this.categoryBreakdown.appendChild(categoryContainer);
        });
    }

    async refresh() {
        await this.loadDayProgress(this.selectedDate);
    }

    setDate(date) {
        this.loadDayProgress(date);
    }

    appendTo(parentElement) {
        console.log('📊 DaySummaryBoard: appendTo called');
        if (!this.container) {
            console.log('📊 Creating board...');
            this._createBoard();
        }
        console.log('📊 Appending to parent:', parentElement);
        parentElement.appendChild(this.container);
        console.log('📊 Loading day progress...');
        this.loadDayProgress();
    }

    show() {
        if (!this.container) {
            this._createBoard();
        }
        this.container.style.display = 'flex';
        this.loadDayProgress();
        return this.container;
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
}

