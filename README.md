# hmpo-logger
Consistent logging for hmpo apps

## Usage

Top level logging configuration:
```javascript
var hmpoLogger = require('hmpo-logger');
hmpoLogger.config();

var app = require('express')();
app.use(hmpoLogger.middleware());
```

Logging messages:
```javascript
var logger = require('hmpo-logger').get();

logger.log('error', 'This is an error');
logger.warn('This is a warning');
logger.warn('This is an %s warning', 'interpolated');
logger.info('This is just info with :meta', {meta: 'metavalue'});
logger.info(':method :url took :responseTime ms and was res[content-length] bytes', {req: req, res: res});
```


### `get(name)`

Get a named winston logger. The name is prepended to the log entry messages.

```javascript
require('hmpo-logger').get(name);
```

If name is ommited it is guessed from the nearest package.json file found in the calling package.
```javascript
require('hmpo-logger').get();
```

If name begins with a colon it is appended to the guessed name.
```javascript
require('hmpo-logger').get(':subname');
```
Returns a `winston` logger.


### `config(options)`

Initialise the logger at the top level of the app, specifying the log locations and logging levels of three pre-defined transports: console, app, and error.

```javascript
var hmpoLogger = require('hmpo-logger');
hmpoLogger.config({
    logPublicRequests: false,
    console: true,
    connsoleJSON: false,
    consoleLevel: 'debug',
    consoleColor: true,
    app: './app.log',
    appJSON: true,
    appLevel: 'info',
    error: './error.log',
    errorJSON: false,
    errorLevel: ['error', 'warn'],
    meta: {
        host: 'host',
        sessionID: 'sessionID',
        verb: 'method',
        request: 'request'
    },
    requestMeta: {
        clientip: 'clientip',
        remoteAddress: 'connection.remoteAddress',
        hostname: 'hostname',
        port: 'port',
        response: 'statusCode',
        responseTime: 'responseTime',
        httpversion: 'version',
        bytes: 'res.content-length'
    },
    format: ':clientip :sessionID :method :request HTTP/:httpVersion :statusCode :res[content-length] - :responseTime ms'
});
```

Returns `hmpoLogger`.


### `middleware()`

Log incomming requests from an `express` app.

```javascript
var hmpoLogger = require('hmpo-logger');

var app = require('express')();
app.use(hmpoLogger.middleware());
```

Returns express compatible middleware

