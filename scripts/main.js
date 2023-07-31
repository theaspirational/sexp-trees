'use strict';

var AstRenderer = require('./astrenderer.js');
var Sexp = require('sexp');
var Vector = require('victor');

// http://stackoverflow.com/a/4253415
String.prototype.escape = function() {
    return this.replace(/\n/g, "\\n")
        .replace(/\"/g, '\\"')
        .replace(/\t/g, "\\t")
};

var hotkeysEnabled = true;
var timeoutId = null;
var astRenderer = null; // create in init()
var activeRenderer = null; // keep track of renderer currently being used
var isDragging = false;
var enablePlusMinusScale = true;

function setError(err) {
    // $("#feedback").text("Error");
    $("#feedback").text(err);
}

function clearError() {
    $("#feedback").text("");
}

function cancelTimeout() {
    if (timeoutId !== null) {
	clearTimeout(timeoutId);
	timeoutId = null;
    }
}

// parse sexp and load tree
function parse() {
    let editor = ace.edit("editor");
    var txt = editor.getValue();
    console.log('parsing: ' + txt);
    try {
	const sexp = Sexp(txt);
	clearError();
	activeRenderer.reset();
	activeRenderer.addAst(sexp);
	activeRenderer.initScale();
	activeRenderer.initPositions();
	activeRenderer.optimize();
    }
    catch (err) {
	console.log(err);
	setError(err);
    }
}

var editorWidthOverride = null;
var x_margin = 75;
var y_margin = 135;

var editorShift = 0;

// fit everything to the screen
function rescale() {
    const screen_width = window.innerWidth
	  || document.documentElement.clientWidth
	  || document.body.clientWidth;
    const screen_height = window.innerHeight
	  || document.documentElement.clientHeight
	  || document.body.clientHeight;
    console.log("width: " + screen_width + ", height: " + screen_height);

    let w = screen_width - x_margin;
    let h = screen_height - y_margin; // vertical space available

    if (editorWidthOverride) {
	var editor_width = editorWidthOverride * w;
    }
    // give editor 80 columns or half the width if not enough space
    else {
	editor_width = Math.min(545, w / 2) + editorShift;
    }
    $("#editor").css("width", editor_width);
    $("#feedback").css("width", editor_width - 4); // minus left margin

    $("#maintdleft").css("width", editor_width);
    $("#maintdright").css("width", w - editor_width);

    let astCanvas = document.getElementById("astcanvas");
    astCanvas.width = w - editor_width - 15;

    astCanvas.height = h;
    $("#editor").css("height", h);

    // refresh editor
    let editor = ace.edit("editor");
    editor.resize();

    // refresh renderers
    activeRenderer.refresh();
}

function increaseFontSize(editor) {
    editor.setOption("fontSize", editor.getOption("fontSize") + 1);
    editor.resize();
}

function decreaseFontSize(editor) {
    editor.setOption("fontSize",
		     Math.max(6, editor.getOption("fontSize") - 1));
    editor.resize();
}

// compute mouse pos relative to canvas given event object
function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

var scrollSpeed = 20;

function scrollLeft(evt) {
    if (activeRenderer) {
	if (evt) {
	    evt.preventDefault();
	}
	activeRenderer.translate(new Vector(scrollSpeed, 0));
    }
}

function scrollUp(evt) {
    if (activeRenderer) {
	if (evt) {
	    evt.preventDefault();
	}
	activeRenderer.translate(new Vector(0, scrollSpeed));
    }
}

function scrollRight(evt) {
    if (activeRenderer) {
	if (evt) {
	    evt.preventDefault();
	}
	activeRenderer.translate(new Vector(-scrollSpeed, 0));
    }
}

function scrollDown(evt) {
    if (activeRenderer) {
	if (evt) {
	    evt.preventDefault();
	}
	activeRenderer.translate(new Vector(0, -scrollSpeed));
    }
}

function handleMouseWheel(e) {
    var delta = e.wheelDelta || -e.detail;
    if (delta < 0) {
	activeRenderer.scale(0.9);
    }
    else {
	activeRenderer.scale(1.1);
    }
}

// set up editors, canvases, and renderers
function init() {
    let editor = ace.edit("editor");
    editor.setTheme("ace/theme/chrome");
    editor.session.setMode("ace/mode/javascript");
    editor.session.setUseWorker(false);
    editor.setOption("showPrintMargin", false)
    editor.setOption("wrap", true)

    editor.on('change', function() {
	// Parse sexp and load tree
	parse();
    });

    editor.on('focus', function() {
	enablePlusMinusScale = false;
    });
    editor.on('blur', function() {
	enablePlusMinusScale = true;
    });

    $("#editorplusbutton").click(function() {
	increaseFontSize(editor);
    });
    $("#editorminusbutton").click(function() {
	decreaseFontSize(editor);
    });
    $("#editorleftbutton").click(function() {
	editorShift -= 25;
	rescale();
    });
    $("#editorrightbutton").click(function() {
	editorShift += 25;
	rescale();
    });

    // set up ast renderer
    let astCanvas = document.getElementById("astcanvas");
    astRenderer = new AstRenderer(astCanvas, editor);
    // We can reduce CPU usage a bit by limiting the FPS but it
    // becomes flickery when moving the tree around.. not sure why.
    // astRenderer.setFps(20);

    astCanvas.addEventListener('mousemove', function(evt) {
	let pos = getMousePos(astCanvas, evt);
	astRenderer.mousemove(pos);
	if (isDragging) {
	    astRenderer.translate(new Vector(evt.movementX, evt.movementY));
	}
    }, false);
    astCanvas.addEventListener('mousedown', function(evt) {
	isDragging = true;
    }, false);
    astCanvas.addEventListener('mouseup', function(evt) {
	let pos = getMousePos(astCanvas, evt);
	astRenderer.mouseclick(pos);
    }, false);
    astCanvas.addEventListener('mousewheel', handleMouseWheel, false);
    astCanvas.addEventListener('DOMMouseScroll', handleMouseWheel, false);

    $("#astplusbutton").click(function() {
	astRenderer.scale(1.1);
    });
    $("#astminusbutton").click(function() {
	astRenderer.scale(0.9);
    });
    $("#astleftbutton").click(function() {
	scrollLeft();
    });
    $("#astrightbutton").click(function() {
	scrollRight();
    });
    $("#astdownbutton").click(function() {
	scrollDown();
    });
    $("#astupbutton").click(function() {
	scrollUp();
    });

    astRenderer.resume();
    activeRenderer = astRenderer;

    $(window).mouseup(function(){
	isDragging = false;
    });

    setError();

    editor.setValue("(script_file (namespace name: (identifier) body: (namespace_body (context context_type: (context_type) body: (context_body (user_variables body: (user_variables_body assignment: (user_variable_assignment left: (typed_identifier type: (type) name: (identifier)) right: (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end))))))))) (context context_type: (context_type) body: (context_body (user_variables body: (user_variables_body assignment: (user_variable_assignment left: (typed_identifier type: (type) name: (identifier)) right: (false)))) (user_marks body: (user_marks_body mark: (typed_identifier type: (type) name: (identifier)))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters (default_parameter name: (identifier) value: (string (string_start) (string_content) (string_end)))) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))) (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (list (integer) (integer))) (boolean_block body: (boolean_block_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))) (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))))))) (init_block body: (init_body (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (call function: (identifier) arguments: (argument_list (identifier))))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))))) (sequence_block body: (sequence_body (expression_statement (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end))))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end))))) (if_statement condition: (parenthesized_expression (comparison_operator (identifier) (string (string_start) (string_content) (string_end)))) consequence: (block (expression_statement (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end))))))) (expression_statement (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end))))) (comment)))))) (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))))) (sequence_block body: (sequence_body (expression_statement (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end))))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters (identifier)) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))))) (sequence_block body: (sequence_body (expression_statement (overridable_call override: (identifier) arguments: (argument_list (identifier)) body: (block (expression_statement (assignment left: (identifier) right: (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end)))))) (expression_statement (overridable_call override: (identifier) arguments: (argument_list (identifier)) body: (block (expression_statement (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end))))) (expression_statement (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end)))))))))))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (runif_block body: (runif_body (comparison_operator (subscript value: (identifier) subscript: (attribute ctx: (identifier) attribute: (identifier))) (string (string_start) (string_content) (string_end))))) (sequence_block body: (sequence_body (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (true))) (expression_statement (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end)))))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (attribute ctx: (identifier) attribute: (identifier)) attribute: (identifier)) (integer)))) (sequence_block body: (sequence_body (expression_statement (call function: (identifier) arguments: (argument_list (string (string_start) (string_content) (string_end)))))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))))) (sequence_block body: (sequence_body (expression_statement (assignment left: (typed_identifier type: (type) name: (identifier)) right: (list (call function: (identifier) arguments: (argument_list)) (call function: (identifier) arguments: (argument_list)) (call function: (identifier) arguments: (argument_list)) (call function: (identifier) arguments: (argument_list)) (call function: (identifier) arguments: (argument_list))))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier)))) (expression_statement (assignment left: (identifier) right: (call function: (identifier) arguments: (argument_list (list (float) (float) (float) (float)) (identifier))))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier)))) (expression_statement (call function: (attribute ctx: (subscript value: (identifier) subscript: (integer)) attribute: (identifier)) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list)))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))))) (sequence_block body: (sequence_body (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (binary_operator left: (attribute ctx: (identifier) attribute: (identifier)) right: (integer))) (float)))) (expression_statement (call function: (identifier) arguments: (argument_list)))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))))) (sequence_block body: (sequence_body (expression_statement (call function: (identifier) arguments: (argument_list))) (any_call parameters: (parameters (default_parameter name: (identifier) value: (true))) body: (any_body (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list))))) (expression_statement (call function: (identifier) arguments: (argument_list)))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))))) (sequence_block body: (sequence_body (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (string (string_start) (string_content) (string_end)))))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (string (string_start) (string_content) (string_end)))))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (string (string_start) (string_content) (string_end)))))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (string (string_start) (string_content) (string_end))))))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))))) (sequence_block body: (sequence_body (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (string (string_start) (string_content) (string_end)))))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (string (string_start) (string_content) (string_end)))))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (string (string_start) (string_content) (string_end)))))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (string (string_start) (string_content) (string_end)))))) (expression_statement (call function: (identifier) arguments: (argument_list)))))))) (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (sequence_block body: (sequence_body (expression_statement (call function: (identifier) arguments: (argument_list (attribute ctx: (identifier) attribute: (identifier)) (keyword_argument name: (identifier) value: (true))))))))) (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (sequence_block body: (sequence_body (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (string (string_start) (string_content) (string_end)))))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier)))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier)))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier)))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier)))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier)))) (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (string (string_start) (string_content) (string_end)))))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (init_block body: (init_body (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))) (boolean_block body: (boolean_block_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))) (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (attribute ctx: (identifier) attribute: (identifier))))))) (sequence_block body: (sequence_body (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier)))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier)))) (expression_statement (call function: (identifier) arguments: (argument_list)))))))) (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (sequence_block body: (sequence_body (any_block body: (any_body (expression_statement (call function: (identifier) arguments: (argument_list (identifier) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier))) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier)))))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier))) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier)))))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier))) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier)))))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier))) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier)))))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier))) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier)))))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier))) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier)))))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier))) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier)))))) (expression_statement (call function: (identifier) arguments: (argument_list (identifier) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier))) (keyword_argument name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier)))))))))))))) (context context_type: (context_type) body: (context_body (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (map_block body: (map_body (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters (default_parameter name: (identifier) value: (false)) (default_parameter name: (identifier) value: (false)) (default_parameter name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier)))) body: (procedure_body (init_block body: (init_body (if_statement condition: (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))) consequence: (block (expression_statement (call function: (identifier) arguments: (argument_list))))))) (map_block body: (map_body (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))) (expression_statement (assignment left: (identifier) right: (string (string_start) (string_content) (string_end)))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (identifier))) (if_statement condition: (comparison_operator (identifier) (false)) consequence: (block (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))))) (if_statement condition: (comparison_operator (identifier) (true)) consequence: (block (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (string (string_start) (string_content) (string_end)))))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (ternary_expression condition: (identifier) consequence: (string (string_start) (string_content) (string_end)) alternative: (string (string_start) (string_content) (string_end)))))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters (default_parameter name: (identifier) value: (false))) body: (procedure_body (map_block body: (map_body (expression_statement (call function: (identifier) arguments: (argument_list (identifier)))) (expression_statement (assignment left: (identifier) right: (string (string_start) (string_content) (string_end))))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters (default_parameter name: (identifier) value: (false))) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))) (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (string (string_start) (string_content) (string_end))))) (map_block body: (map_body (expression_statement (call function: (identifier) arguments: (argument_list (keyword_argument name: (identifier) value: (false)) (params_maping))))))))) (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (init_block body: (init_body (if_statement condition: (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (integer)) consequence: (block (expression_statement (call function: (identifier) arguments: (argument_list))))))) (map_block body: (map_body (expression_statement (assignment left: (identifier) right: (attribute ctx: (identifier) attribute: (identifier)))) (expression_statement (assignment left: (identifier) right: (attribute ctx: (identifier) attribute: (identifier)))) (expression_statement (assignment left: (identifier) right: (attribute ctx: (identifier) attribute: (identifier)))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters (default_parameter name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier))) (default_parameter name: (identifier) value: (false)) (default_parameter name: (identifier) value: (false)) (default_parameter name: (identifier) value: (false))) body: (procedure_body (init_block body: (init_body (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (binary_operator left: (unary_operator argument: (identifier)) right: (unary_operator argument: (identifier))))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (attribute ctx: (identifier) attribute: (identifier)))) (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (identifier))))) (map_block body: (map_body (expression_statement (call function: (identifier) arguments: (argument_list))) (expression_statement (assignment left: (identifier) right: (string (string_start) (string_content) (string_end)))) (expression_statement (assignment left: (identifier) right: (attribute ctx: (identifier) attribute: (identifier)))) (expression_statement (assignment left: (identifier) right: (attribute ctx: (identifier) attribute: (identifier)))) (expression_statement (assignment left: (identifier) right: (string (string_start) (string_content) (string_end)))) (expression_statement (assignment left: (identifier) right: (attribute ctx: (identifier) attribute: (identifier)))) (expression_statement (assignment left: (identifier) right: (attribute ctx: (identifier) attribute: (identifier)))) (expression_statement (assignment left: (identifier) right: (attribute ctx: (identifier) attribute: (identifier)))) (expression_statement (assignment left: (identifier) right: (identifier))) (if_statement condition: (binary_operator left: (identifier) right: (identifier)) consequence: (block (expression_statement (assignment left: (identifier) right: (string (string_start) (string_content) (string_end))))) alternative: (elif_clause condition: (identifier) consequence: (block (expression_statement (assignment left: (identifier) right: (string (string_start) (string_content) (string_end)))))) alternative: (elif_clause condition: (identifier) consequence: (block (expression_statement (assignment left: (identifier) right: (string (string_start) (string_content) (string_end)))))) alternative: (else_clause body: (block (expression_statement (assignment left: (identifier) right: (none)))))) (expression_statement (assignment left: (identifier) right: (ternary_expression condition: (identifier) consequence: (attribute ctx: (identifier) attribute: (identifier)) alternative: (none))))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters (default_parameter name: (identifier) value: (attribute ctx: (identifier) attribute: (identifier))) (default_parameter name: (identifier) value: (false))) body: (procedure_body (sequence_block body: (sequence_body (if_statement condition: (comparison_operator (identifier) (attribute ctx: (identifier) attribute: (identifier))) consequence: (block (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (attribute ctx: (identifier) attribute: (identifier)))) (expression_statement (assignment left: (subscript value: (attribute ctx: (identifier) attribute: (identifier)) subscript: (integer)) right: (integer))) (expression_statement (assignment left: (subscript value: (attribute ctx: (identifier) attribute: (identifier)) subscript: (integer)) right: (integer)))) alternative: (else_clause body: (block (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (attribute ctx: (identifier) attribute: (identifier)))))))))))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (runif_block body: (runif_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (false)) (boolean_block body: (boolean_block_body (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (integer)) (comparison_operator (attribute ctx: (identifier) attribute: (identifier)) (identifier))))))) (comment) (comment))))) (context context_type: (context_type) body: (context_body (function_definition return_type: (type) name: (identifier) parameters: (parameters (identifier) (identifier) (default_parameter name: (identifier) value: (false)) (default_parameter name: (identifier) value: (false))) body: (block (expression_statement (assignment left: (identifier) right: (supermap arguments: (argument_list (identifier)) body: (supermap_body (supermap_condition_expression condition: (supermap_condition (comparison_operator (identifier) (list (string (string_start) (string_content) (string_end)) (string (string_start) (string_content) (string_end))))) body: (supermap_condition_body (supermap_pattern (string (string_start) (string_content) (string_end)) (string (string_start) (string_content) (string_end))) (supermap_pattern (string (string_start) (string_content) (string_end)) (string (string_start) (string_content) (string_end))) (supermap_boolean_block predicate: (identifier) body: (supermap_boolean_block_body (supermap_pattern (string (string_start) (string_content) (string_end)) (string (string_start) (string_content) (string_end))))) (supermap_boolean_block predicate: (unary_operator argument: (identifier)) body: (supermap_boolean_block_body (supermap_pattern (string (string_start) (string_content) (string_end)) (string (string_start) (string_content) (string_end))))) (supermap_pattern (string (string_start) (string_content) (string_end)) (string (string_start) (string_content) (string_end))))) (supermap_condition_expression condition: (supermap_condition (comparison_operator (identifier) (string (string_start) (string_content) (string_end))) (supermap_case (identifier))) body: (supermap_condition_body (supermap_pattern (string (string_start) (string_content) (string_end)) (string (string_start) (string_content) (string_end))) (supermap_pattern (string (string_start) (string_content) (string_end)) (string (string_start) (string_content) (string_end))) (supermap_default_case (string (string_start) (string_content) (string_end))))) (supermap_condition_expression condition: (supermap_condition (comparison_operator (identifier) (string (string_start) (string_content) (string_end))) (supermap_case (binary_operator left: (identifier) right: (identifier)))) body: (supermap_condition_body (supermap_pattern (string (string_start) (string_content) (string_end)) (string (string_start) (string_content) (string_end))) (supermap_pattern (string (string_start) (string_content) (string_end)) (string (string_start) (string_content) (string_end))))) (supermap_default_case (string (string_start) (string_content) (string_end))))))) (return_statement (identifier)))) (annotated_procedure (annotation annotation: (identifier)) procedure: (procedure_definition name: (identifier) parameters: (parameters) body: (procedure_body (runif_block body: (runif_body (comparison_operator (subscript value: (identifier) subscript: (attribute ctx: (identifier) attribute: (identifier))) (string (string_start) (string_content) (string_end))))) (map_block body: (map_body (expression_statement (assignment left: (attribute ctx: (identifier) attribute: (identifier)) right: (call function: (identifier) arguments: (argument_list (attribute ctx: (identifier) attribute: (identifier)) (attribute ctx: (identifier) attribute: (identifier)) (attribute ctx: (identifier) attribute: (identifier)) (attribute ctx: (identifier) attribute: (identifier)))))) (expression_statement (assignment left: (subscript value: (attribute ctx: (identifier) attribute: (identifier)) subscript: (integer)) right: (string (string_start) (string_content) (string_end))))))))))))))");
    setTimeout(parse, 200);
}

window.addEventListener('resize', function(event){
    rescale();
});

$(document).ready(function() {
    init();
    rescale();
});

document.addEventListener('keydown', function(e) {
    if (!hotkeysEnabled) { return; }

    switch (e.keyCode) {
    case 37: // left
    // case 65: // a
	scrollLeft(e);
	break;
    case 38: // up
    // case 87: // w
	scrollUp(e);
	break;
    case 39: // right
    // case 68: // d
	scrollRight(e);
	break;
    case 40: // down
    // case 83: // s
	scrollDown(e);
	break;
    case 66: // b
	break;
    // case 67: // c
    // 	if (compiling) {
    // 	    document.getElementById("cancelbutton").click();
    // 	}
    // 	break;
    case 82: // r
	if (activeRenderer) {
	    activeRenderer.softReset();
	}
	break;
    case 173: // - in firefox
    case 189: // - in chrome
	if (activeRenderer && enablePlusMinusScale) {
	    activeRenderer.scale(0.9);
	}
	break;
    case 61: // + in firefox
    case 187: // + in chrome
	if (activeRenderer && enablePlusMinusScale) {
	    activeRenderer.scale(1.1);
	}
	break;
    default:
    }
});
