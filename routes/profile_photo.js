const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');  // Add multer for handling file uploads
const path = require('path');
const fs = require('fs');
router.use('/uploads', express.static(path.join(__dirname, 'uploads')));
router.use('/uploads', express.static('uploads'));
const storage = multer.diskStorage({
    destination: './uploads/',  // Directory where files will be saved
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));  // Create a unique filename
    }
});

const upload = multer({ storage: storage });
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
        res.redirect('/my_profile'); // Redirect to profile page after update
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
module.exports = router;