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

function normalizeTime(t) {
  if (t === 'check') return 'check';
  if (t === 'one') return 1;
  if (t === 'half') return 0.5;
  if (!isNaN(t)) return +t;
  return 0;
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

getCollection();

app.use(bodyParser.urlencoded());

app.get("/", function(req, res, next) {
  res.header('link_names' , 1 );
  return getAllForUser('seanc', function(err, result){
    if (err) {
      return res.status(201).send('Error in retrieving current week times.')
    }
    return res.status(201).send(result);
  });

  res.status(201).send('Hi monkey!');
});

app.post("/", function(req, res, next) {
  res.header('link_names' , 1 );

  if (!collection) {
    return res.status(201).send("Sorry database is down!");
  }

  if (req.body.text === "") {
    return res.status(201).send("To have me track time for you, /track <time>");
  }

  var parts = req.body.text.split(" "),
      who = req.body.user_name,
      channel = req.body.channel_name,
      time = parts.shift(),
      note = parts.join(" ") || '',
      cmd = req.body.command;

  if (!who || !time || !channel) {
    return res.status(201).send("Um, I couldn't figure out when you meant.");
  }

  if (time === 'sum') {
    return getAllForUser(who, function(err, result){
      if (err) {
        return res.status(201).send('Error in retrieving current week times.')
      }
      return res.status(201).send(result);
    });
    //return res.status(201).send('Sorry feature not yet implemented.');
  }

  time = normalizeTime(time);

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
      return res.status(201).send(util.format("Sorry, @%s could not write time to database.", who));
      //return next(err);
    }

    getUserForCurrentWeek(who, channel, function(err, result) {
      var hours = 0,
          checks = 0;
      if (err) {
        return res.status(201).send(util.format("Sorry, @%s could not get this week's time for #%s.",
                                                  who,
                                                  channel));
      }

      result = result || [];
      result.forEach(function(d){
        if (d.time !== 'check') {
          var t = +d.time || 0;
          if (isNaN(t)) t = 0;
          hours += t;
        } else {
          checks += 1;
        }
      });

      return res.status(201).send(util.format("Ok, @%s you have recorded %s days for #%s this week.",
                                        who,
                                        hours,
                                        channel));
    });



  });

});

app.listen(process.env.PORT || 8080, function() {
  console.log("Listening at http://%s:%d/", this.address().address, this.address().port);
});
