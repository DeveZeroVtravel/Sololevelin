class FirebaseAuth {
    constructor(firebaseConfig) {
        this.config = firebaseConfig;
        this.app = null;
        this.auth = null;
        this.db = null;
        this.googleProvider = null;
        this.initialized = false;
    }

    /**
     * Initialize Firebase (using CDN imports)
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Dynamically import Firebase modules
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getAuth, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Initialize Firebase
            this.app = initializeApp(this.config);
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);
            this.googleProvider = new GoogleAuthProvider();
            
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            throw error;
        }
    }

    /**
     * Sign in with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} - User credential
     */
    async signInWithEmailPassword(email, password) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            
            // Tạo hệ thống bảng cho user
            await this.createUserSystem(userCredential.user);
            
            return {
                user: userCredential.user,
                success: true
            };
        } catch (error) {
            console.error('Error signing in:', error);
            return {
                success: false,
                error: this._getErrorMessage(error.code)
            };
        }
    }

    /**
     * Sign up with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} - User credential
     */
    async signUpWithEmailPassword(email, password) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            
            // Tạo hệ thống bảng cho user
            await this.createUserSystem(userCredential.user);
            
            return {
                user: userCredential.user,
                success: true
            };
        } catch (error) {
            console.error('Error signing up:', error);
            return {
                success: false,
                error: this._getErrorMessage(error.code)
            };
        }
    }

    /**
     * Sign in with Google
     * @returns {Promise<Object>} - User credential
     */
    async signInWithGoogle() {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const { signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const result = await signInWithPopup(this.auth, this.googleProvider);
            
            // Tạo hệ thống bảng cho user
            await this.createUserSystem(result.user);
            
            return {
                user: result.user,
                success: true
            };
        } catch (error) {
            console.error('Error signing in with Google:', error);
            return {
                success: false,
                error: this._getErrorMessage(error.code)
            };
        }
    }

    /**
     * Sign out current user
     * @returns {Promise<boolean>} - Success status
     */
    async signOut() {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await signOut(this.auth);
            return { success: true };
        } catch (error) {
            console.error('Error signing out:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get current user
     * @returns {Object|null} - Current user or null
     */
    getCurrentUser() {
        if (!this.initialized || !this.auth) {
            return null;
        }
        return this.auth.currentUser;
    }

    /**
     * Listen to auth state changes
     * @param {Function} callback - Callback function (user) => {}
     * @returns {Promise<Function>} - Promise that resolves to unsubscribe function
     */
    async onAuthStateChanged(callback) {
        if (!this.initialized) {
            await this.initialize();
        }

        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        return onAuthStateChanged(this.auth, async (user) => {
            if (user) {
                // Tự động tạo hệ thống bảng cho user
                await this.createUserSystem(user);
            }
            // Gọi callback của người dùng
            callback(user);
        });
    }

    /**
     * Tạo hệ thống bảng cho user trong Firestore
     * @param {Object} user - User object từ Firebase Auth
     * @returns {Promise<void>}
     */
    async createUserSystem(user) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const { doc, getDoc, setDoc, collection, getDocs, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            const userRef = doc(this.db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            let isNewUser = false;

            // Nếu user chưa tồn tại trong Firestore → tạo mới
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    name: user.displayName || user.email?.split('@')[0] || 'User',
                    email: user.email || '',
                    photo: user.photoURL || '',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
                isNewUser = true;
                console.log('✅ User system created for:', user.email);
            } else {
                // Cập nhật thông tin user nếu đã tồn tại
                const existingData = userSnap.data();
                await setDoc(userRef, {
                    ...existingData,
                    updatedAt: Timestamp.now(),
                    // Cập nhật thông tin nếu có thay đổi
                    name: user.displayName || existingData.name,
                    email: user.email || existingData.email,
                    photo: user.photoURL || existingData.photo
                }, { merge: true });
                console.log('✅ User system updated for:', user.email);
            }

            // Tạo collection categories nếu chưa có (chỉ tạo một lần)
            await this._ensureCollectionExists(user.uid, 'categories', isNewUser);

            // Tạo collection events nếu chưa có (chỉ tạo một lần)
            await this._ensureCollectionExists(user.uid, 'events', isNewUser);

        } catch (error) {
            console.error('❌ Error creating user system:', error);
        }
    }

    /**
     * Đảm bảo collection tồn tại (chỉ tạo một lần nếu chưa có)
     * Trong Firestore, collections chỉ xuất hiện khi có ít nhất một document
     * Method này tạo một document marker để khởi tạo collection
     * @param {string} userId - User ID
     * @param {string} collectionName - Tên collection (categories hoặc events)
     * @param {boolean} isNewUser - Có phải user mới không
     * @returns {Promise<void>}
     */
    async _ensureCollectionExists(userId, collectionName, isNewUser) {
        try {
            const { collection, getDocs, doc, setDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            // Kiểm tra collection đã có document nào chưa
            const collectionRef = collection(this.db, "users", userId, collectionName);
            const snapshot = await getDocs(collectionRef);

            // Nếu collection chưa có document nào (chưa tồn tại)
            if (snapshot.empty) {
                // Tạo một document marker để khởi tạo collection
                // Document này sẽ đánh dấu collection đã được khởi tạo
                const markerDocRef = doc(collectionRef, '_initialized');
                await setDoc(markerDocRef, {
                    _type: 'collection_initializer',
                    _initialized: true,
                    createdAt: Timestamp.now(),
                    note: `Collection ${collectionName} initialized for user ${userId}`
                });
                console.log(`✅ Collection '${collectionName}' created with initializer document for user:`, userId);
            } else {
                // Kiểm tra xem có document marker không, nếu không có thì tạo
                let hasMarker = false;
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (data._type === 'collection_initializer' || docSnap.id === '_initialized') {
                        hasMarker = true;
                    }
                });

                if (!hasMarker) {
                    // Tạo marker nếu chưa có
                    const markerDocRef = doc(collectionRef, '_initialized');
                    await setDoc(markerDocRef, {
                        _type: 'collection_initializer',
                        _initialized: true,
                        createdAt: Timestamp.now(),
                        note: `Collection ${collectionName} initialized for user ${userId}`
                    });
                    console.log(`✅ Collection '${collectionName}' marker added for user:`, userId);
                } else {
                    console.log(`✅ Collection '${collectionName}' already exists with ${snapshot.size} document(s) for user:`, userId);
                }
            }
        } catch (error) {
            console.error(`❌ Error ensuring collection '${collectionName}' exists:`, error);
        }
    }

    /**
     * Get user-friendly error message
     * @param {string} errorCode - Firebase error code
     * @returns {string} - User-friendly error message
     */
    _getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/invalid-email': 'Invalid email address.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/email-already-in-use': 'This email is already registered.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/operation-not-allowed': 'This sign-in method is not enabled.',
            'auth/popup-closed-by-user': 'Sign-in popup was closed.',
            'auth/cancelled-popup-request': 'Only one popup request is allowed at a time.',
            'auth/popup-blocked': 'Popup was blocked by the browser.',
            'auth/network-request-failed': 'Network error. Please check your connection.'
        };

        return errorMessages[errorCode] || 'An error occurred. Please try again.';
    }
}

