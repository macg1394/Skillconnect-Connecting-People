const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const User = require('../models/user');

module.exports = function(passport) {
    // passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    //     // Check user in the database
    //     db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    //         if (err) throw err;
    //         if (results.length === 0) {
    //             return done(null, false, { message: 'No user with that email' });
    //         }
    //         const user = results[0];

    //         // Match password
    //         bcrypt.compare(password, user.password, (err, isMatch) => {
    //             if (err) throw err;
    //             if (isMatch) {
    //                 return done(null, user);
    //             } else {
    //                 return done(null, false, { message: 'Password incorrect' });
    //             }
    //         });
    //     });
    // }));
    passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
        // Fetch user from the database using email
        User.findByEmail(email, (err, user) => {
            if (err) return done(err);
            if (!user) return done(null, false, { message: 'Incorrect email.' });
    
            // Compare passwords using bcrypt
            console.log(user[0].password);
            console.log(password);
            bcrypt.compare(password, user[0].password, (err, isMatch) => {
                if (err) return done(err);
                if (isMatch) return done(null, user);
                return done(null, false, { message: 'Incorrect password.' });
            });
        });
    }));

    // passport.serializeUser((user, done) => {
    //     done(null, user.id);
    // });

    // passport.deserializeUser((id, done) => {
    //     db.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
    //         if (err) throw err;
    //         done(null, results[0]);
    //     });
    // });
    passport.serializeUser((user, done) =>{
        console.log('Serializing user:', user[0]);
        done(null, user[0].user_id);
    });
    
    passport.deserializeUser((id, done) => {
        User.findById(id, (err, user) => done(err, user));
    });
};
