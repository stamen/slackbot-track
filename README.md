# slackbot-track

Slack time tracker

Use slack to record your time on projects

E.g.:

```
/track one

slackbot: Ok, [user] you have 2 days & 0 checks for [channel] this week.
```

#### Available arguments:
* `1-9`: add value to total days
* `one`: adds 1 day to total
* `half`: adds 0.5 day to total
* `check`: will add a check mark,
* `sum`: summarizes a user's time for the week

#### Not implemented:
* `start`: will start a timer for current project.  Calling it will also stop any other timers.
* `stop`: will stop timer for project
