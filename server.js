var http = require('http');
var fs = require('fs');
var ecstatic = require('ecstatic');
var qs = require('querystring');

var staticd = ecstatic({
    root: __dirname + '/static',
    autoIndex: true
});

var server = http.createServer(function(req, res) {
    if(/^\/records$/.test(req.url)) {
        res.setHeader('content-type', 'application/json');
        return fs.createReadStream(__dirname+"/records.json").pipe(res);
    }
    if(/^\/records\/new$/.test(req.url)) {
        res.setHeader('content-type', 'application/json');
        return setTimeout(function() {
            return req.pipe(res);
        }, 2000);
    }
    return staticd(req, res);
});

server.listen(process.env.PORT || 5000);