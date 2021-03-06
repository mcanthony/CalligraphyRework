(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// app.js

require("./libs/bongiovi-min-post.js");
// require("./libs/bongiovi-compiled.js");

window.CalligraphyModel = {};

(function() {

	var SceneCalligraphy = require("./SceneCalligraphy.js");


	Main = function() {
		this._loadImages();
	}

	var p = Main.prototype;

	p._loadImages = function() {
		var images = [
						"assets/images/floor.jpg",
						"assets/images/floor1.jpg",
						"assets/images/brushes/brush0.png",
						"assets/images/brushes/brush1.png",
						"assets/images/brushes/brush2.png",
						"assets/images/brushes/brush3.png",
						"assets/images/brushes/brush4.png",
						"assets/images/brushes/brush5.png"
						];

		bongiovi.SimpleImageLoader.load(images, this, this._onImageLoaded, this._onImageProgress);
	};


	p._onImageProgress = function(percent) {
		console.log("Loading Image : ", percent);
	};

	p._onImageLoaded = function(imgs) {
		CalligraphyModel.images = imgs;


		this._init3D();
	};


	p._init3D = function() {
		this.canvas = document.createElement("canvas");
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this.canvas.className = "canvas-calligraphy";

		document.body.appendChild(this.canvas);
		bongiovi.GL.init(this.canvas);

		this._scene = new SceneCalligraphy();
		bongiovi.Scheduler.addEF(this, this._loop);

		this._initGui();
	};


	p._initGui = function() {
		var gui = new dat.GUI({width:300});
		CalligraphyModel.params = {
			selfShadow:1.7,
			shadowAlpha:.44,
			shadowScale:4.0,
			blur:1.4,
			postOffset:0.25
		};


		gui.add(CalligraphyModel.params, "selfShadow", 0, 5);
		gui.add(CalligraphyModel.params, "shadowAlpha", 0, 1).step(.01);
		gui.add(CalligraphyModel.params, "shadowScale", 0, 5).step(.01);
		gui.add(CalligraphyModel.params, "blur", 0, 2).step(.01);
		gui.add(CalligraphyModel.params, "postOffset", 0, 1).step(.01);
	};


	p._loop = function() {
		// console.log("Loop");
		this._scene.loop();
	};

})();


new Main();


},{"./SceneCalligraphy.js":2,"./libs/bongiovi-min-post.js":8}],2:[function(require,module,exports){
// GL
var b  = bongiovi;	//	ALIAS
var GL = bongiovi.GL;
var gl = GL.gl;

//	CONSTANTS
var FBO_BLUR_SIZE   = 512;

//	IMPORTS
var FrameBuffer    = bongiovi.FrameBuffer;
var Pass           = bongiovi.Pass;
var EffectComposer = bongiovi.EffectComposer;
var GLTexture      = bongiovi.GLTexture;

//	VIEWS
var ViewRoom        = require("./ViewRoom");
var ViewCalligraphy = require("./ViewCalligraphy");
var ViewBlur        = require("./ViewBlur");
var ViewShadow      = require("./ViewShadow");
var ViewPost 		= require("./ViewPost");

function SceneCalligraphy() {
	GL = bongiovi.GL;
	gl = GL.gl;

	bongiovi.Scene.call(this);

	this.camera.setPerspective(70*Math.PI/180, window.innerWidth/window.innerHeight, 5, 3000);
	gl.disable(gl.DEPTH_TEST);
	gl.disable(gl.CULL_FACE);
	this.sceneRotation.lock(true);
}

var p = SceneCalligraphy.prototype = new bongiovi.Scene();
p.constructor = SceneCalligraphy;


p._initTextures = function() {
	this._video = document.body.querySelector(".video-color");
	// console.log(this._video);
	this._textureFloor = new GLTexture(CalligraphyModel.images.floor);
	this._textureFloor1 = new GLTexture(CalligraphyModel.images.floor1);
	this._textureVideo = new GLTexture(this._video);

	var i=0;
	var o = {
		magFilter:gl.NEAREST,
		minFilter:gl.NEAREST
	}
	this.textureBrushes = [];
	while(CalligraphyModel.images["brush"+i] != undefined) {
		var texture = new b.GLTexture(CalligraphyModel.images["brush"+i], false, o);
		this.textureBrushes.push(texture);
		i++;
	}

	this.fboCalligraphy = new FrameBuffer(window.innerWidth, window.innerHeight, o);
	this.fboDepth       = new FrameBuffer(window.innerWidth, window.innerHeight, o);
	this.fboBlur        = new FrameBuffer(window.innerWidth, window.innerHeight, o);
	this.fboDepthBlur   = new FrameBuffer(FBO_BLUR_SIZE, FBO_BLUR_SIZE);

	var that = this;
	window.addEventListener("keydown", function(e) {
		if(e.keyCode == 67) that.clearAllStrokes();
		else if(e.keyCode == 83) that.save();
	})
};


p._initViews = function() {
	this._vCopy        = new b.ViewCopy();
	this._vRoom        = new ViewRoom();
	this._vCalligraphy = new ViewCalligraphy(this.textureBrushes, this);
	this._vShadow      = new ViewShadow();
	this._vPost        = new ViewPost();
	this.strokes       = [];

	this._composer = new EffectComposer();
	this._passTriBlur = new bongiovi.post.PassTriangleBlur(20);
	this._composer.addPass(this._passTriBlur);

	this.btnClear = document.body.querySelector(".clear");
	this.btnClear.addEventListener("click", this.clearAllStrokes.bind(this));

	this.btnSave = document.body.querySelector(".save");
	this.btnSave.addEventListener("click", this.save.bind(this));
};


p.createNewStroke = function() {
	this.strokes.push(this._vCalligraphy);
	this._vCalligraphy = new ViewCalligraphy(this.textureBrushes, this);
	this._vCalligraphy.id = "c" + this.strokes.length;
};

p.clearAllStrokes = function() {
	this._vCalligraphy.destroy();

	this.strokes = [];
	this._vCalligraphy = new ViewCalligraphy(this.textureBrushes, this);	
	this._vCalligraphy.id = "c" + this.strokes.length;
};


p.save = function() {
	this.render();
	var dt = GL.canvas.toDataURL('image/jpeg');
	this.btnSave.href = dt;
};


p.render = function() {
	//	UPDATE VIDEO TEXTURE
	this._textureVideo.updateTexture(this._video);

	// this._hBlur.selfOffset = this._vBlur.selfOffset = CalligraphyModel.params.selfShadow;
	// this._hBlur.blur = this._vBlur.blur = CalligraphyModel.params.blur;

	this._passTriBlur.value = CalligraphyModel.params.blur * 10;
	
	gl.disable(gl.DEPTH_TEST);
	GL.setMatrices(this.cameraOtho);
	GL.rotate(this.rotationFront);
	this._vCopy.render(this._textureFloor1);

	gl.enable(gl.DEPTH_TEST);
	GL.setMatrices(this.camera);
	GL.rotate(this.sceneRotation.matrix);

	this.fboBlur.bind();
	GL.clear(0, 0, 0, 0);
	GL.setViewport(0, 0, this.fboBlur.width, this.fboBlur.height);
	for(var i=0; i<this.strokes.length;i++) {
		this.strokes[i].render();
	}
	this._vCalligraphy.render();
	this.fboBlur.unbind();
	
	GL.setMatrices(this.cameraOtho);
	GL.rotate(this.rotationFront);
	this._composer.render( this.fboBlur.getTexture() );

	GL.setViewport(0, 0, window.innerWidth, window.innerHeight);
	gl.disable(gl.DEPTH_TEST);
	this._vShadow.render(this._composer.getTexture(), this._textureFloor1 );
	this._vPost.render(this.fboBlur.getTexture(), this._textureVideo );
};


module.exports = SceneCalligraphy;
},{"./ViewBlur":3,"./ViewCalligraphy":4,"./ViewPost":5,"./ViewRoom":6,"./ViewShadow":7}],3:[function(require,module,exports){
// ViewBlur.js

var GL = bongiovi.GL;
var gl = GL.gl;

function ViewBlur(pathVert, pathFrag) {
	this.blur = 1;
	this.selfOffset = 0.0;
	bongiovi.View.call(this, pathVert, pathFrag);
}

var p = ViewBlur.prototype = new bongiovi.View();
p.constructor = ViewBlur;

p._init = function() {
	var positions = [];
	var coords = [];
	var indices = [0,1,2,0,2,3];

	var size = 1;
	positions.push([-size, -size, 0]);
	positions.push([size, -size, 0]);
	positions.push([size, size, 0]);
	positions.push([-size, size, 0]);

	coords.push([0, 0]);
	coords.push([1, 0]);
	coords.push([1, 1]);
	coords.push([0, 1]);

	this.mesh = new bongiovi.Mesh(4, 6, GL.gl.TRIANGLES);
	this.mesh.bufferVertex(positions);
	this.mesh.bufferTexCoords(coords);
	this.mesh.bufferIndices(indices);
};

p.render = function(texture) {
	if(!this.shader.isReady())return;
	this.shader.bind();
	this.shader.uniform("blur", "uniform1f", this.blur);
	this.shader.uniform("selfOffset", "uniform1f", this.selfOffset);
	this.shader.uniform("texture", "uniform1i", 0);
	texture.bind(0);
	GL.draw(this.mesh);
};


module.exports = ViewBlur;
},{}],4:[function(require,module,exports){
// ViewCalligraphy.js

var GL = bongiovi.GL;
var gl = GL.gl;
var W  = window.innerWidth;
var H  = window.innerHeight;

var NUM_PARTICLES = 0;
var MIN_DIST      = 30;
var DROP_THRESH   = .85;
var AUDIO_THRESH  = .5;
var PERLIN_SEED   = Math.random() * 9999;

var random = function(min, max) {	return min + Math.random() * ( max - min);	}
var dist = function(p0, p1) {
	var dist = vec3.create();
	vec3.subtract(dist, p0, p1);
	return vec3.length(dist);
}

function ViewCalligraphy(textures, main) {
	
	this.textures = textures;
	this.texture = this.textures[Math.floor(Math.random()*this.textures.length)];
	this.main = main;
	this._isKeyDown = false;
	this._needUpdate = false;
	this.mouse = vec3.create([0, 0, 0]);
	this._particles = [];
	this._points = [];
	this._count = 0;
	this._hasEnded = false;

	bongiovi.View.call(this, "assets/shaders/calligraphy.vert", "assets/shaders/calligraphy.frag");
}


var p = ViewCalligraphy.prototype = new bongiovi.View();
p.constructor = ViewCalligraphy;


p._init = function() {
	var that = this;

	GL.canvas.addEventListener("keydown", function(e){
		if(that._hasEnded) return;
		if ( e.shiftKey ) return;;
		if(e.keyCode==82 && !that._isKeyDown) {
			that._isKeyDown = true;
			that._points = [];
			that._particles = [];
			// that.main.clearDrops();
			that.texture = that.textures[Math.floor(Math.random()*that.textures.length)];
		}
	});


	GL.canvas.addEventListener("mousedown", function(e){
		if(that._hasEnded) return;
		if ( e.shiftKey ) return;;
		if(!that._isKeyDown) {
			that._isKeyDown = true;
			that._points = [];
			that._particles = [];
			// that.main.clearDrops();
			that.texture = that.textures[Math.floor(Math.random()*that.textures.length)];
		}
	});

	GL.canvas.addEventListener("keyup", function(e){
		that._isKeyDown = false;
		if(that._hasEnded) return;
	});


	window.addEventListener("mouseup", function(e){
		if(that._hasEnded) return;
		that._hasEnded = true;
		that._isKeyDown = false;
		that.main.createNewStroke();
	});


	GL.canvas.addEventListener("mousemove", this._onMouseMove.bind(this));
};


p._onMouseMove = function(e) {
	if(this._hasEnded) return;
	if ( e.shiftKey ) return;

	if(this._isKeyDown) {
		var t = new Date().getTime() * .005;
		var z = (Perlin.noise(t, PERLIN_SEED, 0) -.5 ) * 1000;
		var current = vec3.fromValues(e.clientX - W/2, -e.clientY + H/2, z);
		vec3.scale(current, current, .5);
		if(this._points.length == 0) {
			this._points.push(current);
			this._needUpdate = true;
		} else {
			var distance = dist(current, this._points[this._points.length-1]);
			if( distance > MIN_DIST) {
				current.distance = distance;
				this._points.push(current);
				this._needUpdate = true;

				// if(Math.random() > DROP_THRESH) this.main.addDrop(vec3.create(current));
			}
		}
	}
};


p.updateParticles = function(funcParams) {
	var points = this._points;
	this._particles = MathUtils.getBezierPoints(points, points.length*2);

	var dir = vec3.create();
	var z = vec3.fromValues(0, 0, 1);
	var mtxLeft = mat4.create();
	var mtxRight = mat4.create();
	var strokeSize = 30;
	
	mat4.identity(mtxLeft);
	mat4.identity(mtxRight);
	mat4.rotateZ(mtxLeft, mtxLeft, -Math.PI/2);
	mat4.rotateZ(mtxRight, mtxRight, Math.PI/2);
	this._quads = [];
	this._normals = [];

	for (var i = 0; i < this._particles.length; i++) {
		var size = strokeSize + strokeSize * (Perlin.noise(i*.1, 0, 0) - .5);
		var left = vec3.create();
		var right = vec3.create();
		var normal = vec3.create();

		var p = this._particles[i];
		if(i<this._particles.length-1) {
			var pNext = this._particles[i+1];	
			vec3.subtract(dir, pNext, p);
		}

		vec3.normalize(dir, dir);

		vec3.cross(left, dir, z);
		vec3.scale(left, left, size);
		vec3.scale(right, left, -1);

		vec3.cross(normal, left, dir);
		vec3.normalize(normal, normal);

		
		vec3.add(left, left, p);
		vec3.add(right, right, p);

		this._quads.push([left, right, p]);
		this._normals.push(normal);
	};

	this._needUpdate = false;


	var positions = [];
	var coords = [];
	var indices = [];

	var p0, p1, p2, p3;
	var s = 1/(this._quads.length-1);
	var vOffset = 1;
	var index = 0;

	for(var i=0; i<this._quads.length-1; i++) {
		var curr = this._quads[i];
		var next = this._quads[i+1];
		var norm0 = this._normals[i];
		var norm1 = this._normals[i+1];

		p0 = curr[2];
		p1 = next[2];
		p2 = next[0];
		p3 = curr[0];

		positions.push([ p0[0], p0[1], p0[2] ]);
		positions.push([ p1[0], p1[1], p1[2] ]);
		positions.push([ p2[0], p2[1], p2[2] ]);
		positions.push([ p3[0], p3[1], p3[2] ]);

		coords.push([s*i, .5]);
		coords.push([s*(i+1), .5]);
		coords.push([s*(i+1), 1]);
		coords.push([s*i, 1]);

		indices.push(index*4 + 0);
		indices.push(index*4 + 1);
		indices.push(index*4 + 2);
		indices.push(index*4 + 0);
		indices.push(index*4 + 2);
		indices.push(index*4 + 3);

		index++;

		p0 = curr[1];
		p1 = next[1];
		p2 = next[2];
		p3 = curr[2];

		positions.push([ p0[0], p0[1], p0[2] ]);
		positions.push([ p1[0], p1[1], p1[2] ]);
		positions.push([ p2[0], p2[1], p2[2] ]);
		positions.push([ p3[0], p3[1], p3[2] ]);

		coords.push([s*i, .0]);
		coords.push([s*(i+1), 0]);
		coords.push([s*(i+1), .5]);
		coords.push([s*i, .5]);

		indices.push(index*4 + 0);
		indices.push(index*4 + 1);
		indices.push(index*4 + 2);
		indices.push(index*4 + 0);
		indices.push(index*4 + 2);
		indices.push(index*4 + 3);

		index++;
	}

	this.mesh = new bongiovi.Mesh(positions.length, indices.length, GL.gl.TRIANGLES);
	this.mesh.bufferVertex(positions);
	this.mesh.bufferTexCoords(coords);
	this.mesh.bufferIndices(indices);
};


p.render = function(isBlack) {
	isBlack = isBlack || false;
	if(this._needUpdate) this.updateParticles();
	if(this._particles.length <=0) return;

	if(!this.shader.isReady())return;
	this.shader.bind();
	this.shader.uniform("texture", "uniform1i", 0);
	this.shader.uniform("isBlack", "uniform1f", isBlack ? 1.0 : 0.0);
	this.texture.bind(0);
	GL.draw(this.mesh);
};

p.destroy = function() {
	this._hasEnded = true;
	this._particles = [];
};

module.exports = ViewCalligraphy;
},{}],5:[function(require,module,exports){
// ViewPost.js

var GL = bongiovi.GL;
var gl = GL.gl;

function ViewPost() {
	bongiovi.View.call(this, "assets/shaders/copy.vert", "assets/shaders/post.frag");
}

var p = ViewPost.prototype = new bongiovi.View();
p.constructor = ViewPost;


p._init = function() {
	var positions = [];
	var coords = [];
	var indices = [0,1,2,0,2,3];

	var size = 1;
	positions.push([-size, -size, 0]);
	positions.push([size, -size, 0]);
	positions.push([size, size, 0]);
	positions.push([-size, size, 0]);

	coords.push([0, 0]);
	coords.push([1, 0]);
	coords.push([1, 1]);
	coords.push([0, 1]);

	this.mesh = new bongiovi.Mesh(4, 6, GL.gl.TRIANGLES);
	this.mesh.bufferVertex(positions);
	this.mesh.bufferTexCoords(coords);
	this.mesh.bufferIndices(indices);
};


p.render = function(texture, textureFloor) {
	if(!this.shader.isReady())return;
	this.shader.bind();
	this.shader.uniform("texture", "uniform1i", 0);
	this.shader.uniform("textureFloor", "uniform1i", 1);
	this.shader.uniform("postOffset", "uniform1f", CalligraphyModel.params.postOffset);
	texture.bind(0);
	textureFloor.bind(1);
	GL.draw(this.mesh);
};

module.exports = ViewPost;
},{}],6:[function(require,module,exports){
// ViewRoom.js

var GL = bongiovi.GL;
var gl = GL.gl;

function ViewRoom() {
	bongiovi.View.call(this, "assets/shaders/room.vert", "assets/shaders/room.frag");
}

var p = ViewRoom.prototype = new bongiovi.View();
p.constructor = ViewRoom;


p._init = function() {
	console.log("init View Room");

	var size = 500;
	var positions = [];
	var coords = [];
	var indices = [];
	var index = 0;

	//	FRONT
	positions.push([-size, -size,  -size]);
	positions.push([ size, -size,  -size]);
	positions.push([ size,  size,  -size]);
	positions.push([-size,  size,  -size]);

	coords.push([0, 0]);
	coords.push([1, 0]);
	coords.push([1, 1]);
	coords.push([0, 1]);

	indices.push(index * 4 + 0);
	indices.push(index * 4 + 1);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 3);


	//	LEFT
	positions.push([-size, -size,   size]);
	positions.push([-size, -size,  -size]);
	positions.push([-size,  size,  -size]);
	positions.push([-size,  size,   size]);

	coords.push([0, 0]);
	coords.push([1, 0]);
	coords.push([1, 1]);
	coords.push([0, 1]);

	index++;
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 1);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 3);


	//	RIGHT
	positions.push([ size, -size,  -size]);
	positions.push([ size, -size,   size]);
	positions.push([ size,  size,   size]);
	positions.push([ size,  size,  -size]);

	coords.push([0, 0]);
	coords.push([1, 0]);
	coords.push([1, 1]);
	coords.push([0, 1]);

	index++;
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 1);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 3);


	//	BACK
	positions.push([ size, -size,   size]);
	positions.push([-size, -size,   size]);
	positions.push([-size,  size,   size]);
	positions.push([ size,  size,   size]);

	coords.push([0, 0]);
	coords.push([1, 0]);
	coords.push([1, 1]);
	coords.push([0, 1]);

	index++;
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 1);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 3);


	//	TOP
	positions.push([-size,  size,  -size]);
	positions.push([ size,  size,  -size]);
	positions.push([ size,  size,   size]);
	positions.push([-size,  size,   size]);

	coords.push([0, 0]);
	coords.push([1, 0]);
	coords.push([1, 1]);
	coords.push([0, 1]);

	index++;
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 1);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 3);


	//	BOTTOM
	positions.push([-size, -size,   size]);
	positions.push([ size, -size,   size]);
	positions.push([ size, -size,  -size]);
	positions.push([-size, -size,  -size]);

	coords.push([0, 0]);
	coords.push([1, 0]);
	coords.push([1, 1]);
	coords.push([0, 1]);

	index++;
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 1);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 0);
	indices.push(index * 4 + 2);
	indices.push(index * 4 + 3);

	this.mesh = new bongiovi.Mesh(positions.length, indices.length, GL.gl.TRIANGLES);
	this.mesh.bufferVertex(positions);
	this.mesh.bufferTexCoords(coords);
	this.mesh.bufferIndices(indices);
};


p.render = function(texture) {
	if(!this.shader.isReady()) return;

	this.shader.bind();
	this.shader.uniform("texture", "uniform1i", 0);
	texture.bind(0);
	GL.draw(this.mesh);
};


module.exports = ViewRoom;
},{}],7:[function(require,module,exports){
// ViewShadow.js

var GL = bongiovi.GL;
var gl = GL.gl;

function ViewShadow() {
	bongiovi.View.call(this, "assets/shaders/copy.vert", "assets/shaders/shadow.frag");
}

var p = ViewShadow.prototype = new bongiovi.View();
p.constructor = ViewShadow;


p._init = function() {
	var positions = [];
	var coords = [];
	var indices = [0,1,2,0,2,3];

	var size = 1;
	var offset = -1.5;
	positions.push([-size, -size+offset, 0]);
	positions.push([size, -size+offset, 0]);
	positions.push([size, size+offset, 0]);
	positions.push([-size, size+offset, 0]);

	coords.push([0, 0]);
	coords.push([1, 0]);
	coords.push([1, 1]);
	coords.push([0, 1]);

	this.mesh = new bongiovi.Mesh(4, 6, GL.gl.TRIANGLES);
	this.mesh.bufferVertex(positions);
	this.mesh.bufferTexCoords(coords);
	this.mesh.bufferIndices(indices);
};

p.render = function(texture, textureFloor) {
	if(!this.shader.isReady())return;
	this.shader.bind();
	this.shader.uniform("texture", "uniform1i", 0);
	this.shader.uniform("textureFloor", "uniform1i", 1);
	this.shader.uniform("alpha", "uniform1f", CalligraphyModel.params.shadowAlpha);
	this.shader.uniform("shadowScale", "uniform1f", CalligraphyModel.params.shadowScale);
	texture.bind(0);
	textureFloor.bind(1);
	GL.draw(this.mesh);
};

module.exports = ViewShadow;
},{}],8:[function(require,module,exports){
(function(c){var f;"undefined"==typeof exports?"function"==typeof define&&"object"==typeof define.amd&&define.amd?(f={},define(function(){return f})):f="undefined"!=typeof window?window:c:f=exports;(function(c){if(!e)var e=1E-6;if(!h)var h="undefined"!=typeof Float32Array?Float32Array:Array;if(!l)var l=Math.random;var f={setMatrixArrayType:function(a){h=a}};"undefined"!=typeof c&&(c.glMatrix=f);var s=Math.PI/180;f.toRadian=function(a){return a*s};var r={create:function(){var a=new h(2);return a[0]=
0,a[1]=0,a},clone:function(a){var b=new h(2);return b[0]=a[0],b[1]=a[1],b},fromValues:function(a,b){var d=new h(2);return d[0]=a,d[1]=b,d},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a},set:function(a,b,d){return a[0]=b,a[1]=d,a},add:function(a,b,d){return a[0]=b[0]+d[0],a[1]=b[1]+d[1],a},subtract:function(a,b,d){return a[0]=b[0]-d[0],a[1]=b[1]-d[1],a}};r.sub=r.subtract;r.multiply=function(a,b,d){return a[0]=b[0]*d[0],a[1]=b[1]*d[1],a};r.mul=r.multiply;r.divide=function(a,b,d){return a[0]=b[0]/
d[0],a[1]=b[1]/d[1],a};r.div=r.divide;r.min=function(a,b,d){return a[0]=Math.min(b[0],d[0]),a[1]=Math.min(b[1],d[1]),a};r.max=function(a,b,d){return a[0]=Math.max(b[0],d[0]),a[1]=Math.max(b[1],d[1]),a};r.scale=function(a,b,d){return a[0]=b[0]*d,a[1]=b[1]*d,a};r.scaleAndAdd=function(a,b,d,k){return a[0]=b[0]+d[0]*k,a[1]=b[1]+d[1]*k,a};r.distance=function(a,b){var d=b[0]-a[0],k=b[1]-a[1];return Math.sqrt(d*d+k*k)};r.dist=r.distance;r.squaredDistance=function(a,b){var d=b[0]-a[0],k=b[1]-a[1];return d*
d+k*k};r.sqrDist=r.squaredDistance;r.length=function(a){var b=a[0];a=a[1];return Math.sqrt(b*b+a*a)};r.len=r.length;r.squaredLength=function(a){var b=a[0];a=a[1];return b*b+a*a};r.sqrLen=r.squaredLength;r.negate=function(a,b){return a[0]=-b[0],a[1]=-b[1],a};r.normalize=function(a,b){var d=b[0],k=b[1],d=d*d+k*k;return 0<d&&(d=1/Math.sqrt(d),a[0]=b[0]*d,a[1]=b[1]*d),a};r.dot=function(a,b){return a[0]*b[0]+a[1]*b[1]};r.cross=function(a,b,d){b=b[0]*d[1]-b[1]*d[0];return a[0]=a[1]=0,a[2]=b,a};r.lerp=function(a,
b,d,k){var t=b[0];b=b[1];return a[0]=t+k*(d[0]-t),a[1]=b+k*(d[1]-b),a};r.random=function(a,b){b=b||1;var d=2*l()*Math.PI;return a[0]=Math.cos(d)*b,a[1]=Math.sin(d)*b,a};r.transformMat2=function(a,b,d){var k=b[0];b=b[1];return a[0]=d[0]*k+d[2]*b,a[1]=d[1]*k+d[3]*b,a};r.transformMat2d=function(a,b,d){var k=b[0];b=b[1];return a[0]=d[0]*k+d[2]*b+d[4],a[1]=d[1]*k+d[3]*b+d[5],a};r.transformMat3=function(a,b,d){var k=b[0];b=b[1];return a[0]=d[0]*k+d[3]*b+d[6],a[1]=d[1]*k+d[4]*b+d[7],a};r.transformMat4=function(a,
b,d){var k=b[0];b=b[1];return a[0]=d[0]*k+d[4]*b+d[12],a[1]=d[1]*k+d[5]*b+d[13],a};r.forEach=function(){var a=r.create();return function(b,d,k,t,c,g){var e;d||(d=2);k||(k=0);for(t?e=Math.min(t*d+k,b.length):e=b.length;k<e;k+=d)a[0]=b[k],a[1]=b[k+1],c(a,a,g),b[k]=a[0],b[k+1]=a[1];return b}}();r.str=function(a){return"vec2("+a[0]+", "+a[1]+")"};"undefined"!=typeof c&&(c.vec2=r);var m={create:function(){var a=new h(3);return a[0]=0,a[1]=0,a[2]=0,a},clone:function(a){var b=new h(3);return b[0]=a[0],b[1]=
a[1],b[2]=a[2],b},fromValues:function(a,b,d){var k=new h(3);return k[0]=a,k[1]=b,k[2]=d,k},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a},set:function(a,b,d,k){return a[0]=b,a[1]=d,a[2]=k,a},add:function(a,b,d){return a[0]=b[0]+d[0],a[1]=b[1]+d[1],a[2]=b[2]+d[2],a},subtract:function(a,b,d){return a[0]=b[0]-d[0],a[1]=b[1]-d[1],a[2]=b[2]-d[2],a}};m.sub=m.subtract;m.multiply=function(a,b,d){return a[0]=b[0]*d[0],a[1]=b[1]*d[1],a[2]=b[2]*d[2],a};m.mul=m.multiply;m.divide=function(a,b,d){return a[0]=
b[0]/d[0],a[1]=b[1]/d[1],a[2]=b[2]/d[2],a};m.div=m.divide;m.min=function(a,b,d){return a[0]=Math.min(b[0],d[0]),a[1]=Math.min(b[1],d[1]),a[2]=Math.min(b[2],d[2]),a};m.max=function(a,b,d){return a[0]=Math.max(b[0],d[0]),a[1]=Math.max(b[1],d[1]),a[2]=Math.max(b[2],d[2]),a};m.scale=function(a,b,d){return a[0]=b[0]*d,a[1]=b[1]*d,a[2]=b[2]*d,a};m.scaleAndAdd=function(a,b,d,k){return a[0]=b[0]+d[0]*k,a[1]=b[1]+d[1]*k,a[2]=b[2]+d[2]*k,a};m.distance=function(a,b){var d=b[0]-a[0],k=b[1]-a[1],t=b[2]-a[2];return Math.sqrt(d*
d+k*k+t*t)};m.dist=m.distance;m.squaredDistance=function(a,b){var d=b[0]-a[0],k=b[1]-a[1],t=b[2]-a[2];return d*d+k*k+t*t};m.sqrDist=m.squaredDistance;m.length=function(a){var b=a[0],d=a[1];a=a[2];return Math.sqrt(b*b+d*d+a*a)};m.len=m.length;m.squaredLength=function(a){var b=a[0],d=a[1];a=a[2];return b*b+d*d+a*a};m.sqrLen=m.squaredLength;m.negate=function(a,b){return a[0]=-b[0],a[1]=-b[1],a[2]=-b[2],a};m.normalize=function(a,b){var d=b[0],k=b[1],t=b[2],d=d*d+k*k+t*t;return 0<d&&(d=1/Math.sqrt(d),
a[0]=b[0]*d,a[1]=b[1]*d,a[2]=b[2]*d),a};m.dot=function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]};m.cross=function(a,b,d){var k=b[0],t=b[1];b=b[2];var c=d[0],g=d[1];d=d[2];return a[0]=t*d-b*g,a[1]=b*c-k*d,a[2]=k*g-t*c,a};m.lerp=function(a,b,d,k){var t=b[0],c=b[1];b=b[2];return a[0]=t+k*(d[0]-t),a[1]=c+k*(d[1]-c),a[2]=b+k*(d[2]-b),a};m.random=function(a,b){b=b||1;var d=2*l()*Math.PI,k=2*l()-1,t=Math.sqrt(1-k*k)*b;return a[0]=Math.cos(d)*t,a[1]=Math.sin(d)*t,a[2]=k*b,a};m.transformMat4=function(a,b,
d){var k=b[0],t=b[1];b=b[2];return a[0]=d[0]*k+d[4]*t+d[8]*b+d[12],a[1]=d[1]*k+d[5]*t+d[9]*b+d[13],a[2]=d[2]*k+d[6]*t+d[10]*b+d[14],a};m.transformMat3=function(a,b,d){var k=b[0],t=b[1];b=b[2];return a[0]=k*d[0]+t*d[3]+b*d[6],a[1]=k*d[1]+t*d[4]+b*d[7],a[2]=k*d[2]+t*d[5]+b*d[8],a};m.transformQuat=function(a,b,d){var k=b[0],t=b[1],c=b[2];b=d[0];var g=d[1],e=d[2];d=d[3];var h=d*k+g*c-e*t,f=d*t+e*k-b*c,l=d*c+b*t-g*k,k=-b*k-g*t-e*c;return a[0]=h*d+k*-b+f*-e-l*-g,a[1]=f*d+k*-g+l*-b-h*-e,a[2]=l*d+k*-e+h*
-g-f*-b,a};m.rotateX=function(a,b,d,k){var t=[],c=[];return t[0]=b[0]-d[0],t[1]=b[1]-d[1],t[2]=b[2]-d[2],c[0]=t[0],c[1]=t[1]*Math.cos(k)-t[2]*Math.sin(k),c[2]=t[1]*Math.sin(k)+t[2]*Math.cos(k),a[0]=c[0]+d[0],a[1]=c[1]+d[1],a[2]=c[2]+d[2],a};m.rotateY=function(a,b,d,k){var t=[],c=[];return t[0]=b[0]-d[0],t[1]=b[1]-d[1],t[2]=b[2]-d[2],c[0]=t[2]*Math.sin(k)+t[0]*Math.cos(k),c[1]=t[1],c[2]=t[2]*Math.cos(k)-t[0]*Math.sin(k),a[0]=c[0]+d[0],a[1]=c[1]+d[1],a[2]=c[2]+d[2],a};m.rotateZ=function(a,b,d,k){var t=
[],c=[];return t[0]=b[0]-d[0],t[1]=b[1]-d[1],t[2]=b[2]-d[2],c[0]=t[0]*Math.cos(k)-t[1]*Math.sin(k),c[1]=t[0]*Math.sin(k)+t[1]*Math.cos(k),c[2]=t[2],a[0]=c[0]+d[0],a[1]=c[1]+d[1],a[2]=c[2]+d[2],a};m.forEach=function(){var a=m.create();return function(b,d,k,t,c,g){var e;d||(d=3);k||(k=0);for(t?e=Math.min(t*d+k,b.length):e=b.length;k<e;k+=d)a[0]=b[k],a[1]=b[k+1],a[2]=b[k+2],c(a,a,g),b[k]=a[0],b[k+1]=a[1],b[k+2]=a[2];return b}}();m.str=function(a){return"vec3("+a[0]+", "+a[1]+", "+a[2]+")"};"undefined"!=
typeof c&&(c.vec3=m);var p={create:function(){var a=new h(4);return a[0]=0,a[1]=0,a[2]=0,a[3]=0,a},clone:function(a){var b=new h(4);return b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b},fromValues:function(a,b,d,k){var t=new h(4);return t[0]=a,t[1]=b,t[2]=d,t[3]=k,t},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a},set:function(a,b,d,k,t){return a[0]=b,a[1]=d,a[2]=k,a[3]=t,a},add:function(a,b,d){return a[0]=b[0]+d[0],a[1]=b[1]+d[1],a[2]=b[2]+d[2],a[3]=b[3]+d[3],a},subtract:function(a,
b,d){return a[0]=b[0]-d[0],a[1]=b[1]-d[1],a[2]=b[2]-d[2],a[3]=b[3]-d[3],a}};p.sub=p.subtract;p.multiply=function(a,b,d){return a[0]=b[0]*d[0],a[1]=b[1]*d[1],a[2]=b[2]*d[2],a[3]=b[3]*d[3],a};p.mul=p.multiply;p.divide=function(a,b,d){return a[0]=b[0]/d[0],a[1]=b[1]/d[1],a[2]=b[2]/d[2],a[3]=b[3]/d[3],a};p.div=p.divide;p.min=function(a,b,d){return a[0]=Math.min(b[0],d[0]),a[1]=Math.min(b[1],d[1]),a[2]=Math.min(b[2],d[2]),a[3]=Math.min(b[3],d[3]),a};p.max=function(a,b,d){return a[0]=Math.max(b[0],d[0]),
a[1]=Math.max(b[1],d[1]),a[2]=Math.max(b[2],d[2]),a[3]=Math.max(b[3],d[3]),a};p.scale=function(a,b,d){return a[0]=b[0]*d,a[1]=b[1]*d,a[2]=b[2]*d,a[3]=b[3]*d,a};p.scaleAndAdd=function(a,b,d,k){return a[0]=b[0]+d[0]*k,a[1]=b[1]+d[1]*k,a[2]=b[2]+d[2]*k,a[3]=b[3]+d[3]*k,a};p.distance=function(a,b){var d=b[0]-a[0],k=b[1]-a[1],t=b[2]-a[2],c=b[3]-a[3];return Math.sqrt(d*d+k*k+t*t+c*c)};p.dist=p.distance;p.squaredDistance=function(a,b){var d=b[0]-a[0],k=b[1]-a[1],c=b[2]-a[2],g=b[3]-a[3];return d*d+k*k+c*
c+g*g};p.sqrDist=p.squaredDistance;p.length=function(a){var b=a[0],d=a[1],k=a[2];a=a[3];return Math.sqrt(b*b+d*d+k*k+a*a)};p.len=p.length;p.squaredLength=function(a){var b=a[0],d=a[1],k=a[2];a=a[3];return b*b+d*d+k*k+a*a};p.sqrLen=p.squaredLength;p.negate=function(a,b){return a[0]=-b[0],a[1]=-b[1],a[2]=-b[2],a[3]=-b[3],a};p.normalize=function(a,b){var d=b[0],k=b[1],c=b[2],g=b[3],d=d*d+k*k+c*c+g*g;return 0<d&&(d=1/Math.sqrt(d),a[0]=b[0]*d,a[1]=b[1]*d,a[2]=b[2]*d,a[3]=b[3]*d),a};p.dot=function(a,b){return a[0]*
b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]};p.lerp=function(a,b,d,k){var c=b[0],g=b[1],e=b[2];b=b[3];return a[0]=c+k*(d[0]-c),a[1]=g+k*(d[1]-g),a[2]=e+k*(d[2]-e),a[3]=b+k*(d[3]-b),a};p.random=function(a,b){return b=b||1,a[0]=l(),a[1]=l(),a[2]=l(),a[3]=l(),p.normalize(a,a),p.scale(a,a,b),a};p.transformMat4=function(a,b,d){var k=b[0],c=b[1],g=b[2];b=b[3];return a[0]=d[0]*k+d[4]*c+d[8]*g+d[12]*b,a[1]=d[1]*k+d[5]*c+d[9]*g+d[13]*b,a[2]=d[2]*k+d[6]*c+d[10]*g+d[14]*b,a[3]=d[3]*k+d[7]*c+d[11]*g+d[15]*b,a};p.transformQuat=
function(a,b,d){var k=b[0],c=b[1],g=b[2];b=d[0];var e=d[1],h=d[2];d=d[3];var f=d*k+e*g-h*c,l=d*c+h*k-b*g,x=d*g+b*c-e*k,k=-b*k-e*c-h*g;return a[0]=f*d+k*-b+l*-h-x*-e,a[1]=l*d+k*-e+x*-b-f*-h,a[2]=x*d+k*-h+f*-e-l*-b,a};p.forEach=function(){var a=p.create();return function(b,d,k,c,g,e){var h;d||(d=4);k||(k=0);for(c?h=Math.min(c*d+k,b.length):h=b.length;k<h;k+=d)a[0]=b[k],a[1]=b[k+1],a[2]=b[k+2],a[3]=b[k+3],g(a,a,e),b[k]=a[0],b[k+1]=a[1],b[k+2]=a[2],b[k+3]=a[3];return b}}();p.str=function(a){return"vec4("+
a[0]+", "+a[1]+", "+a[2]+", "+a[3]+")"};"undefined"!=typeof c&&(c.vec4=p);f={create:function(){var a=new h(4);return a[0]=1,a[1]=0,a[2]=0,a[3]=1,a},clone:function(a){var b=new h(4);return b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a},identity:function(a){return a[0]=1,a[1]=0,a[2]=0,a[3]=1,a},transpose:function(a,b){if(a===b){var d=b[1];a[1]=b[2];a[2]=d}else a[0]=b[0],a[1]=b[2],a[2]=b[1],a[3]=b[3];return a},invert:function(a,b){var d=
b[0],k=b[1],c=b[2],g=b[3],e=d*g-c*k;return e?(e=1/e,a[0]=g*e,a[1]=-k*e,a[2]=-c*e,a[3]=d*e,a):null},adjoint:function(a,b){var d=b[0];return a[0]=b[3],a[1]=-b[1],a[2]=-b[2],a[3]=d,a},determinant:function(a){return a[0]*a[3]-a[2]*a[1]},multiply:function(a,b,d){var k=b[0],c=b[1],g=b[2];b=b[3];var e=d[0],h=d[1],f=d[2];d=d[3];return a[0]=k*e+g*h,a[1]=c*e+b*h,a[2]=k*f+g*d,a[3]=c*f+b*d,a}};f.mul=f.multiply;f.rotate=function(a,b,d){var k=b[0],c=b[1],g=b[2];b=b[3];var e=Math.sin(d);d=Math.cos(d);return a[0]=
k*d+g*e,a[1]=c*d+b*e,a[2]=k*-e+g*d,a[3]=c*-e+b*d,a};f.scale=function(a,b,d){var k=b[1],c=b[2],g=b[3],e=d[0];d=d[1];return a[0]=b[0]*e,a[1]=k*e,a[2]=c*d,a[3]=g*d,a};f.str=function(a){return"mat2("+a[0]+", "+a[1]+", "+a[2]+", "+a[3]+")"};f.frob=function(a){return Math.sqrt(Math.pow(a[0],2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2))};f.LDU=function(a,b,d,k){return a[2]=k[2]/k[0],d[0]=k[0],d[1]=k[1],d[3]=k[3]-a[2]*d[1],[a,b,d]};"undefined"!=typeof c&&(c.mat2=f);f={create:function(){var a=new h(6);
return a[0]=1,a[1]=0,a[2]=0,a[3]=1,a[4]=0,a[5]=0,a},clone:function(a){var b=new h(6);return b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b[4]=a[4],b[5]=a[5],b},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a[4]=b[4],a[5]=b[5],a},identity:function(a){return a[0]=1,a[1]=0,a[2]=0,a[3]=1,a[4]=0,a[5]=0,a},invert:function(a,b){var d=b[0],k=b[1],c=b[2],g=b[3],e=b[4],h=b[5],f=d*g-k*c;return f?(f=1/f,a[0]=g*f,a[1]=-k*f,a[2]=-c*f,a[3]=d*f,a[4]=(c*h-g*e)*f,a[5]=(k*e-d*h)*f,a):null},determinant:function(a){return a[0]*
a[3]-a[1]*a[2]},multiply:function(a,b,d){var k=b[0],c=b[1],g=b[2],e=b[3],h=b[4];b=b[5];var f=d[0],l=d[1],x=d[2],u=d[3],n=d[4];d=d[5];return a[0]=k*f+g*l,a[1]=c*f+e*l,a[2]=k*x+g*u,a[3]=c*x+e*u,a[4]=k*n+g*d+h,a[5]=c*n+e*d+b,a}};f.mul=f.multiply;f.rotate=function(a,b,d){var k=b[0],c=b[1],g=b[2],e=b[3],h=b[4];b=b[5];var f=Math.sin(d);d=Math.cos(d);return a[0]=k*d+g*f,a[1]=c*d+e*f,a[2]=k*-f+g*d,a[3]=c*-f+e*d,a[4]=h,a[5]=b,a};f.scale=function(a,b,d){var k=b[1],c=b[2],g=b[3],e=b[4],h=b[5],f=d[0];d=d[1];
return a[0]=b[0]*f,a[1]=k*f,a[2]=c*d,a[3]=g*d,a[4]=e,a[5]=h,a};f.translate=function(a,b,d){var k=b[0],c=b[1],g=b[2],e=b[3],h=b[4];b=b[5];var f=d[0];d=d[1];return a[0]=k,a[1]=c,a[2]=g,a[3]=e,a[4]=k*f+g*d+h,a[5]=c*f+e*d+b,a};f.str=function(a){return"mat2d("+a[0]+", "+a[1]+", "+a[2]+", "+a[3]+", "+a[4]+", "+a[5]+")"};f.frob=function(a){return Math.sqrt(Math.pow(a[0],2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2)+Math.pow(a[4],2)+Math.pow(a[5],2)+1)};"undefined"!=typeof c&&(c.mat2d=f);var w={create:function(){var a=
new h(9);return a[0]=1,a[1]=0,a[2]=0,a[3]=0,a[4]=1,a[5]=0,a[6]=0,a[7]=0,a[8]=1,a},fromMat4:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[4],a[4]=b[5],a[5]=b[6],a[6]=b[8],a[7]=b[9],a[8]=b[10],a},clone:function(a){var b=new h(9);return b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b[4]=a[4],b[5]=a[5],b[6]=a[6],b[7]=a[7],b[8]=a[8],b},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a[4]=b[4],a[5]=b[5],a[6]=b[6],a[7]=b[7],a[8]=b[8],a},identity:function(a){return a[0]=1,a[1]=0,a[2]=
0,a[3]=0,a[4]=1,a[5]=0,a[6]=0,a[7]=0,a[8]=1,a},transpose:function(a,b){if(a===b){var d=b[1],k=b[2],c=b[5];a[1]=b[3];a[2]=b[6];a[3]=d;a[5]=b[7];a[6]=k;a[7]=c}else a[0]=b[0],a[1]=b[3],a[2]=b[6],a[3]=b[1],a[4]=b[4],a[5]=b[7],a[6]=b[2],a[7]=b[5],a[8]=b[8];return a},invert:function(a,b){var d=b[0],k=b[1],c=b[2],g=b[3],e=b[4],h=b[5],f=b[6],l=b[7],x=b[8],u=x*e-h*l,n=-x*g+h*f,y=l*g-e*f,m=d*u+k*n+c*y;return m?(m=1/m,a[0]=u*m,a[1]=(-x*k+c*l)*m,a[2]=(h*k-c*e)*m,a[3]=n*m,a[4]=(x*d-c*f)*m,a[5]=(-h*d+c*g)*m,a[6]=
y*m,a[7]=(-l*d+k*f)*m,a[8]=(e*d-k*g)*m,a):null},adjoint:function(a,b){var d=b[0],k=b[1],c=b[2],g=b[3],e=b[4],h=b[5],f=b[6],l=b[7],x=b[8];return a[0]=e*x-h*l,a[1]=c*l-k*x,a[2]=k*h-c*e,a[3]=h*f-g*x,a[4]=d*x-c*f,a[5]=c*g-d*h,a[6]=g*l-e*f,a[7]=k*f-d*l,a[8]=d*e-k*g,a},determinant:function(a){var b=a[3],d=a[4],k=a[5],c=a[6],g=a[7],e=a[8];return a[0]*(e*d-k*g)+a[1]*(-e*b+k*c)+a[2]*(g*b-d*c)},multiply:function(a,b,d){var k=b[0],c=b[1],g=b[2],e=b[3],h=b[4],f=b[5],l=b[6],x=b[7];b=b[8];var u=d[0],n=d[1],y=d[2],
m=d[3],r=d[4],p=d[5],H=d[6],q=d[7];d=d[8];return a[0]=u*k+n*e+y*l,a[1]=u*c+n*h+y*x,a[2]=u*g+n*f+y*b,a[3]=m*k+r*e+p*l,a[4]=m*c+r*h+p*x,a[5]=m*g+r*f+p*b,a[6]=H*k+q*e+d*l,a[7]=H*c+q*h+d*x,a[8]=H*g+q*f+d*b,a}};w.mul=w.multiply;w.translate=function(a,b,d){var k=b[0],c=b[1],g=b[2],e=b[3],h=b[4],f=b[5],l=b[6],x=b[7];b=b[8];var u=d[0];d=d[1];return a[0]=k,a[1]=c,a[2]=g,a[3]=e,a[4]=h,a[5]=f,a[6]=u*k+d*e+l,a[7]=u*c+d*h+x,a[8]=u*g+d*f+b,a};w.rotate=function(a,b,d){var k=b[0],c=b[1],g=b[2],e=b[3],h=b[4],f=b[5],
l=b[6],x=b[7];b=b[8];var u=Math.sin(d);d=Math.cos(d);return a[0]=d*k+u*e,a[1]=d*c+u*h,a[2]=d*g+u*f,a[3]=d*e-u*k,a[4]=d*h-u*c,a[5]=d*f-u*g,a[6]=l,a[7]=x,a[8]=b,a};w.scale=function(a,b,d){var k=d[0];d=d[1];return a[0]=k*b[0],a[1]=k*b[1],a[2]=k*b[2],a[3]=d*b[3],a[4]=d*b[4],a[5]=d*b[5],a[6]=b[6],a[7]=b[7],a[8]=b[8],a};w.fromMat2d=function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=0,a[3]=b[2],a[4]=b[3],a[5]=0,a[6]=b[4],a[7]=b[5],a[8]=1,a};w.fromQuat=function(a,b){var d=b[0],k=b[1],c=b[2],g=b[3],e=d+d,h=k+k,
f=c+c,d=d*e,l=k*e,k=k*h,x=c*e,u=c*h,c=c*f,e=g*e,h=g*h,g=g*f;return a[0]=1-k-c,a[3]=l-g,a[6]=x+h,a[1]=l+g,a[4]=1-d-c,a[7]=u-e,a[2]=x-h,a[5]=u+e,a[8]=1-d-k,a};w.normalFromMat4=function(a,b){var d=b[0],k=b[1],c=b[2],g=b[3],e=b[4],h=b[5],f=b[6],l=b[7],x=b[8],u=b[9],n=b[10],y=b[11],m=b[12],r=b[13],p=b[14],q=b[15],s=d*h-k*e,z=d*f-c*e,A=d*l-g*e,B=k*f-c*h,v=k*l-g*h,w=c*l-g*f,E=x*r-u*m,F=x*p-n*m,x=x*q-y*m,G=u*p-n*r,u=u*q-y*r,n=n*q-y*p;return(y=s*n-z*u+A*G+B*x-v*F+w*E)?(y=1/y,a[0]=(h*n-f*u+l*G)*y,a[1]=(f*x-
e*n-l*F)*y,a[2]=(e*u-h*x+l*E)*y,a[3]=(c*u-k*n-g*G)*y,a[4]=(d*n-c*x+g*F)*y,a[5]=(k*x-d*u-g*E)*y,a[6]=(r*w-p*v+q*B)*y,a[7]=(p*A-m*w-q*z)*y,a[8]=(m*v-r*A+q*s)*y,a):null};w.str=function(a){return"mat3("+a[0]+", "+a[1]+", "+a[2]+", "+a[3]+", "+a[4]+", "+a[5]+", "+a[6]+", "+a[7]+", "+a[8]+")"};w.frob=function(a){return Math.sqrt(Math.pow(a[0],2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2)+Math.pow(a[4],2)+Math.pow(a[5],2)+Math.pow(a[6],2)+Math.pow(a[7],2)+Math.pow(a[8],2))};"undefined"!=typeof c&&
(c.mat3=w);var v={create:function(){var a=new h(16);return a[0]=1,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=1,a[6]=0,a[7]=0,a[8]=0,a[9]=0,a[10]=1,a[11]=0,a[12]=0,a[13]=0,a[14]=0,a[15]=1,a},clone:function(a){var b=new h(16);return b[0]=a[0],b[1]=a[1],b[2]=a[2],b[3]=a[3],b[4]=a[4],b[5]=a[5],b[6]=a[6],b[7]=a[7],b[8]=a[8],b[9]=a[9],b[10]=a[10],b[11]=a[11],b[12]=a[12],b[13]=a[13],b[14]=a[14],b[15]=a[15],b},copy:function(a,b){return a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a[4]=b[4],a[5]=b[5],a[6]=b[6],a[7]=b[7],
a[8]=b[8],a[9]=b[9],a[10]=b[10],a[11]=b[11],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15],a},identity:function(a){return a[0]=1,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=1,a[6]=0,a[7]=0,a[8]=0,a[9]=0,a[10]=1,a[11]=0,a[12]=0,a[13]=0,a[14]=0,a[15]=1,a},transpose:function(a,b){if(a===b){var d=b[1],k=b[2],c=b[3],g=b[6],e=b[7],h=b[11];a[1]=b[4];a[2]=b[8];a[3]=b[12];a[4]=d;a[6]=b[9];a[7]=b[13];a[8]=k;a[9]=g;a[11]=b[14];a[12]=c;a[13]=e;a[14]=h}else a[0]=b[0],a[1]=b[4],a[2]=b[8],a[3]=b[12],a[4]=b[1],a[5]=b[5],a[6]=
b[9],a[7]=b[13],a[8]=b[2],a[9]=b[6],a[10]=b[10],a[11]=b[14],a[12]=b[3],a[13]=b[7],a[14]=b[11],a[15]=b[15];return a},invert:function(a,b){var d=b[0],k=b[1],c=b[2],g=b[3],e=b[4],h=b[5],f=b[6],l=b[7],x=b[8],u=b[9],n=b[10],m=b[11],r=b[12],p=b[13],q=b[14],s=b[15],v=d*h-k*e,z=d*f-c*e,A=d*l-g*e,B=k*f-c*h,w=k*l-g*h,I=c*l-g*f,E=x*p-u*r,F=x*q-n*r,G=x*s-m*r,J=u*q-n*p,K=u*s-m*p,L=n*s-m*q,D=v*L-z*K+A*J+B*G-w*F+I*E;return D?(D=1/D,a[0]=(h*L-f*K+l*J)*D,a[1]=(c*K-k*L-g*J)*D,a[2]=(p*I-q*w+s*B)*D,a[3]=(n*w-u*I-m*B)*
D,a[4]=(f*G-e*L-l*F)*D,a[5]=(d*L-c*G+g*F)*D,a[6]=(q*A-r*I-s*z)*D,a[7]=(x*I-n*A+m*z)*D,a[8]=(e*K-h*G+l*E)*D,a[9]=(k*G-d*K-g*E)*D,a[10]=(r*w-p*A+s*v)*D,a[11]=(u*A-x*w-m*v)*D,a[12]=(h*F-e*J-f*E)*D,a[13]=(d*J-k*F+c*E)*D,a[14]=(p*z-r*B-q*v)*D,a[15]=(x*B-u*z+n*v)*D,a):null},adjoint:function(a,b){var d=b[0],k=b[1],c=b[2],g=b[3],e=b[4],h=b[5],f=b[6],l=b[7],n=b[8],u=b[9],m=b[10],y=b[11],r=b[12],p=b[13],q=b[14],s=b[15];return a[0]=h*(m*s-y*q)-u*(f*s-l*q)+p*(f*y-l*m),a[1]=-(k*(m*s-y*q)-u*(c*s-g*q)+p*(c*y-g*
m)),a[2]=k*(f*s-l*q)-h*(c*s-g*q)+p*(c*l-g*f),a[3]=-(k*(f*y-l*m)-h*(c*y-g*m)+u*(c*l-g*f)),a[4]=-(e*(m*s-y*q)-n*(f*s-l*q)+r*(f*y-l*m)),a[5]=d*(m*s-y*q)-n*(c*s-g*q)+r*(c*y-g*m),a[6]=-(d*(f*s-l*q)-e*(c*s-g*q)+r*(c*l-g*f)),a[7]=d*(f*y-l*m)-e*(c*y-g*m)+n*(c*l-g*f),a[8]=e*(u*s-y*p)-n*(h*s-l*p)+r*(h*y-l*u),a[9]=-(d*(u*s-y*p)-n*(k*s-g*p)+r*(k*y-g*u)),a[10]=d*(h*s-l*p)-e*(k*s-g*p)+r*(k*l-g*h),a[11]=-(d*(h*y-l*u)-e*(k*y-g*u)+n*(k*l-g*h)),a[12]=-(e*(u*q-m*p)-n*(h*q-f*p)+r*(h*m-f*u)),a[13]=d*(u*q-m*p)-n*(k*q-
c*p)+r*(k*m-c*u),a[14]=-(d*(h*q-f*p)-e*(k*q-c*p)+r*(k*f-c*h)),a[15]=d*(h*m-f*u)-e*(k*m-c*u)+n*(k*f-c*h),a},determinant:function(a){var b=a[0],d=a[1],c=a[2],g=a[3],e=a[4],h=a[5],f=a[6],l=a[7],m=a[8],n=a[9],u=a[10],p=a[11],r=a[12],q=a[13],s=a[14];a=a[15];return(b*h-d*e)*(u*a-p*s)-(b*f-c*e)*(n*a-p*q)+(b*l-g*e)*(n*s-u*q)+(d*f-c*h)*(m*a-p*r)-(d*l-g*h)*(m*s-u*r)+(c*l-g*f)*(m*q-n*r)},multiply:function(a,b,d){var c=b[0],g=b[1],e=b[2],h=b[3],f=b[4],l=b[5],m=b[6],n=b[7],u=b[8],p=b[9],r=b[10],q=b[11],s=b[12],
v=b[13],w=b[14];b=b[15];var C=d[0],z=d[1],A=d[2],B=d[3];return a[0]=C*c+z*f+A*u+B*s,a[1]=C*g+z*l+A*p+B*v,a[2]=C*e+z*m+A*r+B*w,a[3]=C*h+z*n+A*q+B*b,C=d[4],z=d[5],A=d[6],B=d[7],a[4]=C*c+z*f+A*u+B*s,a[5]=C*g+z*l+A*p+B*v,a[6]=C*e+z*m+A*r+B*w,a[7]=C*h+z*n+A*q+B*b,C=d[8],z=d[9],A=d[10],B=d[11],a[8]=C*c+z*f+A*u+B*s,a[9]=C*g+z*l+A*p+B*v,a[10]=C*e+z*m+A*r+B*w,a[11]=C*h+z*n+A*q+B*b,C=d[12],z=d[13],A=d[14],B=d[15],a[12]=C*c+z*f+A*u+B*s,a[13]=C*g+z*l+A*p+B*v,a[14]=C*e+z*m+A*r+B*w,a[15]=C*h+z*n+A*q+B*b,a}};v.mul=
v.multiply;v.translate=function(a,b,d){var c=d[0],g=d[1];d=d[2];var e,h,f,l,m,n,u,p,r,q,s,v;return b===a?(a[12]=b[0]*c+b[4]*g+b[8]*d+b[12],a[13]=b[1]*c+b[5]*g+b[9]*d+b[13],a[14]=b[2]*c+b[6]*g+b[10]*d+b[14],a[15]=b[3]*c+b[7]*g+b[11]*d+b[15]):(e=b[0],h=b[1],f=b[2],l=b[3],m=b[4],n=b[5],u=b[6],p=b[7],r=b[8],q=b[9],s=b[10],v=b[11],a[0]=e,a[1]=h,a[2]=f,a[3]=l,a[4]=m,a[5]=n,a[6]=u,a[7]=p,a[8]=r,a[9]=q,a[10]=s,a[11]=v,a[12]=e*c+m*g+r*d+b[12],a[13]=h*c+n*g+q*d+b[13],a[14]=f*c+u*g+s*d+b[14],a[15]=l*c+p*g+v*
d+b[15]),a};v.scale=function(a,b,d){var c=d[0],g=d[1];d=d[2];return a[0]=b[0]*c,a[1]=b[1]*c,a[2]=b[2]*c,a[3]=b[3]*c,a[4]=b[4]*g,a[5]=b[5]*g,a[6]=b[6]*g,a[7]=b[7]*g,a[8]=b[8]*d,a[9]=b[9]*d,a[10]=b[10]*d,a[11]=b[11]*d,a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15],a};v.rotate=function(a,b,d,c){var g=c[0],h=c[1];c=c[2];var f=Math.sqrt(g*g+h*h+c*c),l,m,n,p,u,r,q,s,v,w,H,C,z,A,B,N,I,E,F,G,J,K,L,D;return Math.abs(f)<e?null:(f=1/f,g*=f,h*=f,c*=f,l=Math.sin(d),m=Math.cos(d),n=1-m,p=b[0],u=b[1],r=b[2],q=
b[3],s=b[4],v=b[5],w=b[6],H=b[7],C=b[8],z=b[9],A=b[10],B=b[11],N=g*g*n+m,I=h*g*n+c*l,E=c*g*n-h*l,F=g*h*n-c*l,G=h*h*n+m,J=c*h*n+g*l,K=g*c*n+h*l,L=h*c*n-g*l,D=c*c*n+m,a[0]=p*N+s*I+C*E,a[1]=u*N+v*I+z*E,a[2]=r*N+w*I+A*E,a[3]=q*N+H*I+B*E,a[4]=p*F+s*G+C*J,a[5]=u*F+v*G+z*J,a[6]=r*F+w*G+A*J,a[7]=q*F+H*G+B*J,a[8]=p*K+s*L+C*D,a[9]=u*K+v*L+z*D,a[10]=r*K+w*L+A*D,a[11]=q*K+H*L+B*D,b!==a&&(a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]),a)};v.rotateX=function(a,b,d){var c=Math.sin(d);d=Math.cos(d);var g=b[4],
e=b[5],h=b[6],f=b[7],l=b[8],n=b[9],m=b[10],p=b[11];return b!==a&&(a[0]=b[0],a[1]=b[1],a[2]=b[2],a[3]=b[3],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]),a[4]=g*d+l*c,a[5]=e*d+n*c,a[6]=h*d+m*c,a[7]=f*d+p*c,a[8]=l*d-g*c,a[9]=n*d-e*c,a[10]=m*d-h*c,a[11]=p*d-f*c,a};v.rotateY=function(a,b,d){var c=Math.sin(d);d=Math.cos(d);var g=b[0],e=b[1],h=b[2],f=b[3],l=b[8],n=b[9],m=b[10],p=b[11];return b!==a&&(a[4]=b[4],a[5]=b[5],a[6]=b[6],a[7]=b[7],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]),a[0]=g*d-l*c,
a[1]=e*d-n*c,a[2]=h*d-m*c,a[3]=f*d-p*c,a[8]=g*c+l*d,a[9]=e*c+n*d,a[10]=h*c+m*d,a[11]=f*c+p*d,a};v.rotateZ=function(a,b,d){var c=Math.sin(d);d=Math.cos(d);var g=b[0],e=b[1],h=b[2],f=b[3],l=b[4],n=b[5],m=b[6],p=b[7];return b!==a&&(a[8]=b[8],a[9]=b[9],a[10]=b[10],a[11]=b[11],a[12]=b[12],a[13]=b[13],a[14]=b[14],a[15]=b[15]),a[0]=g*d+l*c,a[1]=e*d+n*c,a[2]=h*d+m*c,a[3]=f*d+p*c,a[4]=l*d-g*c,a[5]=n*d-e*c,a[6]=m*d-h*c,a[7]=p*d-f*c,a};v.fromRotationTranslation=function(a,b,d){var c=b[0],g=b[1],e=b[2],h=b[3],
f=c+c,l=g+g,n=e+e;b=c*f;var m=c*l,c=c*n,p=g*l,g=g*n,e=e*n,f=h*f,l=h*l,h=h*n;return a[0]=1-(p+e),a[1]=m+h,a[2]=c-l,a[3]=0,a[4]=m-h,a[5]=1-(b+e),a[6]=g+f,a[7]=0,a[8]=c+l,a[9]=g-f,a[10]=1-(b+p),a[11]=0,a[12]=d[0],a[13]=d[1],a[14]=d[2],a[15]=1,a};v.fromQuat=function(a,b){var d=b[0],c=b[1],g=b[2],e=b[3],h=d+d,f=c+c,l=g+g,d=d*h,n=c*h,c=c*f,m=g*h,p=g*f,g=g*l,h=e*h,f=e*f,e=e*l;return a[0]=1-c-g,a[1]=n+e,a[2]=m-f,a[3]=0,a[4]=n-e,a[5]=1-d-g,a[6]=p+h,a[7]=0,a[8]=m+f,a[9]=p-h,a[10]=1-d-c,a[11]=0,a[12]=0,a[13]=
0,a[14]=0,a[15]=1,a};v.frustum=function(a,b,d,c,g,e,h){var f=1/(d-b),l=1/(g-c),n=1/(e-h);return a[0]=2*e*f,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=2*e*l,a[6]=0,a[7]=0,a[8]=(d+b)*f,a[9]=(g+c)*l,a[10]=(h+e)*n,a[11]=-1,a[12]=0,a[13]=0,a[14]=h*e*2*n,a[15]=0,a};v.perspective=function(a,b,d,c,g){b=1/Math.tan(b/2);var e=1/(c-g);return a[0]=b/d,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=b,a[6]=0,a[7]=0,a[8]=0,a[9]=0,a[10]=(g+c)*e,a[11]=-1,a[12]=0,a[13]=0,a[14]=2*g*c*e,a[15]=0,a};v.ortho=function(a,b,d,c,g,e,h){var f=1/(b-
d),l=1/(c-g),n=1/(e-h);return a[0]=-2*f,a[1]=0,a[2]=0,a[3]=0,a[4]=0,a[5]=-2*l,a[6]=0,a[7]=0,a[8]=0,a[9]=0,a[10]=2*n,a[11]=0,a[12]=(b+d)*f,a[13]=(g+c)*l,a[14]=(h+e)*n,a[15]=1,a};v.lookAt=function(a,b,d,c){var g,h,f,l,n,m,p,r,q,s,w=b[0],M=b[1];b=b[2];var O=c[0],H=c[1];c=c[2];var C=d[0],z=d[1];d=d[2];return Math.abs(w-C)<e&&Math.abs(M-z)<e&&Math.abs(b-d)<e?v.identity(a):(p=w-C,r=M-z,q=b-d,s=1/Math.sqrt(p*p+r*r+q*q),p*=s,r*=s,q*=s,g=H*q-c*r,h=c*p-O*q,f=O*r-H*p,s=Math.sqrt(g*g+h*h+f*f),s?(s=1/s,g*=s,h*=
s,f*=s):(g=0,h=0,f=0),l=r*f-q*h,n=q*g-p*f,m=p*h-r*g,s=Math.sqrt(l*l+n*n+m*m),s?(s=1/s,l*=s,n*=s,m*=s):(l=0,n=0,m=0),a[0]=g,a[1]=l,a[2]=p,a[3]=0,a[4]=h,a[5]=n,a[6]=r,a[7]=0,a[8]=f,a[9]=m,a[10]=q,a[11]=0,a[12]=-(g*w+h*M+f*b),a[13]=-(l*w+n*M+m*b),a[14]=-(p*w+r*M+q*b),a[15]=1,a)};v.str=function(a){return"mat4("+a[0]+", "+a[1]+", "+a[2]+", "+a[3]+", "+a[4]+", "+a[5]+", "+a[6]+", "+a[7]+", "+a[8]+", "+a[9]+", "+a[10]+", "+a[11]+", "+a[12]+", "+a[13]+", "+a[14]+", "+a[15]+")"};v.frob=function(a){return Math.sqrt(Math.pow(a[0],
2)+Math.pow(a[1],2)+Math.pow(a[2],2)+Math.pow(a[3],2)+Math.pow(a[4],2)+Math.pow(a[5],2)+Math.pow(a[6],2)+Math.pow(a[6],2)+Math.pow(a[7],2)+Math.pow(a[8],2)+Math.pow(a[9],2)+Math.pow(a[10],2)+Math.pow(a[11],2)+Math.pow(a[12],2)+Math.pow(a[13],2)+Math.pow(a[14],2)+Math.pow(a[15],2))};"undefined"!=typeof c&&(c.mat4=v);var q={create:function(){var a=new h(4);return a[0]=0,a[1]=0,a[2]=0,a[3]=1,a}};q.rotationTo=function(){var a=m.create(),b=m.fromValues(1,0,0),d=m.fromValues(0,1,0);return function(c,g,
e){var h=m.dot(g,e);return-0.999999>h?(m.cross(a,b,g),1E-6>m.length(a)&&m.cross(a,d,g),m.normalize(a,a),q.setAxisAngle(c,a,Math.PI),c):0.999999<h?(c[0]=0,c[1]=0,c[2]=0,c[3]=1,c):(m.cross(a,g,e),c[0]=a[0],c[1]=a[1],c[2]=a[2],c[3]=1+h,q.normalize(c,c))}}();q.setAxes=function(){var a=w.create();return function(b,d,c,g){return a[0]=c[0],a[3]=c[1],a[6]=c[2],a[1]=g[0],a[4]=g[1],a[7]=g[2],a[2]=-d[0],a[5]=-d[1],a[8]=-d[2],q.normalize(b,q.fromMat3(b,a))}}();q.clone=p.clone;q.fromValues=p.fromValues;q.copy=
p.copy;q.set=p.set;q.identity=function(a){return a[0]=0,a[1]=0,a[2]=0,a[3]=1,a};q.setAxisAngle=function(a,b,d){d*=0.5;var c=Math.sin(d);return a[0]=c*b[0],a[1]=c*b[1],a[2]=c*b[2],a[3]=Math.cos(d),a};q.add=p.add;q.multiply=function(a,b,d){var c=b[0],g=b[1],e=b[2];b=b[3];var h=d[0],f=d[1],l=d[2];d=d[3];return a[0]=c*d+b*h+g*l-e*f,a[1]=g*d+b*f+e*h-c*l,a[2]=e*d+b*l+c*f-g*h,a[3]=b*d-c*h-g*f-e*l,a};q.mul=q.multiply;q.scale=p.scale;q.rotateX=function(a,b,d){d*=0.5;var c=b[0],g=b[1],e=b[2];b=b[3];var h=Math.sin(d);
d=Math.cos(d);return a[0]=c*d+b*h,a[1]=g*d+e*h,a[2]=e*d-g*h,a[3]=b*d-c*h,a};q.rotateY=function(a,b,d){d*=0.5;var c=b[0],g=b[1],e=b[2];b=b[3];var h=Math.sin(d);d=Math.cos(d);return a[0]=c*d-e*h,a[1]=g*d+b*h,a[2]=e*d+c*h,a[3]=b*d-g*h,a};q.rotateZ=function(a,b,d){d*=0.5;var c=b[0],g=b[1],e=b[2];b=b[3];var h=Math.sin(d);d=Math.cos(d);return a[0]=c*d+g*h,a[1]=g*d-c*h,a[2]=e*d+b*h,a[3]=b*d-e*h,a};q.calculateW=function(a,b){var d=b[0],c=b[1],g=b[2];return a[0]=d,a[1]=c,a[2]=g,a[3]=-Math.sqrt(Math.abs(1-
d*d-c*c-g*g)),a};q.dot=p.dot;q.lerp=p.lerp;q.slerp=function(a,b,d,c){var g=b[0],e=b[1],h=b[2];b=b[3];var f=d[0],l=d[1],n=d[2];d=d[3];var m,p,r,q,s;return p=g*f+e*l+h*n+b*d,0>p&&(p=-p,f=-f,l=-l,n=-n,d=-d),1E-6<1-p?(m=Math.acos(p),r=Math.sin(m),q=Math.sin((1-c)*m)/r,s=Math.sin(c*m)/r):(q=1-c,s=c),a[0]=q*g+s*f,a[1]=q*e+s*l,a[2]=q*h+s*n,a[3]=q*b+s*d,a};q.invert=function(a,b){var d=b[0],c=b[1],g=b[2],e=b[3],h=d*d+c*c+g*g+e*e,h=h?1/h:0;return a[0]=-d*h,a[1]=-c*h,a[2]=-g*h,a[3]=e*h,a};q.conjugate=function(a,
b){return a[0]=-b[0],a[1]=-b[1],a[2]=-b[2],a[3]=b[3],a};q.length=p.length;q.len=q.length;q.squaredLength=p.squaredLength;q.sqrLen=q.squaredLength;q.normalize=p.normalize;q.fromMat3=function(a,b){var d=b[0]+b[4]+b[8];if(0<d)d=Math.sqrt(d+1),a[3]=0.5*d,d=0.5/d,a[0]=(b[7]-b[5])*d,a[1]=(b[2]-b[6])*d,a[2]=(b[3]-b[1])*d;else{var c=0;b[4]>b[0]&&(c=1);b[8]>b[3*c+c]&&(c=2);var g=(c+1)%3,e=(c+2)%3,d=Math.sqrt(b[3*c+c]-b[3*g+g]-b[3*e+e]+1);a[c]=0.5*d;d=0.5/d;a[3]=(b[3*e+g]-b[3*g+e])*d;a[g]=(b[3*g+c]+b[3*c+g])*
d;a[e]=(b[3*e+c]+b[3*c+e])*d}return a};q.str=function(a){return"quat("+a[0]+", "+a[1]+", "+a[2]+", "+a[3]+")"};"undefined"!=typeof c&&(c.quat=q)})(f)})(this);bongiovi=window.bongiovi||{};
(function(){SimpleImageLoader=function(){this._imgs={};this._toLoadCount=this._loadedCount=0;this._callbackProgress=this._callback=this._scope=void 0};var c=SimpleImageLoader.prototype;c.load=function(c,g,e,h){this._imgs={};this._loadedCount=0;this._toLoadCount=c.length;this._scope=g;this._callback=e;this._callbackProgress=h;var l=this;for(g=0;g<c.length;g++){e=new Image;e.onload=function(){l._onImageLoaded()};h=c[g];var n=h.split("/"),n=n[n.length-1].split(".")[0];this._imgs[n]=e;e.src=h}};c._onImageLoaded=
function(){this._loadedCount++;if(this._loadedCount==this._toLoadCount)this._callback.call(this._scope,this._imgs);else{var c=this._loadedCount/this._toLoadCount;this._callbackProgress&&this._callbackProgress.call(this._scope,c)}}})();bongiovi.SimpleImageLoader=new SimpleImageLoader;bongiovi.Utils={};
(function(){var c=function(c,e){this._easing=e||0.1;this._targetValue=this._value=c;bongiovi.Scheduler.addEF(this,this._update)},f=c.prototype;f._update=function(){this._checkLimit();this._value+=(this._targetValue-this._value)*this._easing};f.setTo=function(c){this._targetValue=this._value=c};f.add=function(c){this._targetValue+=c};f.limit=function(c,e){this._min=c;this._max=e;this._checkLimit()};f._checkLimit=function(){void 0!=this._min&&this._targetValue<this._min&&(this._targetValue=this._min);
void 0!=this._max&&this._targetValue>this._max&&(this._targetValue=this._max)};f.__defineGetter__("value",function(){return this._value});f.__defineGetter__("targetValue",function(){return this._targetValue});f.__defineSetter__("value",function(c){this._targetValue=c});bongiovi.EaseNumber=c})();bongiovi=window.bongiovi||{};void 0==window.requestAnimFrame&&(window.requestAnimFrame=function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(c){window.setTimeout(c,1E3/60)}}());
(function(){var c=function(){this.FRAMERATE=60;this._delayTasks=[];this._nextTasks=[];this._deferTasks=[];this._highTasks=[];this._usurpTask=[];this._enterframeTasks=[];this._idTable=0;requestAnimFrame(this._loop.bind(this))},f=c.prototype;f._loop=function(){requestAnimFrame(this._loop.bind(this));this._process()};f._process=function(){for(var c=0;c<this._enterframeTasks.length;c++){var e=this._enterframeTasks[c];null!=e&&void 0!=e&&e.func.apply(e.scope,e.params)}for(;0<this._highTasks.length;)e=
this._highTasks.pop(),e.func.apply(e.scope,e.params);for(var h=(new Date).getTime(),c=0;c<this._delayTasks.length;c++)e=this._delayTasks[c],h-e.time>e.delay&&(e.func.apply(e.scope,e.params),this._delayTasks.splice(c,1));h=(new Date).getTime();for(c=1E3/this.FRAMERATE;0<this._deferTasks.length;){var e=this._deferTasks.shift(),f=(new Date).getTime();if(f-h<c)e.func.apply(e.scope,e.params);else{this._deferTasks.unshift(e);break}}h=(new Date).getTime();for(c=1E3/this.FRAMERATE;0<this._usurpTask.length;)if(e=
this._usurpTask.shift(),f=(new Date).getTime(),f-h<c)e.func.apply(e.scope,e.params);else break;this._highTasks=this._highTasks.concat(this._nextTasks);this._nextTasks=[];this._usurpTask=[]};f.addEF=function(c,e,h){h=h||[];var f=this._idTable;this._enterframeTasks[f]={scope:c,func:e,params:h};this._idTable++;return f};f.removeEF=function(c){void 0!=this._enterframeTasks[c]&&(this._enterframeTasks[c]=null);return-1};f.delay=function(c,e,h,f){var n=(new Date).getTime();this._delayTasks.push({scope:c,
func:e,params:h,delay:f,time:n})};f.defer=function(c,e,h){this._deferTasks.push({scope:c,func:e,params:h})};f.next=function(c,e,h){this._nextTasks.push({scope:c,func:e,params:h})};f.usurp=function(c,e,h){this._usurpTask.push({scope:c,func:e,params:h})};bongiovi.Scheduler=new c})();bongiovi=window.bongiovi||{};
(function(){var c=null,f=function(){this.aspectRatio=window.innerWidth/window.innerHeight;this.fieldOfView=45;this.zNear=5;this.zFar=3E3;this.gl=this.canvas=null;this.H=this.W=0;this.shaderProgram=this.shader=null},g=f.prototype;g.init=function(c){this.canvas=c;this.gl=this.canvas.getContext("experimental-webgl",{antialias:!0});this.resize();this.gl.getParameter(this.gl.SAMPLES);this.gl.getContextAttributes();this.gl.viewport(0,0,this.gl.viewportWidth,this.gl.viewportHeight);this.gl.enable(this.gl.DEPTH_TEST);
this.gl.enable(this.gl.CULL_FACE);this.gl.enable(this.gl.BLEND);this.gl.clearColor(0,0,0,1);this.gl.clearDepth(1);this.matrix=mat4.create();mat4.identity(this.matrix);this.depthTextureExt=this.gl.getExtension("WEBKIT_WEBGL_depth_texture");this.floatTextureExt=this.gl.getExtension("OES_texture_float");this.enableAlphaBlending();var g=this;window.addEventListener("resize",function(){g.resize()})};g.getGL=function(){return this.gl};g.setShader=function(c){this.shader=c};g.setShaderProgram=function(c){this.shaderProgram=
c};g.setViewport=function(c,g,f,n){this.gl.viewport(c,g,f,n)};g.setMatrices=function(c){this.camera=c};g.rotate=function(c){mat4.copy(this.matrix,c)};g.render=function(){null!=this.shaderProgram&&(this.setViewport(0,0,this.W,this.H),this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA))};g.enableAlphaBlending=function(){this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA)};g.enableAdditiveBlending=function(){this.gl.blendFunc(this.gl.ONE,
this.gl.ONE)};g.clear=function(c,g,f,n){this.gl.clearColor(c,g,f,n);this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT)};g.draw=function(c){function g(c,e,h){void 0==e.cacheAttribLoc&&(e.cacheAttribLoc={});void 0==e.cacheAttribLoc[h]&&(e.cacheAttribLoc[h]=c.getAttribLocation(e,h));return e.cacheAttribLoc[h]}if(this.shaderProgram){this.gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform,!1,this.camera.getMatrix());this.gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform,!1,this.matrix);
this.gl.bindBuffer(this.gl.ARRAY_BUFFER,c.vBufferPos);var f=g(this.gl,this.shaderProgram,"aVertexPosition");this.gl.vertexAttribPointer(f,c.vBufferPos.itemSize,this.gl.FLOAT,!1,0,0);this.gl.enableVertexAttribArray(f);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,c.vBufferUV);f=g(this.gl,this.shaderProgram,"aTextureCoord");this.gl.vertexAttribPointer(f,c.vBufferUV.itemSize,this.gl.FLOAT,!1,0,0);this.gl.enableVertexAttribArray(f);this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,c.iBuffer);for(f=0;f<c.extraAttributes.length;f++){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,
c.extraAttributes[f].buffer);var n=g(this.gl,this.shaderProgram,c.extraAttributes[f].name);this.gl.vertexAttribPointer(n,c.extraAttributes[f].itemSize,this.gl.FLOAT,!1,0,0);this.gl.enableVertexAttribArray(n)}c.drawType==this.gl.POINTS?this.gl.drawArrays(c.drawType,0,c.vertexSize):this.gl.drawElements(c.drawType,c.iBuffer.numItems,this.gl.UNSIGNED_SHORT,0)}else console.warn("Shader program not ready yet")};g.resize=function(){this.W=window.innerWidth;this.H=window.innerHeight;this.canvas.width=this.W;
this.canvas.height=this.H;this.gl.viewportWidth=this.W;this.gl.viewportHeight=this.H;this.gl.viewport(0,0,this.W,this.H);this.aspectRatio=window.innerWidth/window.innerHeight;this.render()};f.getInstance=function(){null==c&&(c=new f);return c};bongiovi.GL=f.getInstance();bongiovi.GLTool=f.getInstance()})();bongiovi=window.bongiovi||{};
(function(){var c=function(c){void 0==c&&(c=document);this._isRotateZ=0;this.matrix=mat4.create();this.m=mat4.create();this._vZaxis=vec3.clone([0,0,0]);this._zAxis=vec3.clone([0,0,-1]);this.preMouse={x:0,y:0};this.mouse={x:0,y:0};this._isMouseDown=!1;this._rotation=quat.clone([0,0,1,0]);this.tempRotation=quat.clone([0,0,0,0]);this._currDiffY=this._currDiffX=this.diffY=this.diffX=this._rotateZMargin=0;this._offset=0.0040;this._easing=0.1;this._slerp=-1;this._isLocked=!1;var e=this;c.addEventListener("mousedown",
function(c){e._onMouseDown(c)});c.addEventListener("touchstart",function(c){e._onMouseDown(c)});c.addEventListener("mouseup",function(c){e._onMouseUp(c)});c.addEventListener("touchend",function(c){e._onMouseUp(c)});c.addEventListener("mousemove",function(c){e._onMouseMove(c)});c.addEventListener("touchmove",function(c){e._onMouseMove(c)})},f=c.prototype;f.inverseControl=function(c){this._isInvert=void 0==c?!0:c};f.lock=function(c){this._isLocked=void 0==c?!0:c};f.getMousePos=function(c){var e;void 0!=
c.changedTouches?(e=c.changedTouches[0].pageX,c=c.changedTouches[0].pageY):(e=c.clientX,c=c.clientY);return{x:e,y:c}};f._onMouseDown=function(c){if(!this._isLocked&&!this._isMouseDown){c=this.getMousePos(c);var e=quat.clone(this._rotation);this._updateRotation(e);this._rotation=e;this._isMouseDown=!0;this._isRotateZ=0;this.preMouse={x:c.x,y:c.y};if(c.y<this._rotateZMargin||c.y>window.innerHeight-this._rotateZMargin)this._isRotateZ=1;else if(c.x<this._rotateZMargin||c.x>window.innerWidth-this._rotateZMargin)this._isRotateZ=
2;this._currDiffY=this.diffY=this._currDiffX=this.diffX=0}};f._onMouseMove=function(c){this._isLocked||(c.touches&&c.preventDefault(),this.mouse=this.getMousePos(c))};f._onMouseUp=function(c){!this._isLocked&&this._isMouseDown&&(this._isMouseDown=!1)};f.setCameraPos=function(c,e){this._easing=e=e||this._easing;if(!(0<this._slerp)){var h=quat.clone(this._rotation);this._updateRotation(h);this._rotation=quat.clone(h);this._currDiffY=this.diffY=this._currDiffX=this.diffX=0;this._isMouseDown=!1;this._isRotateZ=
0;this._targetQuat=quat.clone(c);this._slerp=1}};f.resetQuat=function(){this._rotation=quat.clone([0,0,1,0]);this.tempRotation=quat.clone([0,0,0,0]);this._targetQuat=void 0;this._slerp=-1};f.update=function(){mat4.identity(this.m);void 0==this._targetQuat?(quat.set(this.tempRotation,this._rotation[0],this._rotation[1],this._rotation[2],this._rotation[3]),this._updateRotation(this.tempRotation)):(this._slerp+=0.1*(0-this._slerp),0.0010>this._slerp?(quat.set(this._rotation,this._targetQuat[0],this._targetQuat[1],
this._targetQuat[2],this._targetQuat[3]),this._targetQuat=void 0,this._slerp=-1):(quat.set(this.tempRotation,0,0,0,0),quat.slerp(this.tempRotation,this._targetQuat,this._rotation,this._slerp)));vec3.transformQuat(this._vZaxis,this._vZaxis,this.tempRotation);mat4.fromQuat(this.matrix,this.tempRotation)};f._updateRotation=function(c){this._isMouseDown&&!this._isLocked&&(this.diffX=-(this.mouse.x-this.preMouse.x),this.diffY=this.mouse.y-this.preMouse.y,this._isInvert&&(this.diffX=-this.diffX),this._isInvert&&
(this.diffY=-this.diffY));this._currDiffX+=(this.diffX-this._currDiffX)*this._easing;this._currDiffY+=(this.diffY-this._currDiffY)*this._easing;if(0<this._isRotateZ){if(1==this._isRotateZ)var e=-this._currDiffX*this._offset,e=e*(this.preMouse.y<this._rotateZMargin?-1:1),h=quat.clone([0,0,Math.sin(e),Math.cos(e)]);else e=-this._currDiffY*this._offset,e*=this.preMouse.x<this._rotateZMargin?1:-1,h=quat.clone([0,0,Math.sin(e),Math.cos(e)]);quat.multiply(quat,c,h)}else e=vec3.clone([this._currDiffX,this._currDiffY,
0]),h=vec3.create(),vec3.cross(h,e,this._zAxis),vec3.normalize(h,h),e=vec3.length(e)*this._offset,h=quat.clone([Math.sin(e)*h[0],Math.sin(e)*h[1],Math.sin(e)*h[2],Math.cos(e)]),quat.multiply(c,h,c)};bongiovi.SceneRotation=c})();(function(){var c=function(){this.gl=bongiovi.GLTool.gl;this._children=[];this._init()},f=c.prototype;f._init=function(){this.camera=new bongiovi.SimpleCamera;this.camera.setPerspective(45*Math.PI/180,window.innerWidth/window.innerHeight,5,3E3);this.camera.lockRotation();var c=vec3.clone([0,0,500]),e=vec3.create(),h=vec3.clone([0,-1,0]);this.camera.lookAt(c,e,h);this.sceneRotation=new bongiovi.SceneRotation;this.rotationFront=mat4.create();mat4.identity(this.rotationFront);this.cameraOtho=new bongiovi.Camera;
this._initTextures();this._initViews();window.addEventListener("resize",this._onResize.bind(this))};f._initTextures=function(){};f._initViews=function(){};f.loop=function(){this.update();this.render()};f.update=function(){this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);this.sceneRotation.update();bongiovi.GLTool.setMatrices(this.camera);bongiovi.GLTool.rotate(this.sceneRotation.matrix)};f.render=function(){};f._onResize=function(c){this.camera.resize&&this.camera.resize(window.innerWidth/
window.innerHeight)};bongiovi.Scene=c})();bongiovi=window.bongiovi||{};(function(){var c=function(){this.matrix=mat4.create();mat4.identity(this.matrix);this.position=vec3.create()},f=c.prototype;f.lookAt=function(c,e,h){vec3.copy(this.position,c);mat4.identity(this.matrix);mat4.lookAt(this.matrix,c,e,h)};f.getMatrix=function(){return this.matrix};bongiovi.Camera=c})();bongiovi=window.bongiovi||{};
(function(){var c=bongiovi.Camera,f=function(){c.call(this);this.projection=mat4.create();this.mtxFinal=mat4.create()},g=f.prototype=new c;g.setPerspective=function(c,g,f,n){this._fov=c;this._near=f;this._far=n;mat4.perspective(this.projection,c,g,f,n)};g.getMatrix=function(){mat4.multiply(this.mtxFinal,this.projection,this.matrix);return this.mtxFinal};g.resize=function(c){mat4.perspective(this.projection,this._fov,c,this._near,this._far)};bongiovi.CameraPerspective=f})();(function(){var c=function(c){this._listenerTarget=c||window;bongiovi.CameraPerspective.call(this);this._isLocked=!1;this._init()},f=c.prototype=new bongiovi.CameraPerspective,g=bongiovi.CameraPerspective.prototype,e=bongiovi.EaseNumber;f._init=function(){this.radius=new e(500);this.position[2]=this.radius.value;this.center=vec3.create();this.up=vec3.clone([0,-1,0]);this.lookAt(this.position,this.center,this.up);this._mouse={};this._preMouse={};this._isMouseDown=!1;this._rx=new e(0);this._rx.limit(-Math.PI/
2,Math.PI/2);this._ry=new e(0);this._preRY=this._preRX=0;this._isInvert=this._isLockRotation=this._isLocked=!1;this._listenerTarget.addEventListener("mousewheel",this._onWheel.bind(this));this._listenerTarget.addEventListener("DOMMouseScroll",this._onWheel.bind(this));this._listenerTarget.addEventListener("mousedown",this._onMouseDown.bind(this));this._listenerTarget.addEventListener("touchstart",this._onMouseDown.bind(this));this._listenerTarget.addEventListener("mousemove",this._onMouseMove.bind(this));
this._listenerTarget.addEventListener("touchmove",this._onMouseMove.bind(this));window.addEventListener("mouseup",this._onMouseUp.bind(this));window.addEventListener("touchend",this._onMouseUp.bind(this))};f.inverseControl=function(c){this._isInvert=void 0==c?!0:c};f.lock=function(c){this._isLocked=void 0==c?!0:c};f.lockRotation=function(c){this._isLockRotation=void 0==c?!0:c};f._onMouseDown=function(c){this._isLockRotation||this._isLocked||(this._isMouseDown=!0,h(c,this._mouse),h(c,this._preMouse),
this._preRX=this._rx.targetValue,this._preRY=this._ry.targetValue)};f._onMouseMove=function(c){this._isLockRotation||this._isLocked||(h(c,this._mouse),c.touches&&c.preventDefault(),this._isMouseDown&&(c=this._mouse.x-this._preMouse.x,this._isInvert&&(c*=-1),this._ry.value=this._preRY-0.01*c,c=this._mouse.y-this._preMouse.y,this._isInvert&&(c*=-1),this._rx.value=this._preRX-0.01*c,this._rx.targetValue>0.5*Math.PI&&(this._rx.targetValue=Math)))};f._onMouseUp=function(c){this._isLockRotation||this._isLocked||
(this._isMouseDown=!1)};f._onWheel=function(c){if(!this._isLocked){var g=c.wheelDelta;c=c.detail;this.radius.add(5*-(c?g?0<g/c/40*c?1:-1:-c/3:g/120))}};f.getMatrix=function(){this._updateCameraPosition();this.lookAt(this.position,this.center,this.up);return g.getMatrix.call(this)};f._updateCameraPosition=function(){this.position[2]=this.radius.value;this.position[1]=Math.sin(this._rx.value)*this.radius.value;var c=Math.cos(this._rx.value)*this.radius.value;this.position[0]=Math.cos(this._ry.value+
0.5*Math.PI)*c;this.position[2]=Math.sin(this._ry.value+0.5*Math.PI)*c};var h=function(c,g){var e=g||{};c.touches?(e.x=c.touches[0].pageX,e.y=c.touches[0].pageY):(e.x=c.clientX,e.y=c.clientY);return e};f.__defineGetter__("rx",function(){return this._rx.targetValue});f.__defineSetter__("rx",function(c){this._rx.value=c});f.__defineGetter__("ry",function(){return this._ry.targetValue});f.__defineSetter__("ry",function(c){this._ry.value=c});bongiovi.SimpleCamera=c})();(function(){var c=function(c,e,h){this.gl=bongiovi.GLTool.gl;this.vertexSize=c;this.indexSize=e;this.drawType=h;this.extraAttributes=[];this._floatArrayVertex=this.vBufferPos=void 0;this._init()},f=c.prototype;f._init=function(){};f.bufferVertex=function(c,e){for(var h=[],f=e?this.gl.DYNAMIC_DRAW:this.gl.STATIC_DRAW,n=0;n<c.length;n++)for(var s=0;s<c[n].length;s++)h.push(c[n][s]);void 0==this.vBufferPos&&(this.vBufferPos=this.gl.createBuffer());this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.vBufferPos);
if(void 0==this._floatArrayVertex)this._floatArrayVertex=new Float32Array(h);else if(c.length!=this._floatArrayVertex.length)this._floatArrayVertex=new Float32Array(h);else for(n=0;n<c.length;n++)this._floatArrayVertex[n]=c[n];this.gl.bufferData(this.gl.ARRAY_BUFFER,this._floatArrayVertex,f);this.vBufferPos.itemSize=3};f.bufferTexCoords=function(c){for(var e=[],h=0;h<c.length;h++)for(var f=0;f<c[h].length;f++)e.push(c[h][f]);this.vBufferUV=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,
this.vBufferUV);this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array(e),this.gl.STATIC_DRAW);this.vBufferUV.itemSize=2};f.bufferData=function(c,e,f,l){var n=-1;l=l?this.gl.DYNAMIC_DRAW:this.gl.STATIC_DRAW;for(var s=0;s<this.extraAttributes.length;s++)if(this.extraAttributes[s].name==e){this.extraAttributes[s].data=c;n=s;break}for(var r=[],s=0;s<c.length;s++)for(var m=0;m<c[s].length;m++)r.push(c[s][m]);if(-1==n)s=this.gl.createBuffer(),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,s),n=new Float32Array(r),
this.gl.bufferData(this.gl.ARRAY_BUFFER,n,l),this.extraAttributes.push({name:e,data:c,itemSize:f,buffer:s,floatArray:n});else{s=this.extraAttributes[n].buffer;this.gl.bindBuffer(this.gl.ARRAY_BUFFER,s);n=this.extraAttributes[n].floatArray;for(s=0;s<r.length;s++)n[s]=r[s];this.gl.bufferData(this.gl.ARRAY_BUFFER,n,l)}};f.bufferIndices=function(c){this.iBuffer=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,this.iBuffer);this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(c),
this.gl.STATIC_DRAW);this.iBuffer.itemSize=1;this.iBuffer.numItems=c.length};bongiovi.Mesh=c})();(function(){var c=function(c,e){this.gl=bongiovi.GL.gl;this.idVertex=c;this.idFragment=e;this.parameters=[];this.uniformTextures=[];this.fragmentShader=this.vertexShader=void 0;this._isReady=!1;this._loadedCount=0;void 0==c&&this.createVertexShaderProgram("precision highp float;attribute vec3 aVertexPosition;attribute vec2 aTextureCoord;uniform mat4 uMVMatrix;uniform mat4 uPMatrix;varying vec2 vTextureCoord;void main(void) {    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);    vTextureCoord = aTextureCoord;}");
void 0==e&&this.createFragmentShaderProgram("precision mediump float;varying vec2 vTextureCoord;uniform sampler2D texture;void main(void) {    gl_FragColor = texture2D(texture, vTextureCoord);}");this.init()};c.defaultVertexShader="precision highp float;attribute vec3 aVertexPosition;attribute vec2 aTextureCoord;uniform mat4 uMVMatrix;uniform mat4 uPMatrix;varying vec2 vTextureCoord;void main(void) {    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);    vTextureCoord = aTextureCoord;}";
c.defaultFragmentShader="precision mediump float;varying vec2 vTextureCoord;uniform sampler2D texture;void main(void) {    gl_FragColor = texture2D(texture, vTextureCoord);}";var f=c.prototype;f.init=function(){this.idVertex&&-1<this.idVertex.indexOf("main(void)")?this.createVertexShaderProgram(this.idVertex):this.getShader(this.idVertex,!0);this.idFragment&&-1<this.idFragment.indexOf("main(void)")?this.createFragmentShaderProgram(this.idFragment):this.getShader(this.idFragment,!1)};f.getShader=function(c,
e){if(c){var f=new XMLHttpRequest;f.hasCompleted=!1;var l=this;f.onreadystatechange=function(c){4==c.target.readyState&&(e?l.createVertexShaderProgram(c.target.responseText):l.createFragmentShaderProgram(c.target.responseText))};f.open("GET",c,!0);f.send(null)}};f.createVertexShaderProgram=function(c){if(this.gl){var e=this.gl.createShader(this.gl.VERTEX_SHADER);this.gl.shaderSource(e,c);this.gl.compileShader(e);if(!this.gl.getShaderParameter(e,this.gl.COMPILE_STATUS))return console.warn("Error in Vertex Shader : ",
this.idVertex,":",this.gl.getShaderInfoLog(e)),console.log(c),null;this.vertexShader=e;void 0!=this.vertexShader&&void 0!=this.fragmentShader&&this.attachShaderProgram();this._loadedCount++}};f.createFragmentShaderProgram=function(c){if(this.gl){var e=this.gl.createShader(this.gl.FRAGMENT_SHADER);this.gl.shaderSource(e,c);this.gl.compileShader(e);if(!this.gl.getShaderParameter(e,this.gl.COMPILE_STATUS))return console.warn("Error in Fragment Shader: ",this.idFragment,":",this.gl.getShaderInfoLog(e)),
console.log(c),null;this.fragmentShader=e;void 0!=this.vertexShader&&void 0!=this.fragmentShader&&this.attachShaderProgram();this._loadedCount++}};f.attachShaderProgram=function(){this._isReady=!0;this.shaderProgram=this.gl.createProgram();this.gl.attachShader(this.shaderProgram,this.vertexShader);this.gl.attachShader(this.shaderProgram,this.fragmentShader);this.gl.linkProgram(this.shaderProgram)};f.bind=function(){this._isReady&&(this.gl.useProgram(this.shaderProgram),void 0==this.shaderProgram.pMatrixUniform&&
(this.shaderProgram.pMatrixUniform=this.gl.getUniformLocation(this.shaderProgram,"uPMatrix")),void 0==this.shaderProgram.mvMatrixUniform&&(this.shaderProgram.mvMatrixUniform=this.gl.getUniformLocation(this.shaderProgram,"uMVMatrix")),bongiovi.GLTool.setShader(this),bongiovi.GLTool.setShaderProgram(this.shaderProgram),this.uniformTextures=[])};f.isReady=function(){return this._isReady};f.uniform=function(c,e,f){if(this._isReady){"texture"==e&&(e="uniform1i");for(var l=!1,n,s=0;s<this.parameters.length;s++)if(n=
this.parameters[s],n.name==c){n.value=f;l=!0;break}l?this.shaderProgram[c]=n.uniformLoc:(this.shaderProgram[c]=this.gl.getUniformLocation(this.shaderProgram,c),this.parameters.push({name:c,type:e,value:f,uniformLoc:this.shaderProgram[c]}));if(-1==e.indexOf("Matrix"))this.gl[e](this.shaderProgram[c],f);else this.gl[e](this.shaderProgram[c],!1,f);"uniform1i"==e&&(this.uniformTextures[f]=this.shaderProgram[c])}};f.unbind=function(){};bongiovi.GLShader=c})();(function(){var c,f,g=function(e,g,n){n=n||{};c=bongiovi.GL.gl;f=bongiovi.GL;if(g)this.texture=e;else{this._source=e;this.texture=c.createTexture();this._isVideo="VIDEO"==e.tagName;this.magFilter=n.magFilter||c.LINEAR;this.minFilter=n.minFilter||c.LINEAR_MIPMAP_NEAREST;this.wrapS=n.wrapS||c.MIRRORED_REPEAT;this.wrapT=n.wrapT||c.MIRRORED_REPEAT;g=e.width||e.videoWidth;n=e.height||e.videoHeight;if(g){if(0==g||g&g-1||0==n||n&n-1)this.wrapS=this.wrapT=c.CLAMP_TO_EDGE,this.minFilter==c.LINEAR_MIPMAP_NEAREST&&
(this.minFilter=c.LINEAR),console.log(this.minFilter,c.LINEAR_MIPMAP_NEAREST,c.LINEAR)}else this.wrapS=this.wrapT=c.CLAMP_TO_EDGE,this.minFilter==c.LINEAR_MIPMAP_NEAREST&&(this.minFilter=c.LINEAR);c.bindTexture(c.TEXTURE_2D,this.texture);c.pixelStorei(c.UNPACK_FLIP_Y_WEBGL,!0);c.texImage2D(c.TEXTURE_2D,0,c.RGBA,c.RGBA,c.UNSIGNED_BYTE,e);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,this.magFilter);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,this.minFilter);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_S,
this.wrapS);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,this.wrapT);this.minFilter==c.LINEAR_MIPMAP_NEAREST&&c.generateMipmap(c.TEXTURE_2D);c.bindTexture(c.TEXTURE_2D,null)}},e=g.prototype;e.updateTexture=function(e){e&&(this._source=e);c.bindTexture(c.TEXTURE_2D,this.texture);c.pixelStorei(c.UNPACK_FLIP_Y_WEBGL,!0);c.texImage2D(c.TEXTURE_2D,0,c.RGBA,c.RGBA,c.UNSIGNED_BYTE,this._source);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,this.magFilter);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,
this.minFilter);this.minFilter==c.LINEAR_MIPMAP_NEAREST&&c.generateMipmap(c.TEXTURE_2D);c.bindTexture(c.TEXTURE_2D,null)};e.bind=function(e,g){void 0==e&&(e=0);f.shader&&(c.activeTexture(c.TEXTURE0+e),c.bindTexture(c.TEXTURE_2D,this.texture),c.uniform1i(f.shader.uniformTextures[e],e),this._bindIndex=e)};e.unbind=function(){c.bindTexture(c.TEXTURE_2D,null)};bongiovi.GLTexture=g})();(function(){var c=function(c,e){this.shader=new bongiovi.GLShader(c,e);this._init()},f=c.prototype;f._init=function(){};f.render=function(){};bongiovi.View=c})();(function(){var c=bongiovi.View,f=function(e,g){c.call(this,e,g)},g=f.prototype=new c;g._init=function(){this.mesh=bongiovi.MeshUtils.createPlane(2,2,1)};g.render=function(c){this.shader.isReady()&&(this.shader.bind(),this.shader.uniform("texture","uniform1i",0),c.bind(0),bongiovi.GLTool.draw(this.mesh))};bongiovi.ViewCopy=f})();(function(){var c,f=bongiovi.GLTexture,g=function(e,g,f){c=bongiovi.GLTool.gl;f=f||{};this.width=e;this.height=g;this.magFilter=f.magFilter||c.LINEAR;this.minFilter=f.minFilter||c.LINEAR;this.wrapS=f.wrapS||c.MIRRORED_REPEAT;this.wrapT=f.wrapT||c.MIRRORED_REPEAT;if(0==e||e&e-1||0==g||g&g-1)this.wrapS=this.wrapT=c.CLAMP_TO_EDGE,this.minFilter==c.LINEAR_MIPMAP_NEAREST&&(this.minFilter=c.LINEAR);this._init()},e=g.prototype;e._init=function(){this.depthTextureExt=c.getExtension("WEBKIT_WEBGL_depth_texture");
this.texture=c.createTexture();this.depthTexture=c.createTexture();this.glTexture=new f(this.texture,!0);this.glDepthTexture=new f(this.depthTexture,!0);this.frameBuffer=c.createFramebuffer();c.bindFramebuffer(c.FRAMEBUFFER,this.frameBuffer);this.frameBuffer.width=this.width;this.frameBuffer.height=this.height;c.bindTexture(c.TEXTURE_2D,this.texture);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,this.magFilter);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,this.minFilter);c.texParameteri(c.TEXTURE_2D,
c.TEXTURE_WRAP_S,c.CLAMP_TO_EDGE);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,c.CLAMP_TO_EDGE);this.magFilter==c.NEAREST&&this.minFilter==c.NEAREST?c.texImage2D(c.TEXTURE_2D,0,c.RGBA,this.frameBuffer.width,this.frameBuffer.height,0,c.RGBA,c.FLOAT,null):c.texImage2D(c.TEXTURE_2D,0,c.RGBA,this.frameBuffer.width,this.frameBuffer.height,0,c.RGBA,c.UNSIGNED_BYTE,null);this.minFilter==c.LINEAR_MIPMAP_NEAREST&&c.generateMipmap(c.TEXTURE_2D);c.bindTexture(c.TEXTURE_2D,this.depthTexture);c.texParameteri(c.TEXTURE_2D,
c.TEXTURE_MAG_FILTER,c.NEAREST);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,c.NEAREST);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_S,c.CLAMP_TO_EDGE);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,c.CLAMP_TO_EDGE);null!=this.depthTextureExt&&c.texImage2D(c.TEXTURE_2D,0,c.DEPTH_COMPONENT,this.width,this.height,0,c.DEPTH_COMPONENT,c.UNSIGNED_SHORT,null);c.framebufferTexture2D(c.FRAMEBUFFER,c.COLOR_ATTACHMENT0,c.TEXTURE_2D,this.texture,0);if(null==this.depthTextureExt){var e=c.createRenderbuffer();
c.bindRenderbuffer(c.RENDERBUFFER,e);c.renderbufferStorage(c.RENDERBUFFER,c.DEPTH_COMPONENT16,this.frameBuffer.width,this.frameBuffer.height);c.framebufferRenderbuffer(c.FRAMEBUFFER,c.DEPTH_ATTACHMENT,c.RENDERBUFFER,e)}else c.framebufferTexture2D(c.FRAMEBUFFER,c.DEPTH_ATTACHMENT,c.TEXTURE_2D,this.depthTexture,0);c.bindTexture(c.TEXTURE_2D,null);c.bindRenderbuffer(c.RENDERBUFFER,null);c.bindFramebuffer(c.FRAMEBUFFER,null)};e.bind=function(){c.bindFramebuffer(c.FRAMEBUFFER,this.frameBuffer)};e.unbind=
function(){c.bindFramebuffer(c.FRAMEBUFFER,null)};e.getTexture=function(){return this.glTexture};e.getDepthTexture=function(){return this.glDepthTexture};bongiovi.FrameBuffer=g})();(function(){var c,f=function(e,g,f){c=bongiovi.GL;void 0!=e&&(this.view="string"==typeof e?new bongiovi.ViewCopy(null,e):e,this.width=void 0==g?512:g,this.height=void 0==f?512:f,this._init())},g=f.prototype;g._init=function(){this.fbo=new bongiovi.FrameBuffer(this.width,this.height);this.fbo.bind();c.setViewport(0,0,this.fbo.width,this.fbo.height);c.clear(0,0,0,0);this.fbo.unbind();c.setViewport(0,0,c.canvas.width,c.canvas.height)};g.render=function(e){this.fbo.bind();c.setViewport(0,0,this.fbo.width,
this.fbo.height);c.clear(0,0,0,0);this.view.render(e);this.fbo.unbind();c.setViewport(0,0,c.canvas.width,c.canvas.height);return this.fbo.getTexture()};g.getTexture=function(){return this.fbo.getTexture()};bongiovi.Pass=f})();(function(c){c=function(){this._passes=[]};var f=c.prototype=new bongiovi.Pass;f.addPass=function(c){this._passes.push(c)};f.render=function(c){this.texture=c;for(c=0;c<this._passes.length;c++)this.texture=this._passes[c].render(this.texture);return this.texture};f.getTexture=function(){return this.texture};bongiovi.EffectComposer=c})();(function(){bongiovi.MeshUtils={};bongiovi.MeshUtils.createPlane=function(c,f,g){var e=[],h=[],l=[],n=c/g,s=f/g,r=1/g,m=0;c=0.5*-c;f=0.5*-f;for(var p=0;p<g;p++)for(var w=0;w<g;w++){var v=n*p+c,q=s*w+f;e.push([v,q,0]);e.push([v+n,q,0]);e.push([v+n,q+s,0]);e.push([v,q+s,0]);v=p/g;q=w/g;h.push([v,q]);h.push([v+r,q]);h.push([v+r,q+r]);h.push([v,q+r]);l.push(4*m+0);l.push(4*m+1);l.push(4*m+2);l.push(4*m+0);l.push(4*m+2);l.push(4*m+3);m++}g=new bongiovi.Mesh(e.length,l.length,bongiovi.GLTool.gl.TRIANGLES);
g.bufferVertex(e);g.bufferTexCoords(h);g.bufferIndices(l);return g};bongiovi.MeshUtils.createSphere=function(c,f){for(var g=[],e=[],h=[],l=0,n=1/f,s=function(e,g){var a=e/f*Math.PI-0.5*Math.PI,b=g/f*Math.PI*2,d=[];d[1]=Math.sin(a)*c;a=Math.cos(a)*c;d[0]=Math.cos(b)*a;d[2]=Math.sin(b)*a;return d},r=0;r<f;r++)for(var m=0;m<f;m++){g.push(s(r,m));g.push(s(r+1,m));g.push(s(r+1,m+1));g.push(s(r,m+1));var p=m/f,w=r/f;e.push([1-p,w]);e.push([1-p,w+n]);e.push([1-p-n,w+n]);e.push([1-p-n,w]);h.push(4*l+0);h.push(4*
l+1);h.push(4*l+2);h.push(4*l+0);h.push(4*l+2);h.push(4*l+3);l++}l=new bongiovi.Mesh(g.length,h.length,bongiovi.GLTool.gl.TRIANGLES);l.bufferVertex(g);l.bufferTexCoords(e);l.bufferIndices(h);return l};bongiovi.MeshUtils.createCube=function(c,f){}})();(function(){var c=bongiovi.GL,f=function(c,e,f){this.value=c;void 0==c&&(this.value=0);bongiovi.Pass.call(this,"precision mediump float;varying vec2 vTextureCoord;uniform sampler2D texture;uniform float brightness;void main(void) {\tvec4 color = texture2D(texture, vTextureCoord);\tcolor.rgb += vec3(brightness);\tgl_FragColor = color;}",e,f)};(f.prototype=new bongiovi.Pass).render=function(f){this.fbo.bind();c.setViewport(0,0,this.fbo.width,this.fbo.height);c.clear(0,0,0,0);this.view.shader.bind();
this.view.shader.uniform("brightness","uniform1f",this.value);this.view.render(f);this.fbo.unbind();c.setViewport(0,0,c.canvas.width,c.canvas.height);return this.fbo.getTexture()};void 0==bongiovi.post&&(bongiovi.post={});bongiovi.post.PassBrightness=f})();(function(){var c=bongiovi.GL,f=function(c,e,f){this.value=c;void 0==c&&(this.value=1);bongiovi.Pass.call(this,"precision mediump float;varying vec2 vTextureCoord;uniform sampler2D texture;uniform float contrast;float _contrast(float value, float scale) {\treturn clamp( .5 + (value - .5) * scale, 0.0, 1.0);}vec3 _contrast(vec3 value, float scale) {\treturn vec3(_contrast(value.r, scale), _contrast(value.g, scale), _contrast(value.b, scale) );}void main(void) {\tvec4 color = texture2D(texture, vTextureCoord);\tcolor.rgb = _contrast(color.rgb, contrast);\tgl_FragColor = color;}",
e,f)};(f.prototype=new bongiovi.Pass).render=function(f){this.fbo.bind();c.setViewport(0,0,this.fbo.width,this.fbo.height);c.clear(0,0,0,0);this.view.shader.bind();this.view.shader.uniform("contrast","uniform1f",this.value);this.view.render(f);this.fbo.unbind();c.setViewport(0,0,c.canvas.width,c.canvas.height);return this.fbo.getTexture()};void 0==bongiovi.post&&(bongiovi.post={});bongiovi.post.PassContrast=f})();(function(){var c=bongiovi.GL,f=function(c,e,f){this.value=c;void 0==c&&(this.value=0);bongiovi.Pass.call(this,"precision mediump float;varying vec2 vTextureCoord;uniform sampler2D texture;uniform float greyscale;void main(void) {\tvec4 color = texture2D(texture, vTextureCoord);\tfloat grey = dot(color.rgb, vec3(0.299, 0.587, 0.114));\tcolor.rgb = mix(vec3(grey), color.rgb, 1.0-greyscale);\tgl_FragColor = color;}",e,f)};(f.prototype=new bongiovi.Pass).render=function(f){this.fbo.bind();c.setViewport(0,
0,this.fbo.width,this.fbo.height);c.clear(0,0,0,0);this.view.shader.bind();this.view.shader.uniform("greyscale","uniform1f",this.value);this.view.render(f);this.fbo.unbind();c.setViewport(0,0,c.canvas.width,c.canvas.height);return this.fbo.getTexture()};void 0==bongiovi.post&&(bongiovi.post={});bongiovi.post.PassGreyscale=f})();(function(){var c=bongiovi.GL,f=function(c,e,f){this.value=c;void 0==c&&(this.value=0);bongiovi.Pass.call(this,"precision mediump float;varying vec2 vTextureCoord;uniform sampler2D texture;uniform vec2 delta;float random(vec3 scale, float seed) {\treturn fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);}void main(void) {\tvec4 color = vec4(0.0);\tfloat total = 0.0;\tfloat offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);\tfor (float t = -30.0; t <= 30.0; t++) {\t\tfloat percent = (t + offset - 0.5) / 30.0;\t\tfloat weight = 1.0 - abs(percent);\t\tvec4 sample = texture2D(texture, vTextureCoord + delta * percent);\t\t\t\tsample.rgb *= sample.a;\t\tcolor += sample * weight;\t\ttotal += weight;\t}\tgl_FragColor = color/total;\tgl_FragColor.rgb /= gl_FragColor.a + .00001;}",
e,f)};(f.prototype=new bongiovi.Pass).render=function(f){this.fbo.bind();c.setViewport(0,0,this.fbo.width,this.fbo.height);c.clear(0,0,0,0);this.view.shader.bind();this.view.shader.uniform("delta","uniform2fv",this.value);this.view.render(f);this.fbo.unbind();c.setViewport(0,0,c.canvas.width,c.canvas.height);return this.fbo.getTexture()};void 0==bongiovi.post&&(bongiovi.post={});bongiovi.post.PassTriangleBlurSingle=f})();
(function(){var c=bongiovi.GL,f=function(c,e,f){this.value=c;this._width=e;this._height=f;void 0==c&&(this.value=0);bongiovi.EffectComposer.call(this);this._init()},g=f.prototype=new bongiovi.EffectComposer,e=bongiovi.EffectComposer.prototype;g._init=function(){this._passVertical=new bongiovi.post.PassTriangleBlurSingle([0,this.value/c.canvas.height],this._width,this._height);this._passHorizontal=new bongiovi.post.PassTriangleBlurSingle([this.value/c.canvas.width,0],this._width,this._height);this.addPass(this._passVertical);
this.addPass(this._passHorizontal)};g.render=function(f){this._passVertical.value=[0,this.value/c.canvas.height];this._passHorizontal.value=[this.value/c.canvas.width,0];return e.render.call(this,f)};void 0==bongiovi.post&&(bongiovi.post={});bongiovi.post.PassTriangleBlur=f})();

},{}]},{},[1]);
