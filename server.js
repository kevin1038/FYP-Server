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
	record['short-term memory'] = 0;
	record['recall'] = 0;
	record['self-efficacy'] = 0;
	record['attention'] = 0;

	for (var i in record.Record) {
		record.Record[i]['short-term memory'] = [];
		record.Record[i]['recall'] = [];
		record.Record[i]['self-efficacy'] = [];
		record.Record[i]['attention'] = [];
		for (var j in record.Record[i].isDistractionHappendForCustomer) {
			if (record.Record[i].isDistractionHappendForCustomer[j]) {
				record.Record[i]['attention'][j] = Math.max(0, 50 - 10 * record.Record[i].numOfWrongCounterAfterDistractionHappend[j]
				+ 50 - 10 * record.Record[i].numOfHintsUsedAfterDistractionHappend[j]);
				record.Record[i]['short-term memory'][j] = null;
				record.Record[i]['recall'][j] = null;
				record.Record[i]['self-efficacy'][j] = null;

				record['attention'] += record.Record[i]['attention'][j];
				distCount++;
			} else {
				record.Record[i]['short-term memory'][j] = Math.max(0, 100 - Math.round(record.Record[i].theTimeUsedToServeCustomer[j]));
				record.Record[i]['recall'][j] = Math.max(0, 100 - 20 * record.Record[i].numOfWrongCounterForEachCustomer[j]);
				record.Record[i]['self-efficacy'][j] = Math.max(0, 100 - 20 * record.Record[i].numOfHintsUsedForEachCustomer[j]);
				record.Record[i]['attention'][j] = null;
				
				record['short-term memory'] += record.Record[i]['short-term memory'][j];
				record['recall'] += record.Record[i]['recall'][j];
				record['self-efficacy'] += record.Record[i]['self-efficacy'][j];
				nondistCount++;
			}
		}
	}

	if (nondistCount == 0) {
		record['short-term memory'] = null;
		record['recall'] = null;
		record['self-efficacy'] = null;
	} else {
		record['short-term memory'] = record['short-term memory'] /= nondistCount;
		record['recall'] = record['recall'] /= nondistCount;
		record['self-efficacy'] = record['self-efficacy'] /= nondistCount;
	}

	if (distCount == 0) {
		record['attention'] = null;
	} else {
		record['attention'] = record['attention'] /= distCount;
	}

	MongoClient.connect(mongourl, function (err, client) {
		assert.equal(null, err);
		const db = client.db(dbName);

		console.log('Connected to MongoDB\n');
		insertRecord(db, record, function (result) {
			client.close();
			console.log('/main disconnected to MongoDB\n');
			res.status(200);
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
			findAvg(db, criteria['UserName'], function (avgResult) {
				client.close();
				res.render('report', { records: result, average: avgResult });
			});
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
	db.collection('records').find(criteria).sort({ date: 1 }).toArray(function (err, result) {
		assert.equal(null, err);
		callback(result);
	});
}

function findAvg(db, user, callback) {
	db.collection('records').aggregate([
		{
			$match: { UserName: user }
		},
		{
			$group: {
				_id: '$UserName',
				shortterm: { $avg: '$short-term memory' },
				recall: { $avg: '$recall' },
				selfefficacy: { $avg: '$self-efficacy' },
				attention: { $avg: '$attention' },
			}
		}
	]).toArray(function (err, result) {
		assert.equal(null, err);
		callback(result);
	});
}

function findRecord(db, criteria, callback) {
	db.collection('records').findOne(criteria, function (err, result) {
		assert.equal(null, err);
		callback(result);
	});
}

function distinctUsers(db, callback) {
	db.collection('records').distinct('UserName', function (err, result) {
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