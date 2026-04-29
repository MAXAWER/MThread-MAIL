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

    let currentUser = null;
    let db = null;
    let storage = null;
    let activeChatId = null;
    let activeChatUser = null;
    let messagesUnsubscribe = null;
    let chatsUnsubscribe = null;
    let statusUnsubscribe = null;
    let activeChatTypingUnsubscribe = null;

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
        settingsModal.classList.remove('hidden');
        settingsModal.style.display = 'flex';
    };

    window.closeSettings = () => {
        const modalContent = settingsModal.querySelector('.modal-enter');
        modalContent.classList.replace('modal-enter', 'modal-exit');
        setTimeout(() => {
            settingsModal.classList.add('hidden');
            settingsModal.style.display = 'none';
            modalContent.classList.replace('modal-exit', 'modal-enter');
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
        setupAuthListener();
    } else {
        console.error("Firebase not initialized.");
    }

    function setupAuthListener() {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                authModal.classList.add('hidden');
                
                const doc = await db.collection("users").doc(user.uid).get();
                if(doc.exists) userProfileData = doc.data();

                updateProfileUI();
                loadChatList();
                setupPushNotifications();

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

    async function setupPushNotifications() {
        try {
            // Force update Service Worker to clear old cache
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                await registration.update();
            }

            const messaging = firebase.messaging();
            const permission = await Notification.requestPermission();
            
            if (permission === 'denied') {
                showSnackbar('Уведомления заблокированы. Нажмите на 🔒 слева от адреса сайта!');
                return;
            }
            
            if (permission === 'granted') {
                try {
                    const token = await messaging.getToken({ vapidKey: 'BP_hWM1RFB245Rad_lsjHtMQTM5u0ybQbEhQ8DZTbcAh7PwXIubn6TtAt295pptU8LUYrC7qnf9vPrIjBcQk2kU' });
                    if (token) {
                        await db.collection('users').doc(currentUser.uid).set({ fcmToken: token }, { merge: true });
                    }
                } catch (tokenError) {
                    console.error('Token error:', tokenError);
                    showSnackbar('Ошибка токена: ' + tokenError.message);
                }
            }
            messaging.onMessage((payload) => {
                const title = payload.data ? payload.data.title : (payload.notification ? payload.notification.title : 'Новое сообщение');
                const body = payload.data ? payload.data.body : (payload.notification ? payload.notification.body : '');
                
                showSnackbar(`Новое сообщение: ${title}`);
                // Trigger native Windows notification if the tab is open but running in the background
                if (Notification.permission === 'granted' && document.hidden) {
                    new Notification(title, {
                        body: body,
                        icon: 'https://ui-avatars.com/api/?name=MThread&background=d0e2ff&color=53647d'
                    });
                }
            });
        } catch (error) { 
            console.error('Push setup failed:', error); 
            showSnackbar('Ошибка уведомлений: ' + error.message);
        }
    }

    // --- Search Logic ---
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
                // Fetch users (in a real app, use Algolia, but here we scan)
                const snapshot = await db.collection('users').get();
                searchResults.innerHTML = '';
                let found = 0;
                
                snapshot.forEach(doc => {
                    if (doc.id === currentUser.uid) return;
                    const data = doc.data();
                    if (data.username && data.username.toLowerCase().includes(query)) {
                        found++;
                        const div = document.createElement('div');
                        div.className = 'p-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-all';
                        div.innerHTML = `
                            <img src="${data.avatarUrl || `https://ui-avatars.com/api/?name=${data.username}&background=d0e2ff&color=53647d`}" class="w-8 h-8 rounded-full object-cover">
                            <span class="text-white text-sm">${data.username}</span>
                        `;
                        div.onclick = () => {
                            searchInput.value = '';
                            searchResults.classList.add('hidden');
                            startChat(doc.id, data);
                        };
                        searchResults.appendChild(div);
                    }
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
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
                                <h4 class="text-sm font-semibold text-white truncate">${escapeHtml(targetData.username || '...')}</h4>
                                <span class="text-[10px] text-on-surface-variant/60">${time}</span>
                            </div>
                            <p class="text-xs text-on-surface-variant/60 truncate">${chat.lastMessageSender === currentUser.uid ? '<span class="text-on-surface-variant font-bold">Вы:</span> ' : ''}${escapeHtml(chat.lastMessage || 'Начать диалог')}</p>
                        </div>
                    `;

                    div.onclick = () => openChat(chat.id, targetUid, targetData);
                    chatListContainer.appendChild(div);

                    try {
                        const userDoc = await db.collection('users').doc(targetUid).get();
                        if (userDoc.exists) {
                            targetData = userDoc.data();
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

    function showContextMenu(x, y, msgId, currentText, isMe) {
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
        
        // Ensure menu doesn't go off screen
        let left = x;
        let top = y;
        
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
        
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
        if (rect.bottom > window.innerHeight) contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
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
            db.collection(collectionName).doc(activeChatId).set({
                lastMessage: '🗑 Сообщение удалено',
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(()=>{});
        } catch (e) {
            showSnackbar('Ошибка удаления: ' + e.message);
        }
    });

    ctxEditBtn.addEventListener('click', () => {
        contextMenu.classList.add('hidden');
        contextMenu.classList.remove('flex');
        if (!contextTargetId || !activeChatId) return;
        
        const isGroup = activeChatUser && activeChatUser.isGroup;
        const collectionName = isGroup ? 'groups' : 'chats';
        
        const newText = prompt("Редактировать сообщение:", contextTargetText);
        if (newText && newText.trim() !== "" && newText !== contextTargetText) {
            db.collection(collectionName).doc(activeChatId).collection('messages').doc(contextTargetId).update({
                text: newText.trim(),
                edited: true
            }).catch(e => showSnackbar('Ошибка: ' + e.message));
            
            db.collection(collectionName).doc(activeChatId).set({
                lastMessage: newText.trim(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(()=>{});
        }
    });

    const renderMessage = (docId, msg) => {
        const isMe = msg.userId === currentUser.uid;
        const msgDiv = document.createElement('div');
        msgDiv.id = `msg-${docId}`;
        msgDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1 max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end' : 'self-start'} animate-msg`;

        const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        const imageHtml = msg.imageUrl ? `<img src="${msg.imageUrl}" class="msg-image w-full max-w-sm rounded-xl mb-2 object-cover cursor-pointer hover:brightness-90 transition-all" onclick="window.open(this.src, '_blank')">` : '';

        const checkIcon = msg.read ? 'done_all' : 'done';
        const checkColor = msg.read ? 'text-blue-400' : 'text-on-surface-variant';
        const isGroup = activeChatUser && activeChatUser.isGroup;
        
        const senderNameHtml = (isGroup && !isMe) ? `<span class="text-[10px] font-bold text-primary-container mb-1 block">${escapeHtml(msg.userName || 'User')}</span>` : '';

        msgDiv.innerHTML = `
            <div class="msg-bubble cursor-pointer ${isMe ? 'bg-primary-container text-on-primary-container rounded-[24px] rounded-br-sm' : 'bg-surface-container text-white rounded-[24px] rounded-bl-sm'} p-4 shadow-lg transition-all active:scale-[0.98]">
                ${senderNameHtml}
                ${imageHtml}
                <p class="msg-text text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap">${escapeHtml(msg.text)}</p>
                ${msg.edited ? '<span class="msg-edited text-[10px] opacity-50 block mt-1">(изменено)</span>' : ''}
            </div>
            <div class="flex items-center gap-1 text-[10px] text-on-surface-variant/40 px-2 mt-1">
                <span>${time}</span>
                ${isMe ? `<span class="material-symbols-outlined text-[14px] ${checkColor}">${checkIcon}</span>` : ''}
            </div>
        `;

        const bubble = msgDiv.querySelector('.msg-bubble');
        bubble.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, docId, msg.text, isMe);
        });
        bubble.addEventListener('click', (e) => {
            if (window.innerWidth <= 767) {
                showContextMenu(e.clientX, e.clientY, docId, msg.text, isMe);
            }
        });

        messagesContainer.appendChild(msgDiv);
    };

    let typingTimeout;
    messageInput.addEventListener('input', () => {
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

    const chatImageInput = document.getElementById('chat-image-input');
    if (chatImageInput) {
        chatImageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !currentUser || !activeChatId) return;
            
            showSnackbar('Отправка изображения...');
            
            const isGroup = activeChatUser && activeChatUser.isGroup;
            const collectionName = isGroup ? 'groups' : 'chats';
            
            const storageRef = storage.ref(`chat_images/${activeChatId}/${Date.now()}_${file.name}`);
            try {
                const snapshot = await storageRef.put(file);
                const url = await snapshot.ref.getDownloadURL();
                
                const timestamp = firebase.firestore.FieldValue.serverTimestamp();
                db.collection(collectionName).doc(activeChatId).collection('messages').add({
                    text: '📷 Изображение',
                    imageUrl: url,
                    userId: currentUser.uid,
                    userName: currentUser.displayName,
                    timestamp: timestamp
                });
                
                db.collection(collectionName).doc(activeChatId).set({
                    lastMessage: '📷 Изображение',
                    lastMessageSender: currentUser.uid,
                    lastUpdated: timestamp
                }, { merge: true });
                
                chatImageInput.value = '';
            } catch (err) {
                if (err.message.includes('not been set up') || err.message.includes('unauthorized')) {
                    showSnackbar('Включите Storage в Firebase Console!');
                } else {
                    showSnackbar('Ошибка отправки: ' + err.message);
                }
            }
        });
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
        
        // Keep keyboard open on mobile
        setTimeout(() => messageInput.focus(), 10);

        if (text && db && currentUser && activeChatId) {
            const isGroup = activeChatUser && activeChatUser.isGroup;
            const collectionName = isGroup ? 'groups' : 'chats';
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            // Add message
            db.collection(collectionName).doc(activeChatId).collection('messages').add({
                text: text,
                userId: currentUser.uid,
                userName: currentUser.displayName,
                timestamp: timestamp
            });

            // Update chat meta
            db.collection(collectionName).doc(activeChatId).set({
                lastMessage: text,
                lastMessageSender: currentUser.uid,
                lastUpdated: timestamp
            }, { merge: true });

            messageInput.value = '';
            messageInput.style.height = 'auto';
        } else if (!activeChatId) {
            showSnackbar('Выберите чат для отправки сообщения');
        }
    });

    const updateProfileUI = () => {
        if (currentUser) {
            const name = currentUser.displayName || 'U';
            const initials = name.charAt(0).toUpperCase();
            const avatarUrl = userProfileData.avatarUrl || `https://ui-avatars.com/api/?name=${initials}&background=d0e2ff&color=53647d&bold=true`;
            
            document.querySelectorAll('#sidebar-avatar, #settings-avatar').forEach(img => {
                img.src = avatarUrl;
            });
        }
    };

    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        selectedGroupMembers = [currentUser.uid]; // Self is always in
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
        selectedGroupMembers.forEach(uid => {
            if (uid === currentUser.uid) return;
            const span = document.createElement('span');
            span.className = 'bg-primary-container text-on-primary-container text-xs px-2 py-1 rounded-full flex items-center gap-1';
            span.innerHTML = `Пользователь <button onclick="removeGroupMember('${uid}')"><span class="material-symbols-outlined text-[12px]">close</span></button>`;
            groupMembersList.appendChild(span);
        });
    }

    window.removeGroupMember = (uid) => {
        selectedGroupMembers = selectedGroupMembers.filter(id => id !== uid);
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
                if (uid === currentUser.uid || selectedGroupMembers.includes(uid)) return;
                
                found = true;
                const div = document.createElement('div');
                div.className = 'p-3 hover:bg-white/5 cursor-pointer text-sm text-white border-b border-white/5';
                div.textContent = username;
                div.onclick = () => {
                    selectedGroupMembers.push(uid);
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
            const groupRef = db.collection('groups').doc();
            await groupRef.set({
                name: name,
                participants: selectedGroupMembers,
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: 'Группа создана'
            });
            
            showSnackbar('Группа создана');
            closeCreateGroupModal();
            loadGroupList();
        } catch(e) {
            showSnackbar('Ошибка: ' + e.message);
        }
        createGroupBtn.disabled = false;
        createGroupBtn.textContent = 'Создать группу';
    });

    function loadGroupList() {
        if (chatsUnsubscribe) chatsUnsubscribe();
        
        chatsUnsubscribe = db.collection('groups')
            .where('participants', 'array-contains', currentUser.uid)
            .onSnapshot(snapshot => {
                const groups = [];
                snapshot.forEach(doc => groups.push({ id: doc.id, ...doc.data() }));
                groups.sort((a, b) => {
                    const timeA = a.lastUpdated ? a.lastUpdated.toMillis() : 0;
                    const timeB = b.lastUpdated ? b.lastUpdated.toMillis() : 0;
                    return timeB - timeA;
                });

                chatListContainer.innerHTML = '';
                if(groups.length === 0) {
                    chatListContainer.innerHTML = '<div class="p-6 text-on-surface-variant text-sm text-center">Вы не состоите ни в одной группе.</div>';
                }

                groups.forEach(group => {
                    const time = group.lastUpdated ? new Date(group.lastUpdated.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    
                    const div = document.createElement('div');
                    div.className = `chat-item-btn p-4 md:px-6 flex gap-4 cursor-pointer transition-all ripple-container ${activeChatId === group.id ? 'bg-white/10' : 'hover:bg-white/5'}`;
                    
                    const avatar = `https://ui-avatars.com/api/?name=${group.name}&background=53647d&color=d0e2ff`;
                    
                    div.innerHTML = `
                        <div class="relative shrink-0">
                            <img src="${avatar}" class="w-12 h-12 rounded-xl object-cover">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-baseline mb-1">
                                <h4 class="text-sm font-semibold text-white truncate">${escapeHtml(group.name)}</h4>
                                <span class="text-[10px] text-on-surface-variant/60">${time}</span>
                            </div>
                            <p class="text-xs text-on-surface-variant/60 truncate">${escapeHtml(group.lastMessage || 'Нет сообщений')}</p>
                        </div>
                    `;

                    div.onclick = () => openChat(group.id, null, { username: group.name, isGroup: true });
                    chatListContainer.appendChild(div);

                    // Context Menu Delete Group
                    div.addEventListener('contextmenu', async (e) => {
                        e.preventDefault();
                        if (confirm(`Удалить группу "${group.name}" для всех?`)) {
                            await deleteEntireChat(group.id, true);
                        }
                    });

                    // Long press for mobile
                    let pressTimer;
                    div.addEventListener('touchstart', (e) => {
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
            });
    }

    // Show specific step
    window.showStep = (stepId) => {
        [stepLogin, stepRegister].forEach(s => s.classList.add('hidden'));
        document.getElementById(stepId).classList.remove('hidden');
    };

    // Auth flows (Login/Register)
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
        } catch (err) {
            alert("Ошибка: " + err.message);
            loginBtn.disabled = false; loginBtn.textContent = 'Войти';
        }
    });

    registerBtn.addEventListener('click', async () => {
        const username = regUser.value.trim().toLowerCase();
        const pass = regPass.value.trim();
        
        if (!username || !pass) return;
        if (username.length < 3) return alert("Логин слишком короткий");

        registerBtn.disabled = true; registerBtn.textContent = 'Проверка...';
        try {
            const userDoc = await db.collection("usernames").doc(username).get();
            if (userDoc.exists) throw new Error("Логин уже занят");

            const email = `${username}@mthread.local`;
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
});
