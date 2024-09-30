const express = require('express');
const passport = require('passport');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const User = require('../models/user');

const router = express.Router();
router.use(bodyParser.urlencoded({ extended: true }));

router.get('/login', (req, res) => res.render('login'));
router.get('/register', (req, res) => res.render('register'));
router.post('/register', (req, res) => {
    const { username, email, password, city, locality, latitude, longitude } = req.body;
        bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).send('Server error');
        }
        User.create({ username, email, password: hash, city, locality, latitude, longitude }, (err, result) => {
            if (err) {
                console.error('Error inserting user:', err);
                return res.status(500).send('Server error');
            }
            res.redirect('/login');
        });
    });
});
router.post('/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    })(req, res, next);
});
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

module.exports = router;