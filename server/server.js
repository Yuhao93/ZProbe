const express = require('express');
const bodyParser = require('body-parser');
const parseGcode = require('./parse_gcode.js');
const modifyGcode = require('./modify_gcode.js');

const app = express();
app.use(express.json({limit: '10mb'}));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req, res) => {
  res.sendFile('/client/index.html', { root : __dirname});
});
app.get('/script.js', (req, res) => {
  res.sendFile('/client/script.js', { root : __dirname});
});
app.get('/styles.css', (req, res) => {
  res.sendFile('/client/styles.css', { root : __dirname});
});

app.post('/parseGcode', (req, res) => {
  parseGcode(req, res);
});

app.post('/modifyGcode', (req, res) => {
  modifyGcode(req, res);
});

app.listen(process.env.PORT || 5000);
