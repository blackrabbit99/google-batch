var request = require('request');
var querystring = require('querystring');
var parser = require('http-string-parser');
var fs = require('fs');

function findToken(opts){
	var token = null;
	opts.some(function(item){
		if(item && item.headers && item.headers.Authorization){
			token =  item.headers.Authorization.replace(/^Bearer/, "").trim();
			return true;
		}
	});	
	return token;
}

function getMultipart(calls){

	return calls.map(function (opts) {
		opts.qs = opts.qs || { };
		opts.json = opts.json || { } ;

		var contentId = (opts.qs.contentId || opts.json.contentId || Math.floor(Math.random() * Date.now()));
		var method = opts.method || 'GET';
		var url = ' /drive/v2/files/' + opts.fileId;
		var fileId = opts.fileId
		delete opts.fileId;
		var params = Object.keys(opts).length ? '?' + querystring.stringify(opts) : '';
		opts.fileId = fileId;
		var options = {
			'Content-Type': 'application/http',
			'Content-Transfer-Encoding': 'binary',
			'Content-ID' : contentId,
			'body' : method + url + params + '\n'
		};

		if(method !== 'GET' && opts.body){
			options.body +=  'Content-Type: application/json'  + '\n\n' + JSON.stringify(opts.body);	
		}
		
		return options;
	});
}

function parseHTTPStrings(item){
	var returnValues = { };
	var data = parser.parseResponse(item);
	returnValues.headers = data.headers;
	if(data.body.indexOf('HTTP/1.1') !== -1){
		data = parser.parseResponse(data.body);
	}
	Object.keys(data.headers).forEach(function(item){
		returnValues.headers[item] = data.headers[item];
	});	      		
	returnValues.body = data.body;
	try{  returnValues.body = JSON.parse(returnValues.body) }catch(e){ }
	return returnValues;
}

function removeGarbage(initial, item){
	if(item.match(/content-type/ig)){
		initial.push(item);
	}
	return initial;
}

function clearCache(module){
	if(require.resolve(module) && require.cache[require.resolve(module)]){
		try{ delete require.cache[require.resolve(module)] }catch(e){ }
	}
}

function GoogleBatch(params){
	var apiCalls = [ ];
	var token = null;
	this.maxBatchSize = params.maxBatchSize || 800;
	this.setAuth = function(auth){
		if(typeof(auth) === "string"){
			token = auth;
		}else if(auth && 
			auth.credentials && 
			auth.credentials.access_token){
				token = auth.credentials.access_token;
		}
		return this;
	}

	this.clear = function(){
		apiCalls = [ ];
		return this;
	}

	this.add = function(calls){
		if(!Array.isArray(calls)){
			calls = [ calls ];
		}
		apiCalls = apiCalls.concat(calls);
		return this;
	}

	this.isFull = function(){
		return apiCalls.length >= this.maxBatchSize;
	}

	this.exec = function(callback){
		if(!token){
			token = findToken(apiCalls);
			if(!token){
				return callback([Error('Auth Token not found')]);
			}	
		}

		var multipart = getMultipart(apiCalls);
		
		var opts = {
			url : 'https://www.googleapis.com/batch',
			method : 'POST',
			headers : {
				'content-type': 'multipart/mixed',
				'Authorization' : 'Bearer ' + token
			},
			multipart : multipart
		};

		var req = request(opts);
		
		req.on('error', function (e) {
			res.json(200, e);
			return callback([e]);
		});
		req.on('response', function (res) {
			var boundary = res.headers['content-type'].split('boundary=');
			if(boundary.length < 2){
				return callback([Error('Wrong content-type :' + res.headers['content-type'])]);
			}
			var boundary = boundary[1];	
			var responsData = "";
			res.on('data', function(data){
				responsData += data.toString();
			});
			res.on('end', function(){
				var bRegex = RegExp('^.*' + boundary,'igm');
				var responses = responsData.split(bRegex)
							.reduce(removeGarbage, [ ])
							.map(parseHTTPStrings);

				var errors = responses.map(function(item){
					if(item.body && item.body.error){
						return item.body.error;
					}
					return null;
				});
				callback(errors, responses);
		  });
			
		});
			
	}
}

GoogleBatch.require = function(moduleName){
	if(moduleName === "googleapis"){
		try{
			var data = "module.exports = require('" + __dirname + "/transport.js');"
			var existingGoogle = require.resolve(moduleName);
			if(existingGoogle){
				existingGoogle = existingGoogle.substr(0, existingGoogle.indexOf(moduleName)) + 'googleapis/lib/transporters.js';
				fs.writeFileSync(existingGoogle, data);
			}else{
				throw Error('googleapis module not found');
			}
			clearCache('googleapis');
		}catch(e){
			var error = new Error('Error while patching googleapis');
			error.stack = e.stack;
			throw error;
		}
	}
	return require(moduleName);
}

GoogleBatch.decodeRawData = function(body){
	return (new Buffer(body.replace(/-/g, '+').replace(/_/g, '/'), "base64")).toString();
}

module.exports = GoogleBatch;


