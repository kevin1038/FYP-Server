var assert = require('assert');
var bodyParser = require('body-parser');
var cookieSession = require('cookie-session');
var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var path = require('path');
var app = express();
app.locals.moment = require('moment');

var mongourl = 'mongodb://user:password@ds239638.mlab.com:39638/report';
var dbName = 'report';
//var mongourl = 'mongodb://noctis:123456@ds141434.mlab.com:41434/noctisyeung';
var apikey = '0d8144c5-4df7-4953-b813-f1104fe86dd1';

//The below part is setting up the requirement
app.use(cookieSession({
	name: 'session',
	keys: ['key1', 'key2'],
	maxAge: 30 * 60 * 1000
}));

app.use(function(req,res,next){
	res.locals.session = req.session;
	next();
});

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(bodyParser.json());
app.set('view engine', 'ejs');

/**
 * Route handlers
 */

 app.post('/test' ,  function(req, res, next) {
 	var userInfo = {};
 	var score = {};
 	var datetime = new Date();
 	var clientapi = req.body.api;
 	var currentlevel = req.body.currentlevel;
 	userInfo['username'] = req.body.username;
 	score['date'] = datetime;
 	score['level' + currentlevel] = req.body.levelscore;
 	userInfo['Score'] = score;

 	if (clientapi == apikey){
 		MongoClient.connect(mongourl, function(err, client) {
 			assert.equal(null, err);
 			const db = client.db(dbName);

 			console.log('Connected to MongoDB\n');
 			insertRecord(db,userInfo,function(result){
 				client.close();
 				console.log('/main disconnected to MongoDB\n');
 				res.status(200);
 				res.send("OK")
 			});
 		});
 	}
 	else
 		res.status(402);
 });

 app.get('/', function(req, res) {
 	if (req.session.authenticated) {
 		MongoClient.connect(mongourl, function(err, client) {
 			assert.equal(null, err);
 			const db = client.db(dbName);

 			findRecords(db, {}, function(result) {
 				client.close();
 				res.render('index', {records: result});
 			});
 		});
 	} else
 	res.redirect('/login');
 });

 app.get('/login', function(req, res) {
 	res.render('login');
 });

 app.post('/login', function(req, res) {
 	var user = {};
 	user['userid'] = req.body.userid;
 	user['password'] = req.body.password;

 	MongoClient.connect(mongourl, function(err, client) {
 		assert.equal(null, err);
 		const db = client.db(dbName);

 		findUser(db, user, function(result) {
 			client.close();
 			if (result) {
 				req.session.authenticated = true;
 				req.session._id = result._id;
 				req.session.userid = result.userid;
 				res.redirect('/');
 			} else {
 				res.render('login', {warning: 'Incorrect user ID or password.'});
 			}
 		});
 	});
 });

 app.post('/register', function(req, res) {
 	var user = {};
 	user['userid'] = req.body.userid;
 	user['password'] = req.body.password;

 	MongoClient.connect(mongourl, function(err, client) {
 		assert.equal(null, err);
 		const db = client.db(dbName);

 		insertUser(db, user, function(result) {
 			client.close();
 			if (result)
 				res.render('login', {success: 'Registration complete. Please login.'});
 			else
 				res.render('login', {warning: 'User ID "' + user['userid'] + '" is taken. Try another.'});
 		});
 	});
 });

 app.post('/logout', function(req, res) {
 	req.session = null;
 	res.redirect('/');
 });

 app.post('/report', function(req, res) {
 	if (req.session.authenticated) {
 		var criteria = {};
 		criteria['username'] = req.body.name;

 		MongoClient.connect(mongourl, function(err, client) {
 			assert.equal(null, err);
 			const db = client.db(dbName);

 			findRecords(db, criteria, function(result) {
 				client.close();
 				res.render('report', {records: result});
 			});
 		});
 	} else
 	res.redirect('/');
 });

// Business Functions
function insertRecord(db,new_user,callback){
	db.collection('records').insertOne(new_user,function(err,result){
		assert.equal(null, err);
		console.log('User Created');
		callback(result);
	});
};

function findRecords(db, criteria, callback) {
	var records = [];
	var cursor = db.collection('records').find(criteria);
	
	cursor.each(function(err, result) {
		assert.equal(null, err);
		if (result != null)
			records.push(result);
		else
			callback(records);
	});
}

function findUser(db, user, callback) {
	db.collection('users').findOne(user, function(err, result) {
		assert.equal(null, err);
		callback(result);
	});
}

function insertUser(db, user, callback) {
	db.collection('users').insertOne(user, function(err, result) {
		try {
			assert.equal(null, err);
		} catch (err) {
			console.error('User ID: "' + user['userid'] + '" is taken. Insert user failed.');
		}
		callback(result);
	});
}

app.listen(process.env.PORT || 8099);