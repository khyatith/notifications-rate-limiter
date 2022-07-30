const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const redis = require('ioredis');
const redisClient = redis.createClient({
  port: process.env.REDIS_PORT || 6379,
  host: process.env.REDIS_HOST || 'localhost',
})
redisClient.on('connect', function () {
  console.log('connected');
});

const WINDOW_SIZE_IN_HOURS = 24;
const MAX_WINDOW_REQUEST_COUNT = 20;
const WINDOW_LOG_INTERVAL_IN_HOURS = 1;

// helper functions

const getIsUserOverLimit = (instances, messageType, subscriberId) => {
  const res = [];
  instances.forEach((instance) => {
    if (instance.subscriberId === subscriberId && instance.messageType === messageType) {
      res.push(instance);
    }
  });

  switch(messageType) {
    case 'OTP':
      return res > 100;
    case 'Weather':
      return res > 4;
    case 'Reminders':
      return res > 5;
    default:
      return false; // unsupported messageType shouldn't be allowed to send
  }
}

//using sliding window algorithm to find out if the client requests are over limit within the timeframe
const getIsTotalRequestOverLimit = (data) => {
  let windowStartTimestamp = moment().subtract(WINDOW_SIZE_IN_HOURS, 'hours').unix();
  let requestsWithinWindow = data.filter((entry) => {
    return entry.requestTimeStamp > windowStartTimestamp;
  });

  let totalWindowRequestsCount = requestsWithinWindow.reduce((accumulator, entry) => {
    return accumulator + entry.requestCount;
  }, 0);

  // if number of requests made is greater than or equal to the desired maximum, return true because its over limit
  if (totalWindowRequestsCount >= MAX_WINDOW_REQUEST_COUNT) {
    return true;
  } else {
    // if number of requests made is less than allowed maximum, log new entry
    let lastRequestLog = data[data.length - 1];
    let potentialCurrentWindowIntervalStartTimeStamp = currentRequestTime.subtract(WINDOW_LOG_INTERVAL_IN_HOURS, 'hours').unix();
    //  if interval has not passed since last request log, increment counter
    if (lastRequestLog.requestTimeStamp > potentialCurrentWindowIntervalStartTimeStamp) {
      lastRequestLog.requestCount++;
      data[data.length - 1] = lastRequestLog;
    } else {
      //  if interval has passed, log new entry for current user and timestamp
      data.push({
        requestTimeStamp: currentRequestTime.unix(),
        requestCount: 1,
      });
    }
    await redisClient.set(data.ip, JSON.stringify(data));
    return false;
  }
}

app.get('/', (req, res) => res.send('Hello World!'))

app.post('/', async (req, res, next) => {
  async function isOverLimit(req) {
      try {
        // fetch records of current user using IP address, returns null when no record is found
        const record = await redisClient.get(req.ip);
        const currentRequestTime = moment();

        //  if no record is found , create a new record for user and store to redis
        if (record == null) {
          let newRecord = [];
          let requestLog = {
            requestTimeStamp: currentRequestTime.unix(),
            requestCount: 1,
            messageContent: req.body.messageContent,
            messageType: req.body.messageType,
            subscriberId: 'test', // hard-coded sub id
          };
          newRecord.push(requestLog);
          await redisClient.set(req.ip, JSON.stringify(newRecord));
          next();
        }

        // if record is found, parse it's value and calculate number of requests users has made within the last window
        let data = JSON.parse(record);
        const isTotalRequestsOverLimit = getIsTotalRequestOverLimit(data);
        const isUserOverLimit = getIsUserOverLimit(instance, req.body.messageType, req.body.subscriberId);

        if (!isTotalRequestsOverLimit && !isUserOverLimit) {
          return false;
        }
        return true;
      }
      catch(e){
        res.send(e);
      }
    }

    // check rate limit
    let overLimit = await isOverLimit(req) // req has message content, timestamp, metadata but for simplication, I am specifying what this method needs - 1. unique application-key, 2. messageType e.g. OTP, Email etc.
    if (overLimit) {
      res.status(429).send('Rate limit reached - try again later');
      return;
    } 
    res.send("Accessed resources!");
  })

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))