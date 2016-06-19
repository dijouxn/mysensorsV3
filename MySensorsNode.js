module.exports = {

	attributes : {
		nodeId : {
			type : 'integer',
			required : true,
			unique : true
		},
		sketchName : {
			type : 'string'
		},
		sketchVersion : {
			type : 'string'
		},
		protocol : {
			type : 'string'
		}
	}
};