"use strict";

var util = require("util");

var bodyParser = require("body-parser"),
    env = require("require-env"),
    express = require("express"),
    moment = require("moment"),
    request = require("request"),
    tz = require("moment-timezone");

var app = express(),
    client = require('mongodb').MongoClient, // mongo client
    collection = null;

var MONGO_COLLECTION = "time-tracking",
    MONGO_URL = env.require("MONGOHQ_URL"),
    MONGO_USER = "",
    MONGO_PWD = "",
    SLACK_TOKEN = env.require("SLACK_TOKEN"),
    TZ = "America/Los_Angeles", // TODO look this up per user
    TZ_OFFSET = tz.tz(TZ)._offset;

moment.lang("en-custom", {
  longDateFormat : {
    LT: "h:mma"
  }
});

function getCollection(callback) {
  client.connect(MONGO_URL, function(err, db) {
    if (err) {
      console.log('Error: ', error);
      return;
    }
    db.createCollection(MONGO_COLLECTION, function(err, result) {
      if(err) {
        console.log('Error: ', error);
      }
      collection = result;
      if (typeof callback === 'function') callback();
    });
  });
}

function normalizeTime(t) {
  if (t === 'check') return 'check';
  if (t === 'one') return 1;
  if (t === 'half') return 0.5;
  if (!isNaN(t)) return +t;
  return 0;
}

function getUserForCurrentWeek(user, channel, callback) {
  var start = +moment().startOf('week'),
      end = +moment().endOf('week');

  collection.find({user: user, channel: channel, inserttime: {$gte: start, $lt: end} }).toArray(function(err, items) {
    var days = 0,
        checks = 0,
        msg = '';
    if (err) {
      return callback(err, null);
    }

    items = items || [];
    items.forEach(function(d){
      if (d.time !== 'check') {
        var t = +d.time || 0;
        if (isNaN(t)) t = 0;
        days += t;
      } else {
        checks += 1;
      }
    });

    msg = util.format("Ok, @%s you have %s days & %s checks for #%s this week.",
                                      user,
                                      days,
                                      checks,
                                      channel);
    callback(null, msg);
  });

}

function getAllForUser(user, callback) {
  var start = +moment().startOf('week'),
      end = +moment().endOf('week');

  collection.find({user: user, inserttime: {$gte: start, $lt: end} }).toArray(function(err, items) {
    if (err) return callback(err, null);

    var times = {};
    items = items || [];

    items.forEach(function(item){
      if (!times.hasOwnProperty(item.channel)) times[item.channel] = {days:0, checks: 0, notes: []};
      if (item.time === 'check') {
        times[item.channel].checks += 1;
      } else {
        times[item.channel].days += +item.time;
      }

      times[item.channel].notes.push(item.note);
    });

    var output = "";
    for (var channel in times) {

      output += "*#" + channel + ":* " + times[channel].days + " days, " + times[channel].checks + " checks\n";
    }

    callback( null, output );
  });
}

// get mongo collection
getCollection();

// TODO: Fix "body-parser deprecated"
app.use(bodyParser.urlencoded());

app.post("/", function(req, res, next) {
  res.header('link_names' , 1 );

  // TODO: better handling
  if (!collection) {
    return res.status(201).send("Sorry database is down!");
  }

  // invalid request
  if (req.body.text === "") {
    return res.status(201).send("To have me track time for you, /track <time>");
  }

  // parse request
  var parts = req.body.text.split(" "),
      who = req.body.user_name,
      channel = req.body.channel_name,
      time = parts.shift(),
      note = parts.join(" ") || '',
      cmd = req.body.command;

  // invalid arguments
  if (!who || !time || !channel) {
    return res.status(201).send("Um, I couldn't figure out when you meant.");
  }

  // get all times for a user and return
  if (time === 'sum') {
    return getAllForUser(who, function(err, result){
      if (err) {
        return res.status(201).send('Error in retrieving current week times.');
      }
      return res.status(201).send(result);
    });
  }

  // normalize incoming time
  time = normalizeTime(time);

  // get current time
  var now = moment();

  // create insert object for mongo
  var insert = {
    user: who,
    time: time,
    channel: channel,
    note: note,
    timestr: now.toISOString(),
    inserttime: +now
  };

  // insert record & return time total
  // for that user and channel
  collection.insert(insert, {w:1}, function(err, result) {
    if (err) {
      return res.status(201).send(util.format("Sorry, @%s could not write time to database.", who));
      //return next(err);
    }

    getUserForCurrentWeek(who, channel, function(err, result) {
      if (err) {
        var msg = util.format("Sorry, @%s could not get this week's time for #%s.",
                                                        who,
                                                        channel);
        return res.status(201).send(msg);
      }

      return res.status(201).send(result);
    });



  });

});

// start app
app.listen(process.env.PORT || 8080, function() {
  console.log("Listening at http://%s:%d/", this.address().address, this.address().port);
});
