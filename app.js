const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const dotenv = require('dotenv');
const flash = require('connect-flash');
const cors = require('cors'); // Import cors

dotenv.config();

const app = express(); // Initialize the app
const http = require('http');
const socketIo = require('socket.io');

// Use CORS middleware
app.use(cors());

// Body Parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());

// EJS
app.set('view engine', 'ejs');

// Express Session
app.use(session({
    secret: 'SESSION_SECRET',
    resave: false,
    saveUninitialized: false
}));

app.use(flash());
app.use((req, res, next) => {
    res.locals.success_flash = req.flash('success');
    res.locals.error_flash = req.flash('error');
    next();
});

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

// Static Files
app.use(express.static('public'));

// Routes
app.use(require('./routes/index'));
app.use(require('./routes/auth'));
app.use('/', require('./routes/about'));
const contactRoute = require('./routes/contact');
app.use(contactRoute);

// Debugging middleware
app.use((req, res, next) => {
    console.log(`Request URL: ${req.url}`);
    next();
});

// Create HTTP server and integrate Socket.IO
const server = http.createServer(app);
const io = socketIo(server);

// Socket.IO setup
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('sendMessage', ({ chatRoomId, message }) => {
        // Emit the message to all clients in the chat room
        io.emit('newMessage', {
            chatRoomId,
            username, /* Get the sender's username */
            message,
            created_at: new Date()
        });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});
// Start the Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
