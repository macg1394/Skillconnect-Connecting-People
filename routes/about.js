const express = require('express');
const router = express.Router();
const db = require('../config/database');
router.get('/about', (req, res) => {
    db.query('SELECT * FROM team_members', (err, results) => {
        if (err) throw err;
        res.render('about', { team_members: results,user: req.user });
    });
});
router.get('/services', (req, res) => {
    res.render('services', {user: req.user });
});
router.get('/privacy', (req, res) => {
    res.render('privacy_policy', { user: req.user }); // Pass the user object if needed
});
module.exports = router;
