const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'Localskillz'
});

connection.connect(err => {
    if (err) throw err;
    console.log('Database connected!');
});

module.exports = connection;
