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

  collection.find({user: user, channel: channel, inserttime: {$gte: start, $lt: end} },function(err, rsp) {
    callback( error, rsp || [] );
  });

}


function getAllForWeek() {

}

getCollection();

app.use(bodyParser.urlencoded());

app.get("/", function(req, res, next) {
  return getUserForCurrentWeek('seanc', 'all-over-the-map-chcf', function(err, rsp) {
      var hours = 0,
        checks = 0;
      rsp.forEach(function(d){
        if (d.time !== 'check') {
          hours += d.time;
        } else if (d.time === 'check') {
          checks += 1;
        }
      });

      return res.send(201, util.format("Ok, I've recorded %s for %s.",
                                       hours));
    });

});
app.post("/", function(req, res, next) {
  if (!collection) {
    return res.send(201, "Sorry database is down!");
  }

  if (req.body.text === "") {
    return res.send("To have me track time for you, /track <time>");
  }

  var parts = req.body.text.split(" "),
      who = req.body.user_name,
      channel = req.body.channel_name,
      time = parts.shift(),
      note = parts.join(" ") || '',
      cmd = req.body.command;

  if (!who || !time || !channel) {
    return res.send("Um, I couldn't figure out when you meant.");
  }

  if (time === 'get') {
    return res.send(201, 'Sorry feature not yet implemented.');
  }

  if (time === 'one') time = 1;
  if (time === 'half') time = 0.5;

  var now = moment();

  var insert = {
    user: who,
    time: time,
    channel: channel,
    note: note,
    timestr: now.toISOString(),
    inserttime: +now
  };

  collection.insert(insert, {w:1}, function(err, result) {
    if (err) {
      return next(err);
    }

    return getUserForCurrentWeek(user, channel, function(err, rsp) {
      return res.send(201, util.format("Ok, I've recorded %s for %s.",
                                       time,
                                       channel));
    });



  });

});

app.listen(process.env.PORT || 8080, function() {
  console.log("Listening at http://%s:%d/", this.address().address, this.address().port);
});
