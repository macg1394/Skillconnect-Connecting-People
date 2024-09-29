const express = require('express');
const router = express.Router();
const db = require('../config/database');
router.get('/contact', (req, res) => {
    res.render('contact', { 
        user: req.user,  // Pass the user to the template
        success_flash: req.flash('success'), 
        error_flash: req.flash('error') 
    });
});
router.post('/contact', (req, res) => {
    const { name, email, message } = req.body;
    const query = 'INSERT INTO contact_us (name, email, message) VALUES (?, ?, ?)';
    db.query(query, [name, email, message], (err, result) => {
        if (err) {
            console.error('Error inserting contact message:', err);
            req.flash('error', 'There was an error submitting your message. Please try again later.');
            return res.redirect('/contact');
        }
        req.flash('success', 'Your message has been submitted successfully!');
        res.redirect('/contact');
    });
});

module.exports = router;
