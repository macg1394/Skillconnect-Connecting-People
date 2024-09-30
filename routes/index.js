const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const db = require('../config/database');
router.use(bodyParser.urlencoded({ extended: true }));
router.get('/search_people', (req, res) => {
    const sql = `
        SELECT u.username, u.email, u.profile_photo AS profile_photo, 
               GROUP_CONCAT(s.skill_name SEPARATOR ', ') AS skills
        FROM users u
        JOIN user_skills us ON u.user_id = us.user_id
        JOIN skills s ON us.skill_id = s.skill_id
        GROUP BY u.user_id, u.username, u.email, u.profile_photo`;

    db.query(sql, [], (err, results) => {
        if (err) {
            console.error('Error fetching people:', err);
            return res.status(500).send('Server error');
        }
        res.render('search_people', { user: req.user, people: results });
    });
});
router.get('/people/search', (req, res) => {
    const searchQuery = req.query.skill || ''; // Get the search query from the request

    const sql = `
        SELECT u.username, u.email, u.profile_photo AS profile_photo, 
               GROUP_CONCAT(s.skill_name SEPARATOR ', ') AS skills
        FROM users u
        JOIN user_skills us ON u.user_id = us.user_id
        JOIN skills s ON us.skill_id = s.skill_id
        WHERE s.skill_name LIKE ?
        GROUP BY u.user_id, u.username, u.email, u.profile_photo`;

    db.query(sql, [`%${searchQuery}%`], (err, results) => {
        if (err) {
            console.error('Error fetching people:', err);
            return res.status(500).send('Server error');
        }

        // Build the HTML to send back to the client
        let html = '';
        if (results.length > 0) {
            results.forEach(person => {
                html += `
                    <div class="person-card">
                        <img src="${person.profile_photo_url || '/images/default_profile_photo.jpg'}" alt="${person.username}">
                        <h3>${person.username}</h3>
                        <p>Skills: ${person.skills}</p>
                        <p>Email: ${person.email}</p>
                    </div>`;
            });
        } else {
            html = '<p>No people found with that skill.</p>';
        }

        res.send(html); // Send the generated HTML back to the client
    });
});

router.get('/search', (req, res) => {
    const query = `
        SELECT 
            showcases.image_url, 
            users.username AS skill_seeker, 
            showcases.title, 
            showcases.description, 
            showcases.created_at, 
            skills.skill_name
        FROM showcases
        JOIN users ON showcases.user_id = users.user_id
        JOIN showcase_skills ON showcases.showcase_id = showcase_skills.showcase_id
        JOIN skills ON showcase_skills.skill_id = skills.skill_id
        ORDER BY showcases.created_at DESC;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching showcases:', err);
            return res.status(500).send('Server error');
        }

        res.render('search', { showcases: results, user: req.user });
    });
});
router.post('/invite', async (req, res) => {
    const { receiverId, postId } = req.body;
    const senderId = req.user.user_id; // Get the sender ID from the session or token

    if (!receiverId || !postId) {
        return res.status(400).json({ error: 'Receiver ID and Post ID are required' });
    }

    try {
        // Check if an invitation already exists for this post by this user
        const existingInvitation = await new Promise((resolve, reject) => {
            db.query(
                'SELECT * FROM invitations WHERE sender_id = ? AND post_id = ?',
                [senderId, postId],
                (error, results) => {
                    if (error) {
                        console.error('Database error:', error);
                        return reject(error);
                    }
                    resolve(results);
                }
            );
        });

        if (existingInvitation.length > 0) {
            return res.status(409).json({ error: 'You have already sent an invitation for this post' });
        }

        // Insert a new invitation
        const result = await new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO invitations (sender_id, receiver_id, post_id, status, created_at) VALUES (?, ?, ?, ?, NOW())',
                [senderId, receiverId, postId, 'pending'],
                (error, results) => {
                    if (error) {
                        console.error('Database error:', error);
                        return reject(error);
                    }
                    resolve(results);
                }
            );
        });

        res.status(201).json({ message: 'Invitation sent', invitationId: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});



// GET /notifications - Fetch user notifications
router.get('/notifications', async (req, res) => {
    const userId = req.user.user_id; // Get the user ID from the session or token

    try {
        const invitations = await new Promise((resolve, reject) => {
            db.query(
                `SELECT i.invitation_id, i.sender_id, s.username AS sender_username, i.receiver_id, 
                        i.status, i.created_at 
                 FROM invitations i 
                 JOIN users s ON i.sender_id = s.user_id 
                 WHERE i.receiver_id = ?`,
                [userId],
                (error, results) => {
                    if (error) {
                        console.error('Database error:', error);
                        return reject(error);
                    }
                    resolve(results);
                }
            );
        });

        res.render('notifications', { user: req.user, invitations });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// POST /invitations/respond - Respond to an invitation
router.post('/invitations/respond', async (req, res) => {
    const { invitationId, response } = req.body;
    const validResponses = ['accepted', 'rejected'];

    if (!validResponses.includes(response)) {
        console.error('Invalid response:', response);
        return res.status(400).json({ error: 'Invalid response' });
    }

    try {
        // Update invitation status
        const updateResult = await new Promise((resolve, reject) => {
            db.query(
                'UPDATE invitations SET status = ? WHERE invitation_id = ?',
                [response, invitationId],
                (error, results) => {
                    if (error) {
                        console.error('Database error:', error);
                        return reject(error);
                    }
                    resolve(results);
                }
            );
        });

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // If accepted, create chat room and notify sender
        if (response === 'accepted') {
            const senderId = await new Promise((resolve, reject) => {
                db.query(
                    'SELECT sender_id FROM invitations WHERE invitation_id = ?',
                    [invitationId],
                    (error, results) => {
                        if (error) {
                            console.error('Database error:', error);
                            return reject(error);
                        }
                        if (results.length === 0) {
                            return reject(new Error('Sender not found'));
                        }
                        resolve(results[0].sender_id);
                    }
                );
            });

            // Check if chat room already exists
            const existingChatRoom = await new Promise((resolve, reject) => {
                db.query(
                    'SELECT * FROM chat_rooms WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
                    [req.user.user_id, senderId, senderId, req.user.user_id],
                    (error, results) => {
                        if (error) {
                            console.error('Database error:', error);
                            return reject(error);
                        }
                        resolve(results.length > 0);
                    }
                );
            });

            if (!existingChatRoom) {
                // Create a new chat room
                await new Promise((resolve, reject) => {
                    db.query(
                        'INSERT INTO chat_rooms (user1_id, user2_id) VALUES (?, ?)',
                        [req.user.user_id, senderId],
                        (error, results) => {
                            if (error) {
                                console.error('Database error:', error);
                                return reject(error);
                            }
                            resolve(results);
                        }
                    );
                });
            }

            // Notify the sender
            await new Promise((resolve, reject) => {
                db.query(
                    'INSERT INTO notifications (user_id, type, content) VALUES (?, ?, ?)',
                    [senderId, 'invitation', 'Your invitation was accepted. Start chatting!'],
                    (error, results) => {
                        if (error) {
                            console.error('Database error:', error);
                            return reject(error);
                        }
                        resolve(results);
                    }
                );
            });
        }

        res.status(200).json({ message: `Invitation ${response}` });
    } catch (error) {
        console.error('Error in /invitations/respond:', error);
        res.status(500).json({ error: 'Failed to respond to invitation' });
    }
});

// Handle GET request to /chat/:chatRoomId
// Helper function to run queries
const queryDatabase = (query, params) => {
    return new Promise((resolve, reject) => {
        db.query(query, params, (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results);
        });
    });
};

//Function to find or create a chat room
const getOrCreateChatRoom = async (user1Id, user2Id) => {
    let chatRoom = await queryDatabase(
        'SELECT chat_room_id FROM chat_rooms WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
        [user1Id, user2Id, user2Id, user1Id]
    );

    if (chatRoom.length === 0) {
        const result = await queryDatabase(
            'INSERT INTO chat_rooms (user1_id, user2_id) VALUES (?, ?)',
            [user1Id, user2Id]
        );
        return result.insertId;
    }

    return chatRoom[0].chat_room_id;
};

// GET /chat/:chatRoomId - Render chat room with messages
router.get('/chat/:chatRoomId', async (req, res) => {
    const chatRoomId = parseInt(req.params.chatRoomId, 10);
    if (isNaN(chatRoomId)) {
        return res.status(400).json({ error: 'Invalid chat room ID' });
    }

    try {
        const messages = await queryDatabase(
            `SELECT m.message_id, m.sender_id, u.username, m.message, m.created_at 
            FROM messages m 
            JOIN users u ON m.sender_id = u.user_id 
            WHERE m.chat_room_id = ? 
            ORDER BY m.created_at ASC`,
            [chatRoomId]
        );

        res.render('chat', { chatRoomId, messages });
    } catch (error) {
        console.error('Error fetching chat room:', error);
        res.status(500).json({ error: 'Failed to fetch chat room messages' });
    }
});

// GET /messages/:chatRoomId - Fetch messages for a chat room
router.get('/messages/:chatRoomId', async (req, res) => {
    const chatRoomId = parseInt(req.params.chatRoomId, 10);
    if (isNaN(chatRoomId)) {
        return res.status(400).json({ error: 'Invalid chat room ID' });
    }

    try {
        const messages = await queryDatabase(
            `SELECT m.message_id, m.sender_id, u.username, m.message, m.created_at 
            FROM messages m 
            JOIN users u ON m.sender_id = u.user_id 
            WHERE m.chat_room_id = ? 
            ORDER BY m.created_at ASC`,
            [chatRoomId]
        );

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// POST /messages - Post a new message
router.post('/messages', async (req, res) => {
    const { chatRoomId, message } = req.body;
    const senderId = req.user.user_id; // Assume user_id is set in req.user by authentication middleware

    if (!chatRoomId || isNaN(parseInt(chatRoomId, 10))) {
        return res.status(400).json({ error: 'Invalid or missing chat room ID' });
    }
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing message text' });
    }

    try {
        // Verify if the chat room exists
        const chatRoom = await queryDatabase(
            'SELECT chat_room_id FROM chat_rooms WHERE chat_room_id = ?',
            [chatRoomId]
        );

        if (chatRoom.length === 0) {
            console.error('Chat room not found with ID:', chatRoomId); // Log chat room ID if not found
            return res.status(404).json({ error: 'Chat room not found' });
        }

        await queryDatabase(
            'INSERT INTO messages (chat_room_id, sender_id, message) VALUES (?, ?, ?)',
            [chatRoomId, senderId, message.trim()]
        );

        res.status(201).json({ message: 'Message sent' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// POST /start-chat - Initiate a chat with the post owner
router.post('/start-chat', async (req, res) => {
    const { postOwnerId } = req.body;
    const loggedInUserId = req.user.user_id; // Assume user_id is set in req.user by authentication middleware

    if (!postOwnerId || isNaN(parseInt(postOwnerId, 10))) {
        return res.status(400).json({ error: 'Invalid or missing post owner ID' });
    }

    try {
        const chatRoomId = await getOrCreateChatRoom(loggedInUserId, postOwnerId);
        res.json({ chatRoomId });
    } catch (error) {
        console.error('Error starting chat:', error);
        res.status(500).json({ error: 'Failed to start chat' });
    }
});
module.exports = router;