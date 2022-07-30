# notifications-rate-limiter

I have used a custom implementation of the rate limiter using Redis.

Following are the steps for the logic of implementation -

1. Using user's IP address, we fetch the user's record from redis. If the return value is null, this means no record is created yet, hence we create the record and store it to redis.
2. If a record is returned, we parse the return value to JSON and the call the method "getIsTotalRequestOverLimit" to determine if the total requests for a client has gone over the limit specified.


# getIsTotalRequestOverLimit

1. In this function, we calculate the total set of requests made by the user in the last window by retrieving all logs with timestamps within the last 24 hours. We sum all those logs in `requestCount`.
2. If number of requests in the last window > permitted max, return true which means that the user has gone above limit
3. However, if totalWindowRequestsCount is less than the permitted limit, the request is eligible for a response. So, we perform some checks to see whether it’s been up to one hour since the last log was made. If it has been up to one hour, we create a new log for the current timestamp. Otherwise, we increment the requestCount on the last timestamp and store (update) the user’s record on Redis.

# getIsUserOverLimit

1. In this method, we check if subscriber is over limit to get a message of a particular message type like OTP, weather notifications or reminders.
2. For this, we get the records from redis by messageType and subscriberId. If they are over limit, we return true.
