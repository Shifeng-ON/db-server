allData = {}

function createXHR() {
	if (typeof XMLHttpRequest != 'undefined') {
		return new XMLHttpRequest();
	} else {
		try {
			return new ActiveXObject('Msxml2.XMLHTTP');
		} catch (e) {
			try {
				return new ActiveXObject('Microsoft.XMLHTTP');
			} catch (e) { }
		}
	}
	return null;
}
function xhrGet(url, callback, errback) {
	var xhr = new createXHR();
	xhr.open("GET", url, true);
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4) {
			if (xhr.status == 200) {
				callback(xhr.responseText);
			} else {
				errback(xhr.responseText);
			}
		}
	};

	xhr.timeout = 100000;
	xhr.ontimeout = errback;
	xhr.send();
}

function xhrPost(url, data, callback, errback) {
	var xhr = new createXHR();
	xhr.open("POST", url, true);
	xhr.setRequestHeader("Content-type", "application/json");
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4) {
			if (xhr.status == 200) {
				callback(xhr.responseText);
			} else {
				errback(xhr.responseText);
			}
		}
	};
	xhr.timeout = 100000;
	xhr.ontimeout = errback;
	console.log(data)
	xhr.send(data);
}

let update = (id, index, all) => {
	let url = window.location.origin.replace('#', '') + '/notify/' + id + '/' + index
	let PMvalue = document.getElementById('PMIP').value
	var PM ={}
	if (PMvalue != '') {
		PM["PrivateMirror"] = PMvalue 
	}
	document.getElementById('main').innerHTML = getStatus(allData, true, id, index, all)
	xhrPost(url, JSON.stringify({ "commands": PM }), (data) => {
		pull()
	}, (err) => {
		pull()
	})
}

let updateAll = () => {
	pull(() => {
		for (var id of Object.keys(allData)) {
			for (var index of Object.keys(allData[id].application_instances)) {
				update(id, index, true)
			}
		}
	})

}

let updateSingle = (id, index, all) => {
	pull(() => {
		update(id, index, all)
	})
}


let getEmptyNoti = (text) => {
	var result = "<div class='jumbotron text-center'><h1>" + text + "</h1></div>"
	return result

}
let getUpdateStatus = (clientData, id, index, updating, updateID, updateIndex, all) => {
	if (clientData[id].application_instances[index].updating || all == true || (updating == true && id == updateID && index == updateIndex)) {
		return "<button class='transparent-progress'> <div class='loader'></div></button>"
	}
	if (clientData[id].application_instances[index].updatingError) {
		return '<span class="glyphicon warning glyphicon-exclamation-sign"></span>'
	}
	return "<button class='update-button' onClick='updateSingle(\"" + id + "\",\"" + index + "\")'>Update</button>"


}
let getUpdateStatusAll = (clientData, updating, all) => {

	if (updating == true || all == true) {
		return '<button class="update-button-disable" >Update All</button>'

	} else {
		var temp = false
		for (var id of Object.keys(clientData)) {
			for (var index of Object.keys(clientData[id].application_instances)) {
				if (clientData[id].application_instances[index].updating) {
					temp = true
				}
			}
		}
		if (temp) {
			return '<button class="update-button-disable" >Update All</button>'
		}
		return '<button class="update-button" onClick="updateAll()">Update All</button>'
	}
}
let getMessage = (clientData, id, index, updating, updateID, updateIndex, all) => {
	if (clientData[id].application_instances[index].updating || all == true || (updating == true && id == updateID && index == updateIndex)) {
		return '<div class="alert alert-info alert-custom" >\
  <strong  >Updating</strong> The virus database is updating.\
</div>'
	}
	if (clientData[id].application_instances[index].updatingError) {
		return '<div class="alert alert-danger alert-custom" >\
  <strong  >Erorr</strong> Updating database has error.\
</div>'
	}
	return '<div class="alert alert-success alert-custom">\
 			 <strong  >Idle</strong> Updating is on idle status.\
			</div>'
}
let getStatusIndicator = (clientData, id, index) => {
	let color = clientData[id].application_instances[index].status
	return "<div class='dot " + color + "'></div>"
}
let getStatus = (data, updating, updateID, updateIndex, all) => {
	if (Object.keys(data).length <= 0) {

		return getEmptyNoti("No status result")
	} else {
		var clientData = data
		let oldPMvalue = document.getElementById('PMIP')==undefined?'': document.getElementById('PMIP').value
		var result = ''
		var nameTag = ''
		var instanceTag = []
		for (var id of Object.keys(clientData)) {
			instanceTag = []
			nameTag = clientData[id].application_name
			for (var index of Object.keys(clientData[id].application_instances)) {
				instanceTag.push("<tr><td class='middle'>" + index + "</td>\
				<td class='middle'>"+ getStatusIndicator(clientData, id, index) + "</td>\
				<td class='middle'>"+ getMessage(clientData, id, index, updating, updateID, updateIndex, all) + "</td>\
				<td class='middle text-right	'>"+ getUpdateStatus(clientData, id, index, updating, updateID, updateIndex, all) + "</td></tr>")
			}
			result += '<div class="panel panel-default">\
		<div class="panel-heading" >'+ nameTag + '</div>\
		<div class="panel-body">\
			<div class="form-group">\
  				<label for="usr">Private Mirror IP:</label>\
  				<input type="text" value="'+oldPMvalue+'" id="PMIP" class="form-control" id="usr">\
			</div>\
		</div>\
        <table class="table">\
		<thead><tr><th>#</th> <th>Status</th> <th class="text-center">Message</th><th class="text-right">'+ getUpdateStatusAll(clientData, updating, all) + '</th></tr></thead>\
		<tbody>'+ instanceTag.join('') + '</tbody>\
		</table>\
		</div>'
		}


		return result
	}

}
let pull = (cb) => {
	let url = window.location.origin.replace('#', '') + '/info/'
	xhrGet(url, (data) => {
		allData = JSON.parse(data)
		//allData = { "4d64eded-9086-4175-9783-7e626a27abb0": { "application_instances": { "0": { "status": "green", "updating": false, "updatingError": false } }, "application_name": "icon-clamav-testing" } }
		if (!cb) {
			document.getElementById('main').innerHTML = getStatus(allData)
		}
		else {
			cb()
		}
	}, (err) => {
		allData = {}
		document.getElementById('main').innerHTML = getEmptyNoti(err)
	})
}

pull()
setInterval(() => {
	pull()
}, 15000)


