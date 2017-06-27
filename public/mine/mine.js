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
	var PM = {}
	if (PMvalue != '') {
		PM["PrivateMirror"] = PMvalue
	}
	document.getElementById('main').innerHTML = getStatus(allData, true, id, index, all)
	xhrPost(url, JSON.stringify({ "options": PM }), (data) => {
		pull()
	}, (err) => {
		pull()
	})
}

let updateAll = () => {
	pull(() => {
		for (var id of Object.keys(allData)) {
			for (var index of Object.keys(allData[id].application_instances)) {
				if (allData[id].application_instances[index].status != 'unknown' && allData[id].application_instances[index].status != 'init') {
					update(id, index, true)
				}

			}
		}
	})

}

let updateSingle = (id, index, all) => {
	pull(() => {
		if (allData[id].application_instances[index].status != 'unknown' && allData[id].application_instances[index].status != 'init') {
			update(id, index, all)
		}
	})
}


let getEmptyNoti = (text) => {
	var result = "<div class='jumbotron text-center'><h1>" + text + "</h1></div>"
	return result

}
let getUpdateStatus = (clientData, id, index, updating, updateID, updateIndex, all) => {
	if (clientData[id].application_instances[index].status == 'unknown' || clientData[id].application_instances[index].status == 'init') {
		return "<button class='update-button-disable' >Update</button>"
	}
	if (clientData[id].application_instances[index].updating || all == true || (updating == true && id == updateID && index == updateIndex)) {
		return "<button class='transparent-progress'> <div class='loader'></div></button>"
	}
	if (clientData[id].application_instances[index].updatingError) {

		return "<button class='update-button' onClick='updateSingle(\"" + id + "\",\"" + index + "\")'><span class=' glyphicon glyphicon-exclamation-sign'></span> Update</button>"
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
				if (clientData[id].application_instances[index].status == 'unknown' || clientData[id].application_instances[index].status == 'init') {
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
	if (clientData[id].application_instances[index].status == 'unknown') {
		return '<div class="alert alert-danger alert-custom" >\
  		<strong  >Unreachable</strong> The clamav is unreachable.\
		</div>'
	}
	if (clientData[id].application_instances[index].status == 'red') {
		return '<div class="alert alert-warning alert-custom" >\
  		<strong >Unavailable</strong> The virus scanner is unavailable.\
		</div>'
	}
	if (clientData[id].application_instances[index].status == 'init') {
		return '<div class="alert alert-info alert-custom" >\
  		<strong  >Initialization</strong> The clamav is initializing.\
		</div>'
	}
	if (clientData[id].application_instances[index].updating || all == true || (updating == true && id == updateID && index == updateIndex)) {
		return '<div class="alert alert-info alert-custom" >\
  		<strong  >Updating</strong> The virus database is updating.\
		</div>'
	}
	if (clientData[id].application_instances[index].updatingError) {
		return '<div class="alert alert-warning alert-custom" >\
  		<strong  >Erorr</strong> '+ clientData[id].application_instances[index].errorMsg + ', please try again.\
		</div>'
	}

	return '<div class="alert alert-success alert-custom">\
 			 <strong  >Idle</strong> Updating is on idle status.\
			</div>'
}
let getStatusIndicator = (clientData, id, index) => {
	let color = clientData[id].application_instances[index].status
	return "<div  class='dot " + color + "'></div>"
}
let getVersion = (clientData, id, index) => {
	if (clientData[id].application_instances[index].version != undefined) {
		if (clientData[id].application_instances[index].version.version != undefined) {
			return clientData[id].application_instances[index].version.version
		} else {
			return clientData[id].application_instances[index].version.errorMsg
		}
	} else {
		return "N/A"
	}
}
let getStatus = (data, updating, updateID, updateIndex, all) => {
	if (Object.keys(data).length <= 0) {

		return getEmptyNoti("No status result")
	} else {
		var clientData = data
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
				<td class='middle text-center'>" + getVersion(clientData, id, index) + "</td>\
				<td class='middle text-right	'>"+ getUpdateStatus(clientData, id, index, updating, updateID, updateIndex, all) + "</td></tr>")
			}
			result += '<div class="panel panel-default">\
				<div class="panel-heading" >'+ nameTag + '</div>\
        		<table class="table">\
					<thead><tr><th>#</th> <th class="text-center">Scanner</th> <th class="text-center">Message</th><th class="text-center">Version</th><th class="text-right">'+ getUpdateStatusAll(clientData, updating, all) + '</th></tr></thead>\
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
		//allData = { "4d64eded-9086-4175-9783-7e626a27abb0": { "application_instances": { "0": { "status": "green", "updating": false, "updatingError": true ,"errorMsg":"asd"} }, "application_name": "icon-clamav-testing" } }
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
}, 3000)


