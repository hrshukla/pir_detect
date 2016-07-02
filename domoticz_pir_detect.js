// Node.js script that detects rf433 signals received on a Pi
// and transmits them via mqtt
// For Office project - 07/05/15

// rpi-433 is the node module to detect RF433 
var rpi433    = require("rpi-433");
var mqtt = require("mqtt");
var mysql = require ("mysql");

// PIN 2 is where the data pin is connected
var rfSniffer = rpi433.sniffer(2, 500);

// A list of our PIRs. If we hear from anyone else, its noise
// We also record the Domoticz idx value of this pir
var my_pirs = {'55628': '3', '56564': '4', '897897': '5', '5652682': '1'};

// This Pi is the hub for pod 01
var this_pod = 'rpi01';

//Change this to match your mqtt broker
var client = mqtt.connect('mqtt://test.mosquitto.org');

// Change this to match database settings
var connection = mysql.createConnection({
	host	: 'db_host',
	user	: 'db_user',
	password: 'db_pass',
	database: 'db_name'
});
	
// Upon receive, send the detected code to mqtt broker     
rfSniffer.on('codes', function (code) {
	console.log('PIRSensor: Code received: '+code);
	//  Ignore noise
	if (my_pirs.hasOwnProperty(code)){
		console.log('PIRSensor: '+code+ ' in list of known PIRs');	
		// Lets get a timestamp
		var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
		var localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0,-1).replace(/T/, '|').replace(/\..+/, '');
		var datearr = localISOTime.split(" ");
		var datestamp = datearr[0];
		var timestamp = datearr[1];	
		
		// Create our mqtt payload
		var mqtt_payload = {"command": "switchlight", "idx": my_pirs[code], "switchcmd": "On" };
		// Finally, publish it to the broker
  		client.publish('domoticz/in', JSON.stringify(mqtt_payload));
		console.log('PIRSensor: '+code+ ' payload published to mqtt');

		// Write to the database
		var sql_payload = {datestamp: datestamp, timestamp: timestamp, whatsensor: 'chairpir', whichsensor: code, sensorvalue: 1, whichhub: this_pod};   
		connection.connect(function(err){
			if(err){
				console.log('PIRSensor: Error connecting to database');
				return;
			}
			console.log('PIRSensor: Database connection established');
		});
		connection.query('INSERT INTO chairpir SET ?', sql_payload, function(err, res){
			if(err) throw err;
			console.log('PIRSensor: Database updated with new row ID ' +res.insertId);
		});
		connection.end(function(err) {
			if(err){
				console.log('PIRSensor: Error terminating connection to database');
				return;
			}
			console.log('PIRSensor: Database connection terminated');
		});
	} else {
		console.log('PIRSensor: '+code+ ' not in list of known PIRs. Ignoring.');
	}
});

/*mqtt connection
client.on('connect', function () {
	// Inform controllers
  	client.subscribe('office/pod/');
	
});
*/

// mqtt alert message 
client.on('message', function (topic, message) {
  console.log('topic: '+topic + ' message '+  message.toString());
  client.end();
}); 
