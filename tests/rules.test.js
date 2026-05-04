const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { describe, it, before, after } = require('mocha');

let testEnv;

describe('MThread Security Rules', () => {
    before(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: 'demo-mthread-test',
            firestore: {
                rules: readFileSync('firestore.rules', 'utf8'),
            },
        });
    });

    after(async () => {
        await testEnv.cleanup();
    });

    describe('Users Collection', () => {
        it('should allow anyone to read users', async () => {
            const unauthedDb = testEnv.unauthenticatedContext().firestore();
            await assertSucceeds(unauthedDb.collection('users').doc('user1').get());
        });

        it('should allow user to write to their own profile', async () => {
            const aliceDb = testEnv.authenticatedContext('alice').firestore();
            await assertSucceeds(aliceDb.collection('users').doc('alice').set({ username: 'Alice' }));
        });

        it('should NOT allow user to write to another profile', async () => {
            const bobDb = testEnv.authenticatedContext('bob').firestore();
            await assertFails(bobDb.collection('users').doc('alice').set({ username: 'Hacked' }));
        });
    });

    describe('Chats and Schema Enforcement', () => {
        it('should NOT allow reading a chat if not a participant', async () => {
            // Setup a chat with alice and bob
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection('chats').doc('chat1').set({ participants: ['alice', 'bob'] });
            });

            const eveDb = testEnv.authenticatedContext('eve').firestore();
            await assertFails(eveDb.collection('chats').doc('chat1').get());
        });

        it('should allow reading a chat if participant', async () => {
            const aliceDb = testEnv.authenticatedContext('alice').firestore();
            await assertSucceeds(aliceDb.collection('chats').doc('chat1').get());
        });

        it('should FAIL when creating a message that exceeds size limits', async () => {
            const aliceDb = testEnv.authenticatedContext('alice').firestore();
            const hugeText = 'A'.repeat(3000);
            
            await assertFails(aliceDb.collection('chats').doc('chat1').collection('messages').add({
                text: hugeText,
                userId: 'alice',
                userName: 'Alice',
                timestamp: new Date(),
                read: false,
                edited: false
            }));
        });

        it('should FAIL when writing unexpected fields (Schema violation)', async () => {
            const aliceDb = testEnv.authenticatedContext('alice').firestore();
            
            await assertFails(aliceDb.collection('chats').doc('chat1').collection('messages').add({
                text: 'Hello',
                userId: 'alice',
                userName: 'Alice',
                timestamp: new Date(),
                read: false,
                edited: false,
                isAdmin: true // Unexpected field
            }));
        });

        it('should ALLOW valid messages', async () => {
            const aliceDb = testEnv.authenticatedContext('alice').firestore();
            
            await assertSucceeds(aliceDb.collection('chats').doc('chat1').collection('messages').add({
                text: 'Hello',
                userId: 'alice',
                userName: 'Alice',
                timestamp: new Date(),
                read: false,
                edited: false
            }));
        });
    });
});
