const db = require('../config/database');

const User = {
    create: (userData, callback) => {
        const { username, email, password } = userData;
        const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
        db.query(sql, [username, email, password], callback);
    },
    findByEmail: (email, callback) => {
        const sql = 'SELECT * FROM users WHERE email = ?';
        db.query(sql, [email], callback);
    },
    findById: (id, callback) => {
        // Use `user_id` instead of `id`
        const sql = 'SELECT * FROM users WHERE user_id = ?';
        db.query(sql, [id], (err, results) => {
            if (err) return callback(err, null);
            return callback(null, results[0]); // Return the first matching user
        });
    }
};

module.exports = User;
