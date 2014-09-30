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
    db.createCollection(MONGO_COLLECTION, function(err, collection_) {
      if(err) {
        console.log('Error: ', error);
      }
      console.log('::::::: collection is created....')
      collection = collection_;
      if (typeof callback === 'function') callback();
    });
  });
}

function getUserForCurrentWeek(user, channel, callback) {
  var start = +moment().startOf('week'),
      end = +moment().endOf('week');

  collection.find({user: user, channel: channel, inserttime: {$gte: start, $lt: end} }).toArray(function(err, items) {
    callback( err, items || [] );
  });

}


function getAllForWeek() {

}

getCollection();

app.use(bodyParser.urlencoded());

app.get("/", function(req, res, next) {
  var now = moment();
  var user = 'seanc',
      channel = 'all-over-the-map-chcf';

  var insert = {
    user: user,
    time: 1,
    channel: channel,
    note: '',
    timestr: now.toISOString(),
    inserttime: +now
  };
  collection.insert(insert, {w:1}, function(err, result) {
    if (err) {
      return next(err);
    }

    getUserForCurrentWeek(user, channel, function(err, rsp) {
      var hours = 0,
        checks = 0;
      rsp.forEach(function(d){
        if (d.time !== 'check') {
          hours += +d.time;
        } else if (d.time === 'check') {
          checks += 1;
        }
      });

      return res.status(201).send(util.format("Ok, @%s you have recorded %s days for #%s this week.",
                                      user,
                                       hours,
                                       channel));
    });
  });

});
app.post("/", function(req, res, next) {
  if (!collection) {
    return rsp.status(201).send("Sorry database is down!");
  }

  if (req.body.text === "") {
    return rsp.status(201).send("To have me track time for you, /track <time>");
  }

  var parts = req.body.text.split(" "),
      who = req.body.user_name,
      channel = req.body.channel_name,
      time = parts.shift(),
      note = parts.join(" ") || '',
      cmd = req.body.command;

  if (!who || !time || !channel) {
    return rsp.status(201).send("Um, I couldn't figure out when you meant.");
  }

  if (time === 'get') {
    return rsp.status(201).send('Sorry feature not yet implemented.');
  }

  if (time === 'one') {
    time = 1;
  } else if (time === 'half') {
    time = 0.5;
  } else if (!isNaN(time)) {
    time = +time;
  } else {
    time = 0;
  }

  var now = moment();

  var insert = {
    user: who,
    time: time,
    channel: channel,
    note: note,
    timestr: now.toISOString(),
    inserttime: +now
  };

  collection.insert(insert, {w:1}, function(err, rsp) {
    if (err) {
      return rsp.status(201).send(util.format("Sorry, @%s could not write time to database.", who));
      //return next(err);
    }

    getUserForCurrentWeek(who, channel, function(err, rsp) {
      var hours = 0,
          checks = 0;
      if (err) {
        return rsp.status(201).send(util.format("Sorry, @%s could not get this week's time for #%s.",
                                                  who,
                                                  channel));
      }

      rsp = rsp || [];
      rsp.forEach(function(d){
        if (d.time !== 'check') {
          var t = +d.time || 0;
          if (isNaN(t)) t = 0;
          hours += t;
        } else {
          checks += 1;
        }
      });

      return rsp.status(201).send(util.format("Ok, @%s you have recorded %s days for #%s this week.",
                                        who,
                                        hours,
                                        channel));
    });



  });

});

app.listen(process.env.PORT || 8080, function() {
  console.log("Listening at http://%s:%d/", this.address().address, this.address().port);
});
