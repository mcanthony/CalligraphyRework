(function() {
	var Scene = function() {
		this.gl = bongiovi.GLTool.gl;

		this._init();
	};

	var p = Scene.prototype;

	p._init = function() {
		this.camera = new bongiovi.CameraPerspective();
		this.camera.setPerspective(45, window.innerWidth/window.innerHeight, 5, 3000);

		var eye            = vec3.clone([0, 0, 500]  );
		var center         = vec3.create( );
		var up             = vec3.clone( [0,-1,0] );
		this.camera.lookAt(eye, center, up);
		
		this.sceneRotation = new bongiovi.SceneRotation();
		this.rotationFront = mat4.create();
		mat4.identity(this.rotationFront);
		
		this.cameraOtho    = new bongiovi.Camera();

		// In SuperClass should call following functions.
		this._initTextures();
		this._initViews();
	};

	p._initTextures = function() {
		// console.log("Should be overwritten by SuperClass");
	};

	p._initViews = function() {
		// console.log("Should be overwritten by SuperClass");
	};

	p.loop = function() {
		this.update();
		this.render();
	};

	p.update = function() {
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
		this.sceneRotation.update();
		bongiovi.GLTool.setMatrices(this.camera );
		bongiovi.GLTool.rotate(this.sceneRotation.matrix);
	};

	p.render = function() {

	};

	bongiovi.Scene = Scene;

})();