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
var apikey = '0d8144c5-4df7-4953-b813-f1104fe86dd1';

//The below part is setting up the requirement
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

app.use(cookieSession({
	name: 'session',
	keys: ['key1', 'key2'],
	maxAge: 30 * 60 * 1000
}));

app.use(function (req, res, next) {
	res.locals.session = req.session;
	next();
});

function auth(req, res, next) {
	if (req.session.authenticated)
		next();
	else
		res.redirect('/login');
}

app.post('/test', function (req, res, next) {
	var distCount = nondistCount = 0;

	record = req.body;
	record['date'] = new Date();
	record['short-term memory'] = record['recall'] = record['self-efficacy'] = record['attention'] = 0;

	for (var i in record.Record) {
		for (var j in record.Record[i].theTimeUsedToServeCustomer) {
			if (record.Record[i].isDistractionHappendForCustomer[j]) {
				record['attention'] += 50 - 10 * record.Record[i].numOfWrongCounterAfterDistractionHappend[j]
					+ 50 - 10 * record.Record[i].numOfHintsUsedAfterDistractionHappend[j];
				distCount++;
			} else {
				record['short-term memory'] += 100 - Math.round(record.Record[i].theTimeUsedToServeCustomer[j]);
				record['recall'] += 100 - 20 * record.Record[i].numOfWrongCounterForEachCustomer[j];
				record['self-efficacy'] += 100 - 20 * record.Record[i].numOfHintsUsedForEachCustomer[j];
				nondistCount++;
			}
		}
	}

	record['short-term memory'] = Math.max(0, record['short-term memory'] /= nondistCount);
	record['recall'] = Math.max(0, record['recall'] /= nondistCount);
	record['self-efficacy'] = Math.max(0, record['self-efficacy'] /= nondistCount);
	record['attention'] = Math.max(0, record['attention'] /= distCount);

	MongoClient.connect(mongourl, function (err, client) {
		assert.equal(null, err);
		const db = client.db(dbName);
		
		console.log('Connected to MongoDB\n');
		insertRecord(db, record, function (result) {
			client.close();
			console.log('/main disconnected to MongoDB\n');
			res.status(200);
			res.send("OK")
		});
	});
});

app.get('/', auth, function (req, res) {
	MongoClient.connect(mongourl, function (err, client) {
		assert.equal(null, err);
		const db = client.db(dbName);

		distinctUsers(db, function (result) {
			client.close();
			res.render('index', { users: result });
		});
	});
});

app.post('/report', auth, function (req, res) {
	var criteria = {};
	criteria['UserName'] = req.body.username;

	MongoClient.connect(mongourl, function (err, client) {
		assert.equal(null, err);
		const db = client.db(dbName);

		findRecords(db, criteria, function (result) {
			client.close();
			res.render('report', { records: result });
		});
	});
});

app.post('/reportByDate', auth, function (req, res) {
	var criteria = {};
	criteria['_id'] = new ObjectID(req.body.id);

	MongoClient.connect(mongourl, function (err, client) {
		assert.equal(null, err);
		const db = client.db(dbName);

		findRecord(db, criteria, function (result) {
			client.close();
			res.render('reportByDate', { record: result });
		});
	});
});

app.get('/login', function (req, res) {
	if (req.session.authenticated)
		res.redirect('/');
	else
		res.render('login');
});

app.post('/login', function (req, res) {
	var user = {};
	user['userid'] = req.body.userid;
	user['password'] = req.body.password;

	MongoClient.connect(mongourl, function (err, client) {
		assert.equal(null, err);
		const db = client.db(dbName);

		findUser(db, user, function (result) {
			client.close();
			if (result) {
				req.session.authenticated = true;
				req.session.userid = result.userid;
				res.redirect('/');
			} else {
				res.render('login', { warning: 'Incorrect user ID or password.' });
			}
		});
	});
});

app.post('/register', function (req, res) {
	var user = {};
	user['userid'] = req.body.userid;
	user['password'] = req.body.password;

	MongoClient.connect(mongourl, function (err, client) {
		assert.equal(null, err);
		const db = client.db(dbName);

		insertUser(db, user, function (result) {
			client.close();
			if (result)
				res.render('login', { success: 'Registration complete. Please login.' });
			else
				res.render('login', { warning: 'User ID "' + user['userid'] + '" is taken. Try another.' });
		});
	});
});

app.post('/logout', function (req, res) {
	req.session = null;
	res.redirect('/login');
});

function insertRecord(db, record, callback) {
	db.collection('records').insertOne(record, function (err, result) {
		assert.equal(null, err);
		callback(result);
	});
};

function findRecords(db, criteria, callback) {
	var records = [];
	var cursor = db.collection('records').find(criteria).sort({ date: 1 });

	cursor.each(function (err, result) {
		assert.equal(null, err);
		if (result != null)
			records.push(result);
		else
			callback(records);
	});
}

function findRecord(db, criteria, callback) {
	db.collection('records').findOne(criteria, function (err, result) {
		assert.equal(null, err);
		callback(result);
	});
}

function distinctUsers(db, callback) {
	db.collection('records').distinct("UserName", function (err, result) {
		assert.equal(null, err);
		callback(result);
	});
}

function findUser(db, user, callback) {
	db.collection('users').findOne(user, function (err, result) {
		assert.equal(null, err);
		callback(result);
	});
}

function insertUser(db, user, callback) {
	db.collection('users').insertOne(user, function (err, result) {
		try {
			assert.equal(null, err);
		} catch (err) {
			console.error('User ID: "' + user['userid'] + '" is taken. Insert user failed.');
		}
		callback(result);
	});
}

app.listen(process.env.PORT || 8099);