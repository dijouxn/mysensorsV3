module.exports = {

	attributes : {
		node : {
			model : 'MySensorsNode',
			required : true
		},
		device : {
			model : 'Device'
		},
		sensorId : {
			type : 'integer',
			required : true
		},
		type : {
			type : 'integer',
			required : true
		}
	}
};