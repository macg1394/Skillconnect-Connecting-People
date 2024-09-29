const express = require('express');
const router = express.Router();

// Route for the About Us page
router.get('/about', (req, res) => {
    console.log('About Us route accessed');  // Debug log
    const teamMembers = [
        { name: 'Mansi', role: 'Founder', image: '/images/default_profile_photo.jpg' },
        { name: 'Kritika', role: 'co-Founder', image: '/images/default_profile_photo.jpg' }
    ];
    res.render('about', { teamMembers, user: req.user });
});

module.exports = router;
