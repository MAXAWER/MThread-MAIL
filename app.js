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

    // Show specific step
    window.showStep = (stepId) => {
        [stepLogin, stepRegister].forEach(s => s.classList.add('hidden'));
        document.getElementById(stepId).classList.remove('hidden');
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
            showSnackbar('Ошибка загрузки: ' + err.message);
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
        
        if (messagesUnsubscribe) messagesUnsubscribe();
        
        // Hide mobile chat list
        if (window.innerWidth <= 767) {
            document.body.classList.add('chat-active');
        }

        messagesContainer.innerHTML = '<div class="flex-1 flex items-center justify-center text-on-surface-variant">Загрузка...</div>';
        
        messagesUnsubscribe = db.collection('chats').doc(chatId).collection('messages')
            .orderBy('timestamp', 'asc')
            .limit(100)
            .onSnapshot(snapshot => {
                messagesContainer.innerHTML = '';
                if(snapshot.empty) {
                    messagesContainer.innerHTML = '<div class="flex-1 flex items-center justify-center text-on-surface-variant text-sm">Здесь пока нет сообщений. Напишите первым!</div>';
                    return;
                }
                
                snapshot.forEach(doc => renderMessage(doc.id, doc.data()));
                messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
            });
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

                chats.forEach(chat => {
                    const targetUid = chat.participants.find(id => id !== currentUser.uid);
                    const targetData = (chat.participantsData && chat.participantsData[targetUid]) ? chat.participantsData[targetUid] : { username: 'User' };
                    
                    const time = chat.lastUpdated ? new Date(chat.lastUpdated.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    
                    const div = document.createElement('div');
                    div.className = `chat-item-btn p-4 md:px-6 flex gap-4 cursor-pointer transition-all ripple-container ${activeChatId === chat.id ? 'bg-white/10' : 'hover:bg-white/5'}`;
                    div.onclick = () => openChat(chat.id, targetUid, targetData);
                    
                    const avatar = targetData.avatarUrl || `https://ui-avatars.com/api/?name=${targetData.username}&background=cac2e2&color=312d46`;
                    
                    div.innerHTML = `
                        <div class="relative shrink-0">
                            <img src="${avatar}" class="w-12 h-12 rounded-full object-cover">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-baseline mb-1">
                                <h4 class="text-sm font-semibold text-white truncate">${targetData.username || '...'}</h4>
                                <span class="text-[10px] text-on-surface-variant/60">${time}</span>
                            </div>
                            <p class="text-xs text-on-surface-variant/60 truncate">${chat.lastMessage || 'Начать диалог'}</p>
                        </div>
                    `;
                    chatListContainer.appendChild(div);
                });
                attachRipples();
            });
    }

    let contextTargetId = null;
    let contextTargetText = null;

    function showContextMenu(x, y, msgId, currentText) {
        contextTargetId = msgId;
        contextTargetText = currentText;
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
    });

    ctxDeleteBtn.addEventListener('click', async () => {
        contextMenu.classList.add('hidden');
        contextMenu.classList.remove('flex');
        if (!contextTargetId || !activeChatId) return;
        try {
            await db.collection('chats').doc(activeChatId).collection('messages').doc(contextTargetId).delete();
        } catch (e) {
            showSnackbar('Ошибка удаления: ' + e.message);
        }
    });

    ctxEditBtn.addEventListener('click', () => {
        contextMenu.classList.add('hidden');
        contextMenu.classList.remove('flex');
        if (!contextTargetId || !activeChatId) return;
        
        const newText = prompt("Редактировать сообщение:", contextTargetText);
        if (newText && newText.trim() !== "" && newText !== contextTargetText) {
            db.collection('chats').doc(activeChatId).collection('messages').doc(contextTargetId).update({
                text: newText.trim(),
                edited: true
            }).catch(e => showSnackbar('Ошибка: ' + e.message));
        }
    });

    const renderMessage = (docId, msg) => {
        const isMe = msg.userId === currentUser.uid;
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1 max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end' : 'self-start'} animate-msg`;

        const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        msgDiv.innerHTML = `
            <div class="msg-bubble cursor-pointer ${isMe ? 'bg-primary-container text-on-primary-container rounded-[24px] rounded-br-sm' : 'bg-surface-container text-white rounded-[24px] rounded-bl-sm'} p-4 shadow-lg transition-all active:scale-95">
                <p class="text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap">${escapeHtml(msg.text)}</p>
                ${msg.edited ? '<span class="text-[10px] opacity-50 block mt-1">(изменено)</span>' : ''}
            </div>
            <div class="flex items-center gap-1 text-[10px] text-on-surface-variant/40 px-2 mt-1">
                <span>${time}</span>
                ${isMe ? '<span class="material-symbols-outlined text-[14px] text-blue-400">done_all</span>' : ''}
            </div>
        `;

        if (isMe) {
            const bubble = msgDiv.querySelector('.msg-bubble');
            // Desktop right click
            bubble.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e.clientX, e.clientY, docId, msg.text);
            });
            // Mobile tap
            bubble.addEventListener('click', (e) => {
                if (window.innerWidth <= 767) {
                    showContextMenu(e.clientX, e.clientY, docId, msg.text);
                }
            });
        }

        messagesContainer.appendChild(msgDiv);
    };

    // Send Message on Enter
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            messageForm.dispatchEvent(new Event('submit'));
        }
    });

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (text && db && currentUser && activeChatId) {
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            // Add message
            db.collection("chats").doc(activeChatId).collection('messages').add({
                text: text,
                userId: currentUser.uid,
                userName: currentUser.displayName,
                timestamp: timestamp
            });

            // Update chat meta
            db.collection("chats").doc(activeChatId).set({
                lastMessage: text,
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
