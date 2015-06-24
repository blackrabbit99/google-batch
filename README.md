google-drive-batch-requests
=========
Sends Batch Requests to Google Drive REST API
=======

Unfortunately google-drive-client-nodejs API doesn't support batch requests
So we decided fork Pradeep Mishra's library to make simple interface for drive api batch calling
The library used for sending batch requests for DRIVE API

```
{	
	var batch = new googleBatch();
	batch.setAuth(authClient.gapi.token);
	
	batch.add({
		method: 'PUT',
		fileId: myId,
		addParents: addParents.join(','),
		removeParents: removeParents.join(','),
		fields: ['title', 'id', 'parents'].join(',')
	});
	
	batch.add({
		method: 'PUT',
		fileId: myId,
		body: {
			title: 'myNewTitle'
		}
	});
	
	batch.exec(function(errors, responses){
		// your stuff
	});
	
}
```

Limited calls
==============
You're limited to 1000 calls in a single batch request. If you need to make more calls than that, use multiple batch requests. But after investigation the most common number was 800. 

So you can play with this value on instance initiating.

```
var batch = new googleBatch({maxBatchSize: 800});
```


(C) Pradeep Mishra <pradeep23oct@gmail.com>
(C) @blackrabbit99 <myzlio@gmail.com>





```bash
npm install google-drive-batch-requests --save
```
