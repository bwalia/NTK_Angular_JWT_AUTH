// MARK: Std

// Define the modSearch function to load modules (used by require)
Duktape.modSearch = function ( id, require, exports, module )
{
	var path = id;
	if( File.extension( path ) == '' )
		path += '.js';
	
	var path = app.resolvePath( path );
	if( !path )
		path = app.resolvePath( id + File.separator + 'index.js' );

	if( path )
	{
		module.id = id;
		module.filename = path;
		module.dirname = File.parent( path );
		var content = File.readFile( path, "" );
		if( typeof content == 'string' )
		{
			if( File.extension( path ) == 'json' ) {
				// Return code to parse the JSON and assign it to module.exports
				content = 'module.exports = JSON.parse(unescape("' + escape( content ) + '"));';
			}
			
			return content;
		}
	}

	throw new Error( 'Module not found: ' + id );
}

// Define stdin, stdout and stderr
var stdin = '';
var stdout = '';
var stderr = '';

// Define functions to read or write to stdin, stdout, stderr
function input()
{
	var buffer = stdin;
	stdin = '';
	return buffer;
}

function print( value )
{
	for( var i = 0 ; i < arguments.length ; i++ )
	{
		if( i > 0 ) stdout += ' ';
		if( typeof arguments[i] == 'object' )
			stdout += JSON.stringify( arguments[i] );
		else
			stdout += arguments[i];
	}
	stdout += '\r';
}

function alert( value )
{
	for( var i = 0 ; i < arguments.length ; i++ )
	{
		if( i > 0 ) stderr += ' ';
		if( typeof arguments[i] == 'object' )
			stderr += JSON.stringify( arguments[i] );
		else
			stderr += arguments[i];
	}
	stderr += '\r';
}

function assert( condition, message )
{
	if( !condition )
	{
		var buffer = 'Assertion failed: ';
		for( var i = 1 ; i < arguments.length ; i++ )
		{
			if( i > 1 ) buffer += ' ';
			if( typeof arguments[i] == 'object' )
				buffer += JSON.stringify( arguments[i] );
			else
				buffer += arguments[i];
		}
		buffer += '\r';
		
		stderr += buffer;
		throw new Error( buffer );
	}
}

// MARK: Application

Application.prototype.name = '';
Application.prototype.searchPaths = [];

Application.prototype.addSearchPath = function( path )
{
	this.searchPaths.push( path );
}

Application.prototype.resolvePath = function( filename )
{
	var path = __dirname + filename;
	if( File.isFile( path ) )
		return path;
		
	for( var i in app.searchPaths )
	{
		path = app.searchPaths[i] + filename;
		if( File.isFile( path ) )
			return path;
	}

	return null;
}

Application.prototype.init = function()
{
	this.name = app.eval4D( 489, 'Structure file', '(*)' );

	// Add the following searchpaths
	this.addSearchPath( this.get4DFolder( 'plugin' ) );
	this.addSearchPath( this.get4DFolder( 'resources' ) );
	this.addSearchPath( this.get4DFolder( 'web' ) );
}

// Initialise the global app object (the object is actually created inside the native code)
app.init();

// Create an alias/shortcut for Duktape.Thread
var Thread = Duktape.Thread;

// MARK: Console

var LogLevel = {
	ALL: 0,
	TRACE: 1,
	DEBUG: 2,
	INFO: 3,
	WARNING: 4,
	ERROR: 5,
	FATAL: 6,
	OFF: 10
};

// Define the Console class and functions
function Console()
{
	this.timers = [];
	this.logLevel = LogLevel.ALL;
}

Console.prototype.log = print;
Console.prototype.assert = assert;

// Define the following logging functions
["trace", "debug", "info", "warning", "error", "fatal"].forEach( function( name ) {
	var type = name.toUpperCase();
	var level = LogLevel[type];
	Console.prototype[name] = function( message ) {
		// Check if this level needs to be printed
		if( level >= this.logLevel )
		{
			var args = Array.prototype.slice.call( arguments );
			args.unshift( type + ":" );
			
			// Info goes to stdout, everything else to stderr
			if( level == LogLevel.INFO )
				print.apply( null, args );
			else
				alert.apply( null, args );
				
			if( level == LogLevel.TRACE )
			{
				alert( "--------------------" );
				alert( "Stack trace:" );
				// Unwind the stack trace starting from the calling function
				for( var i = -3 ; ; i-- )
				{
					var entry = Duktape.act( i );
					if( !entry ) break;
					alert( i + 2, "Line:", entry.lineNumber, "Function:", entry.function.name, "Filename:", entry.function.fileName );
				}
				alert( "--------------------" );
			} 
		}
	}
} );

Console.prototype.time = function( label )
{
	this.timers[label] = new Date();
}

Console.prototype.timeEnd = function( label )
{
	if( console.timers[label] )
	{
		var start = this.timers[label];
		var stop = new Date();
		var duration = stop - start;
		print( label + ': ' + duration + 'ms' );
		delete this.timers[label];
	}
}

// MARK: StringUtils

// Define the StringUtils object and functions
var StringUtils = {};

StringUtils.encodeFormula = function( formula, params )
{
	// Convert fieldnames using dot-notation to 4D notation using square brackets
	var result = formula.replace( /(\w+)\.(\w+)/gi, '[$1]$2' );

	if( typeof params == 'object' )
	{
		// Replace place holders that start with the $ sign with their actual values
		result = result.replace( /\$\w+/gi, function( key ) {
			key = key.substr( 1, key.length );
			var value = params[key];
			// Wrap the string with quotes if needed
			if( typeof value == 'string' )
				value = '"' + value.replace( '"', '\\"' ) + '"';
			else if( typeof value == 'undefined' )
				throw new Error( "Key '" + key + "' is undefined in formula '" + formula + "'" );
			return value;
		} );
	}

	return result;
}

StringUtils.format = function( format, values )
{
	if( typeof values != 'object' )
		values = Array.prototype.slice.call( arguments, 1 );
	
	// Replace place holders between curly brackets with their actual values
	var result = format.replace( /\{(\w+)\}/gi, function( match, key ) {
		return typeof values[key] !== 'undefined' ? values[key] : match;
	} );

	return result;
}

// MARK: ObjectUtils

// Define the ObjectUtils object and functions
var ObjectUtils = {};

ObjectUtils.merge = function()
{
	var result = {};
	for ( var i = 0 ; i < arguments.length ; i++ )
	{
		for ( var key in arguments[i] )
		{
			if( arguments[i].hasOwnProperty( key ) )
			{
				result[key] = arguments[i][key];
			}
		}
	}

	return result;
};

// MARK: MathUtils

Math.roundDec = function( number, precision )
{
	// Round with decimals
	var factor = Math.pow( 10, precision );
	return Math.round( number * factor ) /factor;
};


// MARK: Database

// Define the Database class and functions
function Database()
{
	this.name = app.eval4D( 490, 'Data file' );
	this.tables = [];

	var schema = app.schema;
	for( var i in schema ) {
		this.tables.push( new Table( schema[i] ) );
	}
	
	// Define a function on the tables array, so we can easily register an event for each table
	this.tables.on = function( event, callback ) {
		this.forEach( function( table ) {
			table.on( event, callback );
		} ); 
	}
}

Database.prototype.table = function( name )
{
	for( var i in this.tables )
	{
		if( this.tables[i].name === name )
			return this.tables[i];
	}

	return null;
}

Database.prototype.beginTransaction = function()
{
	app.eval4D( 239, 'START TRANSACTION' );
}

Database.prototype.commitTransaction = function()
{
	app.eval4D( 240, 'VALIDATE TRANSACTION' );
}

Database.prototype.rollbackTransaction = function()
{
	app.eval4D( 241, 'CANCEL TRANSACTION' );
}

Database.prototype.transactionLevel = function()
{
	return app.eval4D( 961, 'Transaction level' );
}

// MARK: TableEvent

// Constants for table events
var TableEvent = {
	CREATE: 'create',
	VALIDATE: 'validate',
	SAVE: 'save',
	DELETE: 'delete'
};

// MARK: Table

// Define the Table object and functions
function Table( schema )
{
	// Call the EventEmitter super constructor
	EventEmitter.call( this );
	
	this.number = schema.number;
	this.name = schema.name;
	this.fields = [];
	
	for( var i in schema.fields ) {
		this.fields.push( new Field( schema.fields[i] ) );
	}
	
	// Define a calculated property for the record count in the table
	Object.defineProperty( this, 'count', { configurable: false, enumerable: true, get: function() {
		var count = app.eval4D( 83, 'Records in table', '([' + this.name + '])' );
		return count;
	} } );
}

Table.prototype.field = function( name )
{
	for( var i in this.fields )
	{
		if( this.fields[i].name === name )
			return this.fields[i];
	}
	
	return null;
}

Table.prototype.all = function()
{
	app.eval4D( 47, 'ALL RECORDS', '([' + this.name + '])' );
	var selection = new Selection( this );
	return selection;
}

Table.prototype.query = function( expression, params )
{
	if( typeof params != 'object' )
		params = Array.prototype.slice.call( arguments, 1 );
	
	try {
		expression = StringUtils.encodeFormula( expression, params );
		app.eval4D( 48, 'QUERY BY FORMULA', '([' + this.name + '];' + expression + ')' );
	}
	catch( error ) {
		console.error( 'Table.query table [' + this.name + ']:', error.message, error.stack );
	}
	return new Selection( this );
}

Table.prototype.find = function( fieldname, value )
{
	if( arguments.length == 1 ) {
		value = arguments[0];
		fieldname = this.name + '.' + 'ID';
	}
	if( fieldname.indexOf( '.' ) == -1 ) {
		fieldname = this.name + '.' + fieldname;
	}
	
	return this.query( '(' + fieldname +' = $0)', value ).record();
}

Table.prototype.createRecord = function( options )
{
	app.eval4D( 68, 'CREATE RECORD', '([' + this.name + '])' );
	var record = app.getRecord( '[' + this.name + ']', options );

	if( record != null )
	{
		// Call the Record constructor using record as this
		Record.call( record, this, -3 );
		this.emit( TableEvent.CREATE, record );
	}

	return record;
}

// MARK: Field

// Define the Field object and functions
function Field( schema )
{
	this.tablenr = schema.tablenr;
	this.fieldnr = schema.fieldnr;
	this.name = schema.name;
	this.typenr = schema.typenr;
	this.type = Field.types[schema.typenr];
	this.indexed = schema.indexed;
	this.flags = schema.flags;
	if( schema.length )
		this.length = schema.length;
	if( schema.relatedField )
		this.relatedField = schema.relatedField;
}

Field.types = {
	0: 'alpha',
	1: 'real',
	2: 'text',
	3: 'picture',
	4: 'date',
	6: 'boolean',
	7: 'subtable',
	8: 'integer',
	9: 'longint',
	11: 'time',
	25: 'longlong',
	35: 'float',
	38: 'object'
};

// MARK: Selection

// Define the Selection object and functions
function Selection( table )
{
	assert( table instanceof Table, 'Table object expected' );

	this.id = UUID.new();
	this.table = table;
	
	var __records = [];
	var __position = 0;

	Object.defineProperty( this, 'records', {
		configurable: false,
		enumerable: false,
		writable: true,
		value: __records
	} );
	
	Object.defineProperty( this, 'count', {
		configurable: false,
		enumerable: true,
		get: function(){
			return this.records.length;
	  }
	} );
	
	Object.defineProperty( this, 'position', {
		configurable: false,
		enumerable: true,
		get: function() {
			return __position;
		},
		set: function( value ) {
			if( value < -1 )
				value = -1;
			if( value > this.records.length )
				value = this.records.length;
			__position = value;
		}
	} );
	
	this.copy();
}

Selection.prototype.copy = function()
{
	app.eval4D( 221, 'ARRAY LONGINT', '(NTK_Selection_RecordNrs;0)' );
	app.eval4D( 647, 'LONGINT ARRAY FROM SELECTION', '([' + this.table.name + '];NTK_Selection_RecordNrs)' );
	this.records = app.getVariable( 'NTK_Selection_RecordNrs' );
}

Selection.prototype.use = function()
{
	app.eval4D( 221, 'ARRAY LONGINT', '(NTK_Selection_RecordNrs;0)' );
	app.setVariable( 'NTK_Selection_RecordNrs', this.records );
	app.eval4D( 640, 'CREATE SELECTION FROM ARRAY', '([' + this.table.name + '];NTK_Selection_RecordNrs)' );
	app.eval4D( 221, 'ARRAY LONGINT', '(NTK_Selection_RecordNrs;0)' );
}

Selection.prototype.first = function()
{
	this.position = 0;
	return this;
}

Selection.prototype.last = function()
{
	this.position = this.records.length - 1;
	return this;
}

Selection.prototype.previous = function()
{
	this.position--;
	return this;
}

Selection.prototype.next = function()
{
	this.position++;
	return this;
}

Selection.prototype.goto = function( index )
{
	if( this.position != index )
		this.position = index;
	
	var recordNr = this.records[this.position];
	app.eval4D( 242, 'GOTO RECORD', '([' + this.table.name + '];' + recordNr + ')' );
	return this;
}

Selection.prototype.beforeSelection = function()
{
	return ( this.position == -1 );
}

Selection.prototype.endSelection = function()
{
	return ( this.position >= this.records.length );
}

Selection.prototype.forEach = function( callback, options )
{
	var count = this.count;
	for( var i = 0 ; i < count ; i++ ) {
		var record = this.goto( i ).record();
		callback( record );
	}
}

Selection.prototype.toArray = function( options )
{
	var array = [];
	var count = this.count;
	
	for( var i = 0 ; i < count ; i++ ) {
		this.goto( i );
		var record = app.getRecord( '[' + this.table.name + ']', options );
		array.push( record );
	}

	return array;
}

Selection.prototype.query = function( expression, params )
{
	if( typeof params != 'object' )
		params = Array.prototype.slice.call( arguments, 1 );
	
	try {
		this.use();
		expression = StringUtils.encodeFormula( expression, params );
		app.eval4D( 207, 'QUERY SELECTION BY FORMULA', '([' + this.table.name + '];' + expression + ')' );
	}
	catch( error ) {
		console.error( 'Selection.query table [' + this.table.name + ']:', error.message, error.stack );
	}

	return new Selection( this.table );
}

Selection.prototype.orderBy = function( expression )
{
	try {
		this.use();
		if( arguments.length > 1 ) {
			expression = Array.prototype.join.call( arguments, ';' );
		}
		expression = StringUtils.encodeFormula( expression, null );
		app.eval4D( 49, 'ORDER BY', '([' + this.table.name + '];' + expression + ')' );
		this.copy();
		return this;
	}
	catch( error ) {
		console.error( 'Selection.orderBy table [' + this.table.name + ']:', error.message, error.stack );
	}
}

Selection.prototype.record = function( options )
{
	if( this.beforeSelection() || this.endSelection() ) {
		return null;
	}
	
	this.goto( this.position );
	var recordNr = this.records[this.position];
	var record = app.getRecord( '[' + this.table.name + ']', options );

	if( record != null )
	{
		// Call the Record constructor using record as this
		Record.call( record, this.table, recordNr );
	}

	return record;
}

Selection.prototype.splice = function( start, count )
{
	var result = new Selection( this.table );
	result.records = this.records.splice( start, count );
	result.first();
	return result;
}

Selection.prototype.slice = function( start, end )
{
	var result = new Selection( this.table );
	result.records = this.records.slice( start, end );
	result.first();
	return result;
}

Selection.prototype.filter = function( callback )
{
	var result = new Selection( this.table );
	result.records = [];
	
	var count = this.count;
	for( var i = 0 ; i < count ; i++ ) {
		var record = this.goto( i ).record();
		if( callback( record ) )
			result.records.push( record.recordNr );
	}
	
	return result;
}

Selection.prototype.reduce = function( callback, initialValue )
{
	var result = initialValue;
	
	var count = this.count;
	for( var i = 0 ; i < count ; i++ ) {
		var record = this.goto( i ).record();
		result = callback( result, record, i, this );
	}
	
	return result;
}

// MARK: Record

// Define the Record object and functions
function Record( table, recordNr )
{
	assert( table instanceof Table, 'Table object expected' );
	assert( typeof recordNr == 'number', 'Record number expected' );
	
	// Set the object's prototype to Record.prototype
	// We need to do this because of the special way Record objects are created
	this.__proto__ = Record.prototype;
	
	Object.defineProperty( this, 'table', { enumerable: false, configurable: false, writable: false, value: table } );
	Object.defineProperty( this, 'recordNr', { enumerable: false, configurable: false, writable: true, value: recordNr } );
	
	// Define virtual properties to get or set related records
	var self = this;
	table.fields.forEach( function( field ) {
		if( !field.relatedField )
			return;
		Object.defineProperty( self, '$' + field.name, {
			enumerable: false,
			configurable: false,
			get: function() {
				return self.relate( field.name );
			},
			set: function( record ) {
				assert( record instanceof Record, 'Record object expected' );
				var field1 = field.name;
				var field2 = field.relatedField.substr( field.relatedField.indexOf( '.' ) + 1 );
				self[field1] = record[field2];
			}
		} );
	} );
}

Record.prototype.isNew = function()
{
	return ( this.recordNr == -3 );
}

Record.prototype.goto = function()
{
	if( this.isNew() ) {
		app.eval4D( 68, 'CREATE RECORD', '([' + this.table.name + '])' );
	} else {
		app.eval4D( 242, 'GOTO RECORD', '([' + this.table.name + '];' + this.recordNr + ')' );
	}
}

Record.prototype.lock = function()
{
	app.eval4D( 146, 'READ WRITE', '([' + this.table.name + '])' );
	this.goto();
	
	if( this.isNew() )
		return true;
	else if( !this.locked() )
		return true;
	
	var processID = ( 322, 'Current Process' );
	var count = 0;
	var delay = 30;
	var maxRetries = 10;

	while( this.locked() & count < maxRetries )
	{
		count++;
		app.eval4D( 323, 'DELAY PROCESS', '(' + processID + ';' + delay +')' );
		app.eval4D( 52, 'LOAD RECORD', '([' + this.table.name + '])' );
	}
	
	return !this.locked();
}

Record.prototype.locked = function()
{
	this.goto();
	return app.eval4D( 147, 'Locked', '([' + this.table.name + '])' );
}

Record.prototype.validate = function()
{
	this.table.emit( TableEvent.VALIDATE, this );
}

Record.prototype.save = function()
{
	if( this.lock() ) {
		this.table.emit( TableEvent.SAVE, this );
		app.setRecord( '[' + this.table.name + ']', this );
		app.eval4D( 53, 'SAVE RECORD', '([' + this.table.name + '])' );
	
		if( this.recordNr == -3 ) {
			this.recordNr = app.eval4D( 243, 'Record number', '([' + this.table.name + '])' );
			if( this.hasOwnProperty( "ID" ) ) {
				this.ID = app.eval4D( '[' + this.table.name + ']ID' );;
			}
		}
	}
}

Record.prototype.delete = function()
{
	if( this.lock() ) {
		this.table.emit( TableEvent.DELETE, this );
		app.eval4D( 58, 'DELETE RECORD', '([' + this.table.name + '])' );
	}
}

Record.prototype.relate = function( fieldname )
{
	var record = null;
	var field = this.table.field( fieldname );
	if( field && field.relatedField ) {
		var items = field.relatedField.split( '.' );
		record = db.table( items[0] ).find( items[1], this[fieldname] );
	}
	
	return record;
}

Record.prototype.patch = function( values )
{
	// Update the field values, using the values in the given object
	for( var field in values ) {
		if( this.hasOwnProperty( field ) )
			this[field] = values[field];
	}
}

// MARK: RecordSet

// Define the RecordSet object and functions. This is the equivalent of a 4D Set
function RecordSet( selection )
{
	var table = selection;
	if( selection instanceof Selection ) {
		table = selection.table;
		selection.use();
	}
	
	assert( table instanceof Table, 'Table object expected' );

	this.id = UUID.new();
	this.table = table;

	app.eval4D( 116, 'CREATE SET', '([' + this.table.name + '];"' + this.id + '")' );
	
	Object.defineProperty( this, 'count', {
		configurable: false,
		enumarable: true,
		get: function() {
			return app.eval4D( 195, 'Records in set', '("' + this.id +'")' );
		}
	} );
}

// Register a finalizer to clean-up the named set when the variable gets out of scope
Duktape.fin( RecordSet.prototype, function( set ) {
	app.eval4D( 117, 'CLEAR SET', '("' + set.id +'")' );
} );

RecordSet.prototype.selection = function()
{
	var count = app.eval4D( 118, 'USE SET', '("' + this.id +'")' );
	return new Selection( this.table );
}

RecordSet.prototype.union = function( set )
{
	assert( set instanceof RecordSet, 'Set object expected' );
	app.eval4D( 120, 'UNION', '("' + this.id + '";"' + set.id + '";"' + this.id + '")' );
}

RecordSet.prototype.difference = function( set )
{
	assert( set instanceof RecordSet, 'Set object expected' );
	app.eval4D( 122, 'DIFFERENCE', '("' + this.id + '";"' + set.id + '";"' + this.id + '")' );
}

RecordSet.prototype.intersection = function( set )
{
	assert( set instanceof RecordSet, 'Set object expected' );
	app.eval4D( 121, 'INTERSECTION', '("' + this.id + '";"' + set.id + '";"' + this.id + '")' );
}

RecordSet.prototype.add = function()
{
	app.eval4D( 119, 'ADD TO SET', '([' + this.table.name + '];"' + this.id + '")' );
}

RecordSet.prototype.remove = function()
{
	app.eval4D( 561, 'REMOVE FROM SET', '([' + this.table.name + '];"' + this.id + '")' );
}

RecordSet.prototype.toString = function()
{
	return 'RecordSet [' + this.table.name + '];"' + this.id + '": ' + this.count + ' records';
}

// MARK: HTTPClient

function HTTPClient()
{
	this.request = {
		method: '',
		url: '',
		headers: {},
		body: null
	};
	
	this.response = {
		headers: {},
		body: null,
		status: 0
	};
	
	this.authentication = {};
}

HTTPClient.prototype.header = function( name, value )
{
	if( value ) {
		this.request.headers[name] = value;
		return this;
	} else {
		return this.response.headers[name];
	}
}

HTTPClient.prototype.type = function( type )
{
	// Check if the type is one of the following shortcuts
	if( type == "form" ) type = "application/x-www-form-urlencoded";
	if( type == "json" ) type = "application/json";
	if( type == "jsonp" ) type = "application/javascript";
	if( type == "xml" ) type = "application/xml";
	
	// Set the content type header
	this.header( "Content-Type", type );
	
	return this;
}

HTTPClient.prototype.setAuthentication = function( name, password, method )
{
	this.authentication = {
		method: method,
		user: name,
		password: password
	};
	
	if( method == "basic" )
		method = 1;
	else if( method == "digest" )
		method = 2;
	else
		method = 1;
		
	app.eval4D( 1161, 'HTTP AUTHENTICATE', '("' + name + '";"' + password + '";' + method + ')' );
}

HTTPClient.buildQueryString = function( object, prefix )
{
	var items = [];
	
	for( var property in object )
	{
		if(object.hasOwnProperty( property ) )
		{
			var key = prefix ? prefix + "[" + property + "]" : property;
			var value = object[property];
			if( typeof value == "object" )
				items.push( HTTPClient.buildQueryString( value, key ) );
			else
				items.push( encodeURIComponent( key ) + "=" + encodeURIComponent( value ) );
		}
	}
	return items.join( "&" );
}

HTTPClient.prototype.send = function( method, url, params )
{
	this.request.method = method;
	this.request.url = url;
	this.request.body = params;
	
	// If the params are an object, then encode it using URL encoding or JSON encoding
	if( typeof params == "object" )
	{
		if( method == "GET" )
		{
			this.request.url += ( "?" + HTTPClient.buildQueryString( params ) );
			this.request.body = "";
		}
		else if( this.request.headers["Content-Type"] && this.request.headers["Content-Type"].indexOf( "json" ) != -1   )
		{
			this.request.body = JSON.stringify( params );
		}
		else
		{
			this.request.body = HTTPClient.buildQueryString( params );
		}
	}
	
	var headerNames = [];
	var headerValues = [];
	for( var key in this.request.headers )
	{
		headerNames.push( key );
		headerValues.push( this.request.headers[key] );
	}
	
	app.eval4D( 284, 'C_TEXT', '(NTK_HTTP_Method;NTK_HTTP_URL;NTK_HTTP_Data;NTK_HTTP_Response)' );
	app.eval4D( 283, 'C_LONGINT', '(NTK_HTTP_Status)' );
	app.eval4D( 222, 'ARRAY TEXT', '(NTK_HTTP_HeaderNames;0)' );
	app.eval4D( 222, 'ARRAY TEXT', '(NTK_HTTP_HeaderValues;0)' );

	app.setVariable( 'NTK_HTTP_Method', this.request.method );
	app.setVariable( 'NTK_HTTP_URL', this.request.url );
	app.setVariable( 'NTK_HTTP_Data', this.request.body );
	app.setVariable( 'NTK_HTTP_Response', '' );
	app.setVariable( 'NTK_HTTP_HeaderNames', headerNames );
	app.setVariable( 'NTK_HTTP_HeaderValues', headerValues );
	
	this.response.status = app.eval4D( 1158, 'HTTP Request', '(NTK_HTTP_Method;NTK_HTTP_URL;NTK_HTTP_Data;NTK_HTTP_Response;NTK_HTTP_HeaderNames;NTK_HTTP_HeaderValues)' );
	
	this.response.body = app.getVariable( 'NTK_HTTP_Response' );
	headerNames = app.getVariable( 'NTK_HTTP_HeaderNames' );
	headerValues = app.getVariable( 'NTK_HTTP_HeaderValues' );
	
	this.response.headers = {};
	for( var i in headerNames )
	{
		this.response.headers[headerNames[i]] = headerValues[i];
	}
	
	// If the returned data, is JSON then parse it automatically
	if( this.header( 'Content-Type' ) == 'application/json' || this.header( 'Content-Type' ) == 'text/json' )
	{
		var json = JSON.parse( this.response.body );
		if( json )
			this.response.body = json;
	}
	
	return this.response.body;
}

HTTPClient.methods = [ 'get', 'post', 'put', 'patch', 'delete', 'head' ];

HTTPClient.methods.forEach( function( method ) {
	HTTPClient.prototype[method] = function( url, params ) {
		return this.send( method.toUpperCase(), url, params );
	}
} );

// MARK: Stack

function Stack()
{
	this.items = [];
}

Stack.prototype.push = function( item )
{
	this.items.push( item );
}

Stack.prototype.pop = function()
{
	return this.items.pop();
}

Stack.prototype.peek = function()
{
	return this.items[items.length - 1];
}

Stack.prototype.isEmpty = function()
{
	return ( this.items.length == 0 );
}

Stack.prototype.length = function()
{
	return this.items.length;
}

Stack.prototype.clear = function()
{
	this.items = [];
}

Stack.prototype.toString = function()
{
	return this.items.toString();
}

// MARK: Queue

function Queue()
{
	this.items = [];
}

Queue.prototype.enqueue = function( item )
{
	this.items.push( item );
}

Queue.prototype.dequeue = function()
{
	return this.items.shift();
}

Queue.prototype.peek = function()
{
	return this.items[0];
}

Queue.prototype.isEmpty = function()
{
	return ( this.items.length == 0 );
}

Queue.prototype.length = function()
{
	return this.items.length;
}

Queue.prototype.clear = function()
{
	this.items = [];
}

Queue.prototype.toString = function()
{
	return this.items.toString();
}

// MARK: EventEmitter

function EventEmitter()
{
	// If this inherits from EventEmitter, then we need to set the prototype for the super class
	if( this.__proto__ != EventEmitter.prototype )
		this.__proto__.__proto__ = EventEmitter.prototype;
	
	// Define events as a non-enumerable property
	Object.defineProperty( this, 'events', { configurable: false, enumarable: false, writable: true, value: {} } );
}

EventEmitter.prototype.on = function( event, callback )
{
	if( !this.events[event] )
		this.events[event] = [];
	this.events[event].push( callback );
	return this;
}

EventEmitter.prototype.once = function( event, callback )
{
	// This callback should run only once
	callback.once = true;
	this.on( event, callback );
	return this;
}

EventEmitter.prototype.emit = function( event, args )
{
	if( this.events[event] ) {
		// Fill an array with the arguments to pass to the listener function
		var args = Array.prototype.slice.call( arguments, 1 );
		// Inside the callback, 'this' always refers to the EventEmitter object
		var self = this;
		// Filter callbacks that only need to run once
		this.events[event] = this.events[event].filter( function( callback ) {
			callback.apply( self, args );
			return ( !callback.once );
		} );
	}
}

EventEmitter.prototype.remove = function( event, callback )
{
	if( this.events[event] ) {
		if( callback == undefined ) {
			// Remove all listeners
			this.events[event] = [];
		} else {
			// Remove only the given listener
			var index = this.events[event].indexOf( callback );
			if( index != -1 )
				this.events[event].splice( index, 1 );
		}
	}
}

// MARK: Time

function Time( value )
{
	// The number of seconds since midnight
	this.value = 0;
	
	// If value is undefined, then intialize to current time
	if( value == undefined ) {
		value = new Date();
	}
	
	this.set( value );
}

Time.prototype.set = function( value )
{
	// Set the time value depending on the argument type
	if( typeof value == 'number' ) {
		this.value = value;
	}
	else if( typeof value =='string' ) {
		var items = value.split( ':' );
		if( items.length == 3 ) {
			this.value = Number( items[0] )* 3600 + Number( items[1] * 60 ) + Number( items[2] );
		} else if( items.length == 2 ) {
			this.value = Number( items[0] )* 3600 + Number( items[1] * 60 );
		} else {
			this.value = Number( items[0] );
		}
	}
	else if( value instanceof Date ) {
		this.value = ( value.getHours() * 3600 ) + ( value.getMinutes() * 60 ) + value.getSeconds();
	}
	else if( value instanceof Time ) {
		this.value = value.value;
	}
	else {
		this.value = 0;
	}
}

Time.prototype.valueOf = function()
{
	return this.value;
}

Time.prototype.toString = function()
{
	return this.format( 'HH:MM:SS' );
}

Time.prototype.toJSON = function()
{
	return this.format( 'HH:MM:SS' );
}

Time.prototype.getHours = function()
{
	return Math.round( this.value / 3600 - 0.5 );
}

Time.prototype.getMinutes = function()
{
	return Math.round( ( this.value / 60 ) % 60  - 0.5 );
}

Time.prototype.getSeconds = function()
{
	return Math.round( this.value % 60  - 0.5 );
}

Time.prototype.format = function( format )
{
	if( format == undefined ) {
		format = 'HH:MM:SS';
	}
	
	// Format the time according to one of the following formats
	if( format == 'HH:MM' )
		return ('00'+this.getHours()).slice(-2) + ':' + ('00'+this.getMinutes()).slice(-2);
	else if( format == 'HH:MM:SS' )
		return ('00'+this.getHours()).slice(-2) + ':' + ('00'+this.getMinutes()).slice(-2) + ':' + ('00'+this.getSeconds()).slice(-2);
}

Time.prototype.add = function( time )
{
	// Make sure time is an instance of the class Time
	if( time instanceof Time == false ) {
		time = new Time( time );
	}
	
	// Now we can add the number of seconds
	this.value += time.value;
}

// MARK: Request

function Request()
{
	this.localAddress = app.getVariable( 'HTTPD_LocalAddress' );
	this.localPort = app.getVariable( 'HTTPD_LocalPort' );
	this.remoteAddress = app.getVariable( 'HTTPD_RemoteAddress' );
	this.method = app.getVariable( 'HTTPD_RequestMethod' );
	this.method = this.method.toLowerCase();
	this.uri = app.getVariable( 'HTTPD_RequestURI' );
	this.protocol = app.getVariable( 'HTTPD_RequestProtocol' );
	this.documentURI = app.getVariable( 'HTTPD_DocumentURI' );
	this.queryString = app.getVariable( 'HTTPD_QueryString' );
	this.secure = app.getVariable( 'HTTPD_IsSecure' );
	this.body = app.getVariable( 'HTTPD_RequestBody' );

	this.headers = {};
	var names = app.getVariable( 'HTTPD_InHeaderName' );
	var values = app.getVariable( 'HTTPD_InHeaderValue' );
	for( var i = 0 ; i < names.length ; i++ )
	{
		this.headers[names[i]] = values[i];
	}

	// The route parameters
	this.params = {};
	
	// The parameters in the query string
	this.query = Request.decodeURIValues( this.queryString );
	
	// The parameters in the body part
	var contentType = this.header( 'Content-Type' );
	if( contentType && contentType.indexOf( 'application/x-www-form-urlencoded' ) >= 0 ) {
		this.body = Request.decodeURIValues( this.body.toString() );
	}
	else if( contentType && contentType.indexOf( 'application/json' ) >= 0 ) {
		this.body = JSON.parse( this.body.toString() );
	}
}

Request.decodeURIValues = function( values )
{
	var params = {};
	
	values.split('&').forEach( function ( item ) {
		item = decodeURIComponent( item );
		var pair = item.split( '=' );
		params[pair[0]] = pair[1];
	} );
	
	return params;
}

Request.prototype.header = function( name, value )
{
	if( value ) {
		this.headers[name] = value;
		return this;
	} else {
		return this.headers[name];
	}
}

Request.prototype.param = function( name, defaultValue )
{
	if( this.params[name] ){
		return this.params[name];
	} else if( this.body[name] ){
		return this.body[name];
	} else if( this.query[name] ){
		return this.query[name];
	} else {
		return defaultValue;
	}
}

// MARK: Response

function Response()
{
	this.statusCode = app.getVariable( 'HTTPD_Status' );
	this.headersSent = app.getVariable( 'HTTPD_HeadersSent' );

	this.headers = {};
	var names = app.getVariable( 'HTTPD_OutHeaderName' );
	var values = app.getVariable( 'HTTPD_OutHeaderValue' );
	for( var i = 0 ; i < names.length ; i++ )
	{
		this.headers[names[i]] = values[i];
	}

	this.body = '';
	this.filename = '';
}

Response.prototype.header = function( name, value )
{
	if( value ) {
		this.headers[name] = value;
		return this;
	} else {
		return this.headers[name];
	}
}

Response.prototype.send = function( data )
{
	this.body += data;
	return this;
}

Response.prototype.sendFile = function( path )
{
	if( File.isFile( path ) )
	{
		this.filename = path;
		var extension = File.extension( path );
		this.type( extension );
		var file = new File( path );
		this.header( 'Content-Length', file.length );
		file.close();
	}
	else
	{
		throw new Error( 'File not found: ' + path );
	}

	return this;
}

Response.prototype.render = function( template, data, partials )
{
	var path = app.resolvePath( template );
	if( !path )
	{
		throw new Error( 'Template not found: ' + template );
	}

	var parentFolder = File.parent( path );
	var extension = File.extension( path );
	if( partials == undefined )
		partials = {};
	
	var hogan = require( 'lib/hogan' );
	var template = File.readFile( path, "" );
	
	function parsePartials( source )
	{
		// Fill an array with partials, by scanning the template source code
		var list = [];
		var tokens = hogan.scan( source );
		for( var i in tokens ) {
			if( tokens[i].tag == '>' )
				list.push( tokens[i].n );
		}
		return list;
	}
	
	function makePartials( list )
	{
		// Iterate over the list of partials 
		for( var i in list ) {
			var name = list[i];
			// Check if the partial is already loaded
			if( partials[name] != undefined )
				continue;
			
			var filename = parentFolder + name;
			if( !File.extension( filename ) )
				filename += '.' + extension;
			// Read the partial's source code
			var source = File.readFile( filename, '' );
			if( !source )
				continue;
			
			// Store the partial's source code and parse it recursively
			partials[name] = source;
			var subList = parsePartials( source );
			if( subList.length > 0 )
				makePartials( subList ); 
		}
	}
	
	makePartials( parsePartials( template ) );
	template = hogan.compile( template );
	var result = template.render( data, partials );

	this.type( 'html' );
	this.send( result );
	return this;
}

Response.prototype.json = function( object )
{
	this.type( 'json' );
	this.send( JSON.stringify( object ) );
	return this;
}

Response.prototype.error = function( error, message, status )
{
	var err = { error: error, message: message };
	this.status( status || 400 ).json( err );
	return this;
}

Response.prototype.status = function( code )
{
	this.statusCode = code;
	return this;
}

Response.prototype.type = function( type )
{
	// Fill a lookup table with common mimetypes
	var mimeTypes = {};
	mimeTypes.html = 'text/html';
	mimeTypes.txt = 'text/plain';
	mimeTypes.xml = 'text/xml';
	mimeTypes.css = 'text/css';
	mimeTypes.js = 'application/x-javascript';
	mimeTypes.json = 'application/json';
	mimeTypes.jwt = 'application/jwt';
	mimeTypes.md = 'text/markdown';
	mimeTypes.gif = 'image/gif';
	mimeTypes.jpg = 'image/jpeg';
	mimeTypes.png = 'image/png';
	mimeTypes.pdf = 'application/pdf';
	mimeTypes.swf = 'application/x-shockwave-flash';
	mimeTypes.doc = 'application/msword';
	mimeTypes.xls = 'application/vnd.ms-excel';
	mimeTypes.ppt = 'application/vnd.ms-powerpoint';
	mimeTypes.zip = 'application/zip';
	mimeTypes.mp3 = 'audio/mpeg';
	mimeTypes.bin = 'application/binary';

	type = mimeTypes[type] || mimeTypes.bin;

	// Set the content-type header
	this.header( 'Content-Type', type );

	return this;
}

Response.prototype.redirect = function( url )
{
	this.status( '301 Moved Permanently' );
	this.header( 'Location', url );
}

// MARK: Session

function Session( id )
{
	this.id = id || UUID.new();
	this.params = {};
	this.expires = new Date() + Session.duration;
	this.load();
}

Session.prototype.param = function( name, value )
{
	if( value ) {
		this.params[name] = value;
		return this;
	} else {
		return this.params[name];
	}
}

Session.prototype.load = function()
{
	var selection = db.table( 'Session' ).query( 'Session.ID = $0', this.id );
	if( selection.count > 0 )
	{
		var record = selection.record();
		record.params = JSON.parse( record.params );
	}
}

Session.prototype.save = function()
{
	var selection = db.table( 'Session' ).query( 'Session.ID = $0', this.id );
	var record = null;

	if( selection.count == 0 )
	{
		record = db.table( 'Session' ).createRecord();
		record.ID = this.id;
	}
	else
	{
		record = selection.record();
	}

	record.Params = JSON.stringify( this.data );
	record.save();
}

Session.cookie = 'NTK_SID';
Session.duration = 60 * 60 * 1000;

Session.initSession = function( request, response, next )
{
	var cookie = request.header( 'Cookie' ) || "";
	var matches = cookie.match( new RegExp( Session.cookie + '\\s*=\\s*([\\w-]+);?' ) );
	var sessionID = matches ? matches[1] : null;
	
	request.session = new Session( sessionID );
	response.header( 'Set-Cookie', Session.cookie + '=' + request.session.id + ';' );

	next();
}

// MARK: Router

function Router( method, path, handlers )
{
	this.method = method.toLowerCase();
	this.path = path;
	this.handlers = handlers;
}

Router.prototype.route = function( request, response )
{
	// Check if the request methods match
	if( this.method !== request.method && this.method !== 'all' )
		return false;

	// Split the path and the URL on the slash character
	var items1 = this.path.split( '/' );
	var items2 = request.path.split( '/' );
	var match = false;
	var done = false;
	var params = {};

	// Check if the path matches the URL
	if( items1.length > items2.length )
		return false;

	for( var i = 0 ; i < items1.length ; i++ )
	{
		if( items1[i].charAt(0) === ':' )
		{
			// If the path item starts with a colon, add its value to the request parameters
			var name = items1[i].substr( 1 );
			params[name] = items2[i];
			match = true;
		}
		else if( items1[i] === items2[i] || items1[i] === '*' )
		{
			match = true;
		}
		else
		{
			match = false;
			break;
		}
	}

	// If we have a match, run the callback method
	if( match )
	{
		request.params = params;
		for( var i in this.handlers )
		{
			// This nested function tells whether we should continue handling the request
			function next() { done = false; }

			// Call the request handler(s)
			done = true;
			this.handlers[i].call( this, request, response, next );
			if( done )
				break;
		}
	}

	return done;
}

// MARK: WebApp

function WebApp()
{
	this.routes = [];
	this.mountpath = '';
}

WebApp.prototype.route = function( request, response )
{
	var done = false;
	
	if( this.mountpath && request.documentURI.indexOf( this.mountpath ) != 0 )
		return;
		
	// Remove the mountpath from the URL
	request.path = request.documentURI.slice( this.mountpath.length );

	for( var i in this.routes )
	{
		if( this.routes[i].route( request, response ) ) {
			done = true
			break;
		}
	}
	
	return done;
}

// Add functions for the following HTTP methods to the prototype
WebApp.prototype.methods = [ 'get', 'post', 'put', 'patch', 'delete', 'head', 'all' ];

WebApp.prototype.methods.forEach( function( method ) {
	WebApp.prototype[method] = function ( path, handler ) {
		// Handlers can be passed as a single argument, multiple arguments or as an array
		// Combine all handlers into an array
		var handlers = [];

		for( var i = 1 ; i < arguments.length ; i++ )
		{
			if( arguments[i] instanceof Array )
				handlers = handlers.concat( arguments[i] );
			else if( typeof arguments[i] == 'function' )
				handlers.push( arguments[i] );
			else
				throw new Error( 'Route.' + method + ' ' + path + ' expected a handler function for argument ' + i );
		}

		this.routes.push( new Router( method, path, handlers ) );
	}
} );

WebApp.prototype.use = function( path, subApp )
{
	assert( subApp instanceof WebApp, 'WebApp object expected' );

	// Set the mountpath and add the subApp to the routes
	subApp.mountpath = path;
	this.routes.push( subApp );
}

WebApp.prototype.static = function( path, root )
{
	// Serve static content using the given root directory
	this.get( path, function( request, response, next) {
		var filename = root + request.path.slice( this.path.length - 1 );
		if( File.isFile( filename ) )
			resp.sendFile( filename );
		else
			next();
	} );
}

WebApp.prototype.send = function( resp )
{
	assert( resp instanceof Response, 'Response object expected' );

	app.setVariable( 'HTTPD_Status', resp.statusCode );

	var headerNames = [];
	var headerValues = [];

	for( var key in resp.headers )
	{
		headerNames.push( key );
		headerValues.push( resp.headers[key] );
	}

	app.setVariable( 'HTTPD_OutHeaderName', headerNames );
	app.setVariable( 'HTTPD_OutHeaderValue', headerValues );
	app.setVariable( 'HTTPD_Response', resp.body );
	app.setVariable( 'HTTPD_SendFileName', resp.filename );
}

// Initialise the global console and db variables
var console = new Console();
var db = new Database();
