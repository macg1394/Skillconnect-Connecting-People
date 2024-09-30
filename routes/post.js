const express = require('express');
const router = express.Router();
const db = require('../config/database');
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
module.exports = router;