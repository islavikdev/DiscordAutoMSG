class DiscordAutoMSG {
    constructor() {
        this.tasks = [];
        this.currentFormData = {
            value: '60',
            text: '',
            random_delay: true
        };
        this.myUserId = null;
        this.configs = [];
        this.editingTaskId = null;
        this.initialize();
    }

    async initialize() {
        console.log('🚀 Starting...');
        await this.getUserId();
        this.loadFormData();
        await this.loadConfigs();
        this.injectUI();
        await this.loadTasksFromServer();
        console.log('✅ Ready.');
    }

    async getUserId() {
        try {
            const response = await fetch('http://localhost:5000/api/test_connection');
            const data = await response.json();
            if (data.discord_connected && data.user_id) {
                this.myUserId = data.user_id;
                console.log('✅ User ID:', this.myUserId);
            } else {
                console.error('❌ Cannot get User ID.');
                this.myUserId = 'unknown';
            }
        } catch (error) {
            console.error('❌ Error getting User ID:', error);
            this.myUserId = 'unknown';
        }
    }

    async loadConfigs() {
        try {
            const response = await fetch('http://localhost:5000/api/configs');
            if (response.ok) {
                this.configs = await response.json();
                console.log('✅ Loaded configs:', this.configs.length);
            }
        } catch (error) {
            console.error('❌ Error loading configs:', error);
        }
    }

    async saveConfig(name) {
        try {
            const response = await fetch('http://localhost:5000/api/configs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: name })
            });

            if (response.ok) {
                await this.loadConfigs();
                return true;
            }
        } catch (error) {
            console.error('❌ Error saving config:', error);
        }
        return false;
    }

    async loadConfig(name) {
        try {
            const response = await fetch(`http://localhost:5000/api/configs/load/${name}`, {
                method: 'POST'
            });

            if (response.ok) {
                await this.loadTasksFromServer();
                return true;
            }
        } catch (error) {
            console.error('❌ Error loading config:', error);
        }
        return false;
    }

    async deleteConfig(configId) {
        try {
            const response = await fetch(`http://localhost:5000/api/configs/${configId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadConfigs();
                return true;
            }
        } catch (error) {
            console.error('❌ Error deleting config:', error);
        }
        return false;
    }

    loadFormData() {
        const savedFormData = localStorage.getItem('dam_form_data');
        if (savedFormData) {
            this.currentFormData = JSON.parse(savedFormData);
        }
    }

    saveFormData() {
        localStorage.setItem('dam_form_data', JSON.stringify(this.currentFormData));
    }

    updateFormFields() {
        if (!document.getElementById('dam-menu')) return;

        document.getElementById('dam-interval-value').value = this.currentFormData.value || '60';
        document.getElementById('dam-interval-range').value = this.currentFormData.value || '60';
        document.getElementById('dam-message').value = this.currentFormData.text || '';
        document.getElementById('dam-random-delay').checked = this.currentFormData.random_delay !== false;
    }

    injectUI() {
        if (document.getElementById('dam-trigger')) return;

        const icon = document.createElement('div');
        icon.innerHTML = `
            <div id="dam-trigger" style="
                position: fixed;
                bottom: 120px;
                right: 25px;
                z-index: 10000;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #8a2be2, #6a0dad);
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 6px 25px rgba(138, 43, 226, 0.5);
                border: 3px solid rgba(255, 255, 255, 0.3);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            ">
                <span style="color: white; font-weight: 900; font-size: 24px; text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);">🤖</span>
            </div>
        `;

        document.body.appendChild(icon);

        const trigger = document.getElementById('dam-trigger');
        trigger.onmouseenter = () => {
            trigger.style.transform = 'scale(1.15) rotate(5deg)';
            trigger.style.boxShadow = '0 8px 30px rgba(138, 43, 226, 0.7)';
        };
        trigger.onmouseleave = () => {
            trigger.style.transform = 'scale(1) rotate(0deg)';
            trigger.style.boxShadow = '0 6px 25px rgba(138, 43, 226, 0.5)';
        };

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });
    }

    toggleMenu() {
        const existingMenu = document.getElementById('dam-menu');
        if (existingMenu) {
            this.closeMenu();
            return;
        }
        this.createMenu();
    }

    createMenu() {
        const menu = document.createElement('div');
        menu.id = 'dam-menu';
        menu.innerHTML = this.getMenuHTML();

        Object.assign(menu.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '9999',
            background: 'linear-gradient(135deg, #0a0a1a, #1a1a2e)',
            borderRadius: '16px',
            padding: '20px',
            width: '450px',
            height: 'auto',
            maxHeight: '80vh',
            boxShadow: '0 15px 50px rgba(0, 0, 0, 0.9)',
            border: '3px solid #8a2be2',
            fontFamily: "'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            color: '#ffffff',
            overflow: 'hidden',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column'
        });

        const stars = document.createElement('div');
        stars.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image:
                radial-gradient(2px 2px at 20px 30px, #eee, rgba(0,0,0,0)),
                radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)),
                radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)),
                radial-gradient(1px 1px at 130px 80px, #fff, rgba(0,0,0,0)),
                radial-gradient(2px 2px at 160px 30px, #eee, rgba(0,0,0,0));
            background-repeat: repeat;
            background-size: 200px 100px;
            z-index: -1;
            opacity: 0.3;
        `;
        menu.appendChild(stars);

        const header = document.createElement('div');
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;
                       margin-bottom: 15px; padding-bottom: 10px; border-bottom: 3px solid #8a2be2;
                       cursor: move;" id="dam-header">
                <h3 style="
                    margin: 0;
                    color: #ff6b6b;
                    font-size: 24px;
                    font-weight: 900;
                    text-align: center;
                    flex: 1;
                    text-shadow: 0 3px 12px rgba(255, 107, 107, 0.6);
                    font-family: 'Discord', 'Whitney', sans-serif;
                    letter-spacing: 1px;
                ">DiscordAutoMSG</h3>
                <button id="dam-close-btn" style="
                    background: none;
                    border: none;
                    color: #b9bbbe;
                    cursor: pointer;
                    font-size: 24px;
                    padding: 5px;
                    transition: all 0.2s ease;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 900;
                ">
                    ×
                </button>
            </div>
        `;
        menu.insertBefore(header, menu.firstChild);

        document.body.appendChild(menu);
        this.attachMenuHandlers();
        this.makeDraggable(menu, header.querySelector('#dam-header'));
        this.updateTaskList();
        this.updateCurrentChannelInfo();
        this.updateConfigsList();
        this.updateFormFields();
    }

    makeDraggable(element, handle) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        const onMouseMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newX = initialX + dx;
            let newY = initialY + dy;

            newX = Math.max(20, Math.min(newX, window.innerWidth - element.offsetWidth - 20));
            newY = Math.max(20, Math.min(newY, window.innerHeight - element.offsetHeight - 20));

            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
            element.style.transform = 'none';
        };

        const onMouseUp = () => {
            isDragging = false;
            element.style.cursor = 'default';
            element.style.userSelect = 'auto';

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = element.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            element.style.cursor = 'grabbing';
            element.style.userSelect = 'none';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    getMenuHTML() {
        return `
            <div style="flex-shrink: 0;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 6px; color: #ffd479; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                        ⏱️ Delay (3-600s)
                    </label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="range" id="dam-interval-range" min="3" max="600" step="1"
                            value="60"
                            style="
                                flex: 1;
                                height: 6px;
                                background: #2d2f42;
                                border-radius: 3px;
                                outline: none;
                                -webkit-appearance: none;
                            ">
                        <input type="number" id="dam-interval-value"
                            min="3" max="600"
                            value="60"
                            style="
                                width: 70px;
                                padding: 8px;
                                background: #2d2f42;
                                color: white;
                                border: 2px solid #8a2be2;
                                border-radius: 6px;
                                font-size: 13px;
                                font-weight: 700;
                                text-align: center;
                            ">
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; color: #72767d;">
                        <span>3s</span>
                        <span>10m</span>
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 6px; color: #ffd479; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                        💬 Message
                    </label>
                    <textarea id="dam-message" placeholder="Enter message text:" rows="3"
                        style="
                            width: 100%;
                            padding: 10px;
                            background: #2d2f42;
                            color: white;
                            border: 2px solid #8a2be2;
                            border-radius: 6px;
                            font-size: 13px;
                            font-weight: 700;
                            resize: vertical;
                            font-family: inherit;
                            transition: all 0.2s ease;
                        "></textarea>
                </div>

                <div style="margin-bottom: 15px; padding: 12px; background: rgba(138, 43, 226, 0.1); border-radius: 8px; border: 2px solid #8a2be2;">
                    <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 0;">
                        <input type="checkbox" id="dam-random-delay" checked
                            style="
                                margin-right: 10px;
                                width: 18px;
                                height: 18px;
                                cursor: pointer;
                                accent-color: #8a2be2;
                            ">
                        <div style="flex: 1;">
                            <div style="color: #ffd479; font-size: 13px; font-weight: 800; letter-spacing: 0.5px;">
                                🎲 Random delay (1-180s)
                            </div>
                            <div style="color: #72767d; font-size: 11px; margin-top: 2px; font-weight: 600;">
                                Adds random delay to every message
                            </div>
                        </div>
                    </label>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                    <button id="dam-add" style="
                        padding: 12px;
                        background: linear-gradient(135deg, #8a2be2, #6a0dad);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 800;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 15px rgba(138, 43, 226, 0.4);
                    ">Add Task</button>

                    <button id="dam-send-now" style="
                        padding: 12px;
                        background: linear-gradient(135deg, #43b581, #3ca374);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 800;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 15px rgba(67, 181, 129, 0.4);
                    ">Send Now</button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                    <button id="dam-start-all" style="
                        padding: 12px;
                        background: linear-gradient(135deg, #43b581, #3ca374);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 800;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 15px rgba(67, 181, 129, 0.4);
                    ">Start All</button>

                    <button id="dam-stop-all" style="
                        padding: 12px;
                        background: linear-gradient(135deg, #ed4245, #da373c);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 800;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 15px rgba(237, 66, 69, 0.4);
                    ">Stop All</button>
                </div>
                <div style="background: linear-gradient(135deg, #2d2f42, #3d3f54); padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 2px solid #8a2be2;">
                    <div style="color: #ffd479; font-size: 12px; font-weight: 800; display: flex; align-items: center;">
                        📍 Channel:
                        <span id="dam-current-channel" style="color: #ff6b6b; font-weight: 900; margin-left: 6px; background: rgba(255, 107, 107, 0.2); padding: 3px 8px; border-radius: 4px; font-size: 11px;">Loading...</span>
                    </div>
                    <div style="color: #ffd479; font-size: 11px; font-weight: 600; margin-top: 6px;">
                        🔑 User: ${this.myUserId || 'Loading...'}
                    </div>
                    <div style="color: #ffd479; font-size: 11px; font-weight: 600; margin-top: 2px;">
                        📡 Status: <span id="dam-connection-status" style="color: #43b581;">Active</span>
                    </div>
                </div>
                <div style="margin-bottom: 15px; padding: 12px; background: rgba(67, 181, 129, 0.1); border-radius: 8px; border: 2px solid #43b581;">
                    <div style="color: #43b581; font-size: 14px; font-weight: 900; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                        <span>⚙️ Configs</span>
                        <button id="dam-save-config" style="
                            background: linear-gradient(135deg, #43b581, #3ca374);
                            color: white;
                            border: none;
                            padding: 6px 12px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 11px;
                            font-weight: 800;
                        ">Save All</button>
                    </div>
                    <div id="dam-configs-list" style="max-height: 80px; overflow-y: auto; font-size: 11px;">
                        <div style="color: #72767d; text-align: center; padding: 10px; font-style: italic; font-weight: 600;">
                            No configs yet
                        </div>
                    </div>
                </div>
            </div>
            <div style="flex: 1; min-height: 120px; max-height: 250px; overflow-y: auto; background: #2d2f42; border-radius: 8px; padding: 12px; border: 2px solid #8a2be2; margin-bottom: 10px;">
                <div style="color: #ffd479; font-size: 14px; font-weight: 900; margin-bottom: 8px; display: flex; align-items: center; text-transform: uppercase; letter-spacing: 0.5px;">
                    📋 Tasks
                    <span style="background: linear-gradient(135deg, #ff6b6b, #ff8e8e); color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: 8px; font-weight: 800;" id="dam-task-count">0</span>
                </div>
                <div id="dam-tasks-list" style="font-size: 12px;"></div>
            </div>
            <div style="flex-shrink: 0; text-align: center; color: #72767d; font-size: 10px; padding-top: 8px; border-top: 1px solid #40444b; margin-top: auto;">
                Made by @islavikdev
            </div>
        `;
    }

    attachMenuHandlers() {
        document.getElementById('dam-close-btn').addEventListener('click', () => {
            this.closeMenu();
        });

        document.getElementById('dam-close-btn').addEventListener('mouseover', function() {
            this.style.background = '#ed4245';
            this.style.color = 'white';
        });

        document.getElementById('dam-close-btn').addEventListener('mouseout', function() {
            this.style.background = 'none';
            this.style.color = '#b9bbbe';
        });

        document.getElementById('dam-add').addEventListener('click', () => {
            if (this.editingTaskId) {
                this.updateTask(this.editingTaskId);
            } else {
                this.addNewTask();
            }
        });

        document.getElementById('dam-send-now').addEventListener('click', () => {
            this.sendMessageNow();
        });

        document.getElementById('dam-start-all').addEventListener('click', () => {
            this.startAllTasks();
        });

        document.getElementById('dam-stop-all').addEventListener('click', () => {
            this.stopAllTasks();
        });

        document.getElementById('dam-save-config').addEventListener('click', () => {
            this.saveCurrentAsConfig();
        });

        const rangeInput = document.getElementById('dam-interval-range');
        const numberInput = document.getElementById('dam-interval-value');

        rangeInput.addEventListener('input', () => {
            numberInput.value = rangeInput.value;
            this.saveFormState();
        });

        numberInput.addEventListener('input', () => {
            let value = parseInt(numberInput.value);
            if (isNaN(value)) value = 60;
            if (value < 3) value = 3;
            if (value > 600) value = 600;
            numberInput.value = value;
            rangeInput.value = value;
            this.saveFormState();
        });

        document.getElementById('dam-message').addEventListener('input', () => {
            this.saveFormState();
        });

        document.getElementById('dam-random-delay').addEventListener('change', () => {
            this.saveFormState();
        });

        const menu = document.getElementById('dam-menu');
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && e.target.id !== 'dam-trigger') {
                this.closeMenu();
            }
        });

        this.updateCurrentChannelInfo();
    }

    saveFormState() {
        this.currentFormData = {
            value: document.getElementById('dam-interval-value').value,
            text: document.getElementById('dam-message').value,
            random_delay: document.getElementById('dam-random-delay').checked
        };
        this.saveFormData();
    }

    updateCurrentChannelInfo() {
        const channelId = this.getCurrentChannelId();
        const channelInfo = document.getElementById('dam-current-channel');

        if (channelInfo) {
            if (channelId) {
                const name = this.getChannelName(channelId);
                channelInfo.textContent = name || `ID: ${channelId}`;
                channelInfo.setAttribute('data-channel-id', channelId);
            } else {
                channelInfo.textContent = 'Not found';
            }
        }
    }

    updateConfigsList() {
        const configsList = document.getElementById('dam-configs-list');
        if (!configsList) return;

        if (this.configs.length === 0) {
            configsList.innerHTML = `
                <div style="color: #72767d; text-align: center; padding: 10px; font-style: italic; font-weight: 600;">
                    No configs yet
                </div>
            `;
            return;
        }

        configsList.innerHTML = this.configs.slice(0, 3).map(config => `
            <div style="
                background: rgba(67, 181, 129, 0.2);
                padding: 6px;
                margin-bottom: 4px;
                border-radius: 4px;
                border: 1px solid rgba(67, 181, 129, 0.3);
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div style="flex: 1; overflow: hidden;">
                    <div style="color: #ffd479; font-size: 11px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${config.name}</div>
                    <div style="color: #72767d; font-size: 9px;">${new Date(config.created_at).toLocaleDateString()}</div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button data-config-name="${config.name}" data-action="load" style="
                        background: #43b581;
                        color: white;
                        border: none;
                        padding: 3px 6px;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 9px;
                        font-weight: 800;
                    ">Load</button>
                    <button data-config-id="${config.id}" data-action="delete" style="
                        background: #ed4245;
                        color: white;
                        border: none;
                        padding: 3px 6px;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 9px;
                        font-weight: 800;
                    ">×</button>
                </div>
            </div>
        `).join('');

        if (this.configs.length > 3) {
            configsList.innerHTML += `
                <div style="color: #72767d; font-size: 9px; text-align: center; padding: 4px; font-weight: 600;">
                    +${this.configs.length - 3} more
                </div>
            `;
        }

        configsList.querySelectorAll('button[data-config-name]').forEach(button => {
            button.addEventListener('click', (e) => {
                const configName = button.getAttribute('data-config-name');
                const action = button.getAttribute('data-action');

                if (action === 'load') {
                    this.loadConfigByName(configName);
                }
                e.stopPropagation();
            });
        });

        configsList.querySelectorAll('button[data-config-id]').forEach(button => {
            button.addEventListener('click', (e) => {
                const configId = parseInt(button.getAttribute('data-config-id'));
                const action = button.getAttribute('data-action');

                if (action === 'delete') {
                    if (confirm('Delete this config?')) {
                        this.deleteConfig(configId).then(success => {
                            if (success) {
                                this.updateConfigsList();
                                this.showNotification('✅ Config deleted.', 'success');
                            }
                        });
                    }
                }
                e.stopPropagation();
            });
        });
    }

    async saveCurrentAsConfig() {
        const name = prompt('Enter config name:');
        if (!name || !name.trim()) {
            this.showNotification('❌ Config name is required.', 'error');
            return;
        }

        const success = await this.saveConfig(name);
        if (success) {
            this.showNotification('✅ Config saved successfully!', 'success');
            this.updateConfigsList();
        } else {
            this.showNotification('❌ Error saving config.', 'error');
        }
    }

    async loadConfigByName(name) {
        const success = await this.loadConfig(name);
        if (success) {
            this.showNotification('✅ Config loaded successfully!', 'success');
        } else {
            this.showNotification('❌ Error loading config.', 'error');
        }
    }

    getCurrentChannelId() {
        try {
            const path = window.location.pathname;
            const match = path.match(/channels\/(?:\d+\/)?(\d+)/);
            if (match) return match[1];

            const channelElement = document.querySelector('[data-channel-id], [class*="channel-"]');
            if (channelElement) {
                const channelId = channelElement.getAttribute('data-channel-id') ||
                    channelElement.id?.match(/\d{17,19}/)?.[0];
                if (channelId) return channelId;
            }

            const textContent = document.body.textContent;
            const idMatch = textContent.match(/\d{17,19}/);
            if (idMatch) return idMatch[0];

            return null;
        } catch (e) {
            console.error('Error getting channel ID:', e);
            return null;
        }
    }

    getChannelName(channelId) {
        try {
            const channelElement = document.querySelector(`[data-channel-id="${channelId}"]`);
            if (channelElement) {
                const name = channelElement.textContent || channelElement.getAttribute('aria-label');
                if (name) return `#${name.replace(/^#/, '')}`;
            }

            const headings = document.querySelectorAll('h1, h2, h3, [class*="title"], [class*="header"]');
            for (const heading of headings) {
                if (heading.textContent && heading.textContent.includes('#')) {
                    return heading.textContent.trim();
                }
            }

            return null;
        } catch (e) {
            console.error('Error getting channel name:', e);
            return null;
        }
    }

    async addNewTask() {
        const value = parseInt(document.getElementById('dam-interval-value').value);
        const text = document.getElementById('dam-message').value.trim();
        const random_delay = document.getElementById('dam-random-delay').checked;

        if (!value || value < 3 || value > 600 || isNaN(value)) {
            this.showNotification('❌ Please select delay between 3-600s.', 'error');
            return;
        }

        if (!text) {
            this.showNotification('❌ Please enter message text.', 'error');
            return;
        }

        const channelId = this.getCurrentChannelId();
        if (!channelId) {
            this.showNotification('❌ Cannot detect channel. Please make sure you are in a Discord channel.', 'error');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/add_source', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    channel_id: channelId,
                    value: value,
                    text: text,
                    random_delay: random_delay
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(`✅ Task added: every ${value}s`, 'success');
                document.getElementById('dam-message').value = '';
                this.currentFormData.text = '';
                this.saveFormData();

                await this.loadTasksFromServer();
            } else {
                this.showNotification(`❌ Error: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error adding task:', error);
            this.showNotification('❌ Cannot connect to server. Make sure Flask server is running on port 5000.', 'error');
        }
    }

    async updateTask(taskId) {
        const value = parseInt(document.getElementById('dam-interval-value').value);
        const text = document.getElementById('dam-message').value.trim();
        const random_delay = document.getElementById('dam-random-delay').checked;

        if (!value || value < 3 || value > 600 || isNaN(value)) {
            this.showNotification('❌ Please select delay between 3-600s.', 'error');
            return;
        }

        if (!text) {
            this.showNotification('❌ Please enter message text.', 'error');
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/update_source/${taskId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    value: value,
                    text: text,
                    random_delay: random_delay
                })
            });

            if (response.ok) {
                this.showNotification('✅ Task updated successfully!', 'success');

                this.editingTaskId = null;
                document.getElementById('dam-add').textContent = 'Add Task';
                document.getElementById('dam-message').value = '';
                this.currentFormData.text = '';
                this.saveFormData();

                await this.loadTasksFromServer();
            }
        } catch (error) {
            console.error('Error updating task:', error);
            this.showNotification('❌ Error updating task.', 'error');
        }
    }

    async sendMessageNow() {
        const text = document.getElementById('dam-message').value.trim();

        if (!text) {
            this.showNotification('❌ Please enter message text.', 'error');
            return;
        }

        const channelId = this.getCurrentChannelId();
        if (!channelId) {
            this.showNotification('❌ Cannot detect channel.', 'error');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/send_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    channel_id: channelId,
                    message: text
                })
            });

            const result = await response.json();

            if (result.success) {
                const channelName = this.getChannelName(channelId) || `ID: ${channelId}`;
                this.showNotification(`✅ Message sent to ${channelName}`, 'success');
            } else {
                this.showNotification(`❌ Failed to send: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showNotification('❌ Cannot connect to server.', 'error');
        }
    }

    async startAllTasks() {
        try {
            const response = await fetch('http://localhost:5000/api/start_all', {
                method: 'POST'
            });

            if (response.ok) {
                this.showNotification('🚀 All tasks started.', 'success');
                await this.loadTasksFromServer();
            } else {
                this.showNotification('❌ Failed to start all tasks.', 'error');
            }
        } catch (error) {
            console.error('Error starting all tasks:', error);
            this.showNotification('❌ Cannot connect to server.', 'error');
        }
    }

    async stopAllTasks() {
        try {
            const response = await fetch('http://localhost:5000/api/stop_all', {
                method: 'POST'
            });

            if (response.ok) {
                this.showNotification('⏹️ All tasks stopped', 'info');
                await this.loadTasksFromServer();
            } else {
                this.showNotification('❌ Failed to stop all tasks', 'error');
            }
        } catch (error) {
            console.error('Error stopping all tasks:', error);
            this.showNotification('❌ Cannot connect to server', 'error');
        }
    }

    async loadTasksFromServer() {
        try {
            const response = await fetch('http://localhost:5000/api/sources');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const sources = await response.json();

            this.tasks = sources.map(source => ({
                id: source.id,
                value: source.value,
                text: source.text,
                channelId: source.channel_id,
                channelName: source.channel_name || `ID: ${source.channel_id}`,
                serverName: source.server_name || 'Current Server',
                isActive: source.is_active,
                random_delay: source.random_delay,
                createdAt: source.created_at ? new Date(source.created_at).toLocaleTimeString() : new Date().toLocaleTimeString(),
                last_executed: source.last_executed
            }));

            this.updateTaskList();
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.tasks = [];
            this.updateTaskList();
        }
    }

    updateTaskList() {
        const tasksList = document.getElementById('dam-tasks-list');
        const taskCount = document.getElementById('dam-task-count');

        if (!tasksList) return;

        if (this.tasks.length === 0) {
            tasksList.innerHTML = `
                <div style="color: #72767d; font-size: 12px; text-align: center; padding: 20px; font-style: italic; font-weight: 600;">
                    No tasks yet. Add your first task above!
                </div>
            `;
            taskCount.textContent = '0';
            return;
        }

        taskCount.textContent = this.tasks.length.toString();

        tasksList.innerHTML = this.tasks.map(task => `
            <div style="
                background: ${task.isActive ? 'linear-gradient(135deg, rgba(67, 181, 129, 0.1), rgba(67, 181, 129, 0.05))' : 'linear-gradient(135deg, rgba(138, 43, 226, 0.1), rgba(138, 43, 226, 0.05))'};
                padding: 10px;
                margin-bottom: 8px;
                border-radius: 6px;
                border-left: 4px solid ${task.isActive ? '#43b581' : '#8a2be2'};
                border: 1px solid ${task.isActive ? 'rgba(67, 181, 129, 0.3)' : 'rgba(138, 43, 226, 0.3)'};
            ">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                    <div style="flex: 1;">
                        <div style="color: ${task.isActive ? '#43b581' : '#b9bbbe'}; font-size: 12px; font-weight: 800; margin-bottom: 4px; display: flex; align-items: center;">
                            ⏰ Every ${task.value}s
                            ${task.isActive ? ' 🟢' : ' 🔴'}
                            ${task.random_delay ? '<span style="color: #ffd479; margin-left: 6px; font-size: 10px; font-weight: 700;">🎲</span>' : ''}
                        </div>
                        <div style="color: #ffd479; font-size: 11px; background: rgba(255, 255, 255, 0.05); padding: 3px 6px; border-radius: 3px; display: inline-block; font-weight: 600; margin-bottom: 4px;">
                            ${task.channelName}
                        </div>
                        ${task.serverName && task.serverName !== 'Current Server' ? `
                            <div style="color: #b9bbbe; font-size: 10px; font-weight: 600;">
                                🏰 ${task.serverName}
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        <button data-task-id="${task.id}" data-action="edit" style="
                            background: #faa61a;
                            color: white;
                            border: none;
                            padding: 4px 8px;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 10px;
                            font-weight: 800;
                            white-space: nowrap;
                        ">Edit</button>
                        <button data-task-id="${task.id}" data-action="toggle" style="
                            background: ${task.isActive ? '#ed4245' : '#43b581'};
                            color: white;
                            border: none;
                            padding: 4px 8px;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 10px;
                            font-weight: 800;
                            white-space: nowrap;
                        ">${task.isActive ? 'Stop' : 'Start'}</button>
                        <button data-task-id="${task.id}" data-action="remove" style="
                            background: #ed4245;
                            color: white;
                            border: none;
                            padding: 4px 8px;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 10px;
                            font-weight: 800;
                        ">×</button>
                    </div>
                </div>
                <div style="color: #dcddde; background: rgba(255, 255, 255, 0.03); padding: 6px; border-radius: 4px; margin-top: 6px; font-size: 11px; border-left: 2px solid #ff6b6b; font-weight: 600; word-break: break-word;">
                    ${task.text.length > 40 ? task.text.substring(0, 40) + '...' : task.text}
                </div>
                <div style="color: #72767d; font-size: 9px; margin-top: 6px; display: flex; justify-content: space-between; font-weight: 600;">
                    <span>Added: ${task.createdAt}</span>
                    ${task.last_executed ? `<span title="Last executed">🕒 ${new Date(task.last_executed).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>` : ''}
                </div>
            </div>
        `).join('');

        tasksList.querySelectorAll('button[data-task-id]').forEach(button => {
            button.addEventListener('click', async (e) => {
                const taskId = parseInt(button.getAttribute('data-task-id'));
                const action = button.getAttribute('data-action');

                if (action === 'edit') {
                    this.startEditTask(taskId);
                } else if (action === 'toggle') {
                    await this.toggleTask(taskId);
                } else if (action === 'remove') {
                    await this.removeTask(taskId);
                }

                e.stopPropagation();
            });
        });

        this.styleScrollbar();
    }

    styleScrollbar() {
        const styleId = 'dam-scrollbar-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #dam-tasks-list::-webkit-scrollbar {
                width: 6px;
            }
            #dam-tasks-list::-webkit-scrollbar-track {
                background: #1a1b2e;
                border-radius: 3px;
            }
            #dam-tasks-list::-webkit-scrollbar-thumb {
                background: linear-gradient(135deg, #8a2be2, #6a0dad);
                border-radius: 3px;
            }
            #dam-tasks-list::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(135deg, #6a0dad, #8a2be2);
            }
            #dam-configs-list::-webkit-scrollbar {
                width: 4px;
            }
            #dam-configs-list::-webkit-scrollbar-track {
                background: rgba(67, 181, 129, 0.1);
                border-radius: 2px;
            }
            #dam-configs-list::-webkit-scrollbar-thumb {
                background: rgba(67, 181, 129, 0.3);
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    startEditTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.editingTaskId = taskId;
        document.getElementById('dam-interval-value').value = task.value;
        document.getElementById('dam-interval-range').value = task.value;
        document.getElementById('dam-message').value = task.text;
        document.getElementById('dam-random-delay').checked = task.random_delay;
        document.getElementById('dam-add').textContent = 'Update Task';

        this.saveFormState();
        this.showNotification('✏️ Editing task... Click "Update Task" to save changes.', 'info');
    }

    async toggleTask(taskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) return;

            const endpoint = task.isActive ? 'stop_source' : 'start_source';
            const response = await fetch(`http://localhost:5000/api/${endpoint}/${taskId}`, {
                method: 'POST'
            });

            if (response.ok) {
                await this.loadTasksFromServer();
                this.showNotification(task.isActive ? '⏹️ Task stopped.' : '🚀 Task started.', task.isActive ? 'info' : 'success');
            } else {
                this.showNotification('❌ Failed to toggle task.', 'error');
            }
        } catch (error) {
            console.error('Error toggling task:', error);
            this.showNotification('❌ Cannot connect to server.', 'error');
        }
    }

    async removeTask(taskId) {
        if (!confirm('🚀 Are you sure you want to delete this task?')) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/delete_source/${taskId}`, {
                method: 'POST'
            });

            if (response.ok) {
                await this.loadTasksFromServer();
                this.showNotification('🗑️ Task deleted.', 'info');
            } else {
                this.showNotification('❌ Failed to delete task.', 'error');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showNotification('❌ Cannot connect to server.', 'error');
        }
    }

    closeMenu() {
        const menu = document.getElementById('dam-menu');
        if (menu) {
            menu.remove();
        }
        this.editingTaskId = null;
    }

    showNotification(message, type = 'info') {
        document.querySelectorAll('.dam-notification').forEach(el => el.remove());

        const notification = document.createElement('div');
        notification.className = 'dam-notification';
        notification.textContent = message;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ed4245' : type === 'success' ? '#43b581' : '#8a2be2'};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10002;
            font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 13px;
            font-weight: 800;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
            word-break: break-word;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                notification.style.transition = 'all 0.3s ease';

                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }
}

function initializeExtension() {
    const checkDiscordLoaded = setInterval(() => {
        if (document.body && !window.damInstance) {
            clearInterval(checkDiscordLoaded);
            try {
                window.damInstance = new DiscordAutoMSG();
                console.log('✅ Initialized.');
            } catch (error) {
                console.error('❌ Failed.', error);
            }
        }
    }, 500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}