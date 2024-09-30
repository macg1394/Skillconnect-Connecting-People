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
router.get('/add_showcase', (req, res) => {
    res.render('add_showcase',{ user: req.user });
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
router.post('/delete_showcase', (req, res) => {
    const { showcaseId } = req.body;
    const userId = req.user.user_id; // Assume this is obtained from your authentication middleware
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
            const deleteSkillsSql = 'DELETE FROM showcase_skills WHERE showcase_id = ?';
            db.query(deleteSkillsSql, [showcaseId], (err) => {
                if (err) {
                    console.error('Error deleting showcase skills:', err);
                    return res.status(500).json({ success: false, message: 'Error deleting showcase skills.' });
                }
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
    module.exports = router;