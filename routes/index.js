const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const multer = require('multer');  // Add multer for handling file uploads
const path = require('path');
const db = require('../config/database');
const fs = require('fs');
router.use('/uploads', express.static(path.join(__dirname, 'uploads')));
router.use('/uploads', express.static('uploads'));

// Configure storage for multer
const storage = multer.diskStorage({
    destination: './uploads/',  // Directory where files will be saved
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));  // Create a unique filename
    }
});

const upload = multer({ storage: storage });  // Initialize multer with the storage configuration

router.use(bodyParser.urlencoded({ extended: true }));

// Render the 'index' page
router.get('/', (req, res) => {
        res.render('index', { user: req.user });
    
});

// Render the 'search_people' page
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

        // Render the EJS template with the initial people data
        res.render('search_people', { user: req.user, people: results });
    });
});

// AJAX route for fetching filtered people based on skill
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


// Render the 'add_showcase' page
router.get('/add_showcase', (req, res) => {
    res.render('add_showcase',{ user: req.user });
});

router.post('/upload_profile_photo', upload.single('profile_photo'), (req, res) => {
    const userId = req.user.user_id; // Assuming user is authenticated and user data is available
    console.log(req.file);
    const photoPath = path.join('/uploads', req.file.filename);
    
    // Update user profile photo in the database
    db.query('UPDATE users SET profile_photo = ? WHERE user_id = ?', [photoPath, userId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error updating profile photo');
        }
        res.redirect('/profile'); // Redirect to profile page after update
    });
});

router.post('/update_profile', (req, res) => {
    const { username, availability } = req.body;
    console.log("newwa");
    if (!username || !availability) {
        return res.status(400).json({ success: false, message: 'Username and availability cannot be null' });
    }

    const sql = 'UPDATE users SET username = ?, availability = ? WHERE user_id = ?';
    db.query(sql, [username, availability, req.user.user_id], (err, result) => {
        if (err) {
            console.error('Error updating profile:', err);
            return res.status(500).json({ success: false, message: 'Database update failed' });
        }
        res.json({ success: true });
    });
});
router.post('/delete_showcase', (req, res) => {
    const { showcaseId } = req.body;
    const userId = req.user.user_id; // Assume this is obtained from your authentication middleware

    // Fetch the current showcase image path from the database
    const fetchShowcaseSql = 'SELECT image_url FROM showcases WHERE showcase_id = ? AND user_id = ?';
    db.query(fetchShowcaseSql, [showcaseId, userId], (err, results) => {
        if (err) {
            console.error('Error fetching showcase image:', err);
            return res.json({ success: false, message: 'Failed to fetch showcase image' });
        }

        const imagePath = results[0]?.image_url;
        if (imagePath) {
            fs.unlink(path.join(__dirname, '..', imagePath), (err) => {
                if (err) {
                    console.error('Error deleting the showcase image:', err);
                    return res.json({ success: false, message: 'Failed to delete showcase image' });
                }
            });
            const updateImageUrlSql = 'UPDATE showcases SET image_url = NULL WHERE showcase_id = ?';
                db.query(updateImageUrlSql, [showcaseId], (err) => {
                    if (err) {
                        console.error('Error setting image URL to NULL:', err);
                        return res.status(500).json({ success: false, message: 'Error setting image URL to NULL.' });
                    }
         });
        }

        // Delete the image from the file system
        

            // Delete from showcase_skills table first
            const deleteSkillsSql = 'DELETE FROM showcase_skills WHERE showcase_id = ?';
            db.query(deleteSkillsSql, [showcaseId], (err) => {
                if (err) {
                    console.error('Error deleting showcase skills:', err);
                    return res.status(500).json({ success: false, message: 'Error deleting showcase skills.' });
                }

                // Then delete the showcase record
                const deleteShowcaseSql = 'DELETE FROM showcases WHERE showcase_id = ?';
                db.query(deleteShowcaseSql, [showcaseId], (err, result) => {
                    if (err) {
                        console.error('Error deleting showcase record:', err);
                        return res.status(500).json({ success: false, message: 'Error deleting showcase record.' });
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({ success: false, message: 'Showcase not found.' });
                    }

                    res.json({ success: true, message: 'Showcase and image deleted successfully.' });
                });
            });
        });
    });

router.post('/delete_profile_photo', (req, res) => {
    const userId = req.user.user_id; // Assume this is obtained from your authentication middleware

    // Fetch the current profile photo path from the database
    const fetchPhotoSql = 'SELECT profile_photo FROM users WHERE user_id = ?';
    db.query(fetchPhotoSql, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching profile photo:', err);
            return res.json({ success: false, message: 'Failed to fetch profile photo' });
        }

        const photoPath = results[0]?.profile_photo;
        if (!photoPath) {
            return res.json({ success: false, message: 'No profile photo found to delete' });
        }

        // Delete the photo from the file system
        fs.unlink(path.join(__dirname, '..', photoPath), (err) => {
            if (err) {
                console.error('Error deleting the photo:', err);
                return res.json({ success: false, message: 'Failed to delete photo' });
            }

            // Update the database to set profile photo to NULL or a default value
            const updatePhotoSql = 'UPDATE users SET profile_photo = NULL WHERE user_id = ?';
            db.query(updatePhotoSql, [userId], (err) => {
                if (err) {
                    console.error('Error updating database after deleting photo:', err);
                    return res.json({ success: false, message: 'Failed to update database after deleting photo' });
                }

                res.json({ success: true, message: 'Profile photo deleted successfully' });
            });
        });
    });
});


// Render the 'post' page
router.get('/post', (req, res) => {
    const searchTerm = req.query.q || ''; // Get the search term from query
    const userId = req.user.user_id; // Get the user ID from the session or token

    // SQL query to fetch posts with optional search filter and invitation status
    const query = `
        SELECT 
            posts.post_id,
            posts.title, 
            posts.content, 
            posts.created_at, 
            users.user_id,       -- Include user_id here
            users.username AS poster, 
            users.profile_photo, 
            GROUP_CONCAT(skills.skill_name) AS skills,
            (SELECT status FROM invitations WHERE sender_id = ? AND post_id = posts.post_id LIMIT 1) AS invitation_status
        FROM posts
        JOIN users ON posts.user_id = users.user_id
        LEFT JOIN post_skills ON posts.post_id = post_skills.post_id
        LEFT JOIN skills ON post_skills.skill_id = skills.skill_id
        WHERE posts.title LIKE ? OR skills.skill_name LIKE ?
        GROUP BY posts.post_id
        ORDER BY posts.created_at DESC;
    `;

    db.query(query, [userId, `%${searchTerm}%`, `%${searchTerm}%`], (err, results) => {
        if (err) {
            console.error('Error fetching posts:', err);
            return res.status(500).send('Server error');
        }

        // Render the 'post' view with posts and searchTerm
        res.render('post', { posts: results, searchTerm: searchTerm, user: req.user });
    });
});


// Render the 'profile' page
router.get('/profile', (req, res) => {
    const user = req.user; 
        // Fetch skills for this user
        db.query('SELECT s.skill_id, s.skill_name FROM skills s JOIN user_skills us ON s.skill_id = us.skill_id WHERE us.user_id = ?', [user.user_id], (err, skillResults) => {
            if (err) throw err;
        
            const skills = skillResults;
        
            // Query to get showcases for the user
            db.query('SELECT showcase_id, title, description, image_url, created_at FROM showcases WHERE user_id = ?', [user.user_id], (err, showcaseResults) => {
                if (err) throw err;
        
                const showcases = showcaseResults;
                db.query('SELECT post_id, title, content, created_at FROM posts WHERE user_id = ?', [user.user_id], (err, postResults) => {
                    if (err) throw err;
            
                    const posts = postResults;
            
                    // Render profile page with user, skills, and showcases data
                    res.render('profile', { user, skills, showcases, posts });
                });
            });
        });
});

router.post('/add_showcase', upload.single('image'), (req, res) => {
    const { title, description, skills } = req.body;
    const userId = req.user.user_id; 
    const imagePath = path.join('/uploads', req.file.filename);

    const sql = 'INSERT INTO showcases (user_id, title, description, image_url) VALUES (?, ?, ?, ?)';
    db.query(sql, [userId, title, description, imagePath], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false });
        }

        const showcaseId = results.insertId;

        // Insert skills associated with the showcase
        if (skills.length > 0) {
            const skillSql = 'INSERT INTO showcase_skills (showcase_id, skill_id) VALUES ?';
            const skillValues = JSON.parse(skills).map(skill => [showcaseId, skill]);

            db.query(skillSql, [skillValues], (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ success: false });
                }

                res.json({ success: true, showcase: { title, description, image_url: `/uploads/${imagePath}` } });
            });
        } else {
            res.json({ success: true, showcase: { title, description, image_url: `/uploads/${imagePath}` } });
        }
    });
});
router.get('/skills', (req, res) => {
    db.query('SELECT * FROM skills', (err, results) => {
        if (err) throw err;
        res.json({ skills: results });
    });
});
router.post('/update_skills', (req, res) => {
    const userId = req.user.user_id; // Get the user ID from session or authentication
    const { selectedSkills } = req.body;
        // Insert the new selected skills
        const values = selectedSkills.map(skillId => [userId, skillId]);

        db.query('INSERT INTO user_skills (user_id, skill_id) VALUES ?', [values], (err) => {
            if (err) throw err;
            res.json({ success: true });
        });
    });
router.post('/remove_skill', (req, res) => {
    const userId = req.user.user_id; // Get the user ID from session or authentication
    const { skillId } = req.body;

    db.query('DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?', [userId, skillId], (err) => {
        if (err) throw err;
        res.json({ success: true });
    });
});
router.post('/add_post', (req, res) => {
    const { title, content, skills } = req.body;
    const userId = req.user.user_id; // Assume this is obtained from your authentication middleware

    // Insert the new post into the database
    const sql = 'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)';
    db.query(sql, [userId, title, content], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Error adding post.' });
        }

        const postId = results.insertId;

        // Insert skills associated with the post
        if (skills.length > 0) {
            const skillSql = 'INSERT INTO post_skills (post_id, skill_id) VALUES ?';
            const skillValues = JSON.parse(skills).map(skill => [postId, skill]);

            db.query(skillSql, [skillValues], (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ success: false, message: 'Error associating skills with post.' });
                }

                res.json({ success: true, post: { title, content, skills } });
            });
        } else {
            res.json({ success: true, post: { title, content, skills: [] } });
        }
    });
});
router.post('/delete_post', (req, res) => {
    const { postId } = req.body;
    const userId = req.user.user_id; // Assume this is obtained from your authentication middleware

    // Delete associated skills first
    const deleteSkillsSql = 'DELETE FROM post_skills WHERE post_id = ?';
    db.query(deleteSkillsSql, [postId], (err) => {
        if (err) {
            console.error('Error deleting post skills:', err);
            return res.status(500).json({ success: false, message: 'Error deleting post skills.' });
        }

        // Then delete the post
        const deletePostSql = 'DELETE FROM posts WHERE post_id = ? AND user_id = ?';
        db.query(deletePostSql, [postId, userId], (err, result) => {
            if (err) {
                console.error('Error deleting post:', err);
                return res.status(500).json({ success: false, message: 'Error deleting post.' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Post not found.' });
            }

            res.json({ success: true, message: 'Post deleted successfully.' });
        });
    });
});

// Render the 'search' page
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

// Route to render the privacy policy page
router.get('/privacy', (req, res) => {
    res.render('privacy_policy', { user: req.user }); // Pass the user object if needed
});



// POST /invite - Send an invitation
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