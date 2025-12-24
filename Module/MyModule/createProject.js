class CreateProjectPanel {
    constructor(options = {}) {
        // Callbacks
        this.onCreate = options.onCreate ?? null;
        this.onCancel = options.onCancel ?? null;

        // Default values
        this.selectedColor = '#b8e84c';
        this.selectedIcon = 'fa-solid fa-rocket';

        // DOM elements
        this.panel = null;
        this.overlay = null;
        this.isVisible = false;

        // Create the panel structure
        this._createPanel();
    }

    _createPanel() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 10002;
            display: none;
            opacity: 0;
            transition: opacity 200ms ease-in-out;
        `;

        this.overlay.addEventListener('click', () => {
            this.hide();
        });

        // Create panel
        this.panel = document.createElement('div');
        this.panel.className = 'create-project-panel';
        this.panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            width: 400px;
            height: 600px;
            background-color: #1C1C1E;
            border-radius: 12px;
            z-index: 10003;
            display: none;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
            box-sizing: border-box;
        `;

        // Header
        const header = this._createHeader();

        // Content container
        const content = this._createContent();

        this.panel.appendChild(header);
        this.panel.appendChild(content);
    }

    _createHeader() {
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            flex-shrink: 0;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Create Project';
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
            this.hide();
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        return header;
    }

    _createContent() {
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 24px;
            overflow-y: auto;
            min-height: 0;
        `;

        // Name input
        const nameSection = this._createNameSection();

        // Color picker section
        const colorSection = this._createColorSection();

        // Icon picker section
        const iconSection = this._createIconSection();

        // Create button
        const createBtn = this._createButton();

        content.appendChild(nameSection);
        content.appendChild(colorSection);
        content.appendChild(iconSection);
        content.appendChild(createBtn);

        return content;
    }

    _createNameSection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Project Name';
        label.style.cssText = `
            color: #AEAEB2;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = 'Enter project name';
        this.nameInput.style.cssText = `
            background-color: #1C1C1E;
            color: #FFFFFF;
            border: 1px solid #636366;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            font-family: 'OpenSans', Arial, sans-serif;
            outline: none;
            transition: all 150ms ease-out;
        `;

        this.nameInput.addEventListener('focus', () => {
            this.nameInput.style.borderColor = '#b8e84c';
            this.nameInput.style.backgroundColor = '#2C2C2E';
        });

        this.nameInput.addEventListener('blur', () => {
            this.nameInput.style.borderColor = '#636366';
            this.nameInput.style.backgroundColor = '#1C1C1E';
        });

        container.appendChild(label);
        container.appendChild(this.nameInput);

        return container;
    }

    _createColorSection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Color';
        label.style.cssText = `
            color: #AEAEB2;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        const colorPickerContainer = document.createElement('div');
        colorPickerContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 8px;
        `;

        const colors = [
            '#b8e84c', '#FF3B30', '#007AFF', '#34C759', '#FF9F0A', '#AF52DE',
            '#FF2D55', '#5856D6', '#5AC8FA', '#FF9500', '#FFCC00', '#8E8E93'
        ];

        colors.forEach(color => {
            const colorOption = document.createElement('div');
            colorOption.style.cssText = `
                width: 40px;
                height: 40px;
                border-radius: 8px;
                background-color: ${color};
                cursor: pointer;
                transition: all 150ms ease-out;
                border: 2px solid transparent;
            `;

            if (color === this.selectedColor) {
                colorOption.style.borderColor = '#FFFFFF';
                colorOption.style.transform = 'scale(1.1)';
            }

            colorOption.addEventListener('click', () => {
                this.selectedColor = color;
                colorPickerContainer.querySelectorAll('div').forEach(opt => {
                    opt.style.borderColor = 'transparent';
                    opt.style.transform = 'scale(1)';
                });
                colorOption.style.borderColor = '#FFFFFF';
                colorOption.style.transform = 'scale(1.1)';
            });

            colorPickerContainer.appendChild(colorOption);
        });

        container.appendChild(label);
        container.appendChild(colorPickerContainer);

        return container;
    }

    _createIconSection() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        const label = document.createElement('label');
        label.textContent = 'Icon';
        label.style.cssText = `
            color: #AEAEB2;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
        `;

        const iconPickerContainer = document.createElement('div');
        iconPickerContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 8px;
            max-height: 200px;
            overflow-y: auto;
            padding: 8px;
            background-color: #2C2C2E;
            border-radius: 8px;
        `;

        // Hide scrollbar
        iconPickerContainer.style.scrollbarWidth = 'none';
        iconPickerContainer.style.msOverflowStyle = 'none';
        const style = document.createElement('style');
        style.textContent = `
            .create-project-panel .icon-picker::-webkit-scrollbar {
                display: none;
            }
        `;
        iconPickerContainer.className = 'icon-picker';
        if (!document.querySelector('style[data-project-icon-picker-scroll]')) {
            style.setAttribute('data-project-icon-picker-scroll', 'true');
            document.head.appendChild(style);
        }

        // Project-related icons
        const icons = [
            'fa-solid fa-rocket', 'fa-solid fa-lightbulb', 'fa-solid fa-code',
            'fa-solid fa-laptop-code', 'fa-solid fa-diagram-project', 'fa-solid fa-bullseye',
            'fa-solid fa-flag', 'fa-solid fa-trophy', 'fa-solid fa-chart-line',
            'fa-solid fa-puzzle-piece', 'fa-solid fa-cube', 'fa-solid fa-layer-group',
            'fa-solid fa-gears', 'fa-solid fa-wand-magic-sparkles', 'fa-solid fa-bolt',
            'fa-solid fa-fire', 'fa-solid fa-gem', 'fa-solid fa-crown'
        ];

        icons.forEach(iconClass => {
            const iconOption = document.createElement('div');
            iconOption.innerHTML = `<i class="${iconClass}"></i>`;
            iconOption.style.cssText = `
                width: 40px;
                height: 40px;
                border-radius: 8px;
                background-color: #1C1C1E;
                color: #FFFFFF;
                cursor: pointer;
                transition: all 150ms ease-out;
                border: 2px solid transparent;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
            `;

            if (iconClass === this.selectedIcon) {
                iconOption.style.borderColor = '#b8e84c';
                iconOption.style.backgroundColor = 'rgba(184, 232, 76, 0.2)';
            }

            iconOption.addEventListener('click', () => {
                this.selectedIcon = iconClass;
                iconPickerContainer.querySelectorAll('div').forEach(opt => {
                    opt.style.borderColor = 'transparent';
                    opt.style.backgroundColor = '#1C1C1E';
                });
                iconOption.style.borderColor = '#b8e84c';
                iconOption.style.backgroundColor = 'rgba(184, 232, 76, 0.2)';
            });

            iconPickerContainer.appendChild(iconOption);
        });

        container.appendChild(label);
        container.appendChild(iconPickerContainer);

        return container;
    }

    _createButton() {
        const button = document.createElement('button');
        button.textContent = 'Create';
        button.style.cssText = `
            width: 100%;
            background-color: #b8e84c;
            color: #1C1C1E;
            border: none;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            font-family: 'OpenSans', Arial, sans-serif;
            cursor: pointer;
            transition: all 150ms ease-out;
            min-height: 40px;
            flex-shrink: 0;
        `;

        button.addEventListener('mouseenter', () => {
            button.style.opacity = '0.9';
        });

        button.addEventListener('mouseleave', () => {
            button.style.opacity = '1';
        });

        button.addEventListener('click', async () => {
            const projectName = this.nameInput.value.trim();
            console.log('🚀 Create button clicked, project name:', projectName);

            if (!projectName) {
                alert('Please enter a project name');
                return;
            }

            // Create new project object
            const newProject = {
                name: projectName,
                color: this.selectedColor,
                icon: this.selectedIcon
            };
            console.log('📦 New project object:', newProject);

            // Call onCreate callback
            if (this.onCreate) {
                console.log('📤 Calling onCreate callback...');
                await this.onCreate(newProject);
                console.log('✅ onCreate callback completed');
            } else {
                console.warn('⚠️ No onCreate callback defined');
            }

            // Reset and hide
            this._reset();
            this.hide();
        });

        return button;
    }

    _reset() {
        if (this.nameInput) {
            this.nameInput.value = '';
        }
        this.selectedColor = '#b8e84c';
        this.selectedIcon = 'fa-solid fa-rocket';
    }

    show() {
        if (!this.panel.parentNode) {
            document.body.appendChild(this.overlay);
            document.body.appendChild(this.panel);
        }

        this.isVisible = true;
        this.overlay.style.display = 'block';
        this.panel.style.display = 'flex';

        requestAnimationFrame(() => {
            this.overlay.style.opacity = '1';
            this.panel.style.transform = 'translate(-50%, -50%) scale(1)';
            this.panel.style.opacity = '1';
        });
    }

    hide() {
        if (this.isVisible) {
            this.isVisible = false;
            this.panel.style.transform = 'translate(-50%, -50%) scale(0.95)';
            this.panel.style.opacity = '0';
            this.overlay.style.opacity = '0';

            setTimeout(() => {
                this.overlay.style.display = 'none';
                this.panel.style.display = 'none';
            }, 200);

            if (this.onCancel) {
                this.onCancel();
            }
        }
    }
}
