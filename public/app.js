// MThread Messenger - Application Logic (Username Architecture)

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

    let currentUser = null;
    let db = null;

    // Show specific step
    window.showStep = (stepId) => {
        [stepLogin, stepRegister].forEach(s => s.classList.add('hidden'));
        document.getElementById(stepId).classList.remove('hidden');
    };

    // Firebase Initialization (Public Config from firebase-config.js)
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        db = firebase.firestore();
        setupAuthListener();
    } else {
        console.error("Firebase not initialized. Check firebase-config.js");
    }

    function setupAuthListener() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                authModal.classList.add('hidden');
                loadMessages();
                updateProfileUI();
            } else {
                authModal.classList.remove('hidden');
                showStep('step-login');
            }
        });
    }

    // Login Logic (Username mapping)
    loginBtn.addEventListener('click', async () => {
        const username = loginUser.value.trim().toLowerCase();
        const pass = loginPass.value.trim();
        if (!username || !pass) return;

        loginBtn.disabled = true;
        loginBtn.textContent = 'Вход...';

        try {
            // 1. Get email for username
            const userDoc = await db.collection("usernames").doc(username).get();
            if (!userDoc.exists) {
                throw new Error("Пользователь не найден");
            }
            const email = userDoc.data().email;

            // 2. Sign in
            await firebase.auth().signInWithEmailAndPassword(email, pass);
        } catch (err) {
            alert("Ошибка: " + err.message);
            loginBtn.disabled = false;
            loginBtn.textContent = 'Войти';
        }
    });

    // Register Logic (Username uniqueness check)
    registerBtn.addEventListener('click', async () => {
        const username = regUser.value.trim().toLowerCase();
        const pass = regPass.value.trim();
        
        if (!username || !pass) return;
        if (username.length < 3) return alert("Логин слишком короткий");

        registerBtn.disabled = true;
        registerBtn.textContent = 'Проверка...';

        try {
            // 1. Check if username exists
            const userDoc = await db.collection("usernames").doc(username).get();
            if (userDoc.exists) {
                throw new Error("Логин уже занят");
            }

            // 2. Create Auth User
            const email = `${username}@mthread.local`;
            const cred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
            
            // 3. Save Username mapping and Profile
            const batch = db.batch();
            batch.set(db.collection("usernames").doc(username), { email: email, uid: cred.user.uid });
            batch.set(db.collection("users").doc(cred.user.uid), { username: username, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            await batch.commit();

            // 4. Update display name
            await cred.user.updateProfile({ displayName: username });
            
        } catch (err) {
            alert("Ошибка: " + err.message);
            registerBtn.disabled = false;
            registerBtn.textContent = 'Создать аккаунт';
        }
    });

    // Messages Logic
    const loadMessages = () => {
        db.collection("messages")
            .orderBy("timestamp", "asc")
            .limit(100)
            .onSnapshot((snapshot) => {
                messagesContainer.innerHTML = '';
                const divider = document.createElement('div');
                divider.className = 'flex justify-center mb-4';
                divider.innerHTML = '<span class="px-4 py-1.5 rounded-full bg-white/5 text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Сегодня</span>';
                messagesContainer.appendChild(divider);

                snapshot.forEach((doc) => renderMessage(doc.data()));
                messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
            });
    };

    const renderMessage = (msg) => {
        const isMe = msg.userId === currentUser.uid;
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1 max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end' : 'self-start'} animate-msg`;

        const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        msgDiv.innerHTML = `
            ${!isMe ? `<span class="text-[10px] text-on-surface-variant/40 ml-2 mb-1">${msg.userName}</span>` : ''}
            <div class="${isMe ? 'bg-primary-container text-on-primary-container rounded-[24px] rounded-br-sm' : 'bg-surface-container text-white rounded-[24px] rounded-bl-sm'} p-4 shadow-lg">
                <p class="text-sm md:text-base leading-relaxed">${escapeHtml(msg.text)}</p>
            </div>
            <div class="flex items-center gap-1 text-[10px] text-on-surface-variant/40 px-2 mt-1">
                <span>${time}</span>
                ${isMe ? '<span class="material-symbols-outlined text-[14px] text-blue-400">done_all</span>' : ''}
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    };

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (text && db && currentUser) {
            db.collection("messages").add({
                text: text,
                userId: currentUser.uid,
                userName: currentUser.displayName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
    });

    const updateProfileUI = () => {
        if (currentUser && currentUser.displayName) {
            const initials = currentUser.displayName.charAt(0).toUpperCase();
            document.querySelectorAll('nav img, header img').forEach(img => {
                img.src = `https://ui-avatars.com/api/?name=${initials}&background=d0e2ff&color=53647d`;
            });
        }
    };

    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
