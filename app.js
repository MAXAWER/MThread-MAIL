// MThread Messenger - Application Logic (Direct Messages Architecture)

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const authModal = document.getElementById('auth-modal');
    const stepLogin = document.getElementById('step-login');
    const stepRegister = document.getElementById('step-register');
    
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    
    const loginUser = document.getElementById('login-username');
    const loginPass = document.getElementById('login-password');
    const regUser = document.getElementById('reg-username');
    const regEmail = document.getElementById('reg-email');
    const regPass = document.getElementById('reg-password');
    
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages-container');
    const chatListContainer = document.getElementById('chat-list-container');
    const activeChatName = document.getElementById('active-chat-name');

    const searchInput = document.getElementById('user-search-input');
    const searchResults = document.getElementById('user-search-results');
    const contextMenu = document.getElementById('message-context-menu');
    const ctxEditBtn = document.getElementById('ctx-btn-edit');
    const ctxDeleteBtn = document.getElementById('ctx-btn-delete');

    const sendBtn = document.getElementById('send-btn');
    const chatVoiceBtn = document.getElementById('chat-voice-btn');

    let currentUser = null;
    let db = null;
    let storage = null;
    let activeChatId = null;
    let activeChatUser = null;
    let messagesUnsubscribe = null;
    let chatsUnsubscribe = null;
    let statusUnsubscribe = null;
    let activeChatTypingUnsubscribe = null;

    const userCache = {};

    async function getUserCached(uid) {
        if (userCache[uid]) {
            return userCache[uid];
        }
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                userCache[uid] = userDoc.data();
                return userCache[uid];
            }
        } catch (e) {
            console.error('getUserCached error:', e);
        }
        return null;
    }

    // MFA state variables (shared across scopes)
    let _mfaResolver = null;
    let _mfaRecaptchaVerifier = null;
    let _mfaSetupRecaptcha = null;
    let _mfaSetupVerificationId = null;

    const chatOptionsBtn = document.getElementById('chat-options-btn');
    const chatOptionsMenu = document.getElementById('chat-options-menu');
    const btnClearChat = document.getElementById('btn-clear-chat');

    // --- Tab Switching ---
    let currentTab = 'dm'; // 'dm' or 'groups'
    const navDmBtn = document.getElementById('nav-dm-btn');
    const navGroupBtn = document.getElementById('nav-group-btn');
    const panelTitle = document.getElementById('panel-title');
    const createGroupFab = document.getElementById('create-group-fab');
    const mobNavDm = document.getElementById('mob-nav-dm');
    const mobNavGroups = document.getElementById('mob-nav-groups');

    window.switchTab = (tab) => {
        currentTab = tab;
        
        // Update Desktop Nav
        if (tab === 'dm') {
            navDmBtn.className = 'p-3 bg-primary-container/10 text-primary-container rounded-xl cursor-pointer ripple-container transition-all';
            navGroupBtn.className = 'p-3 text-on-surface-variant hover:bg-white/5 hover:text-white rounded-xl cursor-pointer ripple-container transition-all';
            mobNavDm.className = 'text-primary-container flex flex-col items-center gap-1 ripple-container p-2 rounded-xl transition-all';
            mobNavGroups.className = 'text-on-surface-variant flex flex-col items-center gap-1 ripple-container p-2 rounded-xl transition-all';
            panelTitle.textContent = 'Чаты';
            createGroupFab.classList.add('hidden');
            loadChatList();
        } else {
            navGroupBtn.className = 'p-3 bg-primary-container/10 text-primary-container rounded-xl cursor-pointer ripple-container transition-all';
            navDmBtn.className = 'p-3 text-on-surface-variant hover:bg-white/5 hover:text-white rounded-xl cursor-pointer ripple-container transition-all';
            mobNavGroups.className = 'text-primary-container flex flex-col items-center gap-1 ripple-container p-2 rounded-xl transition-all';
            mobNavDm.className = 'text-on-surface-variant flex flex-col items-center gap-1 ripple-container p-2 rounded-xl transition-all';
            panelTitle.textContent = 'Группы';
            createGroupFab.classList.remove('hidden');
            loadGroupList();
        }
    };

    // --- Android 12 Material You Systems ---

    function createRipple(event) {
        const button = event.currentTarget;
        const circle = document.createElement("span");
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        const rect = button.getBoundingClientRect();
        
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add("ripple");
        
        const existingRipple = button.querySelector('.ripple');
        if (existingRipple) { existingRipple.remove(); }
        
        button.appendChild(circle);
    }
    
    function attachRipples() {
        document.querySelectorAll('.ripple-container:not(.ripple-attached)').forEach(btn => {
            btn.addEventListener('click', createRipple);
            btn.classList.add('ripple-attached');
        });
    }
    attachRipples();

    window.showSnackbar = (message) => {
        const container = document.getElementById('snackbar-container');
        const snackbar = document.createElement('div');
        snackbar.className = 'snackbar';
        snackbar.textContent = message;
        
        container.appendChild(snackbar);
        
        setTimeout(() => {
            snackbar.classList.add('hiding');
            snackbar.addEventListener('animationend', () => snackbar.remove());
        }, 3000);
    };

    // --- Settings & Avatar System ---
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const settingsName = document.getElementById('settings-name');
    const settingsBio = document.getElementById('settings-bio');
    const avatarInput = document.getElementById('avatar-upload-input');
    const uploadProgress = document.getElementById('upload-progress');
    let userProfileData = {};

    window.showSettings = async () => {
        if (!currentUser) return;
        try {
            const doc = await db.collection("users").doc(currentUser.uid).get();
            if (doc.exists) {
                userProfileData = doc.data();
                settingsName.value = currentUser.displayName || userProfileData.username || '';
                settingsBio.value = userProfileData.bio || '';
            }
        } catch (e) { console.error(e); }

        // Сброс окон настройки MFA
        const form = document.getElementById('mfa-phone-setup-form');
        const codeBlock = document.getElementById('mfa-setup-code-block');
        const verifyBlock = document.getElementById('mfa-email-verify-block');
        if (form) form.classList.add('hidden');
        if (codeBlock) codeBlock.classList.add('hidden');
        if (verifyBlock) verifyBlock.classList.add('hidden');

        // Открытие модального окна
        settingsModal.classList.remove('hidden');
        settingsModal.style.display = 'flex';

        // Обновление статусов с небольшой задержкой для надежности инициализации Firebase Auth
        setTimeout(() => {
            refreshMfaStatus();
            updatePushUI();
        }, 150);
    };

    window.closeSettings = () => {
        const modalContent = settingsModal.querySelector('.bg-surface');
        if (modalContent) {
            modalContent.style.transform = 'scale(0.95)';
            modalContent.style.opacity = '0';
        }
        setTimeout(() => {
            settingsModal.classList.add('hidden');
            settingsModal.style.display = 'none';
            if (modalContent) {
                modalContent.style.transform = '';
                modalContent.style.opacity = '';
            }
        }, 200);
    };

    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUser) return;
        
        uploadProgress.classList.remove('hidden');
        const storageRef = storage.ref(`avatars/${currentUser.uid}_${Date.now()}`);
        
        try {
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            await db.collection("users").doc(currentUser.uid).set({ avatarUrl: downloadURL }, { merge: true });
            userProfileData.avatarUrl = downloadURL;
            updateProfileUI();
            showSnackbar('Аватарка обновлена!');
        } catch (err) {
            if (err.message.includes('not been set up')) {
                showSnackbar('Ошибка: Firebase Storage не активирован в консоли!');
            } else {
                showSnackbar('Ошибка загрузки: ' + err.message);
            }
        } finally {
            uploadProgress.classList.add('hidden');
            avatarInput.value = '';
        }
    });

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('settings-save-btn');
        btn.disabled = true; btn.textContent = 'Сохранение...';

        const newName = settingsName.value.trim();
        const newBio = settingsBio.value.trim();

        try {
            await db.collection("users").doc(currentUser.uid).set({
                bio: newBio, displayName: newName
            }, { merge: true });

            if (newName !== currentUser.displayName) {
                await currentUser.updateProfile({ displayName: newName });
            }
            updateProfileUI();
            showSnackbar('Настройки сохранены');
            closeSettings();
        } catch (err) {
            showSnackbar('Ошибка: ' + err.message);
        } finally {
            btn.disabled = false; btn.textContent = 'Сохранить';
        }
    });

    // --- Firebase Initialization ---
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        db = firebase.firestore();
        storage = firebase.storage();
        
        firebase.firestore().enablePersistence()
            .catch((err) => {
                console.warn('Offline persistence error:', err.code);
            });

        setupAuthListener();
        setupIdTokenListener();
        loadSiteVersion();
    } else {
        console.error("Firebase not initialized.");
    }

    function setupAuthListener() {
        firebase.auth().onAuthStateChanged(async (user) => {
            // Hide splash screen on the first auth check
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.classList.add('opacity-0');
                setTimeout(() => {
                    try { splash.remove(); } catch (e) {}
                }, 300);
            }

            if (user) {
                currentUser = user;
                authModal.classList.add('hidden');
                
                const doc = await db.collection("users").doc(user.uid).get();
                if(doc.exists) userProfileData = doc.data();

                updateProfileUI();
                loadChatList();
                setupPushNotifications();
                setupIncomingCallListener();

                // Check if there is a pending chat from a notification
                if (window.pendingNotificationChat) {
                    const { chatId, isGroup } = window.pendingNotificationChat;
                    window.pendingNotificationChat = null;
                    window.openChatFromNotification(chatId, isGroup);
                }

                // Check if there is a pending call acceptance from a notification
                if (window.pendingNotificationCall) {
                    const callId = window.pendingNotificationCall;
                    window.pendingNotificationCall = null;
                    window.acceptCallFromNotification(callId);
                }

                // Presence tracking
                const presenceRef = db.collection('users').doc(user.uid);
                presenceRef.update({ status: 'online', lastSeen: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{});
                
                window.addEventListener('beforeunload', () => {
                    presenceRef.update({ status: 'offline', lastSeen: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{});
                });
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'hidden') {
                        presenceRef.update({ status: 'offline', lastSeen: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{});
                    } else {
                        presenceRef.update({ status: 'online', lastSeen: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{});
                    }
                });
            } else {
                currentUser = null;
                userProfileData = {};
                if (callListenerUnsubscribe) {
                    callListenerUnsubscribe();
                    callListenerUnsubscribe = null;
                }

                // Immediately hide all modals (preventing higher z-index overlap like settings-modal z-300)
                if (settingsModal) {
                    settingsModal.classList.add('hidden');
                    settingsModal.style.display = 'none';
                }
                const groupModal = document.getElementById('create-group-modal');
                if (groupModal) {
                    groupModal.classList.add('hidden');
                    groupModal.style.display = 'none';
                }
                const groupSettingsModal = document.getElementById('group-settings-modal');
                if (groupSettingsModal) {
                    groupSettingsModal.classList.add('hidden');
                    groupSettingsModal.style.display = 'none';
                }

                // Reset MFA setup and verification state
                if (_mfaSetupRecaptcha) {
                    try { _mfaSetupRecaptcha.clear(); } catch (_) {}
                    _mfaSetupRecaptcha = null;
                }
                _mfaSetupVerificationId = null;

                if (_mfaRecaptchaVerifier) {
                    try { _mfaRecaptchaVerifier.clear(); } catch (_) {}
                    _mfaRecaptchaVerifier = null;
                }
                _mfaResolver = null;

                authModal.classList.remove('hidden');
                showStep('step-login');
                if (messagesUnsubscribe) messagesUnsubscribe();
                if (chatsUnsubscribe) chatsUnsubscribe();
                chatListContainer.innerHTML = '';
                messagesContainer.innerHTML = '';
                activeChatId = null;
            }
        });
    }

    function setupIdTokenListener() {
        firebase.auth().onIdTokenChanged(async (user) => {
            if (user) {
                if (window.AndroidApp && typeof window.AndroidApp.saveAuthToken === 'function') {
                    try {
                        const token = await user.getIdToken();
                        window.AndroidApp.saveAuthToken(token, user.uid);
                        console.log('ID Token saved/updated in Android App');
                    } catch (err) {
                        console.error("Failed to get ID token:", err);
                    }
                }
            } else {
                if (window.AndroidApp && typeof window.AndroidApp.saveAuthToken === 'function') {
                    window.AndroidApp.saveAuthToken('', '');
                }
            }
        });
    }

    window.onNativeFcmTokenReceived = async function(token) {
        console.log('Received native FCM token via callback:', token);
        if (token && currentUser) {
            try {
                await db.collection('users').doc(currentUser.uid).set({ fcmToken: token }, { merge: true });
                console.log('Native FCM token successfully saved to Firestore via callback');
            } catch (err) {
                console.error('Error saving native token via callback:', err);
            }
        }
    };

    window.handleAndroidBackGesture = function() {
        console.log('handleAndroidBackGesture called');
        
        // 1. Настройки группы
        const groupSettingsModal = document.getElementById('group-settings-modal');
        if (groupSettingsModal && !groupSettingsModal.classList.contains('hidden') && groupSettingsModal.style.display !== 'none') {
            window.closeGroupSettings();
            return true;
        }
        
        // 2. Создание группы
        const createGroupModal = document.getElementById('create-group-modal');
        if (createGroupModal && !createGroupModal.classList.contains('hidden')) {
            window.closeCreateGroupModal();
            return true;
        }
        
        // 3. Настройки профиля
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal && !settingsModal.classList.contains('hidden') && settingsModal.style.display !== 'none') {
            window.closeSettings();
            return true;
        }
        
        // 4. Активный чат на мобильных устройствах
        if (document.body.classList.contains('chat-active')) {
            window.toggleMobileChat(false);
            activeChatId = null;
            return true;
        }
        
        return false;
    };

    window.openChatFromNotification = async function(chatId, isGroupStr) {
        const isGroup = isGroupStr === 'true' || isGroupStr === true;
        console.log('openChatFromNotification called with:', chatId, isGroup);
        if (!currentUser) {
            window.pendingNotificationChat = { chatId, isGroup };
            console.log('User not logged in yet. Saving pending notification chat.');
            return;
        }
        try {
            if (isGroup) {
                const groupDoc = await db.collection('groups').doc(chatId).get();
                if (groupDoc.exists) {
                    const groupData = groupDoc.data();
                    openChat(chatId, null, { username: groupData.name, isGroup: true });
                }
            } else {
                const chatDoc = await db.collection('chats').doc(chatId).get();
                if (chatDoc.exists) {
                    const chatData = chatDoc.data();
                    const targetUid = chatData.participants.find(uid => uid !== currentUser.uid);
                    if (targetUid) {
                        const targetData = chatData.participantsData[targetUid];
                        openChat(chatId, targetUid, targetData);
                    }
                }
            }
        } catch (err) {
            console.error('Error opening chat from notification:', err);
        }
    };

    window.acceptCallFromNotification = function(callId) {
        console.log("acceptCallFromNotification called for callId:", callId);
        if (!currentUser) {
            window.pendingNotificationCall = callId;
            return;
        }
        if (currentCallId === callId) {
            acceptCall();
        } else {
            window.autoAcceptCallId = callId;
        }
    };

    async function setupPushNotifications(interactive = false) {
        try {
            // Поддержка нативных push-уведомлений для Android
            if (window.AndroidApp && typeof window.AndroidApp.getNativeFcmToken === 'function') {
                console.log('Detected native Android environment. Initializing native FCM...');
                const token = window.AndroidApp.getNativeFcmToken();
                if (token && currentUser) {
                    await db.collection('users').doc(currentUser.uid).set({ fcmToken: token }, { merge: true });
                    console.log('Saved initial native FCM token to Firestore:', token);
                } else {
                    console.log('Native FCM token is empty, waiting for callback...');
                }
                updatePushUI();
                return;
            }

            if (!('Notification' in window)) {
                return;
            }

            const currentPermission = Notification.permission;
            
            // Если вызов автоматический и разрешение еще не выдано — тихо выходим и обновляем UI
            if (!interactive && currentPermission !== 'granted') {
                updatePushUI();
                return;
            }

            let registration = null;
            // Force update Service Worker to clear old cache
            if ('serviceWorker' in navigator) {
                registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                await registration.update();
            }

            const messaging = firebase.messaging();
            
            // Если интерактивно — запрашиваем разрешение
            let permission = currentPermission;
            if (interactive) {
                permission = await Notification.requestPermission();
            }
            
            if (permission === 'denied') {
                if (interactive) {
                    showSnackbar('Уведомления заблокированы. Нажмите на 🔒 слева от адреса сайта!');
                }
                updatePushUI();
                return;
            }
            
            if (permission === 'granted') {
                try {
                    const tokenOptions = {
                        vapidKey: 'BP_hWM1RFB245Rad_lsjHtMQTM5u0ybQbEhQ8DZTbcAh7PwXIubn6TtAt295pptU8LUYrC7qnf9vPrIjBcQk2kU'
                    };
                    if (registration) {
                        tokenOptions.serviceWorkerRegistration = registration;
                    }
                    const token = await messaging.getToken(tokenOptions);
                    if (token) {
                        await db.collection('users').doc(currentUser.uid).set({ fcmToken: token }, { merge: true });
                    }
                } catch (tokenError) {
                    console.error('Token error:', tokenError);
                    if (interactive) {
                        showSnackbar('Ошибка настройки уведомлений: ' + tokenError.message);
                    }
                }
            }
            
            messaging.onMessage((payload) => {
                const title = payload.data ? payload.data.title : (payload.notification ? payload.notification.title : 'Новое сообщение');
                const body = payload.data ? payload.data.body : (payload.notification ? payload.notification.body : '');
                const msgChatId = payload.data ? payload.data.chatId : null;
                const msgType = payload.data ? payload.data.type : null;
                
                // If the user is currently viewing the exact chat this message is for, suppress everything
                if (msgChatId && msgChatId === activeChatId && !document.hidden) {
                    return; // User already sees the message in real-time
                }

                // If the tab is visible but user is in a different chat — show only snackbar
                if (!document.hidden) {
                    showSnackbar(`${title}: ${body}`);
                    return;
                }

                // Tab is hidden — show snackbar + system notification
                showSnackbar(`${title}: ${body}`);
                if (Notification.permission === 'granted') {
                    new Notification(title, {
                        body: body,
                        icon: 'https://ui-avatars.com/api/?name=MThread&background=d0e2ff&color=53647d'
                    });
                }
            });
            updatePushUI();
        } catch (error) { 
            console.error('Push setup failed:', error); 
            if (interactive) {
                showSnackbar('Ошибка уведомлений: ' + error.message);
            }
            updatePushUI();
        }
    }

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                // Fetch from usernames collection to avoid bounded query on large users collection
                const snapshot = await db.collection('usernames')
                    .orderBy(firebase.firestore.FieldPath.documentId())
                    .startAt(query).endAt(query + '\uf8ff')
                    .limit(10).get();
                    
                searchResults.innerHTML = '';
                let found = 0;
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.uid === currentUser.uid) return;
                    
                    found++;
                    const username = doc.id;
                    const div = document.createElement('div');
                    div.className = 'p-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-all';
                    div.innerHTML = `
                        <img src="https://ui-avatars.com/api/?name=${username}&background=d0e2ff&color=53647d" class="w-8 h-8 rounded-full object-cover">
                        <span class="text-white text-sm">${escapeHtml(username)}</span>
                    `;
                    div.onclick = async () => {
                        searchInput.value = '';
                        searchResults.classList.add('hidden');
                        
                        // We need target user's avatar if they set one, so we fetch their user doc briefly
                        let userAvatar = null;
                        try {
                            const userData = await getUserCached(data.uid);
                            if (userData) userAvatar = userData.avatarUrl;
                        } catch(e) {}
                        
                        startChat(data.uid, { username: username, avatarUrl: userAvatar });
                    };
                    searchResults.appendChild(div);
                });

                if (found > 0) {
                    searchResults.classList.remove('hidden');
                } else {
                    searchResults.innerHTML = '<div class="p-3 text-sm text-on-surface-variant">Не найдено</div>';
                    searchResults.classList.remove('hidden');
                }
            } catch(e) { console.error(e); }
        }, 300);
    });

    // Hide search results on click outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });

    // --- Direct Messages Logic ---
    async function startChat(targetUid, targetData) {
        const chatId = [currentUser.uid, targetUid].sort().join('_');
        
        // Ensure chat document exists
        await db.collection('chats').doc(chatId).set({
            participants: [currentUser.uid, targetUid],
            participantsData: {
                [targetUid]: { username: targetData.username, avatarUrl: targetData.avatarUrl || null },
                [currentUser.uid]: { username: currentUser.displayName, avatarUrl: userProfileData.avatarUrl || null }
            }
        }, { merge: true });

        openChat(chatId, targetUid, targetData);
    }

    function openChat(chatId, targetUid, targetData) {
        activeChatId = chatId;
        activeChatUser = { uid: targetUid, ...(targetData || {}) };
        
        if (messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
        pendingAttachments = [];
        renderAttachmentPreviews();
        toggleSendVoiceButtons();

        const isChannel = targetData && targetData.isChannel === true;
        const isAdmin = isChannel && targetData.admins && targetData.admins.includes(currentUser.uid);

        const msgForm = document.getElementById('message-form');
        const channelNotice = document.getElementById('channel-only-admins-notice');

        if (msgForm && channelNotice) {
            if (isChannel && !isAdmin) {
                msgForm.classList.add('hidden');
                channelNotice.classList.remove('hidden');
            } else {
                msgForm.classList.remove('hidden');
                channelNotice.classList.add('hidden');
            }
        }

        activeChatName.textContent = (targetData && targetData.username) ? targetData.username : 'Чат';
        chatOptionsBtn.classList.remove('hidden');
        
        if (messagesUnsubscribe) messagesUnsubscribe();
        if (statusUnsubscribe) statusUnsubscribe();
        if (activeChatTypingUnsubscribe) activeChatTypingUnsubscribe();
        
        // Hide mobile chat list
        if (window.innerWidth <= 767) {
            document.body.classList.add('chat-active');
        }

        const isGroup = targetData && targetData.isGroup === true;
        const collectionName = isGroup ? 'groups' : 'chats';

        const activeChatStatus = document.getElementById('active-chat-status');
        let currentStatus = isGroup ? 'Групповой чат' : 'Офлайн';
        let currentTyping = false;

        const groupInfoBtn = document.getElementById('group-info-btn');
        if (groupInfoBtn) {
            if (isGroup) groupInfoBtn.classList.remove('hidden');
            else groupInfoBtn.classList.add('hidden');
        }

        const chatCallBtn = document.getElementById('chat-call-btn');
        if (chatCallBtn) {
            if (isGroup) chatCallBtn.classList.add('hidden');
            else chatCallBtn.classList.remove('hidden');
        }

        const updateStatusUI = () => {
            activeChatStatus.classList.remove('hidden');
            if (currentTyping) {
                activeChatStatus.textContent = 'Печатает...';
                activeChatStatus.className = 'text-xs text-blue-400 transition-all animate-pulse';
            } else {
                if (isGroup) {
                    activeChatStatus.textContent = 'Групповой чат';
                    activeChatStatus.className = 'text-xs text-on-surface-variant transition-all';
                } else if (currentStatus === 'online') {
                    activeChatStatus.textContent = 'В сети';
                    activeChatStatus.className = 'text-xs text-primary-container transition-all';
                } else {
                    activeChatStatus.textContent = currentStatus;
                    activeChatStatus.className = 'text-xs text-on-surface-variant/60 transition-all';
                }
            }
        };

        if (!isGroup) {
            statusUnsubscribe = db.collection('users').doc(targetUid).onSnapshot(doc => {
                const data = doc.data();
                if (data) {
                    if (data.status === 'online') {
                        currentStatus = 'online';
                    } else {
                        const time = data.lastSeen ? new Date(data.lastSeen.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        currentStatus = time ? `Был(а) в ${time}` : 'Офлайн';
                    }
                    updateStatusUI();
                }
            });

            activeChatTypingUnsubscribe = db.collection('chats').doc(chatId).onSnapshot(doc => {
                const data = doc.data();
                if (data && data.typing) {
                    currentTyping = !!data.typing[targetUid];
                    updateStatusUI();
                }
            });
        } else {
            updateStatusUI();
        }

        messagesContainer.innerHTML = '<div class="flex-1 flex items-center justify-center text-on-surface-variant">Загрузка...</div>';
        
        let isFirstLoad = true;
        messagesUnsubscribe = db.collection(collectionName).doc(chatId).collection('messages')
            .orderBy('timestamp', 'asc')
            .limit(100)
            .onSnapshot(snapshot => {
                if (isFirstLoad && snapshot.empty) {
                    messagesContainer.innerHTML = '<div id="empty-chat-msg" class="flex-1 flex items-center justify-center text-on-surface-variant text-sm">Здесь пока нет сообщений. Напишите первым!</div>';
                    isFirstLoad = false;
                    return;
                }
                
                const emptyMsg = document.getElementById('empty-chat-msg');
                if (emptyMsg) emptyMsg.remove();
                
                if (isFirstLoad) {
                    messagesContainer.innerHTML = ''; // Clear loading state
                }

                let addedAny = false;
                
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        renderMessage(change.doc.id, change.doc.data());
                        addedAny = true;
                        
                        // Mark as read if not sent by me
                        if (change.doc.data().userId !== currentUser.uid && !change.doc.data().read) {
                            change.doc.ref.update({ read: true }).catch(()=>{});
                        }
                    }
                    if (change.type === 'modified') {
                        const existingMsg = document.getElementById(`msg-${change.doc.id}`);
                        if (existingMsg) {
                            const newText = escapeHtml(change.doc.data().text);
                            const p = existingMsg.querySelector('.msg-text');
                            if (p) p.innerHTML = newText;
                            
                            if (change.doc.data().edited && !existingMsg.querySelector('.msg-edited')) {
                                const bubble = existingMsg.querySelector('.msg-bubble');
                                bubble.insertAdjacentHTML('beforeend', '<span class="text-[10px] opacity-50 block mt-1 msg-edited">(изменено)</span>');
                            }
                            
                            // Update read receipt icon if I am the sender
                            if (change.doc.data().userId === currentUser.uid && change.doc.data().read) {
                                const iconSpan = existingMsg.querySelector('.text-\\[14px\\]');
                                if (iconSpan) {
                                    iconSpan.textContent = 'done_all';
                                    iconSpan.classList.remove('text-on-surface-variant');
                                    iconSpan.classList.add('text-blue-400');
                                }
                            }
                        }
                    }
                    if (change.type === 'removed') {
                        const existingMsg = document.getElementById(`msg-${change.doc.id}`);
                        if (existingMsg) existingMsg.remove();
                    }
                });
                
                if (isFirstLoad) {
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }, 50);
                    });
                    isFirstLoad = false;
                } else if (addedAny) {
                    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
                }
            });
    }

    async function deleteEntireChat(chatId, isGroup = false) {
        const collectionName = isGroup ? 'groups' : 'chats';
        try {
            const msgs = await db.collection(collectionName).doc(chatId).collection('messages').get();
            const batch = db.batch();
            msgs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            await db.collection(collectionName).doc(chatId).delete();
            
            if (activeChatId === chatId) {
                activeChatId = null;
                messagesContainer.innerHTML = '';
                if (window.innerWidth <= 767) document.body.classList.remove('chat-active');
            }
            showSnackbar(isGroup ? 'Группа удалена' : 'Диалог удален');
        } catch(err) {
            showSnackbar('Ошибка удаления: ' + err.message);
        }
    }

    function loadChatList() {
        if (chatsUnsubscribe) chatsUnsubscribe();
        
        chatsUnsubscribe = db.collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .onSnapshot(snapshot => {
                // Client-side sort to avoid requiring composite index immediately
                const chats = [];
                snapshot.forEach(doc => chats.push({ id: doc.id, ...doc.data() }));
                chats.sort((a, b) => {
                    const timeA = a.lastUpdated ? a.lastUpdated.toMillis() : 0;
                    const timeB = b.lastUpdated ? b.lastUpdated.toMillis() : 0;
                    return timeB - timeA;
                });

                chatListContainer.innerHTML = '';
                if(chats.length === 0) {
                    chatListContainer.innerHTML = '<div class="p-6 text-on-surface-variant text-sm text-center">Нет активных диалогов.<br>Используйте поиск выше.</div>';
                }

                chats.forEach(async chat => {
                    const targetUid = chat.participants.find(id => id !== currentUser.uid);
                    let targetData = (chat.participantsData && chat.participantsData[targetUid]) ? chat.participantsData[targetUid] : { username: 'User' };
                    
                    const time = chat.lastUpdated ? new Date(chat.lastUpdated.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    
                    const div = document.createElement('div');
                    div.className = `chat-item-btn p-4 md:px-6 flex gap-4 cursor-pointer transition-all ripple-container ${activeChatId === chat.id ? 'bg-white/10' : 'hover:bg-white/5'}`;
                    
                    const avatar = targetData.avatarUrl || `https://ui-avatars.com/api/?name=${targetData.username}&background=cac2e2&color=312d46`;
                    
                    div.innerHTML = `
                        <div class="relative shrink-0">
                            <img src="${avatar}" class="chat-avatar w-12 h-12 rounded-full object-cover">
                            <div class="status-dot-${targetUid} absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface-dim bg-gray-500 hidden"></div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-baseline mb-1">
                                <h4 class="text-[15px] font-semibold text-white truncate">${escapeHtml(targetData.username || '...')}</h4>
                                <span class="text-[10px] text-on-surface-variant/60">${time}</span>
                            </div>
                            <p class="text-[13px] text-on-surface-variant/60 truncate">${chat.lastMessageSender === currentUser.uid ? '<span class="text-on-surface-variant font-bold">Вы:</span> ' : ''}${chat.lastMessage !== undefined && chat.lastMessage !== null && chat.lastMessage !== "" ? escapeHtml(chat.lastMessage) : (chat.lastMessage === "" ? "" : "Начать диалог")}</p>
                        </div>
                    `;

                    div.onclick = () => openChat(chat.id, targetUid, targetData);
                    chatListContainer.appendChild(div);

                    try {
                        const userData = await getUserCached(targetUid);
                        if (userData) {
                            targetData = userData;
                            const freshAvatar = targetData.avatarUrl || `https://ui-avatars.com/api/?name=${targetData.username}&background=cac2e2&color=312d46`;
                            const img = div.querySelector('.chat-avatar');
                            if (img) img.src = freshAvatar;
                            div.onclick = () => openChat(chat.id, targetUid, targetData);
                        }
                    } catch(e) {}

                    // Context Menu Delete Chat
                    div.addEventListener('contextmenu', async (e) => {
                        e.preventDefault();
                        if (confirm(`Удалить диалог с ${targetData.username}?`)) {
                            await deleteEntireChat(chat.id);
                        }
                    });

                    // Long press for mobile delete
                    let pressTimer;
                    div.addEventListener('touchstart', (e) => {
                        pressTimer = window.setTimeout(async () => {
                            if (confirm(`Удалить диалог с ${targetData.username}?`)) {
                                await deleteEntireChat(chat.id);
                            }
                        }, 800);
                    });
                    div.addEventListener('touchend', () => clearTimeout(pressTimer));
                    div.addEventListener('touchmove', () => clearTimeout(pressTimer));
                });
                attachRipples();
            });
    }

    let contextTargetId = null;
    let contextTargetText = null;

    function showContextMenu(rect, msgId, currentText, isMe) {
        contextTargetId = msgId;
        contextTargetText = currentText;
        
        if (isMe) {
            ctxEditBtn.classList.remove('hidden');
            ctxEditBtn.classList.add('flex');
            ctxEditBtn.nextElementSibling.classList.remove('hidden'); // The divider line
        } else {
            ctxEditBtn.classList.add('hidden');
            ctxEditBtn.classList.remove('flex');
            ctxEditBtn.nextElementSibling.classList.add('hidden');
        }

        contextMenu.classList.remove('hidden');
        contextMenu.classList.add('flex');
        
        // Position relative to bubble
        let left = isMe ? (rect.right - 180) : rect.left;
        let top = rect.bottom + 8; // 8px spacing below bubble
        
        // Boundaries checks
        if (left < 10) left = 10;
        if (left + 180 > window.innerWidth) left = window.innerWidth - 190;
        if (top + 100 > window.innerHeight) {
            top = rect.top - 100; // Show above bubble if no space below
        }
        if (top < 10) top = 10;
        
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
    }

    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.classList.add('hidden');
            contextMenu.classList.remove('flex');
        }
        if (chatOptionsMenu && !chatOptionsMenu.contains(e.target) && e.target !== chatOptionsBtn && !chatOptionsBtn.contains(e.target)) {
            chatOptionsMenu.classList.add('hidden');
            chatOptionsMenu.classList.remove('flex');
        }
    });

    if (chatOptionsBtn) {
        chatOptionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatOptionsMenu.classList.toggle('hidden');
            chatOptionsMenu.classList.toggle('flex');
        });
    }

    if (btnClearChat) {
        btnClearChat.addEventListener('click', async () => {
            chatOptionsMenu.classList.add('hidden');
            chatOptionsMenu.classList.remove('flex');
            if (!activeChatId) return;
            
            const isGroup = activeChatUser && activeChatUser.isGroup;
            const collectionName = isGroup ? 'groups' : 'chats';
            
            if (confirm("Удалить ВСЕ сообщения в этом чате?")) {
                try {
                    const msgs = await db.collection(collectionName).doc(activeChatId).collection('messages').get();
                    const batch = db.batch();
                    msgs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    
                    await db.collection(collectionName).doc(activeChatId).update({
                        lastMessage: "История очищена",
                        lastMessageSender: null,
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    showSnackbar("История очищена");
                } catch(e) {
                    showSnackbar("Ошибка: " + e.message);
                }
            }
        });
    }

    ctxDeleteBtn.addEventListener('click', async () => {
        contextMenu.classList.add('hidden');
        contextMenu.classList.remove('flex');
        if (!contextTargetId || !activeChatId) return;

        const isGroup = activeChatUser && activeChatUser.isGroup;
        const collectionName = isGroup ? 'groups' : 'chats';

        try {
            await db.collection(collectionName).doc(activeChatId).collection('messages').doc(contextTargetId).delete();
            await recalculateLastMessage(activeChatId, isGroup);
        } catch (e) {
            showSnackbar('Ошибка удаления: ' + e.message);
        }
    });

    ctxEditBtn.addEventListener('click', async () => {
        contextMenu.classList.add('hidden');
        contextMenu.classList.remove('flex');
        if (!contextTargetId || !activeChatId) return;
        
        const isGroup = activeChatUser && activeChatUser.isGroup;
        const collectionName = isGroup ? 'groups' : 'chats';
        
        const newText = prompt("Редактировать сообщение:", contextTargetText);
        if (newText && newText.trim() !== "" && newText !== contextTargetText) {
            try {
                await db.collection(collectionName).doc(activeChatId).collection('messages').doc(contextTargetId).update({
                    text: newText.trim(),
                    edited: true
                });
                await recalculateLastMessage(activeChatId, isGroup);
            } catch(e) {
                showSnackbar('Ошибка: ' + e.message);
            }
        }
    });

    const renderMessage = (docId, msg) => {
        const isMe = msg.userId === currentUser.uid;
        const msgDiv = document.createElement('div');
        msgDiv.id = `msg-${docId}`;
        msgDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1 w-full max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end' : 'self-start'} animate-msg`;

        const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const isGroup = activeChatUser && activeChatUser.isGroup;

        const bubble = document.createElement('div');
        bubble.className = `msg-bubble cursor-pointer ${
            isMe 
            ? 'bg-gradient-to-br from-[#2f6bf2] to-[#1d4ed8] text-white rounded-[24px] rounded-br-sm' 
            : 'bg-[#151719] text-white rounded-[24px] rounded-bl-sm border border-white/[0.06] shadow-xl'
        } px-5 py-3 md:px-6 md:py-3.5 shadow-lg transition-all active:scale-[0.98]`;

        if (isGroup && !isMe) {
            const senderSpan = document.createElement('span');
            senderSpan.className = 'text-[10px] font-bold text-primary-container mb-1 block';
            senderSpan.textContent = msg.userName || 'User';
            bubble.appendChild(senderSpan);
        }

        if (msg.attachments && Array.isArray(msg.attachments)) {
            msg.attachments.forEach(att => {
                if (att.type === 'image') {
                    const img = document.createElement('img');
                    img.src = att.url;
                    img.className = 'msg-image w-full max-w-sm rounded-xl mb-2 object-cover cursor-pointer hover:brightness-90 transition-all';
                    img.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        openLightbox(att.url);
                    });
                    img.addEventListener('load', () => {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    });
                    bubble.appendChild(img);
                } else if (att.type && att.type.startsWith('audio/')) {
                    const voiceDiv = document.createElement('div');
                    voiceDiv.className = 'flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 mb-2 hover:bg-white/10 transition-all min-w-[240px]';
                    const audioId = 'audio-' + Math.random().toString(36).substr(2, 9);
                    voiceDiv.innerHTML = `
                        <button type="button" class="voice-play-btn flex items-center justify-center w-10 h-10 bg-primary-container text-on-primary-container rounded-full hover:scale-105 active:scale-95 transition-all" title="Воспроизвести">
                            <span class="material-symbols-outlined text-[24px]">play_arrow</span>
                        </button>
                        <div class="flex-1 flex flex-col gap-1">
                            <input type="range" class="voice-seekbar w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary-container hover:bg-white/30" min="0" max="100" value="0">
                            <div class="flex justify-between items-center text-[10px] text-on-surface-variant/60">
                                <span class="voice-time">0:00</span>
                                <span class="voice-duration">--:--</span>
                            </div>
                        </div>
                        <audio id="${audioId}" src="${att.url}" preload="metadata"></audio>
                    `;
                    const playBtn = voiceDiv.querySelector('.voice-play-btn');
                    const playIcon = playBtn.querySelector('span');
                    const seekbar = voiceDiv.querySelector('.voice-seekbar');
                    const timeEl = voiceDiv.querySelector('.voice-time');
                    const durationEl = voiceDiv.querySelector('.voice-duration');
                    const audio = voiceDiv.querySelector('audio');
                    
                    function formatTime(secs) {
                        if (isNaN(secs)) return '0:00';
                        const m = Math.floor(secs / 60);
                        const s = Math.floor(secs % 60);
                        return `${m}:${s < 10 ? '0' : ''}${s}`;
                    }
                    audio.addEventListener('loadedmetadata', () => {
                        durationEl.textContent = formatTime(audio.duration);
                    });
                    audio.addEventListener('timeupdate', () => {
                        if (audio.duration) {
                            const pct = (audio.currentTime / audio.duration) * 100;
                            seekbar.value = pct;
                            timeEl.textContent = formatTime(audio.currentTime);
                        }
                    });
                    audio.addEventListener('ended', () => {
                        playIcon.textContent = 'play_arrow';
                        seekbar.value = 0;
                        timeEl.textContent = '0:00';
                    });
                    playBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        document.querySelectorAll('audio').forEach(otherAudio => {
                            if (otherAudio !== audio && !otherAudio.paused) {
                                otherAudio.pause();
                                const otherPlayBtn = otherAudio.closest('div').querySelector('.voice-play-btn span');
                                if (otherPlayBtn) otherPlayBtn.textContent = 'play_arrow';
                            }
                        });
                        if (audio.paused) {
                            audio.play().then(() => {
                                playIcon.textContent = 'pause';
                            }).catch(err => console.error("Audio play error:", err));
                        } else {
                            audio.pause();
                            playIcon.textContent = 'play_arrow';
                        }
                    });
                    seekbar.addEventListener('input', (ev) => {
                        ev.stopPropagation();
                        if (audio.duration) {
                            audio.currentTime = (parseFloat(seekbar.value) / 100) * audio.duration;
                        }
                    });
                    seekbar.addEventListener('click', ev => ev.stopPropagation());
                    bubble.appendChild(voiceDiv);
                } else {
                    const fileDiv = document.createElement('div');
                    fileDiv.className = 'flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 mb-2 hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer';
                    fileDiv.innerHTML = `
                        <span class="material-symbols-outlined text-[24px] text-primary-container shrink-0">description</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-white truncate">${escapeHtml(att.name)}</p>
                            <p class="text-[10px] text-on-surface-variant/60">Открыть для просмотра</p>
                        </div>
                        <button class="download-btn flex items-center justify-center p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-on-surface-variant shrink-0 z-10" title="Скачать файл">
                            <span class="material-symbols-outlined text-[20px]">download</span>
                        </button>
                    `;
                    fileDiv.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        if (confirm(`Открыть файл "${escapeHtml(att.name)}" для просмотра?`)) {
                            window.open(att.url, '_blank');
                        }
                    });
                    const downloadBtn = fileDiv.querySelector('.download-btn');
                    if (downloadBtn) {
                        downloadBtn.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            triggerDownload(att.url, att.name);
                        });
                    }
                    bubble.appendChild(fileDiv);
                }
            });
        } else if (msg.imageUrl) {
            const img = document.createElement('img');
            img.src = msg.imageUrl;
            img.className = 'msg-image w-full max-w-sm rounded-xl mb-2 object-cover cursor-pointer hover:brightness-90 transition-all';
            img.addEventListener('click', (ev) => {
                ev.stopPropagation();
                openLightbox(msg.imageUrl);
            });
            img.addEventListener('load', () => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
            bubble.appendChild(img);
        }

        if (msg.text && msg.text.trim() !== '') {
            const textP = document.createElement('p');
            textP.className = 'msg-text text-[15px] md:text-[16px] leading-relaxed break-words whitespace-pre-wrap font-medium';
            textP.textContent = msg.text;
            bubble.appendChild(textP);
        }

        if (msg.edited) {
            const editedSpan = document.createElement('span');
            editedSpan.className = 'msg-edited text-[10px] opacity-50 block mt-1';
            editedSpan.textContent = '(изменено)';
            bubble.appendChild(editedSpan);
        }

        msgDiv.appendChild(bubble);

        const metaDiv = document.createElement('div');
        metaDiv.className = 'flex items-center gap-1 text-[10px] text-on-surface-variant/40 px-2 mt-1';
        
        const timeSpan = document.createElement('span');
        timeSpan.textContent = time;
        metaDiv.appendChild(timeSpan);

        if (isMe) {
            const checkIcon = msg.read ? 'done_all' : 'done';
            const checkColor = msg.read ? 'text-blue-400' : 'text-on-surface-variant';
            const checkSpan = document.createElement('span');
            checkSpan.className = `material-symbols-outlined text-[14px] ${checkColor}`;
            checkSpan.textContent = checkIcon;
            metaDiv.appendChild(checkSpan);
        }

        msgDiv.appendChild(metaDiv);

        const isSystem = msg.isSystem === true || msg.userId === 'system' || (msg.text && msg.text.startsWith('📞'));
        if (isMe && !isSystem) {
            let hasMoved = false;
            bubble.addEventListener('touchstart', () => {
                hasMoved = false;
            }, { passive: true });
            bubble.addEventListener('touchmove', () => {
                hasMoved = true;
            }, { passive: true });
            bubble.addEventListener('touchend', (e) => {
                if (!hasMoved) {
                    e.preventDefault();
                    e.stopPropagation();
                    showContextMenu(bubble.getBoundingClientRect(), docId, msg.text, isMe);
                }
            });

            bubble.addEventListener('click', (e) => {
                e.stopPropagation();
                showContextMenu(bubble.getBoundingClientRect(), docId, msg.text, isMe);
            });

            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showContextMenu(bubble.getBoundingClientRect(), docId, msg.text, isMe);
            });
        }

        messagesContainer.appendChild(msgDiv);
    };

    let typingTimeout;
    messageInput.addEventListener('input', () => {
        toggleSendVoiceButtons();
        if (!activeChatId) return;
        db.collection('chats').doc(activeChatId).set({
            typing: { [currentUser.uid]: true }
        }, { merge: true }).catch(()=>{});

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            db.collection('chats').doc(activeChatId).set({
                typing: { [currentUser.uid]: false }
            }, { merge: true }).catch(()=>{});
        }, 1500);
    });

    let pendingAttachments = [];
    const attachmentPreviewContainer = document.getElementById('attachment-preview-container');

    function renderAttachmentPreviews() {
        if (!attachmentPreviewContainer) return;
        attachmentPreviewContainer.innerHTML = '';
        toggleSendVoiceButtons();
        
        if (pendingAttachments.length === 0) {
            attachmentPreviewContainer.classList.add('hidden');
            attachmentPreviewContainer.classList.remove('flex');
            return;
        }

        attachmentPreviewContainer.classList.remove('hidden');
        attachmentPreviewContainer.classList.add('flex');

        pendingAttachments.forEach((att) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'relative flex items-center bg-white/10 border border-white/10 rounded-2xl p-2 pr-8 max-w-[200px] shrink-0 gap-2 animate-msg';

            if (att.type === 'image') {
                const img = document.createElement('img');
                img.src = att.previewUrl;
                img.className = 'w-10 h-10 object-cover rounded-lg border border-white/5';
                itemDiv.appendChild(img);
            } else {
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined text-[24px] text-primary-container';
                icon.textContent = 'description';
                itemDiv.appendChild(icon);
            }

            const nameDiv = document.createElement('div');
            nameDiv.className = 'flex-1 min-w-0';
            const nameP = document.createElement('p');
            nameP.className = 'text-xs text-white font-semibold truncate';
            nameP.textContent = att.file.name;
            
            const sizeP = document.createElement('p');
            sizeP.className = 'text-[9px] text-on-surface-variant/60';
            const sizeInKb = (att.file.size / 1024).toFixed(1);
            sizeP.textContent = `${sizeInKb} KB`;

            nameDiv.appendChild(nameP);
            nameDiv.appendChild(sizeP);
            itemDiv.appendChild(nameDiv);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-black/60 hover:bg-black/90 text-white rounded-full transition-all duration-150';
            removeBtn.innerHTML = '<span class="material-symbols-outlined text-[12px] font-bold">close</span>';
            removeBtn.addEventListener('click', () => {
                pendingAttachments = pendingAttachments.filter(x => x.id !== att.id);
                if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
                renderAttachmentPreviews();
            });
            itemDiv.appendChild(removeBtn);

            attachmentPreviewContainer.appendChild(itemDiv);
        });
    }

    const chatImageInput = document.getElementById('chat-image-input');
    if (chatImageInput) {
        chatImageInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const type = file.type.startsWith('image/') ? 'image' : 'file';
                const previewUrl = type === 'image' ? URL.createObjectURL(file) : null;
                
                pendingAttachments.push({
                    id: Math.random().toString(36).substr(2, 9),
                    file: file,
                    type: type,
                    previewUrl: previewUrl
                });
            }

            renderAttachmentPreviews();
            chatImageInput.value = '';
        });
    }

    // --- Voice Recording Logic ---
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingTimerInterval = null;
    let recordingStartTime = null;
    let isRecording = false;
    let voiceStream = null;

    const voiceRecordingPanel = document.getElementById('voice-recording-panel');
    const voiceRecordingTimer = document.getElementById('voice-recording-timer');
    const voiceCancelBtn = document.getElementById('voice-cancel-btn');
    const voiceSendBtn = document.getElementById('voice-send-btn');

    function toggleSendVoiceButtons() {
        const sendBtn = document.getElementById('send-btn');
        if (!sendBtn || !chatVoiceBtn) return;
        
        const hasText = messageInput && messageInput.value.trim().length > 0;
        const hasAttachments = pendingAttachments && pendingAttachments.length > 0;
        
        if (hasText || hasAttachments) {
            sendBtn.classList.remove('hidden');
            chatVoiceBtn.classList.add('hidden');
        } else {
            sendBtn.classList.add('hidden');
            chatVoiceBtn.classList.remove('hidden');
        }
    }

    if (chatVoiceBtn) {
        chatVoiceBtn.addEventListener('click', startVoiceRecording);
    }
    if (voiceCancelBtn) {
        voiceCancelBtn.addEventListener('click', cancelVoiceRecording);
    }
    if (voiceSendBtn) {
        voiceSendBtn.addEventListener('click', stopAndSendVoiceRecording);
    }

    async function startVoiceRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showSnackbar('Ваш браузер не поддерживает запись аудио');
            return;
        }
        try {
            voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            let options = {};
            if (MediaRecorder.isTypeSupported('audio/webm')) {
                options = { mimeType: 'audio/webm' };
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options = { mimeType: 'audio/mp4' };
            } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                options = { mimeType: 'audio/ogg' };
            }
            mediaRecorder = new MediaRecorder(voiceStream, options);
            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };
            mediaRecorder.onstop = () => {};
            mediaRecorder.start();
            isRecording = true;

            if (voiceRecordingPanel) voiceRecordingPanel.classList.remove('hidden');
            if (messageInput) messageInput.disabled = true;
            if (chatVoiceBtn) chatVoiceBtn.classList.add('hidden');

            recordingStartTime = Date.now();
            if (voiceRecordingTimer) voiceRecordingTimer.textContent = '0:00';
            clearInterval(recordingTimerInterval);
            recordingTimerInterval = setInterval(() => {
                const secs = Math.floor((Date.now() - recordingStartTime) / 1000);
                const m = Math.floor(secs / 60);
                const s = secs % 60;
                if (voiceRecordingTimer) {
                    voiceRecordingTimer.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                }
            }, 1000);
        } catch (err) {
            console.error('Microphone access error:', err);
            showSnackbar('Не удалось получить доступ к микрофону');
        }
    }

    function cancelVoiceRecording() {
        if (!isRecording) return;
        isRecording = false;
        clearInterval(recordingTimerInterval);
        if (mediaRecorder) {
            mediaRecorder.onstop = () => {
                if (voiceStream) {
                    voiceStream.getTracks().forEach(track => track.stop());
                    voiceStream = null;
                }
            };
            if (mediaRecorder.state !== 'inactive') {
                try {
                    mediaRecorder.stop();
                } catch (e) {
                    console.error("Error stopping media recorder during cancel:", e);
                    if (voiceStream) {
                        voiceStream.getTracks().forEach(track => track.stop());
                        voiceStream = null;
                    }
                }
            } else {
                if (voiceStream) {
                    voiceStream.getTracks().forEach(track => track.stop());
                    voiceStream = null;
                }
            }
        } else {
            if (voiceStream) {
                voiceStream.getTracks().forEach(track => track.stop());
                voiceStream = null;
            }
        }
        if (voiceRecordingPanel) voiceRecordingPanel.classList.add('hidden');
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.focus();
        }
        toggleSendVoiceButtons();
    }

    async function stopAndSendVoiceRecording() {
        if (!isRecording || !mediaRecorder) return;
        isRecording = false;
        clearInterval(recordingTimerInterval);

        if (audioChunks.length === 0) {
            showSnackbar('Запись слишком короткая');
            if (voiceStream) {
                voiceStream.getTracks().forEach(track => track.stop());
                voiceStream = null;
            }
            if (voiceRecordingPanel) voiceRecordingPanel.classList.add('hidden');
            if (messageInput) messageInput.disabled = false;
            toggleSendVoiceButtons();
            return;
        }

        showSnackbar('Отправка голосового сообщения...');

        if (voiceRecordingPanel) voiceRecordingPanel.classList.add('hidden');
        if (messageInput) messageInput.disabled = false;
        toggleSendVoiceButtons();

        mediaRecorder.onstop = async () => {
            if (voiceStream) {
                voiceStream.getTracks().forEach(track => track.stop());
                voiceStream = null;
            }
            try {
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const extension = mimeType.includes('mp4') ? 'mp4' : (mimeType.includes('ogg') ? 'ogg' : 'webm');
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                const fileName = `voice_${Date.now()}.${extension}`;
                const storageRef = storage.ref(`chat_files/${activeChatId}/${fileName}`);
                const snapshot = await storageRef.put(audioBlob, { contentType: mimeType });
                const downloadUrl = await snapshot.ref.getDownloadURL();

                const isGroup = activeChatUser && activeChatUser.isGroup;
                const collectionName = isGroup ? 'groups' : 'chats';
                const timestamp = firebase.firestore.FieldValue.serverTimestamp();

                const messageData = {
                    userId: currentUser.uid,
                    userName: currentUser.displayName,
                    timestamp: timestamp,
                    text: "",
                    attachments: [{
                        url: downloadUrl,
                        type: mimeType,
                        name: `Голосовое сообщение.${extension}`
                    }]
                };

                await db.collection(collectionName).doc(activeChatId).collection('messages').add(messageData);

                await db.collection(collectionName).doc(activeChatId).set({
                    lastMessage: 'Голосовое сообщение',
                    lastMessageSender: currentUser.uid,
                    lastUpdated: timestamp
                }, { merge: true });
            } catch (err) {
                console.error('Voice send error:', err);
                showSnackbar('Ошибка отправки: ' + err.message);
            }
        };

        if (mediaRecorder.state !== 'inactive') {
            try {
                mediaRecorder.stop();
            } catch (e) {
                console.error("Error stopping media recorder during send:", e);
                mediaRecorder.onstop();
            }
        } else {
            mediaRecorder.onstop();
        }
    }

    async function recalculateLastMessage(chatId, isGroup) {
        if (!db) return;
        const collectionName = isGroup ? 'groups' : 'chats';
        try {
            const messagesQuery = await db.collection(collectionName).doc(chatId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            if (!messagesQuery.empty) {
                const lastMsgData = messagesQuery.docs[0].data();
                let lastText = lastMsgData.text || '';
                if (!lastText && lastMsgData.attachments && lastMsgData.attachments.length > 0) {
                    const firstAtt = lastMsgData.attachments[0];
                    if (firstAtt.type === 'audio/webm' || (firstAtt.name && firstAtt.name.endsWith('.webm'))) {
                        lastText = 'Голосовое сообщение';
                    } else if (firstAtt.type === 'image') {
                        lastText = '📷 Изображение';
                    } else {
                        lastText = '📁 Файл';
                    }
                } else if (!lastText && lastMsgData.imageUrl) {
                    lastText = '📷 Изображение';
                }

                await db.collection(collectionName).doc(chatId).set({
                    lastMessage: lastText,
                    lastMessageSender: lastMsgData.userId || '',
                    lastUpdated: lastMsgData.timestamp || firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } else {
                await db.collection(collectionName).doc(chatId).set({
                    lastMessage: '',
                    lastMessageSender: '',
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        } catch (e) {
            console.error('Error recalculating last message:', e);
        }
    }

    // Prevent focus blur on messageInput when clicking send-btn or voice buttons
    ['send-btn', 'chat-voice-btn', 'voice-send-btn', 'voice-cancel-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            ['mousedown', 'touchstart'].forEach(evt => {
                btn.addEventListener(evt, (e) => {
                    e.preventDefault();
                });
            });
        }
    });

    function loadSiteVersion() {
        const siteVersionEl = document.getElementById('site-version-text');
        if (!db || !siteVersionEl) return;
        
        db.collection('system').doc('version').onSnapshot(doc => {
            const data = doc.data();
            if (data && data.version) {
                siteVersionEl.textContent = `Web: ${data.version}`;
            } else {
                siteVersionEl.textContent = `Web: --`;
            }
        }, err => {
            console.error("Failed to load site version:", err);
        });
    }

    // Lightbox modal functionality
    const lightboxModal = document.getElementById('image-lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-image');
    const lightboxDownloadBtn = document.getElementById('lightbox-download-btn');
    const closeLightboxBtn = document.getElementById('close-lightbox-btn');
    let currentLightboxUrl = '';

    function openLightbox(url) {
        if (!lightboxModal || !lightboxImg || !lightboxDownloadBtn) return;
        currentLightboxUrl = url;
        lightboxImg.src = url;
        lightboxModal.classList.remove('hidden');
        lightboxModal.classList.add('flex');
    }

    if (lightboxDownloadBtn) {
        lightboxDownloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentLightboxUrl) {
                const filename = 'image_' + Date.now() + '.jpg';
                triggerDownload(currentLightboxUrl, filename);
            }
        });
    }

    if (closeLightboxBtn) {
        closeLightboxBtn.addEventListener('click', () => {
            lightboxModal.classList.add('hidden');
            lightboxModal.classList.remove('flex');
            lightboxImg.src = '';
            currentLightboxUrl = '';
        });
    }

    if (lightboxModal) {
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) {
                lightboxModal.classList.add('hidden');
                lightboxModal.classList.remove('flex');
                lightboxImg.src = '';
                currentLightboxUrl = '';
            }
        });
    }

    async function triggerDownload(url, filename) {
        if (window.AndroidApp) {
            if (typeof window.AndroidApp.downloadFile === 'function') {
                window.AndroidApp.downloadFile(url, filename);
            } else {
                window.location.href = url;
            }
            return;
        }
        
        try {
            // Fetch the file as a blob to force download
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up the object URL
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        } catch (e) {
            console.error("Blob download failed, falling back to open in tab:", e);
            // Fallback to opening in a new tab if fetch fails (e.g. CORS issues)
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }

    // Send Message on Enter
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (window.innerWidth <= 767) {
                // Mobile: do nothing, let default newline happen
            } else {
                if (!e.shiftKey) {
                    e.preventDefault();
                    messageForm.dispatchEvent(new Event('submit'));
                }
            }
        }
    });

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        
        setTimeout(() => messageInput.focus(), 10);

        if (!activeChatId) {
            showSnackbar('Выберите чат для отправки сообщения');
            return;
        }

        if ((text || pendingAttachments.length > 0) && db && currentUser) {
            const isGroup = activeChatUser && activeChatUser.isGroup;
            const collectionName = isGroup ? 'groups' : 'chats';
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            // Capture original values for rollback on error
            const originalText = text;
            const originalPendingAttachments = [...pendingAttachments];
            
            // Optimistically clear the input field and previews immediately
            messageInput.value = '';
            messageInput.style.height = 'auto';
            pendingAttachments = [];
            renderAttachmentPreviews();
            
            let uploadedAttachments = [];
            if (originalPendingAttachments.length > 0) {
                showSnackbar('Отправка файлов...');
                const sendBtn = document.getElementById('send-btn');
                if (sendBtn) sendBtn.disabled = true;
                
                try {
                    for (const att of originalPendingAttachments) {
                        const metadata = {
                            contentDisposition: `attachment; filename="${att.file.name}"`
                        };
                        const storageRef = storage.ref(`chat_files/${activeChatId}/${Date.now()}_${att.file.name}`);
                        const snapshot = await storageRef.put(att.file, metadata);
                        const url = await snapshot.ref.getDownloadURL();
                        uploadedAttachments.push({
                            url: url,
                            type: att.type,
                            name: att.file.name
                        });
                    }
                } catch (err) {
                    showSnackbar('Ошибка загрузки файлов: ' + err.message);
                    // Rollback on error
                    messageInput.value = originalText;
                    pendingAttachments = originalPendingAttachments;
                    renderAttachmentPreviews();
                    if (sendBtn) sendBtn.disabled = false;
                    return;
                }
                
                if (sendBtn) sendBtn.disabled = false;
            }

            const messageData = {
                userId: currentUser.uid,
                userName: currentUser.displayName,
                timestamp: timestamp,
                text: originalText || ""
            };

            if (uploadedAttachments.length > 0) {
                messageData.attachments = uploadedAttachments;
            }

            // Set lastMessage to literally "" if the text is empty, as requested by the user:
            // "чтобы ничего не писалось если пользователь ничего не написал"
            let lastMessageDisplay = originalText || "";

            try {
                await db.collection(collectionName).doc(activeChatId).collection('messages').add(messageData);

                await db.collection(collectionName).doc(activeChatId).set({
                    lastMessage: lastMessageDisplay,
                    lastMessageSender: currentUser.uid,
                    lastUpdated: timestamp
                }, { merge: true });

                originalPendingAttachments.forEach(att => {
                    if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
                });
            } catch (err) {
                showSnackbar('Ошибка отправки: ' + err.message);
                // Rollback on error
                messageInput.value = originalText;
                pendingAttachments = originalPendingAttachments;
                renderAttachmentPreviews();
            }
        }
    });

    const updateProfileUI = () => {
        if (currentUser) {
            const name = currentUser.displayName || 'U';
            const initials = name.charAt(0).toUpperCase();
            const avatarUrl = userProfileData.avatarUrl || `https://ui-avatars.com/api/?name=${initials}&background=d0e2ff&color=53647d&bold=true`;
            
            document.querySelectorAll('#sidebar-avatar, #settings-avatar-preview').forEach(img => {
                img.src = avatarUrl;
            });

            // Update app/web version in profile dialog
            const versionContainer = document.getElementById('version-info-container');
            const versionEl = document.getElementById('app-version-text');
            const siteVersionEl = document.getElementById('site-version-text');
            
            if (versionContainer) {
                versionContainer.classList.remove('hidden');
            }
            
            if (window.AndroidApp && typeof window.AndroidApp.getAppVersion === 'function') {
                try {
                    const appVer = window.AndroidApp.getAppVersion();
                    if (versionEl) versionEl.textContent = `App ${appVer}`;
                } catch (e) {
                    console.error("Failed to fetch Android app version:", e);
                }
                if (siteVersionEl) siteVersionEl.classList.remove('hidden');
            } else {
                if (versionEl) versionEl.textContent = 'Web 1.4.0';
                if (siteVersionEl) siteVersionEl.classList.add('hidden');
            }
        }
    };

    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // --- Groups System ---
    const createGroupModal = document.getElementById('create-group-modal');
    const groupNameInput = document.getElementById('group-name-input');
    const groupMemberSearch = document.getElementById('group-member-search');
    const groupMemberResults = document.getElementById('group-member-results');
    const groupMembersList = document.getElementById('group-members-list');
    const createGroupBtn = document.getElementById('create-group-btn');
    
    let selectedGroupMembers = [];

    window.openCreateGroupModal = () => {
        createGroupModal.classList.remove('hidden');
        createGroupModal.classList.add('flex');
        selectedGroupMembers = [{ uid: currentUser.uid, username: currentUser.displayName || currentUser.email || 'Я' }]; // Self is always in
        renderSelectedGroupMembers();
    };

    window.closeCreateGroupModal = () => {
        createGroupModal.classList.add('hidden');
        createGroupModal.classList.remove('flex');
        groupNameInput.value = '';
        groupMemberSearch.value = '';
        groupMemberResults.classList.add('hidden');
    };

    function renderSelectedGroupMembers() {
        groupMembersList.innerHTML = '';
        selectedGroupMembers.forEach(member => {
            if (member.uid === currentUser.uid) return;
            const span = document.createElement('span');
            span.className = 'bg-primary-container text-on-primary-container text-xs px-2 py-1 rounded-full flex items-center gap-1';
            span.innerHTML = `${escapeHtml(member.username)} <button onclick="removeGroupMember('${member.uid}')"><span class="material-symbols-outlined text-[12px]">close</span></button>`;
            groupMembersList.appendChild(span);
        });
    }

    window.removeGroupMember = (uid) => {
        selectedGroupMembers = selectedGroupMembers.filter(m => m.uid !== uid);
        renderSelectedGroupMembers();
    };

    groupMemberSearch.addEventListener('input', async (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (val.length < 2) {
            groupMemberResults.classList.add('hidden');
            return;
        }
        try {
            const snapshot = await db.collection("usernames")
                .orderBy(firebase.firestore.FieldPath.documentId())
                .startAt(val).endAt(val + '\uf8ff').limit(5).get();
                
            groupMemberResults.innerHTML = '';
            let found = false;
            
            snapshot.forEach(doc => {
                const username = doc.id;
                const uid = doc.data().uid;
                const isAlreadyAdded = selectedGroupMembers.some(m => m.uid === uid);
                if (uid === currentUser.uid || isAlreadyAdded) return;
                
                found = true;
                const div = document.createElement('div');
                div.className = 'p-3 hover:bg-white/5 cursor-pointer text-sm text-white border-b border-white/5';
                div.textContent = username;
                div.onclick = () => {
                    selectedGroupMembers.push({ uid: uid, username: username });
                    renderSelectedGroupMembers();
                    groupMemberSearch.value = '';
                    groupMemberResults.classList.add('hidden');
                };
                groupMemberResults.appendChild(div);
            });
            
            if(found) {
                groupMemberResults.classList.remove('hidden');
                groupMemberResults.classList.add('flex');
            } else {
                groupMemberResults.classList.add('hidden');
            }
        } catch(e) {}
    });

    createGroupBtn.addEventListener('click', async () => {
        const name = groupNameInput.value.trim();
        if (!name || selectedGroupMembers.length < 2) {
            showSnackbar('Введите название и выберите хотя бы 1 участника');
            return;
        }
        
        createGroupBtn.disabled = true;
        createGroupBtn.textContent = 'Создание...';
        
        try {
            const uids = selectedGroupMembers.map(m => m.uid);
            const createGroupFn = firebase.functions().httpsCallable('createGroup');
            await createGroupFn({ name: name, participants: uids });
            
            showSnackbar('Группа создана');
            closeCreateGroupModal();
            loadGroupList();
        } catch(e) {
            showSnackbar('Ошибка: ' + e.message);
        }
        createGroupBtn.disabled = false;
        createGroupBtn.textContent = 'Создать группу';
    });

    let groupsUnsubscribe = null;
    let channelsUnsubscribe = null;

    function loadGroupList() {
        if (chatsUnsubscribe) chatsUnsubscribe();
        if (groupsUnsubscribe) groupsUnsubscribe();
        if (channelsUnsubscribe) channelsUnsubscribe();
        
        let userGroups = [];
        let publicChannels = [];

        function renderMergedList() {
            const mergedMap = new Map();
            userGroups.forEach(g => mergedMap.set(g.id, g));
            publicChannels.forEach(c => mergedMap.set(c.id, c));
            const groups = Array.from(mergedMap.values());

            groups.sort((a, b) => {
                const timeA = a.lastUpdated ? a.lastUpdated.toMillis() : 0;
                const timeB = b.lastUpdated ? b.lastUpdated.toMillis() : 0;
                return timeB - timeA;
            });

            chatListContainer.innerHTML = '';
            if(groups.length === 0) {
                chatListContainer.innerHTML = '<div class="p-6 text-on-surface-variant text-sm text-center">Вы не состоите ни в одной группе.</div>';
                return;
            }

            groups.forEach(group => {
                const time = group.lastUpdated ? new Date(group.lastUpdated.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                
                const div = document.createElement('div');
                div.className = `chat-item-btn p-4 md:px-6 flex gap-4 cursor-pointer transition-all ripple-container ${activeChatId === group.id ? 'bg-white/10' : 'hover:bg-white/5'}`;
                
                const isChannel = group.isChannel === true;
                const avatar = isChannel 
                    ? `https://ui-avatars.com/api/?name=Updates&background=6750a4&color=ffffff`
                    : `https://ui-avatars.com/api/?name=${group.name}&background=53647d&color=d0e2ff`;
                
                div.innerHTML = `
                    <div class="relative shrink-0">
                        <img src="${avatar}" class="w-12 h-12 rounded-xl object-cover">
                        ${isChannel ? '<span class="absolute -bottom-1 -right-1 bg-primary text-white text-[9px] px-1 rounded font-bold uppercase tracking-wider scale-90">Канал</span>' : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-baseline mb-1">
                            <h4 class="text-[15px] font-semibold text-white truncate flex items-center gap-1.5">
                                ${isChannel ? '<span class="material-symbols-outlined text-sm text-primary">campaign</span>' : ''}
                                ${escapeHtml(group.name)}
                            </h4>
                            <span class="text-[10px] text-on-surface-variant/60">${time}</span>
                        </div>
                        <p class="text-[13px] text-on-surface-variant/60 truncate">${group.lastMessage !== undefined && group.lastMessage !== null && group.lastMessage !== "" ? escapeHtml(group.lastMessage) : (group.lastMessage === "" ? "" : "Нет сообщений")}</p>
                    </div>
                `;

                div.onclick = () => openChat(group.id, null, { username: group.name, isGroup: true, isChannel: isChannel, admins: group.admins });
                chatListContainer.appendChild(div);

                // Context Menu Delete Group
                div.addEventListener('contextmenu', async (e) => {
                    e.preventDefault();
                    if (isChannel) return;
                    if (confirm(`Удалить группу "${group.name}" для всех?`)) {
                        await deleteEntireChat(group.id, true);
                    }
                });

                // Long press for mobile
                let pressTimer;
                div.addEventListener('touchstart', (e) => {
                    if (isChannel) return;
                    pressTimer = window.setTimeout(async () => {
                        if (confirm(`Удалить группу "${group.name}" для всех?`)) {
                            await deleteEntireChat(group.id, true);
                        }
                    }, 800);
                });
                div.addEventListener('touchend', () => clearTimeout(pressTimer));
                div.addEventListener('touchmove', () => clearTimeout(pressTimer));
            });
            attachRipples();
        }

        groupsUnsubscribe = db.collection('groups')
            .where('participants', 'array-contains', currentUser.uid)
            .onSnapshot(snapshot => {
                userGroups = [];
                snapshot.forEach(doc => userGroups.push({ id: doc.id, ...doc.data() }));
                renderMergedList();
            }, err => console.error("Groups snapshot error:", err));

        channelsUnsubscribe = db.collection('groups')
            .where('isChannel', '==', true)
            .onSnapshot(snapshot => {
                publicChannels = [];
                snapshot.forEach(doc => publicChannels.push({ id: doc.id, ...doc.data() }));
                renderMergedList();
            }, err => console.error("Channels snapshot error:", err));
    }

    // Show specific step
    window.showStep = (stepId) => {
        const allSteps = ['step-login', 'step-register', 'step-recovery', 'step-mfa-verify'];
        allSteps.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById(stepId);
        if (target) target.classList.remove('hidden');
    };

    // --- Group Admin Management ---
    const groupSettingsModal = document.getElementById('group-settings-modal');
    const groupEditName = document.getElementById('group-edit-name');
    const groupEditMembers = document.getElementById('group-edit-members');
    const groupAddMemberSearch = document.getElementById('group-add-member-search');
    const groupAddMemberResults = document.getElementById('group-add-member-results');
    
    let activeGroupData = null;

    window.openGroupSettings = async () => {
        if (!activeChatId || !activeChatUser.isGroup) return;
        try {
            const doc = await db.collection('groups').doc(activeChatId).get();
            if (!doc.exists) return;
            activeGroupData = { id: doc.id, ...doc.data() };
            
            groupEditName.value = activeGroupData.name;
            renderGroupEditMembers();
            
            groupSettingsModal.classList.remove('hidden');
            groupSettingsModal.style.display = 'flex';
        } catch (e) { showSnackbar('Ошибка: ' + e.message); }
    };

    window.closeGroupSettings = () => {
        groupSettingsModal.classList.add('hidden');
        groupSettingsModal.style.display = 'none';
    };

    async function renderGroupEditMembers() {
        groupEditMembers.innerHTML = '';
        const isAdmin = activeGroupData.createdBy === currentUser.uid;
        
        for (const uid of activeGroupData.participants) {
            const userData = await getUserCached(uid) || { username: 'Пользователь' };
            
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between p-2 bg-white/5 rounded-xl';
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center text-[10px] text-primary-container font-bold">
                        ${userData.username.charAt(0).toUpperCase()}
                    </div>
                    <span class="text-sm text-white">${userData.username} ${uid === activeGroupData.createdBy ? '<span class="text-[10px] text-primary-container font-bold ml-1">(Админ)</span>' : ''}</span>
                </div>
                ${(isAdmin && uid !== currentUser.uid) ? `<button onclick="removeMemberFromGroup('${uid}')" class="p-1 text-red-400 hover:bg-red-400/10 rounded-lg transition-all"><span class="material-symbols-outlined text-[18px]">person_remove</span></button>` : ''}
            `;
            groupEditMembers.appendChild(div);
        }
    }

    window.removeMemberFromGroup = async (uid) => {
        if (!confirm('Удалить участника из группы?')) return;
        try {
            const manageMembersFn = firebase.functions().httpsCallable('manageGroupMembers');
            await manageMembersFn({ groupId: activeChatId, action: 'remove', targetUid: uid });
            activeGroupData.participants = activeGroupData.participants.filter(id => id !== uid);
            renderGroupEditMembers();
            showSnackbar('Участник удален');
        } catch (e) { showSnackbar('Ошибка: ' + e.message); }
    };

    groupAddMemberSearch.addEventListener('input', async (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (val.length < 2) {
            groupAddMemberResults.classList.add('hidden');
            return;
        }
        try {
            const snapshot = await db.collection("usernames")
                .orderBy(firebase.firestore.FieldPath.documentId())
                .startAt(val).endAt(val + '\uf8ff').limit(5).get();
                
            groupAddMemberResults.innerHTML = '';
            let found = false;
            snapshot.forEach(doc => {
                const data = doc.data();
                if (activeGroupData.participants.includes(data.uid)) return;
                
                found = true;
                const div = document.createElement('div');
                div.className = 'p-3 hover:bg-white/5 cursor-pointer text-sm text-white border-b border-white/5 last:border-0';
                div.textContent = doc.id;
                div.onclick = () => addMemberToGroup(data.uid, doc.id);
                groupAddMemberResults.appendChild(div);
            });
            groupAddMemberResults.classList.toggle('hidden', !found);
        } catch(e) {}
    });

    async function addMemberToGroup(uid, username) {
        try {
            const manageMembersFn = firebase.functions().httpsCallable('manageGroupMembers');
            await manageMembersFn({ groupId: activeChatId, action: 'add', targetUid: uid });
            activeGroupData.participants.push(uid);
            renderGroupEditMembers();
            groupAddMemberSearch.value = '';
            groupAddMemberResults.classList.add('hidden');
            showSnackbar(`Добавлен: ${username}`);
        } catch (e) { showSnackbar('Ошибка: ' + e.message); }
    }

    window.saveGroupSettings = async () => {
        const newName = groupEditName.value.trim();
        if (!newName) return;
        const btn = document.getElementById('group-save-btn');
        btn.disabled = true; btn.textContent = 'Сохранение...';
        try {
            const updateGroupFn = firebase.functions().httpsCallable('updateGroupMetadata');
            await updateGroupFn({ groupId: activeChatId, name: newName });
            activeChatUser.username = newName;
            document.getElementById('active-chat-name').textContent = newName;
            showSnackbar('Настройки группы сохранены');
            closeGroupSettings();
        } catch (e) { showSnackbar('Ошибка: ' + e.message); }
        btn.disabled = false; btn.textContent = 'Сохранить';
    };

    window.deleteEntireGroupFromSettings = async () => {
        if (confirm('ВНИМАНИЕ: Это полностью удалит группу и все сообщения для ВСЕХ участников. Продолжить?')) {
            const btn = document.getElementById('group-delete-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Удаление...';
            btn.disabled = true;
            try {
                const deleteGroupFn = firebase.functions().httpsCallable('deleteGroup');
                await deleteGroupFn({ groupId: activeChatId });
                if (activeChatId === activeGroupData?.id) {
                    activeChatId = null;
                    document.getElementById('messages').innerHTML = '';
                    if (window.innerWidth <= 767) document.body.classList.remove('chat-active');
                }
                showSnackbar('Группа удалена');
                closeGroupSettings();
            } catch (e) {
                showSnackbar('Ошибка: ' + e.message);
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    };

    // MFA state — хранится между шагами логина
    _mfaResolver = null;
    _mfaRecaptchaVerifier = null;

    loginBtn.addEventListener('click', async () => {
        const username = loginUser.value.trim().toLowerCase();
        const pass = loginPass.value.trim();
        if (!username || !pass) return;

        loginBtn.disabled = true; loginBtn.textContent = 'Вход...';
        try {
            const userDoc = await db.collection("usernames").doc(username).get();
            if (!userDoc.exists) throw new Error("Пользователь не найден");
            const email = userDoc.data().email;
            await firebase.auth().signInWithEmailAndPassword(email, pass);
            // Если MFA не включён — вход произойдёт здесь
        } catch (err) {
            if (err.code === 'auth/multi-factor-auth-required') {
                try {
                    // --- Начало MFA-потока ---
                    _mfaResolver = err.resolver;
                    const hint = _mfaResolver.hints[0];
                    document.getElementById('mfa-phone-hint').textContent = hint.phoneNumber || '';

                    // Создаём невидимый reCAPTCHA для подписи SMS-запроса
                    if (_mfaRecaptchaVerifier) {
                        _mfaRecaptchaVerifier.clear();
                    }
                    _mfaRecaptchaVerifier = new firebase.auth.RecaptchaVerifier(
                        'mfa-recaptcha-container',
                        { size: 'invisible' }
                    );

                    const phoneInfoOptions = {
                        multiFactorHint: hint,
                        session: _mfaResolver.session
                    };
                    const phoneAuthProvider = new firebase.auth.PhoneAuthProvider();
                    const verificationId = await phoneAuthProvider.verifyPhoneNumber(
                        phoneInfoOptions,
                        _mfaRecaptchaVerifier
                    );
                    // Сохраняем verificationId в замыкании через атрибут кнопки
                    document.getElementById('mfa-verify-btn').dataset.verificationId = verificationId;
                    showStep('step-mfa-verify');
                    document.getElementById('mfa-code').focus();
                } catch (mfaInitErr) {
                    showSnackbar('Ошибка запуска SMS: ' + mfaInitErr.message);
                    if (_mfaRecaptchaVerifier) {
                        try { _mfaRecaptchaVerifier.clear(); } catch (_) {}
                        _mfaRecaptchaVerifier = null;
                    }
                    _mfaResolver = null;
                }
            } else {
                showSnackbar('Ошибка входа: ' + err.message);
            }
            loginBtn.disabled = false; loginBtn.textContent = 'Войти';
        }
    });

    document.getElementById('mfa-verify-btn')?.addEventListener('click', async () => {
        const code = document.getElementById('mfa-code').value.trim();
        const verificationId = document.getElementById('mfa-verify-btn').dataset.verificationId;
        if (!code || !verificationId || !_mfaResolver) return;

        const btn = document.getElementById('mfa-verify-btn');
        btn.disabled = true; btn.textContent = 'Проверка...';
        try {
            const cred = firebase.auth.PhoneAuthProvider.credential(verificationId, code);
            const multiFactorAssertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
            await _mfaResolver.resolveSignIn(multiFactorAssertion);
            if (_mfaRecaptchaVerifier) {
                try { _mfaRecaptchaVerifier.clear(); } catch (_) {}
                _mfaRecaptchaVerifier = null;
            }
            _mfaResolver = null;
            document.getElementById('mfa-code').value = '';
        } catch (e) {
            showSnackbar('Неверный код. Попробуйте ещё раз.');
            btn.disabled = false; btn.textContent = 'Подтвердить';
        }
    });

    document.getElementById('mfa-cancel-btn')?.addEventListener('click', () => {
        _mfaResolver = null;
        if (_mfaRecaptchaVerifier) { _mfaRecaptchaVerifier.clear(); _mfaRecaptchaVerifier = null; }
        document.getElementById('mfa-code').value = '';
        showStep('step-login');
    });


    registerBtn.addEventListener('click', async () => {
        const username = regUser.value.trim().toLowerCase();
        const email = regEmail.value.trim();
        const pass = regPass.value.trim();
        
        if (!username || !pass || !email) {
            alert("Пожалуйста, заполните все поля");
            return;
        }
        if (username.length < 3) return alert("Логин слишком короткий");
        if (!email.includes('@') || !email.includes('.')) return alert("Неверный формат E-mail адреса");

        registerBtn.disabled = true; registerBtn.textContent = 'Проверка...';
        try {
            const userDoc = await db.collection("usernames").doc(username).get();
            if (userDoc.exists) throw new Error("Логин уже занят");

            const cred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
            
            const batch = db.batch();
            batch.set(db.collection("usernames").doc(username), { email: email, uid: cred.user.uid });
            batch.set(db.collection("users").doc(cred.user.uid), { username: username, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            await batch.commit();

            await cred.user.updateProfile({ displayName: username });
            
        } catch (err) {
            alert("Ошибка: " + err.message);
            registerBtn.disabled = false; registerBtn.textContent = 'Создать аккаунт';
        }
    });

    // --- DOM Event Bindings (Strict CSP) ---
    document.getElementById('logo-btn')?.addEventListener('click', () => window.location.reload());
    document.getElementById('nav-dm-btn')?.addEventListener('click', () => switchTab('dm'));
    document.getElementById('nav-group-btn')?.addEventListener('click', () => switchTab('groups'));
    document.getElementById('sidebar-profile-btn')?.addEventListener('click', showSettings);
    document.getElementById('mob-nav-profile')?.addEventListener('click', showSettings);
    document.getElementById('mob-back-btn')?.addEventListener('click', () => toggleMobileChat(false));
    document.getElementById('group-info-btn')?.addEventListener('click', openGroupSettings);
    document.getElementById('create-group-fab')?.addEventListener('click', openCreateGroupModal);
    document.getElementById('chat-attach-btn')?.addEventListener('click', () => document.getElementById('chat-image-input').click());
    document.getElementById('to-register-btn')?.addEventListener('click', () => showStep('step-register'));
    document.getElementById('to-login-btn')?.addEventListener('click', () => showStep('step-login'));
    document.getElementById('to-recovery-btn')?.addEventListener('click', () => showStep('step-recovery'));
    document.getElementById('back-to-login-btn')?.addEventListener('click', () => showStep('step-login'));
    
    document.getElementById('recovery-btn')?.addEventListener('click', async () => {
        const usernameInput = document.getElementById('recovery-username');
        const username = usernameInput.value.trim().toLowerCase();
        if (!username) return;

        const btn = document.getElementById('recovery-btn');
        btn.disabled = true; btn.textContent = 'Отправка...';

        try {
            const userDoc = await db.collection("usernames").doc(username).get();
            if (userDoc.exists) {
                const email = userDoc.data().email;
                await firebase.auth().sendPasswordResetEmail(email);
            }
            // OWASP rule: Always show success even if user doesn't exist
            showSnackbar('Если логин существует, мы отправили инструкцию на почту.');
            showStep('step-login');
            usernameInput.value = '';
        } catch (e) {
            // OWASP rule: Do not reveal if email doesn't exist, but log actual errors if needed
            showSnackbar('Если логин существует, мы отправили инструкцию на почту.');
            showStep('step-login');
        }
        btn.disabled = false; btn.textContent = 'Отправить инструкцию';
    });
    document.getElementById('close-settings-btn')?.addEventListener('click', closeSettings);
    document.getElementById('avatar-upload-trigger')?.addEventListener('click', () => document.getElementById('avatar-upload-input').click());
    document.getElementById('settings-logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        firebase.auth().signOut().catch(err => showSnackbar('Ошибка: ' + err.message));
    });
    document.getElementById('close-create-group-btn')?.addEventListener('click', closeCreateGroupModal);
    document.getElementById('close-group-settings-btn')?.addEventListener('click', closeGroupSettings);
    document.getElementById('group-delete-btn')?.addEventListener('click', deleteEntireGroupFromSettings);
    document.getElementById('group-save-btn')?.addEventListener('click', saveGroupSettings);
    document.getElementById('mob-nav-dm')?.addEventListener('click', () => switchTab('dm'));
    document.getElementById('mob-nav-groups')?.addEventListener('click', () => switchTab('groups'));
    document.getElementById('open-updates-channel-btn')?.addEventListener('click', () => {
        closeSettings();
        openChat('mthread_updates_channel', null, { 
            username: 'MThread Updates', 
            isGroup: true, 
            isChannel: true, 
            admins: ['fV9qHzBOdNSqOBvJwozsZ4EpwAD2', 'vY91QRmOR9MErRopLSzQ4Cooqxe2', 'L714fXzR4QYVrnkEsnV92bMThread']
        });
    });

    // --- MFA Setup Logic ---
    _mfaSetupRecaptcha = null;
    _mfaSetupVerificationId = null;

    function updatePushUI() {
        const statusText = document.getElementById('push-status-text');
        const setupBtn = document.getElementById('push-setup-btn');
        const mainBanner = document.getElementById('main-push-banner');
        const mainBannerText = document.getElementById('main-push-banner-text');
        const mainBannerBtn = document.getElementById('main-push-banner-btn');
        
        if (window.AndroidApp) {
            if (statusText) {
                statusText.textContent = 'Включены (через Android-приложение).';
                statusText.className = 'text-green-400 text-[12px] mt-1 leading-relaxed';
            }
            setupBtn?.classList.add('hidden');
            mainBanner?.classList.add('hidden');
            return;
        }
        
        if (!('Notification' in window)) {
            if (statusText) {
                statusText.textContent = 'Не поддерживается вашим браузером.';
            }
            setupBtn?.classList.add('hidden');
            mainBanner?.classList.add('hidden');
            return;
        }
        
        const permission = Notification.permission;
        if (permission === 'granted') {
            if (statusText) {
                statusText.textContent = 'Включены. Вы будете получать важные сообщения.';
                statusText.className = 'text-green-400 text-[12px] mt-1 leading-relaxed';
            }
            setupBtn?.classList.add('hidden');
            mainBanner?.classList.add('hidden');
        } else if (permission === 'default') {
            if (statusText) {
                statusText.textContent = 'Не настроены. Включите, чтобы не пропустить сообщения.';
                statusText.className = 'text-on-surface-variant text-[12px] mt-1 leading-relaxed';
            }
            setupBtn?.classList.remove('hidden');
            
            mainBanner?.classList.remove('hidden');
            if (mainBannerText) {
                mainBannerText.textContent = 'Уведомления отключены. Вы можете пропустить входящие сообщения и звонки.';
            }
            mainBannerBtn?.classList.remove('hidden');
        } else {
            if (statusText) {
                statusText.textContent = 'Доступ заблокирован в браузере. Разрешите его в настройках сайта (нажмите на значок параметров 🎛️ или замок 🔒 слева от адреса).';
                statusText.className = 'text-red-400 text-[12px] mt-1 leading-relaxed';
            }
            setupBtn?.classList.add('hidden');
            
            mainBanner?.classList.remove('hidden');
            if (mainBannerText) {
                mainBannerText.textContent = 'Доступ к уведомлениям заблокирован в браузере. Разрешите уведомления в настройках сайта (нажмите на замок 🔒 слева от адреса).';
            }
            mainBannerBtn?.classList.add('hidden');
        }
    }

    document.getElementById('push-setup-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('push-setup-btn');
        btn.disabled = true;
        btn.textContent = 'Включение...';
        try {
            const permission = await Notification.requestPermission();
            updatePushUI();
            if (permission === 'granted') {
                showSnackbar('Уведомления успешно включены!');
                await setupPushNotifications(true);
            } else if (permission === 'denied') {
                showSnackbar('Доступ отклонен. Разрешите уведомления в настройках сайта.');
            }
        } catch (e) {
            showSnackbar('Ошибка запроса прав: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Включить';
            updatePushUI();
        }
    });

    document.getElementById('main-push-banner-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('main-push-banner-btn');
        btn.disabled = true;
        btn.textContent = 'Включение...';
        try {
            const permission = await Notification.requestPermission();
            updatePushUI();
            if (permission === 'granted') {
                showSnackbar('Уведомления успешно включены!');
                await setupPushNotifications(true);
            } else if (permission === 'denied') {
                showSnackbar('Доступ отклонен. Разрешите уведомления в настройках сайта.');
            }
        } catch (e) {
            showSnackbar('Ошибка запроса прав: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Включить уведомления';
            updatePushUI();
        }
    });

    function refreshMfaStatus() {
        const statusEl = document.getElementById('mfa-status-text');
        const btn = document.getElementById('mfa-setup-btn');
        if (!statusEl) return;

        try {
            const user = firebase.auth().currentUser;
            if (!user) {
                statusEl.textContent = 'Нет пользователя.';
                return;
            }
            
            // Update current email display
            const currentEmailEl = document.getElementById('mfa-current-email');
            if (currentEmailEl) {
                currentEmailEl.textContent = user.email || 'Не указан';
            }

            const factors = user.multiFactor?.enrolledFactors || [];
            const enrolled = factors.length > 0;
            if (enrolled) {
                const phone = factors[0].phoneNumber || '';
                statusEl.textContent = `Включена (SMS${phone ? ': ' + phone : ''}). Вы защищены.`;
                if (btn) {
                    btn.textContent = 'Отключить';
                    btn.style.background = 'rgba(239,68,68,0.15)';
                    btn.style.color = '#f87171';
                }
            } else {
                statusEl.textContent = 'Не включена. Рекомендуется активировать.';
                if (btn) {
                    btn.textContent = 'Настроить';
                    btn.style.background = '';
                    btn.style.color = '';
                }
            }
        } catch (e) {
            console.error('refreshMfaStatus error:', e);
            statusEl.textContent = 'Ошибка: ' + e.message;
            if (btn) btn.style.display = 'none';
        }
    }

    // Оригинальная функция showSettings обрабатывает всю логику сброса и обновления

    document.getElementById('mfa-setup-btn')?.addEventListener('click', async () => {
        const user = firebase.auth().currentUser;
        if (!user) return;
        
        const btn = document.getElementById('mfa-setup-btn');
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Загрузка...';
        
        try {
            await user.reload();
        } catch (e) {
            console.warn('Не удалось обновить профиль пользователя:', e);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
        
        // Refresh local user reference after reloading
        const updatedUser = firebase.auth().currentUser;
        
        let factors = [];
        try { factors = updatedUser.multiFactor?.enrolledFactors || []; } catch (e) {}
        const enrolled = factors.length > 0;
        if (enrolled) {
            if (!confirm('Вы уверены, что хотите отключить двухфакторную аутентификацию?')) return;
            const factor = factors[0];
            updatedUser.multiFactor.unenroll(factor)
                .then(() => { showSnackbar('Двухфакторная аутентификация отключена.'); refreshMfaStatus(); })
                .catch(e => showSnackbar('Ошибка: ' + e.message));
        } else {
            const form = document.getElementById('mfa-phone-setup-form');
            const verifyBlock = document.getElementById('mfa-email-verify-block');
            
            // Если e-mail не подтвержден, предлагаем подтвердить его
            if (!updatedUser.emailVerified) {
                if (verifyBlock) verifyBlock.classList.toggle('hidden');
                if (form) form.classList.add('hidden');
                refreshMfaStatus();
            } else {
                if (form) form.classList.toggle('hidden');
                if (verifyBlock) verifyBlock.classList.add('hidden');
            }
        }
    });

    document.getElementById('mfa-change-email-btn')?.addEventListener('click', async () => {
        const user = firebase.auth().currentUser;
        if (!user) return;
        const newEmailInput = document.getElementById('mfa-new-email-input');
        const newEmail = newEmailInput ? newEmailInput.value.trim() : '';
        if (!newEmail) {
            showSnackbar('Пожалуйста, введите корректный адрес E-mail.');
            return;
        }
        if (!newEmail.includes('@') || !newEmail.includes('.')) {
            showSnackbar('Неверный формат E-mail адреса.');
            return;
        }
        const btn = document.getElementById('mfa-change-email-btn');
        btn.disabled = true;
        btn.textContent = 'Обновление...';
        try {
            // Use verifyBeforeUpdateEmail to comply with new Firebase Auth security requirements
            await user.verifyBeforeUpdateEmail(newEmail);
            
            // Note: Firebase updates the Auth email *after* the link in the verification mail is clicked.
            // Since firestore usernames should ideally match when verified, let's also update the firestore mapping.
            const username = user.displayName;
            if (username) {
                await db.collection("usernames").doc(username).update({ email: newEmail });
            }
            
            showSnackbar('Письмо подтверждения отправлено на новый адрес: ' + newEmail + '. Как только вы подтвердите его, ваш E-mail будет изменен.');
            if (newEmailInput) newEmailInput.value = '';
            refreshMfaStatus();
        } catch (e) {
            let msg = e.message;
            if (e.code === 'auth/requires-recent-login') {
                msg = 'Для изменения адреса электронной почты требуется недавний вход в систему. Пожалуйста, выйдите из аккаунта и войдите заново.';
            }
            showSnackbar('Ошибка обновления: ' + msg);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Обновить E-mail';
        }
    });

    document.getElementById('mfa-send-verify-email-btn')?.addEventListener('click', async () => {
        const user = firebase.auth().currentUser;
        if (!user) return;
        const btn = document.getElementById('mfa-send-verify-email-btn');
        btn.disabled = true;
        btn.textContent = 'Отправка...';
        try {
            await user.sendEmailVerification();
            showSnackbar('Письмо отправлено на ' + user.email + '. Подтвердите E-mail и обновите страницу.');
            btn.textContent = 'Письмо отправлено';
        } catch (e) {
            showSnackbar('Ошибка отправки: ' + e.message);
            btn.disabled = false;
            btn.textContent = 'Отправить письмо с подтверждением';
        }
    });

    document.getElementById('mfa-send-sms-btn')?.addEventListener('click', async () => {
        const phone = document.getElementById('mfa-phone-input').value.trim();
        if (!phone.startsWith('+')) {
            showSnackbar('Укажите номер с кодом страны, например: +77001234567');
            return;
        }
        const btn = document.getElementById('mfa-send-sms-btn');
        btn.disabled = true; btn.textContent = 'Отправка...';
        try {
            // Очищаем предыдущий верификатор
            if (_mfaSetupRecaptcha) {
                try { _mfaSetupRecaptcha.clear(); } catch (e) {}
                _mfaSetupRecaptcha = null;
            }
            // Очищаем контейнер
            const container = document.getElementById('mfa-setup-recaptcha');
            if (container) container.innerHTML = '';

            _mfaSetupRecaptcha = new firebase.auth.RecaptchaVerifier(
                'mfa-setup-recaptcha',
                { size: 'normal', callback: () => {} }
            );
            await _mfaSetupRecaptcha.render();

            const user = firebase.auth().currentUser;
            if (!user) throw new Error('Пользователь не найден. Войдите заново.');
            
            const multiFactorSession = await user.multiFactor.getSession();
            const phoneAuthProvider = new firebase.auth.PhoneAuthProvider();
            _mfaSetupVerificationId = await phoneAuthProvider.verifyPhoneNumber(
                { phoneNumber: phone, session: multiFactorSession },
                _mfaSetupRecaptcha
            );
            document.getElementById('mfa-setup-code-block').classList.remove('hidden');
            showSnackbar('SMS отправлен! Введите код подтверждения.');
        } catch (e) {
            let msg = e.message;
            if (e.code === 'auth/unverified-email') {
                msg = 'Для настройки 2FA необходимо подтвердить адрес почты. Воспользуйтесь формой подтверждения.';
                const verifyBlock = document.getElementById('mfa-email-verify-block');
                if (verifyBlock) verifyBlock.classList.remove('hidden');
                const form = document.getElementById('mfa-phone-setup-form');
                if (form) form.classList.add('hidden');
            } else {
                if (e.code === 'auth/requires-recent-login') msg = 'Для настройки 2FA нужно войти заново. Выйдите и войдите снова.';
                if (e.code === 'auth/internal-error') msg = 'Внутренняя ошибка Firebase. Убедитесь, что SMS Multi-factor Authentication и Phone Auth включены в консоли Firebase (требуется переход на Identity Platform).';
                if (e.code === 'auth/operation-not-allowed') msg = 'Эта операция не разрешена. Убедитесь, что в консоли Firebase (Authentication -> Sign-in method) включен Phone Auth и активирован SMS Multi-factor Authentication.';
                if (e.code === 'auth/unsupported-first-factor') msg = 'Этот метод входа не поддерживает MFA. Требуется Email/пароль с верифицированным адресом.';
                if (e.code === 'auth/invalid-phone-number') msg = 'Неверный формат номера. Пример: +77001234567';
            }
            showSnackbar('Ошибка: ' + msg);
            if (_mfaSetupRecaptcha) { try { _mfaSetupRecaptcha.clear(); } catch (_) {} _mfaSetupRecaptcha = null; }
        } finally {
            btn.disabled = false; btn.textContent = 'Отправить SMS';
        }
    });

    document.getElementById('mfa-confirm-btn')?.addEventListener('click', async () => {
        const code = document.getElementById('mfa-setup-code').value.trim();
        if (!code || !_mfaSetupVerificationId) {
            showSnackbar('Введите код из SMS.');
            return;
        }
        const btn = document.getElementById('mfa-confirm-btn');
        btn.disabled = true; btn.textContent = 'Сохранение...';
        try {
            const cred = firebase.auth.PhoneAuthProvider.credential(_mfaSetupVerificationId, code);
            const assertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
            await firebase.auth().currentUser.multiFactor.enroll(assertion, 'Основной телефон');
            showSnackbar('Двухфакторная аутентификация успешно включена!');
            document.getElementById('mfa-phone-setup-form').classList.add('hidden');
            document.getElementById('mfa-setup-code-block').classList.add('hidden');
            document.getElementById('mfa-phone-input').value = '';
            document.getElementById('mfa-setup-code').value = '';
            refreshMfaStatus();
        } catch (e) {
            let msg = e.message;
            if (e.code === 'auth/invalid-verification-code') msg = 'Неверный код. Попробуйте ещё раз.';
            showSnackbar('Ошибка: ' + msg);
        } finally {
            btn.disabled = false; btn.textContent = 'Подтвердить и включить';
        }
    });


    // ==========================================
    // WebRTC Audio Calls Implementation
    // ==========================================
    let localStream = null;
    let peerConnection = null;
    let currentCallId = null;
    let currentCallData = null;
    let callStartTime = null;
    let ringingAudio = null;
    let callListenerUnsubscribe = null;
    let isCallMuted = false;
    let isSpeakerOn = false;
    let activeCallUnsubscribe = null;
    let activeCandidatesUnsubscribe = null;

    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: "stun:openrelay.metered.ca:80" },
            {
                urls: "turn:openrelay.metered.ca:80",
                username: "openrelayproject",
                credential: "openrelayproject"
            },
            {
                urls: "turn:openrelay.metered.ca:443",
                username: "openrelayproject",
                credential: "openrelayproject"
            },
            {
                urls: "turn:openrelay.metered.ca:443?transport=tcp",
                username: "openrelayproject",
                credential: "openrelayproject"
            }
        ]
    };

    // Helper to programmatically build a playable WAV Blob of a tone
    function createToneWavBlob(frequency, duration, activeRatio, isMelodic = false) {
        const sampleRate = 8000;
        const numSamples = sampleRate * duration;
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);

        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, numSamples * 2, true);

        const activeSamples = numSamples * activeRatio;
        for (let i = 0; i < numSamples; i++) {
            let sample = 0;
            if (i < activeSamples) {
                const t = i / sampleRate;
                if (isMelodic) {
                    // Beautiful futuristic ascending melody chime
                    let freq = 523.25;
                    if (t > 0.45) freq = 1046.50;
                    else if (t > 0.3) freq = 783.99;
                    else if (t > 0.15) freq = 659.25;
                    const envelope = Math.max(0, 1 - (t / (activeSamples / sampleRate)));
                    sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4 * 32767;
                } else {
                    // Outgoing sonar ping (frequency sweeps down from 880 to 220 Hz)
                    const durationSeconds = activeSamples / sampleRate;
                    const freq = 880 - (660 * (t / durationSeconds));
                    const envelope = Math.exp(-3 * t);
                    sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5 * 32767;
                }
            }
            view.setInt16(44 + i * 2, sample, true);
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    function startRinging(isIncoming) {
        stopRinging();
        try {
            const frequency = isIncoming ? 600 : 425;
            const duration = isIncoming ? 3.0 : 4.0;
            const activeRatio = isIncoming ? 0.33 : 0.3; // 1s tone/2s silence, or 1.2s tone/2.8s silence
            
            const blob = createToneWavBlob(frequency, duration, activeRatio, isIncoming);
            const url = URL.createObjectURL(blob);
            
            ringingAudio = new Audio(url);
            ringingAudio.loop = true;
            ringingAudio.play().catch(e => {
                console.warn("Failed to play ringing audio:", e);
            });
        } catch (e) {
            console.error("Error starting ringing audio:", e);
        }
    }

    function stopRinging() {
        if (ringingAudio) {
            try {
                ringingAudio.pause();
                ringingAudio.src = "";
            } catch (e) {}
            ringingAudio = null;
        }
    }

    function setupIncomingCallListener() {
        if (callListenerUnsubscribe) callListenerUnsubscribe();

        callListenerUnsubscribe = db.collection('calls')
            .where('receiverId', '==', currentUser.uid)
            .where('status', '==', 'calling')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const callData = change.doc.data();
                        showIncomingCallUI(change.doc.id, callData);
                    }
                });
            });
    }

    function showIncomingCallUI(callId, callData) {
        if (window.autoAcceptCallId === callId) {
            window.autoAcceptCallId = null;
            acceptCall();
            return;
        }

        if (currentCallId) return; // Already in a call or call screen active

        currentCallId = callId;
        currentCallData = callData;
        callStartTime = null;

        document.getElementById('call-avatar').textContent = callData.callerName.charAt(0).toUpperCase();
        document.getElementById('call-username').textContent = callData.callerName;
        document.getElementById('call-status').textContent = 'Входящий вызов...';
        
        document.getElementById('btn-accept-call').classList.remove('hidden');
        document.getElementById('call-overlay').classList.remove('hidden');
        document.getElementById('call-overlay').classList.add('flex');

        startRinging(true);

        // Listen for call state updates (answered elsewhere, cancelled, rejected)
        activeCallUnsubscribe = db.collection('calls').doc(callId).onSnapshot(doc => {
            const data = doc.data();
            if (data) {
                currentCallData = data;
                if (data.status === 'ended' || data.status === 'rejected' || (data.status === 'connected' && !peerConnection)) {
                    cleanupCallUI();
                }
            }
        });
    }

    async function startCall(receiverId, receiverName) {
        if (currentCallId) return;

        document.getElementById('call-avatar').textContent = receiverName.charAt(0).toUpperCase();
        document.getElementById('call-username').textContent = receiverName;
        document.getElementById('call-status').textContent = 'Исходящий вызов...';

        document.getElementById('btn-accept-call').classList.add('hidden');
        document.getElementById('call-overlay').classList.remove('hidden');
        document.getElementById('call-overlay').classList.add('flex');

        startRinging(false);

        try {
            // Request micro permission early
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const localAudio = document.getElementById('local-audio');
            if (localAudio) localAudio.srcObject = localStream;

            // Notify native Android app (if bridge exists)
            if (window.AndroidApp && typeof window.AndroidApp.setCallActive === 'function') {
                window.AndroidApp.setCallActive(true);
            }

            const callDoc = db.collection('calls').doc();
            currentCallId = callDoc.id;
            currentCallData = {
                callerId: currentUser.uid,
                callerName: currentUser.displayName || 'Пользователь',
                receiverId: receiverId,
                receiverName: receiverName,
                status: 'calling'
            };
            callStartTime = null;

            await callDoc.set({
                callerId: currentUser.uid,
                callerName: currentUser.displayName || 'Пользователь',
                receiverId: receiverId,
                receiverName: receiverName,
                status: 'calling',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            peerConnection = new RTCPeerConnection(rtcConfig);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.onicecandidate = event => {
                if (event.candidate && currentCallId) {
                    db.collection('calls').doc(currentCallId).collection('callerCandidates').add(event.candidate.toJSON());
                }
            };

            peerConnection.ontrack = event => {
                const remoteAudio = document.getElementById('remote-audio');
                if (remoteAudio) {
                    if (event.streams && event.streams[0]) {
                        remoteAudio.srcObject = event.streams[0];
                    } else {
                        if (!remoteAudio.srcObject) {
                            remoteAudio.srcObject = new MediaStream();
                        }
                        remoteAudio.srcObject.addTrack(event.track);
                    }
                    remoteAudio.play().catch(err => console.error("Error playing remote audio:", err));
                }
            };

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            await callDoc.update({
                offer: { type: offer.type, sdp: offer.sdp }
            });

            // Listen for answers and status changes
            activeCallUnsubscribe = callDoc.onSnapshot(async doc => {
                const data = doc.data();
                if (data) {
                    currentCallData = data;
                    if (data.status === 'connected' && peerConnection.signalingState === 'have-local-offer' && data.answer) {
                        document.getElementById('call-status').textContent = 'Разговор';
                        stopRinging();
                        callStartTime = Date.now();
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                        
                        isSpeakerOn = false;
                        updateSpeakerUI();
                        if (window.AndroidApp && typeof window.AndroidApp.setSpeakerphoneOn === 'function') {
                            window.AndroidApp.setSpeakerphoneOn(false);
                        }
                        if (window.AndroidApp && typeof window.AndroidApp.setCallConnected === 'function') {
                            window.AndroidApp.setCallConnected(true);
                        }
                    } else if (data.status === 'ended') {
                        cleanupCallUI();
                    } else if (data.status === 'rejected') {
                        cleanupCallUI();
                    }
                }
            });

            // Listen for candidates from receiver
            activeCandidatesUnsubscribe = callDoc.collection('receiverCandidates').onSnapshot(snapshot => {
                snapshot.docChanges().forEach(async change => {
                    if (change.type === 'added' && peerConnection) {
                        try {
                            await peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                        } catch (e) {
                            console.error("Error adding IceCandidate:", e);
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Start call error:", error);
            showSnackbar("Не удалось запустить звонок: " + error.message);
            cleanupCallUI();
        }
    }
    async function acceptCall() {
        if (!currentCallId) return;

        stopRinging();
        document.getElementById('call-status').textContent = 'Подключение...';
        document.getElementById('btn-accept-call').classList.add('hidden');

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const localAudio = document.getElementById('local-audio');
            if (localAudio) localAudio.srcObject = localStream;

            // Notify native Android app (if bridge exists)
            if (window.AndroidApp && typeof window.AndroidApp.setCallActive === 'function') {
                window.AndroidApp.setCallActive(true);
            }

            const callDocRef = db.collection('calls').doc(currentCallId);
            const callDoc = await callDocRef.get();
            const callData = callDoc.data();

            if (!callData || callData.status !== 'calling') {
                showSnackbar("Звонок уже завершен.");
                cleanupCallUI();
                return;
            }

            peerConnection = new RTCPeerConnection(rtcConfig);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.onicecandidate = event => {
                if (event.candidate && currentCallId) {
                    db.collection('calls').doc(currentCallId).collection('receiverCandidates').add(event.candidate.toJSON());
                }
            };

            peerConnection.ontrack = event => {
                const remoteAudio = document.getElementById('remote-audio');
                if (remoteAudio) {
                    if (event.streams && event.streams[0]) {
                        remoteAudio.srcObject = event.streams[0];
                    } else {
                        if (!remoteAudio.srcObject) {
                            remoteAudio.srcObject = new MediaStream();
                        }
                        remoteAudio.srcObject.addTrack(event.track);
                    }
                    remoteAudio.play().catch(err => console.error("Error playing remote audio:", err));
                }
            };

            await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            await callDocRef.update({
                answer: { type: answer.type, sdp: answer.sdp },
                status: 'connected',
                connectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            callStartTime = Date.now();

            document.getElementById('call-status').textContent = 'Разговор';

            isSpeakerOn = false;
            updateSpeakerUI();
            if (window.AndroidApp && typeof window.AndroidApp.setSpeakerphoneOn === 'function') {
                window.AndroidApp.setSpeakerphoneOn(false);
            }
            if (window.AndroidApp && typeof window.AndroidApp.setCallConnected === 'function') {
                window.AndroidApp.setCallConnected(true);
            }

            // Listen for candidates from caller
            activeCandidatesUnsubscribe = callDocRef.collection('callerCandidates').onSnapshot(snapshot => {
                snapshot.docChanges().forEach(async change => {
                    if (change.type === 'added' && peerConnection) {
                        try {
                            await peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                        } catch (e) {
                            console.error("Error adding IceCandidate:", e);
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Accept call error:", error);
            showSnackbar("Не удалось принять вызов: " + error.message);
            hangupCall();
        }
    }

    async function hangupCall() {
        if (currentCallId) {
            const callDocRef = db.collection('calls').doc(currentCallId);
            try {
                // If we are the receiver and the call is still 'calling', update status to 'rejected'
                if (currentCallData && currentUser && currentUser.uid === currentCallData.receiverId && currentCallData.status === 'calling') {
                    await callDocRef.update({ 
                        status: 'rejected',
                        endedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    await callDocRef.update({ 
                        status: 'ended',
                        endedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (e) {
                console.error("Error ending call in Firestore:", e);
            }
        }
        cleanupCallUI();
    }

    function cleanupCallUI() {
        stopRinging();

        if (activeCallUnsubscribe) {
            activeCallUnsubscribe();
            activeCallUnsubscribe = null;
        }
        if (activeCandidatesUnsubscribe) {
            activeCandidatesUnsubscribe();
            activeCandidatesUnsubscribe = null;
        }

        // Notify native Android app (if bridge exists)
        if (window.AndroidApp && typeof window.AndroidApp.setCallActive === 'function') {
            window.AndroidApp.setCallActive(false);
        }

        if (peerConnection) {
            try { peerConnection.close(); } catch(e) {}
            peerConnection = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        const localAudio = document.getElementById('local-audio');
        if (localAudio) localAudio.srcObject = null;
        const remoteAudio = document.getElementById('remote-audio');
        if (remoteAudio) remoteAudio.srcObject = null;

        document.getElementById('call-overlay').classList.add('hidden');
        document.getElementById('call-overlay').classList.remove('flex');
        
        const panel = document.getElementById('audio-device-panel');
        if (panel) panel.classList.add('hidden');
        
        currentCallId = null;
        currentCallData = null;
        callStartTime = null;
        isCallMuted = false;
        document.getElementById('mute-icon').textContent = 'mic';
        
        isSpeakerOn = false;
        updateSpeakerUI();
        if (window.AndroidApp && typeof window.AndroidApp.setSpeakerphoneOn === 'function') {
            window.AndroidApp.setSpeakerphoneOn(false);
        }
    }



    function toggleMute() {
        if (localStream) {
            isCallMuted = !isCallMuted;
            localStream.getAudioTracks().forEach(track => track.enabled = !isCallMuted);
            document.getElementById('mute-icon').textContent = isCallMuted ? 'mic_off' : 'mic';
        }
    }

    function toggleSpeaker() {
        const panel = document.getElementById('audio-device-panel');
        if (panel) {
            if (panel.classList.contains('hidden')) {
                populateAudioDevices();
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        }
    }

    function updateSpeakerUI() {
        const icon = document.getElementById('speaker-icon');
        if (icon) {
            icon.textContent = 'volume_up';
        }
    }

    async function populateAudioDevices() {
        const inputSelect = document.getElementById('audio-input-select');
        const outputSelect = document.getElementById('audio-output-select');
        const outputContainer = document.getElementById('audio-output-container');
        const inputLabel = inputSelect ? inputSelect.previousElementSibling : null;

        if (window.AndroidApp && typeof window.AndroidApp.getAudioOutputs === 'function') {
            if (inputSelect) inputSelect.style.display = 'none';
            if (inputLabel) inputLabel.style.display = 'none';
            const micTitle = document.querySelector('#audio-device-panel h3');
            if (micTitle) micTitle.textContent = 'Аудиовыход';

            if (outputContainer) outputContainer.style.display = '';
            if (outputSelect) {
                outputSelect.innerHTML = '';
                try {
                    const jsonStr = window.AndroidApp.getAudioOutputs();
                    const list = JSON.parse(jsonStr);
                    list.forEach(type => {
                        const opt = document.createElement('option');
                        opt.value = type;
                        if (type === 'speaker') {
                            opt.textContent = 'Внешний динамик';
                        } else if (type === 'earpiece') {
                            opt.textContent = 'Разговорный динамик';
                        } else if (type === 'bluetooth') {
                            opt.textContent = 'Bluetooth-устройство';
                        } else {
                            opt.textContent = type;
                        }
                        outputSelect.appendChild(opt);
                    });
                } catch (e) {
                    console.error('Error parsing android audio outputs:', e);
                    const opt1 = document.createElement('option');
                    opt1.value = 'speaker'; opt1.textContent = 'Внешний динамик';
                    outputSelect.appendChild(opt1);
                    const opt2 = document.createElement('option');
                    opt2.value = 'earpiece'; opt2.textContent = 'Разговорный динамик';
                    outputSelect.appendChild(opt2);
                }
            }
        } else {
            if (inputSelect) inputSelect.style.display = '';
            if (inputLabel) inputLabel.style.display = '';
            const micTitle = document.querySelector('#audio-device-panel h3');
            if (micTitle) micTitle.textContent = 'Аудиоустройства';

            try {
                const devices = await navigator.mediaDevices.enumerateDevices();

                if (inputSelect) {
                    const currentInputId = localStream ? localStream.getAudioTracks()[0]?.getSettings()?.deviceId : null;
                    inputSelect.innerHTML = '';
                    let micCount = 0;
                    devices.filter(d => d.kind === 'audioinput').forEach(d => {
                        micCount++;
                        const opt = document.createElement('option');
                        opt.value = d.deviceId;
                        opt.textContent = d.label || `Микрофон ${micCount}`;
                        if (currentInputId && d.deviceId === currentInputId) opt.selected = true;
                        inputSelect.appendChild(opt);
                    });
                }

                const supportsSinkId = typeof HTMLMediaElement.prototype.setSinkId === 'function';
                if (outputContainer) {
                    outputContainer.style.display = supportsSinkId ? '' : 'none';
                }
                if (outputSelect && supportsSinkId) {
                    outputSelect.innerHTML = '';
                    let spkCount = 0;
                    devices.filter(d => d.kind === 'audiooutput').forEach(d => {
                        spkCount++;
                        const opt = document.createElement('option');
                        opt.value = d.deviceId;
                        opt.textContent = d.label || `Динамик ${spkCount}`;
                        outputSelect.appendChild(opt);
                    });
                }
            } catch (e) {
                console.error('Failed to enumerate audio devices:', e);
            }
        }
    }

    // Handle microphone change
    const audioInputSelect = document.getElementById('audio-input-select');
    if (audioInputSelect) {
        audioInputSelect.addEventListener('change', async (e) => {
            const deviceId = e.target.value;
            if (!peerConnection || !localStream) return;
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
                const newTrack = newStream.getAudioTracks()[0];
                const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
                if (sender) {
                    await sender.replaceTrack(newTrack);
                }
                // Stop old tracks
                localStream.getAudioTracks().forEach(t => t.stop());
                // Replace in localStream reference
                localStream.removeTrack(localStream.getAudioTracks()[0]);
                localStream.addTrack(newTrack);
                // Preserve mute state
                newTrack.enabled = !isCallMuted;
            } catch (err) {
                console.error('Failed to switch microphone:', err);
                showSnackbar('Не удалось переключить микрофон');
            }
        });
    }

    // Handle speaker/output change
    const audioOutputSelect = document.getElementById('audio-output-select');
    if (audioOutputSelect) {
        audioOutputSelect.addEventListener('change', async (e) => {
            const value = e.target.value;
            if (window.AndroidApp && typeof window.AndroidApp.setAudioOutput === 'function') {
                window.AndroidApp.setAudioOutput(value);
                showSnackbar('Аудиовыход изменен');
            } else {
                const remoteAudio = document.getElementById('remote-audio');
                if (remoteAudio && typeof remoteAudio.setSinkId === 'function') {
                    try {
                        await remoteAudio.setSinkId(value);
                    } catch (err) {
                        console.error('Failed to switch audio output:', err);
                        showSnackbar('Не удалось переключить динамик');
                    }
                }
            }
        });
    }

    // Call Actions Click Bindings
    document.getElementById('btn-mute-call').addEventListener('click', toggleMute);
    document.getElementById('btn-speaker-call').addEventListener('click', toggleSpeaker);
    document.getElementById('btn-accept-call').addEventListener('click', acceptCall);
    document.getElementById('btn-hangup-call').addEventListener('click', hangupCall);

    const chatCallBtn = document.getElementById('chat-call-btn');
    if (chatCallBtn) {
        chatCallBtn.addEventListener('click', () => {
            if (activeChatUser) {
                startCall(activeChatUser.uid, activeChatUser.username || 'Пользователь');
            }
        });
    }

    window.onProximityChanged = function(isNear) {
        console.log("Proximity changed from native side:", isNear);
        if (peerConnection) {
            if (isNear) {
                if (isSpeakerOn) {
                    isSpeakerOn = false;
                    updateSpeakerUI();
                    if (window.AndroidApp && typeof window.AndroidApp.setSpeakerphoneOn === 'function') {
                        window.AndroidApp.setSpeakerphoneOn(false);
                    }
                }
            }
        }
    };


    window.toggleMobileChat = function(active) {
        if (active) document.body.classList.add('chat-active');
        else document.body.classList.remove('chat-active');
    };

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    function updateConnectionStatus() {
        const offlineText = document.getElementById('offline-status-text');
        if (offlineText) {
            if (navigator.onLine) {
                offlineText.classList.add('hidden');
            } else {
                offlineText.classList.remove('hidden');
            }
        }
    }
    updateConnectionStatus();
});
