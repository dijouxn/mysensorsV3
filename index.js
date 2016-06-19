var fs = require('fs');
var path = require('path');
var requestify = require('requestify');
var appendedString = "";
var gw;
var queue;
var MySensorsNode = require('./lib/MySensorsSensor.js')
var MySensorsSensor = require('./lib/MySensorsSensor.js')

//const gwType						= 'Ethernet';
//const gwAddress					= '10.0.1.99';
//const gwPort						= 9999;

const gwType 						= 'Serial';
const gwPort 						= '/dev/ttyUSB0';
const gwBaud 						= 115200;

const fwSketches					= [ ];
const fwDefaultType 				= 0xFFFF; // index of hex file from array above (0xFFFF)

const FIRMWARE_BLOCK_SIZE			= 16;
const BROADCAST_ADDRESS				= 255;
const SENSORID_INTERNAL				= 255;

const C_PRESENTATION				= 0;
const C_SET							= 1;
const C_REQ							= 2;
const C_INTERNAL					= 3;
const C_STREAM						= 4;

const V_TEMP						= 0;
const V_HUM							= 1;
const V_LIGHT						= 2;
const V_DIMMER						= 3;
const V_PRESSURE					= 4;
const V_FORECAST					= 5;
const V_RAIN						= 6;
const V_RAINRATE					= 7;
const V_WIND						= 8;
const V_GUST						= 9;
const V_DIRECTION					= 10;
const V_UV							= 11;
const V_WEIGHT						= 12;
const V_DISTANCE					= 13;
const V_IMPEDANCE					= 14;
const V_ARMED						= 15;
const V_TRIPPED						= 16;
const V_WATT						= 17;
const V_KWH							= 18;
const V_SCENE_ON					= 19;
const V_SCENE_OFF					= 20;
const V_HEATER						= 21;
const V_HEATER_SW					= 22;
const V_LIGHT_LEVEL					= 23;
const V_VAR1						= 24;
const V_VAR2						= 25;
const V_VAR3						= 26;
const V_VAR4						= 27;
const V_VAR5						= 28;
const V_UP							= 29;
const V_DOWN						= 30;
const V_STOP						= 31;
const V_IR_SEND						= 32;
const V_IR_RECEIVE					= 33;
const V_FLOW						= 34;
const V_VOLUME						= 35;
const V_LOCK_STATUS					= 36;
const V_LEVEL						= 37;
const V_VOLTAGE						= 38;
const V_CURRENT						= 39;
const V_RGB							= 40;
const V_RGBW						= 41;
const V_ID							= 42;
const V_UNIT_PREFIX					= 43;
const V_HVAC_SETPOINT_COOL			= 44;
const V_HVAC_SETPOINT_HEAT			= 45;
const V_HVAC_FLOW_MODE				= 46;

const I_BATTERY_LEVEL				= 0;
const I_TIME						= 1;
const I_VERSION						= 2;
const I_ID_REQUEST					= 3;
const I_ID_RESPONSE					= 4;
const I_INCLUSION_MODE				= 5;
const I_CONFIG						= 6;
const I_PING						= 7;
const I_PING_ACK					= 8;
const I_LOG_MESSAGE					= 9;
const I_CHILDREN					= 10;
const I_SKETCH_NAME					= 11;
const I_SKETCH_VERSION				= 12;
const I_REBOOT						= 13;
const I_GATEWAY_READY				= 14;
const I_REQUEST_SIGNING				= 15;
const I_GET_NONCE					= 16;
const I_GET_NONCE_RESPONSE			= 17;

const S_DOOR						= 0;
const S_MOTION						= 1;
const S_SMOKE						= 2;
const S_LIGHT						= 3;
const S_DIMMER						= 4;
const S_COVER						= 5;
const S_TEMP						= 6;
const S_HUM							= 7;
const S_BARO						= 8;
const S_WIND						= 9;
const S_RAIN						= 10;
const S_UV							= 11;
const S_WEIGHT						= 12;
const S_POWER						= 13;
const S_HEATER						= 14;
const S_DISTANCE					= 15;
const S_LIGHT_LEVEL					= 16;
const S_ARDUINO_NODE				= 17;
const S_ARDUINO_REPEATER_NODE		= 18;
const S_LOCK						= 19;
const S_IR							= 20;
const S_WATER						= 21;
const S_AIR_QUALITY					= 22;
const S_CUSTOM						= 23;
const S_DUST						= 24;
const S_SCENE_CONTROLLER			= 25;
const S_RGB_LIGHT					= 26;
const S_RGBW_LIGHT					= 27;
const S_COLOR_SENSOR				= 28;
const S_HVAC						= 29;
const S_MULTIMETER					= 30;
const S_SPRINKLER					= 31;
const S_WATER_LEAK					= 32;
const S_SOUND						= 33;
const S_VIBRATION					= 34;
const S_MOISTURE					= 35;

const ST_FIRMWARE_CONFIG_REQUEST	= 0;
const ST_FIRMWARE_CONFIG_RESPONSE	= 1;
const ST_FIRMWARE_REQUEST			= 2;
const ST_FIRMWARE_RESPONSE			= 3;
const ST_SOUND						= 4;
const ST_IMAGE						= 5;

const P_STRING						= 0;
const P_BYTE						= 1;
const P_INT16						= 2;
const P_UINT16						= 3;
const P_LONG32						= 4;
const P_ULONG32						= 5;
const P_CUSTOM						= 6;

/**
 * Encode un message à envoyer
 * @method encodeMessage
 */
function encodeMessage(nodeId, sensorId, messageType, acknowledge, subType, payload)
{
	var msg = nodeId.toString(10) + ";" + sensorId.toString(10) + ";" + messageType.toString(10) + ";" + acknowledge.toString(10) + ";" + subType.toString(10) + ";";
	if (messageType == C_STREAM)
	{
		for (var i = 0; i < payload.length; i++)
		{
			if (payload[i] < 16)
				msg += "0";
			msg += payload[i].toString(16);
		}
	}
	else
	{
		msg += payload;
	}
	msg += '\n';
	return msg.toString();
}

/**
 * Envoye un message à la gateway
 * @method sendMessage
 */
function sendMessage(message)
{
	sails.log.info('[MySensors] -> ' + message.toString());
	gw.write(message);
}

/**
 * Sauvegarde d'un nouveau noeud en base de données
 * @method saveNode
 */
function saveNode(nodeId, sensorId, subType, protocol, callback)
{
	MySensorsNode.findOne({ nodeId : nodeId }, function (err, node){
		if(err)
		{
			sails.log.error("[MySensors] " + err);
			callback();
		}
		else if(!node)
		{	
			MySensorsNode.create({ nodeId : nodeId, protocol : protocol }, function(err, node){
				if(err)
				{
					sails.log.error("[MySensors] " + err);
					callback();
				}
				else
				{
					sails.log.info("[MySensors] Nouveau noeud ajouté : " + node.nodeId + " - " + node.protocol);
					saveSensor(nodeId, sensorId, subType, callback);
				}
			});
		}
		else
		{
			MySensorsNode.update({ nodeId : nodeId }, { protocol : protocol }, function (err, node){
				if(err)
				{
					sails.log.error("[MySensors] " + err);
					callback();
				}
				else
				{
					sails.log.info("[MySensors] Noeud " + node[0].nodeId + " mis à jour, protocole : " + node[0].protocol);
					
					MySensorsSensor.destroy({ node : node[0].id }, function (err){
						if(err)
						{
							sails.log.error("[MySensors] " + err);
							callback();
						}
						else						
							saveSensor(nodeId, sensorId, subType, callback);
					});
				}
			});
		}
	});
}

/**
 * Sauvegarde d'un nouveau sensor en base de données
 * Un sensor est lié à un noeud. Ce noeud peut posséder plusieurs sensors
 * @method saveSensor
 */
function saveSensor(nodeId, sensorId, subType, callback)
{
	MySensorsNode.findOne({ nodeId : nodeId }, function (err, node){
		if (err)
		{
			sails.log.error("[MySensors] " + err);
			callback();
		}
		else if(!node)
		{
			sails.log.error("[MySensors] Noeud " + nodeId + " inexistant en base de données");
			callback();
		}
		else
		{
			var sensor =
			{
				node : node.id,
				sensorId : sensorId,
				type : subType
			};
			
			MySensorsSensor.create(sensor, function(err, sensor){
				if(err)
					sails.log.error("[MySensors] " + err);
				else
					sails.log.info("[MySensors] Nouveau sensor ajouté : " + nodeId + " - " + sensor.sensorId + " - " + sensor.type);
				
				callback();
			});
		}
	});
}

/**
 * Sauvegarde une nouvelle valeur reçue d'un sensor
 * @method saveValue
 */
function saveValue(nodeId, sensorId, subType, payload, callback)
{
	MySensorsNode.findOne({ nodeId : nodeId }, function (err, node){
		if(!node)
		{
			sails.log.error("[MySensors] Noeud " + nodeId + " inexistant en base de données");
			callback();
		}
		else if (err)
		{
			sails.log.error("[MySensors] " + err);
			callback();
		}
		else
		{
			MySensorsSensor.findOne({ node : node.id, sensorId : sensorId }, function (err, sensor){
				if(!sensor)
				{
					sails.log.error("[MySensors] Sensor " + sensorId + " inexistant en base de données pour le noeud " + nodeId);
					callback();
				}
				else if (err)
				{
					sails.log.error("[MySensors] " + err);
					callback();
				}
				else
				{
					var data =
					{
						sensorId : sensor.id,
						type : subType,
						data : payload
					};
					
					MySensorsData.create(data, function(err, data){
						if(err)
							sails.log.error("[MySensors] " + err);
						else
							sails.log.info("[MySensors] Nouvelle donnée ajoutée : " + nodeId + " - " + sensorId + " - " + subType + " - " + payload);
						
						callback();
					});
				}
			});
		}
	});
}

/**
 * Sauvegarde le nom du sketch du noeud
 * @method saveSketchName
 */
function saveSketchName(nodeId, payload, callback)
{
	MySensorsNode.update({ nodeId : nodeId }, { sketchName : payload }, function (err, node){
		if(err)
			sails.log.error("[MySensors] " + err);
		else
			sails.log.info("[MySensors] Noeud " + nodeId + " mis à jour, nom du sketch : " + node[0].sketchName);
		
		callback();
	});
}

/**
 * Sauvegarde la version du sketch du noeud
 * @method saveSketchVersion
 */
function saveSketchVersion(nodeId, payload, callback)
{
	MySensorsNode.update({ nodeId : nodeId }, { sketchVersion : payload }, function (err, node){
		if(err)
			sails.log.error("[MySensors] " + err);
		else
			sails.log.info("[MySensors] Noeud " + nodeId + " mis à jour, version du sketch : " + node[0].sketchVersion);
		
		callback();
	});
}

/**
 * Envoie de l'heure
 * @method sendTime
 */
function sendTime(nodeId, sensorId)
{
	var messageType = C_INTERNAL;
	var acknowledge = 0;
	var subType = I_TIME;
	var payload = new Date().getTime() / 1000;
	
	var td = encodeMessage(nodeId, sensorId, messageType, acknowledge, subType, payload);
	sendMessage(td);
}

/**
 * Envoie d'un nouvel id à un noeud qui en fait la demande
 * id envoyé = id max trouvé en base + 1
 * @method sendNextAvailableNodeId
 */
function sendNextAvailableNodeId(callback)
{
	var idToSend = 1;
	
	var request = "SELECT MAX(T.nodeId) nodeId ";
	request += "FROM ";
	request += "( ";
	request += "	SELECT 1 nodeId ";
	request += "	UNION ALL ";
	request += "	SELECT MAX(n.nodeId) + 1 nodeId ";
	request += "	FROM mysensorsnode n ";
	request += ") T";
	
	MySensorsNode.query(request, function(err, node){
		if(err)
		{
			sails.log.error("[MySensors] " + err);
			callback();
		}
		else
		{
			idToSend = node[0].nodeId;
			
			if (idToSend < 255)
			{
				MySensorsNode.create({ nodeId : idToSend }, function(err, node){
					if(err)
						sails.log.error("[MySensors] " + err);
					else
					{
						sails.log.info("[MySensors] Nouvel id calculé, envoyé au noeud, sauvegardé en base : " + node.nodeId);
						
						var nodeId = BROADCAST_ADDRESS;
						var sensorId = SENSORID_INTERNAL;
						var messageType = C_INTERNAL;
						var acknowledge = 0;
						var subType = I_ID_RESPONSE;
						var payload = idToSend;
						
						var td = encodeMessage(nodeId, sensorId, messageType, acknowledge, subType, payload);
						sendMessage(td);
					}
					
					callback();
				});
			}
			else
			{
				sails.log.error("[MySensors] id " + idToSend + " à envoyer supérieur à 254");
				callback();
			}
		}
	});
}

/**
 * Envoie de la configuration sur la demande d'un noeud
 * @method sendConfig
 */
function sendConfig(nodeId)
{
	var sensorId = SENSORID_INTERNAL;
	var messageType = C_INTERNAL;
	var acknowledge = 0;
	var subType = I_CONFIG;
	var payload = "M";
	
	var td = encodeMessage(nodeId, sensorId, messageType, acknowledge, subType, payload);
	sendMessage(td);
}

/**
 * Envoi un message pour demander à un noeud de rebooter.
 * @method sendRebootMessage
 */
function sendRebootMessage(nodeId)
{
	var sensorId = SENSORID_INTERNAL;
	var messageType = C_INTERNAL;
	var acknowledge = 0;
	var subType = I_REBOOT;
	var payload = "";
	
	var td = encodeMessage(nodeId, sensorId, messageType, acknowledge, subType, payload);
	sendMessage(td);
}

/**
 * Traite la réception de nouvelles données reçues de la part de la gateway
 * @method appendData
 */
function appendData(str)
{
    pos = 0;
    while (str.charAt(pos) != '\n' && pos < str.length)
	{
        appendedString = appendedString + str.charAt(pos);
        pos++;
    }
    if (str.charAt(pos) == '\n')
	{
		// Ajout de la chaine dans la queue
		var data = appendedString.trim();
		queue.push(data, function (err) {
			sails.log.info('[MySensors] Traitement terminé pour la ligne ' + data);
		});
        appendedString = "";
    }
    if (pos < str.length)
	{
        appendData(str.substr(pos + 1, str.length - pos - 1));
    }
}

/**
 * Traite une nouvelle donnée complète reçue de la part de la gateway
 * @method rfReceived
 */
function rfReceived(data, callback)
{
	if ((data != null) && (data != ""))
	{
		sails.log.info('[MySensors] <- ' + data);
		
		// decoding message
		var datas = data.toString().split(";");
		var nodeId = +datas[0];
		var sensorId = +datas[1];
		var messageType = +datas[2];
		var ack = +datas[3];
		var subType = +datas[4];
		var rawpayload = "";
		if (datas[5])
		{
			rawpayload = datas[5].trim();
		}
		var payload;
		if (messageType == C_STREAM)
		{
			payload = [];
			for (var i = 0; i < rawpayload.length; i += 2)
				payload.push(parseInt(rawpayload.substring(i, i + 2), 16));
		}
		else
		{
			payload = rawpayload;
		}
		
		// decision on appropriate response
		switch (messageType)
		{
			case C_PRESENTATION:
				if (sensorId == SENSORID_INTERNAL)
				{
					saveNode(nodeId, sensorId, subType, payload, callback);
				}
				else
				{
					saveSensor(nodeId, sensorId, subType, callback);
				}
				break;
			case C_SET:
				saveValue(nodeId, sensorId, subType, payload, callback);
				break;
			case C_REQ:
				callback();
				break;
			case C_INTERNAL:
				switch (subType)
				{
					case I_BATTERY_LEVEL:
						saveValue(nodeId, sensorId, subType, payload, callback);
						break;
					case I_TIME:
						sendTime(nodeId, sensorId);
						callback();
						break;
					case I_VERSION:
						callback();
						break;
					case I_ID_REQUEST:
						sendNextAvailableNodeId(callback);
						break;
					case I_ID_RESPONSE:
						callback();
						break;
					case I_INCLUSION_MODE:
						callback();
						break;
					case I_CONFIG:
						sendConfig(nodeId);
						callback();
						break;
					case I_PING:
						callback();
						break;
					case I_PING_ACK:
						callback();
						break;
					case I_LOG_MESSAGE:
						callback();
						break;
					case I_CHILDREN:
						callback();
						break;
					case I_SKETCH_NAME:
						saveSketchName(nodeId, payload, callback);
						break;
					case I_SKETCH_VERSION:
						saveSketchVersion(nodeId, payload, callback);
						break;
					case I_REBOOT:
						sendRebootMessage(nodeId);
						callback();
						break;
					case I_GATEWAY_READY:
						callback();
						break;
					case I_REQUEST_SIGNING:
						callback();
						break;
					case I_GET_NONCE:
						callback();
						break;
					case I_GET_NONCE_RESPONSE:
						callback();
						break;
				}
				break;
			case C_STREAM:
				switch (subType)
				{
					case ST_FIRMWARE_CONFIG_REQUEST:
						callback();
						break;
					case ST_FIRMWARE_CONFIG_RESPONSE:
						callback();
						break;
					case ST_FIRMWARE_REQUEST:
						callback();
						break;
					case ST_FIRMWARE_RESPONSE:
						callback();
						break;
					case ST_SOUND:
						callback();
						break;
					case ST_IMAGE:
						callback();
						break;
				}
				break;
		}
	}
}

module.exports = {
	
	start : function()
	{
		// Initialisation de la queue pour la réception des messages.
		queue = async.queue(rfReceived, 1);

		// Initialisation de la liaison avec la gateway.
		if (gwType == 'Ethernet')
		{
			gw = require('net').Socket();
			gw.connect(gwPort, gwAddress);
			gw.setEncoding('ascii');
			gw.on('connect', function() {
				sails.log.info('[MySensors] connected to ethernet gateway at ' + gwAddress + ":" + gwPort);
			}).on('data', function(rd) {
				appendData(rd.toString());
			}).on('end', function() {
				sails.log.info('[MySensors] disconnected from gateway');
			}).on('error', function() {
				sails.log.error('[MySensors] connection error - trying to reconnect');
				gw.connect(gwPort, gwAddress);
				gw.setEncoding('ascii');
			});
		}
		else if (gwType == 'Serial')
		{
			var SerialPort = require('serialport').SerialPort;
			gw = new SerialPort(gwPort, { baudrate: gwBaud });
			gw.open();
			gw.on('open', function() {
				sails.log.info('[MySensors] connected to serial gateway at ' + gwPort);
			}).on('data', function(rd) {
				appendData(rd.toString());
			}).on('end', function() {
				sails.log.info('[MySensors] disconnected from gateway');
			}).on('error', function() {
				sails.log.error('[MySensors] connection error - trying to reconnect');
				gw.open();
			});
		}
		else
		{
			throw new Error('unknown Gateway type');
		}
		
		setInterval(function() {
			sendTime(BROADCAST_ADDRESS, SENSORID_INTERNAL);
		}, 5 * 60 * 1000);
	}
};