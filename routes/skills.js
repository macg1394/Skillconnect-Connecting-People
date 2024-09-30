const express = require('express');
const router = express.Router();
const db = require('../config/database');
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
    module.exports = router;