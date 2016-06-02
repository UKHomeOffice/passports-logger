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

logger.log('info', 'response :responseText', { responseText: logger.trimHtml(htmlBody, 100)});
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

### `logger.trimHtml(text, maxLength)`

Trim tags out of an HTML string to help with more concise HTML error response logging. Defaults to a `maxLength` of 400.

Returns a string, or passes through `text` if not a string.

```javascript
require('hmpo-logger').get(name);
```


### `config(options)`

Initialise the logger at the top level of the app, specifying the log locations and logging levels of three pre-defined transports: console, app, and error.

```javascript
var hmpoLogger = require('hmpo-logger');
hmpoLogger.config({ // defaults:
    console: true,
    connsoleJSON: false,
    consoleLevel: 'debug',
    consoleColor: true,
    app: './app.log',
    appJSON: true,
    appLevel: 'info',
    error: './error.log',
    errorJSON: true,
    errorLevel: 'exceptions',
    meta: {
        host: 'host',
        pm: 'env.pm_id',
        sessionID: 'sessionID',
        method: 'method',
        request: 'request'
    },
    requestMeta: {
        clientip: 'clientip',
        uniqueID: 'req.x-uniq-id',
        remoteAddress: 'connection.remoteAddress',
        hostname: 'hostname',
        port: 'port',
        response: 'statusCode',
        responseTime: 'responseTime',
        httpversion: 'version',
        bytes: 'res.content-length'
    },
    logPublicRequests: false,
    logHealthcheckRequests: false,
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

